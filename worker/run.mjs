import { mkdir, readFile, writeFile, rename, open, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { createAcpClient } from './acp-client.mjs';
import { CONFIG, processJob, assertOffering } from './core.mjs';
import { scanToken } from '../netlify/functions/_shared/risk-engine.mjs';
import { createRpc, verifySettlement } from './settlement.mjs';
const dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'JepetaRiskGuard');
const file = path.join(dir, 'state.json');
const gateFile = path.join(dir, 'marketplace.json');
const log = (event, detail = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }));
async function exists(p) { try { await stat(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function main() {
  const command = process.argv[2] || 'doctor';
  if (!['doctor','start','publish','pilot-public','stop'].includes(command)) throw new Error('Use doctor, start, publish, pilot-public or stop.');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (command === 'stop') { await writeFile(path.join(dir, 'STOP'), 'stop'); log('STOP_REQUESTED'); return; }
  const api = createAcpClient();
  const who = await api.whoami();
  if (who.id !== CONFIG.agentId || who.walletAddress?.toLowerCase() !== CONFIG.provider) throw new Error('Select Jepeta Risk Guard before starting.');
  const offering = assertOffering(await api.offerings());
  await api.jobs(); // Verifies local signer/auth initialization without moving funds.
  log('LOCAL_PREFLIGHT_OK', { agent: CONFIG.agentId, offering: CONFIG.offeringId, hidden: offering.isHidden });
  if (command === 'doctor') return;
  let state = await exists(file) ? JSON.parse(await readFile(file, 'utf8')) : { version: 1, jobs: {}, marketplaceVerified: false };
  if (state.version !== 1 || !state.jobs || typeof state.jobs !== 'object') throw new Error('Invalid state file; refusing to reset financial history.');
  const save = async () => { await writeFile(file + '.tmp', JSON.stringify(state, null, 2), { mode: 0o600 }); await rename(file + '.tmp', file); };
  if (command === 'pilot-public') {
    const heartbeatPath = path.join(dir, 'heartbeat.json');
    if (!await exists(heartbeatPath)) throw new Error('Live worker heartbeat missing. Do not publish.');
    const heartbeat = JSON.parse(await readFile(heartbeatPath, 'utf8'));
    if (!heartbeat.live || Date.now() - Date.parse(heartbeat.at) > 90000)
      throw new Error('Live worker heartbeat is stale. Do not publish.');
    const unfinished = Object.values(state.jobs).some(j => !j?.settlement && !j?.terminal);
    if (unfinished) throw new Error('An unfinished pilot job already exists. Do not open another public slot.');
    if (Object.keys(state.jobs).length >= CONFIG.pilotMaxJobs && !state.marketplaceVerified)
      throw new Error('The one-job pilot ledger is already consumed. Review it before reopening.');
    await writeFile(gateFile, JSON.stringify({
      pilotPublic: true,
      pendingUntil: Date.now() + 60000,
      openedAt: new Date().toISOString()
    }), { mode: 0o600 });
    try {
      await api.publish();
      const listed = assertOffering(await api.offerings());
      if (listed.isHidden !== false) throw new Error('Public pilot visibility change was not confirmed.');
      await writeFile(gateFile, JSON.stringify({
        pilotPublic: true,
        openedAt: new Date().toISOString()
      }), { mode: 0o600 });
      log('PUBLIC_ONE_JOB_PILOT_ENABLED', { priceUSDC: CONFIG.price });
      return;
    } catch (error) {
      await api.hide().catch(() => log('URGENT_HIDE_OFFERING_MANUALLY'));
      await unlink(gateFile).catch(() => {});
      throw error;
    }
  }
  if (command === 'publish') {
    const proof = Object.values(state.jobs).find(j => j.completed && j.settlement?.creditedUSDCraw);
    if (!proof) throw new Error('Paid end-to-end settlement has not been verified. Offering remains hidden.');
    const heartbeat = JSON.parse(await readFile(path.join(dir, 'heartbeat.json'), 'utf8'));
    if (!heartbeat.live || Date.now() - Date.parse(heartbeat.at) > 90000) throw new Error('Live worker heartbeat missing; keep offering hidden.');
    await verifySettlement(proof.settlement.jobId, proof.startBlock); // Recheck chain, not a success banner.
    await writeFile(gateFile, JSON.stringify({ pendingUntil: Date.now() + 60000 }), { mode: 0o600 });
    try {
    await api.publish();
    const listed = assertOffering(await api.offerings());
    if (listed.isHidden !== false) throw new Error('Offering visibility change not confirmed.');
    const found = await api.buyerBrowse();
    const agents = Array.isArray(found) ? found : found.data;
    const visible = agents?.find(a => a.walletAddress?.toLowerCase() === CONFIG.provider && a.offerings?.some(o => o.name === CONFIG.name && Number(o.priceValue) === 0.03));
    if (!visible) { await api.hide(); throw new Error('Marketplace visibility not confirmed; offering re-hidden. Verify from an independent buyer account.'); }
    await writeFile(gateFile, JSON.stringify({ enabled: true, proof: proof.settlement }), { mode: 0o600 }); log('MARKETPLACE_VERIFIED'); return;
    } catch (error) {
      await api.hide().catch(() => log('URGENT_HIDE_OFFERING_MANUALLY'));
      await unlink(gateFile).catch(() => {}); throw error;
    }
  }
  const live = process.argv.includes('--live');
  if (live && process.env.JEPETA_CHAIN_FEES_APPROVED !== 'true')
    throw new Error('Live signatures need local approval of possible chain fees: set JEPETA_CHAIN_FEES_APPROVED=true after reviewing sponsorship/cost. No funds are moved by this preflight.');
  const lockPath = path.join(dir, 'worker.lock');
  if (await exists(lockPath)) {
    const pid = Number(await readFile(lockPath, 'utf8'));
    try { process.kill(pid, 0); throw new Error('A worker is already running.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; await unlink(lockPath); }
  }
  const lock = await open(lockPath, 'wx', 0o600); await lock.writeFile(String(process.pid)); await lock.close();
  await unlink(path.join(dir, 'STOP')).catch(e => { if (e.code !== 'ENOENT') throw e; });
  const rpc = createRpc(); let running = true, listener, failures = 0;
  const shutdown = () => { running = false; listener?.kill(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  // Persistent stream keeps the provider online; REST reconciliation recovers missed/replayed events.
  function connect() {
    listener = api.listen(); listener.stdout.resume(); listener.stderr.resume();
    listener.on('error', () => { log('EVENT_STREAM_ERROR'); });
    listener.on('exit', () => { listener = null; });
  }
  try {
    connect(); log(live ? 'PILOT_WORKER_STARTED' : 'READ_ONLY_WORKER_STARTED');
    while (running && !await exists(path.join(dir, 'STOP'))) {
      if (!listener) connect();
      try {
        // Reload publish flag without overwriting the single writer's job journal.
        if (await exists(file)) { const gate = await exists(gateFile) ? JSON.parse(await readFile(gateFile, 'utf8')) : {}; state.marketplaceVerified = gate.enabled === true; }
        const current = assertOffering(await api.offerings());
        const gate = await exists(gateFile) ? JSON.parse(await readFile(gateFile, 'utf8')) : {};
        if (gate.pendingUntil > Date.now()) { await sleep(5000); continue; }
        const publicPilot = gate.pilotPublic === true && !state.marketplaceVerified;
        if (current.isHidden === false && !state.marketplaceVerified && !publicPilot) {
          if (live) await api.hide();
          throw new Error('Unexpected public listing before settlement verification.');
        }
        const list = await api.jobs(); if (!Array.isArray(list.jobs)) throw new Error('Unexpected ACP job response.');
        const jobs = new Map(Object.entries(state.jobs).filter(([, r]) => !r.settlement && !r.terminal).map(([id, r]) => [id, r.job]));
        for (const j of list.jobs) if (j.chainId === 8453 && j.providerAddress?.toLowerCase() === CONFIG.provider && j.description === CONFIG.name) jobs.set(String(j.onChainJobId), j);
        for (const [id, job] of jobs) {
          try {
            const history = await api.history(id);
            const outcome = await processJob({ job, history, state, save, api, scanner: scanToken, live,
              blockNumber: () => rpc('eth_blockNumber') });
            if (outcome.action !== 'wait') log('JOB_STATE', outcome);
            if (state.jobs[id]?.completed && !state.jobs[id].settlement) {
              state.jobs[id].settlement = await verifySettlement(id, state.jobs[id].startBlock, rpc); await save();
              log('TEST_USDC_RECEIPT_VERIFIED', state.jobs[id].settlement);
            }
          } catch (error) { log('JOB_REQUIRES_ATTENTION', { jobId: id, reason: error.message }); }
        }
        if (gate.pilotPublic === true && !state.marketplaceVerified) {
          const records = Object.values(state.jobs);
          const settled = records.find(r => r?.completed && r?.settlement?.creditedUSDCraw);
          const activePilot = records.some(r => !r?.settlement && !r?.terminal);
          if (settled) {
            state.marketplaceVerified = true;
            await save();
            await writeFile(gateFile, JSON.stringify({
              enabled: true,
              proof: settled.settlement,
              firstCustomerVerifiedAt: new Date().toISOString()
            }), { mode: 0o600 });
            const latestOffering = assertOffering(await api.offerings());
            if (latestOffering.isHidden !== false) await api.publish();
            log('FIRST_CUSTOMER_SETTLEMENT_VERIFIED', settled.settlement);
          } else if (activePilot) {
            const latestOffering = assertOffering(await api.offerings());
            if (latestOffering.isHidden === false) {
              await api.hide();
              log('PUBLIC_PILOT_PAUSED_FOR_FIRST_JOB');
            }
          }
        }
        await writeFile(path.join(dir, 'heartbeat.json'), JSON.stringify({ at: new Date().toISOString(), live, pid: process.pid }), { mode: 0o600 });
        failures = 0;
      } catch (error) { failures++; log('WORKER_ERROR', { reason: error.message }); if (failures >= 3) throw error; }
      await sleep(20000);
    }
  } finally {
    listener?.kill();
    // A stopped provider must not keep selling a five-minute SLA.
    if (live) { try { await api.hide(); log('OFFERING_PAUSED'); } catch { log('URGENT_HIDE_OFFERING_MANUALLY'); } }
    await unlink(lockPath).catch(() => {}); await unlink(path.join(dir, 'heartbeat.json')).catch(() => {});
  }
}
main().catch(error => { log('STOPPED_NOT_READY', { reason: error.message }); process.exitCode = 1; });

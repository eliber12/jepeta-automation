import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { CONFIG } from './core.mjs';
function locate() {
  if (process.env.JEPETA_ACP_ENTRY && existsSync(process.env.JEPETA_ACP_ENTRY)) return realpathSync(process.env.JEPETA_ACP_ENTRY);
  const prefixes = [process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules'),
    path.join(path.dirname(process.execPath), 'node_modules'), '/usr/local/lib/node_modules', '/usr/lib/node_modules'].filter(Boolean);
  for (const prefix of prefixes) {
    const directory = path.join(prefix, '@virtuals-protocol', 'acp-cli'), file = path.join(directory, 'package.json');
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.acp;
    if (pkg.name === '@virtuals-protocol/acp-cli' && bin && existsSync(path.join(directory, bin))) return realpathSync(path.join(directory, bin));
  }
  throw new Error('ACP entry not found. Set JEPETA_ACP_ENTRY to the installed CLI JavaScript entry.');
}
function parseJson(text) {
  try { return JSON.parse(text.trim()); } catch { throw new Error('ACP returned unexpected non-JSON output; stop, do not guess.'); }
}
export function createAcpClient() {
  const entry = locate();
  // Run JavaScript directly, without cmd.exe/PowerShell reparsing JSON or spaces.
  const call = (args, env = process.env) => new Promise((resolve, reject) => execFile(process.execPath, [entry, ...args, '--json'],
    { env, windowsHide: true, timeout: 45000, maxBuffer: 2097152, encoding: 'utf8', shell: false }, (error, stdout) => {
      let value; try { value = parseJson(stdout); } catch { return reject(new Error(`ACP ${args.slice(0, 2).join(' ')} failed. Check local authentication/signing.`)); }
      if (error || value?.error || value?.success === false) return reject(new Error(`ACP ${args.slice(0, 2).join(' ')} failed (${value?.code || 'COMMAND_FAILED'}). No automatic financial retry.`));
      resolve(value);
    }));
  const idArgs = id => { if (!/^[1-9][0-9]{0,76}$/.test(id)) throw new Error('Invalid job id.'); return ['--job-id', id, '--chain-id', '8453']; };
  const guarded = async args => {
    const who = await call(['agent', 'whoami']);
    if (who.id !== CONFIG.agentId || who.walletAddress?.toLowerCase() !== CONFIG.provider)
      throw new Error('ACP active agent changed; no signature allowed.');
    return call(args);
  };
  return {
    entry,
    whoami: () => call(['agent', 'whoami']),
    offerings: () => call(['offering', 'list']),
    jobs: () => call(['job', 'list']),
    history: id => call(['job', 'history', ...idArgs(id)]),
    balance: () => call(['wallet', 'balance', '--chain-id', '8453']),
    setBudget: id => guarded(['provider', 'set-budget', ...idArgs(id), '--amount', CONFIG.price]),
    submit: (id, deliverable) => guarded(['provider', 'submit', ...idArgs(id), '--deliverable', deliverable]),
    message: (id, content) => guarded(['message', 'send', ...idArgs(id), '--content', content, '--content-type', 'structured']),
    buyerBrowse: async () => {
      const profile = process.env.JEPETA_BUYER_CONFIG_DIR;
      if (!profile || !existsSync(profile)) throw new Error('Set JEPETA_BUYER_CONFIG_DIR to an authenticated separate buyer profile before publication.');
      const env = { ...process.env, ACP_CONFIG_DIR: profile };
      const buyer = await call(['agent', 'whoami'], env);
      if (!buyer.walletAddress || buyer.walletAddress.toLowerCase() === CONFIG.provider)
        throw new Error('Marketplace discovery must be checked from a separate buyer, not the seller.');
      return call(['browse', 'Jepeta Risk Guard', '--top-k', '50'], env);
    },
    hide: () => guarded(['offering', 'update', '--offering-id', CONFIG.offeringId, '--hidden', '--no-required-funds']),
    publish: () => guarded(['offering', 'update', '--offering-id', CONFIG.offeringId, '--no-hidden', '--no-required-funds']),
    listen: () => spawn(process.execPath, [entry, 'events', 'listen', '--json'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: false }),
  };
}

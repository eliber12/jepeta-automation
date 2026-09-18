import { CONFIG } from './core.mjs';
export const ACP_CONTRACT = '0x238e541bfefd82238730d00a2208e5497f1832e0';
export const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const COMPLETED_TOPIC = '0x0fd54bd364fa9e67f17b091aefe930932c09fe7651cf5ad02c71a418f3341444';
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const topicAddr = x => '0x' + x?.slice(-40).toLowerCase();
export function receiptCredit(receipt, jobId) {
  const jobTopic = '0x' + BigInt(jobId).toString(16).padStart(64, '0');
  if (receipt?.status !== '0x1' || !Array.isArray(receipt.logs)) throw new Error('Settlement transaction not successful.');
  if (!receipt.logs.some(l => l.address?.toLowerCase() === ACP_CONTRACT && l.topics?.[0] === COMPLETED_TOPIC && l.topics?.[1] === jobTopic))
    throw new Error('Receipt does not contain this ACP job completion.');
  let credited = 0n;
  for (const l of receipt.logs) {
    if (l.address?.toLowerCase() === USDC && l.topics?.[0] === TRANSFER_TOPIC &&
        topicAddr(l.topics[1]) === ACP_CONTRACT && topicAddr(l.topics[2]) === CONFIG.provider) credited += BigInt(l.data);
  }
  if (credited <= 0n || credited > BigInt(CONFIG.priceRaw)) throw new Error('Expected USDC payout not found or ambiguous.');
  return credited.toString();
}
export function createRpc(fetchImpl = fetch) {
  const url = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  if (!url.startsWith('https://')) throw new Error('BASE_RPC_URL must use HTTPS.');
  return async (method, params = []) => {
    if (!['eth_chainId','eth_blockNumber','eth_getLogs','eth_getTransactionReceipt'].includes(method)) throw new Error('Read-only RPC method required.');
    const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error('Base RPC unavailable.');
    const body = await response.json(); if (body.error || body.result === undefined) throw new Error('Base RPC rejected the read request.');
    return body.result;
  };
}
export async function verifySettlement(jobId, startBlock, rpc = createRpc()) {
  if (await rpc('eth_chainId') !== '0x2105') throw new Error('RPC is not Base mainnet.');
  const latest = BigInt(await rpc('eth_blockNumber')), start = BigInt(startBlock);
  if (latest < start || latest - start > 5000n) throw new Error('Settlement outside the bounded automatic verification window.');
  const topic = '0x' + BigInt(jobId).toString(16).padStart(64, '0');
  const logs = await rpc('eth_getLogs', [{ address: ACP_CONTRACT, fromBlock: '0x' + start.toString(16), toBlock: '0x' + latest.toString(16), topics: [COMPLETED_TOPIC, topic] }]);
  if (!Array.isArray(logs) || logs.length !== 1) throw new Error('A unique completion transaction is not yet available.');
  const receipt = await rpc('eth_getTransactionReceipt', [logs[0].transactionHash]);
  if (!receipt || latest - BigInt(receipt.blockNumber) < 2n) throw new Error('Waiting for settlement confirmations.');
  return { jobId, transactionHash: logs[0].transactionHash, creditedUSDCraw: receiptCredit(receipt, jobId),
    blockNumber: receipt.blockNumber, verifiedAt: new Date().toISOString(), testTransfer: true };
}

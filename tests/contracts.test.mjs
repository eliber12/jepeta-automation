import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../worker/core.mjs';

const load = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));

test('public agent manifest matches the live ACP contract constants', async () => {
  const manifest = await load('public/agent.json');
  assert.equal(manifest.agentId, CONFIG.agentId);
  assert.equal(manifest.providerWallet, CONFIG.provider);
  assert.equal(manifest.network.chainId, CONFIG.chainId);
  assert.equal(manifest.commerce.offeringId, CONFIG.offeringId);
  assert.equal(manifest.commerce.offeringName, CONFIG.name);
  assert.equal(manifest.commerce.price.amount, CONFIG.price);
  assert.equal(manifest.commerce.slaMinutes, CONFIG.slaMinutes);
  assert.equal(manifest.commerce.requiredFunds, false);
  assert.deepEqual(manifest.input.required, ['tokenAddress']);
  assert.equal(manifest.input.additionalProperties, false);
  assert.equal(manifest.deliverable.additionalProperties, false);
  assert.deepEqual(new Set(manifest.deliverable.required), new Set([
    'riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk',
    'holderConcentration','tradingActivity','warnings','summary',
  ]));
});

test('OpenAPI clearly separates the free preview from paid ACP', async () => {
  const api = await load('public/openapi.json');
  const preview = api.components.schemas.Preview;
  assert.ok(preview.required.includes('paidReport'));
  assert.ok(preview.required.includes('warningCount'));
  assert.equal(preview.properties.paidReport.properties.priceUSDC.const, CONFIG.price);
  assert.equal('dangerousPermissions' in preview.properties, false);
  assert.equal('liquidityRisk' in preview.properties, false);
});

test('LLM guide names the provider wallet and exact paid offering', async () => {
  const text = await readFile(new URL('../public/llms.txt', import.meta.url), 'utf8');
  assert.match(text, /Token Risk Scan/);
  assert.ok(text.includes(CONFIG.provider));
  assert.match(text, /0\.03 USDC/);
  assert.match(text, /Virtuals ACP v2/);
});

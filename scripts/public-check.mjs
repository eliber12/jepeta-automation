import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const required = ['index.html','site.css','site.js','agent.json','agents.json','agents.txt','openapi.json','llms.txt','llms-full.txt','index.md','sample-full-report.json','robots.txt','sitemap.xml','.nojekyll','og-jepeta.svg'];
for (const file of required) await stat(file);

const html = await readFile('index.html','utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for (const href of [...html.matchAll(/\bhref="([^"]+)"/g)].map(m=>m[1]).filter(x=>x.startsWith('#') && !x.startsWith('#i-') && x !== '#')) {
  assert.ok(ids.has(href.slice(1)), 'Missing anchor target: '+href);
}
for (const fragment of ['https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70','https://t.me/jepeta_tools','openapi.json','agent.json','llms.txt','sample-full-report.json']) {
  assert.ok(html.includes(fragment), 'Missing public link: '+fragment);
}

const forbidden = ['worker/','supabase/','netlify/'];
for (const name of forbidden) {
  try { await stat(name); assert.fail('Forbidden private directory present: '+name); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

const texts = await Promise.all(required.filter(f=>!f.endsWith('.svg')).map(f=>readFile(f,'utf8')));
const joined = texts.join('\n');
assert.doesNotMatch(joined,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
assert.doesNotMatch(joined,/\bsk_live_[A-Za-z0-9]+\b/);
assert.doesNotMatch(joined,/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/);

console.log(JSON.stringify({publicSurfaceVerified:true,files:required.length,at:new Date().toISOString()}));

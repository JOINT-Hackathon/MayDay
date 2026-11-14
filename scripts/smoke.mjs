import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
probe.close();
await once(probe, 'close');

const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ANTHROPIC_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

async function request(path, options) {
  return fetch(base + path, { ...options, signal: AbortSignal.timeout(3000) });
}

try {
  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Server exited before health check: ' + serverOutput);
    try {
      const response = await request('/api/health');
      healthy = response.ok;
      if (healthy) break;
    } catch {
      await delay(100);
    }
  }
  assert.equal(healthy, true, 'Server did not become healthy: ' + serverOutput);

  const health = await request('/api/health');
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(health.headers.get('x-frame-options'), 'DENY');

  const status = await request('/api/status');
  const statusBody = await status.json();
  assert.equal(statusBody.available, false);
  assert.equal(statusBody.provider, 'anthropic');
  assert.equal(statusBody.verified, false);

  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /id="root"/);
  assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);

  const head = await request('/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  const route = await request('/saved-records');
  assert.equal(route.status, 200);
  assert.match(route.headers.get('content-type') || '', /text\/html/);

  const missingAsset = await request('/assets/missing.js');
  assert.equal(missingAsset.status, 404);

  const badOrigin = await request('/api/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://invalid.example' },
    body: JSON.stringify({ mode: 'mistake', text: '가상 업무 경험', consent: true }),
  });
  assert.equal(badOrigin.status, 403);

  const noKey = await request('/api/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'mistake', text: '가상 업무 경험', consent: true }),
  });
  assert.equal(noKey.status, 503);
  assert.match((await noKey.json()).error, /직접 입력/);

  console.log('Production smoke passed: health, static files, SPA route, headers, API fallback.');
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
}

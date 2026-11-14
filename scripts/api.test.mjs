import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

test('HTTP API enforces consent, validation, limits, and structured Claude responses', async () => {
  const child = spawn(process.execPath, ['--import', './scripts/fixtures/claude-fetch.mjs', 'server.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ANTHROPIC_API_KEY: 'test-only', AI_DAILY_LIMIT: '3' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    for (let i = 0; i < 60 && !output.includes('메이데이 서버:'); i++) {
      if (child.exitCode !== null) throw new Error('Server exited: ' + output);
      await delay(50);
    }
    const base = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(base, 'server starts');
    const post = (body, route = '/api/organize', headers = {}) => fetch(base + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000),
    });
    const input = { text: '가상 업무 상황', mode: 'mistake', consent: true };
    const status = await fetch(base + '/api/status').then((res) => res.json());
    assert.equal(status.available, true);
    assert.equal(status.verified, false, 'configuration is not evidence of live verification');
    assert.equal(JSON.stringify(status).includes('test-only'), false);
    assert.equal((await post({ ...input, consent: false })).status, 400);
    assert.equal((await post({ ...input, text: '' })).status, 400);
    assert.equal((await post({ ...input, mode: 'other' })).status, 400);
    assert.equal((await post(input, '/api/organize', { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await post(input, '/api/organize', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ ...input, text: '가'.repeat(5000) })).status, 413);
    const response = await post(input);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.suggestions.observed, '이것은 자동 테스트용 응답입니다.');
    assert.equal(result.meta.provider, 'anthropic');
    const chat = await post({ mode: 'feedback', consent: true, turns: [{ role: 'user', content: '보완 요청을 받았어요.' }] }, '/api/chat-turn');
    assert.equal(chat.status, 200);
    assert.equal((await chat.json()).done, false);
    const timeout = await post({ ...input, text: 'test-timeout' });
    assert.equal(timeout.status, 504);
    assert.equal((await timeout.json()).code, 'timeout');
    const capped = await post(input);
    assert.equal(capped.status, 429);
    assert.match((await capped.json()).error, /오늘/);
  } finally {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('TEAM5 proxy forwards implemented routes and isolates failures and origins', async () => {
  const calls = [];
  let upstreamStatus = 200;
  let invalidJson = false;
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ method: req.method, path: req.url, body: Buffer.concat(chunks).toString() });
    res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
    res.end(invalidJson ? '<html>error</html>' : JSON.stringify(upstreamStatus === 200 ? { forwarded: true } : { secret: 'private upstream debug details' }));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const child = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', TEAM5_BACKEND_URL: `http://127.0.0.1:${upstream.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    for (let attempt = 0; attempt < 100 && !output.includes('메이데이 서버:'); attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      await delay(50);
    }
    const base = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(base, output);
    const request = (path, method = 'GET', body, headers = {}) => fetch(base + '/api/team5' + path, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(3000),
    });
    const routes = [
      ['/experiences', 'POST', { type: 'mistake', category: '문서·자료', content: '가상 경험' }],
      ['/auth/register', 'POST', { username: 'test_user', password: 'test-only-password' }],
      ['/auth/login', 'POST', { username: 'test_user', password: 'test-only-password' }],
      ['/auth/logout', 'POST', {}],
      ['/auth/me', 'GET'],
      ['/experiences?page=1', 'GET'],
      ['/experiences/1', 'GET'],
      ['/experiences/1', 'PUT', { type: 'feedback', category: '기타', content: '수정' }],
      ['/experiences/1', 'DELETE', {}],
      ['/checklist/1', 'PUT', { content: '수정', sortOrder: 0 }],
      ['/checklist/1', 'DELETE', {}],
      ['/preventions/1', 'PUT', { category: '기타', content: '수정', triggerPoint: '전' }],
      ['/preventions/1', 'DELETE', {}],
      ['/experiences/1/checklist/order', 'PUT', { ids: [2, 1] }],
      ['/experiences/recent', 'GET'],
      ['/experiences/1/checklist', 'POST', { content: '파일 확인', sortOrder: 0 }],
      ['/experiences/1/checklist', 'GET'],
      ['/checklist/1/status', 'PATCH', { status: 'COMPLETED' }],
      ['/experiences/1/preventions', 'POST', { category: '문서·자료', content: '파일 확인', triggerPoint: '발송 전' }],
      ['/experiences/1/preventions', 'GET'],
      ['/preventions?category=' + encodeURIComponent('문서·자료'), 'GET'],
      ['/recommendations', 'POST', { category: '문서·자료', task: '메일' }],
    ];
    for (const [path, method, body] of routes) {
      const response = await request(path, method, body);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { forwarded: true });
      const call = calls.at(-1);
      assert.equal(call.method, method);
      assert.equal(decodeURIComponent(call.path), '/api' + decodeURIComponent(path));
      if (body) assert.deepEqual(JSON.parse(call.body), body);
    }
    const before = calls.length;
    assert.equal((await request('/experiences', 'DELETE')).status, 404);
    assert.equal((await request('/experiences', 'POST', { content: 'x' }, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await request('/experiences', 'POST', { content: 'x' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await request('/experiences', 'POST', { content: '가'.repeat(33000) })).status, 413);
    assert.equal(calls.length, before);
    upstreamStatus = 500;
    const failed = await request('/experiences/recent');
    assert.equal(failed.status, 502);
    assert.equal((await failed.text()).includes('private upstream'), false);
    upstreamStatus = 200; invalidJson = true;
    assert.equal((await request('/experiences/recent')).status, 502);
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    assert.equal((await request('/experiences/recent')).status, 502);
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    upstream.closeAllConnections(); upstream.close();
  }
});

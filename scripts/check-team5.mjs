import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const libs = resolve(root, 'backend/build/libs');
const jar = readdirSync(libs).find((name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'));
assert.ok(jar, 'Run npm run backend:build first.');
const folder = mkdtempSync(join(tmpdir(), 'mayday-persistence-'));
let backend, frontend, base, backendPort;
const children = new Set();
async function start(command, args, env, pattern) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  let output = '';
  child.stdout.on('data', (part) => { output = (output + part).slice(-12000); });
  child.stderr.on('data', (part) => { output = (output + part).slice(-12000); });
  for (let count = 0; count < 400; count++) {
    if (pattern.test(output)) return { child, match: output.match(pattern) };
    if (child.exitCode !== null) throw new Error(output);
    await delay(100);
  }
  throw new Error('Startup timeout: ' + output);
}
async function stop(child) {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    await exited; clearTimeout(timer);
  }
  children.delete(child);
}
async function bootBackend() {
  const started = await start('java', ['-jar', resolve(libs, jar)], {
    BACKEND_PORT: String(backendPort || 0), BACKEND_HOST: '127.0.0.1', COOKIE_SECURE: 'false',
    MAYDAY_DB_URL: `jdbc:h2:file:${folder}/mayday;MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE`, MAYDAY_DB_USER: 'sa', MAYDAY_DB_PASSWORD: '',
  }, /Tomcat started on port (\d+)/);
  backend = started.child; backendPort = Number(started.match[1]);
}
async function bootFrontend() {
  const started = await start(process.execPath, ['server.mjs'], {
    PORT: '0', HOST: '127.0.0.1', TEAM5_BACKEND_URL: `http://127.0.0.1:${backendPort}`, ANTHROPIC_API_KEY: '',
  }, /메이데이 서버: (http:\/\/127\.0\.0\.1:\d+)/);
  frontend = started.child; base = started.match[1];
}
function client() {
  let cookie = '';
  return async (path, method = 'GET', body, expected = 200, headers = {}) => {
    const response = await fetch(base + '/api/team5' + path, {
      method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${raw}`);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Strict/i);
      cookie = setCookie.split(';')[0];
    }
    return JSON.parse(raw);
  };
}
try {
  await bootBackend(); await bootFrontend();
  const alice = client(), bob = client(), anonymous = client();
  const password = 'test-only-strong-password';
  await anonymous('/experiences', 'GET', undefined, 401);
  await alice('/auth/register', 'POST', { username: 'test_alice', password });
  await bob('/auth/register', 'POST', { username: 'test_bob', password });
  assert.equal((await alice('/auth/me')).username, 'test_alice');
  await anonymous('/auth/login', 'POST', { username: 'test_alice', password: 'invalid-password' }, 401);
  await anonymous('/auth/register', 'POST', { username: 'test_alice', password }, 409);
  const details = JSON.stringify({ feeling: '당황', causeStatus: 'unknown', outcome: '다음 업무에서 확인', addonDrafts: { blackbox: '테스트 보고서', emailFormal: '테스트 메일' } });
  let experience = await alice('/experiences', 'POST', { type: 'mistake', content: '가상 경험', category: '문서·자료', details }, 201);
  const id = experience.id;
  await alice('/experiences', 'POST', { type: 'mistake', content: '', category: '기타' }, 400);
  await alice('/experiences', 'POST', { type: 'mistake', content: '가'.repeat(3001), category: '기타' }, 400);
  await alice('/experiences', 'POST', { type: 'bad', content: '경험', category: '기타' }, 400);
  experience = await alice(`/experiences/${id}`, 'PUT', { type: 'feedback', content: '수정한 경험', category: '회의·소통', details });
  assert.equal((await alice(`/experiences/${id}`)).content, '수정한 경험');
  assert.equal((await alice('/experiences/recent'))[0].id, id);
  assert.equal((await bob('/experiences')).totalElements, 0);
  for (const [path, method, body] of [[`/experiences/${id}`, 'GET'], [`/experiences/${id}`, 'PUT', experience], [`/experiences/${id}`, 'DELETE', {}], [`/experiences/${id}/checklist`, 'GET'], [`/experiences/${id}/preventions`, 'GET'], [`/experiences/${id}/checklist`, 'POST', { content: '침입', sortOrder: 0 }], [`/experiences/${id}/preventions`, 'POST', { content: '침입', category: '기타', triggerPoint: '전' }]]) await bob(path, method, body, 404);
  const first = await alice(`/experiences/${id}/checklist`, 'POST', { content: '첫 확인', sortOrder: 0 }, 201);
  const second = await alice(`/experiences/${id}/checklist`, 'POST', { content: '둘째 확인', sortOrder: 1 }, 201);
  await alice(`/checklist/${first.id}`, 'PUT', { content: '수정한 확인', sortOrder: 0 });
  for (const status of ['IN_PROGRESS', 'NOT_APPLICABLE', 'NOT_STARTED', 'COMPLETED']) assert.equal((await alice(`/checklist/${first.id}/status`, 'PATCH', { status })).status, status);
  await alice(`/checklist/${first.id}/status`, 'PATCH', { status: 'INVALID' }, 400);
  await alice(`/experiences/${id}/checklist/order`, 'PUT', { ids: [first.id, first.id] }, 400);
  await alice(`/experiences/${id}/checklist/order`, 'PUT', { ids: [second.id, first.id] });
  assert.deepEqual((await alice(`/experiences/${id}/checklist`)).map((value) => value.id), [second.id, first.id]);
  const rule = await alice(`/experiences/${id}/preventions`, 'POST', { category: '회의·소통', content: '이전 규칙', triggerPoint: '회의 전' }, 201);
  await alice(`/preventions/${rule.id}`, 'PUT', { category: '회의·소통', content: '수정한 규칙', triggerPoint: '보고 전' });
  for (const [path, method, body] of [[`/checklist/${first.id}/status`, 'PATCH', { status: 'COMPLETED' }], [`/checklist/${first.id}`, 'PUT', { content: '침입', sortOrder: 0 }], [`/checklist/${first.id}`, 'DELETE', {}], [`/preventions/${rule.id}`, 'PUT', { category: '기타', content: '침입', triggerPoint: '전' }], [`/preventions/${rule.id}`, 'DELETE', {}], [`/experiences/${id}/checklist/order`, 'PUT', { ids: [second.id, first.id] }]]) await bob(path, method, body, 404);
  assert.equal((await bob('/preventions?category=' + encodeURIComponent('회의·소통'))).length, 0);
  assert.equal((await bob('/recommendations', 'POST', { category: '회의·소통', task: '회의' })).recommendations.length, 0);
  assert.equal((await alice('/recommendations', 'POST', { category: '회의·소통', task: '회의' })).recommendations[0].content, '수정한 규칙');
  await alice('/experiences', 'POST', { content: 'cross origin' }, 403, { Origin: 'https://other.example' });
  for (let index = 0; index < 21; index++) await alice('/experiences', 'POST', { type: 'mistake', content: '페이지 테스트 ' + index, category: '기타' }, 201);
  assert.equal((await alice('/experiences?page=0')).items.length, 20);
  assert.equal((await alice('/experiences?page=1')).items.length, 2);
  console.log('PASS auth, ownership, validation, CRUD, reorder, recommendations, pagination');
  await stop(frontend); await stop(backend);
  await bootBackend(); await bootFrontend();
  assert.equal((await alice('/auth/me')).username, 'test_alice');
  const persisted = await alice(`/experiences/${id}`);
  assert.equal(persisted.content, '수정한 경험'); assert.equal(persisted.details, details);
  const check = await alice(`/experiences/${id}/checklist`);
  assert.deepEqual(check.map((value) => value.id), [second.id, first.id]);
  assert.equal(check[1].status, 'COMPLETED'); assert.equal(check[1].content, '수정한 확인');
  assert.equal((await alice(`/experiences/${id}/preventions`))[0].content, '수정한 규칙');
  console.log('PASS real backend + frontend restart: accounts, sessions, records, details, order, status, rules retained');
  await alice(`/checklist/${second.id}`, 'DELETE', {});
  await alice(`/preventions/${rule.id}`, 'DELETE', {});
  assert.equal((await alice(`/experiences/${id}/preventions`)).length, 0);
  await alice(`/experiences/${id}/preventions`, 'POST', { category: '회의·소통', content: '함께 삭제될 규칙', triggerPoint: '전' }, 201);
  await alice(`/experiences/${id}`, 'DELETE', {});
  await alice(`/experiences/${id}`, 'GET', undefined, 404);
  await alice(`/checklist/${first.id}`, 'PUT', { content: '삭제됨', sortOrder: 0 }, 404);
  assert.equal((await alice('/preventions?category=' + encodeURIComponent('회의·소통'))).length, 0);
  await alice('/auth/logout', 'POST', {});
  await alice('/auth/me', 'GET', undefined, 401);
  await alice('/auth/login', 'POST', { username: 'test_alice', password });
  assert.equal((await alice('/experiences')).totalElements, 21);
  console.log('PASS child deletion, cascading deletion, logout, persistent account login');
} finally {
  for (const child of [...children]) await stop(child);
  rmSync(folder, { recursive: true, force: true });
}

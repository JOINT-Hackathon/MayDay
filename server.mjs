import http from 'node:http';
import { proxyTeam5 } from './server/team5.mjs';
import { organize, chatTurn } from './server/reflection.mjs';
import { getAiConfig, publicAiError } from './server/claude.mjs';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const distRoot = resolve(root, 'dist');
const envPath = resolve(root, '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const dev = process.argv.includes('--dev');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || (dev ? 5173 : 4173));
const requestsByIp = new Map();
const dailyLimit = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 100);
const dailyUsage = { day: '', count: 0 };
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
].join('; ');

function sendJson(res, status, value) {
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

async function readJson(req, maxBytes = 12000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('요청이 너무 깁니다.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('올바른 JSON 요청이 아닙니다.');
    error.status = 400;
    throw error;
  }
}

function rateAllowed(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = requestsByIp.get(ip);
  const next = !current || now - current.start > 60_000
    ? { start: now, count: 1 }
    : { start: current.start, count: current.count + 1 };
  requestsByIp.set(ip, next);
  if (requestsByIp.size > 500) {
    for (const [address, entry] of requestsByIp) {
      if (now - entry.start > 60_000) requestsByIp.delete(address);
    }
    while (requestsByIp.size > 500) requestsByIp.delete(requestsByIp.keys().next().value);
  }
  return next.count <= 12;
}

function dailyAllowed() {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyUsage.day !== today) {
    dailyUsage.day = today;
    dailyUsage.count = 0;
  }
  if (dailyUsage.count >= dailyLimit) return false;
  dailyUsage.count += 1;
  return true;
}

async function handleApi(req, res, pathname) {
  if (pathname.startsWith('/api/team5/')) {
    await proxyTeam5(req, res, sendJson, readJson);
    return;
  }
  if (pathname === '/api/health' && req.method === 'GET') {
    let ready = dev || existsSync(resolve(distRoot, 'index.html'));
    if (ready && process.env.REQUIRE_BACKEND === 'true') {
      try {
        const response = await fetch(new URL('/api/auth/me', process.env.TEAM5_BACKEND_URL), { signal: AbortSignal.timeout(2000) });
        ready = response.status === 401;
      } catch { ready = false; }
    }
    sendJson(res, ready ? 200 : 503, { ok: ready });
    return;
  }
  if (pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, { available: Boolean(getAiConfig().apiKey), provider: 'anthropic', model: getAiConfig().model, verified: false });
    return;
  }
  if (pathname !== '/api/organize' && pathname !== '/api/chat-turn') {
    sendJson(res, 404, { error: 'API를 찾을 수 없습니다.' });
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST 요청만 사용할 수 있습니다.' });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        sendJson(res, 403, { error: '허용되지 않은 요청입니다.' });
        return;
      }
    } catch {
      sendJson(res, 403, { error: '허용되지 않은 요청입니다.' });
      return;
    }
  }
  if (!rateAllowed(req)) {
    sendJson(res, 429, { error: '잠시 후 다시 시도해 주세요.' });
    return;
  }
  const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    sendJson(res, 415, { error: 'JSON 요청만 사용할 수 있습니다.' });
    return;
  }

  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message });
    return;
  }
  const mode = input?.mode;
  if (!['mistake', 'feedback'].includes(mode)) {
    sendJson(res, 400, { error: '실수 또는 지적받은 상황을 선택해 주세요.' });
    return;
  }
  if (pathname === '/api/organize' &&
      (typeof input?.text !== 'string' || !input.text.trim() || input.text.length > 3000)) {
    sendJson(res, 400, { error: '경험을 3000자 이내로 입력해 주세요.' });
    return;
  }
  if (pathname === '/api/chat-turn') {
    const turns = input?.turns;
    const track = input?.preferredTrack;
    const validTurns = Array.isArray(turns) && turns.length > 0 && turns.length <= 80 && turns.some((turn) => turn?.role === 'user') &&
      turns.every((turn) => turn && ['assistant', 'user'].includes(turn.role) &&
        typeof turn.content === 'string' && turn.content.trim() && turn.content.length <= 1000) &&
      turns.filter((turn) => turn.role === 'user').length <= 40 &&
      turns.reduce((total, turn) => total + turn.content.length, 0) <= 60000;
    if ((input.finishNow !== undefined && typeof input.finishNow !== 'boolean') || !validTurns || (track != null && !['feelings', 'tasks'].includes(track))) {
      sendJson(res, 400, { error: '대화 내용을 확인해 주세요. 대화는 사용자 답변 40개, 전체 메시지 80개 이내로 입력해 주세요.' });
      return;
    }
  }
  if (input.consent !== true) {
    sendJson(res, 400, { code: 'consent_required', error: 'AI로 입력 내용을 보내는 데 동의해 주세요.' });
    return;
  }
  if (!getAiConfig().apiKey) {
    sendJson(res, 503, { error: 'AI 기능이 설정되지 않았습니다. 직접 입력을 계속할 수 있습니다.' });
    return;
  }
  if (!dailyAllowed()) {
    sendJson(res, 429, { error: '오늘 AI 사용 한도에 도달했습니다. 직접 입력을 계속해 주세요.' });
    return;
  }
  try {
    if (pathname === '/api/chat-turn') {
      sendJson(res, 200, await chatTurn(mode, input.preferredTrack || null, input.turns, input.finishNow === true));
    } else {
      sendJson(res, 200, await organize(input.text.trim(), mode));
    }
  } catch (error) {
    const failure = publicAiError(error);
    sendJson(res, failure.status, { code: failure.code, error: failure.message });
  }
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const requestedFile = resolve(distRoot, '.' + path);
  if (requestedFile !== distRoot && !requestedFile.startsWith(distRoot + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const requestedExists = existsSync(requestedFile) && statSync(requestedFile).isFile();
  const file = requestedExists ? requestedFile : extname(path) ? null : resolve(distRoot, 'index.html');
  if (!file || !existsSync(file)) {
    res.writeHead(404);
    res.end('Not found.');
    return;
  }
  res.writeHead(200, {
    ...securityHeaders,
    'Content-Security-Policy': contentSecurityPolicy,
    'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : path.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

let vite;
const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(() => sendJson(res, 500, { error: '요청을 처리하지 못했습니다.' }));
  } else if (dev) {
    vite.middlewares(req, res);
  } else {
    serveStatic(req, res, pathname);
  }
});

if (dev) {
  process.env.NODE_ENV = 'development';
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    server: { middlewareMode: { server }, hmr: { server } },
    appType: 'spa',
  });
}

server.listen(port, host, () => {
  console.log('메이데이 서버: http://' + host + ':' + server.address().port);
  console.log('AI 보조: ' + (getAiConfig().apiKey ? 'Claude 설정됨 · 실제 연결은 npm run ai:check로 확인' : '키 없음 (직접 입력 가능)'));
});

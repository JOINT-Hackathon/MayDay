import http from 'node:http';
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
const fields = ['observed', 'interpretation', 'feeling', 'unknown', 'improvement', 'followUp', 'checklist'];
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

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12000) {
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

function responseText(result) {
  for (const item of result.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part.type === 'output_text') return part.text;
    }
  }
  return '';
}

async function organize(text, mode) {
  const schema = {
    type: 'object',
    properties: Object.fromEntries(fields.map((field) => [field, { type: 'string' }])),
    required: fields,
    additionalProperties: false,
  };
  const instructions = [
    '당신은 사회초년생의 업무 경험을 정리하는 보조 도구다.',
    '입력에 없는 사실, 상대의 의도, 원인, 결과를 지어내지 마라.',
    'observed에는 사용자가 직접 보고 들었다고 서술한 내용만 제안한다. 확실하지 않으면 빈 문자열로 둔다.',
    'interpretation에는 사용자의 추측이나 해석만 제안한다.',
    'feeling에는 사용자가 표현한 감정만 넣고, 언급이 없으면 빈 문자열로 둔다.',
    'unknown에는 확인되지 않은 정보나 확인할 질문을 한 문장으로 제안한다.',
    'improvement는 사용자 입력에서 확인되는 개선 행동이나 안전한 확인 행동을 제안한다. 원인을 단정하지 마라.',
    'mistake 유형에서는 observed에 확인한 실수의 내용만, unknown에 아직 모르는 원인·영향 범위·추가 확인 사항만 적는다. 영향받은 사람, 원인, 수습 완료 여부를 추측하지 마라.',
    'mistake 유형의 followUp은 확인된 사실과 현재 확인할 일을 상사에게 간결하게 알리는 초안 한 문장이다. 하지 않은 조치나 확인되지 않은 결과를 완료했다고 쓰지 마라.',
    'feedback 유형에서는 observed에 실제 인용이나 직접 본 행동만 적고, 상사의 의도나 구체적인 평가 기준을 지어내지 마라.',
    'feedback 유형의 improvement는 기준이 불명확하면 구체적인 예시를 확인하는 행동으로 둔다. followUp은 상사에게 보낼 짧고 존중하는 확인 질문으로 둔다.',
    'checklist는 입력에 확인된 기준이 있으면 다시 확인할 행동으로 쓴다. 기준이 없으면 기준이나 예시를 묻는 행동만 제안한다. 미확인 사항을 사실처럼 쓰지 마라.',
    '각 값은 한국어 한 문장으로 짧게 작성한다. 의료·법률 판단이나 괴롭힘 판정은 하지 마라.',
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
      store: false,
      reasoning: { effort: 'none' },
      max_output_tokens: 1000,
      input: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify({ mode, text }) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'work_reflection',
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error('upstream_error');
  const result = await response.json();
  if (result.status !== 'completed') throw new Error('incomplete_response');
  const output = responseText(result);
  if (!output) throw new Error('empty_response');
  const parsed = JSON.parse(output);
  if (!fields.every((field) => typeof parsed[field] === 'string')) {
    throw new Error('invalid_response');
  }
  return Object.fromEntries(fields.map((field) => [field, parsed[field].trim().slice(0, 500)]));
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, { available: Boolean(process.env.OPENAI_API_KEY) });
    return;
  }
  if (pathname !== '/api/organize') {
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
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
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
  const text = input?.text;
  const mode = input?.mode;
  if (typeof text !== 'string' || !text.trim() || text.length > 3000 || !['mistake', 'feedback'].includes(mode)) {
    sendJson(res, 400, { error: '경험을 3000자 이내로 입력하고 유형을 선택해 주세요.' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, { error: 'AI 기능이 설정되지 않았습니다. 직접 입력을 계속할 수 있습니다.' });
    return;
  }
  if (!dailyAllowed()) {
    sendJson(res, 429, { error: '오늘 AI 사용 한도에 도달했습니다. 직접 입력을 계속해 주세요.' });
    return;
  }
  try {
    const suggestions = await organize(text.trim(), mode);
    sendJson(res, 200, { suggestions });
  } catch {
    sendJson(res, 502, { error: 'AI 제안을 불러오지 못했습니다. 직접 입력해 주세요.' });
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
  const file = existsSync(requestedFile) && statSync(requestedFile).isFile() ? requestedFile : resolve(distRoot, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('Build the app first with npm run build.');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
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
  console.log('다음장 서버: http://' + host + ':' + port);
  console.log('AI 보조: ' + (process.env.OPENAI_API_KEY ? '설정됨' : '키 없음 (직접 입력 가능)'));
});

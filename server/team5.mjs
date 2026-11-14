// Forward only the local TEAM5 API contract; never accept a client-supplied upstream URL.
const routes = [
  ['POST', /^\/auth\/(login|register|logout)$/],
  ['GET', /^\/auth\/me$/],
  ['POST', /^\/experiences$/],
  ['GET', /^\/experiences$/],
  ['GET', /^\/experiences\/[1-9]\d*$/],
  ['PUT', /^\/experiences\/[1-9]\d*$/],
  ['DELETE', /^\/experiences\/[1-9]\d*$/],
  ['PUT', /^\/(checklist|preventions)\/[1-9]\d*$/],
  ['DELETE', /^\/(checklist|preventions)\/[1-9]\d*$/],
  ['PUT', /^\/experiences\/[1-9]\d*\/checklist\/order$/],
  ['GET', /^\/experiences\/recent$/],
  ['GET', /^\/experiences\/[1-9]\d*\/(checklist|preventions)$/],
  ['POST', /^\/experiences\/[1-9]\d*\/(checklist|preventions)$/],
  ['PATCH', /^\/checklist\/[1-9]\d*\/status$/],
  ['GET', /^\/preventions$/],
  ['POST', /^\/recommendations$/],
];

export async function proxyTeam5(req, res, sendJson, readJson) {
  const incoming = new URL(req.url, 'http://localhost');
  const path = incoming.pathname.slice('/api/team5'.length);
  if (!routes.some(([method, pattern]) => method === req.method && pattern.test(path))) {
    sendJson(res, 404, { error: '지원하지 않는 서버 기능입니다.' });
    return;
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) throw new Error();
    } catch {
      sendJson(res, 403, { error: '허용되지 않은 요청입니다.' });
      return;
    }
  }
  let body;
  if (req.method !== 'GET') {
    if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
      sendJson(res, 415, { error: 'JSON 요청만 사용할 수 있습니다.' });
      return;
    }
    try { body = JSON.stringify(await readJson(req, 96000)); }
    catch (error) { sendJson(res, error.status || 400, { error: error.message }); return; }
  }
  let target;
  try {
    const base = new URL(process.env.TEAM5_BACKEND_URL || 'http://127.0.0.1:8080');
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error();
    target = new URL('/api' + path, base);
    if (path === '/experiences' && incoming.searchParams.has('page')) target.searchParams.set('page', incoming.searchParams.get('page'));
    if (path === '/preventions') target.searchParams.set('category', incoming.searchParams.get('category') || '');
  } catch {
    sendJson(res, 503, { error: '백엔드 주소 설정을 확인해 주세요.' });
    return;
  }
  try {
    const response = await fetch(target, {
      method: req.method, headers: { Accept: 'application/json', ...(req.headers.cookie?.match(/(?:^|;\s*)(mayday_session=[A-Za-z0-9_-]{43})(?:;|$)/)?.[1] ? { Cookie: req.headers.cookie.match(/(?:^|;\s*)(mayday_session=[A-Za-z0-9_-]{43})(?:;|$)/)[1] } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body, redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const messages = { 400: '입력 내용과 길이를 확인해 주세요.', 401: '로그인이 필요하거나 아이디·비밀번호가 올바르지 않습니다.', 409: '이미 사용 중인 아이디이거나 저장 내용이 충돌했습니다.', 404: '서버에 해당 기록이 없습니다. 목록을 새로고침해 주세요.', 429: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' };
      sendJson(res, response.status >= 500 ? 502 : response.status, { error: messages[response.status] || '백엔드에서 요청을 처리하지 못했습니다.' });
      return;
    }
    const cookies = response.headers.getSetCookie().filter((value) => value.startsWith('mayday_session='));
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    const data = await response.json();
    sendJson(res, response.status, data);
  } catch (error) {
    const timeout = error.name === 'TimeoutError';
    sendJson(res, timeout ? 504 : 502, {
      error: timeout ? '백엔드 응답이 지연되고 있습니다. 저장 요청이었다면 목록을 확인한 뒤 재시도해 주세요.' : 'TEAM5 백엔드에 연결하지 못했습니다. 서버 실행 상태와 주소를 확인해 주세요.',
    });
  }
}

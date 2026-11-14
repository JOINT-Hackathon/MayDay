import assert from 'node:assert/strict';

// Run only against an isolated local backend: creates synthetic records.
const origin = process.env.TEAM5_CHECK_ORIGIN || 'http://127.0.0.1:5180';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Use a local frontend connected to an isolated test backend.');
async function api(path, method = 'GET', body) {
  const response = await fetch(origin + '/api/team5' + path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.ok, true, `${method} ${path}: ${response.status}`);
  console.log(`PASS ${method} ${path} (${response.status})`);
  return response.json();
}
const category = '문서·자료';
const experience = await api('/experiences', 'POST', { type: 'mistake', category, content: '[연동 검증용 가상 기록] 메일 첨부파일 누락을 확인했습니다.' });
assert.ok(experience.id);
assert.ok((await api('/experiences/recent')).some((item) => item.id === experience.id));
const checklist = await api(`/experiences/${experience.id}/checklist`, 'POST', { content: '발송 전 첨부파일 열어 보기', sortOrder: 0 });
assert.equal((await api(`/experiences/${experience.id}/checklist`))[0].id, checklist.id);
for (const status of ['IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE', 'NOT_STARTED']) {
  assert.equal((await api(`/checklist/${checklist.id}/status`, 'PATCH', { status })).status, status);
}
const rule = await api(`/experiences/${experience.id}/preventions`, 'POST', { category, content: '첨부파일 이름과 내용을 확인하기', triggerPoint: '메일 발송 직전' });
assert.ok((await api(`/experiences/${experience.id}/preventions`)).some((item) => item.id === rule.id));
assert.ok((await api('/preventions?category=' + encodeURIComponent(category))).some((item) => item.id === rule.id));
assert.ok((await api('/recommendations', 'POST', { category, task: '메일 발송 준비' })).recommendations.some((item) => item.preventionRuleId === rule.id));
console.log('All nine TEAM5 endpoints passed. Synthetic experience ID: ' + experience.id);

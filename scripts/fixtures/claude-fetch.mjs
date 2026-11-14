// Test-only preload. Never loaded by dev, start, demo, or Docker.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.anthropic.com/v1/messages') return originalFetch(url, options);
  const payload = JSON.parse(options.body);
  const input = JSON.parse(payload.messages[0].content);
  const fields = payload.output_config.format.schema.properties;
  let data;
  if (fields.done) {
    data = { done: false, question: '직접 확인한 내용은 무엇인가요?', summary: Object.fromEntries(Object.keys(fields.summary.properties).map((field) => [field, ''])) };
    if (fields.empathy) {
      data.empathy = '회의에서 들은 말이 계속 마음에 남아 있었군요.';
      data.question = '그 말에서 어떤 부분이 가장 마음에 남나요?';
      data.summary.facts = '회의에서 보완 요청을 받았다.';
      data.summary.feeling = '걱정';
    }
  } else {
    data = { observed: '이것은 자동 테스트용 응답입니다.', interpretation: '', feeling: '', unknown: '수신 여부 확인하기', improvement: '올바른 파일 확인하기', followUp: '정정 계획 공유하기', checklist: '발송 전 버전 확인하기' };
  }
  if (input.text === 'test-timeout') throw new DOMException('timeout', 'TimeoutError');
  return Response.json({ model: payload.model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(data) }], usage: { input_tokens: 10, output_tokens: 20 } });
};

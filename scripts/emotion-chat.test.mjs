import test from 'node:test';
import assert from 'node:assert/strict';
import { chatTurn } from '../server/reflection.mjs';

test('emotion chat uses the full context, keeps empathy separate, and rejects broken responses', async (t) => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-only';
  t.after(() => { if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey; });
  const turns = [{ role: 'user', content: '회의에서 지적을 받았어요.' }, { role: 'assistant', content: '어떤 마음이 들었나요?' }, { role: 'user', content: '실수보다 공개적으로 말한 게 서운해요.' }];
  let responseKind = 'valid';
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    const input = JSON.parse(payload.messages[0].content);
    assert.deepEqual(input.turns, turns);
    assert.equal(input.preferredTrack, 'feelings');
    assert.match(payload.system, /직전 답변/);
    const summary = Object.fromEntries(Object.keys(payload.output_config.format.schema.properties.summary.properties).map((key) => [key, '']));
    summary.feeling = '서운함';
    summary.emotionFocus = '공개적으로 지적한 것';
    const data = { done: false, empathy: responseKind === 'empty-empathy' ? '' : '사람들 앞에서 들었다는 점이 서운했군요.', question: responseKind === 'empty-question' ? '' : '그 순간 어떤 말을 듣고 싶었나요?', summary };
    if (responseKind === 'invalid-summary') summary.emotionNeed = null;
    return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(data) }] });
  });
  const next = await chatTurn('feedback', 'feelings', turns);
  assert.equal(next.done, false);
  assert.match(next.empathy, /서운/);
  assert.equal(next.summary.emotionClosing, '', 'AI empathy is not a user statement');
  assert.equal('improvement' in next.summary, false);
  const finished = await chatTurn('feedback', 'feelings', turns, true);
  assert.equal(finished.done, true);
  assert.equal(finished.question, '');
  for (responseKind of ['empty-empathy', 'empty-question', 'invalid-summary']) {
    await assert.rejects(chatTurn('feedback', 'feelings', turns), /invalid_response/);
  }
});

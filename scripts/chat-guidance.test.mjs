import test from 'node:test';
import assert from 'node:assert/strict';
import { clarificationFor } from '../src/chatGuidance.mjs';
test('vague task answers ask for detail while explicit uncertainty and concrete actions can proceed', () => {
  for (const key of ['facts', 'unknown', 'improvement', 'followUp', 'checklist']) {
    for (const answer of ['', '모르겠어요', '잘할게요', '열심히 하겠습니다']) assert.ok(clarificationFor(key, answer));
  }
  assert.equal(clarificationFor('facts', '아직 직접 확인한 사실 없음'), '');
  assert.equal(clarificationFor('improvement', '오늘 보낸 메일의 첨부파일을 열어 버전을 확인하기'), '');
  assert.equal(clarificationFor('feeling', '모르겠어요'), '');
});

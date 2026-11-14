import test from 'node:test';
import assert from 'node:assert/strict';
import { saveRecordTrack, savedTracks } from '../src/recordTracks.js';
import { readChecklistItems } from '../src/checklistStore.js';

const draft = { id: 'one', facts: '메일을 보냈다', feeling: '걱정', interpretation: '실망했을까', emotionNeed: '위로', checklist: '첨부 확인', improvement: '다시 보내기' };
test('emotion and task saves are independent and retain the other saved track', () => {
  const emotion = saveRecordTrack(draft, null, 'feelings');
  assert.equal(emotion.checklist, '');
  assert.equal(emotion.emotionNeed, '위로');
  assert.deepEqual(savedTracks(emotion), ['feelings']);
  const both = saveRecordTrack({ ...draft, feeling: '저장하지 않은 변경' }, emotion, 'tasks');
  assert.equal(both.feeling, '걱정');
  assert.equal(both.checklist, '첨부 확인');
  assert.deepEqual(savedTracks(both), ['feelings', 'tasks']);
  assert.equal(saveRecordTrack(draft, null, 'tasks').feeling, '');
  assert.deepEqual(savedTracks(draft), ['feelings', 'tasks']);
  assert.throws(() => saveRecordTrack(draft, null, 'wrong'));
});
test('emotion records do not become task checklists during migration', () => {
  globalThis.window = { localStorage: { getItem: () => null } };
  const emotion = saveRecordTrack(draft, null, 'feelings');
  assert.equal(readChecklistItems([emotion, draft], []).items.length, 1);
  delete globalThis.window;
});

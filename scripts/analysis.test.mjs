import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisDraft, createDemoRecord, DEMO_RECORDS } from '../src/analysis.js';
import { checklistContext, readChecklistItems } from '../src/checklistStore.js';

test('local drafts retain supplied facts without inventing emotions or causes', () => {
  const draft = createAnalysisDraft('  견적서 옛날 버전을 보냈어요.  ');
  assert.equal(draft.facts, '견적서 옛날 버전을 보냈어요.');
  assert.equal(draft.source, 'local');
  assert.equal(draft.taskType, '문서·자료');
  for (const field of ['interpretation', 'feeling', 'cause', 'impact']) assert.equal(draft[field], '');
  assert.equal(draft.causeStatus, 'unknown');
  assert.deepEqual(draft.actionChecked, []);
});

test('feedback and deadline inputs get relevant next-action templates', () => {
  assert.equal(createAnalysisDraft('보고서 구조에 대해 지적받았어요').taskType, '회의·소통');
  assert.equal(createAnalysisDraft('보고 일정을 놓쳤어요').taskType, '일정·마감');
  assert.equal(createAnalysisDraft('무엇부터 할지 모르겠어요').taskType, '기타');
});

test('AI fields are bounded and invalid field types fall back to safe defaults', () => {
  const draft = createAnalysisDraft('첨부파일을 확인했어요.', 'mistake', { observed: 123, feeling: '걱정', checklist: '확인'.repeat(1000) });
  assert.equal(draft.facts, '', 'AI가 사실을 추출하지 못해도 원문을 사실로 재분류하지 않는다');
  assert.equal(draft.feeling, '걱정');
  assert.equal(draft.checklist.length, 1200);
  assert.equal(draft.source, 'ai');
});

test('demo records are explicitly marked and receive unique IDs', () => {
  const a = createDemoRecord(DEMO_RECORDS[0]);
  const b = createDemoRecord(DEMO_RECORDS[0]);
  assert.equal(a.source, 'demo');
  assert.notEqual(a.id, b.id);
  assert.equal(a.usedAt, null);
});

test('legacy records seed a checklist but an explicitly empty list stays empty', () => {
  const record = { id: 'legacy-1', checklist: '발송 전 파일 확인', taskType: '문서·자료', usedAt: null };
  globalThis.window = { localStorage: { getItem: () => null } };
  assert.equal(readChecklistItems([record], ['문서·자료']).items[0].recordId, 'legacy-1');
  window.localStorage.getItem = () => '[]';
  assert.deepEqual(readChecklistItems([record], ['문서·자료']).items, []);
  delete globalThis.window;
});

test('corrupted checklist storage is protected from overwrite', () => {
  globalThis.window = { localStorage: { getItem: () => '{invalid' } };
  assert.equal(readChecklistItems([], []).readError, true);
  delete globalThis.window;
});


test('updated checklist contexts keep legacy items reachable', () => {
  assert.equal(checklistContext({ taskType: '문서·자료', text: '첨부파일 열기' }), 'mail');
  assert.equal(checklistContext({ taskType: '문서·자료', text: '보고서 수치 점검' }), 'report');
  assert.equal(checklistContext({ taskType: '회의·소통', text: '발표 자료 점검' }), 'meeting');
  assert.equal(checklistContext({ taskType: '일정·마감', text: '마감 확인' }), 'schedule');
  assert.equal(checklistContext({ taskType: '기타', text: '업무 준비' }), 'other');
  assert.equal(checklistContext({ context: 'report', taskType: '문서·자료', text: '메일 관련 보고서' }), 'report');
});

test('all demonstration cases preserve complete actions and fictional provenance', () => {
  assert.equal(DEMO_RECORDS.length, 15);
  assert.equal(new Set(DEMO_RECORDS.map(item => item.title)).size, 15);
  for (const example of DEMO_RECORDS) {
    const record = createDemoRecord(example);
    for (const key of ['facts', 'interpretation', 'feeling', 'unknown', 'improvement', 'followUp', 'checklist', 'taskType']) assert.ok(record[key].trim(), `${example.title}: ${key}`);
    assert.equal(record.source, 'demo');
    assert.equal(record.causeStatus, 'unknown');
    assert.equal(record.usedAt, null);
    assert.deepEqual(record.actionChecked, []);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addDemoChecklistItems, CHECKLIST_CONTEXTS, readChecklistItems } from '../src/checklistStore.js';

test('demo checklist preserves personal items and edits without duplicating examples', () => {
  const own = { id: 'personal', text: '내 항목', context: 'mail', taskType: '문서·자료', timesApplied: 2 };
  const items = addDemoChecklistItems([own]);
  assert.equal(items.length, 16);
  assert.equal(items[0], own);
  for (const { id } of CHECKLIST_CONTEXTS) assert.equal(items.filter(x => x.source === 'demo' && x.context === id).length, 3);
  assert.ok(items.slice(1).every(x => x.timesApplied === 0 && x.lastAppliedAt === null && x.recordId === null));
  items[1] = { ...items[1], text: '편집한 예시', timesApplied: 1 };
  assert.deepEqual(addDemoChecklistItems(items), items);
  assert.equal(addDemoChecklistItems(items.slice(0, -1)).length, 16);
  globalThis.window = { localStorage: { getItem: () => JSON.stringify(items) } };
  try {
    const loaded = readChecklistItems([], ['문서·자료', '회의·소통', '일정·마감', '기타']);
    assert.equal(loaded.items.filter(x => x.source === 'demo').length, 15);
    assert.equal(loaded.items[1].text, '편집한 예시');
    assert.equal(loaded.items[1].timesApplied, 1);
  } finally { delete globalThis.window; }
});

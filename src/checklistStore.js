export const CHECKLIST_STORAGE_KEY = 'mayday.checklist.v1';

export const CHECKLIST_CONTEXTS = [
  { id: 'mail', label: '메일 보낼 때', taskType: '문서·자료' },
  { id: 'report', label: '보고서 쓸 때', taskType: '문서·자료' },
  { id: 'meeting', label: '회의 전', taskType: '회의·소통' },
  { id: 'schedule', label: '일정 정리 때', taskType: '일정·마감' },
  { id: 'other', label: '기타', taskType: '기타' },
];

export function checklistContext(item) {
  if (CHECKLIST_CONTEXTS.some((context) => context.id === item.context)) return item.context;
  if (item.taskType === '일정·마감') return 'schedule';
  if (item.taskType === '회의·소통') return 'meeting';
  if (item.taskType === '문서·자료') return /메일|첨부|발송|수신|견적/.test(item.text || item.checklist || '') ? 'mail' : 'report';
  return 'other';
}

export function checklistFromRecord(record) {
  return {
    id: record.id,
    recordId: record.id,
    text: record.checklist,
    taskType: record.taskType,
    context: checklistContext(record),
    timesApplied: record.usedAt ? 1 : 0,
    lastAppliedAt: record.usedAt || null,
  };
}

export function readChecklistItems(records, taskTypes) {
  try {
    const saved = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (saved === null) return { items: records.filter((record) => record.checklist?.trim() && (!Array.isArray(record.savedTracks) || record.savedTracks.includes('tasks'))).map(checklistFromRecord), error: '', readError: false };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('invalid checklist');
    return {
      items: parsed.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string')
        .map((item) => ({
          id: item.id,
          recordId: typeof item.recordId === 'string' ? item.recordId : null,
          text: item.text.slice(0, 200),
          context: checklistContext(item),
          taskType: taskTypes.includes(item.taskType) ? item.taskType : '기타',
          timesApplied: Number.isSafeInteger(item.timesApplied) && item.timesApplied >= 0 ? item.timesApplied : 0,
          lastAppliedAt: typeof item.lastAppliedAt === 'string' ? item.lastAppliedAt : null,
        })),
      error: '',
      readError: false,
    };
  } catch {
    return { items: [], error: '체크리스트를 읽지 못했습니다. 기존 항목을 보호하기 위해 변경할 수 없습니다.', readError: true };
  }
}

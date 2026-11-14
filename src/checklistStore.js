export const CHECKLIST_STORAGE_KEY = 'mayday.checklist.v1';

export const CHECKLIST_CONTEXTS = [
  { id: 'mail', label: '메일 보낼 때', taskType: '문서·자료' },
  { id: 'report', label: '보고서 쓸 때', taskType: '문서·자료' },
  { id: 'meeting', label: '회의 전', taskType: '회의·소통' },
  { id: 'schedule', label: '일정 정리 때', taskType: '일정·마감' },
  { id: 'other', label: '기타', taskType: '기타' },
];

const DEMO_CHECKLIST_TEXTS = {
  mail: ['보내기 전 첨부파일을 직접 열어 최신 버전인지 확인하기', '수신자·참조에 외부 주소가 포함됐는지 다시 확인하기', '메일 본문의 날짜·금액을 첨부 자료와 대조하기'],
  report: ['보고서 첫 문단에 결론과 요청 사항을 한 문장으로 적기', '표의 합계와 단위를 원본 자료와 대조하기', '공유할 문서의 링크 권한과 버전명을 확인하기'],
  meeting: ['회의 시작 전 안건과 결정이 필요한 질문을 정리하기', '발표 자료를 실제 공유 화면에서 열어 보기', '회의가 끝나기 전 담당자와 다음 마감일을 함께 확인하기'],
  schedule: ['요청받은 마감 날짜와 시간을 캘린더에 기록하기', '마감 하루 전 검토 시간을 별도로 확보하기', '일정이 겹치면 담당자에게 우선순위를 확인하기'],
  other: ['처음 맡는 업무는 완료 기준과 예시를 먼저 확인하기', '인수인계할 때 남은 일과 파일 위치를 함께 전달하기', '제출 버튼을 누른 뒤 접수 완료 화면을 확인하기'],
};

export function addDemoChecklistItems(items) {
  const ids = new Set(items.map((item) => item.id));
  const examples = CHECKLIST_CONTEXTS.flatMap(({ id: context, taskType }) => DEMO_CHECKLIST_TEXTS[context].map((text, index) => ({
    id: `demo-checklist-${context}-${index + 1}`, recordId: null, text, taskType, context,
    source: 'demo', timesApplied: 0, lastAppliedAt: null,
  })));
  return [...items, ...examples.filter((item) => !ids.has(item.id))];
}

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
          ...(item.source === 'demo' ? { source: 'demo' } : {}),
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

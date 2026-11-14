// Local suggestions are templates, not AI output or a factual interpretation.
const PLANS = {
  document: { taskType: '문서·자료', unknown: '전달된 파일과 수신 범위를 확인하기', improvement: '올바른 파일을 직접 열어 확인한 뒤 정정 내용 전달하기', followUp: '담당자에게 확인한 사실과 정정 계획을 먼저 공유하기', checklist: '외부 발송 전 첨부파일의 내용과 버전 직접 확인하기' },
  schedule: { taskType: '일정·마감', unknown: '누락된 일정과 현재 가능한 완료 시점 확인하기', improvement: '남은 업무의 우선순위와 새 완료 시점 정하기', followUp: '담당자에게 현재 진행 상황과 조정할 일정 공유하기', checklist: '업무 시작 전 오늘의 일정과 마감 알림 확인하기' },
  feedback: { taskType: '회의·소통', unknown: '피드백에서 요청한 수정 범위와 기준 확인하기', improvement: '구체적인 예시를 확인하고 수정할 항목 정리하기', followUp: '요청받은 수정 범위와 다음 공유 시점을 질문으로 확인하기', checklist: '자료 공유 전 요청받은 기준과 수정 항목 대조하기' },
  other: { taskType: '기타', unknown: '직접 확인한 사실과 아직 모르는 내용을 구분하기', improvement: '현재 바꿀 수 있는 행동 한 가지 정하기', followUp: '필요한 도움이나 확인할 내용을 담당자에게 질문하기', checklist: '다음 업무 전에 확인할 기준과 순서 점검하기' },
};

export function createAnalysisDraft(text, mode = 'mistake', suggestions = null) {
  const input = text.trim().slice(0, 1200);
  const kind = mode === 'feedback' || /지적|피드백|회의|보완/.test(input) ? 'feedback'
    : /메일|파일|첨부|견적|버전|문서/.test(input) ? 'document'
      : /일정|마감|보고 시간|보고 일정|늦|기한/.test(input) ? 'schedule' : 'other';
  const plan = PLANS[kind];
  const value = (key, fallback = '') => typeof suggestions?.[key] === 'string' && suggestions[key].trim() ? suggestions[key].trim().slice(0, 1200) : fallback;
  return {
    id: globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(), mode: kind === 'feedback' ? 'feedback' : mode,
    facts: suggestions ? value('observed') : input, interpretation: value('interpretation'), feeling: value('feeling'),
    cause: '', causeStatus: 'unknown', impact: '',
    ...plan,
    unknown: value('unknown', plan.unknown), improvement: value('improvement', plan.improvement),
    followUp: value('followUp', plan.followUp), checklist: value('checklist', plan.checklist),
    source: suggestions ? 'ai' : 'local', actionChecked: [], addonDrafts: {}, usedAt: null, outcome: '',
  };
}

export const DEMO_RECORDS = [
  { title: '견적서 잘못 보냄', date: '11/12', status: '잘 수습했어요', text: '거래처에 견적서 옛날 버전(v1)을 보냈어요. 팀장님은 아직 모르세요.', interpretation: '큰일 났다, 팀장님이 나를 일 못한다고 생각할 거야.', feeling: '당황, 불안', mode: 'mistake' },
  { title: '주간보고 깜빡함', date: '11/08', status: '체크리스트에 담았어요', text: '예정된 주간보고 시간을 놓쳤어요. 지금 진행 상황을 정리하고 있어요.', interpretation: '', feeling: '걱정, 조급함', mode: 'mistake' },
  { title: '보고서 두서없다는 말 들음', date: '11/03', status: '구조 잡는 중', text: '회의에서 팀장님이 보고서의 핵심 내용을 먼저 보여 달라고 하셨어요.', interpretation: '내 보고서가 전부 잘못된 걸까?', feeling: '속상함, 당황', mode: 'feedback' },
];

export function createDemoRecord(example) {
  return { ...createAnalysisDraft(example.text, example.mode), interpretation: example.interpretation, feeling: example.feeling, source: 'demo', demoTitle: example.title };
}

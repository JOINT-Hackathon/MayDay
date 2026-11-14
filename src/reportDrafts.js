export function buildBlackboxReport(record) {
  const why = record.causeStatus === 'confirmed' && record.cause
    ? '확인된 원인: ' + record.cause
    : record.causeStatus === 'hypothesis' && record.cause
      ? '추정한 원인(추가 확인 필요): ' + record.cause
      : '기록하지 않음';
  return [
    '블랙박스 보고서 · ' + (record.mode === 'mistake' ? '실수' : '지적') + ' 경험',
    '',
    '1. 무슨 일: ' + (record.facts || '직접 확인한 내용 작성 전'),
    '2. 왜: ' + why,
    '3. 영향: ' + (record.impact || '기록하지 않음'),
    '4. 조치: ' + (record.improvement || '기록하지 않음'),
    '5. 재발 방지: ' + (record.checklist || '체크리스트 작성 전'),
    '',
    '아직 확인할 일: ' + (record.unknown || '기록하지 않음'),
    '후속 보고 또는 질문: ' + (record.followUp || '기록하지 않음'),
  ].join('\n');
}

export function buildRecoveryEmail(record, tone = 'formal') {
  const casual = tone === 'casual';
  const completed = Array.isArray(record.actionChecked) && record.actionChecked.includes('improvement');
  return [
    '제목: ' + (record.mode === 'mistake' ? '업무 내용 공유 초안' : '피드백 내용 공유 초안'),
    '',
    casual ? '안녕하세요. 진행 상황을 공유드립니다.' : '안녕하세요.',
    '기록한 사실: ' + record.facts,
    ...(record.impact ? ['영향: ' + record.impact] : []),
    ...(record.improvement ? [(completed ? '확인한 조치: ' : '조치 계획: ') + record.improvement] : []),
    ...(record.followUp ? ['후속 보고 또는 질문: ' + record.followUp] : []),
    ...(record.unknown ? ['아직 확인할 사항: ' + record.unknown] : []),
    '다음 업무에서 확인할 항목: ' + record.checklist,
    '',
    casual ? '확인 후 다시 공유드리겠습니다.' : '감사합니다.',
  ].join('\n');
}

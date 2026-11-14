import { useEffect, useState } from 'react';
import GuidedChat from './components/GuidedChat.jsx';

const STORAGE_KEY = 'daeumjang.reflections.v1';
const TASK_TYPES = ['문서·자료', '회의·소통', '일정·마감', '기타'];
const EMPTY_DRAFT = {
  rawText: '',
  facts: '',
  interpretation: '',
  feeling: '',
  cause: '',
  causeStatus: 'unknown',
  impact: '',
  unknown: '',
  improvement: '',
  followUp: '',
  checklist: '',
  taskType: TASK_TYPES[0],
};

function readRecords() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) throw new Error('invalid records');
    const stringFields = ['facts', 'interpretation', 'feeling', 'cause', 'impact', 'unknown', 'improvement', 'followUp', 'checklist', 'outcome'];
    return {
      items: value.filter((item) => item && typeof item.id === 'string' && typeof item.facts === 'string' && typeof item.checklist === 'string').map((item) => ({
        ...item,
        mode: item.mode === 'feedback' ? 'feedback' : 'mistake',
        causeStatus: ['unknown', 'hypothesis', 'confirmed'].includes(item.causeStatus) ? item.causeStatus : 'unknown',
        taskType: TASK_TYPES.includes(item.taskType) ? item.taskType : '기타',
        ...Object.fromEntries(stringFields.map((field) => [field, typeof item[field] === 'string' ? item[field] : ''])),
      })),
      error: '',
    };
  } catch {
    return { items: [], error: '저장한 기록을 읽지 못했습니다. 이 기기의 브라우저 저장 공간을 확인해 주세요.' };
  }
}

function Field({ name, label, value, onChange, help, placeholder, rows = 3, required = false }) {
  const id = 'field-' + name;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {help && <p className="field-help" id={id + '-help'}>{help}</p>}
      <textarea id={id} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} rows={rows} maxLength={1200} required={required} aria-describedby={help ? id + '-help' : undefined} />
    </div>
  );
}

function buildBlackboxReport(record) {
  const why = record.causeStatus === 'confirmed' && record.cause
    ? '확인된 원인: ' + record.cause
    : record.causeStatus === 'hypothesis' && record.cause
      ? '추정한 원인(추가 확인 필요): ' + record.cause
      : '원인 확인 중';
  return [
    '블랙박스 보고서 · ' + (record.mode === 'mistake' ? '실수' : '지적') + ' 경험',
    '',
    '1. 무슨 일: ' + (record.facts || '직접 확인한 내용 작성 전'),
    '2. 왜: ' + why,
    '3. 영향: ' + (record.impact || '영향 확인 중'),
    '4. 조치: ' + (record.improvement || record.followUp || '조치 계획 확인 중'),
    '5. 재발 방지: ' + (record.checklist || '체크리스트 작성 전'),
    '',
    '아직 확인할 일: ' + (record.unknown || '없음'),
  ].join('\n');
}

function buildRecoveryEmail(record) {
  return [
    '제목: ' + (record.mode === 'mistake' ? '업무 관련 오류 및 조치 내용 공유' : '피드백 후속 조치 내용 공유'),
    '',
    '안녕하세요.',
    '현재 확인한 내용은 다음과 같습니다: ' + (record.facts || '직접 확인한 내용 작성 전'),
    '확인된 영향: ' + (record.impact || '확인 중입니다.'),
    '현재 조치 또는 개선 계획: ' + (record.improvement || '확인 후 정리해 공유드리겠습니다.'),
    '후속 보고 또는 질문: ' + (record.followUp || '확인 후 다시 공유드리겠습니다.'),
    '추가로 확인할 사항: ' + (record.unknown || '없습니다.'),
    '다음 업무에서 확인할 항목: ' + (record.checklist || '체크리스트 작성 전'),
    '',
    '확인 후 필요한 내용을 다시 공유드리겠습니다.',
    '감사합니다.',
  ].join('\n');
}

export default function App() {
  const [page, setPage] = useState('home');
  const [entryMode, setEntryMode] = useState('mistake');
  const [track, setTrack] = useState('feelings');
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [records, setRecords] = useState(readRecords);
  const [selectedId, setSelectedId] = useState(null);
  const [taskFilter, setTaskFilter] = useState('전체');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAvailable, setAiAvailable] = useState(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [addon, setAddon] = useState('blackbox');

  const selected = records.items.find((item) => item.id === selectedId);
  const taskRecords = records.items.filter((item) => taskFilter === '전체' || item.taskType === taskFilter);

  useEffect(() => {
    let active = true;
    fetch('/api/status')
      .then((response) => response.ok ? response.json() : { available: false })
      .then((result) => { if (active) setAiAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setAiAvailable(false); });
    return () => { active = false; };
  }, []);

  function persist(nextItems) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
      setRecords({ items: nextItems, error: '' });
      return true;
    } catch {
      setRecords((current) => ({ ...current, error: '저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' }));
      return false;
    }
  }

  function updateDraft(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
    setFormError('');
    setAiError('');
  }

  function start(mode) {
    setEntryMode(mode);
    setTrack('feelings');
    setDraft({ ...EMPTY_DRAFT });
    setAiConsent(false);
    setAddon('blackbox');
    setFormError('');
    setAiError('');
    setNotice('');
    setPage('chat');
    window.scrollTo({ top: 0 });
  }

  function finishChat(patch) {
    setDraft({ ...EMPTY_DRAFT, ...patch });
    setTrack('feelings');
    setFormError('');
    setPage('form');
    window.scrollTo({ top: 0 });
  }

  async function askAi() {
    if (!draft.rawText.trim()) {
      setAiError('먼저 상황을 한두 문장으로 적어 주세요.');
      return;
    }
    if (!aiConsent) {
      setAiError('AI로 전송할 내용을 확인하고 동의해 주세요.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    setNotice('');
    try {
      const response = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.rawText, mode: entryMode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI 제안을 불러오지 못했습니다.');
      const suggestions = result.suggestions || {};
      setDraft((current) => ({
        ...current,
        facts: current.facts || suggestions.observed || '',
        interpretation: current.interpretation || suggestions.interpretation || '',
        feeling: current.feeling || suggestions.feeling || '',
        unknown: current.unknown || suggestions.unknown || '',
        improvement: current.improvement || suggestions.improvement || '',
        followUp: current.followUp || suggestions.followUp || '',
        checklist: current.checklist || suggestions.checklist || '',
      }));
      setNotice('AI 초안을 채웠습니다. 확인한 사실과 추측을 직접 검토하고 고쳐 주세요.');
    } catch (error) {
      setAiError(error.message || 'AI 요청에 실패했습니다. 아래 칸에 직접 입력할 수 있습니다.');
    } finally {
      setAiLoading(false);
    }
  }

  function saveDraft(event) {
    event.preventDefault();
    if (!draft.facts.trim()) {
      setFormError('직접 확인한 사실을 적어 주세요.');
      setTrack('feelings');
      return;
    }
    if (!draft.checklist.trim()) {
      setFormError('다음 업무에서 확인할 체크리스트 한 항목을 적어 주세요.');
      return;
    }
    const item = {
      id: window.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      mode: entryMode,
      facts: draft.facts.trim(),
      interpretation: draft.interpretation.trim(),
      feeling: draft.feeling.trim(),
      cause: draft.cause.trim(),
      causeStatus: draft.causeStatus,
      impact: draft.impact.trim(),
      unknown: draft.unknown.trim(),
      improvement: draft.improvement.trim(),
      followUp: draft.followUp.trim(),
      checklist: draft.checklist.trim(),
      taskType: draft.taskType,
      usedAt: null,
      outcome: '',
    };
    if (persist([item, ...records.items])) {
      setSelectedId(item.id);
      setOutcomeText('');
      setAddon('blackbox');
      setPage('review');
      setNotice('이 기기의 브라우저에 기록했습니다.');
      window.scrollTo({ top: 0 });
    }
  }

  function openRecord(item) {
    setSelectedId(item.id);
    setOutcomeText(item.outcome || '');
    setAddon('blackbox');
    setNotice('');
    setPage('review');
    window.scrollTo({ top: 0 });
  }

  function updateRecord(id, patch) {
    return persist(records.items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function deleteRecord(id) {
    if (!window.confirm('이 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    if (persist(records.items.filter((item) => item.id !== id))) {
      setPage('library');
      setNotice('기록을 삭제했습니다.');
    }
  }

  function selectedAddonText() {
    return addon === 'blackbox' ? buildBlackboxReport(selected) : buildRecoveryEmail(selected);
  }

  async function copyAddon() {
    try {
      await window.navigator.clipboard.writeText(selectedAddonText());
      setNotice('초안을 복사했습니다. 실제 상황에 맞게 다시 확인한 뒤 사용하세요.');
    } catch {
      setNotice('자동 복사에 실패했습니다. 아래 내용을 직접 선택해 복사해 주세요.');
    }
  }

  function downloadAddon() {
    const file = new Blob([selectedAddonText()], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = (addon === 'blackbox' ? '블랙박스_보고서_' : '수습_보고_메일_') + selected.id.slice(0, 8) + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }

  function markUsed(item) {
    if (updateRecord(item.id, { usedAt: new Date().toISOString() })) setNotice('이번 업무에 적용했다고 기록했습니다.');
  }

  function saveOutcome() {
    if (selected && updateRecord(selected.id, { outcome: outcomeText.trim(), usedAt: selected.usedAt || new Date().toISOString() })) {
      setNotice('적용 결과를 저장했습니다.');
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="container header-inner">
          <button className="brand" type="button" onClick={() => setPage('home')}>다음장<span className="brand-mark" aria-hidden="true">.</span></button>
          <nav className="site-nav" aria-label="주요 메뉴">
            <button type="button" className={page === 'home' ? 'nav-link is-current' : 'nav-link'} onClick={() => setPage('home')}>처음</button>
            <button type="button" className={page === 'task' ? 'nav-link is-current' : 'nav-link'} onClick={() => setPage('task')}>업무 시작</button>
            <button type="button" className={page === 'library' ? 'nav-link is-current' : 'nav-link'} onClick={() => setPage('library')}>내 기록 <span className="saved-count">{records.items.length}</span></button>
          </nav>
        </div>
      </header>

      <main id="main" className="app-shell">
        {records.error && <div className="container"><p className="alert" role="alert">{records.error}</p></div>}
        {notice && <div className="container"><p className="notice" role="status">{notice}</p></div>}

        {page === 'home' && (
          <>
            <section className="hero container" aria-labelledby="hero-title">
              <div className="hero-copy">
                <p className="hero-kicker">처음 일하는 당신을 위한 작은 복기</p>
                <h1 id="hero-title">실수에서 끝나지 않게.<br />다음 업무에 남기세요.</h1>
                <p>질문에 하나씩 답하며 실수나 지적받은 경험을 구체화하고, 다음에 다시 확인할 행동 한 가지를 만듭니다.</p>
              </div>
              <div className="hero-panel" aria-label="이용 흐름">
                <span>경험을 정리하고</span><span>할 일을 하나 정해</span><strong>비슷한 업무에서 다시 보기</strong>
              </div>
            </section>
            <section className="container workflow" aria-labelledby="start-title">
              <div className="section-heading"><div><p className="eyebrow">START HERE</p><h2 id="start-title">지금 어떤 상황인가요?</h2></div><p>한 가지를 골라 시작해 보세요.</p></div>
              <div className="choice-grid">
                <button className="choice-card" type="button" onClick={() => start('mistake')}><span className="badge">입구 A</span><strong>실수를 알아챘어요</strong><span>질문을 따라 상황과 영향을 구체화해요.</span><em>대화로 정리 시작하기 →</em></button>
                <button className="choice-card" type="button" onClick={() => start('feedback')}><span className="badge">입구 B</span><strong>지적을 받았어요</strong><span>질문을 따라 감정과 할 일을 나눠 봐요.</span><em>대화로 정리 시작하기 →</em></button>
              </div>
              <p className="field-help">시연용 도구입니다. 회사명, 실명, 고객 정보, 문서 원문 등 민감한 내용은 입력하지 마세요.</p>
            </section>
          </>
        )}

        {page === 'chat' && (
          <section className="container workflow" aria-label="질문으로 경험 정리">
            <GuidedChat mode={entryMode} onComplete={finishChat} onCancel={() => setPage('home')} />
          </section>
        )}

        {page === 'form' && (
          <section className="container workflow" aria-labelledby="form-title">
            <div className="section-heading"><div><p className="eyebrow">{entryMode === 'mistake' ? '입구 A · 실수 정리' : '입구 B · 피드백 정리'}</p><h1 id="form-title">대화에서 정리한 내용을 확인해요.</h1><p>질문에 답한 내용이 알맞은 칸에 들어갔는지 검토하고, 필요한 부분을 고쳐 주세요.</p></div><button className="button-secondary" type="button" onClick={() => setPage('home')}>처음으로</button></div>
            <div className="progress-steps" aria-label="진행 단계"><span className="is-done">1 질문으로 정리</span><span className="is-current">2 내용 확인</span><span>3 업무에서 다시 보기</span></div>
            <form onSubmit={saveDraft} noValidate>
              <div className="panel">
                <details className="report-fields">
                  <summary>처음 적은 상황과 AI 정리 초안 다시 보기 (선택)</summary>
                  <div className="stack">
                    <Field name="rawText" label="처음 적은 상황" value={draft.rawText} onChange={updateDraft} help="AI 초안을 사용할 때만 전송됩니다. 저장할 때는 이 원문을 보관하지 않습니다." placeholder={entryMode === 'mistake' ? '예: 공유한 자료에서 잘못된 숫자를 발견했어요.' : '예: 팀장님이 다음에는 더 꼼꼼히 확인해 달라고 말했어요.'} />
                    <div className="assistant-box">
                      <div><strong>AI로 정리 초안 받기 <span className="badge">선택</span></strong><p>초안은 틀릴 수 있습니다. 확인한 사실과 상대의 의도를 AI가 판정하지 않습니다.</p></div>
                      {aiAvailable === false ? <p>현재 AI 키가 설정되지 않았습니다. 직접 입력한 답으로 모든 기본 기능을 사용할 수 있습니다.</p> : <>
                        <label className="consent-label"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />입력한 상황을 AI 서비스로 전송하는 데 동의합니다.</label>
                        <button className="button-secondary" type="button" onClick={askAi} disabled={aiLoading || aiAvailable !== true}>{aiLoading ? '초안 만드는 중…' : 'AI 초안 받기'}</button>
                      </>}
                    </div>
                    {aiError && <p className="alert" role="alert">{aiError}</p>}
                  </div>
                </details>
              </div>

              <div className="panel">
                <div className="section-heading"><div><p className="eyebrow">두 트랙을 오갈 수 있어요</p><h2>어느 쪽부터 정리할까요?</h2></div></div>
                <div className="track-grid" role="group" aria-label="정리할 트랙">
                  <button type="button" className={track === 'feelings' ? 'track-card is-active' : 'track-card'} aria-pressed={track === 'feelings'} onClick={() => setTrack('feelings')}><strong>감정 트랙</strong><span>직접 확인한 일과 내 해석·감정</span></button>
                  <button type="button" className={track === 'tasks' ? 'track-card is-active' : 'track-card'} aria-pressed={track === 'tasks'} onClick={() => setTrack('tasks')}><strong>할 일 트랙</strong><span>개선 포인트와 후속 보고·부가 기능</span></button>
                </div>
                <p className="field-help">먼저 정리할 순서만 고르는 버튼입니다. 언제든 다른 트랙으로 이동할 수 있어요.</p>
              </div>

              {track === 'feelings' && (
                <div className="panel stack">
                  <div><p className="eyebrow">감정 트랙 · 사실과 해석</p><h2>무엇을 직접 확인했나요?</h2></div>
                  <Field name="facts" label="직접 본 일·들은 말" value={draft.facts} onChange={updateDraft} required help="상대의 의도나 원인을 단정하지 말고, 내가 확인한 말·행동·수치만 적어 주세요." placeholder={entryMode === 'mistake' ? '예: 전송한 표의 합계가 원본과 달랐습니다.' : '예: “다음에는 더 꼼꼼히 확인해 주세요”라는 말을 들었습니다.'} />
                  <div className="form-grid">
                    <Field name="interpretation" label="내가 받아들인 뜻" value={draft.interpretation} onChange={updateDraft} help="추측이거나 해석일 수 있어요. 사실과 분리해서 적습니다." placeholder="예: 나를 믿지 않는다는 뜻 같았습니다." />
                    <Field name="feeling" label="그때 느낀 감정 (선택)" value={draft.feeling} onChange={updateDraft} help="감정은 틀린 답이 아닙니다. 상대 의도의 증거로만 사용하지 않아요." placeholder="예: 당황하고 위축됐습니다." />
                  </div>
                  <button className="button-secondary" type="button" onClick={() => setTrack('tasks')}>할 일도 정리하기 →</button>
                </div>
              )}

              {track === 'tasks' && (
                <div className="panel stack">
                  <div><p className="eyebrow">할 일 트랙 · 개선과 후속 보고</p><h2>이제 무엇을 확인하고 할까요?</h2></div>
                  <Field name="unknown" label="아직 확인할 일" value={draft.unknown} onChange={updateDraft} help="모르는 부분은 추측으로 채우지 않습니다." placeholder={entryMode === 'mistake' ? '예: 이전 자료를 누가 사용했는지 확인해야 합니다.' : '예: 어떤 항목을 우선 확인해야 하는지 모릅니다.'} />
                  <Field name="improvement" label={entryMode === 'mistake' ? '현재 조치·개선 포인트' : '개선 포인트'} value={draft.improvement} onChange={updateDraft} help="확인된 내용만 적고, 아직 모르는 부분은 질문으로 남겨 주세요." placeholder={entryMode === 'mistake' ? '예: 오류가 있는 수치를 수정하고 기존 자료 사용 여부를 확인하기' : '예: 다음 자료에서 특히 확인해야 할 항목을 물어보기'} />
                  <Field name="followUp" label={entryMode === 'mistake' ? '수습·보고할 내용' : '후속 보고·질문'} value={draft.followUp} onChange={updateDraft} placeholder={entryMode === 'mistake' ? '예: 잘못된 수치를 수정하고 담당자에게 영향 범위를 확인하겠습니다.' : '예: 다음 자료에서 우선 확인해야 할 부분을 예시로 알려주실 수 있나요?'} />
                  <details className="report-fields">
                    <summary>부가 기능에 넣을 원인·영향 정리 (선택)</summary>
                    <div className="stack">
                      <div className="field"><label className="field-label" htmlFor="cause-status">원인을 어느 정도 확인했나요?</label><select id="cause-status" value={draft.causeStatus} onChange={(event) => updateDraft('causeStatus', event.target.value)}><option value="unknown">아직 모름</option><option value="hypothesis">추정 중</option><option value="confirmed">직접 확인함</option></select></div>
                      {draft.causeStatus !== 'unknown' && <Field name="cause" label={draft.causeStatus === 'confirmed' ? '확인한 원인' : '추정한 원인'} value={draft.cause} onChange={updateDraft} help="추정은 보고서에서도 추정으로 표시됩니다. 상대의 의도를 단정하지 마세요." placeholder="예: 원본 수치를 대조하지 않았습니다." />}
                      <Field name="impact" label="확인된 영향" value={draft.impact} onChange={updateDraft} help="아직 모르면 비워 두세요. 보고서에 ‘확인 중’으로 표시됩니다." placeholder="예: 자료를 받은 사람이 2명입니다. 실제 사용 여부는 확인 중입니다." />
                    </div>
                  </details>
                  <details className="report-fields">
                    <summary>부가 기능 · 블랙박스 보고서 / 상사용 수습·후속 메일 미리보기</summary>
                    <div className="stack">
                      <div className="addon-grid" role="group" aria-label="미리 볼 부가 기능">
                        <button type="button" className={addon === 'blackbox' ? 'addon-card is-active' : 'addon-card'} aria-pressed={addon === 'blackbox'} onClick={() => setAddon('blackbox')}><strong>블랙박스 보고서</strong><span>무슨 일 · 왜 · 영향 · 조치 · 재발 방지</span></button>
                        <button type="button" className={addon === 'email' ? 'addon-card is-active' : 'addon-card'} aria-pressed={addon === 'email'} onClick={() => setAddon('email')}><strong>상사용 수습·후속 메일</strong><span>확인한 사실로 만든 초안</span></button>
                      </div>
                      <pre className="report-preview">{addon === 'blackbox' ? buildBlackboxReport({ ...draft, mode: entryMode }) : buildRecoveryEmail({ ...draft, mode: entryMode })}</pre>
                      <p className="field-help">초안은 입력에 따라 바뀝니다. 저장 후 복사·다운로드할 수 있으며 자동 발송되지 않습니다.</p>
                    </div>
                  </details>
                  <button className="button-secondary" type="button" onClick={() => setTrack('feelings')}>감정 트랙도 보기 →</button>
                </div>
              )}

              <div className="panel stack">
                <div><p className="eyebrow">다음 업무에서 다시 보기</p><h2>체크리스트 한 항목만 남겨요.</h2></div>
                <Field name="checklist" label="다음에 확인할 행동" value={draft.checklist} onChange={updateDraft} required help="‘더 잘하기’보다 실제 업무 중 체크할 수 있는 문장으로 적어 주세요." placeholder="예: 자료를 공유하기 전 합계와 원본 수치를 대조하기" />
                <div className="field"><label className="field-label" htmlFor="task-type">어떤 업무에서 다시 볼까요?</label><select id="task-type" value={draft.taskType} onChange={(event) => updateDraft('taskType', event.target.value)}>{TASK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <p className="field-help">기록은 이 기기의 브라우저에만 저장됩니다. 공유 기기에서는 기록을 남기지 마세요.</p>
                {formError && <p className="alert" role="alert">{formError}</p>}
                <div className="form-actions"><button className="button-primary" type="submit">정리하고 저장하기</button><button className="button-secondary" type="button" onClick={() => setPage('home')}>취소</button></div>
              </div>
            </form>
          </section>
        )}

        {page === 'review' && selected && (
          <section className="container workflow" aria-labelledby="review-title">
            <div className="section-heading"><div><p className="eyebrow">내 경험 정리</p><h1 id="review-title">{selected.mode === 'mistake' ? '실수에서 다음 행동으로' : '지적받은 뒤 다음 행동으로'}</h1></div><button className="button-secondary" type="button" onClick={() => setPage('library')}>내 기록 보기</button></div>
            <div className="review-grid">
              <div className="review-card"><span className="badge">직접 확인한 일</span><p>{selected.facts}</p></div>
              <div className="review-card"><span className="badge">내 해석 · 감정</span><p>{selected.interpretation || '해석을 적지 않았어요.'}</p>{selected.feeling && <small>그때의 감정: {selected.feeling}</small>}</div>
              <div className="review-card"><span className="badge">아직 확인할 일</span><p>{selected.unknown || '기록한 내용이 없습니다.'}</p></div>
              <div className="review-card"><span className="badge">개선 포인트 · 후속 보고</span><p>{selected.improvement || '개선 포인트를 적지 않았어요.'}</p>{selected.followUp && <small>후속 보고·질문: {selected.followUp}</small>}</div>
            </div>
            <section className="panel addon-panel" aria-labelledby="addon-title">
              <div><p className="eyebrow">선택 부가 기능</p><h2 id="addon-title">정리한 내용을 문서로 가져가세요.</h2><p className="field-help">사용자가 입력한 내용으로 만든 초안입니다. 원인·영향이 확인되지 않았다면 ‘확인 중’으로 남습니다. 실제 발송은 하지 않습니다.</p></div>
              <div className="addon-grid" role="group" aria-label="부가 기능 선택">
                <button type="button" className={addon === 'blackbox' ? 'addon-card is-active' : 'addon-card'} aria-pressed={addon === 'blackbox'} onClick={() => setAddon('blackbox')}><strong>블랙박스 보고서</strong><span>무슨 일 · 왜 · 영향 · 조치 · 재발 방지</span></button>
                <button type="button" className={addon === 'email' ? 'addon-card is-active' : 'addon-card'} aria-pressed={addon === 'email'} onClick={() => setAddon('email')}><strong>상사용 수습·후속 메일</strong><span>확인한 사실 중심으로 보내기 전 초안 정리</span></button>
              </div>
              <pre className="report-preview">{selectedAddonText()}</pre>
              <div className="report-actions"><button className="button-secondary" type="button" onClick={copyAddon}>초안 복사하기</button><button className="button-secondary" type="button" onClick={downloadAddon}>텍스트 파일 받기</button></div>
            </section>
            <div className="checklist-card"><span className="badge">{selected.taskType}에서 다시 보기</span><h2>다음 업무의 체크리스트</h2><p>{selected.checklist}</p><div className="action-bar"><button className="button-primary" type="button" onClick={() => { setTaskFilter(selected.taskType); setPage('task'); }}>비슷한 업무 시작하기</button><button className="button-secondary" type="button" onClick={() => deleteRecord(selected.id)}>기록 삭제</button></div></div>
            {selected.usedAt && <div className="panel stack"><h2>적용 결과</h2><p>이번 업무에서 체크리스트를 사용했어요. 무엇이 달라졌나요?</p><textarea aria-label="적용 결과" value={outcomeText} onChange={(event) => setOutcomeText(event.target.value)} rows="3" maxLength="1200" placeholder="예: 공유하기 전에 합계 오류를 발견했습니다." /><button className="button-secondary" type="button" onClick={saveOutcome}>결과 저장하기</button></div>}
          </section>
        )}

        {page === 'library' && (
          <section className="container workflow" aria-labelledby="library-title">
            <div className="section-heading"><div><p className="eyebrow">MY RECORDS</p><h1 id="library-title">내 기록</h1><p>경험에서 만든 다음 행동을 다시 확인해 보세요.</p></div><button className="button-primary" type="button" onClick={() => setPage('home')}>새 경험 정리하기</button></div>
            {records.items.length ? <div className="record-list">{records.items.map((item) => <article className="record-card" key={item.id}><div><span className="badge">{item.mode === 'mistake' ? '실수' : '지적'} · {item.taskType}</span><h2>{item.checklist}</h2><p>{item.facts}</p><small>{new Date(item.createdAt).toLocaleDateString('ko-KR')}{item.usedAt ? ' · 다음 업무에 적용함' : ' · 적용 전'}</small></div><button className="button-secondary" type="button" onClick={() => openRecord(item)}>자세히 보기</button></article>)}</div> : <div className="empty-state"><h2>아직 정리한 경험이 없습니다.</h2><p>처음 겪은 실수나 지적에서 다음에 확인할 행동 하나를 만들어 보세요.</p><button className="button-primary" type="button" onClick={() => setPage('home')}>시작하기</button></div>}
          </section>
        )}

        {page === 'task' && (
          <section className="container workflow" aria-labelledby="task-title">
            <div className="section-heading"><div><p className="eyebrow">BEFORE YOU START</p><h1 id="task-title">비슷한 업무를 시작하나요?</h1><p>지난 경험에서 만든 체크리스트를 꺼내 보세요.</p></div></div>
            <div className="panel"><div className="field"><label className="field-label" htmlFor="task-filter">업무 종류 선택</label><select id="task-filter" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}><option value="전체">전체</option>{TASK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
            {taskRecords.length ? <div className="checklist-list">{taskRecords.map((item) => <article className="checklist-card" key={item.id}><span className="badge">{item.taskType}</span><h2>{item.checklist}</h2><p className="field-help">이 항목을 만든 경험: {item.facts}</p><div className="action-bar"><button className="button-primary" type="button" onClick={() => markUsed(item)}>{item.usedAt ? '이번에도 적용하기' : '이번 업무에 적용했어요'}</button><button className="button-secondary" type="button" onClick={() => openRecord(item)}>경험 다시 보기</button></div>{item.usedAt && <p className="status-line">적용 기록이 있습니다. 경험을 다시 열어 결과를 남길 수 있어요.</p>}</article>)}</div> : <div className="empty-state"><h2>이 업무에 저장한 체크리스트가 없습니다.</h2><p>새로운 경험을 정리하면 이곳에서 다시 볼 수 있어요.</p><button className="button-primary" type="button" onClick={() => setPage('home')}>경험 정리하기</button></div>}
          </section>
        )}
      </main>
      <footer className="site-footer"><div className="container footer-inner"><strong>다음장.</strong><p>사회초년생의 경험을 다음 행동으로 잇는 시연용 서비스 · 기록은 이 브라우저에만 저장됩니다.</p></div></footer>
    </>
  );
}

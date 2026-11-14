import { useEffect, useRef, useState } from 'react';
import { SERVER_CATEGORIES, SERVER_STATUSES, team5Api } from '../team5Api.js';
import './ServerWorkspace.css';

function Category({ value, onChange, id }) {
  return <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{SERVER_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>;
}

function Rules({ items }) {
  return items.length ? <ul className="server-list">{items.map((item) => <li key={item.id ?? item.preventionRuleId}><strong>{item.content}</strong><span>확인할 때: {item.triggerPoint} · 기록 #{item.experienceId}</span></li>)}</ul> : <p className="server-empty">저장된 재발 방지 규칙이 없습니다.</p>;
}

export default function ServerWorkspace({ seed }) {
  const [recent, setRecent] = useState(null);
  const [recentError, setRecentError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [content, setContent] = useState(seed?.facts || '');
  const [type, setType] = useState(seed?.mode || 'mistake');
  const [category, setCategory] = useState(SERVER_CATEGORIES.includes(seed?.taskType) ? seed.taskType : SERVER_CATEGORIES[0]);
  const [selected, setSelected] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [items, setItems] = useState(null);
  const [rules, setRules] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [checkText, setCheckText] = useState(seed?.checklist || '');
  const [ruleText, setRuleText] = useState(seed?.checklist || '');
  const [trigger, setTrigger] = useState('');
  const [ruleCategory, setRuleCategory] = useState(category);
  const [searchCategory, setSearchCategory] = useState(category);
  const [categoryRules, setCategoryRules] = useState(null);
  const [task, setTask] = useState('');
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    team5Api.recent(controller.signal).then(setRecent).catch((failure) => {
      if (!controller.signal.aborted) setRecentError(failure.message);
    });
    return () => controller.abort();
  }, []);

  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (failure) { setError(failure.message); }
    finally { lock.current = false; setBusy(false); }
  }

  async function refreshRecent() {
    setRecentError('');
    try { setRecent(await team5Api.recent()); }
    catch (failure) { setRecentError(failure.message); }
  }

  async function selectExperience(experience) {
    setSelected(experience); setLookupId(String(experience.id));
    setItems(null); setRules(null); setDetailError('');
    const responses = await Promise.allSettled([team5Api.checklist(experience.id), team5Api.preventions(experience.id)]);
    if (responses[0].status === 'fulfilled') setItems(responses[0].value);
    if (responses[1].status === 'fulfilled') setRules(responses[1].value);
    setDetailError(responses.filter((result) => result.status === 'rejected').map((result) => result.reason.message).join(' '));
  }

  function submit(event, action) { event.preventDefault(); void run(action); }

  return <section className="container workflow server-workspace" aria-labelledby="server-title" aria-busy={busy}>
    <div className="section-heading"><div><p className="eyebrow">TEAM5 · 연결된 기록</p><h1 id="server-title">경험을 모으고, 다음 업무를 준비해요.</h1><p>서버에 저장한 경험과 체크리스트, 재발 방지 규칙을 함께 확인하세요.</p></div></div>
    <p className="server-disclosure">현재 서버에는 계정별 구분이 없어 연결한 사람 모두가 같은 기록을 봅니다. 개인정보 없이 작성해 주세요. ‘내 기록’은 이 브라우저에 따로 보관됩니다.</p>
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p className="server-notice" role="status">{notice}</p>}
    {busy && <p role="status">서버 요청을 처리하고 있어요…</p>}

    <div className="server-grid">
      <form className="panel server-card" onSubmit={(event) => submit(event, async () => {
        const result = await team5Api.createExperience({ type, content: content.trim(), category });
        if (!result.id) throw new Error('저장 응답에 기록 번호가 없습니다. 최근 목록을 확인해 주세요.');
        setContent(''); setNotice(`경험 #${result.id}을 서버에 저장했어요.`);
        setRuleCategory(category);
        await selectExperience({ id: result.id, title: result.content, createdAt: result.createdAt });
        await refreshRecent();
      })}>
        <h2>경험 저장</h2><p>입력한 경험 본문·유형·분류를 서버에 저장합니다.</p>
        <fieldset disabled={busy}>
          <label htmlFor="server-type">경험 유형</label><select id="server-type" value={type} onChange={(event) => setType(event.target.value)}><option value="mistake">실수</option><option value="feedback">받은 피드백</option></select>
          <label htmlFor="server-category">업무 분류</label><Category id="server-category" value={category} onChange={setCategory} />
          <label htmlFor="server-content">확인한 경험</label><textarea id="server-content" required maxLength={3000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} />
          <button className="button-primary" disabled={!content.trim()} type="submit">경험 서버에 저장</button>
        </fieldset>
      </form>

      <div className="panel server-card"><div className="server-card-heading"><h2>최근 서버 기록</h2><button className="text-button" type="button" disabled={busy} onClick={() => run(refreshRecent)}>새로고침</button></div>
        <p>서버가 제공하는 최신 3건입니다. 선택하면 연결된 항목을 확인할 수 있어요.</p>
        {recentError && <p className="alert" role="alert">{recentError}</p>}
        {recent === null && !recentError && <p role="status">기록을 불러오고 있어요…</p>}
        {recent?.length === 0 && <p className="server-empty">아직 서버에 저장된 경험이 없습니다.</p>}
        {recent && <ul className="server-list">{recent.map((record) => <li key={record.id}><button className="server-record" type="button" aria-pressed={selected?.id === record.id} disabled={busy} onClick={() => run(() => selectExperience(record))}><strong>#{record.id} {record.title}</strong><span>{record.status || '기록 저장됨'} · {(record.createdAt || '').replace('T', ' ').slice(0, 16)}</span></button></li>)}</ul>}
        <form onSubmit={(event) => submit(event, () => selectExperience({ id: lookupId, title: '번호로 선택한 기록' }))}><fieldset disabled={busy}><label htmlFor="server-record-id">이전 기록 번호로 연결 항목 조회</label><div className="server-inline"><input id="server-record-id" required inputMode="numeric" pattern="[1-9][0-9]*" value={lookupId} onChange={(event) => setLookupId(event.target.value)} /><button className="button-secondary" type="submit">조회</button></div></fieldset></form>
        <p className="field-help">경험 상세 조회 API가 없어 원문은 다시 불러올 수 없습니다. 없는 번호도 빈 목록으로 응답할 수 있습니다.</p>
      </div>
    </div>

    {selected && <section className="panel server-card" aria-labelledby="server-detail-title"><div className="server-card-heading"><h2 id="server-detail-title">기록 #{selected.id}의 다음 행동</h2><button className="text-button" disabled={busy} type="button" onClick={() => run(() => selectExperience(selected))}>항목 새로고침</button></div><p>{selected.title}</p>
      {detailError && <p className="alert" role="alert">{detailError}</p>}
      <div className="server-grid">
        <div><h3>체크리스트</h3>{items?.length === 0 && <p className="server-empty">등록된 체크리스트가 없습니다.</p>}
          {items && <ul className="server-list">{items.map((item) => <li key={item.id}><label htmlFor={'server-status-' + item.id}>{item.content}</label><select id={'server-status-' + item.id} value={item.status} disabled={busy} onChange={(event) => { const status = event.target.value; run(async () => { const updated = await team5Api.setStatus(item.id, status); setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry)); setNotice('체크리스트 상태를 저장했어요.'); }); }}>{Object.entries(SERVER_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></li>)}</ul>}
          <form onSubmit={(event) => submit(event, async () => {
            const item = await team5Api.addChecklist(selected.id, { content: checkText.trim(), sortOrder: Math.max(-1, ...(items || []).map((entry) => entry.sortOrder)) + 1 });
            setItems((current) => [...(current || []), item]); setCheckText(''); setNotice('체크리스트를 서버에 추가했어요.');
          })}><fieldset disabled={busy || items === null}><label htmlFor="server-check-text">새 확인 항목</label><input id="server-check-text" required maxLength={1000} value={checkText} onChange={(event) => setCheckText(event.target.value)} /><button className="button-secondary" disabled={!checkText.trim()} type="submit">체크리스트 추가</button></fieldset></form>
        </div>
        <div><h3>재발 방지 규칙</h3>{rules && <Rules items={rules} />}
          <form onSubmit={(event) => submit(event, async () => {
            const rule = await team5Api.addPrevention(selected.id, { category: ruleCategory, content: ruleText.trim(), triggerPoint: trigger.trim() });
            setRules((current) => [...(current || []), rule]); setRuleText(''); setTrigger(''); setCategoryRules(null); setRecommendations(null); setNotice('재발 방지 규칙을 서버에 저장했어요.');
          })}><fieldset disabled={busy || rules === null}><label htmlFor="server-rule-category">규칙의 업무 분류</label><Category id="server-rule-category" value={ruleCategory} onChange={setRuleCategory} />
            <label htmlFor="server-rule-text">다음에 할 행동</label><textarea id="server-rule-text" required maxLength={1000} rows={2} value={ruleText} onChange={(event) => setRuleText(event.target.value)} />
            <label htmlFor="server-trigger">언제 확인하나요?</label><input id="server-trigger" required maxLength={255} placeholder="예: 메일 보내기 직전" value={trigger} onChange={(event) => setTrigger(event.target.value)} /><button className="button-secondary" disabled={!ruleText.trim() || !trigger.trim()} type="submit">규칙 저장</button>
          </fieldset></form>
        </div>
      </div>
    </section>}

    <section className="panel server-card" aria-labelledby="server-prepare-title"><h2 id="server-prepare-title">다음 업무 전에 확인하기</h2><p>같은 분류에 저장된 규칙을 조회하거나, 최근 규칙을 최대 3개 추천받을 수 있어요.</p>
      <form onSubmit={(event) => submit(event, async () => { setRecommendations(null); const result = await team5Api.recommend({ task: task.trim(), category: searchCategory }); if (!Array.isArray(result.recommendations)) throw new Error('추천 응답 형식이 올바르지 않습니다.'); setRecommendations(result); })}>
        <fieldset disabled={busy}><label htmlFor="server-search-category">준비할 업무 분류</label><Category id="server-search-category" value={searchCategory} onChange={(value) => { setSearchCategory(value); setCategoryRules(null); setRecommendations(null); }} />
          <button className="button-secondary" type="button" onClick={() => run(async () => { setCategoryRules(null); setCategoryRules(await team5Api.byCategory(searchCategory)); })}>이 분류의 규칙 모두 보기</button>
          <label htmlFor="server-next-task">지금 준비하는 업무</label><input id="server-next-task" required maxLength={1000} placeholder="예: 거래처 견적서 메일 발송" value={task} onChange={(event) => { setTask(event.target.value); setRecommendations(null); }} /><button className="button-primary" disabled={!task.trim()} type="submit">업무 전 추천 받기</button>
        </fieldset>
      </form>
      {categoryRules && <div><h3>{searchCategory}의 전체 규칙</h3><Rules items={categoryRules} /></div>}
      {recommendations && <div role="status"><h3>추천 규칙</h3><p>{recommendations.reason}</p><Rules items={recommendations.recommendations} /></div>}
      <p className="field-help">현재 추천은 AI 분석이 아니라 선택한 업무 분류의 최신 규칙 조회 방식입니다.</p>
    </section>
    <details className="server-limitations"><summary>현재 서버에서 지원하지 않는 기능</summary><p>경험 전체 목록·상세 조회·수정·삭제, 체크리스트 내용 수정·삭제·순서 변경, 규칙 수정·삭제, 로그인·개인별 기록, AI 분석은 제공되지 않습니다. 감정 정리·보고서·이메일 초안은 기존 화면에서 이용할 수 있으며 이 서버에는 저장되지 않습니다. 기본 백엔드 설정은 재시작하면 데이터가 초기화됩니다.</p></details>
  </section>;
}

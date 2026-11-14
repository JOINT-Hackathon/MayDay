import { useEffect, useRef, useState } from 'react';
import { SERVER_CATEGORIES, SERVER_STATUSES, team5Api } from '../team5Api.js';
import { buildBlackboxReport, buildRecoveryEmail } from '../reportDrafts.js';
import './ServerWorkspace.css';

const DETAIL_FIELDS = {
  interpretation: '내 해석', feeling: '감정', cause: '원인', impact: '영향', unknown: '확인할 일',
  improvement: '개선 행동', followUp: '후속 보고·질문', checklist: '다음 확인 행동', outcome: '업무 적용 결과',
};
function initialDetails(value = {}) {
  return {
    ...Object.fromEntries(Object.keys(DETAIL_FIELDS).map((key) => [key, typeof value[key] === 'string' ? value[key] : ''])),
    causeStatus: ['unknown', 'hypothesis', 'confirmed'].includes(value.causeStatus) ? value.causeStatus : 'unknown',
    actionChecked: Array.isArray(value.actionChecked) ? value.actionChecked.filter((key) => ['checklist', 'unknown', 'improvement', 'followUp'].includes(key)) : [],
    usedAt: typeof value.usedAt === 'string' ? value.usedAt : '',
    addonDrafts: Object.fromEntries(['blackbox', 'emailFormal', 'emailCasual'].map((key) => [key, typeof value.addonDrafts?.[key] === 'string' ? value.addonDrafts[key] : ''])),
  };
}
function Category({ value, onChange, id }) {
  return <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{[...new Set([...SERVER_CATEGORIES, value])].filter(Boolean).map((category) => <option key={category}>{category}</option>)}</select>;
}
function Rules({ items }) {
  return items.length ? <ul className="server-list">{items.map((item) => <li key={item.id ?? item.preventionRuleId}><strong>{item.content}</strong><span>확인할 때: {item.triggerPoint} · 기록 #{item.experienceId}</span></li>)}</ul> : <p className="server-empty">저장된 규칙이 없습니다.</p>;
}
function DeleteButton({ label, busy, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? <div className="server-inline"><span>연결된 데이터도 삭제됩니다.</span><button type="button" disabled={busy} onClick={onDelete}>삭제 확인</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>취소</button></div> : <button className="text-button danger" type="button" disabled={busy} onClick={() => setConfirm(true)}>{label}</button>;
}
function ChecklistEditor({ item, busy, run, refresh, move, first, last }) {
  const [text, setText] = useState(item.content);
  return <li>
    <form onSubmit={(event) => { event.preventDefault(); run(async () => { await team5Api.updateChecklist(item.id, { content: text.trim(), sortOrder: item.sortOrder }); await refresh(); }); }}>
      <fieldset disabled={busy}><label htmlFor={'check-edit-' + item.id}>확인 항목</label><input id={'check-edit-' + item.id} required maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} /><button type="submit" disabled={!text.trim()}>내용 저장</button></fieldset>
    </form>
    <label htmlFor={'check-status-' + item.id}>진행 상태</label><select id={'check-status-' + item.id} value={item.status} disabled={busy} onChange={(event) => { const status = event.target.value; run(async () => { await team5Api.setStatus(item.id, status); await refresh(); }); }}>{Object.entries(SERVER_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <div className="server-inline"><button type="button" aria-label={item.content + ' 위로 이동'} disabled={busy || first} onClick={() => move(-1)}>↑</button><button type="button" aria-label={item.content + ' 아래로 이동'} disabled={busy || last} onClick={() => move(1)}>↓</button><DeleteButton label="항목 삭제" busy={busy} onDelete={() => run(async () => { await team5Api.deleteChecklist(item.id); await refresh(); })} /></div>
  </li>;
}
function RuleEditor({ item, busy, run, refresh }) {
  const [content, setContent] = useState(item.content);
  const [triggerPoint, setTrigger] = useState(item.triggerPoint);
  const [category, setCategory] = useState(item.category);
  return <li><form onSubmit={(event) => { event.preventDefault(); run(async () => { await team5Api.updatePrevention(item.id, { content: content.trim(), triggerPoint: triggerPoint.trim(), category }); await refresh(); }); }}><fieldset disabled={busy}>
    <label htmlFor={'rule-category-' + item.id}>분류</label><Category id={'rule-category-' + item.id} value={category} onChange={setCategory} />
    <label htmlFor={'rule-edit-' + item.id}>예방 행동</label><input id={'rule-edit-' + item.id} required maxLength={1000} value={content} onChange={(event) => setContent(event.target.value)} />
    <label htmlFor={'rule-trigger-' + item.id}>확인 시점</label><input id={'rule-trigger-' + item.id} required maxLength={255} value={triggerPoint} onChange={(event) => setTrigger(event.target.value)} />
    <button type="submit" disabled={!content.trim() || !triggerPoint.trim()}>규칙 수정 저장</button>
  </fieldset></form><DeleteButton label="규칙 삭제" busy={busy} onDelete={() => run(async () => { await team5Api.deletePrevention(item.id); await refresh(); })} /></li>;
}

export default function ServerWorkspace({ seed }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [records, setRecords] = useState(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState(seed?.facts || '');
  const [type, setType] = useState(seed?.mode || 'mistake');
  const [category, setCategory] = useState(seed?.taskType || SERVER_CATEGORIES[0]);
  const [details, setDetails] = useState(() => initialDetails(seed));
  const [items, setItems] = useState(null);
  const [rules, setRules] = useState(null);
  const [checkText, setCheckText] = useState(seed?.checklist || '');
  const [ruleText, setRuleText] = useState(seed?.checklist || '');
  const [trigger, setTrigger] = useState('');
  const [searchCategory, setSearchCategory] = useState(SERVER_CATEGORIES[0]);
  const [categoryRules, setCategoryRules] = useState(null);
  const [task, setTask] = useState('');
  const [recommendations, setRecommendations] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    team5Api.me(controller.signal).then(setUser).catch((failure) => {
      if (!controller.signal.aborted && failure.status !== 401) setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setCheckingSession(false); });
    fetch('/api/status', { signal: controller.signal }).then((response) => response.json()).then((value) => setAiAvailable(value.available === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setRecords(null);
    team5Api.all(0).then((value) => { if (active) { setRecords(value); setPage(0); } }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [user]);

  function resetEditor() {
    setSelected(null); setContent(''); setDetails(initialDetails()); setItems(null); setRules(null);
    setCheckText(''); setRuleText(''); setTrigger(''); setAiConsent(false);
  }
  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (failure) { setError(failure.message); if (failure.status === 401 && user) { setUser(null); setRecords(null); resetEditor(); setCategoryRules(null); setRecommendations(null); } }
    finally { lock.current = false; setBusy(false); }
  }
  async function refreshList(nextPage = page) {
    const result = await team5Api.all(nextPage);
    if (nextPage > 0 && result.items.length === 0) return refreshList(nextPage - 1);
    setRecords(result); setPage(nextPage);
  }
  async function refreshChildren(id = selected?.id) {
    setItems(null); setRules(null); setCategoryRules(null); setRecommendations(null);
    const result = await Promise.all([team5Api.checklist(id), team5Api.preventions(id)]);
    setItems(result[0]); setRules(result[1]);
  }
  async function selectExperience(id) {
    const record = await team5Api.experience(id);
    const parsed = record.details ? JSON.parse(record.details) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('저장한 상세 내용 형식을 확인해 주세요.');
    setSelected(record); setContent(record.content); setType(record.type); setCategory(record.category); setDetails(initialDetails(parsed));
    setCheckText(''); setRuleText(''); setTrigger(''); setAiConsent(false);
    await refreshChildren(id);
  }
  function submit(event, action) { event.preventDefault(); void run(action); }
  function updateDetail(key, value) { setDetails((current) => ({ ...current, [key]: value })); }
  function makeDrafts() {
    const record = { ...details, facts: content, mode: type };
    setDetails((current) => ({ ...current, addonDrafts: { blackbox: buildBlackboxReport(record), emailFormal: buildRecoveryEmail(record), emailCasual: buildRecoveryEmail(record, 'casual') } }));
  }
  async function analyze() {
    const response = await fetch('/api/organize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content, mode: type, consent: aiConsent }), signal: AbortSignal.timeout(50000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI 분석에 실패했습니다.');
    if (!data.suggestions || typeof data.suggestions !== 'object') throw new Error('AI 응답을 확인하지 못했습니다.');
    setDetails((current) => ({ ...current, ...Object.fromEntries(Object.keys(DETAIL_FIELDS).filter((key) => typeof data.suggestions[key] === 'string').map((key) => [key, data.suggestions[key]])) }));
    setNotice('AI 초안을 불러왔어요. 사실을 확인한 뒤 저장해 주세요.');
  }

  return <section className="container workflow server-workspace" aria-labelledby="server-title" aria-busy={busy}>
    <div className="section-heading"><div><p className="eyebrow">TEAM5 · 내 서버 기록</p><h1 id="server-title">경험을 모으고, 다음 업무를 준비해요.</h1><p>로그인한 계정에 기록을 저장합니다. 서버를 다시 시작해도 기록이 유지됩니다.</p></div></div>
    {error && <p className="alert" role="alert">{error}</p>}{notice && <p className="server-notice" role="status">{notice}</p>}{busy && <p role="status">요청을 처리하고 있어요…</p>}
    {checkingSession ? <p role="status">로그인 상태를 확인하고 있어요…</p> : !user ? <form className="panel server-card" onSubmit={(event) => submit(event, async () => { const result = await team5Api.login({ username, password }, register); setPassword(''); setUser(result); })}>
      <h2>{register ? '회원가입' : '로그인'}</h2><fieldset disabled={busy}>
        <label htmlFor="server-username">아이디 · 영문, 숫자, 밑줄 3~40자</label><input id="server-username" autoComplete="username" required pattern="[A-Za-z0-9_]{3,40}" maxLength={40} value={username} onChange={(event) => setUsername(event.target.value)} />
        <label htmlFor="server-password">비밀번호 · 10~128자</label><input id="server-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="button-primary" type="submit">{register ? '가입하고 시작하기' : '로그인'}</button><button className="text-button" type="button" onClick={() => { setRegister(!register); setPassword(''); setError(''); }}>{register ? '기존 계정으로 로그인' : '새 계정 만들기'}</button>
      </fieldset></form> : <>
      <div className="server-disclosure server-inline"><span>{user.username}님의 기록 · 브라우저의 ‘내 기록’과는 별도 저장됩니다.</span><button type="button" disabled={busy} onClick={() => run(async () => { await team5Api.logout(); setUser(null); setRecords(null); resetEditor(); setCategoryRules(null); setRecommendations(null); setTask(''); })}>로그아웃</button></div>
      <div className="server-grid">
        <form className="panel server-card" onSubmit={(event) => submit(event, async () => {
          const body = { type, content: content.trim(), category, details: JSON.stringify(details) };
          const result = selected ? await team5Api.updateExperience(selected.id, body) : await team5Api.createExperience(body);
          setSelected(result); setNotice('경험과 상세 내용을 서버에 저장했어요.');
          await refreshChildren(result.id); await refreshList(selected ? page : 0);
        })}>
          <div className="server-card-heading"><h2>{selected ? `기록 #${selected.id} 편집` : '새 경험 저장'}</h2><button type="button" disabled={busy} onClick={resetEditor}>새 기록 작성</button></div>
          <fieldset disabled={busy}>
            <label htmlFor="server-type">경험 유형</label><select id="server-type" value={type} onChange={(event) => setType(event.target.value)}><option value="mistake">실수</option><option value="feedback">받은 피드백</option></select>
            <label htmlFor="server-category">업무 분류</label><Category id="server-category" value={category} onChange={setCategory} />
            <label htmlFor="server-content">확인한 경험</label><textarea id="server-content" required maxLength={3000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} />
            <details><summary>감정·행동·적용 결과 편집</summary>{Object.entries(DETAIL_FIELDS).map(([key, label]) => <div className="field" key={key}><label htmlFor={'detail-' + key}>{label}</label><textarea id={'detail-' + key} rows={2} maxLength={1200} value={details[key]} onChange={(event) => updateDetail(key, event.target.value)} /></div>)}
              <label htmlFor="cause-status">원인 확인 상태</label><select id="cause-status" value={details.causeStatus} onChange={(event) => updateDetail('causeStatus', event.target.value)}><option value="unknown">확인 전</option><option value="hypothesis">추정</option><option value="confirmed">확인됨</option></select>
              {['checklist', 'unknown', 'improvement', 'followUp'].map((key) => <label className="server-checkbox" key={key}><input type="checkbox" checked={details.actionChecked.includes(key)} onChange={(event) => updateDetail('actionChecked', event.target.checked ? [...details.actionChecked, key] : details.actionChecked.filter((value) => value !== key))} />{DETAIL_FIELDS[key]} 완료</label>)}
              <button type="button" onClick={() => updateDetail('usedAt', new Date().toISOString())}>이번 업무에 적용한 시각 기록</button>{details.usedAt && <p>최근 적용: {details.usedAt}</p>}
            </details>
            <details><summary>보고서·메일 초안 편집</summary><button type="button" onClick={makeDrafts}>현재 내용으로 초안 다시 만들기</button>{[['blackbox', '블랙박스 보고서'], ['emailFormal', '공식 보고 메일'], ['emailCasual', '간결한 공유 메일']].map(([key, label]) => <div className="field" key={key}><label htmlFor={'draft-' + key}>{label}</label><textarea id={'draft-' + key} rows={5} maxLength={2500} value={details.addonDrafts[key]} onChange={(event) => setDetails((current) => ({ ...current, addonDrafts: { ...current.addonDrafts, [key]: event.target.value } }))} /></div>)}</details>
            <details><summary>AI 정리 보조</summary><p>AI 초안은 확인 후 저장해 주세요. 개인정보는 제외해 주세요.</p><label className="server-checkbox"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />이 경험을 Claude로 보내는 데 동의합니다.</label><button type="button" disabled={!aiAvailable || !aiConsent || !content.trim()} onClick={() => run(analyze)}>AI 초안 불러오기</button>{!aiAvailable && <p>서버의 Claude 키가 설정되지 않았습니다. 직접 정리와 저장은 가능합니다.</p>}</details>
            <button className="button-primary" type="submit" disabled={!content.trim()}>{selected ? '수정 내용 저장' : '경험 서버에 저장'}</button>
          </fieldset>
          {selected && <DeleteButton key={selected.id} label="경험과 연결된 항목 삭제" busy={busy} onDelete={() => run(async () => { await team5Api.deleteExperience(selected.id); resetEditor(); setCategoryRules(null); setRecommendations(null); await refreshList(); setNotice('경험과 연결된 체크리스트·규칙을 삭제했어요.'); })} />}
        </form>
        <div className="panel server-card"><div className="server-card-heading"><h2>내 서버 기록 전체</h2><button className="text-button" type="button" disabled={busy} onClick={() => run(() => refreshList())}>새로고침</button></div>
          {records === null ? <p>목록을 불러오고 있어요. 실패한 경우 새로고침을 눌러 주세요.</p> : <><p>총 {records.totalElements}개 · {page + 1}페이지</p>{records.items.length === 0 && <p className="server-empty">아직 기록이 없습니다.</p>}<ul className="server-list">{records.items.map((record) => <li key={record.id}><button className="server-record" type="button" aria-pressed={selected?.id === record.id} disabled={busy} onClick={() => run(() => selectExperience(record.id))}><strong>{record.content.slice(0, 60)}</strong><span>#{record.id} · {record.category} · {(record.createdAt || '').replace('T', ' ').slice(0, 16)}</span></button></li>)}</ul><div className="server-inline"><button type="button" disabled={busy || page === 0} onClick={() => run(() => refreshList(page - 1))}>이전</button><button type="button" disabled={busy || page + 1 >= records.totalPages} onClick={() => run(() => refreshList(page + 1))}>다음</button></div></>}
        </div>
      </div>
      {selected && <section className="panel server-card"><div className="server-card-heading"><h2>기록 #{selected.id}의 다음 행동</h2><button type="button" disabled={busy} onClick={() => run(() => refreshChildren())}>항목 새로고침</button></div><div className="server-grid">
        <div><h3>체크리스트</h3>{items?.length === 0 && <p className="server-empty">등록된 항목이 없습니다.</p>}<ul className="server-list">{items?.map((item, index) => <ChecklistEditor key={item.id + ':' + item.content} item={item} busy={busy} run={run} refresh={refreshChildren} first={index === 0} last={index === items.length - 1} move={(direction) => run(async () => { const ids = items.map((value) => value.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; await team5Api.reorderChecklist(selected.id, ids); await refreshChildren(); })} />)}</ul>
          <form onSubmit={(event) => submit(event, async () => { await team5Api.addChecklist(selected.id, { content: checkText.trim(), sortOrder: Math.max(-1, ...items.map((item) => item.sortOrder)) + 1 }); setCheckText(''); await refreshChildren(); })}><fieldset disabled={busy || items === null}><label htmlFor="server-check-text">새 확인 항목</label><input id="server-check-text" required maxLength={1000} value={checkText} onChange={(event) => setCheckText(event.target.value)} /><button className="button-secondary" disabled={!checkText.trim()} type="submit">체크리스트 추가</button></fieldset></form>
        </div>
        <div><h3>재발 방지 규칙</h3>{rules?.length === 0 && <p className="server-empty">등록된 규칙이 없습니다.</p>}<ul className="server-list">{rules?.map((item) => <RuleEditor key={item.id + ':' + item.content + ':' + item.triggerPoint + ':' + item.category} item={item} busy={busy} run={run} refresh={refreshChildren} />)}</ul>
          <form onSubmit={(event) => submit(event, async () => { await team5Api.addPrevention(selected.id, { category, content: ruleText.trim(), triggerPoint: trigger.trim() }); setRuleText(''); setTrigger(''); await refreshChildren(); })}><fieldset disabled={busy || rules === null}><label htmlFor="server-rule-text">새 예방 행동 · {category}</label><input id="server-rule-text" required maxLength={1000} value={ruleText} onChange={(event) => setRuleText(event.target.value)} /><label htmlFor="server-trigger">확인 시점</label><input id="server-trigger" required maxLength={255} placeholder="메일 보내기 직전" value={trigger} onChange={(event) => setTrigger(event.target.value)} /><button className="button-secondary" type="submit" disabled={!ruleText.trim() || !trigger.trim()}>규칙 저장</button></fieldset></form>
        </div>
      </div></section>}
      <section className="panel server-card"><h2>다음 업무 전에 확인하기</h2><form onSubmit={(event) => submit(event, async () => { setRecommendations(null); setRecommendations(await team5Api.recommend({ task: task.trim(), category: searchCategory })); })}><fieldset disabled={busy}>
        <label htmlFor="server-search-category">업무 분류</label><Category id="server-search-category" value={searchCategory} onChange={(value) => { setSearchCategory(value); setCategoryRules(null); setRecommendations(null); }} /><button className="button-secondary" type="button" onClick={() => run(async () => { setCategoryRules(null); setCategoryRules(await team5Api.byCategory(searchCategory)); })}>이 분류의 내 규칙 모두 보기</button>
        <label htmlFor="server-next-task">준비하는 업무</label><input id="server-next-task" required maxLength={1000} value={task} onChange={(event) => { setTask(event.target.value); setRecommendations(null); }} /><button className="button-primary" type="submit" disabled={!task.trim()}>업무 전 추천 받기</button>
      </fieldset></form>{categoryRules && <Rules items={categoryRules} />}{recommendations && <div role="status"><p>{recommendations.reason}</p><Rules items={recommendations.recommendations} /></div>}<p className="field-help">추천은 내가 저장한 같은 분류의 최신 규칙을 사용합니다.</p></section>
    </>}
  </section>;
}

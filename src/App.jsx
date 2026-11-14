import { savedTracks, saveRecordTrack } from './recordTracks.js';
import { buildBlackboxReport, buildRecoveryEmail } from './reportDrafts.js';
import { useEffect, useRef, useState } from 'react';
import AnalysisAddons from './components/AnalysisAddons.jsx';
import Icon from './components/Icon.jsx';
import HeroMascot from './components/HeroMascot.jsx';
import { createAnalysisDraft, createDemoRecord, DEMO_RECORDS } from './analysis.js';
import GuidedChat from './components/GuidedChat.jsx';
import ServerWorkspace from './components/ServerWorkspace.jsx';
import { CHECKLIST_STORAGE_KEY, CHECKLIST_CONTEXTS, checklistContext, checklistFromRecord, readChecklistItems } from './checklistStore.js';

const STORAGE_KEY = 'daeumjang.reflections.v1';
const TASK_TYPES = ['문서·자료', '회의·소통', '일정·마감', '기타'];
const HOME_EXAMPLES = [
  { label: '첨부파일 빼먹음', text: '메일을 보낸 뒤 첨부파일이 빠진 것을 확인했어요.', mode: 'mistake' },
  { label: '보고 날짜 놓침', text: '예정된 보고 시간을 놓친 것을 확인했어요.', mode: 'mistake' },
  { label: '회의 때 한소리 들음', text: '회의에서 자료를 더 확인해 달라는 말을 들었어요.', mode: 'feedback' },
];
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
    const stringFields = ['facts', 'interpretation', 'feeling', 'cause', 'impact', 'unknown', 'improvement', 'followUp', 'checklist', 'outcome', 'emotionFocus', 'emotionNeed', 'emotionClosing'];
    return {
      items: value.filter((item) => item && typeof item.id === 'string' && typeof item.facts === 'string' && typeof item.checklist === 'string').map((item) => ({
        ...item,
        mode: item.mode === 'feedback' ? 'feedback' : 'mistake',
        causeStatus: ['unknown', 'hypothesis', 'confirmed'].includes(item.causeStatus) ? item.causeStatus : 'unknown',
        taskType: TASK_TYPES.includes(item.taskType) ? item.taskType : '기타',
        actionChecked: Array.isArray(item.actionChecked) ? item.actionChecked.filter((key) => ['checklist', 'unknown', 'improvement', 'followUp'].includes(key)) : [],
        addonDrafts: item.addonDrafts && typeof item.addonDrafts === 'object' && !Array.isArray(item.addonDrafts)
          ? Object.fromEntries(['blackbox', 'emailFormal', 'emailCasual'].filter((key) => typeof item.addonDrafts[key] === 'string').map((key) => [key, item.addonDrafts[key]]))
          : {},
        ...Object.fromEntries(stringFields.map((field) => [field, typeof item[field] === 'string' ? item[field] : ''])),
      })),
      error: '',
      readError: false,
    };
  } catch {
    return { items: [], error: '저장한 기록을 읽지 못했습니다. 기존 기록을 보호하기 위해 새 기록을 저장할 수 없습니다. 브라우저 저장 공간을 확인해 주세요.', readError: true };
  }
}

function Field({ name, label, value, onChange, help, placeholder, rows = 3, required = false, error = '' }) {
  const id = 'field-' + name;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {help && <p className="field-help" id={id + '-help'}>{help}</p>}
      <textarea id={id} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} rows={rows} maxLength={1200} required={required} aria-invalid={Boolean(error)} aria-describedby={[help && id + '-help', error && id + '-error'].filter(Boolean).join(' ') || undefined} />
      {error && <p className="field-error" id={id + '-error'}>{error}</p>}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const previousPageRef = useRef(page);
  const [serverSeed, setServerSeed] = useState(null);
  const [pendingRecord, setPendingRecord] = useState(null);
  const [trackExpanded, setTrackExpanded] = useState(false);
  const [entryMode, setEntryMode] = useState('mistake');
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [records, setRecords] = useState(readRecords);
  const [checklistState, setChecklistState] = useState(() => readChecklistItems(readRecords().items, TASK_TYPES));
  const [selectedId, setSelectedId] = useState(null);
  const [formTrack, setFormTrack] = useState('feelings');
  const [recordFilter, setRecordFilter] = useState('feelings');
  const [emotionChat, setEmotionChat] = useState(false);
  const [taskFilter, setTaskFilter] = useState('전체');
  const [formErrors, setFormErrors] = useState({});
  const [homeError, setHomeError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const [aiAvailable, setAiAvailable] = useState(null);
  const [aiElapsed, setAiElapsed] = useState(0);
  const [outcomeText, setOutcomeText] = useState('');
  const [addon, setAddon] = useState('blackbox');
  const [addonVisible, setAddonVisible] = useState(false);
  const [addonDraft, setAddonDraft] = useState('');
  const [emailTone, setEmailTone] = useState('formal');
  const [checklistPopupOpen, setChecklistPopupOpen] = useState(false);
  const [checklistPopupId, setChecklistPopupId] = useState(null);
  const [popupFilter, setPopupFilter] = useState('전체');
  const [popupCheckedIds, setPopupCheckedIds] = useState([]);
  const [popupError, setPopupError] = useState('');
  const [showNewChecklistItem, setShowNewChecklistItem] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistType, setNewChecklistType] = useState('mail');
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const checklistDialogRef = useRef(null);
  const checklistTriggerRef = useRef(null);
  const draggingChecklistIdRef = useRef(null);
  const aiAbortRef = useRef(null);

  const selected = pendingRecord || records.items.find((item) => item.id === selectedId);
  const popupItems = checklistState.items.filter((item) => popupFilter === '전체' || checklistContext(item) === popupFilter);
  const taskItems = checklistState.items.filter((item) => taskFilter === '전체' || item.taskType === taskFilter);

  useEffect(() => {
    if (previousPageRef.current === page) return;
    previousPageRef.current = page;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.querySelector('#main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [page]);

  useEffect(() => {
    let active = true;
    fetch('/api/status', { signal: AbortSignal.timeout(5000) })
      .then((response) => response.ok ? response.json() : { available: false })
      .then((result) => { if (active) setAiAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setAiAvailable(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!aiLoading) { setAiElapsed(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setAiElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [aiLoading]);

  useEffect(() => {
    if (checklistPopupOpen && checklistDialogRef.current && !checklistDialogRef.current.open) {
      checklistDialogRef.current.showModal();
    }
    if (!checklistPopupOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [checklistPopupOpen]);

  useEffect(() => {
    if (page !== 'form' && page !== 'home') aiAbortRef.current?.abort();
  }, [page]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function persist(nextItems) {
    if (records.readError) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
      setRecords({ items: nextItems, error: '', readError: false });
      return true;
    } catch {
      setRecords((current) => ({ ...current, error: '저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' }));
      return false;
    }
  }

  function persistChecklist(nextItems) {
    if (checklistState.readError) return false;
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(nextItems));
      setChecklistState({ items: nextItems, error: '', readError: false });
      return true;
    } catch {
      setChecklistState((current) => ({ ...current, error: '체크리스트를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' }));
      return false;
    }
  }

  function updateDraft(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => ({ ...current, [name]: '' }));
    if (name === 'rawText') setAiError('');
    if (name === 'rawText') setHomeError('');
  }

  async function beginFromHome(forceLocal = false) {
    if ((aiLoading || aiAbortRef.current) && !forceLocal) return;
    if (forceLocal) {
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
      setAiLoading(false);
    }
    const text = draft.rawText.trim();
    if (!text) {
      setHomeError('먼저 오늘 있었던 일을 한두 문장으로 적어 주세요.');
      document.getElementById('home-raw-text')?.focus();
      return;
    }
    setAiError('');
    setNotice('');
    const showResult = (suggestions = null) => {
      setPendingRecord(createAnalysisDraft(text, entryMode, suggestions));
      setSelectedId(null);
      setTrackExpanded(false);
      setAddonVisible(false);
      setPage('review');
      window.scrollTo({ top: 0 });
    };
    if (forceLocal || !aiConsent || aiAvailable !== true) { showResult(); return; }
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 50000);
    setAiLoading(true);
    try {
      const response = await fetch('/api/organize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: entryMode, consent: true }), signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '분석을 불러오지 못했어요.');
      if (!result.suggestions || !['observed', 'improvement', 'checklist'].some((key) => typeof result.suggestions[key] === 'string' && result.suggestions[key].trim())) throw new Error('분석 내용이 비어 있어요.');
      if (!controller.signal.aborted) showResult(result.suggestions);
    } catch (error) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setAiError(controller.signal.reason === 'timeout' ? '응답이 지연되고 있어요. 다시 시도하거나 기본 정리로 계속할 수 있어요.' : (error.message || '분석을 불러오지 못했어요.'));
    } finally {
      window.clearTimeout(timeout);
      if (aiAbortRef.current === controller) { aiAbortRef.current = null; setAiLoading(false); }
    }
  }

  function openDemo(example) {
    setPendingRecord(createDemoRecord(example));
    setSelectedId(null);
    setTrackExpanded(false);
    setAddonVisible(false);
    setNotice('');
    setPage('review');
    window.scrollTo({ top: 0 });
  }

  function saveCurrent(includeChecklist = false, track = 'tasks') {
    if (!selected) return false;
    if (!selected.facts.trim()) { setNotice('확인한 사실을 먼저 추가해 주세요. 아래 내용 직접 정리하기에서 입력할 수 있어요.'); return false; }
    if (includeChecklist && !selected.checklist?.trim()) { setNotice('저장할 체크리스트를 먼저 작성해 주세요.'); return false; }
    const previous = records.items.find((item) => item.id === selected.id);
    const saved = saveRecordTrack(selected, previous, track);
    if (!persist(previous ? records.items.map((item) => item.id === selected.id ? saved : item) : [saved, ...records.items])) return false;
    setSelectedId(selected.id);
    setPendingRecord({ ...selected, savedTracks: saved.savedTracks });
    if (includeChecklist && !checklistState.items.some((item) => item.recordId === selected.id)) {
      if (!persistChecklist([...checklistState.items, checklistFromRecord(selected)])) {
        setNotice('기록은 저장했지만 체크리스트를 저장하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
        return false;
      }
    }
    setNotice(includeChecklist ? '재발 방지 체크리스트에 저장했어요. 다음 업무 전에 다시 확인해 보세요.' : track === 'feelings' ? '감정 기록을 저장했어요.' : '할 일을 저장했어요.');
    return true;
  }

  function start(mode, initialText = '', destination = 'form') {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setPendingRecord(null);
    setEmotionChat(false);
    setTrackExpanded(false);
    setEntryMode(mode);
    setDraft({ ...EMPTY_DRAFT, rawText: initialText });
    setAiConsent(false);
    setAiLoading(false);
    setAddon('blackbox');
    setAddonVisible(false);
    setAddonDraft('');
    setEmailTone('formal');
    setFormErrors({});
    setAiError('');
    setAiNotice('');
    setNotice('');
    setPage(destination);
    window.scrollTo({ top: 0 });
  }

  function completeChat(answers, preferredTrack) {
    if (emotionChat && selected) {
      setPendingRecord({ ...selected, ...answers, facts: answers.facts?.trim() || selected.facts });
      setEmotionChat(false);
      setPage('review');
      setNotice('대화 내용을 정리했어요. 확인한 뒤 마음 정리 저장을 눌러 주세요.');
      return;
    }
    setFormTrack(preferredTrack === 'tasks' ? 'tasks' : 'feelings');
    setDraft((current) => ({ ...current, ...answers }));
    setPage('form');
    window.requestAnimationFrame(() => {
      document.getElementById(preferredTrack === 'tasks' ? 'tasks-form-title' : 'feelings-form-title')?.scrollIntoView({ block: 'start' });
    });
  }

  async function askAi() {
    if (aiLoading || aiAvailable !== true) return;
    setAiNotice('');
    if (!draft.rawText.trim()) {
      setAiError('먼저 상황을 한두 문장으로 적어 주세요.');
      document.getElementById('field-rawText')?.focus();
      return;
    }
    if (!aiConsent) {
      setAiError('AI로 전송할 내용을 확인하고 동의해 주세요.');
      return;
    }
    setAiLoading(true);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 50000);
    setAiError('');
    setNotice('');
    try {
      const response = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.rawText.trim(), mode: entryMode, consent: true }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'AI 제안을 불러오지 못했습니다.');
      const suggestions = result?.suggestions;
      const fields = ['observed', 'interpretation', 'feeling', 'unknown', 'improvement', 'followUp', 'checklist'];
      if (!suggestions || typeof suggestions !== 'object' || !fields.some((field) => typeof suggestions[field] === 'string' && suggestions[field].trim())) {
        throw new Error('AI 초안이 비어 있습니다. 다시 시도하거나 직접 정리해 주세요.');
      }
      const suggested = (field) => typeof suggestions[field] === 'string' ? suggestions[field] : '';
      setDraft((current) => ({
        ...current,
        source: 'ai',
        facts: current.facts || suggested('observed'),
        interpretation: current.interpretation || suggested('interpretation'),
        feeling: current.feeling || suggested('feeling'),
        unknown: current.unknown || suggested('unknown'),
        improvement: current.improvement || suggested('improvement'),
        followUp: current.followUp || suggested('followUp'),
        checklist: current.checklist || suggested('checklist'),
      }));
      setAiNotice('AI가 빈 칸에 초안을 넣었습니다. 확인한 사실과 추측을 직접 검토하고 고쳐 주세요.');
    } catch (error) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setAiError((controller.signal.reason === 'timeout' ? 'AI 응답이 지연되고 있어요.' : error instanceof Error ? error.message : 'AI 요청에 실패했습니다.') + ' 작성한 내용은 그대로 남아 있으며 직접 입력할 수 있습니다.');
    } finally {
      window.clearTimeout(timeout);
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setAiLoading(false);
      }
    }
  }

  function saveDraft(event) {
    event.preventDefault();
    const errors = {
      facts: draft.facts.trim() ? '' : '직접 확인한 일·들은 말을 적어 주세요.',
      checklist: formTrack === 'feelings' || draft.checklist.trim() ? '' : '다음 업무에서 확인할 행동 한 가지를 적어 주세요.',
    };
    setFormErrors(errors);
    if (errors.facts || errors.checklist) {
      document.getElementById(errors.facts ? 'field-facts' : 'field-checklist')?.focus();
      return;
    }
    const candidate = {
      id: draft.id || window.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2),
      createdAt: draft.createdAt || new Date().toISOString(),
      source: draft.source || 'manual',
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
      savedTracks: ['feelings', 'tasks'],
      emotionFocus: draft.emotionFocus || '', emotionNeed: draft.emotionNeed || '', emotionClosing: draft.emotionClosing || '',
      actionChecked: Array.isArray(draft.actionChecked) ? draft.actionChecked : [],
      addonDrafts: draft.addonDrafts || {},
      usedAt: null,
      outcome: '',
    };
    const item = saveRecordTrack(candidate, records.items.find((record) => record.id === candidate.id), formTrack);
    const nextRecords = records.items.some((record) => record.id === item.id)
      ? records.items.map((record) => record.id === item.id ? { ...item, usedAt: record.usedAt, outcome: record.outcome } : record)
      : [item, ...records.items];
    if (persist(nextRecords)) {
      const hasChecklist = checklistState.items.some((entry) => entry.recordId === item.id);
      const checklistSaved = formTrack === 'feelings' || persistChecklist(hasChecklist
        ? checklistState.items.map((entry) => entry.recordId === item.id ? { ...entry, text: item.checklist, taskType: item.taskType, context: checklistContext(item) } : entry)
        : [checklistFromRecord(item), ...checklistState.items]);
      setPendingRecord({ ...candidate, savedTracks: item.savedTracks });
      setTrackExpanded(false);
      setSelectedId(item.id);
      setOutcomeText('');
      setAddon('blackbox');
      setAddonVisible(false);
      setAddonDraft('');
      setEmailTone('formal');
      setPage('review');
      setNotice(checklistSaved ? (draft.id ? '수정한 내용을 저장했어요. 이전에 편집한 보고·메일 초안도 함께 확인해 주세요.' : formTrack === 'feelings' ? '이 기기에 감정 기록을 저장했어요.' : '이 기기에 할 일을 저장했어요.') : '기록은 저장했지만 체크리스트를 저장하지 못했어요. 저장 공간을 확인해 주세요.');
      window.scrollTo({ top: 0 });
    }
  }

  function openRecord(item) {
    setPendingRecord(null);
    setTrackExpanded(false);
    setSelectedId(item.id);
    setOutcomeText(item.outcome || '');
    setAddon('blackbox');
    setAddonVisible(false);
    setAddonDraft('');
    setEmailTone('formal');
    setNotice('');
    setPage('review');
    window.scrollTo({ top: 0 });
  }

  function updateRecord(id, patch) {
    if (pendingRecord?.id === id) { setPendingRecord((current) => ({ ...current, ...patch })); return true; }
    return persist(records.items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function toggleActionStep(key) {
    if (!selected) return;
    const current = Array.isArray(selected.actionChecked) ? selected.actionChecked : [];
    updateRecord(selected.id, {
      actionChecked: current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    });
  }

  function draftKey(type = addon, tone = emailTone) {
    return type === 'blackbox' ? 'blackbox' : tone === 'casual' ? 'emailCasual' : 'emailFormal';
  }

  function loadAddonDraft(type, tone = emailTone) {
    const key = draftKey(type, tone);
    return selected.addonDrafts?.[key] ?? (type === 'blackbox' ? buildBlackboxReport(selected) : buildRecoveryEmail(selected, tone));
  }

  function editAddonDraft(value) {
    setAddonDraft(value);
    if (selected) updateRecord(selected.id, { addonDrafts: { ...selected.addonDrafts, [draftKey()]: value } });
  }

  function changeEmailTone(tone) {
    setEmailTone(tone);
    if (selected) setAddonDraft(loadAddonDraft('email', tone));
  }

  function deleteRecord(id) {
    if (!window.confirm('이 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    if (persist(records.items.filter((item) => item.id !== id))) {
      persistChecklist(checklistState.items.filter((item) => item.recordId !== id));
      setPage('library');
      setNotice('기록을 삭제했습니다.');
    }
  }

  async function copyAddon() {
    try {
      await window.navigator.clipboard.writeText(addonDraft);
      setNotice('초안을 복사했습니다. 실제 상황에 맞게 다시 확인한 뒤 사용하세요.');
    } catch {
      setNotice('자동 복사에 실패했습니다. 아래 내용을 직접 선택해 복사해 주세요.');
    }
  }

  function downloadAddon() {
    const file = new Blob([addonDraft], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = (addon === 'blackbox' ? '블랙박스_보고서_' : '수습_보고_메일_') + selected.id.slice(0, 8) + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }

  function openChecklistPopup(item, event, goToTask = false) {
    checklistTriggerRef.current = event.currentTarget;
    setNotice('');
    setPopupFilter(item ? checklistContext(item) : 'mail');
    setPopupCheckedIds([]);
    setPopupError('');
    setShowNewChecklistItem(false);
    setEditingChecklistId(null);
    if (goToTask) {
      setTaskFilter(item?.taskType || '전체');
      setPage('task');
    }
    setChecklistPopupId(item?.id || null);
    setChecklistPopupOpen(true);
  }

  function closeChecklistPopup() {
    const popupId = checklistPopupId;
    setChecklistPopupOpen(false);
    setChecklistPopupId(null);
    window.requestAnimationFrame(() => {
      const trigger = checklistTriggerRef.current;
      const taskButton = document.getElementById('checklist-open-' + popupId);
      (trigger?.isConnected ? trigger : taskButton || document.getElementById('task-title'))?.focus();
    });
  }

  function handleChecklistKeys(event) {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter((node) => node.getClientRects().length);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function confirmChecklistApplied() {
    if (!popupCheckedIds.length) {
      setPopupError('이번 업무에 적용한 항목을 한 개 이상 선택해 주세요.');
      return;
    }
    const checkedIds = new Set(popupCheckedIds);
    const usedAt = new Date().toISOString();
    const checkedRecordIds = new Set(checklistState.items.filter((item) => checkedIds.has(item.id) && item.recordId).map((item) => item.recordId));
    if (persistChecklist(checklistState.items.map((item) => checkedIds.has(item.id) ? { ...item, timesApplied: item.timesApplied + 1, lastAppliedAt: usedAt } : item))
      && persist(records.items.map((item) => checkedRecordIds.has(item.id) ? { ...item, usedAt } : item))) {
      setNotice(`${checkedIds.size}개 항목을 이번 업무에 적용했다고 기록했습니다.`);
      checklistDialogRef.current?.close();
    }
  }

  function addChecklistItem(event) {
    event.preventDefault();
    const text = newChecklistText.trim();
    if (!text) { setPopupError('새 항목을 입력해 주세요.'); return; }
    const item = { id: window.crypto?.randomUUID?.() || `custom-${Date.now()}`, recordId: null, text: text.slice(0, 200), taskType: CHECKLIST_CONTEXTS.find((context) => context.id === newChecklistType)?.taskType || '기타', context: newChecklistType, timesApplied: 0, lastAppliedAt: null };
    if (persistChecklist([...checklistState.items, item])) {
      setPopupFilter(newChecklistType);
      setNewChecklistText('');
      setShowNewChecklistItem(false);
      setPopupError('');
      setNotice('체크리스트 항목을 추가했습니다.');
    }
  }

  function saveChecklistEdit(item) {
    const text = editingChecklistText.trim();
    if (!text) { setPopupError('항목 내용을 입력해 주세요.'); return; }
    if (!persistChecklist(checklistState.items.map((entry) => entry.id === item.id ? { ...entry, text: text.slice(0, 200) } : entry))) return;
    if (item.recordId) updateRecord(item.recordId, { checklist: text.slice(0, 200) });
    setEditingChecklistId(null);
    setPopupError('');
  }

  function removeChecklistItem(item) {
    if (!window.confirm('이 체크리스트 항목을 삭제할까요?')) return;
    if (persistChecklist(checklistState.items.filter((entry) => entry.id !== item.id))) {
      setPopupCheckedIds((current) => current.filter((id) => id !== item.id));
      setNotice('체크리스트 항목을 삭제했습니다. 원래 경험 기록은 남아 있습니다.');
    }
  }

  function moveChecklistItem(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    const next = [...checklistState.items];
    const sourceIndex = next.findIndex((item) => item.id === sourceId);
    const targetIndex = next.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    persistChecklist(next);
  }

  function toggleAddon(nextAddon) {
    setAddonVisible((current) => nextAddon === addon ? !current : true);
    setAddon(nextAddon);
    setAddonDraft(loadAddonDraft(nextAddon));
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
          <button className="brand" type="button" onClick={() => setPage('home')} aria-label="Mayday 홈으로">
            <img className="brand-symbol" src="/mayday-icon.png" alt="" />
            <img className="brand-wordmark" src="/mayday-wordmark.svg" alt="" />
          </button>
          <nav className="site-nav" aria-label="주요 메뉴">
            <button type="button" className={['home', 'chat', 'form', 'review', 'action'].includes(page) ? 'nav-link is-current' : 'nav-link'} aria-current={['home', 'chat', 'form', 'review', 'action'].includes(page) ? 'page' : undefined} onClick={() => setPage('home')}><Icon name="home" />홈</button>
            <button type="button" className={page === 'examples' ? 'nav-link is-current' : 'nav-link'} aria-current={page === 'examples' ? 'page' : undefined} onClick={() => setPage('examples')}><Icon name="layers" />실패 라이브러리</button>
            <button type="button" className={page === 'library' ? 'nav-link is-current' : 'nav-link'} aria-current={page === 'library' ? 'page' : undefined} onClick={() => setPage('library')}><Icon name="clock" />내 기록</button>
          </nav>
          <div className="header-actions"><button className="header-checklist" type="button" aria-haspopup="dialog" aria-expanded={checklistPopupOpen} onClick={(event) => openChecklistPopup(null, event)}><Icon name="shield" variant="clay" size={24} />내 체크리스트{checklistPopupOpen && <span aria-hidden="true">▴</span>}</button><img className="header-avatar" src="/mayday-day.png" alt="데이 캐릭터" width="36" height="36" /></div>
        </div>
      </header>

      <main id="main" className={`app-shell page-${page}`}>
        {page === 'server' && <ServerWorkspace seed={serverSeed} />}
        {records.error && <div className="container"><p className="alert" role="alert">{records.error}</p></div>}
        {notice && <div className="app-toast" role="status"><Icon name="check" /><p>{notice}</p><button type="button" aria-label="알림 닫기" onClick={() => setNotice('')}><Icon name="close" /></button></div>}

        {page === 'home' && (
          <section className="home-hero" aria-labelledby="hero-title">
            <div className="container home-hero-inner">
              <div className="home-intro">
                <HeroMascot className="home-may" />
                <h1 id="hero-title">오늘의 실수도,<br /><span>내일의 나를 위한 한 걸음.</span></h1>
                <p>마음은 가볍게, 다음 행동은 선명하게. 메이와 함께 정리해요.</p>
              </div>

              <form className="home-composer" aria-label="오늘의 경험 정리" onSubmit={(event) => { event.preventDefault(); if (!draft.rawText.trim()) { setHomeError('상황을 한 문장으로 적어 주세요.'); return; } start(entryMode, draft.rawText, 'chat'); }} aria-busy={aiLoading}>
                <label className="visually-hidden" htmlFor="home-raw-text">오늘 회사에서 있었던 일</label>
                <textarea id="home-raw-text" value={draft.rawText} onChange={(event) => updateDraft('rawText', event.target.value)} maxLength={500} rows={4} disabled={aiLoading} aria-invalid={Boolean(homeError)} aria-describedby={homeError ? 'home-error' : undefined} placeholder="오늘 어떤 일이 있었나요? 편하게 이야기해 주세요.
예) 거래처에 이전 버전의 견적서를 보냈어요." />
                <div className="home-composer-bottom"><span className="input-count">{draft.rawText.length > 0 ? `${draft.rawText.length} / 500` : '완벽한 문장이 아니어도 괜찮아요'}</span><button className="button-primary" type="submit" disabled={aiLoading}>{aiLoading ? <><span className="loading-spinner" /> 정리하는 중…</> : <><Icon name="send" /> 메이데이 보내기</>}</button></div>
                {homeError && <p className="field-error" id="home-error" role="alert">{homeError}</p>}
              </form>
              {aiLoading && <div className="ai-progress" role="status"><span>AI가 사실과 해석을 나누고 있어요 · {aiElapsed}초{aiElapsed >= 12 ? ' · 연결이 늦어지면 기본 정리를 이용하세요' : ''}</span><button type="button" className="text-button" onClick={() => beginFromHome(true)}>기본 정리로 계속</button></div>}
              {aiError && <div className="home-error alert" role="alert"><p>{aiError}</p><button type="button" className="button-secondary" onClick={() => beginFromHome(true)}>기본 정리로 계속</button></div>}
              <div className="home-examples"><span>이런 일도 괜찮아요</span>{HOME_EXAMPLES.map((example) => <button key={example.label} type="button" disabled={aiLoading} onClick={() => { setEntryMode(example.mode); updateDraft('rawText', example.text); document.getElementById('home-raw-text')?.focus(); }}>{example.label}</button>)}</div>
              <div className="home-recent"><div className="home-recent-heading"><h2>지난번 일들</h2><span>{records.items.length ? <button className="text-button" type="button" onClick={() => setPage('library')}>전체 보기 <Icon name="arrow" /></button> : '아직 기록이 없어요 · 예시를 먼저 살펴보세요'}</span></div>
                <div className="home-recent-grid">{records.items.length ? records.items.slice(0, 3).map((item) => <button className="home-recent-card" type="button" key={item.id} onClick={() => openRecord(item)}><small>{new Date(item.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</small><strong>{item.facts}</strong><span>{item.usedAt ? '업무에 적용함' : '내 기록에 저장됨'}</span></button>) : DEMO_RECORDS.slice(0, 3).map((example) => <button className="home-recent-card" type="button" key={example.title} onClick={() => openDemo(example)}><small>{example.date} · 시연 예시</small><strong>{example.title}</strong><span>{example.status}</span></button>)}</div>
              </div>
            </div>
          </section>
        )}

        {page === 'chat' && (
          <section className="container chat-workflow">
            <GuidedChat key={emotionChat ? 'feelings' : 'experience'} onFeelingsStart={(text) => { setPendingRecord(createAnalysisDraft(text, entryMode)); setEmotionChat(true); }} feelingsOnly={emotionChat} initialAnswers={emotionChat ? selected : undefined} mode={entryMode} initialText={emotionChat ? selected?.facts || '' : draft.rawText} onComplete={completeChat} onCancel={() => { setPage(emotionChat ? 'review' : 'home'); setEmotionChat(false); window.scrollTo({ top: 0 }); }} />
          </section>
        )}

        {page === 'form' && (
          <section className="container workflow form-workflow" aria-labelledby="form-title">
            <div className="section-heading"><div><p className="eyebrow">01 / 경험 정리</p><h1 id="form-title">한 번 적고, 두 갈래로 정리해요.</h1><p>확인한 사실과 마음에 남은 해석을 나누고, 다음 업무에 쓸 행동을 남겨 보세요.</p></div><button className="button-secondary" type="button" onClick={() => setPage('home')}>← 홈으로</button></div>
            <div className="progress-steps" aria-label="진행 단계"><span className="is-current">1 경험 입력</span><span>2 감정·할 일 정리</span><span>3 체크리스트 저장</span></div>
            <form onSubmit={saveDraft} noValidate>
              <div className="track-page-tabs" role="group" aria-label="저장할 기록 종류">{[['feelings', '감정 기록 저장'], ['tasks', '할 일 저장']].map(([key, label]) => <button key={key} type="button" aria-pressed={formTrack === key} onClick={() => { setFormTrack(key); setFormErrors({}); }}>{label}</button>)}</div>
              <p className="field-help">선택한 종류만 저장합니다. 직접 확인한 사실은 두 기록에서 함께 사용해요.</p>
              <section className="intake-panel" aria-labelledby="intake-title">
                <div className="intake-heading"><div><p className="eyebrow">선택 · AI 작성 보조</p><h2 id="intake-title">처음 적은 상황</h2><p>아래에 정리한 내용만 저장돼요. AI를 쓰지 않아도 직접 채울 수 있어요.</p></div><div className="form-mode-switch" role="group" aria-label="경험 유형"><button type="button" aria-pressed={entryMode === 'mistake'} onClick={() => setEntryMode('mistake')}>실수</button><button type="button" aria-pressed={entryMode === 'feedback'} onClick={() => setEntryMode('feedback')}>지적</button></div></div>
                <Field name="rawText" label="상황을 한두 문장으로 적어 주세요" value={draft.rawText} onChange={updateDraft} help="AI 버튼을 누를 때 이 문장만 외부 AI 서비스로 전송합니다." placeholder={entryMode === 'mistake' ? '예: 공유한 표의 합계가 원본과 달랐어요. 누가 사용했는지는 모릅니다.' : '예: 다음 자료는 더 확인해 달라는 말을 들었어요. 어떤 항목인지는 모르겠습니다.'} rows={3} />
                <div className="intake-ai-row"><p className="field-help">회사명·실명·고객 정보·문서 원문은 입력하지 마세요.</p>{aiAvailable === false ? <p className="notice" role="status">지금은 AI 초안을 사용할 수 없어요. 아래에서 직접 정리해 주세요.</p> : <><label className="consent-label"><input type="checkbox" checked={aiConsent} onChange={(event) => { setAiConsent(event.target.checked); setAiError(''); }} />이 문장을 Anthropic의 AI로 전송하는 데 동의합니다.</label><button className="button-secondary ai-button" type="button" onClick={askAi} disabled={aiLoading || aiAvailable !== true}>{aiLoading ? '초안 만드는 중…' : aiAvailable === null ? 'AI 확인 중…' : 'AI로 빈칸 채우기'}</button></>}</div>
                {aiError && <p className="alert" role="alert">{aiError}</p>}{aiNotice && <p className="notice" role="status">{aiNotice}</p>}
              </section>

              <div className="track-form-grid">
                <section className="track-panel track-panel-feelings" aria-labelledby="feelings-form-title"><div className="track-panel-heading"><span className="track-icon track-icon-day" aria-hidden="true"><img src="/mayday-day.png" alt="" /></span><div><p className="eyebrow">FEELINGS TRACK</p><h2 id="feelings-form-title">감정 트랙</h2><p>들은 말과 내 해석을 구분해요.</p></div></div>
                  <Field name="facts" label="직접 확인한 일·들은 말" value={draft.facts} onChange={updateDraft} required error={formErrors.facts} help="확인한 말·행동·수치만 적어 주세요." placeholder={entryMode === 'mistake' ? '예: 공유한 표의 합계가 원본과 달랐습니다.' : '예: “다음 자료는 더 확인해 주세요”라는 말을 들었습니다.'} />
                  <Field name="interpretation" label="내 해석 · 확인되지 않은 추측" value={draft.interpretation} onChange={updateDraft} help="상대의 의도는 사실로 단정하지 마세요." placeholder="떠오른 해석이 있다면 적어 주세요" rows={2} />
                  <Field name="feeling" label="내가 느낀 감정" value={draft.feeling} onChange={updateDraft} help="느낀 감정이 없다면 비워 두어도 됩니다." placeholder="예: 당황스럽고 걱정됐습니다" rows={2} />
                </section>
                <section className="track-panel track-panel-tasks" aria-labelledby="tasks-form-title"><div className="track-panel-heading"><span className="track-icon track-icon-may" aria-hidden="true"><img src="/mayday-hero.png" alt="" /></span><div><p className="eyebrow">ACTION TRACK</p><h2 id="tasks-form-title">할 일 트랙</h2><p>지금 확인할 일과 다음 행동을 정해요.</p></div></div>
                  <Field name="unknown" label="아직 확인할 일" value={draft.unknown} onChange={updateDraft} placeholder="예: 자료를 누가 사용했는지 확인하기" rows={2} />
                  <Field name="improvement" label="개선 행동" value={draft.improvement} onChange={updateDraft} placeholder="예: 공유 전 원본 수치를 대조하기" rows={2} />
                  <Field name="followUp" label="후속 질문·보고" value={draft.followUp} onChange={updateDraft} placeholder="확인할 내용을 질문으로 적어 주세요" rows={2} />
                  <Field name="checklist" label="다음 업무 체크리스트 한 가지" value={draft.checklist} onChange={updateDraft} required={formTrack === 'tasks'} error={formErrors.checklist} help="다음에 실제로 점검할 수 있는 행동을 적어 주세요." placeholder="예: 발송 전 첨부 파일을 직접 열어 확인하기" rows={2} />
                  <div className="field"><label className="field-label" htmlFor="task-type">다시 볼 업무 종류</label><select id="task-type" value={draft.taskType} onChange={(event) => updateDraft('taskType', event.target.value)}>{TASK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                </section>
              </div>

              <details className="report-fields form-disclosure"><summary>원인과 영향도 기록하기 <span className="badge">선택</span></summary><div className="stack"><div className="field"><label className="field-label" htmlFor="cause-status">원인을 어느 정도 확인했나요?</label><select id="cause-status" value={draft.causeStatus} onChange={(event) => updateDraft('causeStatus', event.target.value)}><option value="unknown">아직 모름</option><option value="hypothesis">추정 중</option><option value="confirmed">직접 확인함</option></select></div>{draft.causeStatus !== 'unknown' && <Field name="cause" label={draft.causeStatus === 'confirmed' ? '확인한 원인' : '추정한 원인'} value={draft.cause} onChange={updateDraft} help="추정은 보고서에서도 추정으로 표시됩니다." placeholder="확인한 내용만 적어 주세요" />}<Field name="impact" label="확인된 영향" value={draft.impact} onChange={updateDraft} help="아직 모르면 비워 두세요." placeholder="확인한 영향만 적어 주세요" /></div></details>

              <div className="form-save">
                <p className="field-help">기록은 이 기기의 브라우저에만 저장됩니다. 공유 기기에서는 기록을 남기지 마세요.</p>
                <div className="form-actions"><button className="button-primary" type="submit" disabled={records.readError}>{formTrack === 'feelings' ? '감정 기록 저장하기' : '할 일 저장하기'} <span aria-hidden="true">↗</span></button><button className="button-secondary" type="button" onClick={() => setPage('home')}>나중에 하기</button></div>
              </div>
            </form>
          </section>
        )}

        {(page === 'review' || page === 'action') && selected && (
          <section className={`container workflow result-workflow${page === 'action' ? ' focused-action' : ''}`} aria-labelledby="review-title">
            {page === 'action' && <div className="track-page-tabs" role="group" aria-label="분석 트랙"><button type="button" onClick={() => setPage('review')}>마음 정리</button><button type="button" aria-pressed="true">지금 할 일</button></div>}
            {page === 'action' ? <div className="source-strip action-overview"><strong>{selected.overview || selected.unknown || selected.checklist}</strong><p>{selected.followUp}<br />다음부터는 {selected.checklist}</p></div> : <div className="source-strip"><div><span className="source-label">{selected.source === 'demo' ? '가상 시연 사례 · 실제 사용자 기록이 아닙니다' : selected.source === 'ai' ? 'AI가 정리한 경험' : '내가 쓴 글'}</span><p>{selected.facts ? `“${selected.facts}”` : '확인한 사실을 추가해 주세요.'}</p></div><button className="button-secondary" type="button" onClick={() => { updateDraft('rawText', selected.facts); setPage('home'); window.scrollTo({ top: 0 }); }}><Icon name="refresh" />다시 입력</button></div>}
            <div className="result-heading"><h1 id="review-title">{page === 'action' ? '메이가 더 도와줄게요' : '많이 놀랐죠? 하나씩 같이 정리해봐요'}</h1></div>
            {page === 'action' && <p className="action-intro">필요한 것만 켜보세요.</p>}<div className="result-track-grid">
              <article className="track-result-card emotion-result-card"><div className="track-panel-heading"><span className="track-icon track-icon-day"><img src="/mayday-day.png" alt="" /></span><div><h2>마음 정리</h2><p>일어난 일과 내 걱정을 나눠서 봐요</p></div></div>
                <div className="result-detail"><span>{selected.source === 'local' ? '입력한 상황 · 확인이 필요해요' : '실제로 일어난 일'}</span><p>· {selected.facts || '직접 확인한 내용을 아직 찾지 못했어요. 아래에서 내용을 직접 정리해 주세요.'}</p></div>
                <div className="result-detail"><span>내 머릿속 걱정</span><p>{selected.interpretation ? `· “${selected.interpretation}”` : '아직 적지 않았어요. 떠오른 생각을 직접 정리해 보세요.'}</p></div>
                <div className="result-detail"><span>지금 내 기분</span><p>{selected.feeling ? `· ${selected.feeling}` : '지금 느끼는 감정을 직접 적어 주세요.'}</p></div>
                <div className="result-detail compassion-note"><span>메이가 해주고 싶은 말</span><p>· {selected.compassion || "이번 실수가 당신의 전부는 아니에요. 하나씩 같이 수습해봐요."}</p></div>
                {[['emotionFocus', '마음에 남는 부분'], ['emotionNeed', '지금 필요한 것'], ['emotionClosing', '나에게 남기는 말']].map(([key, label]) => selected[key] && <div className="result-detail" key={key}><span>{label}</span><p>{selected[key]}</p></div>)}
                <button className="button-primary track-cta" type="button" onClick={() => { setEmotionChat(true); setEntryMode(selected.mode); setPage('chat'); }}>마음 더 이야기하기</button>
                <button className="button-secondary track-cta" type="button" onClick={() => saveCurrent(false, 'feelings')} disabled={records.readError}><Icon name="heart" variant="clay" size={24} />마음 정리 저장</button>
              </article>
              <article className="track-result-card task-result-card"><div className="track-panel-heading"><span className="track-icon track-icon-may"><img src="/mayday-hero.png" alt="" /></span><div><h2>지금 할 일</h2><p>{trackExpanded || page === 'action' ? '필요한 것만 켜서 써요' : '급한 것부터 차근차근 해봐요'}</p></div></div>
                {trackExpanded || page === 'action' ? <AnalysisAddons key={selected.id} record={selected} onToggleStep={toggleActionStep} addon={addon} addonVisible={addonVisible} addonDraft={addonDraft} emailTone={emailTone} onToggleAddon={toggleAddon} onEditDraft={editAddonDraft} onToneChange={changeEmailTone} onCopy={copyAddon} onDownload={downloadAddon} onSaveChecklist={() => saveCurrent(true)} onSaveRecord={() => { if (saveCurrent()) setNotice('보고서를 내 기록에 저장했어요. 내 기록에서 다시 열 수 있어요.'); }} /> : <>
                  <div className="result-detail"><span>지금 상황</span><p>· {selected.overview || selected.unknown || selected.checklist}</p></div>
                  <div className="result-detail"><span>다음엔 이렇게</span><p>· {selected.improvement || '실행할 수 있는 행동을 직접 정해 보세요.'}</p><p>· {selected.checklist}</p></div>
                  <div className="result-detail"><span>누구한테 먼저 말할까</span><p>· {selected.followUp || '필요한 내용을 담당자에게 확인해 보세요.'}</p></div>
                  <button className="button-primary track-cta" type="button" onClick={() => setTrackExpanded(true)}><Icon name="send" />수습 도와줘</button><button className="button-secondary track-cta" type="button" onClick={() => saveCurrent(false, 'tasks')} disabled={records.readError}>할 일 저장</button>
                </>}
              </article>
            </div>
            <span className="analysis-source">{selected.source === 'demo' ? '시연 예시' : selected.source === 'ai' ? '사실을 확인한 후 사용해 주세요' : selected.source === 'local' ? '기본 정리 · 추천 행동은 확인 후 수정해 주세요' : '직접 정리한 기록'}</span><div className="result-bottom-actions"><button className="text-button" type="button" onClick={() => { setServerSeed(selected); setPage('server'); window.scrollTo({ top: 0 }); }}>이 경험을 서버에 저장하기</button><button className="text-button" type="button" onClick={() => { setDraft({ ...EMPTY_DRAFT, ...selected, rawText: selected.facts }); setEntryMode(selected.mode); setPage('form'); window.scrollTo({ top: 0 }); }}><Icon name="edit" />내용 직접 정리하기</button>{trackExpanded && <button className="text-button" type="button" onClick={() => { setPage(page === 'action' ? 'review' : 'action'); window.scrollTo({ top: 0 }); }}>{page === 'action' ? '두 트랙 함께 보기' : '지금 할 일 크게 보기'}<Icon name="arrow" /></button>}<button className="text-button" type="button" onClick={(event) => { if (saveCurrent(true)) openChecklistPopup(selected, event); }}><Icon name="shield" />재발 방지 체크리스트 확인</button>{records.items.some((item) => item.id === selected.id) && <button className="text-button danger" type="button" onClick={() => deleteRecord(selected.id)}>기록 삭제</button>}</div>
            {selected.usedAt && <div className="panel stack outcome-panel"><h2>적용 결과</h2><p>이번 업무에서 체크리스트를 사용한 경험을 남겨 보세요.</p><textarea aria-label="적용 결과" value={outcomeText} onChange={(event) => setOutcomeText(event.target.value)} rows="3" maxLength="1200" /><button className="button-secondary" type="button" onClick={saveOutcome}>결과 저장하기</button></div>}
          </section>
        )}

        {page === 'examples' && (
          <section className="container workflow" aria-labelledby="examples-title">
            <div className="section-heading"><div><p className="eyebrow">실패 라이브러리</p><h1 id="examples-title">비슷한 경험에서 다음 행동을 찾아보세요.</h1><p>아래는 시연용 예시입니다. 실제 사용자 기록이 공개되거나 공유되지는 않습니다.</p></div><button className="button-primary" type="button" onClick={() => setPage('home')}>내 경험 정리하기</button></div>
            <div className="example-library-grid">{DEMO_RECORDS.map((example) => <article className="record-card" key={example.title}><span className="badge">가상 시연 · {example.taskType}</span><h2>{example.title}</h2><p>{example.text}</p><div className="example-library-action"><strong>다음에 확인할 행동</strong><p>{example.checklist}</p></div><div className="demo-card-actions"><button className="button-primary" type="button" onClick={() => openDemo(example)}>완성된 결과 보기</button><button className="button-secondary" type="button" onClick={() => start(example.mode, example.text, 'chat')}>대화로 시작하기</button></div></article>)}</div>
          </section>
        )}

        {page === 'library' && (
          <section className="container workflow" aria-labelledby="library-title">
            <div className="section-heading"><div><p className="eyebrow">04 / 내 기록</p><h1 id="library-title">쌓인 경험을 다시 꺼내 보세요.</h1><p>감정 기록과 할 일을 나눠서 꺼내 볼 수 있어요.</p></div><button className="button-primary" type="button" onClick={() => setPage('home')}>새 경험 정리하기</button></div>
            <div className="track-page-tabs" role="group" aria-label="기록 종류">{[['feelings', '감정 기록'], ['tasks', '할 일']].map(([key, label]) => <button key={key} type="button" aria-pressed={recordFilter === key} onClick={() => setRecordFilter(key)}>{label}</button>)}</div>
            {records.items.filter((item) => savedTracks(item).includes(recordFilter)).length ? <div className="record-list">{records.items.filter((item) => savedTracks(item).includes(recordFilter)).map((item) => <article className="record-card" key={item.id}><div><span className="badge">{item.mode === 'mistake' ? '실수' : '지적'} · {item.taskType}</span><h2>{recordFilter === 'feelings' ? item.feeling || '마음 정리' : item.checklist || item.improvement || '할 일'}</h2><p>{item.facts}</p><small>{new Date(item.createdAt).toLocaleDateString('ko-KR')}{item.usedAt ? ' · 다음 업무에 적용함' : ' · 적용 전'}</small></div><button className="button-secondary" type="button" onClick={() => openRecord(item)}>자세히 보기</button></article>)}</div> : <div className="empty-state"><h2>아직 정리한 경험이 없습니다.</h2><p>처음 겪은 실수나 지적에서 다음에 확인할 행동 하나를 만들어 보세요.</p><button className="button-primary" type="button" onClick={() => setPage('home')}>시작하기</button></div>}
          </section>
        )}

        {page === 'task' && (
          <section className="container workflow" aria-labelledby="task-title">
            <div className="section-heading"><div><p className="eyebrow">BEFORE YOU START</p><h1 id="task-title" tabIndex={-1}>업무 전에 한 번 더 확인해요.</h1><p>지난 경험에서 만든 재발 방지 체크리스트를 업무별로 꺼내 보세요.</p></div></div>
            <div className="panel"><div className="field"><label className="field-label" htmlFor="task-filter">업무 종류 선택</label><select id="task-filter" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}><option value="전체">전체</option>{TASK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
            {taskItems.length ? <div className="checklist-list">{taskItems.map((item) => { const source = records.items.find((record) => record.id === item.recordId); return <article className="checklist-card" key={item.id}><span className="badge">{item.taskType}</span><h2>{item.text}</h2><p className="field-help">{item.source === 'demo' ? '가상 시연용 체크리스트 항목' : source ? `이 항목을 만든 경험: ${source.facts}` : '직접 추가한 체크리스트 항목'}</p><div className="action-bar"><button id={'checklist-open-' + item.id} className="button-primary" type="button" onClick={(event) => openChecklistPopup(item, event)}>재발 방지 체크리스트 보기</button>{source && <button className="button-secondary" type="button" onClick={() => openRecord(source)}>경험 다시 보기</button>}</div>{item.timesApplied > 0 && <p className="status-line">이번 업무에 {item.timesApplied}회 적용했습니다.</p>}</article>; })}</div> : <div className="empty-state"><h2>이 업무에 저장한 체크리스트가 없습니다.</h2><p>새로운 경험을 정리하거나 헤더에서 항목을 직접 추가할 수 있어요.</p><button className="button-primary" type="button" onClick={(event) => openChecklistPopup(null, event)}>항목 추가하기</button></div>}
          </section>
        )}
      </main>
      {checklistPopupOpen && (
        <dialog className="checklist-dialog" ref={checklistDialogRef} onClose={closeChecklistPopup} onKeyDown={handleChecklistKeys} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) event.currentTarget.close(); }} aria-labelledby="checklist-dialog-title" aria-describedby="checklist-dialog-description">
          <div className="checklist-dialog-heading"><Icon name="shield" variant="clay" size={44} /><div><h2 id="checklist-dialog-title">내 체크리스트</h2><p id="checklist-dialog-description">일 시작하기 전에 한 번만 훑어봐요</p></div><button className="dialog-close" type="button" aria-label="체크리스트 닫기" onClick={() => checklistDialogRef.current?.close()}>×</button></div>
          <div className="popup-filters" role="group" aria-label="업무 종류 필터">{CHECKLIST_CONTEXTS.filter((context) => context.id !== 'other' || checklistState.items.some((item) => checklistContext(item) === 'other')).map((context) => <button key={context.id} type="button" aria-pressed={popupFilter === context.id} title="선택한 분류를 다시 누르면 전체 항목을 봐요" onClick={() => { setPopupFilter(popupFilter === context.id ? '전체' : context.id); setPopupCheckedIds([]); setPopupError(''); }}>#{context.label}</button>)}</div>
          <div className="popup-list">{popupItems.length ? popupItems.map((item, index) => (
            <div className="popup-checkitem" key={item.id} draggable={editingChecklistId !== item.id} onDragStart={() => { draggingChecklistIdRef.current = item.id; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveChecklistItem(draggingChecklistIdRef.current, item.id); draggingChecklistIdRef.current = null; }} onDragEnd={() => { draggingChecklistIdRef.current = null; }}>
              {editingChecklistId === item.id ? <div className="popup-edit-form"><label htmlFor={`edit-checklist-${item.id}`}>항목 수정</label><input id={`edit-checklist-${item.id}`} value={editingChecklistText} maxLength={200} onChange={(event) => setEditingChecklistText(event.target.value)} /><div className="popup-item-actions"><button type="button" onClick={() => saveChecklistEdit(item)}>저장</button><button type="button" onClick={() => setEditingChecklistId(null)}>취소</button></div></div> : <><label className="popup-checkitem-main"><input type="checkbox" checked={popupCheckedIds.includes(item.id)} onChange={(event) => { setPopupCheckedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)); setPopupError(''); }} /><span><strong>{item.text}</strong><small>{item.taskType} · {item.timesApplied}회 적용{item.source === 'demo' ? ' · 가상 시연' : item.recordId ? ' · 내 기록에서 저장' : ' · 직접 추가'}</small></span></label><details className="popup-item-menu"><summary aria-label={`${item.text} 관리`}>···</summary><div className="popup-item-actions"><button type="button" aria-label={`${item.text} 수정`} onClick={() => { setEditingChecklistId(item.id); setEditingChecklistText(item.text); }}>수정</button><button type="button" aria-label={`${item.text} 삭제`} onClick={() => removeChecklistItem(item)}>삭제</button><button type="button" aria-label={`${item.text} 위로 이동`} disabled={index === 0} onClick={() => moveChecklistItem(item.id, popupItems[index - 1].id)}>↑</button><button type="button" aria-label={`${item.text} 아래로 이동`} disabled={index === popupItems.length - 1} onClick={() => moveChecklistItem(item.id, popupItems[index + 1].id)}>↓</button></div></details></>}
            </div>
          )) : <p className="popup-empty">아직 저장한 항목이 없어요. 아래에서 새 항목을 추가할 수 있습니다.</p>}</div>
          {showNewChecklistItem && <form className="popup-add-form" onSubmit={addChecklistItem}><label htmlFor="new-checklist-text">새 체크리스트 항목</label><input id="new-checklist-text" value={newChecklistText} onChange={(event) => setNewChecklistText(event.target.value)} maxLength={200} placeholder="예: 발송 전 첨부파일 열어 보기" autoFocus /><label htmlFor="new-checklist-type">업무 종류</label><select id="new-checklist-type" value={newChecklistType} onChange={(event) => setNewChecklistType(event.target.value)}>{CHECKLIST_CONTEXTS.map((context) => <option key={context.id} value={context.id}>{context.label}</option>)}</select><div className="popup-item-actions"><button className="button-primary" type="submit">항목 저장</button><button className="button-secondary" type="button" onClick={() => setShowNewChecklistItem(false)}>취소</button></div></form>}
          {popupItems.length > 0 && <p className="popup-summary">{popupCheckedIds.length ? `${popupCheckedIds.length}개 항목을 확인했어요. 준비되면 다 확인했어요를 눌러주세요.` : '작은 확인이 다음 실수를 줄이는 시작이에요.'}</p>}
          {popupError && <p className="alert" role="alert">{popupError}</p>}
          {checklistState.error && <p className="alert" role="alert">{checklistState.error}</p>}
          <div className="action-bar"><button className="button-secondary" type="button" onClick={() => { setNewChecklistType(popupFilter === '전체' ? 'mail' : popupFilter); setShowNewChecklistItem(true); }}>+ 직접 추가</button><button className="button-primary" type="button" onClick={confirmChecklistApplied} disabled={checklistState.readError}><Icon name="shield" />다 확인했어요</button></div>
        </dialog>
      )}
      <footer className="site-footer"><div className="container footer-inner"><button className="text-button" type="button" onClick={() => { setServerSeed(null); setPage('server'); window.scrollTo({ top: 0 }); }}>서버 기록</button><img className="footer-wordmark" src="/mayday-wordmark.svg" alt="Mayday" /><p>사회초년생의 경험을 다음 행동으로 잇는 서비스 · 내 기록은 브라우저에, 서버 기록은 로그인한 계정에 저장됩니다.</p></div></footer>
    </>
  );
}

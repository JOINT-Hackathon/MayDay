import { clarificationFor } from '../chatGuidance.mjs';
import { useEffect, useMemo, useRef, useState } from 'react';

const EMOTION_STEPS = [
  {
    key: 'facts',
    track: '감정 트랙',
    required: true,
    question: {
      mistake: '원래 기대한 결과와 실제로 확인한 결과는 각각 무엇이었나요? 직접 본 수치나 문구를 중심으로 적어 주세요.',
      feedback: '상대가 실제로 한 말이나 행동 중 정확히 기억나는 것은 무엇인가요? 추측은 잠시 빼고 적어 주세요.',
    },
    placeholder: '예: 공유한 표의 합계가 원본과 달랐습니다.',
  },
  {
    key: 'interpretation',
    track: '감정 트랙',
    required: false,
    question: {
      mistake: '그 사실을 보고 어떤 뜻으로 받아들였나요? 아직 확인되지 않은 내 해석이어도 괜찮아요.',
      feedback: '그 말을 어떤 뜻으로 받아들였나요? 상대의 의도를 확정하지 않고 내 해석으로 적어 주세요.',
    },
    placeholder: '예: 내가 업무를 제대로 못한다고 생각했습니다.',
  },
  {
    key: 'feeling',
    track: '감정 트랙',
    required: false,
    question: {
      mistake: '그때 어떤 감정이 들었나요? 감정은 사실이나 해석과 따로 남길게요.',
      feedback: '그 말을 들었을 때 어떤 감정이 들었나요? 답하기 어려우면 건너뛰어도 됩니다.',
    },
    placeholder: '예: 당황하고 걱정됐습니다.',
  },
];

const EMOTION_FOLLOWUPS = [
  { key: 'emotionFocus', track: '마음 더 들여다보기', required: false, question: { mistake: '지금 이야기한 감정에서 가장 마음에 남는 부분은 무엇인가요? 떠오르는 장면이나 생각 하나만 들려주세요.' }, placeholder: '예: 사람들이 나를 믿지 못할까 봐 계속 신경 쓰여요.' },
  { key: 'emotionNeed', track: '내 마음 돌보기', required: false, question: { mistake: '그 마음이 조금 편해지려면 지금 무엇이 필요할까요? 해결책이 아니어도 괜찮아요.' }, placeholder: '예: 잘하려고 했다는 것을 누군가 알아주면 좋겠어요.' },
  { key: 'emotionClosing', track: '내 말로 정리하기', required: false, question: { mistake: '이야기를 나눈 지금, 내 마음을 어떻게 정리하고 싶나요? 나에게 해주고 싶은 말을 남겨도 좋아요.' }, placeholder: '예: 아직 걱정되지만 한 번의 실수로 나를 판단하지 않으려고 해요.' },
];

const TASK_STEPS = [
  {
    key: 'unknown',
    track: '할 일 트랙',
    required: true,
    question: {
      mistake: '아직 확인하지 못한 것은 무엇인가요? 영향받은 사람이나 범위를 모르면 그대로 적어 주세요.',
      feedback: '아직 모르는 기준이나 확인하고 싶은 점은 무엇인가요?',
    },
    placeholder: '예: 이전 자료를 누가 사용했는지 확인해야 합니다.',
  },
  {
    key: 'improvement',
    track: '할 일 트랙',
    required: true,
    question: {
      mistake: '언제, 어떤 자료나 대상을 가지고 수습 행동을 시작할까요? 첫 행동 한 가지를 적어 주세요.',
      feedback: '다음 업무에서 시도하거나 확인해 볼 개선 행동 한 가지는 무엇인가요?',
    },
    placeholder: '예: 수정한 자료를 공유하고 사용 여부를 확인하기',
  },
  {
    key: 'followUp',
    track: '할 일 트랙',
    required: true,
    question: {
      mistake: '상사나 동료에게 보고하거나 물어볼 내용이 있나요? 필요 없다면 그 이유를 적어 주세요.',
      feedback: '상사나 동료에게 확인할 질문 또는 후속 보고 내용이 있나요?',
    },
    placeholder: '예: 우선 수정해야 할 부분을 알려주실 수 있나요?',
  },
  {
    key: 'checklist',
    track: '할 일 트랙',
    required: true,
    question: {
      mistake: '비슷한 업무를 다시 할 때 확인할 행동 한 가지를 정해 볼까요?',
      feedback: '비슷한 업무를 다시 할 때 확인하거나 물어볼 행동 한 가지를 정해 볼까요?',
    },
    placeholder: '예: 자료 공유 전 합계와 원본 수치를 대조하기',
  },
];

const START_STEP = {
  key: 'rawText',
  track: '시작',
  required: true,
  question: {
    mistake: '어떤 업무에서 실수를 알아챘나요? 먼저 있었던 일을 편하게 한두 문장으로 들려주세요.',
    feedback: '어떤 지적을 받았나요? 기억나는 말과 상황을 편하게 한두 문장으로 들려주세요.',
  },
  placeholder: '여기에 상황을 적어 주세요.',
};

const STEP_LABELS = {
  emotionFocus: '마음에 남는 부분', emotionNeed: '지금 필요한 것', emotionClosing: '나에게 남기는 말',
  rawText: '처음 적은 상황',
  facts: '직접 확인한 사실',
  interpretation: '내 해석',
  feeling: '내 감정',
  unknown: '아직 확인할 일',
  improvement: '개선 행동',
  followUp: '후속 질문과 보고',
  checklist: '다음 업무 체크리스트',
};

function questionFor(step, mode) {
  return step.question[mode] || step.question.mistake;
}

export default function GuidedChat({ mode = 'mistake', initialText = '', feelingsOnly = false, initialAnswers = {}, onFeelingsStart, onComplete, onCancel }) {
  const [phase, setPhase] = useState(initialText.trim() ? 'choice' : 'start');
  const [order, setOrder] = useState(null);
  const [completedAnswers, setCompletedAnswers] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => initialText.trim() ? { ...initialAnswers, rawText: initialText.trim() } : {});
  const [input, setInput] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [error, setError] = useState('');
  const [aiAvailable, setAiAvailable] = useState(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [adaptiveQuestion, setAdaptiveQuestion] = useState('');
  const [adaptiveTurns, setAdaptiveTurns] = useState([]);
  const [adaptiveSummary, setAdaptiveSummary] = useState({});
  const [failedRequest, setFailedRequest] = useState(null);
  const [closingMessage, setClosingMessage] = useState('');
  const requestRef = useRef(null);
  const transcriptRef = useRef(null);
  const inputRef = useRef(null);
  const activeRef = useRef(true);

  const steps = useMemo(() => {
    if (feelingsOnly) return [...EMOTION_STEPS, ...EMOTION_FOLLOWUPS];
    return order === 'tasks-first'
      ? [...TASK_STEPS, ...EMOTION_STEPS]
      : [...EMOTION_STEPS, ...TASK_STEPS];
  }, [order, feelingsOnly]);
  const currentStep = phase === 'start' ? START_STEP : phase === 'questions' ? steps[index] : null;
  const answerStep = editingKey
    ? [START_STEP, ...steps].find((step) => step.key === editingKey)
    : currentStep;
  const answeredSteps = phase === 'start' ? [] : phase === 'result-choice' && !adaptiveMode ? steps : steps.slice(0, index);
  const progressCount = phase === 'start' ? 0 : phase === 'choice' ? 1 : 1 + index;
  const totalQuestions = 1 + steps.length;

  useEffect(() => {
    let active = true;
    fetch('/api/status')
      .then((response) => response.ok ? response.json() : { available: false })
      .then((result) => { if (active) setAiAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setAiAvailable(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; requestRef.current?.abort(); };
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [phase, index, order, answers, editingKey, adaptiveQuestion, adaptiveTurns]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase, index, editingKey, adaptiveLoading]);

  function edit(key) {
    setEditingKey(key);
    setInput(answers[key] || '');
    setError('');
  }

  function finish(nextAnswers) {
    setCompletedAnswers({
      ...(feelingsOnly ? { emotionFocus: nextAnswers.emotionFocus || '', emotionNeed: nextAnswers.emotionNeed || '', emotionClosing: nextAnswers.emotionClosing || '' } : {}),
      rawText: nextAnswers.rawText || '',
      facts: nextAnswers.facts || '',
      interpretation: nextAnswers.interpretation || '',
      feeling: nextAnswers.feeling || '',
      unknown: nextAnswers.unknown || '',
      improvement: nextAnswers.improvement || '',
      followUp: nextAnswers.followUp || '',
      checklist: nextAnswers.checklist || '',
    });
    setPhase('result-choice');
  }

  async function requestAdaptive(turns, selectedOrder, finishNow = false) {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 50000);
    setAdaptiveLoading(true);
    setFailedRequest(null);
    setError('');
    try {
      const response = await fetch('/api/chat-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          consent: true,
          preferredTrack: feelingsOnly ? 'feelings' : selectedOrder === 'tasks-first' ? 'tasks' : null,
          finishNow,
          turns,
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!activeRef.current) return;
      if (!response.ok) throw new Error(result.error || '질문을 불러오지 못했습니다.');
      setAdaptiveSummary(result.summary || {});
      if (result.done) {
        setClosingMessage(result.empathy || '');
        setCompletedAnswers({ rawText: answers.rawText || '', ...result.summary, source: 'ai' });
        setPhase('result-choice');
      } else if (typeof result.question === 'string' && result.question.trim()) {
        setAdaptiveQuestion([result.empathy, result.question.trim()].filter(Boolean).join('\n\n'));
      } else {
        throw new Error('다음 질문이 비어 있습니다.');
      }
    } catch (error) {
      if (!activeRef.current) return;
      setFailedRequest({ turns, selectedOrder, finishNow });
      setError(error.name === 'AbortError' ? '응답이 지연되고 있어요. 답변은 남아 있으니 다시 시도해 주세요.' : error.message || 'AI 연결에 실패했어요. 답변은 그대로 남아 있어요.');
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      if (activeRef.current) setAdaptiveLoading(false);
    }
  }

  function sendAdaptive(finishNow = false) {
    if (adaptiveLoading || failedRequest || requestRef.current) return;
    const value = input.trim();
    if (!value && !finishNow) { setError('답변을 적어 주세요.'); return; }
    const nextTurns = value ? [...adaptiveTurns, { role: 'assistant', content: adaptiveQuestion }, { role: 'user', content: value }] : adaptiveTurns;
    setAdaptiveTurns(nextTurns);
    setAdaptiveQuestion('');
    setInput('');
    requestAdaptive(nextTurns, order, finishNow || (feelingsOnly && nextTurns.length >= 78));
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (adaptiveLoading) return;
    if (adaptiveMode && phase === 'adaptive' && !editingKey) {
      sendAdaptive();
      return;
    }
    if (!answerStep) return;
    const value = input.trim();
    if (answerStep.required && !value) {
      setError('이 질문에는 답을 적어 주세요.');
      return;
    }
    const clarification = clarificationFor(answerStep.key, value);
    if (clarification) {
      setError(clarification);
      return;
    }
    const nextAnswers = { ...answers, [answerStep.key]: value };
    setAnswers(nextAnswers);
    setInput('');
    setError('');
    if (editingKey) {
      if (phase === 'result-choice') setCompletedAnswers((current) => ({ ...current, [editingKey]: value }));
      setEditingKey(null);
      return;
    }
    if (phase === 'start') {
      setPhase('choice');
      return;
    }
    if (index === steps.length - 1) {
      finish(nextAnswers);
    } else {
      setIndex(index + 1);
    }
  }

  function chooseOrder(value) {
    setOrder(value);
    setError('');
    if (aiAvailable && aiConsent) {
      const initialTurns = [
        { role: 'assistant', content: questionFor(START_STEP, mode) },
        { role: 'user', content: (answers.rawText || '').slice(0, 1000) },
      ];
      if (feelingsOnly) {
        for (const key of ['interpretation', 'feeling', 'emotionFocus', 'emotionNeed', 'emotionClosing']) {
          if (typeof answers[key] === 'string' && answers[key].trim()) initialTurns.push({ role: 'user', content: `${STEP_LABELS[key]}: ${answers[key]}`.slice(0, 1000) });
        }
      }
      setAdaptiveMode(true);
      setAdaptiveTurns(initialTurns);
      setAdaptiveQuestion('');
      setPhase('adaptive');
      requestAdaptive(initialTurns, value);
    } else {
      setPhase('questions');
      setIndex(0);
    }
  }

  function answerBubble(step) {
    const value = answers[step.key];
    return (
      <div className="chat-message chat-user" key={step.key + '-answer'}>
        <div className="chat-bubble">{value || '건너뛰었어요.'}</div>
        {!adaptiveMode && <button className="chat-skip" type="button" onClick={() => edit(step.key)} aria-label={`${STEP_LABELS[step.key]} 답변 수정`}>수정</button>}
      </div>
    );
  }

  function questionBubble(step, key) {
    return <div className="chat-message chat-assistant" key={key}><div className="chat-bubble"><small>{step.track}</small><p>{questionFor(step, mode)}</p></div></div>;
  }

  return (
    <section className="chat-shell" aria-labelledby="chat-title">
      <header className="chat-header">
        <div>
          <p className="eyebrow">질문으로 경험 구체화하기</p>
          <h1 id="chat-title">{feelingsOnly ? '지금 마음을 조금 더 이야기해 볼까요?' : mode === 'mistake' ? '실수를 함께 정리해 볼까요?' : '지적받은 경험을 함께 정리해 볼까요?'}</h1>
          <p>한 번에 한 질문씩 답해 주세요. {feelingsOnly ? 'AI가 이야기에 귀 기울이며 공감과 질문을 이어가요. 원할 때 여기까지 정리할 수 있어요.' : aiAvailable ? '동의하면 AI가 다음 질문을 고릅니다. 사실 여부는 사용자가 확인합니다.' : 'AI 키가 없으면 준비된 가이드 질문으로 진행합니다.'}</p>
        </div>
        <button type="button" className="button-secondary" onClick={onCancel}>나가기</button>
      </header>
      <div className="chat-progress">
        {phase === 'result-choice' ? <div className="chat-progress-copy"><strong>대화 완료</strong><span>먼저 볼 결과를 선택해 주세요.</span></div> : adaptiveMode ? <div className="chat-progress-copy"><strong>맞춤 질문 진행 중</strong><span>{feelingsOnly ? '내 답변에 맞춰 마음을 함께 들여다봐요.' : '사실과 실행할 행동, 후속 보고가 구체화될 때까지 함께 질문합니다.'}</span></div> : <>
          <div className="chat-progress-copy"><strong>{phase === 'choice' ? '첫 답변 완료' : `질문 ${Math.min(progressCount + 1, totalQuestions)} / ${totalQuestions}`}</strong><span>{phase === 'choice' ? '대화 시작 준비' : phase === 'start' ? '경험 들려주기' : currentStep?.track}</span></div>
          <div className="chat-progress-track" role="progressbar" aria-label="답변 완료" aria-valuemin="0" aria-valuemax={totalQuestions} aria-valuenow={progressCount}>
            <span style={{ width: `${progressCount / totalQuestions * 100}%` }} />
          </div>
        </>}
      </div>
      <div className="chat-transcript" ref={transcriptRef} role="log" aria-label="경험 정리 대화" aria-live="polite" aria-relevant="additions text">
        {questionBubble(START_STEP, 'start-question')}
        {answers.rawText && answerBubble(START_STEP)}
        {answeredSteps.map((step) => [questionBubble(step, step.key + '-question'), answerBubble(step)])}
        {phase === 'questions' && currentStep && questionBubble(currentStep, currentStep.key + '-current')}
        {adaptiveTurns.slice(2).map((turn, turnIndex) => (
          <div className={turn.role === 'user' ? 'chat-message chat-user' : 'chat-message chat-assistant'} key={'adaptive-' + turnIndex}>
            <div className="chat-bubble">{turn.content}</div>
          </div>
        ))}
        {phase === 'adaptive' && (adaptiveQuestion || adaptiveLoading) && (
          <div className="chat-message chat-assistant"><div className="chat-bubble"><small>다음 질문</small><p>{adaptiveLoading ? '답변을 살펴보는 중…' : adaptiveQuestion}</p></div></div>
        )}
        {phase === 'result-choice' && (
          <>
            <div className="chat-message chat-assistant"><div className="chat-bubble"><small>정리 완료</small><p>{closingMessage || (feelingsOnly ? '이야기해 줘서 고마워요. 내 말로 정리한 마음을 확인하고 저장해 주세요.' : '이야기를 모두 정리했어요. 어떤 결과부터 살펴볼까요? 두 트랙 모두 남아 있어요.')}</p></div></div>

          </>
        )}
      </div>

      {phase === 'choice' && !editingKey ? (
        <div className="chat-actions" role="group" aria-label="대화 시작">
          {aiAvailable === null && <p role="status">AI 연결 확인 중…</p>}
          {aiAvailable === false && <p role="status">지금은 AI 대화를 연결할 수 없어요. 가이드 질문으로 정리할 수 있습니다.</p>}
          {aiAvailable && <label className="consent-label"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />동의하면 현재 상황과 이전 감정 기록, 이후 답변을 Anthropic의 AI에 보내 맞춤 질문을 받습니다. 동의하지 않으면 준비된 가이드 질문으로 진행합니다.</label>}
          {!feelingsOnly && onFeelingsStart && <button className="chat-choice" type="button" onClick={() => onFeelingsStart(answers.rawText)}><strong>감정부터 이야기하기</strong><span>할 일을 정하지 않아도 마음만 차근차근 정리할 수 있어요</span></button>}
          <button className="chat-choice" type="button" onClick={() => chooseOrder(null)} disabled={aiAvailable === null}><strong>{feelingsOnly ? aiAvailable && aiConsent ? 'AI와 마음 이야기하기' : '가이드 질문으로 정리하기' : '이어서 이야기하기'}</strong><span>{feelingsOnly ? 'AI 대화는 위 전송 동의 후 시작할 수 있어요' : '질문에 답하고 마지막에 보고 싶은 결과를 골라요'}</span></button>
        </div>
      ) : phase === 'result-choice' && !editingKey ? (
        <div className="chat-actions" role="group" aria-label="먼저 볼 결과 선택">
          <button className="chat-choice" type="button" onClick={() => onComplete?.(completedAnswers, 'feelings')}><strong>{feelingsOnly ? '대화한 마음 정리 확인' : '마음 정리 먼저 보기'}</strong><span>사실 · 해석 · 감정</span></button>
          {!feelingsOnly && <button className="chat-choice" type="button" onClick={() => onComplete?.(completedAnswers, 'tasks')}><strong>할 일 먼저 보기</strong><span>개선 행동 · 후속 보고 · 체크리스트</span></button>}
        </div>
      ) : (
        <form className="chat-composer" onSubmit={submitAnswer}>
          <label className="visually-hidden" htmlFor="chat-answer">{editingKey ? '이전 답변 수정' : adaptiveMode ? adaptiveQuestion || '다음 질문 답변' : questionFor(answerStep || START_STEP, mode)}</label>
          {editingKey && <p className="field-help">이전 답변을 수정하고 있어요. 이후 답변은 유지됩니다.</p>}
          <textarea id="chat-answer" ref={inputRef} className="chat-input" value={input} onChange={(event) => { setInput(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows="2" maxLength="1000" disabled={adaptiveLoading || Boolean(failedRequest)} placeholder={adaptiveMode ? '질문에 답해 주세요.' : answerStep?.placeholder || START_STEP.placeholder} />
          {error && <p className="alert" role="alert">{error}</p>}
          {failedRequest && <div className="chat-actions"><button type="button" className="button-primary" onClick={() => requestAdaptive(failedRequest.turns, failedRequest.selectedOrder, failedRequest.finishNow)}>다시 시도하기</button><button type="button" className="button-secondary" onClick={() => { setAnswers((current) => ({ ...current, ...adaptiveSummary })); setAdaptiveMode(false); setFailedRequest(null); setPhase('questions'); setIndex(0); setError('AI 대화가 아닌 가이드 질문으로 이어갑니다. 위 대화 내용은 그대로 남아 있어요.'); }}>가이드 질문으로 계속하기</button></div>}
          <div className="chat-actions">
            <span className="field-help">Enter로 답변 · Shift+Enter로 줄바꿈</span>
            {!editingKey && answerStep && !answerStep.required && <button className="chat-skip" type="button" onClick={() => { const next = { ...answers, [answerStep.key]: '' }; setAnswers(next); setInput(''); if (index === steps.length - 1) finish(next); else setIndex(index + 1); }}>건너뛰기</button>}
            {editingKey && <button className="button-secondary" type="button" onClick={() => { setEditingKey(null); setInput(''); setError(''); }}>수정 취소</button>}
            {feelingsOnly && adaptiveMode && !failedRequest && <button className="button-secondary" type="button" disabled={adaptiveLoading} onClick={() => sendAdaptive(true)}>여기까지 정리하기</button>}
            <button className="button-primary" type="submit" disabled={adaptiveLoading || Boolean(failedRequest)}>{adaptiveLoading ? '다음 질문 준비 중…' : editingKey ? '수정 완료' : index === steps.length - 1 && phase === 'questions' ? '정리 결과 확인하기' : '답변 보내기'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

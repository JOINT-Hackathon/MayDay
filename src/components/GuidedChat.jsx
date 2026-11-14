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

const TASK_STEPS = [
  {
    key: 'unknown',
    track: '할 일 트랙',
    required: false,
    question: {
      mistake: '아직 확인하지 못한 것은 무엇인가요? 영향받은 사람이나 범위를 모르면 그대로 적어 주세요.',
      feedback: '아직 모르는 기준이나 확인하고 싶은 점은 무엇인가요?',
    },
    placeholder: '예: 이전 자료를 누가 사용했는지 확인해야 합니다.',
  },
  {
    key: 'improvement',
    track: '할 일 트랙',
    required: false,
    question: {
      mistake: '지금 할 수 있는 수습이나 개선 행동 한 가지는 무엇인가요?',
      feedback: '다음 업무에서 시도하거나 확인해 볼 개선 행동 한 가지는 무엇인가요?',
    },
    placeholder: '예: 수정한 자료를 공유하고 사용 여부를 확인하기',
  },
  {
    key: 'followUp',
    track: '할 일 트랙',
    required: false,
    question: {
      mistake: '상사나 동료에게 보고하거나 물어볼 내용이 있나요? 없다면 건너뛰어도 됩니다.',
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

function questionFor(step, mode) {
  return step.question[mode] || step.question.mistake;
}

export default function GuidedChat({ mode = 'mistake', onComplete, onCancel }) {
  const [phase, setPhase] = useState('start');
  const [order, setOrder] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [error, setError] = useState('');
  const transcriptRef = useRef(null);
  const inputRef = useRef(null);

  const steps = useMemo(() => {
    return order === 'tasks-first'
      ? [...TASK_STEPS, ...EMOTION_STEPS]
      : [...EMOTION_STEPS, ...TASK_STEPS];
  }, [order]);
  const currentStep = phase === 'start' ? START_STEP : phase === 'questions' ? steps[index] : null;
  const answerStep = editingKey
    ? [START_STEP, ...steps].find((step) => step.key === editingKey)
    : currentStep;
  const answeredSteps = phase === 'start' ? [] : steps.slice(0, index);
  const progressCount = phase === 'start' ? 0 : phase === 'choice' ? 1 : 1 + index;
  const totalQuestions = 1 + EMOTION_STEPS.length + TASK_STEPS.length;

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [phase, index, order, answers, editingKey]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase, index, editingKey]);

  function edit(key) {
    setEditingKey(key);
    setInput(answers[key] || '');
    setError('');
  }

  function finish(nextAnswers) {
    onComplete?.({
      rawText: nextAnswers.rawText || '',
      facts: nextAnswers.facts || '',
      interpretation: nextAnswers.interpretation || '',
      feeling: nextAnswers.feeling || '',
      unknown: nextAnswers.unknown || '',
      improvement: nextAnswers.improvement || '',
      followUp: nextAnswers.followUp || '',
      checklist: nextAnswers.checklist || '',
    });
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!answerStep) return;
    const value = input.trim();
    if (answerStep.required && !value) {
      setError('이 질문에는 답을 적어 주세요.');
      return;
    }
    const nextAnswers = { ...answers, [answerStep.key]: value };
    setAnswers(nextAnswers);
    setInput('');
    setError('');
    if (editingKey) {
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
    setPhase('questions');
    setIndex(0);
    setError('');
  }

  function answerBubble(step) {
    const value = answers[step.key];
    return (
      <div className="chat-message chat-user" key={step.key + '-answer'}>
        <div className="chat-bubble">{value || '건너뛰었어요.'}</div>
        <button className="chat-skip" type="button" onClick={() => edit(step.key)} aria-label={step.track + ' 답변 수정'}>수정</button>
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
          <h1 id="chat-title">{mode === 'mistake' ? '실수를 함께 정리해 볼까요?' : '지적받은 경험을 함께 정리해 볼까요?'}</h1>
          <p>한 번에 한 질문씩 답해 주세요. 이 질문은 미리 정해진 가이드이며 AI가 사실을 판정하지 않습니다.</p>
        </div>
        <button type="button" className="button-secondary" onClick={onCancel}>나가기</button>
      </header>
      <div className="chat-progress" role="progressbar" aria-label="질문 진행" aria-valuemin="0" aria-valuemax={totalQuestions} aria-valuenow={progressCount}>
        질문 {Math.min(progressCount + 1, totalQuestions)} / {totalQuestions}
      </div>
      <div className="chat-transcript" ref={transcriptRef} aria-label="경험 정리 대화">
        {questionBubble(START_STEP, 'start-question')}
        {answers.rawText && answerBubble(START_STEP)}
        {phase !== 'start' && (
          <>
            <div className="chat-message chat-assistant"><div className="chat-bubble"><small>진행 순서</small><p>감정과 할 일을 모두 정리할 거예요. 어느 쪽부터 시작할까요?</p></div></div>
            {order && <div className="chat-message chat-user"><div className="chat-bubble">{order === 'feelings-first' ? '감정 트랙부터' : '할 일 트랙부터'}</div></div>}
          </>
        )}
        {answeredSteps.map((step) => [questionBubble(step, step.key + '-question'), answerBubble(step)])}
        {phase === 'questions' && currentStep && questionBubble(currentStep, currentStep.key + '-current')}
      </div>

      {phase === 'choice' && !editingKey ? (
        <div className="chat-actions" role="group" aria-label="트랙 시작 순서">
          <button className="chat-choice" type="button" onClick={() => chooseOrder('feelings-first')}><strong>감정부터 정리하기</strong><span>사실 · 해석 · 감정</span></button>
          <button className="chat-choice" type="button" onClick={() => chooseOrder('tasks-first')}><strong>할 일부터 정리하기</strong><span>확인할 일 · 개선 · 후속 보고</span></button>
        </div>
      ) : (
        <form className="chat-composer" onSubmit={submitAnswer}>
          <label className="visually-hidden" htmlFor="chat-answer">{editingKey ? '이전 답변 수정' : questionFor(answerStep || START_STEP, mode)}</label>
          {editingKey && <p className="field-help">이전 답변을 수정하고 있어요. 이후 답변은 유지됩니다.</p>}
          <textarea id="chat-answer" ref={inputRef} className="chat-input" value={input} onChange={(event) => { setInput(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows="2" maxLength="1200" placeholder={answerStep?.placeholder || START_STEP.placeholder} />
          {error && <p className="alert" role="alert">{error}</p>}
          <div className="chat-actions">
            <span className="field-help">Enter로 답변 · Shift+Enter로 줄바꿈</span>
            {!editingKey && answerStep && !answerStep.required && <button className="chat-skip" type="button" onClick={() => { const next = { ...answers, [answerStep.key]: '' }; setAnswers(next); setInput(''); if (index === steps.length - 1) finish(next); else setIndex(index + 1); }}>건너뛰기</button>}
            {editingKey && <button className="button-secondary" type="button" onClick={() => { setEditingKey(null); setInput(''); setError(''); }}>수정 취소</button>}
            <button className="button-primary" type="submit">{editingKey ? '수정 완료' : index === steps.length - 1 && phase === 'questions' ? '정리 결과 확인하기' : '답변 보내기'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

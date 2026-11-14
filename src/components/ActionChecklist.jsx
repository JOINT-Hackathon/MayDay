import { useState } from 'react';
import Icon from './Icon.jsx';

const STEP_FIELDS = [
  ['checklist', '다음 업무 체크리스트'],
  ['unknown', '아직 확인할 일'],
  ['improvement', '개선 행동'],
  ['followUp', '후속 질문·보고'],
];

export default function ActionChecklist({ record, onToggle }) {
  const [expanded, setExpanded] = useState(true);
  const steps = STEP_FIELDS.filter(([key]) => record[key]?.trim());
  const checked = Array.isArray(record.actionChecked) ? record.actionChecked : [];
  const completed = steps.filter(([key]) => checked.includes(key)).length;

  return (
    <section className={`action-checklist${expanded ? ' is-expanded' : ''}`} aria-labelledby="action-checklist-title">
      <div className="action-checklist-heading">
        <span className="feature-icon feature-icon-clay"><Icon name="zap" variant="clay" size={44} /></span>
        <div>
          <h2 id="action-checklist-title">지금 할 일 순서</h2>
          <p>뭐부터 하면 될지 순서대로 알려줄게요</p>
        </div>
        <button type="button" className="checklist-switch" role="switch" aria-checked={expanded} aria-label="할 일 체크리스트 펼치기" onClick={() => setExpanded((current) => !current)}><span /></button>
      </div>
      {expanded && (
        <>
          <div className="action-progress"><div className="action-progress-track" role="progressbar" aria-label="할 일 완료율" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={steps.length}><span style={{ width: `${steps.length ? completed / steps.length * 100 : 0}%` }} /></div><span>{steps.length}개 중 {completed}개 했어요</span></div>
          <div className="action-step-list">
            {steps.map(([key, label], index) => (
              <label className="action-step" key={key}>
                <input type="checkbox" checked={checked.includes(key)} onChange={() => onToggle(key)} />
                <span><strong>{index + 1}. {record[key]}</strong></span>
              </label>
            ))}
          </div>
          <p className="action-checklist-note">하나씩만 해봐요. 체크한 일은 저장해서 이어갈 수 있어요.</p>
        </>
      )}
    </section>
  );
}

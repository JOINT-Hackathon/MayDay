import { useState } from 'react';
import ActionChecklist from './ActionChecklist.jsx';
import Icon from './Icon.jsx';

export default function AnalysisAddons({ record, onToggleStep, addon, addonVisible, addonDraft, emailTone, onToggleAddon, onEditDraft, onToneChange, onCopy, onDownload, onSaveChecklist, onSaveRecord }) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareDraft, setShareDraft] = useState(record.checklist || '');
  const [shareNotice, setShareNotice] = useState('');
  async function copyShareDraft() {
    try {
      await navigator.clipboard.writeText(shareDraft);
      setShareNotice('공유 초안을 복사했어요. 원하는 곳에 직접 붙여넣어 주세요.');
    } catch {
      setShareNotice('자동 복사가 어려워요. 위의 내용을 직접 선택해 복사해 주세요.');
    }
  }
  return <div className="analysis-addons">
    <ActionChecklist record={record} onToggle={onToggleStep} />
    {[
      ['blackbox', 'archive', '왜 그랬는지 돌아보기', '무슨 일이 있었고, 왜 생겼는지 차근차근 짚어봐요'],
      ['email', 'mail', '팀장님께 보낼 메일', '체크리스트에서 한 일에 맞춰 메일을 만들어요'],
    ].map(([type, icon, title, description]) => {
      const open = addonVisible && addon === type;
      return <section className={`feature-panel${open ? ' is-open' : ''}`} key={type}>
        <button className="feature-toggle" type="button" aria-expanded={open} aria-controls={`feature-${type}`} onClick={() => { setEditing(false); onToggleAddon(type); }}>
          <span className="feature-icon feature-icon-clay"><Icon name={icon} variant="clay" size={44} /></span><span className="feature-heading"><strong>{title}</strong><small>{description}</small></span><span className={`toggle-indicator${open ? ' is-on' : ''}`} aria-hidden="true"><i /></span>
        </button>
        {open && <div id={`feature-${type}`} className="feature-body">
          {editing ? <><label className="visually-hidden" htmlFor={`draft-${type}`}>{title} 초안 편집</label><textarea id={`draft-${type}`} className="addon-editor" value={addonDraft} onChange={(event) => onEditDraft(event.target.value)} rows={10} maxLength={6000} /></>
            : type === 'blackbox' && typeof record.addonDrafts?.blackbox !== 'string' ? <div className="blackbox-sections">
              {[
                ['무슨 일이 있었나', record.facts],
                ['왜 그랬을까', record.cause || '원인은 아직 확인되지 않았어요. 당시 확인 과정부터 돌아보세요.'],
                ['얼마나 큰 일일까', record.impact || '영향 범위를 먼저 확인해 주세요.'],
                ['다음엔 이렇게', record.checklist],
              ].map(([label, content], i) => <div className="blackbox-section" key={label}><h3><span>{i + 1}</span>{label}{label === '왜 그랬을까' && record.causeStatus === 'hypothesis' && <small>추정</small>}</h3>{i === 3 ? <div className="prevention-preview">{content.split('\n').filter(Boolean).map((line, index) => <p key={index}><span className="prevention-check"><Icon name="check" size={12} /></span>{line}</p>)}<small>체크리스트에 담아 다음에 꺼내봐요</small></div> : <p>{content}</p>}{i === 1 && <aside className="cause-reframe"><small>나를 탓하기 전에, 확인 과정을 돌아봐요</small><p>내 탓보다는, 실수를 잡아줄 장치가 있었는지 같이 봐요.</p></aside>}</div>)}
            </div> : <p className="mail-preview">{addonDraft}</p>}
          {type === 'blackbox' && <div className="feature-actions"><button className="mini-button" type="button" aria-expanded={sharing} onClick={() => setSharing(!sharing)}><Icon name="share" />익명으로 경험 나누기</button></div>}
          {type === 'blackbox' && sharing && <div className="share-preview"><label htmlFor="share-draft">공유 초안 · 자동으로 게시되지 않아요</label><p>다음에 확인할 행동만 담았어요. 이름이나 회사 정보가 없는지 확인해 주세요.</p><textarea id="share-draft" value={shareDraft} onChange={(event) => setShareDraft(event.target.value)} maxLength={1200} rows={3} /><button className="mini-button" type="button" onClick={copyShareDraft}><Icon name="copy" />공유할 내용 복사</button>{shareNotice && <p role="status">{shareNotice}</p>}</div>}
          <details className="report-tools" open={type === 'email' || editing || undefined}><summary>초안 수정 · 저장</summary><div className="feature-actions">
            {type === 'email' && <div className="email-tone" role="group" aria-label="메일 톤 선택"><button type="button" aria-pressed={emailTone === 'formal'} onClick={() => onToneChange('formal')}>정중하게</button><button type="button" aria-pressed={emailTone === 'casual'} onClick={() => onToneChange('casual')}>부드럽게</button></div>}
            <button className="mini-button" type="button" onClick={() => setEditing(!editing)}><Icon name={editing ? 'check' : 'edit'} />{editing ? '완료' : '수정하기'}</button>
            <button className="mini-button" type="button" onClick={onCopy}><Icon name="copy" />복사하기</button>
            <button className="mini-button" type="button" onClick={onDownload} aria-label={`${title} 텍스트 파일 다운로드`}>파일 받기</button>
          </div>
          {type === 'blackbox' && <button className="text-button save-report" type="button" onClick={onSaveRecord}><Icon name="archive" /> 내 기록에 보고서 저장</button>}
          </details>
          <p className="draft-caption">초안이에요. 실제 내용에 맞게 확인한 뒤 사용해 주세요.</p>
        </div>}
      </section>;
    })}
    <button className="button-primary track-cta" type="button" onClick={onSaveChecklist}><Icon name="shield" size={20} /> 체크리스트에 담기</button>
  </div>;
}

import { useState } from 'react';
import './ClayIcon.css';

const clayAssets = Object.fromEntries(
  ['zap', 'archive', 'mail', 'shield', 'heart'].map((name) => [name, `/icons/clay-v2/${name}.webp`]),
);

const paths = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8Z" /><path d="m2 12 10 5 10-5M2 16l10 5 10-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  send: <><path d="m21 3-7 18-4-8-8-4Z" /><path d="m10 13 11-10" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 2M18 18A8 8 0 0 1 5 16" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  zap: <path d="m13 2-9 12h7l-1 8 10-12h-7Z" />,
  archive: <><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v13h14V8M10 12h4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  edit: <><path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5" /></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m9 10 6-3M9 14l6 3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
};

export default function Icon({ name, size = 16, className = '', variant = 'line' }) {
  const [failedAsset, setFailedAsset] = useState(null);
  const asset = variant === 'clay' ? clayAssets[name] : null;

  if (asset && failedAsset !== asset) {
    return (
      <span className={`icon clay-icon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
        <img src={asset} width={size} height={size} alt="" decoding="async" draggable={false} onError={() => setFailedAsset(asset)} />
        <svg className="clay-icon-contrast" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">{paths[name]}</svg>
      </span>
    );
  }

  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.check}</svg>;
}

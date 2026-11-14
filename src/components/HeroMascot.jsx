import { useEffect, useId, useRef, useState } from 'react';
import './HeroMascot.css';

export default function HeroMascot({ className = '' }) {
  const hostRef = useRef(null);
  const bodyRef = useRef(null);
  const gazeRef = useRef(null);
  const gradientId = useId();
  const [baseReady, setBaseReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const bodyElement = bodyRef.current;
    const gazeElement = gazeRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const target = { x: 0, y: 0 };
    const body = { x: 0, y: 0 };
    const eyes = { x: 0, y: 0 };
    let inView = true;
    let disposed = false;
    let frame = 0;
    let previousTime = 0;
    const isActive = () => !disposed && !document.hidden && inView && !reduced.matches;
    const distance = () => Math.abs(target.x - body.x) + Math.abs(target.y - body.y)
      + Math.abs(target.x - eyes.x) + Math.abs(target.y - eyes.y);

    function paint() {
      bodyElement.style.setProperty('--body-x', (body.x * 4).toFixed(3) + 'px');
      bodyElement.style.setProperty('--body-y', (body.y * 2).toFixed(3) + 'px');
      bodyElement.style.setProperty('--body-yaw', (body.x * 5).toFixed(3) + 'deg');
      bodyElement.style.setProperty('--body-pitch', (-body.y * 3).toFixed(3) + 'deg');
      bodyElement.style.setProperty('--body-roll', (body.x * 1.5).toFixed(3) + 'deg');
      gazeElement.setAttribute('transform', 'translate(' + (eyes.x * 20).toFixed(3) + ' ' + (eyes.y * 14).toFixed(3) + ')');
    }

    function animate(now) {
      frame = 0;
      if (!isActive()) return;
      const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
      previousTime = now;
      const bodyBlend = 1 - Math.exp(-6 * delta);
      const eyeBlend = 1 - Math.exp(-14 * delta);
      body.x += (target.x - body.x) * bodyBlend;
      body.y += (target.y - body.y) * bodyBlend;
      eyes.x += (target.x - eyes.x) * eyeBlend;
      eyes.y += (target.y - eyes.y) * eyeBlend;
      if (distance() < 0.001) {
        body.x = eyes.x = target.x;
        body.y = eyes.y = target.y;
      }
      paint();
      if (distance() > 0) frame = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (!frame && isActive() && distance() > 0) {
        previousTime = 0;
        frame = window.requestAnimationFrame(animate);
      }
    }

    function reset() {
      target.x = target.y = 0;
      startAnimation();
    }

    function onPointerMove(event) {
      if (!isActive() || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = host.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / Math.max(window.innerWidth * 0.32, 180)));
      target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / Math.max(window.innerHeight * 0.32, 160)));
      startAnimation();
    }

    function syncActivity() {
      host.dataset.paused = String(!isActive());
      window.cancelAnimationFrame(frame);
      frame = 0;
      target.x = target.y = 0;
      if (reduced.matches) {
        body.x = body.y = eyes.x = eyes.y = 0;
        paint();
      }
      startAnimation();
    }

    function onPointerOut(event) { if (!event.relatedTarget) reset(); }
    const observer = new IntersectionObserver(([entry]) => {
      if (inView === entry.isIntersecting) return;
      inView = entry.isIntersecting;
      syncActivity();
    });
    observer.observe(host);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', syncActivity);
    reduced.addEventListener('change', syncActivity);
    finePointer.addEventListener('change', syncActivity);
    syncActivity();

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', syncActivity);
      reduced.removeEventListener('change', syncActivity);
      finePointer.removeEventListener('change', syncActivity);
    };
  }, []);

  return (
    <div className={`hero-mascot ${className}`} ref={hostRef} aria-hidden="true" data-renderer="layered-image" data-ready={baseReady}>
      <div className="mascot-layered-stage">
        <div className="mascot-layered-body" ref={bodyRef}>
          <div className="mascot-layered-breathe">
            <img className="mascot-layered-fallback" src="/mascot/mayday-center.png" alt="" width="1254" height="1254" draggable="false" />
            <img className="mascot-layered-base" src="/mascot/mayday-face-base.png" alt="" width="1254" height="1254" draggable="false"
              onLoad={() => setBaseReady(true)} onError={() => setBaseReady(false)} />
            <svg className="mascot-layered-face" viewBox="0 0 1254 1254" focusable="false">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#285c3c" />
                  <stop offset="1" stopColor="#173d29" />
                </linearGradient>
              </defs>
              <g ref={gazeRef} transform="translate(0 0)" fill={'url(#' + gradientId + ')'}>
                <g transform="translate(480 482)"><ellipse className="mascot-live-eye" rx="15" ry="25" /></g>
                <g transform="translate(672 486)"><ellipse className="mascot-live-eye" rx="16" ry="25" /></g>
                <path className="mascot-live-mouth" d="M552 558 Q576 576 600 558" fill="none" stroke="#59963c" strokeWidth="6" strokeLinecap="round" opacity="0.42" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

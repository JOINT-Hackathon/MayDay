import { useEffect, useRef } from 'react';
import './PastelCursor.css';

export default function PastelCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const element = cursorRef.current;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    let visible = false;
    let frame = 0;

    const enabled = () => finePointer.matches && !reducedMotion.matches && !document.hidden;
    const paint = () => {
      element.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%)`;
    };

    function hide() {
      visible = false;
      element.dataset.visible = 'false';
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function animate() {
      frame = 0;
      if (!visible || !enabled()) { hide(); return; }
      // Keep the light centered on the pointer; coalesce moves into one paint.
      paint();
    }

    function onPointerMove(event) {
      if (event.pointerType !== 'mouse' || !enabled()) { hide(); return; }
      target.x = event.clientX;
      target.y = event.clientY;
      if (!visible) {
        paint();
        visible = true;
        element.dataset.visible = 'true';
        return;
      }
      if (!frame) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    function onPointerOut(event) { if (!event.relatedTarget) hide(); }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    finePointer.addEventListener('change', hide);
    reducedMotion.addEventListener('change', hide);

    return () => {
      hide();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
      finePointer.removeEventListener('change', hide);
      reducedMotion.removeEventListener('change', hide);
    };
  }, []);

  return <div ref={cursorRef} className="pastel-cursor" data-visible="false" aria-hidden="true" />;
}

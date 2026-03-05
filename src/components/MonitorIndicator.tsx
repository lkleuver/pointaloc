'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface MonitorIndicatorProps {
  readonly onRotationChange: (angle: number) => void;
}

export default function MonitorIndicator({ onRotationChange }: MonitorIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const draggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const [hintVisible, setHintVisible] = useState(true);

  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const applyRotation = useCallback((deg: number) => {
    const el = ref.current;
    if (!el) return;
    rotationRef.current = deg;
    el.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    onRotationChange(deg);
  }, [onRotationChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      startAngleRef.current = getAngleFromCenter(e.clientX, e.clientY);
      startRotationRef.current = rotationRef.current;
      el.setPointerCapture(e.pointerId);
      setHintVisible(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
      const delta = currentAngle - startAngleRef.current;
      applyRotation(startRotationRef.current + delta);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [getAngleFromCenter, applyRotation]);

  return (
    <>
      <div
        ref={ref}
        className="pointer-events-auto absolute left-1/2 top-1/2 z-10"
        style={{
          transform: 'translate(-50%, -50%) rotate(0deg)',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        {/* Light rays emanating from screen direction */}
        <div className="absolute left-1/2 -translate-x-1/2 animate-[lightPulse_2.5s_ease-in-out_infinite]"
          style={{ bottom: '100%', marginBottom: '-2px' }}
        >
          <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
            <defs>
              <linearGradient id="ray-grad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Central ray */}
            <polygon points="55,80 85,80 95,0 45,0" fill="url(#ray-grad)" />
            {/* Left ray */}
            <polygon points="45,80 60,80 30,5 10,15" fill="url(#ray-grad)" opacity="0.6" />
            {/* Right ray */}
            <polygon points="80,80 95,80 110,15 130,5" fill="url(#ray-grad)" opacity="0.6" />
          </svg>
        </div>

        <svg width="110" height="90" viewBox="0 0 110 90">
          <defs>
            <linearGradient id="panel-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <filter id="screen-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Stand base — oval, behind the panel */}
          <ellipse cx="55" cy="76" rx="18" ry="8" fill="#475569" stroke="#334155" strokeWidth="1" />
          {/* Stand arm — connects base to panel */}
          <rect x="51" y="56" width="8" height="22" rx="2" fill="#475569" stroke="#334155" strokeWidth="0.8" />

          {/* Monitor panel — thin wide slab seen from above */}
          {/* Back edge (thicker, darker) */}
          <rect x="5" y="42" width="100" height="16" rx="2"
            fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          {/* Top surface of the panel */}
          <rect x="7" y="40" width="96" height="14" rx="1.5"
            fill="url(#panel-top)" stroke="#475569" strokeWidth="0.5" />
          {/* Front screen edge — the thin bright edge visible from above */}
          <rect x="7" y="38" width="96" height="4" rx="1"
            fill="#94a3b8" stroke="#64748b" strokeWidth="0.5"
            filter="url(#screen-glow)" />
          {/* Screen glow line on the front edge */}
          <line x1="15" y1="39" x2="95" y2="39"
            stroke="#bfdbfe" strokeWidth="1" opacity="0.5" />

          {/* Arrow: direction the screen faces (pointing up = forward) */}
          <polygon points="55,10 47,30 63,30"
            fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
        </svg>
      </div>

      {/* Drag-to-rotate hint */}
      <div
        className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 transition-opacity duration-700 ${hintVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: 'calc(50% + 65px)' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" className="animate-[wiggle_1.5s_ease-in-out_infinite]">
          <path d="M14 4 A7 7 0 0 1 16 10" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <polygon points="17,9 15,12 14,8" fill="#94a3b8" />
          <path d="M6 16 A7 7 0 0 1 4 10" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <polygon points="3,11 5,8 6,12" fill="#94a3b8" />
        </svg>
        <span className="text-xs text-slate-400 whitespace-nowrap">Drag to rotate</span>
      </div>
    </>
  );
}

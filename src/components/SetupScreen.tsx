'use client';

import MonitorIndicator from './MonitorIndicator';

interface SetupScreenProps {
  readonly onAccept: () => void;
  readonly onRelocate: () => void;
  readonly onRotationChange: (angle: number) => void;
}

export default function SetupScreen({ onAccept, onRelocate, onRotationChange }: SetupScreenProps) {
  return (
    <>
      {/* Relocate button */}
      <button
        type="button"
        onClick={onRelocate}
        className="pointer-events-auto absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-700/90 active:bg-slate-600/90"
        title="Re-center on your location"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1" x2="8" y2="4" />
          <line x1="8" y1="12" x2="8" y2="15" />
          <line x1="1" y1="8" x2="4" y2="8" />
          <line x1="12" y1="8" x2="15" y2="8" />
        </svg>
        Relocate
      </button>

      {/* Title + illustration */}
      <div className="pointer-events-none absolute top-6 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center">
        <h1
          className="relative select-none text-3xl sm:text-5xl"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          {/* 3D shadow layers */}
          <span
            className="absolute inset-0"
            style={{ color: '#1e1b4b', transform: 'translate(4px, 4px)' }}
            aria-hidden="true"
          >POINTALOC</span>
          <span
            className="absolute inset-0"
            style={{ color: '#312e81', transform: 'translate(3px, 3px)' }}
            aria-hidden="true"
          >POINTALOC</span>
          <span
            className="absolute inset-0"
            style={{ color: '#4338ca', transform: 'translate(2px, 2px)' }}
            aria-hidden="true"
          >POINTALOC</span>
          {/* Main text with per-letter colors */}
          <span className="relative">
            <span style={{ color: '#f87171' }}>P</span>
            <span style={{ color: '#fb923c' }}>O</span>
            <span style={{ color: '#facc15' }}>I</span>
            <span style={{ color: '#4ade80' }}>N</span>
            <span style={{ color: '#22d3ee' }}>T</span>
            <span style={{ color: '#60a5fa' }}>A</span>
            <span style={{ color: '#a78bfa' }}>L</span>
            <span style={{ color: '#f472b6' }}>O</span>
            <span style={{ color: '#f87171' }}>C</span>
          </span>
        </h1>
        <svg
          width="220"
          height="120"
          viewBox="0 0 220 120"
          className="mt-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        >
          {/* Person 1 — pointing left */}
          <circle cx="40" cy="28" r="10" fill="#f9fafb" />
          <line x1="40" y1="38" x2="40" y2="70" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="70" x2="30" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="70" x2="50" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="48" x2="12" y2="38" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="48" x2="55" y2="60" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          {/* Pointing arrow */}
          <polygon points="4,36 14,32 12,40" fill="#60a5fa" />

          {/* Person 2 — pointing up-right */}
          <circle cx="110" cy="28" r="10" fill="#f9fafb" />
          <line x1="110" y1="38" x2="110" y2="70" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="70" x2="100" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="70" x2="120" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="48" x2="138" y2="26" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="48" x2="95" y2="60" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          {/* Pointing arrow */}
          <polygon points="144,20 134,22 138,30" fill="#60a5fa" />

          {/* Person 3 — pointing right */}
          <circle cx="180" cy="28" r="10" fill="#f9fafb" />
          <line x1="180" y1="38" x2="180" y2="70" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="180" y1="70" x2="170" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="180" y1="70" x2="190" y2="95" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="180" y1="48" x2="210" y2="40" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          <line x1="180" y1="48" x2="165" y2="58" stroke="#f9fafb" strokeWidth="3" strokeLinecap="round" />
          {/* Pointing arrow */}
          <polygon points="218,38 208,34 208,42" fill="#60a5fa" />
        </svg>
      </div>

      <MonitorIndicator onRotationChange={onRotationChange} />

      {/* Setup instructions */}
      <div
        className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 max-w-xs space-y-2 rounded-xl border-2 border-blue-400/50 bg-slate-900/85 px-5 py-3 text-center text-sm text-white backdrop-blur-sm sm:text-base"
      >
        <p>
          Move the map and place the monitor at your current location.
        </p>
        <p>
          You are seeing your monitor from above. Rotate it to match its real position, then press start.
        </p>
      </div>

      <button
        type="button"
        onClick={onAccept}
        className="pointer-events-auto absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800"
      >
        Start Game
      </button>
    </>
  );
}

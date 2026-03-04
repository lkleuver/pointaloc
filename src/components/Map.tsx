'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createArrowLayer, geodesicBearing, type ArrowLayer } from './ArrowLayer';
import GameOverlay from './GameOverlay';
import locations from '../data/locations.json';

type AppMode = 'setup' | 'pointing';

const TILE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 2;
const LOCATED_ZOOM = 16;
const STORAGE_KEY = 'pointaloc:lastCenter';
const GUESS_COUNTDOWN_START = 5;
const NEXT_COUNTDOWN_START = 5;
const COUNTDOWN_INTERVAL_MS = 1000;

type GamePhase = 'guessing' | 'revealing';

interface Location {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

/** Fisher-Yates shuffle, returns a new array. */
function shuffleLocations(): Location[] {
  const arr = [...locations];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadCachedCenter(): { center: [number, number]; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { center: [parsed.lng, parsed.lat], zoom: LOCATED_ZOOM };
  } catch {
    return null;
  }
}

function saveCachedCenter(lng: number, lat: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lng, lat }));
  } catch { /* ignore */ }
}

interface MonitorIndicatorProps {
  readonly onRotationChange: (angle: number) => void;
}

function MonitorIndicator({ onRotationChange }: MonitorIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const draggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);

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
    <div
      ref={ref}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-10"
      style={{
        transform: 'translate(-50%, -50%) rotate(0deg)',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <svg width="80" height="60" viewBox="0 0 80 60">
        {/* Monitor body viewed from above */}
        <rect x="5" y="22" width="70" height="16" rx="2"
          fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
        {/* Screen bezel */}
        <rect x="8" y="24" width="64" height="12" rx="1"
          fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" />
        {/* Arrow: direction the screen faces */}
        <polygon points="40,4 33,20 47,20"
          fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
      </svg>
    </div>
  );
}

function useGeolocation(map: maplibregl.Map | null) {
  useEffect(() => {
    if (!map) return;
    if (!navigator.geolocation) return;

    let watchId: number | undefined;
    let initialFlyDone = false;

    const startGeolocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          saveCachedCenter(center[0], center[1]);
          initialFlyDone = true;
          map.jumpTo({ center, zoom: LOCATED_ZOOM });
        },
        (err) => console.warn('Geolocation error:', err.message),
        { enableHighAccuracy: true },
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          saveCachedCenter(center[0], center[1]);
          if (!initialFlyDone) {
            initialFlyDone = true;
            map.jumpTo({ center, zoom: LOCATED_ZOOM });
          } else {
            map.setCenter(center);
          }
        },
        (err) => console.warn('Geolocation watch error:', err.message),
        { enableHighAccuracy: true },
      );
    };

    if (map.loaded()) {
      startGeolocation();
    } else {
      map.on('load', startGeolocation);
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
      map.off('load', startGeolocation);
    };
  }, [map]);
}

function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

interface SetupResult {
  readonly lat: number;
  readonly lng: number;
  readonly bearing: number;
}

const ARROW_LAYER_ID = 'three-arrow-layer';

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const rotationRef = useRef(0);
  const [mode, setMode] = useState<AppMode>('setup');
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [targetLocation, setTargetLocation] = useState<Location | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('guessing');
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const arrowLayerRef = useRef<ArrowLayer | null>(null);
  const locationQueueRef = useRef<Location[]>([]);
  const locationIndexRef = useRef(0);

  const handleRotationChange = useCallback((angle: number) => {
    rotationRef.current = angle;
  }, []);

  const handleAccept = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    const mapBearing = map.getBearing();
    const result: SetupResult = {
      lat: center.lat,
      lng: center.lng,
      bearing: normalizeAngle(rotationRef.current + mapBearing),
    };
    setSetupResult(result);
    setMode('pointing');
  }, [map]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cached = loadCachedCenter();
    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: cached?.center ?? DEFAULT_CENTER,
      zoom: cached?.zoom ?? DEFAULT_ZOOM,
    });

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  useGeolocation(map);

  // Transition to pointing mode: tilt map, lock interactions, add arrow pointing up
  useEffect(() => {
    if (mode !== 'pointing' || !map || !setupResult) return;

    map.easeTo({
      pitch: 60,
      bearing: map.getBearing(),
      duration: 1000,
    });

    // Lock all map interactions
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disable();
    map.keyboard.disable();

    // Add 3D arrow layer (starts hidden)
    const addLayer = () => {
      if (!map.getLayer(ARROW_LAYER_ID)) {
        const layer = createArrowLayer({
          lat: setupResult.lat,
          lng: setupResult.lng,
        });
        arrowLayerRef.current = layer;
        map.addLayer(layer);
      }
    };

    if (map.isStyleLoaded()) {
      addLayer();
    } else {
      map.once('styledata', addLayer);
    }

    // Shuffle locations and start first round
    locationQueueRef.current = shuffleLocations();
    locationIndexRef.current = 0;
    setTargetLocation(locationQueueRef.current[0]);
    setGamePhase('guessing');
    setCountdown(GUESS_COUNTDOWN_START);
    setNextCountdown(null);

    return () => {
      if (map.getLayer(ARROW_LAYER_ID)) {
        map.removeLayer(ARROW_LAYER_ID);
      }
      arrowLayerRef.current = null;
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
      map.keyboard.enable();
    };
  }, [mode, map, setupResult]);

  // Guessing countdown timer (5→0)
  useEffect(() => {
    if (gamePhase !== 'guessing' || countdown === null || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, COUNTDOWN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [gamePhase, countdown]);

  // When guess countdown hits 0: reveal arrow, start next-location countdown
  useEffect(() => {
    if (gamePhase !== 'guessing' || countdown !== 0 || !setupResult || !targetLocation) return;

    const targetBearing = geodesicBearing(
      setupResult.lat, setupResult.lng,
      targetLocation.lat, targetLocation.lng,
    );

    arrowLayerRef.current?.reveal(targetBearing);
    setGamePhase('revealing');
    setNextCountdown(NEXT_COUNTDOWN_START);
  }, [gamePhase, countdown, setupResult, targetLocation]);

  // Next-location countdown timer (5→0)
  useEffect(() => {
    if (gamePhase !== 'revealing' || nextCountdown === null || nextCountdown <= 0) return;

    const timer = setInterval(() => {
      setNextCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, COUNTDOWN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [gamePhase, nextCountdown]);

  // When next countdown hits 0: reset arrow up, pick new city, restart guessing
  useEffect(() => {
    if (gamePhase !== 'revealing' || nextCountdown !== 0) return;

    arrowLayerRef.current?.hide();

    // Advance to next location, reshuffle when exhausted
    let nextIndex = locationIndexRef.current + 1;
    if (nextIndex >= locationQueueRef.current.length) {
      locationQueueRef.current = shuffleLocations();
      nextIndex = 0;
    }
    locationIndexRef.current = nextIndex;
    setTargetLocation(locationQueueRef.current[nextIndex]);
    setGamePhase('guessing');
    setCountdown(GUESS_COUNTDOWN_START);
    setNextCountdown(null);
  }, [gamePhase, nextCountdown]);

  const overlayVisible = mode === 'pointing' && targetLocation !== null && countdown !== null;

  return (
    <div className="relative h-screen w-screen">
      <div ref={containerRef} className="h-full w-full" />

      {mode === 'setup' && (
        <>
          {/* Title + illustration */}
          <div className="pointer-events-none absolute top-6 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center">
            <h1
              className="text-4xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] sm:text-6xl"
              style={{ fontFamily: 'var(--font-game)' }}
            >
              Pointaloc
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

          <MonitorIndicator onRotationChange={handleRotationChange} />

          {/* Setup instructions */}
          <div
            className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 max-w-xs rounded-xl border-2 border-blue-400/50 bg-slate-900/85 px-5 py-3 backdrop-blur-sm"
          >
            <p className="text-center text-sm text-white sm:text-base">
              You are seeing your monitor from above. Rotate it to match its real position, then press start.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            className="pointer-events-auto absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            Start Game
          </button>
        </>
      )}

      {overlayVisible && (
        <GameOverlay
          cityName={targetLocation.name}
          countdown={countdown}
          phase={gamePhase}
          nextCountdown={nextCountdown}
          visible
        />
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import GameOverlay from './GameOverlay';
import SetupScreen from './SetupScreen';
import { loadCachedCenter } from '../hooks/useGeolocation';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGameLoop, type SetupResult } from '../hooks/useGameLoop';

type AppMode = 'setup' | 'pointing';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 2;

function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const rotationRef = useRef(0);
  const [mode, setMode] = useState<AppMode>('setup');
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);

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

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const cached = loadCachedCenter();
    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: cached?.center ?? DEFAULT_CENTER,
      zoom: cached?.zoom ?? DEFAULT_ZOOM,
    });

    // Disable rotation in setup mode — users only need pan/zoom
    mapInstance.dragRotate.disable();
    mapInstance.touchZoomRotate.disableRotation();

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  const { relocate } = useGeolocation(map);

  const { targetLocation, countdown, gamePhase, nextCountdown, distance } = useGameLoop({
    mode,
    map,
    setupResult,
  });

  const overlayVisible = mode === 'pointing' && targetLocation !== null && countdown !== null;

  return (
    <div className="relative h-screen w-screen">
      <div ref={containerRef} className="h-full w-full" />

      {mode === 'setup' && (
        <SetupScreen
          onAccept={handleAccept}
          onRelocate={relocate}
          onRotationChange={handleRotationChange}
        />
      )}

      {overlayVisible && (
        <GameOverlay
          cityName={targetLocation.name}
          countdown={countdown}
          phase={gamePhase}
          nextCountdown={nextCountdown}
          distance={distance}
          visible
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { createArrowLayer, geodesicBearing, type ArrowLayer } from '../components/ArrowLayer';
import locations from '../data/locations.json';

export type GamePhase = 'guessing' | 'revealing';

export interface Location {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface SetupResult {
  readonly lat: number;
  readonly lng: number;
  readonly bearing: number;
}

const GUESS_COUNTDOWN_START = 5;
const NEXT_COUNTDOWN_START = 5;
const COUNTDOWN_INTERVAL_MS = 1000;
const ARROW_LAYER_ID = 'three-arrow-layer';

/** Haversine distance between two lat/lng points in kilometers. */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

interface UseGameLoopParams {
  readonly mode: 'setup' | 'pointing';
  readonly map: maplibregl.Map | null;
  readonly setupResult: SetupResult | null;
}

interface UseGameLoopResult {
  readonly targetLocation: Location | null;
  readonly countdown: number | null;
  readonly gamePhase: GamePhase;
  readonly nextCountdown: number | null;
  readonly distance: number | null;
}

export function useGameLoop({ mode, map, setupResult }: UseGameLoopParams): UseGameLoopResult {
  const [targetLocation, setTargetLocation] = useState<Location | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('guessing');
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const arrowLayerRef = useRef<ArrowLayer | null>(null);
  const locationQueueRef = useRef<Location[]>([]);
  const locationIndexRef = useRef(0);

  // Transition to pointing mode: tilt map, lock interactions, add arrow
  useEffect(() => {
    if (mode !== 'pointing' || !map || !setupResult) return;

    map.easeTo({
      pitch: 60,
      bearing: setupResult.bearing,
      zoom: 14,
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

  // Guessing countdown timer (5->0)
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
    setDistance(Math.round(haversineDistance(
      setupResult.lat, setupResult.lng,
      targetLocation.lat, targetLocation.lng,
    )));
    setGamePhase('revealing');
    setNextCountdown(NEXT_COUNTDOWN_START);
  }, [gamePhase, countdown, setupResult, targetLocation]);

  // Next-location countdown timer (5->0)
  useEffect(() => {
    if (gamePhase !== 'revealing' || nextCountdown === null || nextCountdown <= 0) return;

    const timer = setInterval(() => {
      setNextCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, COUNTDOWN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [gamePhase, nextCountdown]);

  // When next countdown hits 0: reset arrow, pick new city, restart guessing
  useEffect(() => {
    if (gamePhase !== 'revealing' || nextCountdown !== 0) return;

    arrowLayerRef.current?.hide();
    setDistance(null);

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

  return { targetLocation, countdown, gamePhase, nextCountdown, distance };
}

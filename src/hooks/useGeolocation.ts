import { useCallback, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

const STORAGE_KEY = 'pointaloc:lastCenter';
export const LOCATED_ZOOM = 16;

export function loadCachedCenter(): { center: [number, number]; zoom: number } | null {
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

export function useGeolocation(map: maplibregl.Map | null): { relocate: () => void } {
  const relocate = useCallback(() => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        saveCachedCenter(center[0], center[1]);
        map.flyTo({ center, zoom: LOCATED_ZOOM, duration: 1500 });
      },
      (err) => console.warn('Relocate error:', err.message),
      { enableHighAccuracy: true },
    );
  }, [map]);

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

  return { relocate };
}

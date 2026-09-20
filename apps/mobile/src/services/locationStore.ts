import { useEffect, useState } from 'react';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  locality: string;
};

const DEFAULT_LOCATION: PickedLocation = {
  latitude: 8.1833,
  longitude: 77.4119,
  locality: 'Nagercoil, Tamil Nadu',
};

let current: PickedLocation = DEFAULT_LOCATION;
let resolved = false;
const listeners = new Set<(location: PickedLocation) => void>();

export function getLocation(): PickedLocation {
  return current;
}

export function hasResolvedLocation(): boolean {
  return resolved;
}

export function setLocation(location: PickedLocation): void {
  current = location;
  resolved = true;
  for (const listener of listeners) listener(location);
}

/** Re-renders the calling component whenever the shared location changes. */
export function useLocation(): PickedLocation {
  const [activeLocation, setActiveLocation] = useState(current);
  useEffect(() => {
    const listener = (next: PickedLocation) => setActiveLocation(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return activeLocation;
}

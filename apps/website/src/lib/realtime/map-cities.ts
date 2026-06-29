import type { MapCity, ScreenMapViewState } from './types';

// Curated presets used by controls and hello-state synchronization.
// Keeping this centralized ensures city selection behaves identically across all clients.
export const CITY_MAP_VIEWS: Record<MapCity, ScreenMapViewState> = {
    london: {
        longitude: -0.1749,
        latitude: 51.4988,
        zoom: 15.5,
        bearing: 0,
        pitch: 0
    },
    paris: {
        longitude: 2.3522,
        latitude: 48.8566,
        zoom: 15.5,
        bearing: 0,
        pitch: 0
    },
    'hong-kong': {
        longitude: 114.1694,
        latitude: 22.2969,
        zoom: 15.5,
        bearing: 0,
        pitch: 0
    },
    munich: {
        longitude: 11.5755,
        latitude: 48.1374,
        zoom: 15.5,
        bearing: 0,
        pitch: 0
    }
};

export function isMapCity(value: unknown): value is MapCity {
    // Type guard used before accepting untrusted city values from network payloads.
    return typeof value === 'string' && value in CITY_MAP_VIEWS;
}

export function getCityMapView(city: MapCity): ScreenMapViewState {
    // Return preset camera for deterministic cross-screen transitions.
    return CITY_MAP_VIEWS[city];
}

import { createFileRoute } from '@tanstack/react-router';
import { Map } from '@vis.gl/react-maplibre';
import type { ViewStateChangeEvent } from '@vis.gl/react-maplibre';
import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveMapStyle } from '../lib/map-styles';
import { controlEngine } from '../lib/realtime/engines/control-engine';
import { useControlStore } from '../lib/realtime/stores/control-store';
import type { MapCity, ScreenMapViewState } from '../lib/realtime/types';
import { createInitialControlStoreState } from '../lib/realtime/types';
import { WALL_TOTAL_WIDTH, WALL_TOTAL_HEIGHT } from '../lib/wall-config';

import 'maplibre-gl/dist/maplibre-gl.css';

type NominatimResult = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
};

const INITIAL = createInitialControlStoreState();

const CITIES: Array<{ value: MapCity; label: string }> = [
    { value: 'london', label: 'London' },
    { value: 'paris', label: 'Paris' },
    { value: 'hong-kong', label: 'Hong Kong' },
    { value: 'munich', label: 'Munich' }
];

type ControlSearch = {
    operator: string;
};

export const Route = createFileRoute('/control')({
    validateSearch: (search: Record<string, unknown>): ControlSearch => {
        return {
            operator: typeof search.operator === 'string' ? search.operator : 'A'
        };
    },
    component: ControlPage
});

function ControlPage() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    const _selectedCity = useControlStore((state) => state.selectedCity);
    const _currentMapView = useControlStore((state) => state.currentMapView);
    const _mapStyle = useControlStore((state) => state.mapStyle);

    const selectedCity = isClient ? _selectedCity : INITIAL.selectedCity;
    const currentMapView = isClient ? _currentMapView : INITIAL.currentMapView;
    const mapStyle = isClient ? _mapStyle : INITIAL.mapStyle;

    const [controlMapView, setControlMapView] = useState<ScreenMapViewState>(currentMapView);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [zoomOffset, setZoomOffset] = useState(0);

    useEffect(() => {
        const el = mapContainerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                const { width } = entry.contentRect;
                setZoomOffset(width > 0 ? Math.log2(WALL_TOTAL_WIDTH / width) : 0);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setControlMapView(currentMapView);
    }, [currentMapView]);

    const handleMove = useCallback(
        (evt: ViewStateChangeEvent) => {
            const { longitude, latitude, zoom, bearing, pitch } = evt.viewState;
            setControlMapView({ longitude, latitude, zoom: zoom + zoomOffset, bearing, pitch });
        },
        [zoomOffset]
    );

    const handleMoveEnd = useCallback(
        (evt: ViewStateChangeEvent) => {
            const { longitude, latitude, zoom, bearing, pitch } = evt.viewState;
            const view = { longitude, latitude, zoom: zoom + zoomOffset, bearing, pitch };
            setControlMapView(view);
            controlEngine.applyGestureView(view);
        },
        [zoomOffset]
    );

    const displayZoom = controlMapView.zoom - zoomOffset;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = useCallback(async () => {
        const q = searchQuery.trim();
        if (!q) return;
        setIsSearching(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
                { headers: { 'Accept-Language': 'en' } }
            );
            setSearchResults((await res.json()) as NominatimResult[]);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery]);

    const handleSelectResult = useCallback(
        (result: NominatimResult) => {
            controlEngine.applyGestureView({
                longitude: parseFloat(result.lon),
                latitude: parseFloat(result.lat),
                zoom: currentMapView.zoom,
                bearing: 0,
                pitch: 0
            });
            setSearchResults([]);
            setSearchQuery('');
        },
        [currentMapView.zoom]
    );

    return (
        <main className="h-screen w-screen overflow-hidden bg-zinc-900 text-white">
            <div className="flex h-full flex-col">
                {/* Wall preview */}
                <div
                    ref={mapContainerRef}
                    className="w-full shrink-0 overflow-hidden bg-zinc-950"
                    style={{ aspectRatio: `${WALL_TOTAL_WIDTH} / ${WALL_TOTAL_HEIGHT}` }}
                >
                    {isClient ? (
                        <Map
                            attributionControl={false}
                            mapStyle={resolveMapStyle(mapStyle)}
                            longitude={controlMapView.longitude}
                            latitude={controlMapView.latitude}
                            zoom={Math.max(0, displayZoom)}
                            bearing={controlMapView.bearing}
                            pitch={controlMapView.pitch}
                            onMove={handleMove}
                            onMoveEnd={handleMoveEnd}
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : null}
                </div>

                {/* Controls panel */}
                <div className="flex flex-1 flex-col gap-5 p-6">
                    {/* Base map toggle */}
                    <div>
                        <p className="mb-3 text-sm font-semibold text-blue-400">
                            Select a base map
                        </p>
                        <div className="flex items-center">
                            <button
                                onClick={() => controlEngine.setMapStyle('satellite')}
                                className={`cursor-pointer rounded-lg px-8 py-4 text-2xl font-bold text-white transition-colors ${
                                    mapStyle === 'satellite'
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                Satellite Map
                            </button>
                            <div className="mx-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-800">
                                or
                            </div>
                            <button
                                onClick={() => controlEngine.setMapStyle('voyager')}
                                className={`cursor-pointer rounded-lg px-8 py-4 text-2xl font-bold text-white transition-colors ${
                                    mapStyle === 'voyager'
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                Topo Map
                            </button>
                        </div>
                    </div>

                    {/* City selection */}
                    <div>
                        <p className="mb-3 text-sm font-semibold text-blue-400">Select a city</p>
                        <div className="flex flex-wrap gap-2">
                            {CITIES.map((city) => (
                                <button
                                    key={city.value}
                                    onClick={() => controlEngine.selectCity(city.value)}
                                    className={`cursor-pointer rounded-lg px-8 py-4 text-2xl font-bold text-white transition-colors ${
                                        selectedCity === city.value
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {city.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative w-150">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                                onBlur={() => setTimeout(() => setSearchResults([]), 150)}
                                placeholder="Search city or country…"
                                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-2xl text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                            />
                            <button
                                onClick={() => void handleSearch()}
                                className="cursor-pointer rounded-lg bg-blue-600 px-5 py-3 text-2xl font-bold text-white hover:bg-blue-700"
                            >
                                {isSearching ? '…' : 'Search'}
                            </button>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.place_id}
                                        onMouseDown={() => handleSelectResult(result)}
                                        className="w-full truncate px-4 py-2.5 text-left text-sm text-white first:rounded-t-lg last:rounded-b-lg hover:bg-zinc-700"
                                    >
                                        {result.display_name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

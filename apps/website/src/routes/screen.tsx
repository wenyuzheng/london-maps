import { WebMercatorViewport } from '@deck.gl/core';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { Map } from '@vis.gl/react-maplibre';
import { useEffect, useMemo, useRef, useState } from 'react';

import '../lib/realtime/engines/screen-engine';
import { resolveMapStyle } from '../lib/map-styles';
import { useScreenStore } from '../lib/realtime/stores/screen-store';
import type { ScreenMapViewState } from '../lib/realtime/types';
import { WALL_COLS, WALL_ROWS, SCREEN_WIDTH, SCREEN_HEIGHT } from '../lib/wall-config';

import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_TRANSITION_DURATION_MS = 1200;

export const Route = createFileRoute('/screen')({
    component: ScreenPage
});

function ScreenPage() {
    const { search } = useLocation();
    const searchParams = (search as Record<string, unknown>) ?? {};
    const screenC = parseScreenCoordinate(searchParams.c, WALL_COLS, 0);
    const screenR = parseScreenCoordinate(searchParams.r, WALL_ROWS, 0);

    const mapView = useScreenStore((state) => state.mapView);
    const mapStyle = useScreenStore((state) => state.mapStyle);
    const [isClient, setIsClient] = useState(false);
    const [animatedBaseMapView, setAnimatedBaseMapView] = useState(mapView);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        const from = animatedBaseMapView;
        const to = mapView;
        const startTime = performance.now();

        const step = (now: number) => {
            const elapsed = now - startTime;
            const linearT = Math.min(1, elapsed / MAP_TRANSITION_DURATION_MS);
            const t = easeInOutCubic(linearT);

            setAnimatedBaseMapView(interpolateMapView(from, to, t));

            if (linearT < 1) {
                animationFrameRef.current = requestAnimationFrame(step);
            } else {
                animationFrameRef.current = null;
            }
        };

        animationFrameRef.current = requestAnimationFrame(step);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isClient, mapView]);

    const localScreenMapView = useMemo(
        () => deriveScreenMapView(animatedBaseMapView, screenC, screenR),
        [animatedBaseMapView, screenC, screenR]
    );

    return (
        <main className="pointer-events-none h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
            <div className="relative flex h-full w-full items-center justify-center">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.14),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.12),transparent_45%)]" />
                <div className="relative z-30 flex h-full w-full flex-col items-center justify-center gap-4">
                    <p className="text-sm tracking-[0.35em] text-zinc-400 uppercase md:text-lg">
                        Screen Node
                    </p>
                    <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
                        /screen?c={screenC}&r={screenR}
                    </h1>
                    <div className="text-md rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-emerald-300 md:text-3xl">
                        Ready
                    </div>
                </div>
                <div className="absolute inset-0 z-200">
                    {isClient ? (
                        <Map
                            reuseMaps
                            attributionControl={false}
                            mapStyle={resolveMapStyle(mapStyle)}
                            longitude={localScreenMapView.longitude}
                            latitude={localScreenMapView.latitude}
                            zoom={localScreenMapView.zoom}
                            bearing={localScreenMapView.bearing}
                            pitch={localScreenMapView.pitch}
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : null}
                </div>
            </div>
        </main>
    );
}

function parseScreenCoordinate(value: unknown, size: number, fallback: number) {
    if (value === null || value === undefined) {
        return Math.min(size - 1, Math.max(0, fallback));
    }
    const parsed =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(parsed)) {
        return Math.min(size - 1, Math.max(0, fallback));
    }
    return Math.min(size - 1, Math.max(0, parsed));
}

function deriveScreenMapView(
    baseView: ScreenMapViewState,
    c: number,
    r: number
): ScreenMapViewState {
    const viewport = new WebMercatorViewport({
        longitude: baseView.longitude,
        latitude: baseView.latitude,
        zoom: baseView.zoom,
        bearing: baseView.bearing,
        pitch: baseView.pitch,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT
    });

    const [centerX, centerY] = viewport.project([baseView.longitude, baseView.latitude]);

    const pixelOffsetX = (c + 0.5 - WALL_COLS / 2) * SCREEN_WIDTH;
    const pixelOffsetY = (r + 0.5 - WALL_ROWS / 2) * SCREEN_HEIGHT;

    const [longitude, latitude] = viewport.unproject([
        centerX + pixelOffsetX,
        centerY + pixelOffsetY
    ]);

    return { ...baseView, longitude, latitude };
}

function interpolateMapView(
    from: ScreenMapViewState,
    to: ScreenMapViewState,
    t: number
): ScreenMapViewState {
    return {
        longitude: lerp(from.longitude, to.longitude, t),
        latitude: lerp(from.latitude, to.latitude, t),
        zoom: lerp(from.zoom, to.zoom, t),
        bearing: lerp(from.bearing, to.bearing, t),
        pitch: lerp(from.pitch, to.pitch, t)
    };
}

function lerp(from: number, to: number, t: number) {
    return from + (to - from) * t;
}

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

import { throttle } from '@tanstack/pacer';

import { getCityMapView, isMapCity } from '../map-cities';
import { controlStore } from '../stores/control-store';
import type {
    BusMessage,
    ControlSliderMessage,
    ControlStoreState,
    HelloBusMessage,
    MapCity,
    MapStyleName,
    ScreenMapStyleMessage,
    ScreenMapViewMessage,
    ScreenMapViewState,
    ScreenSegmentSelectionMessage
} from '../types';
import { BusEngine } from './bus-engine';

const SLIDER_BROADCAST_WAIT_MS = 100;
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const MAP_ZOOM_MIN = 6;
const MAP_ZOOM_MAX = 22;
export class ControlEngine extends BusEngine<ControlStoreState> {
    // Slider moves can emit many events per second; throttle keeps interaction smooth locally
    // while reducing websocket chatter for all connected peers.
    private readonly broadcastSliderValueThrottled = throttle(
        (value: number) => {
            this.send({
                type: 'control/slider',
                value,
                peerId: this.getPeerId() ?? undefined
            });
        },
        {
            wait: SLIDER_BROADCAST_WAIT_MS,
            leading: true,
            trailing: true
        }
    );

    private readonly broadcastMapZoomThrottled = throttle(
        (zoom: number) => {
            this.send({
                type: 'screen/map-view',
                city: this.store.state.selectedCity,
                view: { zoom },
                peerId: this.getPeerId() ?? undefined
            });
        },
        {
            wait: SLIDER_BROADCAST_WAIT_MS,
            leading: true,
            trailing: true
        }
    );

    // Gesture moves fire at 60fps; throttle to ~15fps before hitting the bus.
    private readonly broadcastGestureViewThrottled = throttle(
        (view: ScreenMapViewState) => {
            this.send({
                type: 'screen/map-view',
                view,
                peerId: this.getPeerId() ?? undefined
            });
        },
        { wait: 66, leading: true, trailing: true }
    );

    private constructor() {
        super('control', controlStore);
    }

    static getInstance() {
        const globalWithControlEngine = globalThis as typeof globalThis & {
            __controlEngineInstance?: ControlEngine;
        };

        if (!globalWithControlEngine.__controlEngineInstance) {
            globalWithControlEngine.__controlEngineInstance = new ControlEngine();
        }

        return globalWithControlEngine.__controlEngineInstance;
    }

    setSliderInteracting(isSliderInteracting: boolean) {
        // Stored so remote updates can be ignored while local user is dragging.
        this.store.setState((prev) => {
            if (prev.isSliderInteracting === isSliderInteracting) return prev;
            return {
                ...prev,
                isSliderInteracting
            };
        });
    }

    setSliderValue(value: number) {
        const clampedValue = this.clampSliderValue(value);
        const newZoom = this.zoomFromSlider(clampedValue);

        this.store.setState((prev) => {
            if (prev.sliderValue === clampedValue) return prev;
            return {
                ...prev,
                sliderValue: clampedValue,
                currentMapView: { ...prev.currentMapView, zoom: newZoom }
            };
        });

        this.broadcastSliderValueThrottled(clampedValue);
        this.broadcastMapZoomThrottled(newZoom);
    }

    selectCity(city: MapCity) {
        if (this.store.state.selectedCity === city) return;

        const nextView: ScreenMapViewState = getCityMapView(city);
        const nextSliderValue = this.clampSliderValue(this.sliderFromZoom(nextView.zoom));

        this.store.setState((prev) => ({
            ...prev,
            selectedCity: city,
            sliderValue: nextSliderValue,
            currentMapView: nextView
        }));

        this.send({
            type: 'screen/map-view',
            city,
            view: nextView,
            peerId: this.getPeerId() ?? undefined
        });
    }

    setMapStyle(style: MapStyleName) {
        this.store.setState((prev) => {
            if (prev.mapStyle === style) return prev;
            return { ...prev, mapStyle: style };
        });
        this.send({
            type: 'screen/map-style',
            style,
            peerId: this.getPeerId() ?? undefined
        });
    }

    applyGestureView(view: ScreenMapViewState) {
        const sliderValue = this.clampSliderValue(this.sliderFromZoom(view.zoom));
        this.store.setState((prev) => ({
            ...prev,
            currentMapView: view,
            sliderValue
        }));
        this.broadcastGestureViewThrottled(view);
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'control/slider') {
            const sliderMessage = message as ControlSliderMessage;
            if (typeof sliderMessage.value !== 'number') return;
            this.store.setState((prev) => {
                // If the local user is actively dragging, ignore remote slider echoes
                // to avoid "fighting cursors" and jitter.
                if (prev.isSliderInteracting) return prev;

                const clampedValue = this.clampSliderValue(sliderMessage.value);
                if (prev.sliderValue === clampedValue) return prev;

                return {
                    ...prev,
                    sliderValue: clampedValue
                };
            });
            return;
        }

        if (message.type === 'screen/map-view') {
            // Mirror incoming map events so all control clients display shared state.
            const mapViewMessage = message as ScreenMapViewMessage;
            this.store.setState((prev) => {
                const nextCity = isMapCity(mapViewMessage.city)
                    ? mapViewMessage.city
                    : prev.selectedCity;
                const nextSliderValue =
                    typeof mapViewMessage.view?.zoom === 'number'
                        ? this.sliderFromZoom(mapViewMessage.view.zoom)
                        : prev.sliderValue;

                // Rebuild currentMapView: city preset first, then field-by-field patch from view.
                let nextView = prev.currentMapView;
                if (isMapCity(mapViewMessage.city)) {
                    nextView = { ...nextView, ...getCityMapView(mapViewMessage.city) };
                }
                if (mapViewMessage.view) {
                    const v = mapViewMessage.view;
                    nextView = {
                        longitude:
                            typeof v.longitude === 'number' ? v.longitude : nextView.longitude,
                        latitude: typeof v.latitude === 'number' ? v.latitude : nextView.latitude,
                        zoom: typeof v.zoom === 'number' ? v.zoom : nextView.zoom,
                        bearing: typeof v.bearing === 'number' ? v.bearing : nextView.bearing,
                        pitch: typeof v.pitch === 'number' ? v.pitch : nextView.pitch
                    };
                }

                return {
                    ...prev,
                    selectedCity: nextCity,
                    sliderValue: nextSliderValue,
                    currentMapView: nextView
                };
            });
            return;
        }

        if (message.type === 'screen/map-style') {
            const styleMessage = message as ScreenMapStyleMessage;
            if (styleMessage.style === 'voyager' || styleMessage.style === 'satellite') {
                this.store.setState((prev) => {
                    if (prev.mapStyle === styleMessage.style) return prev;
                    return { ...prev, mapStyle: styleMessage.style };
                });
            }
            return;
        }

        if (message.type === 'screen/segment-selection') {
            const segmentSelectionMessage = message as ScreenSegmentSelectionMessage;
            if (!Array.isArray(segmentSelectionMessage.indexes)) return;
            const indexes = segmentSelectionMessage.indexes
                .filter((value): value is number => Number.isInteger(value) && value >= 0)
                .slice()
                .sort((a, b) => a - b);

            this.store.setState((prev) => {
                if (arraysEqual(prev.selectedSegmentIndexes, indexes)) return prev;
                return {
                    ...prev,
                    selectedSegmentIndexes: indexes
                };
            });
        }
    }

    protected override onHello(hello: HelloBusMessage) {
        const state = hello.state;
        if (!state) return;

        // Rehydrate control UI from bus snapshot so newly opened tablets are immediately in sync.
        this.store.setState((prev) => {
            const nextCity = state.city;
            const nextSliderValue = this.sliderFromZoom(state.zoom);
            const nextSelectedIndexes = Array.isArray(state.selectedSegmentIndexes)
                ? state.selectedSegmentIndexes
                      .filter((value): value is number => Number.isInteger(value) && value >= 0)
                      .slice()
                      .sort((a, b) => a - b)
                : prev.selectedSegmentIndexes;
            const nextMapView: ScreenMapViewState = {
                ...getCityMapView(nextCity),
                zoom: state.zoom
            };
            const nextMapStyle =
                state.mapStyle === 'voyager' || state.mapStyle === 'satellite'
                    ? state.mapStyle
                    : prev.mapStyle;
            return {
                ...prev,
                selectedCity: nextCity,
                sliderValue: nextSliderValue,
                selectedSegmentIndexes: nextSelectedIndexes,
                currentMapView: nextMapView,
                mapStyle: nextMapStyle
            };
        });
    }

    private clampSliderValue(value: number) {
        // Single clamp utility keeps incoming and outgoing slider values consistent.
        return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value));
    }

    private zoomFromSlider(sliderValue: number) {
        // Linear mapping keeps control UI simple and predictable.
        const normalized = (sliderValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
        return MAP_ZOOM_MIN + normalized * (MAP_ZOOM_MAX - MAP_ZOOM_MIN);
    }

    private sliderFromZoom(zoom: number) {
        const clampedZoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zoom));
        const normalized = (clampedZoom - MAP_ZOOM_MIN) / (MAP_ZOOM_MAX - MAP_ZOOM_MIN);
        return this.clampSliderValue(normalized * (SLIDER_MAX - SLIDER_MIN) + SLIDER_MIN);
    }
}

export const controlEngine = ControlEngine.getInstance();

function arraysEqual(a: number[], b: number[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

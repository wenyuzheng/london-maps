import { throttle } from '@tanstack/pacer';

import { getCityMapView, isMapCity } from '../map-cities';
import { controlStore } from '../stores/control-store';
import type {
    BusMessage,
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

export class ControlEngine extends BusEngine<ControlStoreState> {
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

    selectCity(city: MapCity) {
        if (this.store.state.selectedCity === city) return;

        const nextView: ScreenMapViewState = getCityMapView(city);

        this.store.setState((prev) => ({
            ...prev,
            selectedCity: city,
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
        this.store.setState((prev) => ({
            ...prev,
            currentMapView: view
        }));
        this.broadcastGestureViewThrottled(view);
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'screen/map-view') {
            // Mirror incoming map events so all control clients display shared state.
            const mapViewMessage = message as ScreenMapViewMessage;
            this.store.setState((prev) => {
                const nextCity = isMapCity(mapViewMessage.city)
                    ? mapViewMessage.city
                    : prev.selectedCity;

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
                    currentMapView: nextView
                };
            });
            return;
        }

        if (message.type === 'screen/map-style') {
            const styleMessage = message as ScreenMapStyleMessage;
            if (styleMessage.style === 'topo' || styleMessage.style === 'satellite') {
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
            // const nextCity = state.city;
            const nextSelectedIndexes = Array.isArray(state.selectedSegmentIndexes)
                ? state.selectedSegmentIndexes
                      .filter((value): value is number => Number.isInteger(value) && value >= 0)
                      .slice()
                      .sort((a, b) => a - b)
                : prev.selectedSegmentIndexes;
            const nextMapView: ScreenMapViewState = {
                // ...getCityMapView(nextCity),
                zoom: state.mapView?.zoom ?? prev.currentMapView.zoom,
                longitude: state.mapView?.longitude ?? prev.currentMapView.longitude,
                latitude: state.mapView?.latitude ?? prev.currentMapView.latitude,
                bearing: state.mapView?.bearing ?? prev.currentMapView.bearing,
                pitch: state.mapView?.pitch ?? prev.currentMapView.pitch
            };
            const nextMapStyle =
                state.mapStyle === 'topo' || state.mapStyle === 'satellite'
                    ? state.mapStyle
                    : prev.mapStyle;
            return {
                ...prev,
                // selectedCity: nextCity,
                selectedSegmentIndexes: nextSelectedIndexes,
                currentMapView: nextMapView,
                mapStyle: nextMapStyle
            };
        });
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

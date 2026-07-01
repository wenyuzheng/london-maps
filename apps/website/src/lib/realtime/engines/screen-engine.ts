import { getCityMapView, isMapCity } from '../map-cities';
import { screenStore } from '../stores/screen-store';
import type {
    BusMessage,
    HelloBusMessage,
    ScreenMapStyleMessage,
    ScreenMapViewMessage,
    ScreenMapViewState,
    ScreenSegmentSelectionMessage,
    ScreenStoreState
} from '../types';
import { BusEngine } from './bus-engine';

export class ScreenEngine extends BusEngine<ScreenStoreState> {
    private constructor() {
        super('screen', screenStore);
    }

    static getInstance() {
        const globalWithScreenEngine = globalThis as typeof globalThis & {
            __screenEngineInstance?: ScreenEngine;
        };

        if (!globalWithScreenEngine.__screenEngineInstance) {
            globalWithScreenEngine.__screenEngineInstance = new ScreenEngine();
        }

        return globalWithScreenEngine.__screenEngineInstance;
    }

    setMapView(view: Partial<ScreenMapViewState>) {
        this.store.setState((prev) => ({
            ...prev,
            mapView: { ...prev.mapView, ...view }
        }));
    }

    setMapStyle(style: 'topo' | 'satellite') {
        this.store.setState((prev) => {
            if (prev.mapStyle === style) return prev;
            return { ...prev, mapStyle: style };
        });
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'screen/map-view') {
            const mapViewMessage = message as ScreenMapViewMessage;
            this.applyMapViewMessage(mapViewMessage);
            return;
        }

        if (message.type === 'screen/map-style') {
            const styleMessage = message as ScreenMapStyleMessage;
            if (styleMessage.style === 'topo' || styleMessage.style === 'satellite') {
                this.setMapStyle(styleMessage.style);
            }
            return;
        }

        if (message.type === 'screen/segment-selection') {
            const segmentSelectionMessage = message as ScreenSegmentSelectionMessage;
            this.applySegmentSelection(segmentSelectionMessage.indexes);
        }
    }

    protected override onHello(hello: HelloBusMessage) {
        if (!hello.state) return;
        this.applyMapViewMessage({
            type: 'screen/map-view',
            // city: hello.state.city,
            view: {
                zoom: hello.state.mapView.zoom,
                longitude: hello.state.mapView.longitude,
                latitude: hello.state.mapView.latitude,
                bearing: hello.state.mapView.bearing,
                pitch: hello.state.mapView.pitch
            }
        });
        this.applySegmentSelection(hello.state.selectedSegmentIndexes);
        if (hello.state.mapStyle === 'topo' || hello.state.mapStyle === 'satellite') {
            this.setMapStyle(hello.state.mapStyle);
        }
    }

    private applyMapViewMessage(mapViewMessage: ScreenMapViewMessage) {
        let nextView = this.store.state.mapView;

        if (isMapCity(mapViewMessage.city)) {
            nextView = { ...nextView, ...getCityMapView(mapViewMessage.city) };
        }

        if (mapViewMessage.view && typeof mapViewMessage.view === 'object') {
            const view = mapViewMessage.view;
            nextView = {
                ...nextView,
                longitude: typeof view.longitude === 'number' ? view.longitude : nextView.longitude,
                latitude: typeof view.latitude === 'number' ? view.latitude : nextView.latitude,
                zoom: typeof view.zoom === 'number' ? view.zoom : nextView.zoom,
                bearing: typeof view.bearing === 'number' ? view.bearing : nextView.bearing,
                pitch: typeof view.pitch === 'number' ? view.pitch : nextView.pitch
            };
        }

        this.setMapView(nextView);
    }

    private applySegmentSelection(indexes: unknown) {
        if (!Array.isArray(indexes)) return;

        const sanitizedIndexes = indexes
            .filter((value): value is number => Number.isInteger(value) && value >= 0)
            .slice()
            .sort((a, b) => a - b);

        this.store.setState((prev) => {
            if (arraysEqual(prev.selectedSegmentIndexes, sanitizedIndexes)) return prev;
            return { ...prev, selectedSegmentIndexes: sanitizedIndexes };
        });
    }
}

export const screenEngine = ScreenEngine.getInstance();

function arraysEqual(a: number[], b: number[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

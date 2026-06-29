export type BusMessage = {
    // Keep message kinds namespaced (`control/*`, `screen/*`).
    type: string;
    peerId?: string;
    peerCount?: number;
    [key: string]: unknown;
};

export type HelloBusMessage = BusMessage & {
    type: 'hello';
    peerId: string;
    state?: BusSharedState;
};

export type ControlSliderMessage = BusMessage & {
    type: 'control/slider';
    value: number;
};

export type ScreenSegmentSelectionMessage = BusMessage & {
    type: 'screen/segment-selection';
    indexes: number[];
};

export type MapCity = 'london' | 'paris' | 'hong-kong' | 'munich';

export type MapStyleName = 'voyager' | 'satellite';

export type BusSharedState = {
    city: MapCity;
    zoom: number;
    selectedSegmentIndexes: number[];
    mapStyle: MapStyleName;
};

export type ScreenMapViewState = {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
};

export type ScreenMapViewMessage = BusMessage & {
    type: 'screen/map-view';
    view: Partial<ScreenMapViewState>;
    city?: MapCity;
};

export type ScreenMapStyleMessage = BusMessage & {
    type: 'screen/map-style';
    style: MapStyleName;
};

export type ArcSegment = {
    id: string;
    start: [number, number];
    end: [number, number];
    weight: number;
};

export type EngineRole = 'screen' | 'control';

export type EngineConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type EngineStoreState = {
    role: EngineRole;
    peerId: string | null;
    connection: EngineConnectionState;
    messageCount: number;
    lastMessageType: string | null;
    lastMessageAt: number | null;
    lastError: string | null;
};

export const createInitialEngineStoreState = (role: EngineRole): EngineStoreState => ({
    role,
    peerId: null,
    connection: 'idle',
    messageCount: 0,
    lastMessageType: null,
    lastMessageAt: null,
    lastError: null
});

export type ControlStoreState = EngineStoreState & {
    sliderValue: number;
    isSliderInteracting: boolean;
    selectedCity: MapCity;
    selectedSegmentIndexes: number[];
    currentMapView: ScreenMapViewState;
    mapStyle: MapStyleName;
};

export type ScreenStoreState = EngineStoreState & {
    mapView: ScreenMapViewState;
    arcSegments: ArcSegment[];
    selectedSegmentIndexes: number[];
    isArcSegmentsLoading: boolean;
    mapStyle: MapStyleName;
};

const INITIAL_MAP_VIEW: ScreenMapViewState = {
    longitude: -0.1749,
    latitude: 51.4988,
    zoom: 15.5,
    bearing: 0,
    pitch: 0
};

const INITIAL_MAP_STYLE: MapStyleName = 'satellite';

export const createInitialControlStoreState = (): ControlStoreState => ({
    ...createInitialEngineStoreState('control'),
    sliderValue: 59,
    isSliderInteracting: false,
    selectedCity: 'london',
    selectedSegmentIndexes: [],
    currentMapView: INITIAL_MAP_VIEW,
    mapStyle: INITIAL_MAP_STYLE
});

export const createInitialScreenStoreState = (): ScreenStoreState => ({
    ...createInitialEngineStoreState('screen'),
    mapView: INITIAL_MAP_VIEW,
    arcSegments: [],
    selectedSegmentIndexes: [],
    isArcSegmentsLoading: false,
    mapStyle: INITIAL_MAP_STYLE
});

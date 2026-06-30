import type { StyleSpecification } from 'maplibre-gl';

import type { MapStyleName } from './realtime/types';

export const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const SATELLITE_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        satellite: {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19
        }
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
};

export function resolveMapStyle(name: MapStyleName): string | StyleSpecification {
    return name === 'satellite' ? SATELLITE_STYLE : DARK_STYLE;
}

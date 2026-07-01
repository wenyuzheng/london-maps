import { createFileRoute } from '@tanstack/react-router';
import { defineHooks } from 'crossws';

import type {
    BusMessage,
    BusSharedState,
    ScreenMapStyleMessage,
    ScreenMapViewMessage,
    ScreenSegmentSelectionMessage
} from '../lib/realtime';

// In-memory bus state for this server process.
// New clients receive this snapshot in the `hello` handshake so they can
// join late without waiting for another control interaction.
const busSharedState: BusSharedState = {
    mapView: {
        longitude: -0.1749,
        latitude: 51.4988,
        zoom: 15.5,
        bearing: 0,
        pitch: 0
    },
    selectedSegmentIndexes: [],
    mapStyle: 'satellite'
};

const hooks = defineHooks({
    open(peer) {
        // `hello` is our bootstrap packet:
        // it communicates peer identity + current collaborative state.
        peer.send({
            type: 'hello',
            peerId: peer.id,
            state: busSharedState
        });

        // All collaborating clients publish/subscribe on one logical channel (`do`).
        // This keeps the demo simple while still showing fan-out semantics.
        peer.subscribe('do');
        peer.publish('do', {
            type: 'peer',
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    },
    message(peer, message) {
        // Ignore malformed payloads; only valid JSON objects enter the shared-state path.
        let payload: Partial<BusMessage>;
        try {
            const parsed = message.json() as unknown;
            if (typeof parsed !== 'object' || parsed === null) return;
            payload = parsed as Partial<BusMessage>;
        } catch {
            return;
        }
        updateBusSharedState(payload);

        // Broadcast to all peers. Each client engine can ignore own echoes via peerId.
        peer.publish('do', {
            ...payload,
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    },
    close(peer) {
        peer.publish('do', {
            type: 'bye',
            peerId: peer.id,
            peerCount: peer.peers.size
        });
        peer.unsubscribe('do');
    }
});

function updateBusSharedState(payload: Partial<BusMessage>) {
    if (payload.type === 'screen/map-view') {
        const message = payload as Partial<ScreenMapViewMessage>;
        // Merge the full camera into the snapshot so a reconnecting client
        // restores exactly where the view was, not just the city preset + zoom.
        const view = message.view;
        if (view && typeof view === 'object') {
            const current = busSharedState.mapView;
            busSharedState.mapView = {
                longitude: typeof view.longitude === 'number' ? view.longitude : current.longitude,
                latitude: typeof view.latitude === 'number' ? view.latitude : current.latitude,
                zoom: typeof view.zoom === 'number' ? view.zoom : current.zoom,
                bearing: typeof view.bearing === 'number' ? view.bearing : current.bearing,
                pitch: typeof view.pitch === 'number' ? view.pitch : current.pitch
            };
        }
        return;
    }

    if (payload.type === 'screen/segment-selection') {
        const message = payload as Partial<ScreenSegmentSelectionMessage>;
        if (!Array.isArray(message.indexes)) return;

        // Keep indexes deterministic for easier equality checks in clients and debugging.
        busSharedState.selectedSegmentIndexes = message.indexes
            .filter((value): value is number => Number.isInteger(value) && value >= 0)
            .slice()
            .sort((a, b) => a - b);
        return;
    }

    if (payload.type === 'screen/map-style') {
        const message = payload as Partial<ScreenMapStyleMessage>;
        if (message.style === 'topo' || message.style === 'satellite') {
            busSharedState.mapStyle = message.style;
        }
    }
}

export const Route = createFileRoute('/bus')({
    server: {
        handlers: {
            GET: async () => {
                // HTTP fallback response: this endpoint is a websocket upgrade target.
                return Object.assign(
                    new Response('WebSocket upgrade is required.', {
                        status: 426
                    }),
                    {
                        crossws: hooks
                    }
                );
            }
        }
    }
});

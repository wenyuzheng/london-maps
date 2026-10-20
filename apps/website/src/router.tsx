import { createRouter } from '@tanstack/react-router';

import { DefaultCatchBoundary } from './components/default-catch-boundary';
import { DefaultNotFound } from './components/default-not-found';
import { routeTree } from './routeTree.gen';

export function getRouter() {
    const basepath = import.meta.env.BASE_URL;
    const router = createRouter({
        routeTree,
        basepath,
        defaultPreload: 'intent',
        defaultErrorComponent: DefaultCatchBoundary,
        defaultNotFoundComponent: DefaultNotFound,
        // Scroll restoration uses sessionStorage, which is unavailable in Vizzy's sandbox.
        scrollRestoration: !basepath.startsWith('/serve/'),
        defaultStructuralSharing: true
    });
    return router;
}

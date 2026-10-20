import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

const fetch = createStartHandler((context) => {
    // The sandbox has an opaque origin, so protected module assets need the
    // project's credentialed cookie even though their URL uses Vizzy's host.
    for (const route of Object.values(context.router.ssr?.manifest?.routes ?? {})) {
        for (const asset of route.assets ?? []) {
            if (asset.tag === 'script' && asset.attrs?.type === 'module') {
                asset.attrs.crossOrigin = 'use-credentials';
            }
        }
    }
    return defaultStreamHandler(context);
});

export default { fetch };

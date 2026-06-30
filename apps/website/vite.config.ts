import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
    base: process.env.BASE_PATH ?? '/',
    resolve: {
        tsconfigPaths: true
    },
    server: {
        port: 5781,
        watch: {
            usePolling: true,
            interval: 100
        }
    },
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            cssModules: true
        }
    },
    plugins: [
        devtools({
            consolePiping: { enabled: false }
        }),
        tanstackStart(),
        // https://tanstack.com/start/latest/docs/framework/react/guide/hosting
        nitro({
            features: { websocket: true },
            baseURL: process.env.BASE_PATH ?? '/'
        }),
        viteReact(),
        // https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#react-compiler
        babel({
            presets: [
                reactCompilerPreset({
                    target: '19'
                })
            ]
        }),
        tailwindcss()
    ]
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const GITHUB_PAGES_BASE = '/EDITOR-REELS-VIRAL-BORDAS/';
const rootDir = path.dirname(fileURLToPath(import.meta.url));

function devRootRedirectPlugin(): Plugin {
  const redirectMiddleware = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void },
    next: () => void
  ) => {
    if (req.url === '/' || req.url === '') {
      res.statusCode = 302;
      res.setHeader('Location', GITHUB_PAGES_BASE);
      res.end();
      return;
    }
    next();
  };

  return {
    name: 'dev-root-redirect',
    configureServer(server) {
      server.middlewares.use(redirectMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectMiddleware);
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/EDITOR-REELS-VIRAL-BORDAS/',
    plugins: [
      react(),
      tailwindcss(),
      devRootRedirectPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: GITHUB_PAGES_BASE,
          name: 'WiFive Pro Studio',
          short_name: 'WiFive',
          description:
            'Editor de cortes virais com molduras HD, recorte, efeitos visuais e áudio direto no navegador.',
          lang: 'pt-BR',
          theme_color: '#060913',
          background_color: '#060913',
          display: 'standalone',
          orientation: 'any',
          start_url: GITHUB_PAGES_BASE,
          scope: GITHUB_PAGES_BASE,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: [
            '**/*.zip',
            '**/CODIGO_FONTE_GERAL.txt',
            '**/assets/linuxPackageBase64-*.js',
            '**/assets/sourcePackageBase64-*.js',
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

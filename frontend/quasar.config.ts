import { configure } from 'quasar/wrappers';
import fs from 'fs';
import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default configure(() => {
  return {
    boot: ['axios', 'powersync', 'auth'],

    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },
      vueRouterMode: 'history',
      vitePlugins: [
        [wasm()],
        [topLevelAwait()],
      ],
      extendViteConf(viteConf) {
        viteConf.optimizeDeps = viteConf.optimizeDeps || {};
        viteConf.optimizeDeps.exclude = [
          ...(viteConf.optimizeDeps.exclude || []),
          '@journeyapps/wa-sqlite',
          '@powersync/web',
        ];
        viteConf.worker = viteConf.worker || {};
        viteConf.worker.format = 'es';
        viteConf.worker.plugins = () => [wasm(), topLevelAwait()];
        // Bundle all PowerSync packages (shipped as unbundled ESM) into ONE chunk.
        // Default chunk-splitting scatters `PowerSyncDatabase extends
        // AbstractPowerSyncDatabase` and its base class across chunks whose init
        // order is circular, so the base is `undefined` at class-definition time in
        // the production build ("Class extends value undefined"). Dev works because
        // it serves raw ESM. One chunk = correct intra-chunk ordering.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viteConf.build = (viteConf.build || {}) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rollupOptions: any = (viteConf.build.rollupOptions =
          viteConf.build.rollupOptions || {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addPowerSyncChunk = (o: any) => {
          o.manualChunks = (id: string): string | undefined =>
            /[\\/]node_modules[\\/](@powersync|@journeyapps)[\\/]/.test(id)
              ? 'powersync'
              : undefined;
        };
        rollupOptions.output = rollupOptions.output || {};
        if (Array.isArray(rollupOptions.output)) {
          rollupOptions.output.forEach(addPowerSyncChunk);
        } else {
          addPowerSyncChunk(rollupOptions.output);
        }
        // Inline the API base URL at build time when provided via the environment
        // (e.g. the Docker image build). Guarded so local dev keeps using .env.
        if (process.env.VITE_API_URL) {
          viteConf.define = {
            ...(viteConf.define || {}),
            'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
          };
        }
      },
    },

    devServer: {
      open: false,
      ...(() => {
        // Set DEV_HTTP=1 to serve plain HTTP on http://localhost (a secure
        // context, so PowerSync still works) — avoids mixed-content blocking
        // when PowerSync is served over HTTP.
        if (process.env.DEV_HTTP === '1') return {};
        const keyPath = path.resolve(__dirname, '../certs/localhost-key.pem');
        const certPath = path.resolve(__dirname, '../certs/localhost-cert.pem');
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
          return {
            https: {
              key: fs.readFileSync(keyPath),
              cert: fs.readFileSync(certPath),
            },
          };
        }
        console.warn(
          '[devServer] No certs found at ../certs/. Running without HTTPS. ' +
          'Run scripts/generate-certs.sh to enable HTTPS.',
        );
        return {};
      })(),
    },

    framework: {
      config: {
        dark: false,
      },
      plugins: ['Notify', 'Dialog', 'Loading'],
    },

    animations: [],

    ssr: {
      pwa: false,
      prodPort: 3000,
      middlewares: ['render'],
    },

    pwa: {
      workboxMode: 'InjectManifest',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false,
      extendManifestJson(json) {
        Object.assign(json, {
          name: 'HitFactor',
          short_name: 'HitFactor',
          description: 'USPSA Match Management - Offline-First Scoring',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#1976d2',
          start_url: '/',
          icons: [
            { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
            { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        });
      },
      extendInjectManifestOptions(cfg) {
        // Don't precache source maps
        cfg.globIgnores = cfg.globIgnores || [];
        cfg.globIgnores.push('**/*.map');
      },
      extendPWACustomSWConf(cfg) {
        cfg.sourcemap = false;
      },
    },
  };
});

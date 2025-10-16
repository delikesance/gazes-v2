// Plugin pour injecter les polyfills nécessaires côté client
// Ce plugin s'exécute uniquement côté navigateur pour éviter les erreurs SSR

export default defineNuxtPlugin({
  name: 'polyfills',
  setup() {
    // Polyfills pour les variables globales Node.js
    if (process.client) {
      // Assurer que global existe
      if (typeof (window as any).global === 'undefined') {
        (window as any).global = globalThis;
      }

      // Assurer que process existe avec un objet env complet
      if (typeof (window as any).process === 'undefined') {
        (window as any).process = {
          env: {
            NODE_ENV: 'production'
          },
          browser: true,
          version: '',
          versions: {},
          platform: 'browser',
          nextTick: (fn: Function) => setTimeout(fn, 0),
          title: 'browser',
          argv: [],
          pid: 1
        };
      }

      // Buffer polyfill si nécessaire
      if (typeof (window as any).Buffer === 'undefined') {
        try {
          const { Buffer } = require('buffer');
          (window as any).Buffer = Buffer;
        } catch (e) {
          // Buffer polyfill non disponible, créer un stub minimal
          (window as any).Buffer = {
            from: (data: any) => new Uint8Array(data),
            isBuffer: () => false,
            alloc: (size: number) => new Uint8Array(size),
            allocUnsafe: (size: number) => new Uint8Array(size)
          };
        }
      }

      // Stub pour exports si nécessaire
      if (typeof (window as any).exports === 'undefined') {
        (window as any).exports = {};
      }

      if (typeof (window as any).module === 'undefined') {
        (window as any).module = { exports: {} };
      }
    }
  }
});

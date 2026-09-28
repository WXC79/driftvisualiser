# DRIFT 13.14 — No Splash + Cache Reset

This build removes the opening splash screen completely.

Important cache fix:
- 13.13 itself had no splash, but an older service worker could continue serving
  a cached 13.12/13.11 index.html.
- 13.14 unregisters all existing service workers and clears DRIFT browser caches.
- service-worker.js is now a self-destruct worker so an older cached page that
  still registers it will purge the legacy cache and unregister itself.
- DRIFT no longer installs a persistent service worker in this build.

Preserved:
- text-only menu header: Drift / Generative Cloud Visualizer
- bundled showcase track
- hard background audio stop on app leave
- landscape menu fitting
- double tap visual to toggle controls
- landscape recommendation helper text
- no touch-cloud system
- Night scene fix
- portrait fullscreen workaround
- sustained-rhythm response
- current app icon/logo assets

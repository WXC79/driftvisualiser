# DRIFT 13.20 — Menu + Cache Fix

Built from 13.19.

Changes:
- Desktop X close is now handled on pointerdown and click in capture mode.
- Mouse movement no longer reopens the controls after closing them.
- On desktop, click the visual to reopen controls.
- Menu title is exactly: D R I F T
- VISUAL SETTINGS turns white on hover/focus.
- VISUAL SETTINGS has a real inline hover tooltip explaining its controls.
- Added cache-control meta hints.
- Added `drift-13-20.html`, a versioned test page that bypasses a stale cached
  root `index.html` when diagnosing GitHub Pages/browser caching.

Preserved:
- cursor auto-hide
- browser/fullscreen playback fix
- playlist support
- Free Drift
- exact home-screen artwork
- AUTO/manual scene controls
- landscape menu fitting

# DRIFT 12.12.1 — Touch Clouds repair pass

Based on 12.12.0.

Fixes:
- Restores double-tap menu reveal on iPhone/touch devices using a proper tap-vs-hold split:
  - quick taps = tap / double tap
  - hold = cloud generation
- Removed the two-finger reopen gesture from the interaction flow.
- Added stronger suppression of iPhone text-selection / copy / translate callouts on the visual.
- Improved fullscreen / viewport fill by sizing the app from the live innerHeight and applying that size to the canvas and overlay.
- Touch clouds can continue building for longer while held / dragged, with a larger touch-cloud history.

What stays the same:
- touch clouds still grow while being dragged and lock into the scene on release
- scene tuning and pacing from 12.12.0

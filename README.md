# DRIFT 13.2 — No-Touch Stable Build

Built from 13.1, with the touch-cloud system removed completely.

Preserved:
- flattened / improved Night scene from 13.0
- portrait fullscreen workaround
- current DRIFT icon / logo assets
- boutique cloud Play/Pause control
- sustained-rhythm audio response
- improved Play/Pause state synchronization
- background audio guard that prevents the brief audio burst when returning to the app
- iOS long-press / text-selection suppression
- double-tap visual to show/hide controls
- established camera speed, renderer quality, and scene timing

Removed:
- touch-cloud shader uniforms
- touch-cloud world state
- touch-cloud growth / drag logic
- touch-cloud menu toggle
- all per-frame touch-cloud calculations

This is the performance-focused version 13 baseline.

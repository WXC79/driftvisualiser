# DRIFT 13.1 — Touch Fixed + Transport Fixed

Built directly from 13.0.

Fixes:
- Touch Clouds now has an explicit ON/OFF checkbox in Visual Settings (default ON).
- Touch handling is bound at document level and accepts both the WebGL canvas and the empty UI backdrop, avoiding iOS routing the gesture to the transparent menu shell.
- Hold threshold reduced to ~160 ms.
- Initial wisp is stronger but still faint.
- Continued hold grows both radius and density with no short ceiling.
- Drag trail is denser, smoother, and spawns with closer spacing.
- Touch density now has a guaranteed noisy volumetric contribution, so it remains visible even in an open patch of sky.
- iOS selection/callout suppression retained.

Transport:
- Play/Pause icon state no longer depends on `readyState >= 2`.
- Button updates optimistically on Play, then reconciles with the real audio state.
- Added `playing` and `canplay` synchronization.
- Guards against overlapping rapid Play/Pause taps.
- Background audio mute/pause/suspend protection retained.

Night:
- 13.0 flattened Night background retained.

No other scene/timing changes.

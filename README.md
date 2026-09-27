# DRIFT 13.7 — Showcase Playback Fix

This build targets the showcase-audio failure seen on iPhone.

Changes:
- The Cloud — Chris Weeks is now a 160 kbps MP3 (higher quality than the 128 kbps test).
- MP3 remains below GitHub's 25 MB browser-upload limit.
- Service worker now completely bypasses audio files and HTTP Range requests.
  This lets Safari/iOS handle MP3 streaming and byte-range requests natively.
- Playback no longer waits on Web Audio / analyser setup.
- Added explicit media-error reporting in the DRIFT status line.
- Initial menu remains pinned until X or outside-panel tap.

Preserved:
- no touch-cloud system
- Night fix
- portrait fullscreen fix
- improved transport-state handling
- background-audio return guard
- sustained-rhythm visual response

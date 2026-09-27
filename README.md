# DRIFT 13.6 — Showcase MP3 + Pinned Initial Menu

Built from the no-touch version 13 line.

Showcase audio:
- The Cloud — Chris Weeks
- real MP3 at 128 kbps
- bundled file is about 18.7 MB, keeping the full GitHub package below 25 MB
- no autoplay
- user audio immediately replaces the showcase for the current session

Playback fix:
- on iPhone/iOS, audio.play() is initiated immediately inside the Play-button gesture
- AudioContext resume happens alongside playback rather than before it
- this avoids losing iOS user activation while waiting for the audio context
- showcase audio is explicitly loaded on startup

Initial menu behavior:
- the menu no longer auto-hides when DRIFT first opens
- it remains visible indefinitely until the user presses X or taps outside the panel
- after that first dismissal, the existing normal auto-hide behavior resumes
- double-tap still toggles the controls

Preserved:
- no touch-cloud system
- Night fix
- portrait fullscreen workaround
- transport-state fixes
- background-audio return guard
- sustained-rhythm response
- current icon/logo

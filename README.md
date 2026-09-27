# DRIFT 12.11.7 — operation polish

Based directly on the 12.11.6 visual benchmark.

Changes:
- Visual rendering, scene look, cloud speed and forward travel are unchanged.
- When the app leaves the foreground, playback is explicitly paused so the transport state cannot remain stuck showing Pause after audio has stopped.
- On return/focus, the Play/Pause button is reconciled with the actual audio state.
- Tapping the area behind/outside the menu panel now closes the menu, so the X is no longer required when scrolled down.
- Wake-lock behavior is retained while playback is active.
- No playlist / multi-track code.

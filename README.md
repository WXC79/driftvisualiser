# DRIFT 13.9 — Exact Approved Splash Lockup

This build fixes the opening screen by using a single vector lockup traced directly from the user's approved reference image.

Opening screen:
- exact approved logo/text proportions and alignment
- logo + DRIFT + Touch to Drift are one vector asset
- centered in portrait
- centered in landscape
- no independent text scaling, so alignment cannot drift again

Audio:
- leaving the app now forces:
  - muted = true
  - volume = 0
  - Web Audio output gain = 0
  - pause()
  - AudioContext suspend
- returning does not restore audio
- explicit Play restores volume/mute/output gain

Everything else from 13.8 is preserved.

# DRIFT 13.15 — Home Screen + Free Drift

Built from 13.14.

Changes:
- Restores the home screen using the user's supplied `DRIFT Homescreen.png`
  as ONE complete artwork image. No typography, logo geometry, spacing or
  alignment is reconstructed in code.
- Replaces the old visual reseed button with FREE DRIFT.
- FREE DRIFT:
  - requires no music
  - stops any playing audio
  - forces AUTO scene mode
  - disables visual-setting changes while active
  - generates its own slow, randomized internal mood/activity signal
  - evolves indefinitely through the existing scene system
- Fixes the malformed extra closing DIV in the menu markup.
- Strengthens landscape phone menu fitting and adds internal scrolling if
  expanded settings exceed the available height.
- Fullscreen is retained as a secondary browser utility.

Not included yet:
- multi-track playlist support

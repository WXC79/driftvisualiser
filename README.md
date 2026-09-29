# DRIFT 14 — Final Build

Final release candidate built from 13.20.

Final fixes:
- Removed the browser-native Visual Settings tooltip so only the custom DRIFT
  explanation appears on hover.
- Menu auto-hide increased from 6 seconds to 12 seconds of inactivity.
- On desktop, the menu will not auto-hide while the pointer is over the control panel.
- Pointer/input/change activity resets the inactivity timer.
- X still closes the menu immediately.
- Clicking outside the panel still dismisses it.
- Desktop visual click still reopens the controls.

Preserved:
- D R I F T menu title
- playlist / previous / next / automatic track advance
- Free Drift
- AUTO/manual scene controls
- cursor auto-hide
- browser/fullscreen playback fix
- landscape phone menu fitting
- exact user-supplied home screen
- showcase track


## 14.1 display fix
Removed the CSS radial vignette overlay that could produce visible contour/banding rings when the controls panel was open. No cloud-generation behavior was changed.

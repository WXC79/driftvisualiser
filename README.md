# DRIFT 13.0 — Touch Clouds

Built from 12.11.17.

Preserved:
- 12.11.16 portrait fullscreen workaround
- current logo/icon assets
- boutique cloud Play/Pause control
- sustained-rhythm audio response
- existing scene timing and camera pacing

13.0 changes:

## Night
- much flatter near-black / dark-blue background
- reduced broad contour-band appearance
- narrower, more local moon haze
- retained intermittent moonlit cloud edges and bursts

## Touch
- quick double-tap toggles controls
- press-and-hold (~280 ms) starts as a very faint local wisp
- continued hold slowly gathers density and expands with no short artificial size ceiling
- dragging moves the source through the scene and lays a soft overlapping trail
- released clouds remain in world space, so normal camera travel can approach and pass through them
- touch density is injected into the existing volumetric noise field rather than drawn as a 2D cloud sprite
- iOS long-press selection / Copy-Look Up menu is suppressed

## Background audio
- when DRIFT is hidden, audio is muted before pause and the AudioContext is suspended
- returning to DRIFT does not auto-unmute or auto-resume
- only an explicit Play tap re-enables audio
- intended to eliminate the brief old-audio burst seen when returning to the app

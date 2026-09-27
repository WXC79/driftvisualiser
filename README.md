# DRIFT 12.11 — Scene colour integration build

This update keeps the 12.10 pacing and Home Screen behaviour, but refines scene tonality and the way clouds inherit colour from the environment.

## Main changes

- Thunderstorm background is deeper and weightier.
- Night has more grain / mist / haze.
- Night and Sunset are less likely to generate bright bleached-white clouds.
- Clouds borrow more pigment from the current scene, so they feel more affected by the surrounding light and colour.
- Night remains more fully night, with reduced blue-sky leakage.

## Update GitHub Pages

Replace the files in your repo root with the contents of this package and commit.

The service-worker cache name has been updated so Home Screen installs should pick up the new version more reliably.

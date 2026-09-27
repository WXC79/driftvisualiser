# DRIFT 12.12.2 — true-fullscreen repair

Built directly from 12.12.1.

Fullscreen changes:
- Removes the innerHeight-based sizing that was leaving a black strip on iPhone.
- In Home Screen / standalone mode, DRIFT sizes itself to the full physical CSS screen dimensions.
- WebGL now renders from the actual canvas bounds rather than window.innerHeight.
- Manifest display mode changed to `fullscreen` with `standalone` fallback.
- Keeps `viewport-fit=cover` so the visual can extend through iPhone safe areas.
- Service-worker cache bumped.

Touch-cloud behaviour and scene tuning are unchanged from 12.12.1.

IMPORTANT:
Because the manifest display mode changed, iPhone may require deleting the old Home Screen icon and adding DRIFT to the Home Screen again once for the new fullscreen manifest to take effect.

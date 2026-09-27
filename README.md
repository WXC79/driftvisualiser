# DRIFT 12.9 — Slower transitions / slower cloud evolution

This build keeps the 12.8 Home Screen/PWA packaging and changes the pacing.

## Changes

- AUTO scene transitions are now roughly **38–62 seconds** long, using a gentler quintic crossfade.
- A scene now dwells for roughly **42–86 seconds after the transition** before AUTO chooses another state.
- Manual scene changes crossfade over about **18 seconds** instead of 8.
- Internal cloud formation/evolution is slowed by roughly **20–25%**.
- Forward travel speed is intentionally left alone; this change targets cloud morphing/generation rather than the feeling of moving through the field.
- Home Screen / standalone mode remains included.

## GitHub Pages update

Replace the files in your repo root with the contents of this package and commit. The service worker cache name was also bumped so the new files should replace the prior cached build.

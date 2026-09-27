# DRIFT 12.12.2 — repair build

This build is specifically aimed at the “nothing is generating” regression.

Changes:
- Restores the known-good DRIFT 12.11 cloud-generation/motion speed.
- Keeps the 12.12 scene colour refinements.
- Keeps multi-track selection, sequence playback and shuffle.
- Defers Web Audio graph creation until Play for better mobile/iPhone reliability.
- Fixes playlist auto-advance.
- Version-busts app.js/style.css and bumps the service-worker cache.
- Shows an on-screen error message if a JavaScript runtime error occurs.

Upload the full package to the GitHub Pages repo root and commit.

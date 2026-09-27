# DRIFT 12.8 — Home Screen / PWA build

This update keeps the 12.7 behaviour and adds proper web-app packaging for phones.

## New in 12.8

- Web App Manifest
- iPhone Home Screen icon
- Android/Chrome install metadata
- standalone app display mode
- service worker for the core site files
- safe-area handling for standalone iPhone use

## Upload/update on GitHub Pages

Replace/add these files in the root of your GitHub repository:

- index.html
- style.css
- app.js
- manifest.webmanifest
- service-worker.js
- apple-touch-icon.png
- icon-192.png
- icon-512.png

Commit the changes and wait for GitHub Pages to redeploy.

## iPhone Home Screen

Open the live DRIFT page in Safari, choose Share, choose Add to Home Screen, enable Open as Web App if offered, then tap Add.

Launching DRIFT from the new Home Screen icon removes the ordinary Safari browser chrome and gives the closest iPhone experience to a true fullscreen app.

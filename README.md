# DRIFT 12.11.16 — Portrait Gap Workaround + New Icon

Built directly from the locked 12.11.15 baseline.

Scene design:
- UNCHANGED from 12.11.15.

New brand icon:
- Uses the current locked DRIFT black geometric D with white cloud cutout.
- Rebuilt at 180, 192, 512 and 1024 px for Home Screen / PWA use.

Portrait Home Screen workaround:
- Keeps `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style=black-translucent`.
- In installed standalone mode, compares the reported viewport height with `screen.height`.
- If iOS reports the shorter portrait viewport, DRIFT sizes its visual shell to the larger physical CSS screen height.
- WebGL now renders to the actual CSS canvas bounds instead of blindly using `innerHeight`.
- Includes `100lvh + safe-area-inset-bottom` CSS fallbacks.
- Adds console-only viewport diagnostics for future debugging.

Important limitation:
Current iOS 26 has a confirmed WebKit bug where, on some devices, a portrait Home Screen app gets a system-drawn bottom gap outside the web layer. If the black band remains on this build, that specific area cannot be painted by HTML/CSS/WebGL; it is an OS/WebKit compositor issue rather than a DRIFT layout issue.

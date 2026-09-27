# DRIFT 12.12.3 — fullscreen rollback + touch isolation

This build deliberately goes back to the exact fullscreen/layout system used by
12.11.8, the last confirmed build with no black strip.

The touchscreen cloud feature remains, but:
- there are NO dynamic viewport / innerHeight / screen-height fullscreen hacks;
- the manifest remains the same standalone mode used by 12.11.8;
- the canvas keeps the exact 12.11.8 fixed inset / 100% layout;
- `touch-action:none` has been removed;
- iPhone callouts are suppressed only on the canvas with event prevention;
- quick double tap reopens the menu;
- hold generates clouds;
- drag keeps generating;
- release leaves the generated cloud in the world;
- touch history increased to 32 cloud stamps and hold growth continues for longer.

This is an isolation build: the fullscreen layout is intentionally returned to the
known-good pre-touch implementation so the touch feature cannot alter viewport sizing.

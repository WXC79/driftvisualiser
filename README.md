# DRIFT 12.11.5 — benchmark refinement

Based directly on the 12.11.4 benchmark.

Changes:
- Keeps the 12.11.4 cloud-generation and forward-travel speeds unchanged.
- Requests a screen wake lock while music is actively playing, and releases it on pause/end.
- Reacquires the wake lock when returning to the foreground.
- Night scene gets occasional stronger cool moonlight haze and brighter cloud-edge illumination.
- No playlist / multi-track code.

Note: screen wake lock depends on browser/OS support and may still be overridden by the operating system in exceptional cases.

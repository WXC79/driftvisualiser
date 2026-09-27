# DRIFT 12.11.14 — Sunlight Beams compile fix

This is 12.11.13 with the shader compile error corrected.

Cause:
- The new sunbeam code used `cloudImmersion` before GLSL had declared it.
- The declaration is now above the sunbeam block.
- The later duplicate declaration was removed.

No visual tuning was otherwise changed from 12.11.13.

# C11 Discrepancy Resolution

**Date**: 2026-08-14

## Discrepancy

Preliminary output reported C11 cylindrical face `vc=57` with token prefix `[1,0,0,150,1,150,0,0,150,0]`.

Final summary reports C11 `vc=64` and the same alternating token pattern as C04/C05.

## Investigation

Parsed C11 SLDPRT directly using parser-core.js:

- **Face 5**: ec=7, vc=57, secCount=11, b1Len=92
  - Tokens: `1, 0, 0, 150, 1, 150, 0, 0, 150, 0, 62, 0, 150, 0, 0, 150, 1, 0, 0, 150`
  - This is NOT the cylindrical face (ec=7 suggests 7 edges, secCount=11 suggests 11 loops)

- **Face 6**: ec=64, vc=64, secCount=1, b1Len=126
  - Tokens: `1, 0, 150, 0, 153, 0, 150, 0, 153, 0, 150, 0, 153, 0, 150, 0, 153, 0, 150, 0`
  - This IS the cylindrical face (ec=64 suggests 64-segment tessellation, secCount=1 suggests single loop)

## Conclusion

The preliminary output incorrectly identified face 5 (vc=57) as the cylindrical face. The actual cylindrical face is face 6 (vc=64).

The final summary in EXP030_SUMMARY.md is correct: C11 cylindrical face has vc=64 and the same alternating token pattern (150, 153) as C04/C05.

## Root Cause

The preliminary output likely confused face indices or misidentified the cylindrical face based on vc alone. The correct identification should use ec (edge count) and secCount (section count) in addition to vc:
- Cylindrical faces have ec = vc (64 segments for 64 vertices)
- Cylindrical faces have secCount = 1 (single loop)
- Non-cylindrical faces have ec < vc and secCount > 1

## Resolution

No documentation changes needed. The final summary is correct.

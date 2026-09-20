# parser/v0.1 Summary: First Read-Only Geometry Parser & Viewer

**Date:** 2026-08-13
**Relocated:** 2026-08-14 -- this parser was produced as `v0.5/` in the research-version progression and has been moved to `parser/v0.1/` (dedicated parser versioning). Content below is unchanged.
**Objective:** Build the first read-only SLDPRT geometry parser and browser visualizer from the validated research state through v0.4.6, without modifying prior research or reinterpreting unresolved hypotheses as facts.

This is implementation work, not a new research experiment. See `README.md` for full architecture rationale and scope.

## What was built

- `src/parser-core.js` -- isomorphic (Node + browser) extraction pipeline, reusing verbatim the corrected Block1->Block2 offset arithmetic from v0.4.5 and the INV-016/017/018 checks from EXP-024-CORRECTED, plus a normals unit-length check (INV-003) that EXP-024-CORRECTED did not include.
- `src/node-cli.js` -- Node CLI wrapper (fs/zlib plumbing only).
- `web/index.html` + `web/viewer.js` -- browser viewer: drag-and-drop, file picker, orbit/pan/zoom, shaded mesh, wireframe toggle, vertex/normal toggles, face selection (via face list and 3D raycasting), selected-face metadata (offsets, edge/vertex counts, section info), clearly displayed parser errors, and a rejected-candidates panel with category breakdown.
- `test/run-corpus-tests.js` -- aggregate parity test against published v0.4.5/v0.4.6 numbers.
- `test/compare-with-reference.js` -- per-face parity test against the actual `../../v0.4.5/EXP023_RESULTS_CORRECTED.json` data (not just totals).

## Test results

Both test scripts pass with **zero mismatches** against the existing corpus:

- 1,172/1,172 valid faces across the 7 files with usable DisplayLists (identical to v0.4.5/v0.4.6).
- Reject-category totals identical to EXP-024-CORRECTED (INVALID_EC 2,344; INVALID_VC 1,172).
- 0 INV-016/017/018 failures on any of the 1,172 faces.
- 0 faces removed by the added INVALID_NORMALS check (expected: EXP-019 found max normal deviation 4.14e-8, far inside the 0.001 tolerance).
- Per-face cross-check: all 1,172 `(file, mp)` pairs in the v0.4.5 reference JSON match the parser v0.1's output exactly on `edgeCount`, `vertexCount`, and `secCount`.
- SW2000-s01.SLDPRT (OLE2) correctly detected and rejected with a clear, specific error, not silently skipped.

Browser verification (headless Chromium, real corpus files, see `README.md` "Using it"): file load -> parse -> stats -> face list -> face selection -> metadata panel -> all view toggles -> canvas raycasting selection, all confirmed working with no console/network errors, before this was called functional.

## Facts

1. Parser v0.1 reproduces 1,172/1,172 faces from the v0.4.5/v0.4.6 corpus exactly (marker offset, edge count, vertex count, section count).
2. Adding an INV-003-backed normals check removes 0 faces from the known-good corpus.
3. Positions, normals, Block1 body, Block2 body, and all source offsets are preserved on every extracted face record -- nothing is discarded to produce a mesh.
4. Rejected candidates are classified into the same category taxonomy as EXP-024-CORRECTED (plus 2 new invariant-backed stages: OVERFLOW_NORMALS, INVALID_NORMALS) and are never silently dropped -- every non-VALID candidate is retained with its category and available metadata.

## Hypotheses (explicitly not promoted to facts)

1. **Sequential loop segmentation for rendering** (`loopModel: 'sequential-assumed'`). INV-007 proves loop sizes sum to vertex count; it does not establish vertex-to-loop membership or ordering. Used only for the viewer's triangle mesh, never presented as verified. See OQ-019 (new).

## Observed (not a new invariant, a rendering result worth recording)

Single-loop faces (`secCount=1`) render as clean, plausible geometry under the sequential-segmentation hypothesis. High-`secCount` faces (e.g. Dekor's `secCount=1044` faces) render as a visually chaotic starburst. This is consistent with, but does not prove, the ordering hypothesis being wrong for multi-loop faces -- other causes (loops not being simple polygons, fan triangulation itself being inappropriate) are not ruled out. Recorded as OQ-019, not a falsification.

## Falsified / Corrected Claims

None. This is a construction task on top of already-corrected research (v0.4.5/v0.4.6); no prior claim was found to be wrong during this work.

## Claims Unaffected / Still Standing

All v0.4.x invariants and the v0.4.5/v0.4.6 corrections stand unchanged; this directory adds a consuming implementation, not a re-derivation.

## Newly Discovered Questions

- **OQ-019** (new): Is the sequential loop-segmentation assumption used for rendering correct? See `../../knowledge/OPEN_QUESTIONS.md`.

## Recommendation

The parser/viewer is functional for its stated scope (openswx-format face geometry, read-only) and passes exact parity tests against the validated research. The next research-worthy step, if the project wants better-looking multi-loop rendering, is a targeted experiment on OQ-019 (vertex-to-loop membership) -- not further viewer polish, which would only be decorating an unresolved hypothesis. Converter/writing functionality remains explicitly out of scope per the task that produced this directory.

## Files Created

- `README.md`, `SUMMARY.md` (this file), `package.json`
- `src/parser-core.js`, `src/node-cli.js`
- `web/index.html`, `web/viewer.js`
- `test/run-corpus-tests.js`, `test/compare-with-reference.js`
- `../../knowledge/evidence/2026-08-13_v0.5-parser-validation.md`

Created originally under `v0.5/` (2026-08-13); relocated to `parser/v0.1/` (2026-08-14).

No file outside the original `v0.5/` (now `parser/v0.1/`; other than the append-only knowledge-base updates listed in the evidence file) was modified. No file under any research version directory (`v0.2.x`-`v0.4.6`) was touched.

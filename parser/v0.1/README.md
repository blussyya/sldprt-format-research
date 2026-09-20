# parser/v0.1: SLDPRT Geometry Parser & Viewer (read-only prototype)

**Date:** 2026-08-13
**Relocated:** 2026-08-14 -- moved from `v0.5/` (research versioning) to `parser/v0.1/` (dedicated parser versioning), so the parser no longer occupies a slot in the research-version progression. All content below is unchanged from the v0.5 release.
**Status:** Prototype. Read-only. Does not write, convert, or claim full SLDPRT format support.

This is the first parser/visualizer built directly on the validated research
state through v0.4.6. It exists to let a person load a `.sldprt` file and
visually inspect what the reverse-engineering work has actually established
-- nothing more.

## What this is not

- Not a converter. There is no SLDPRT writer and no export path back into the
  SolidWorks format.
- Not a complete parser. It only extracts what `../../knowledge/KNOWN_INVARIANTS.md` has
  verified for face geometry in `Contents/DisplayLists`. Everything else in
  an SLDPRT file (metadata streams, feature trees, sketches, assemblies,
  `Config-0-Partition`, etc.) is untouched.
- Not a claim that the legacy OLE2 container (SW2000-era files) is
  supported. It isn't -- see "Scope" below.
- Not a claim that the rendered triangle mesh is topologically correct.
  See "The one rendering hypothesis" below -- this is the part of the
  system most likely to be wrong, and it says so in the UI.

## Architecture (why it's small)

Per the task that produced this directory ("determine the smallest
architecture that reuses the validated research without duplicating or
contradicting it"), there is exactly one parsing implementation:

```
parser/v0.1/
  src/parser-core.js   <- the ONLY place extraction/validation logic lives.
                          Isomorphic (Node + browser): no fs/zlib/DOM calls.
                          inflate is injected so the same code runs against
                          Node's zlib (CLI/tests) and pako (browser).
  src/node-cli.js       <- Node-only plumbing: fs + zlib + argv. Thin.
  web/index.html         web/viewer.js
                        <- Browser-only plumbing: pako/three.js/DOM. Thin.
                          Loads src/parser-core.js directly (same file, not
                          a copy) via <script src="../src/parser-core.js">.
  test/                 <- Corpus regression tests + reference comparison.
```

`parser-core.js` reimplements the pipeline already proven correct by
`../../v0.4.5/exp024_rejected_candidate_audit_corrected.js` (corrected Block1/
Block2 offset arithmetic, INV-016/017/018 checks) and
`../../v0.4.3/exp021_alternative_headers.js` (normals unit-length check). It does
**not** reuse the pre-v0.4 heuristic extractors in `v0.2.x`/`v0.3.x`
(`sldprt-extractor.js` et al.), which predate the Block1/Block2 grammar
research entirely and rely on ad hoc normal-discontinuity loop-splitting
heuristics that were later falsified (FH-005). Reusing that code would have
contradicted, not reused, the validated research. The `../../v0.2.2/web/viewer.html`
UI *pattern* (drag-drop, three.js, sidebar toggles) was used as a structural
reference for `web/index.html`, but every line of extraction logic is new
and traceable to a specific invariant or the v0.4.5 correction.

## Invariants relied on (all traceable to `../../knowledge/KNOWN_INVARIANTS.md`)

INV-001 (geometry in DisplayLists), INV-002 (face block layout), INV-003
(normals are unit vectors), INV-004 (gap marker), INV-005 (Block1 header
`[4,8,2,N]`), INV-006 (Block2 header `[4,8,2,M]`), INV-007 (loop-count
decode `(raw+2)/2`), INV-008/009 (ONE-delimited sections), INV-016/017/018
(structural length/sum relationships). The corrected Block1->Block2 offset
formula from v0.4.5 (`block2Start = block1Start + (N+4)*4`) is used
directly -- the buggy v0.4.4 formula does not appear anywhere in this
directory.

One addition beyond what EXP-024-CORRECTED checked: a normals unit-length
validation stage (`INVALID_NORMALS`), backed by INV-003/EXP-019 H1 but not
previously wired into that pipeline. Verified to remove 0 faces from the
known corpus (see `test/run-corpus-tests.js` and the evidence file).

## The one rendering hypothesis (clearly labeled, not a research conclusion)

To turn a face's flat vertex list into a triangle mesh for display, the
viewer needs to know which vertices belong to which loop (boundary). The
verified invariants do **not** establish this -- INV-007 only proves that
the loop sizes decoded from Block2 **sum** to the face's vertex count; it
says nothing about vertex-to-loop membership or ordering.

`parser-core.js` labels this explicitly: every face record has
`loopModel: 'sequential-assumed'`. The viewer segments the vertex array
sequentially by the decoded loop sizes (in Block2 order) and fan-triangulates
each segment. This is flagged in the UI (an always-visible hypothesis note)
and is **not** presented as verified.

**Empirical observation from this build** (not a new invariant -- an
observed rendering result, recorded here for the next researcher): faces
with `secCount=1` (single loop, e.g. USB hub case BOTTOM) render as clean,
recognizable geometry under this assumption. Faces with large `secCount`
(e.g. Dekor's `secCount=1044` faces) render as a chaotic, clearly-wrong
starburst pattern. This is consistent with -- not proof of -- the ordering
assumption being wrong for multi-loop faces. It is recorded as a new open
question, **OQ-019**, not promoted to a falsification, since a wrong
*rendering* could also come from other causes (e.g. loops not being simple
polygons, fan triangulation being inappropriate even with correct loop
membership, etc.). See `../../knowledge/OPEN_QUESTIONS.md` OQ-019.

Positions and normals themselves are exact, verified data (INV-002/003) --
only the *surface tessellation drawn between them* is a hypothesis. The
parser output preserves the raw vertex/normal arrays and raw Block1/Block2
body data regardless of whether triangulation succeeds, so nothing is lost
even where the render is wrong.

## Scope: what is explicitly unsupported

- **Legacy OLE2 container** (SW2000-s01.SLDPRT, plate4.sldprt,
  chainwheel.sldprt in the current corpus). `../../knowledge/RESEARCH_DASHBOARD.md`'s
  "Current Corpus" table already documents these as "OLE2, not parseable
  by current pipeline." `parseSLDPRT()` detects the OLE2 magic bytes and
  returns a clear, specific error -- it does not attempt to parse and does
  not silently produce empty/wrong output.
- Everything in an SLDPRT file besides face geometry in `Contents/
  DisplayLists` (feature trees, sketches, metadata streams, `Config-0-
  Partition`, `Config-0-LWDATA`, `MeshData`, `FeatureBodies`, etc.).
- Block1 VALUE-token semantics, the alternative `[4,8,2,N]` header's
  meaning, and every other item still marked UNKNOWN in
  `../../knowledge/OPEN_QUESTIONS.md`. None of this is interpreted anywhere in
  this directory.

## Using it

**CLI / stats:**
```
node src/node-cli.js "<file>.SLDPRT" [--json out.json]
```

**Tests** (regenerates nothing; only reads the existing corpus and the
existing v0.4.5 reference JSON):
```
npm test
```
Runs two checks:
1. `test/run-corpus-tests.js` -- aggregate parity with the published
   v0.4.5/v0.4.6 numbers (1,172 valid faces across 7 files, reject-category
   totals, 0 INV-016/017/018 failures, 0 faces lost to the new normals
   check).
2. `test/compare-with-reference.js` -- per-face parity: every one of the
   1,172 faces in `../../v0.4.5/EXP023_RESULTS_CORRECTED.json` is confirmed to
   exist in the parser v0.1's output at the identical marker offset, with
   identical `edgeCount`/`vertexCount`/`secCount`.

Both currently pass with **zero mismatches**.

**Viewer:** open `web/index.html` in a browser (serve it over HTTP if your
browser restricts local script loading; a plain `python3 -m http.server`
or `npx http-server` from the repo root works). Requires internet access
for the three.js/OrbitControls/pako CDN scripts (same approach as the
existing `../../v0.2.2/web/viewer.html` prototype in this repo). Drag a `.sldprt`
file onto it, or use the file picker.

Verified in a real headless-Chromium session against the actual corpus
(BOTTOM: 39/39 faces parsed, correct stats, face selection, all view
toggles; Dekor: 375/375 faces, canvas click-to-select via raycasting;
SW2000-s01: OLE2 correctly rejected with a clear error) before this was
called functional.

## Known limitations / honest gaps

- The rendering hypothesis above (OQ-019) is the main one.
- Rejected-candidate list in the UI is capped at 500 entries for DOM
  performance on large files; the category breakdown covers 100% of
  candidates regardless.
- No LOD/streaming: very large files parse and render everything at once.
  Fine for the current corpus (largest: Pocket Wheel, 400 faces, 1,600
  candidates); untested beyond that.
- `web/index.html` loads three.js/pako/OrbitControls from CDN links, same
  as the pre-existing `../../v0.2.2/web/viewer.html`. No bundler/build step
  exists in this repo; that's an intentional smallest-architecture choice,
  not an oversight.

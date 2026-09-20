# EXP-038: NQ-028 — C12 (Second-Edge Fillet) vs C00 and C03

**Date**: 2026-08-15
**Status**: Complete — NQ-028's core discriminating question is answered for the two edges tested
**Version**: v0.4.7

---

## Objective

Execute NQ-028's actual discriminating test using C12, a new controlled model supplied by the
user: the same `C00_cube_10mm` base cube with a 1mm fillet applied to the edge shared by the
-X and -Y faces — the edge diagonally opposite the one C03/C09 use (shared by +X and +Y).
Determine whether the Block1 token changes observed under fillet/chamfer move with the
physical fillet location (Hypothesis A, spatial/topological) or remain fixed on the same
serialized/orientation faces regardless of location (Hypothesis B, global/feature-type state).

## Model Verification

C12's files (`model.SLDPRT`, `model.step`, `model.STL`) were placed at
`test files original/controlled/C12_cube_fillet_1mm_edge2/`. Verified directly from the STEP
file before running any analysis:

- `MANIFOLD_SOLID_BREP('Fillet1', ...)` — a fillet feature, matching C03's feature type.
- `CYLINDRICAL_SURFACE` / `CIRCLE` radius = 1.0mm — matching C03's 1mm parameter exactly.
- Fillet axis location `(1, 1, z)` for z in [0, 10] — a vertical edge offset 1mm from the
  origin corner in both X and Y, i.e. the edge shared by the **-X and -Y** faces (cube corners
  at (0,0,z) are consumed; the untouched corners include (0,10,z), (10,0,z), (10,10,z)). This
  is the edge diagonally opposite C03's (+X/+Y) edge, as specified in
  `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §6.
- C12 parses cleanly with the unmodified `parser/v0.1/src/parser-core.js`: 7 faces. Face 6 has
  ec=13, vc=16, secCount=2 — the identical structural shape as C03's new face (also ec=13,
  vc=16, secCount=2).

This is the first script in this research thread verified directly against a real SLDPRT file
for the model under test, rather than only archived JSON (C00 and C03 are still only available
as archived JSON in this environment — see Method).

## Method

1. Parsed C12's `model.SLDPRT` directly using `parser/v0.1/src/parser-core.js` (read-only,
   unmodified) — full per-face vertices, Block1 tokens, Block2 body, ec/vc/secCount/b1Len.
2. Loaded C00 and C03 from already-archived `VERTEX_ANALYSIS.json` (full per-face vertices) and
   `EXP033_FEATURE_STATE.json` (full Block1 token arrays) — their own SLDPRT files are still
   not present in this environment.
3. Reused EXP-037's `computeAdjacency()` (real vertex/edge-sharing adjacency) verbatim.
4. Reused EXP-037's `matchFaces()` correspondence **strategy** (centroid-distance, explicit
   ambiguity flagging) with one validated refinement: bounding-box center instead of raw
   vertex-average centroid. See "Tooling Refinement" below — this was not a cosmetic choice,
   it was required to correctly classify C12's faces at all.
5. Cross-referenced token-changed faces (matched pairs, same ec/vc/secCount/b1Len, different
   Block1 tokens) against each model's own real within-model adjacency of its new face.

## Tooling Refinement: Centroid → Bounding-Box Center

EXP-037's `matchFaces()` used each face's raw vertex-average as its "centroid," with a 0.004m
match threshold. Applied unmodified to C12, this produced an incorrect result: C00's faces 4/5
(+Z/-Z), which keep the same topological identity after the fillet trims one corner, shifted by
up to **0.0046m** under vertex-averaging — over threshold, and uncomfortably close to the
~0.0045m distance from the genuinely new face (index 6) to its nearest unrelated C00 face. The
root cause: raw vertex-averaging is sensitive to tessellation density, and the newly-added
fillet arc's finely-subdivided vertices pull the average disproportionately.

Fix: use each face's **axis-aligned bounding-box center** instead (depends only on extent, not
point density). Re-measured across **all five** archived controlled pairs (C03, C09, C04, C10,
plus this new C12) before adopting it, not just C12:

| Pair | Max genuine same-face shift (bbox-center) |
|---|---|
| C00→C03 | 0.0000m (unaffected faces) / 0.0005m (trimmed faces) |
| C00→C09 | 0.0005m |
| C00→C04 | 0.0000m |
| C00→C10 | 0.0000m (the one 0.0071m same-*index* "shift" is a known index-shuffle artifact, not a same-face shift — see EXP-035) |
| C00→C12 | 0.0000m (untouched faces) / 0.0005m (trimmed faces) |

New face's distance to nearest unrelated existing face (both C03 and C12): ~0.0045m. Minimum
distinct-face separation within C00: ~0.0071m. A threshold of **0.002m** sits with ≥4x margin
on both sides across every tested pair — a data-driven fix, not tuned to produce a particular
NQ-028 answer. EXP-037's own file and results are unmodified; this refinement applies only
within `exp038_nq028_c12_second_edge.js`.

## Results

### Structural comparison, C00 vs C03 vs C12 (all matched, non-ambiguous, real correspondence)

| C00 face | Orientation | C03 (edge: +X/+Y) | C12 (edge: -X/-Y) |
|---|---|---|---|
| 0 | -X | **UNCHANGED** (identical vertices + tokens) | **CHANGED** (vertex-shifted; tokens `[1,5,82,0,79,62]`→`[1,5,160,0,79,62]`) |
| 1 | -Y | **UNCHANGED** (identical vertices + tokens) | **CHANGED** (vertex-shifted; tokens `[1,9,81,0,82,58]`→`[1,139,144,0,81,142]`) |
| 2 | +X | **CHANGED** (vertex-shifted; tokens `[1,13,80,0,81,54]`→`[1,13,160,0,81,54]`) | **UNCHANGED** (identical vertices + tokens) |
| 3 | +Y | **CHANGED** (vertex-shifted; tokens `[1,17,79,0,80,50]`→`[1,139,144,0,79,142]`) | **UNCHANGED** (identical vertices + tokens) |
| 4 | +Z | Structurally modified (ec/vc/secCount/b1Len all change; multi-loop) | Structurally modified (ec/vc/secCount/b1Len all change; multi-loop) |
| 5 | -Z | Structurally modified (ec/vc/secCount/b1Len all change; multi-loop) | Structurally modified (ec/vc/secCount/b1Len all change; multi-loop) |
| (new) | NON_AXIS | Face 6 added (ec=13, vc=16, secCount=2) | Face 6 added (ec=13, vc=16, secCount=2) |

For every "CHANGED" row above (2/3 in C03; 0/1 in C12): ec, vc, secCount, and b1Len are all
**identical** to C00 — only the Block1 token *values* differ, plus a small (~5×10⁻⁴m) vertex
position shift. This reproduces EXP-033's original C03 finding exactly, and shows the same
pattern holds, mirrored, for C12.

### Real within-model adjacency of the new face

| Model | New face's real adjacency (≥2 shared vertices), translated to C00 indices |
|---|---|
| C03 | {2, 3, 4, 5} — exactly +X, +Y, +Z, -Z |
| C12 | {0, 1, 4, 5} — exactly -X, -Y, +Z, -Z |

### NQ-028 cross-check

| Question | C03 | C12 | Same across models? |
|---|---|---|---|
| Token-changed-but-structurally-unmodified face indices | {2, 3} | {0, 1} | **NO** |
| Token-changed-but-structurally-unmodified face orientations | {+X, +Y} | {-X, -Y} | **NO** |
| Changed set == that model's own real-adjacency set (excl. directly-modified 4/5)? | YES | YES | — |

- Same face **index** set changed in both models? **False.**
- Same **orientation label** set changed in both models? **False.**
- C12's changed faces are exactly its own real-adjacency set, replicating C03's pattern? **True.**

## Hypothesis Verdict

**Hypothesis A (spatial/topological)** predicted: moving the fillet to a different edge moves
the affected faces to the faces bordering *that* edge. **Observed**: exactly this. The
changed-face set relocated from {+X, +Y} to {-X, -Y} — precisely the two faces now bordering
the new fillet edge — while remaining structurally unmodified (same ec/vc/secCount/b1Len) in
both cases, matching EXP-033's original signature-change pattern at a new location.

**Hypothesis B (global/feature-type state)** predicted: the same +X/+Y faces (or the same face
indices) change regardless of location. **Observed**: falsified as stated. +X/+Y are token-
**identical** to C00 in C12; the change moved to -X/-Y instead. Face index is also ruled out as
the mechanism (C03 changes indices {2,3}; C12 changes indices {0,1}).

**Classification: Strong Evidence for Hypothesis A over Hypothesis B as tested, n=2 independent
edge locations.** Not Verified/invariant-level — see "What This Does NOT Establish" below for
what remains open even after this result.

## What This Does NOT Establish (anti-overclaim)

1. **Mechanism.** This experiment shows *where* the effect occurs relocates with the edge; it
   does not show *why*. No claim is made about what Block1 tokens encode or why adjacency (or
   direct vertex modification — see next point) produces a different token value.
2. **Adjacency vs. direct modification are confounded for edge features.** The "changed"
   faces (2/3 in C03; 0/1 in C12) are not perfectly geometrically untouched: their vertex
   *positions* shift by a small amount (the fillet trims the shared boundary), even though
   their ec/vc/secCount/b1Len stay constant. Because a fillet, by construction, trims exactly
   the two faces bordering the filleted edge, "real topological adjacency to the new face" and
   "this face's own vertices were directly (if minutely) modified" pick out the *identical* set
   of faces in this corpus. This experiment cannot separate these two candidate explanations —
   both fit the data equally well. Distinguishing them would require a feature that creates a
   new adjacent face WITHOUT perturbing the neighboring face's own vertices at all, which no
   model in this corpus provides.
3. **Not a claim that "any vertex position change causes a token change."** EXP-034 already
   established that Block1 tokens are completely invariant under whole-model scale and
   translation, even though *every* vertex coordinate changes under those transforms. So the
   effect seen here is specific to a local, non-uniform (topology-adjacent) change, not
   triggered by vertex-coordinate change in general. This experiment does not resolve why
   uniform transforms behave differently from local trims.
4. **n=2 edge locations.** Both tested edges are vertical edges of the same cube, related by a
   symmetry of the cube (opposite corners). A horizontal edge (e.g. shared by +X and +Z) or an
   edge on a non-cube geometry is untested and could in principle behave differently.
5. **Not promoted to `KNOWN_INVARIANTS.md`.** Per project policy, a two-data-point correlation
   — however clean — is not invariant-level evidence.

## Files Tested

- `test files original/controlled/C12_cube_fillet_1mm_edge2/model.SLDPRT` (real file, parsed
  directly), `model.step` (verified fillet parameters/location), `model.STL` (present,
  archived, not separately analyzed here).
- `v0.4.7/VERTEX_ANALYSIS.json`, `v0.4.7/EXP033_FEATURE_STATE.json` — archived C00/C03 data (no
  SLDPRT files available for these in this environment).

## Faces/Models Tested

- C00 (6 faces), C03 (7 faces), C12 (7 faces) — 20 face-records, all real (non-ambiguous)
  correspondences established (0 ambiguous matches in either pair).

## Confidence

**High** that the observed pattern is genuine and not a matching artifact: correspondence is
unambiguous (0 flagged pairs), the new face's structural signature matches C03's exactly
(ec=13/vc=16/secCount=2), and the result is internally consistent (real adjacency == changed
set, ec/vc/secCount/b1Len match for "changed" faces, C12 parsed directly from the real file).

**Strong Evidence, not Verified**, for "the token-changed faces track the physical fillet edge
location" — a clean, unambiguous result from n=2 independently tested edges, but not yet an
invariant per project policy, and the adjacency-vs-direct-modification confound (above) means
the precise mechanism remains open.

## Raw Evidence

- `v0.4.7/EXP038_RESULTS.json` — raw results
- `v0.4.7/exp038_nq028_c12_second_edge.js` — script
- `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md` — full evidence writeup

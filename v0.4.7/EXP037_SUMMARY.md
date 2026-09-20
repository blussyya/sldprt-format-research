# EXP-037: NQ-028 — Edge-Location Discrimination + Corrected Adjacency/Correspondence Tooling

**Date**: 2026-08-14
**Status**: Partial — core NQ-028 question NOT answered (blocked on missing corpus); tooling correction and single-edge adjacency verification completed
**Version**: v0.4.7

---

## Objective

NQ-028 asks whether moving a fillet/chamfer to a *different* physical cube edge moves the
Block1 token changes to the corresponding faces (Hypothesis A, spatial/topological), or
whether the same +X/+Y faces change regardless of feature location (Hypothesis B,
global/feature-type state). See `knowledge/NEXT_QUESTIONS.md` NQ-028 and
`knowledge/RESEARCH_HANDOFF.md`.

## Critical Constraint Check (performed before writing any code)

Before implementing anything, checked whether the existing corpus can answer NQ-028:

- `test files original/controlled/` (the controlled-corpus SLDPRT files) **does not exist**
  in this repository snapshot or anywhere on the container filesystem (confirmed via
  filesystem search). This matches `knowledge/RESEARCH_HANDOFF.md`'s "Known Gaps" note.
- The archived JSON outputs (`v0.4.7/CORPUS_AUDIT.json`, `EXP033_FEATURE_STATE.json`,
  `VERTEX_ANALYSIS.json`, etc.) cover exactly 12 models, C00–C11. Grepping every `v0.4.7/*.js`
  script for model names confirms there is exactly one fillet model (C03) and one chamfer
  model (C09), and both consistently change face index 2/3 (+X/+Y) in every experiment that
  reports face indices — i.e. both were applied to the **same physical edge** (the edge
  shared by the +X and +Y faces). No model in this corpus (archived or on disk) fillets or
  chamfers a different edge.

**Conclusion: the existing corpus cannot answer NQ-028.** Per the task's critical constraint,
no answer is fabricated from C03/C09 alone. See "NEW MODEL REQUIRED" below for the exact
specification of the model that would answer it, and "What This Experiment Does Instead"
for the groundwork actually completed with the data that does exist.

## What This Experiment Does Instead

Two of NQ-028's prerequisites, both flagged as missing by the 2026-08-14 archivist audit
(`knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md`, Findings A and B), can be
addressed with data already archived in this repository, without needing the SLDPRT files:

1. **A genuine vertex/edge-sharing adjacency test** (`computeAdjacency` in
   `v0.4.7/exp037_edge_location_and_adjacency.js`), replacing the same-orientation-label
   heuristic in `exp033_feature_state.js`'s `isAdjacentToModified()` (Finding A). Uses the
   full per-face vertex coordinate arrays already archived in `v0.4.7/VERTEX_ANALYSIS.json`.
2. **A face-correspondence algorithm** (`matchFaces`) that does not classify faces by
   orientation bucket. It scores every (C00 face, feature-model face) pair by centroid
   distance (robust to the small vertex shifts a 1mm feature introduces) and explicitly
   flags AMBIGUOUS when two candidates are too close to call, rather than forcing a match —
   replacing `computeTokenDiff()` in `exp036_feature_class_differential.js` (Finding B).

Both were run against the four model pairs for which full per-face vertex arrays are already
archived: C00→C03 (fillet), C00→C09 (chamfer), C00→C04 (hole), C00→C10 (shell).

**Note on the orientation-bucket pitfall discovered while building the correspondence
algorithm**: an earlier version of `matchFaces` scored correspondence by raw vertex-overlap
fraction (the same primitive used for adjacency). This produced tied, ambiguous scores
between the *true* corresponding face and an unrelated face, because every cube corner is
shared by three faces — a fillet-trimmed face's untrimmed corners are, by construction, also
corners of a different, unmodified face. Centroid distance does not have this problem (a 1mm
feature shifts a face centroid by a small, bounded amount, an order of magnitude less than
the centroid separation between any two distinct faces of a 10mm cube) and was used instead.
This is recorded here as a concrete illustration of why "face correspondence must account for
the possibility of multiple faces sharing the same [property]" (per the task's tooling
correction requirement) — the failure mode generalizes beyond orientation labels to any
single-signal matching key on symmetric geometry.

## Results

### 1. Corrected added-face census (cross-check against Finding B's independently-established ground truth)

| Model | Face diff | Added (this script) | Removed | Ambiguous | Ground truth (EXP-027/035, independent) |
|---|---|---|---|---|---|
| C03 (fillet) | +1 | **1** (face 6) | 0 | 0 | +1 (matches) |
| C09 (chamfer) | +1 | **1** (face 6) | 0 | 0 | +1 (matches) |
| C04 (hole 5mm) | +1 | **1** (face 6, cylindrical) | 0 | 0 | +1 cylindrical face (matches) |
| C10 (shell 1mm) | +5 | **5** (faces 6–10, inner walls) | 0 | 0 | +5 inner walls (matches) |

All four counts match the ground truth established independently in EXP-027/EXP-035 (face
counts, not this tooling). This is a direct, reproducible fix for the EXP-036 bug: the
corrected algorithm detects the hole's and shell's added faces automatically (0 false
negatives), where the orientation-bucket algorithm reported `added: 0` for both.

**Classification**: Verified (for this corpus; algorithm, not a new claim about SLDPRT semantics).

### 2. Real geometric adjacency of the fillet/chamfer's new face — within the modified model

Computed via shared-vertex count (≥2 shared vertices ⇒ shares an edge) between the new face
and every other face **within the same (post-feature) model** — comparing against C00 directly
is not meaningful, since C00 does not contain the fillet/chamfer geometry at all (confirmed:
zero shared vertices in every case, as expected).

| Model | New face | Real-adjacent faces (shared vertices) |
|---|---|---|
| C03 (fillet) | face 6 (ec=13, vc=16) | face 4 +Z (8), face 5 -Z (8), face 2 +X (3), face 3 +Y (2) |
| C09 (chamfer) | face 6 (ec=4, vc=4) | face 2 +X (2), face 3 +Y (2), face 4 +Z (2), face 5 -Z (2) |
| C04 (hole) | face 6 (ec=70, vc=70, cylindrical) | face 4 +Z (35), face 5 -Z (35) only |

### 3. Cross-check: does real adjacency (not orientation) explain the token-change pattern for the one tested edge?

Translated the within-model adjacency back to C00 face indices via the corrected
correspondence table, and compared against which C00→C03/C09 face pairs have a changed
Block1 token signature (per `EXP033_FEATURE_STATE.json`, independently re-verified here by
direct token array comparison, not re-derived from this script's own logic):

| Model | Real-adjacent C00 faces | Token-changed C00 faces | Token-unchanged C00 faces | Sets equal? |
|---|---|---|---|---|
| C03 (fillet) | {2, 3, 4, 5} | {2, 3, 4, 5} | {0, 1} | **YES** |
| C09 (chamfer) | {2, 3, 4, 5} | {2, 3, 4, 5} | {0, 1} | **YES** |

For both fillet and chamfer, the set of faces genuinely topologically adjacent to the new
feature face (computed from real vertex coordinates, not orientation labels) is **exactly**
the set of faces whose token signature changed — including the two faces (+X/+Y, indices 2/3)
that are adjacent but not directly modified (ec/vc/secCount/b1Len unchanged), and excluding
the two unaffected faces (-X/-Y, indices 0/1), which are not adjacent to the new face at all.

**This upgrades the status of "signature changes correlate with adjacency to the modified
geometry" from Unknown (per the 2026-08-14 audit's correction of EXP-033's invalid same-
orientation-label test) to Strong Evidence — for the single edge location this corpus
contains.** It does not, by itself, establish that adjacency is *causal*, and it says nothing
about what happens at a different edge — see Interpretation below.

### 4. Hole and shell as contrast cases (not part of NQ-028, included because the corrected tooling made it directly checkable)

- **Hole (C04)**: the new cylindrical face's real within-model adjacency reaches only the two
  directly-modified faces (+Z/-Z, ec/vc/secCount changed by the hole itself) — it is not
  adjacent to the four untouched planar faces. Consistent with EXP-033/035's finding that
  holes do not change tokens on unrelated faces.
- **Shell (C10)**: the five new inner-wall faces ARE, by the same real-vertex-sharing test,
  adjacent to several of the five unmodified outer walls (e.g. inner wall face 6 shares 2
  vertices with outer walls +Y and -Y and with the modified opening face). Yet EXP-035
  independently established (by direct per-face token comparison) that shell's outer walls
  keep IDENTICAL tokens to C00. **This means real geometric adjacency to a new face is not,
  by itself, a sufficient condition for a token-signature change across all feature types
  tested** — the fillet/chamfer result in §3 is not evidence of a universal
  "adjacency-always-causes-change" rule; it is evidence for a correlation that holds for
  fillet/chamfer specifically, on this one edge. Do not generalize past this without further
  testing.

  > **CORRECTION NOTE (2026-08-16, Audit + EXP-040): the claim above is factually wrong and
  > should not be relied on.** "Outer walls +Y and -Y" (or, in the more specific version of
  > this claim in `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §5, "outer walls at C10
  > indices 7 and 9") are not outer walls at all — indices 6-10 are *all* new inner-wall
  > faces, per this same document's own §1 face census. The claim named two members of the
  > *added* set as if they were members of the *unchanged* set. Two independent
  > recomputations (reusing this script's own already-computed `adjacentToModelFaces`
  > records, and a from-scratch shared-vertex recount directly from `VERTEX_ANALYSIS.json`'s
  > raw coordinates) both find **zero** shared vertices between any new inner-wall face and
  > any of C10's five actual unmodified outer walls — the new faces are real-adjacent only to
  > the shell's own directly-modified opening face and to each other. Shell therefore
  > contributes no adjacent-but-unchanged counterexample; it supplies no adjacency test case
  > in either direction, since none of its unmodified faces are ever adjacent to new geometry.
  > This does not newly prove universal sufficiency — it withdraws a specific piece of
  > evidence that had been cited against it. `EXP037_RESULTS.json`'s own computed data was
  > correct throughout; the error was in this prose paragraph only. See
  > `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md`.

## NEW MODEL REQUIRED (to actually answer NQ-028)

This experiment could not, and does not claim to, discriminate Hypothesis A (spatial) from
Hypothesis B (global state) for NQ-028's actual question — that requires observing what
happens at a *second* edge location, which this corpus does not contain.

**Exact specification of the model needed:**

- **Base geometry**: identical to `C00_cube_10mm` — same 10mm cube, same origin/orientation,
  same units, same SolidWorks version/save settings used for the rest of the controlled
  corpus (so the model is comparable to C00/C03/C09 without introducing new confounds).
- **Feature**: a single fillet (or single chamfer — either is sufficient on its own; running
  both, as C03/C09 did for the first edge, would additionally let the new edge replicate the
  "fillet and chamfer produce identical changes" finding, but is not required to answer
  NQ-028's core discriminating question).
- **Feature parameter**: same radius as C03 (1mm fillet) or C09 (1mm chamfer) — do not vary
  the size, to avoid confounding location with magnitude.
- **Feature location — the one deliberate change**: applied to a **different** vertical edge
  of the cube than the one used in C03/C09. C03/C09 modify the edge shared by the +X and +Y
  faces (established directly in this experiment's §2/§3, and by EXP-033 §4.3). The new model
  should fillet/chamfer a different edge — e.g. the edge shared by -X and -Y (the "opposite"
  vertical edge, maximally far from the tested one) is the cleanest choice, since it changes
  only which two faces border the feature while preserving the cube's full symmetry group
  otherwise. (A horizontal edge, e.g. shared by +X and +Z, would also work and would
  additionally test whether the effect is specific to vertical edges — a reasonable follow-up
  but not necessary for the minimal discriminating test.)
- **What must stay identical to the baseline / to C03/C09**: cube size, base sketch, feature
  type, feature parameter value, SolidWorks version, export/save pipeline (same
  `model.SLDPRT`/`model.STEP`/`model.STL` triplet as the rest of the corpus, per
  `vertex_analysis.js`'s expected directory layout `test files original/controlled/<name>/`).
  Do not introduce any other feature, any additional edge treatment, or any change to
  units/scale — a single, isolated, controlled variable (edge location) is required for a
  clean discriminating test, per the task's "do not create arbitrary variations" constraint.
- **Suggested name**: `C12_cube_fillet_1mm_edge2` (or `_chamfer_1mm_edge2`), continuing the
  corpus's C-numbering and following its `<feature>_<param>` naming convention.

**Once this model exists**, `v0.4.7/exp037_edge_location_and_adjacency.js`'s `analyzePair`,
`matchFaces`, and `computeAdjacency` functions are directly reusable: parse the new model with
`parser/v0.1/src/parser-core.js` (as `vertex_analysis.js` and `exp033_feature_state.js` already
do), build a `VERTEX_ANALYSIS.json`-shaped record for `C00_cube_10mm_vs_C12_...`, and re-run.
The predictions are unchanged from the audit's original NQ-028 proposal:

- Changed token faces move to the two faces bordering the *new* edge (e.g. -X/-Y instead of
  +X/+Y) → supports Hypothesis A (spatial/topological); justifies promoting the real-adjacency
  test above from "strong evidence, one edge" to a general, re-testable causal claim.
- Changed token faces remain +X/+Y regardless of the new edge's location → falsifies
  Hypothesis A as tested; supports Hypothesis B (feature-type/global-serialization-state) or a
  confound not yet identified (e.g. the first edge-type feature in the feature tree, or a
  serialization-order effect independent of geometric location).

## What Remains Unknown

1. **NQ-028's core question — edge-location generality.** Untested; requires the new model
   above.
2. **Why adjacency (where it applies) produces a token change at all** — the mechanism is
   still unknown; §3 establishes a correlation (real adjacency ⇔ token change) for fillet/
   chamfer on one edge, not a mechanism.
3. **Why shell's new-face adjacency does NOT produce a token change on its adjacent outer
   walls**, unlike fillet/chamfer (§4). This is a genuine, currently unexplained discrepancy
   between feature types that any future "adjacency causes token change" theory must account
   for — it is evidence against a simple universal adjacency-causation rule, even though it is
   not evidence against Hypothesis A as narrowly stated for edge features.
4. Everything already listed as unknown in `knowledge/RESEARCH_HANDOFF.md` "Current Unknowns"
   (Block1/Block2 token semantics, the `[4,8,2,N]` header meaning, etc.) — unaffected by this
   experiment.

## Files Tested / Data Sources

No SLDPRT files were parsed (none are present in this repository snapshot). All geometry came
from already-archived per-face vertex arrays and token arrays:

- `v0.4.7/VERTEX_ANALYSIS.json` — full per-face vertex coordinates for C00↔C03, C00↔C09,
  C00↔C04, C00↔C10 (produced by `vertex_analysis.js` in a prior session that had the corpus).
- `v0.4.7/EXP033_FEATURE_STATE.json` — full Block1 token arrays, orientation, faceType for
  C00/C03/C04/C05/C09/C11.
- `v0.4.7/EXP035_RESULTS.json` — C10 (shell) token data (absent from EXP033 due to a directory-
  name typo in that script, per the audit's Finding on EXP-035).

## Faces/Models Tested

- C00 (6 faces) vs C03 (7 faces): 13 faces
- C00 (6 faces) vs C09 (7 faces): 13 faces
- C00 (6 faces) vs C04 (7 faces): 13 faces
- C00 (6 faces) vs C10 (11 faces): 17 faces
- 56 face-records total across 4 model pairs (some C00 faces reused across pairs)

## Confidence

**High** for the corrected added-face census (§1) — reproduces independently-established
ground truth (EXP-027/EXP-035) via a different, geometry-based method with zero discrepancies
across all 4 tested pairs, and zero ambiguous matches.

**Strong Evidence** (not Verified — single edge, no causal mechanism established) for "the
real-adjacency set equals the token-changed set" for fillet/chamfer on the one tested edge
(§3).

**None** (explicitly not attempted) for NQ-028's actual discriminating question — edge-location
generality. Requires new data; see "NEW MODEL REQUIRED."

## Raw Evidence

- `v0.4.7/EXP037_RESULTS.json` — raw results
- `v0.4.7/exp037_edge_location_and_adjacency.js` — script
- `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` — full evidence writeup with final-report sections

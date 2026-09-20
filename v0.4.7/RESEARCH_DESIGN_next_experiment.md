# Research-Design Assessment: What Causes Block1 Token Changes?

**Date**: 2026-08-17
**Status**: Planning document. **No experiment was executed for this document. No EXP number is claimed.**
**Scope**: Reassessment after the 2026-08-17 audit (commit `3730e74`) of EXP-037→EXP-040.

---

## 0. What this session verified independently

Every figure below was recomputed from raw JSON in this session, not taken from prose summaries.

| Claim under review | Source | Verdict |
|---|---|---|
| "15 directly-modified faces; 14 changed tokens; 1 unknown" (audit's correction of EXP-039's "11/11") | recomputed from `EXP037_RESULTS.json` + `EXP038_RESULTS.json`, deduplicated by (model, aIndex) — C03 appears in both files | **CONFIRMED.** 19 raw rows → 15 unique faces → 14 known-changed, 0 known-unchanged, 1 unknown (C10 aIndex 4). |
| "The 12 'adjacent, unmodified' rows never test adjacency to genuinely new geometry" (audit item 4) | recomputed from `EXP037_RESULTS.json`'s own `added[].adjacentToModelFaces` | **CONFIRMED, and stronger than stated.** In *every* model, each newly-added face is adjacent only to directly-modified faces or to other new faces. Not one unmodified face in the entire corpus is adjacent to a new face. |
| EXP-040's shell correction (new inner walls share 0 vertices with unmodified outer walls) | re-derived independently | **CONFIRMED.** |

### 0.1 A further scope error, not previously recorded

The "14/14, no counterexamples" tally is computed **only over the feature models** (C03/C09/C04/C10/C12). Applying the *same operational definition of "directly modified"* that EXP-039/040 use — `facesIdentical()`, i.e. per-vertex coordinate comparison — to the transformation pairs gives:

- `C00 → C01` (2× scale): **6/6 faces have every vertex changed.**
- `C00 → C02` (translation): **6/6 faces have every vertex changed.**
- EXP-034 (`EXP034_TRANSFORMATION_INVARIANCE.json`, `block1Invariance.bodiesC00vsC01 = true`, `bodiesC00vsC02 = true`) verified **all 12 of those faces have byte-identical Block1 bodies.**

So corpus-wide, under the definition actually in use, the record is **14 changed / 12 unchanged / 1 unknown**, not 14/14. This does not overturn the audit's arithmetic (which was explicitly scoped to feature models) but it does mean:

> **Direct vertex modification is definitively NOT sufficient for a token change.** Twelve faces have every vertex coordinate altered with zero token change.

This should be recorded as a correction note; see §7.

---

## 1. The confound, stated precisely

Across all five feature models, these two face sets are **identical, with zero exceptions in either direction**:

- `{faces whose own vertices changed}`
- `{faces adjacent (≥2 shared vertices) to a newly created face}`

| Model | directly modified | adjacent to a new face | equal? |
|---|---|---|---|
| C03 (fillet) | {2,3,4,5} | {2,3,4,5} | yes |
| C09 (chamfer) | {2,3,4,5} | {2,3,4,5} | yes |
| C04 (hole) | {4,5} | {4,5} | yes |
| C10 (shell) | {0} | {0} | yes |
| C12 (fillet, edge 2) | {0,1,4,5} | {0,1,4,5} | yes |

The full cross-tabulation, including the transformation pairs:

| | **adjacent to a new face** | **not adjacent to a new face** |
|---|---|---|
| **vertices changed** | 14 changed, 1 unknown | **12 UNCHANGED** (C01/C02 — but similarity transforms only) |
| **vertices unchanged** | **EMPTY — 0 cases exist in the entire corpus** | 13 unchanged |

Two cells carry the whole question. The bottom-left cell is empty; that is the gap a new model must fill. The top-right cell is populated *only* by uniform scale and translation, which is why H1 survives in refined form.

---

## 2. Competing explanations

I split the "direct modification" hypothesis in two, because the raw form is already falsified and only the refined form is live. This split matters: the literature in this repo treats "direct modification" as one hypothesis, and it is not.

### H1a — Raw vertex modification
*Any change to a face's own vertex coordinates causes a token change.*

- **Supports**: 14/14 within the feature models.
- **Weakens**: **FALSIFIED.** C01/C02 supply 12 faces whose every vertex moved with byte-identical Block1 bodies (EXP-034).
- **Status**: **Falsified.**

### H1b — Non-similarity / structural modification of the face itself
*A change to the face's own shape beyond a similarity transform (or to its boundary-loop structure) causes a token change.*

- **Supports**: consistent with all 14 feature-model changes; consistent with C01/C02 being unchanged (scale/translation are similarity transforms, so no shape change up to similarity).
- **Weakens**: nothing directly — but it has never been tested apart from H2, because every non-similarity change in the corpus co-occurs with new-face adjacency.
- **Status**: **Live, fully confounded with H2.**

### H2 — Topological / adjacency effect
*Token changes depend on the face's relationship to newly created feature geometry.*

- **Supports**: EXP-038's relocation result (moving the fillet to the opposite edge moved the changed set from {+X,+Y} to {−X,−Y}); EXP-040's 0-exception full-corpus table.
- **Weakens**: nothing directly. Note the frequently cited "shell contrast case" that supposedly weakened it **was a documentation error**, corrected by EXP-040 — it is not evidence against H2.
- **Also note**: the 12 "adjacent, unmodified" rows of EXP-039 do **not** test H2. They test adjacency to an *already-modified neighbor*, which is a different relation (call it R2). Their real content is narrow but genuine: **one-hop propagation from a modified neighbor does not occur** (12/12 unchanged).
- **Status**: **Live, fully confounded with H1b.**

### H3 — Feature-specific processing
*Fillet/chamfer processing writes different structural metadata than hole/shell processing.*

- **Supports**: EXP-033's original framing.
- **Weakens**: substantially. EXP-040's table shows one uniform rule across four different feature types (fillet, chamfer, hole, shell) with zero exceptions — no feature-type-specific behavior is visible once adjacency is measured correctly. EXP-033's apparent feature-specificity is now attributable to its broken orientation-label adjacency test.
- **Status**: **Weak.** Not falsified, but no longer needed to explain anything.

### H4 — Serialization / global-state effect
*Token changes reflect model-wide regeneration or serialization order.*

- **Supports**: EXP-028 (the DisplayList is re-serialized wholesale on any face change).
- **Weakens**: strongly. (a) EXP-038: the changed set *relocates* with the fillet's physical position, and face indices changed {2,3}→{0,1} — a global counter or serialization-order effect would not track geometry. (b) In C03 the face count goes 6→7 and yet −X/−Y remain byte-identical, so adding a face to a model does not by itself perturb unrelated faces. (c) EXP-034: tokens survive whole-model scale and translation.
- **Status**: **Weak.** Retained only as a residual.

### H5 — Tessellation-driven length change (a confound, not a rival)
Not an explanation of the phenomenon, but a mandatory control. By INV-016/INV-017, `b1Len = 2 × (vc − secCount)`: **if `vc` changes, the token array length is forced to change.** Any comparison on a face whose `vc` changed is therefore trivially "changed" and carries little information.

This is not hypothetical. Checking C04 vs C05 (hole 5mm → 3mm, no new faces, so a candidate H2-necessity counterexample):

| face | vc | tokenChanged | what actually changed |
|---|---|---|---|
| 6 (cylinder) | 70→56 | "true" | **pure truncation** — C05's 110 tokens are a literal prefix of C04's 138. No substantive change. |
| 4 (+Z) | 62→51 | "true" | length forced; identical distinct-value set `[0,1,5,9,13,17,153]`, reordered |
| 5 (−Z) | 64→49 | "true" | length forced; identical distinct-value set `[0,1,50,54,58,62,150]`, reordered |

So C04↔C05 does **not** cleanly break H2's necessity — its "changes" are length-forced. **Design requirement: the diagnostic face must hold `vc`, `ec`, and `secCount` constant, so both token arrays have equal length and are comparable element-wise.**

---

## 3. What the existing corpus can and cannot distinguish

**Can:**
- H1a is falsified (C01/C02).
- H4 is weak (EXP-038 relocation; C03's unrelated faces unchanged despite face-count change).
- H3 is weak (one uniform rule across four feature types).
- One-hop propagation from a modified neighbour does not occur (EXP-039's 12 rows, correctly scoped).

**Cannot:**
- **H1b vs H2.** The two sets are identical in every model. No amount of further analysis of archived data can separate them; this is a property of the corpus, not of the tooling.
- Anything requiring the empty cell (unmodified face adjacent to new geometry).

**Why the previous adjacency experiments were insufficient:**
1. **EXP-033** used an orientation-*label* match as its adjacency test — structurally incapable of detecting real adjacency (corrected 2026-08-14).
2. **EXP-037/038** computed real vertex-based adjacency correctly, but every model they had available confounds adjacency with modification; EXP-038 said so explicitly for edge features.
3. **EXP-039** appeared to break the confound, but its 12 test rows measure adjacency to an already-*modified* neighbour, never to *new* geometry — verified here against `added[].adjacentToModelFaces`. Its "11/11" companion figure was never computed by its own script.
4. **EXP-040** built the correct full-corpus table and found 0 exceptions — but, as it states itself, its "adjacent" column includes the directly-modified faces, so it cannot separate the two either.

None of these are wasted: together they establish that the confound is *structural to the corpus*, which is what makes the model requirement below unavoidable.

---

## 4. Candidate experiments considered

### Candidate A — Split Line on a side face (RECOMMENDED, see §5)
- **Controlled variable**: topological neighbourhood only; the diagnostic face's own geometry is held *exactly* constant (not merely up to similarity).
- **Model**: C00 + one Split Line. See §5/§6.
- **Confounds**: the new face is *coplanar* with the face it was split from, so it is a new **face entity** but not a new **surface**. A critic may argue a fillet's new cylindrical surface is a stronger stimulus. Mitigated by §5.6.
- **Information gain**: **Highest.** It is the only candidate that populates the empty cell while holding `vc`/`ec`/`secCount`/vertex positions fixed on the diagnostic face.

### Candidate B — Boss / protrusion added to a face
- **Rejected.** A boss in a face's interior gives that face an inner loop (`secCount` changes → modified, and length-forced). A boss at a face's edge alters that face's outer boundary (modified). A boss spanning a full face edge extends the neighbouring faces (modified). Every placement modifies the face it touches; the confound is reproduced exactly.

### Candidate C — Two bodies joined / intersecting bodies
- **Rejected.** Union with a body that lands in a face's interior produces an inner loop (modified); flush placement alters the outer boundary (modified). Leaving the bodies un-merged gives coincident-but-distinct faces — geometric coincidence, not topological adjacency — which would confuse rather than clarify the adjacency measure.

### Candidate D — Draft on a side face, neutral plane at +Z
- **Rejected as non-discriminating.** +Z stays exactly unchanged, but its neighbour is *modified*, not *new*. Both H1b and H2 predict no change on +Z. This re-tests EXP-039's R2 relation, already answered 12/12.

### Candidate E — Recover the C06 SLDPRT (hole moved) and extract its tokens
- **Controlled variable**: feature position, with no new faces created (7→7).
- **Attractive because**: requires no new modelling — C06 is already part of the original C00–C11 corpus design; only the binary is missing from the repo.
- **Confounds**: fatal for the primary question. C06's affected faces 4 and 5 change `vc` (62→66, 64→62) → length-forced (H5). The one face with stable `vc`/`ec` (face 6, the cylinder, 70→70) undergoes an essentially rigid translation, which EXP-034 already predicts leaves tokens unchanged. So the informative cases are length-confounded and the clean case is uninformative.
- **Information gain**: **Low for the confound**, moderate as a cheap secondary check. Worth requesting alongside, never instead.

### Candidate F — Split Line followed by a Dome on one half
- **Deferred.** Produces a genuinely new *curved surface* adjacent to an untouched +Z, closing Candidate A's one loophole. Rejected as the primary because it is a two-feature model (violates "smallest controlled model") and Dome's boundary behaviour needs its own verification. **This is the correct follow-up if and only if Candidate A returns "no change" and the coplanarity objection is pressed.**

---

## 5. Recommended single next experiment

### Candidate A — Split Line at constant Z on the +X face

#### 5.1 Why this breaks the confound
It is the only construction found that yields **Face A adjacent to a newly created face while Face A's own vertices, `vc`, `ec`, `secCount`, and `b1Len` are all bit-for-bit unchanged.** It populates the corpus's empty cell.

The geometric reason it works — and the reason the split must run at **constant Z**: the split line's endpoints land on the two side edges (+X/+Y and +X/−Y), splitting *those*. The +X/+Z and +X/−Z edges are never touched, so +Z and −Z keep their boundary loops intact while acquiring a brand-new neighbour across an unchanged edge. A vertical (constant-Y) split would land its endpoints on the +Z and −Z edges instead, splitting them, modifying +Z, and reproducing the confound. **This orientation detail is the entire experiment.**

#### 5.2 Baseline / control model
`C00_cube_10mm`. Its SLDPRT is not in this repo, but its full per-face vertices are archived in `VERTEX_ANALYSIS.json` and its full Block1 token arrays in `EXP033_FEATURE_STATE.json` — the same archived-baseline route EXP-038 used successfully for C12.

#### 5.3 What must remain identical
Same 10 mm cube at the same origin and orientation, same units, same document template, same SolidWorks version and save settings, and **no other feature**. Build it by opening `C00_cube_10mm`, adding exactly one Split Line, and using Save As — this guarantees an identical base extrude rather than a re-created one.

#### 5.4 What must differ
Exactly one added Split Line feature. Nothing else.

#### 5.5 Faces to inspect and predictions

Let the cube occupy (0,0,0)–(10,10,10); split line on the +X face (plane x=10) running from (10, 0, 5) to (10, 10, 5).

| Face | own vertices | own shape | `vc`/`ec` | adjacent to a NEW face? | **H1a** (falsified, listed for completeness) | **H1b** | **H2** |
|---|---|---|---|---|---|---|---|
| **+Z** | identical | identical | unchanged | **YES** (upper half) | no change | **no change** | **CHANGE** |
| **−Z** | identical | identical | unchanged | **YES** (lower half) | no change | **no change** | **CHANGE** |
| +Y | +1 boundary vertex | same 10×10 square | `vc` 4→5 likely | yes | change | no change | change |
| −Y | +1 boundary vertex | same 10×10 square | `vc` 4→5 likely | yes | change | no change | change |
| **−X** | identical | identical | unchanged | **NO** | no change | no change | **no change** (control) |

**+Z and −Z are the discriminators.** They are the first faces in the project's history that are adjacent to new geometry while being provably unmodified, with equal-length token arrays.

- If **+Z/−Z tokens change** → adjacency to newly created geometry is sufficient without any change to the face itself. H1b is falsified as a necessary condition; H2 is strongly supported.
- If **+Z/−Z tokens are byte-identical** → new-face adjacency is *not* sufficient. H2's broad form is falsified; H1b becomes the leading explanation (subject to §5.6).
- −X must be unchanged under every hypothesis; if it changes, that is evidence for H4 and invalidates the whole design — check it first.
- +Y/−Y additionally separate H1a from H1b, since their region of space is unchanged but their boundary loop gains a vertex.

#### 5.6 Known limitation to state up front
The new face is coplanar with the face it split from, so this tests adjacency to a new **face entity**, not to a new **surface**. A "no change" result therefore falsifies the broad form of H2 but leaves open a narrow form ("adjacency to a new *surface* matters"). Candidate F is the designated follow-up for exactly that case. A "change" result is not subject to this caveat.

#### 5.7 Failure modes to report rather than force
- If the DisplayList does not serialize the split as two faces (face count stays 6), the experiment is **inconclusive**, not negative — report and stop.
- Both halves sit 2.5 mm from the original +X centroid, exceeding EXP-038's 0.002 m bbox-center threshold, so `matchFaces()` will likely report **1 removed + 2 added** rather than 1 matched + 1 added. That is the honest output for a symmetric split; do not retune the threshold to force a match. +Z/−Z/−X correspondence is unaffected.

---

## 6. Required new-model specification

**This model does not exist. Do not treat any result as available until the file is supplied and verified.**

```
Name:        C13_cube_splitline_z5_on_plusX
Location:    test files original/controlled/C13_cube_splitline_z5_on_plusX/
Deliver:     model.SLDPRT, model.step, model.STL   (same three formats as C12)

Base:        Open C00_cube_10mm and Save As. Do NOT re-create the cube.
             10 mm cube, corner at origin, spanning (0,0,0)-(10,10,10), millimetres.

Feature:     Exactly ONE Split Line.
  Type:      Projection
  Sketch:    a single straight line on the Right/Front plane offset as needed,
             projected onto the +X face; OR sketch directly on the +X face.
  Line:      from (10, 0, 5) to (10, 10, 5)
             - constant Z = 5 mm  <-- REQUIRED; a constant-Y line invalidates the test
             - spans the full 10 mm depth in Y so it terminates on the two side edges
  Target:    the +X face (plane x = 10) only. No other face may be split.

Result:      7 faces. The +X face becomes two coplanar faces:
             upper (z 5..10) and lower (z 0..5).

Must be true after the feature (verify before use):
  - +Z face: still one face, 4 corners, unchanged coordinates
  - -Z face: still one face, 4 corners, unchanged coordinates
  - -X face: entirely unchanged
  - the +X/+Z and +X/-Z edges: NOT split
  - the +X/+Y and +X/-Y edges: split at z = 5 (expected and acceptable)

No other feature, no appearance/material change, no reorientation, no re-scaling.
```

**Verification before analysis** (mirroring EXP-038's practice of validating C12 from its STEP file first): confirm from `model.step` that the part has 7 `ADVANCED_FACE` entries, that two of them are planes at x=10, and that the +Z face's bounding loop still has exactly 4 vertices at the original coordinates.

---

## 7. Repository impact

**Nothing in this session should be committed.** Files that *would* change once the experiment is actually executed:

| File | Change |
|---|---|
| `test files original/controlled/C13_.../` | new — the supplied model (3 files) |
| `v0.4.7/exp041_splitline_adjacency_isolation.js` | new script; **reuse** EXP-038's `matchFaces()` (bbox-center) and EXP-037's `computeAdjacency()` — do not write a third |
| `v0.4.7/EXP041_RESULTS.json`, `v0.4.7/EXP041_SUMMARY.md` | new |
| `knowledge/evidence/<date>_v0.4.7-EXP041.md` | new |
| `knowledge/EXPERIMENT_LOG.md` | new EXP-041 entry |
| `knowledge/RESEARCH_DASHBOARD.md` | completed-experiments entry |
| `knowledge/NEXT_QUESTIONS.md` | resolve/supersede NQ-029 |
| `knowledge/OPEN_QUESTIONS.md` | OQ-032 / OQ-036 updates |
| `knowledge/FAILED_HYPOTHESES.md` | **only** if H1b or H2 is genuinely falsified |
| `knowledge/RESEARCH_HANDOFF.md` | session handoff |

**Separately, and independently of the experiment**, §0.1's finding warrants an append-only correction note in `FAILED_HYPOTHESES.md` (FH-030), `OPEN_QUESTIONS.md` (OQ-032), and `RESEARCH_HANDOFF.md`: the "14/14" record is scoped to feature models, and applying the same operational definition corpus-wide gives 14 changed / 12 unchanged / 1 unknown, establishing that raw vertex modification is **not sufficient**. Not written in this session — the session brief restricted knowledge-base edits.

---

## 8. Anti-overclaim register

- Direct modification is a **strong correlate** and a **plausible necessary condition** within the feature models. It is **not** established as causal, and it is **not sufficient** (§0.1).
- Adjacency to new geometry is **Unknown** as an independent mechanism. It is neither demonstrated nor falsified. It has **never been tested** on an unmodified face, because no such test case exists in the corpus.
- No semantic meaning is assigned to any Block1/Block2 token value anywhere in this document. Observations about value alphabets in §2/H5 are structural only.
- Observation / interpretation / hypothesis are labelled separately throughout: §0–§1 and the tables in §2/H5 are observations recomputed from raw JSON; §2's status verdicts are interpretation; §5.5's prediction table is hypothesis.

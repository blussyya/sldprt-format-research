# EXP-041 — Controlled corpus unblocked: from-source verification of the v0.4.7 record

**Date**: 2026-09-13
**Status**: Executed. Observations below are recomputed from the real SLDPRT binaries; interpretation is labelled separately.
**Raw output**: `EXP041_RESULTS.json`
**Script**: `exp041_corpus_unblocked_from_source.js`
**Evidence file**: `../knowledge/evidence/2026-09-13_v0.4.7-EXP041.md`

---

## 0. Why this experiment exists

Every v0.4.7 experiment from EXP-027 through EXP-040 was computed against **archived JSON** derived
from controlled-corpus SLDPRT files that were not in this repository. `RESEARCH_HANDOFF.md` records
this as a standing limitation ("C00 through C11 are still archive-only"), reconfirmed by EXP-037 via
a full-filesystem search, and it is the reason EXP-037 could not execute NQ-028 at the time. Only
C12 had a real file, supplied by the user for EXP-038.

Commit `d0c6c54` (2026-09-13) added real `model.SLDPRT` / `model.step` / `model.STL` files for
**C00–C11**. The entire controlled corpus is now parseable from source for the first time. This
experiment does the verification work that blocker was preventing, and extends the analysis to the
five models no prior experiment ever analyzed for tokens or adjacency (C06, C07, C08, C11, and the
C04↔C11 diameter pair).

**Tooling was reused, not rewritten**, per the binding methodological constraints in
`RESEARCH_HANDOFF.md`: `computeAdjacency` (real ≥2-shared-vertex test) from EXP-037, and
`matchFaces` with the bounding-box-center centroid (threshold 0.002 m) from EXP-038. Face
correspondence never uses Block1/Block2 token similarity.

---

## 1. Finding 1 — Provenance: the archive is faithful (11/11 exact)

All eleven models recorded in `CORPUS_AUDIT.json` reproduce **exactly** from the newly supplied
binaries, field by field:

- DisplayList per-face byte offsets: `verticesStart`, `gapStart`, `normalsStart`, `block1Start`, `block2Start`
- Structure: `edgeCount`, `vertexCount`, `secCount`, `b1Len`
- `sectionLens`, `loopSizes`, `b2Body`
- Vertex previews, normal previews, Block1 token previews

**0 mismatches in any field, in any face, in any model.**

**Interpretation**: the supplied binaries are the same models the v0.4.7 archive was derived from —
not regenerated look-alikes. This was an open risk: a re-run of the SolidWorks COM build could have
produced different tessellation, which would have invalidated comparisons between new measurements
and archived ones. It did not. **Every v0.4.7 numerical claim is now reproducible from source**,
satisfying the project rule "Every numerical claim must be reproducible from archived evidence" at a
strictly stronger level than before.

---

## 2. Finding 2 — INV-016 / INV-017 / INV-018 hold from source

| | faces | sections |
|---|---|---|
| INV-016 (`b1Len = 2 × (vc − secCount)`) | **94/94** | — |
| INV-017 (section body length = `Block2[i] − 1`) | — | **273/273** |
| INV-018 (Σ Block2 = Block1 body length) | **94/94** | — |

Across all 13 controlled models. First confirmation of these invariants on the controlled corpus
from the binaries rather than the archive.

**Scope note (anti-overclaim)**: this is a new *data* path, not a new *code* path — it reuses
`parser/v0.1`'s extraction. It is not a fourth independent implementation in the sense EXP-016 was.

---

## 3. Finding 3 (NEW) — C04→C06: a face whose every vertex moved, with byte-identical tokens

C06 is C04 with the hole moved from centre (5,5) to (7,5); nothing else differs.

| face | vc | own vertices | Block1 tokens |
|---|---|---|---|
| 0–3 (side walls) | 4→4 | unchanged | unchanged |
| 4 (+Z) | 62→66 | changed | changed (length-forced) |
| 5 (−Z) | 64→62 | changed | changed (length-forced) |
| **6 (cylinder)** | **70→70** | **all 70 changed** | **byte-identical** |

The cylinder's 70 vertices are translated by a single uniform delta — `[0.002, 0, 0]` exactly, one
distinct delta across all 70 — and `vc`, `secCount` and `b1Len` (138) are unchanged, so the two
token arrays are the same length and comparable element-wise. They are identical.

**Interpretation**: this is the first instance in the corpus of a face whose own vertex coordinates
*all* changed while its tokens did not, **inside a model pair where other faces did change**. The
existing evidence for "raw vertex modification is not sufficient" (H1a, `RESEARCH_DESIGN_next_experiment.md`
§0.1) rested entirely on C01/C02 — whole-model similarity transforms, which `matchFaces` cannot even
correspond (0 matched rows; every bbox centre moves far beyond the 0.002 m threshold), so they never
appear in a cross-tabulation at all. C06 supplies the same conclusion from a **local** change within
a non-similarity model edit, and it appears in the table.

It does **not** falsify H1b: a pure translation is a similarity transform of the face itself, so
"non-similarity change to the face's own shape" remains untouched. What it does sharpen is H4: within
a single model pair, one face translates with unchanged tokens while two others change. The token
change is a per-face property, not a model-global one.

Consistent with EXP-034's prediction and with the Candidate-E forecast in
`RESEARCH_DESIGN_next_experiment.md` §4 ("essentially rigid translation, which EXP-034 already
predicts leaves tokens unchanged"). The prediction is now measured rather than inferred.

---

## 4. Finding 4 (NEW) — C07→C08: the strongest global-state (H4) control in the project

C08 is C07 with **only the second hole** changed (5 mm → 3 mm Ø). Face count 8→8, no faces added or
removed.

| face | what it is | vertices | Block1 tokens |
|---|---|---|---|
| 0–3 | side walls | identical | **identical** |
| 4 | +Z (2 inner loops) | changed | changed |
| 5 | −Z (2 inner loops) | changed | changed |
| **6** | **first hole's cylinder, centre (3,3) — untouched by the edit** | **identical** | **identical** |
| 7 | second hole's cylinder, centre (7,7) — the edited one | changed | changed |

Face 6 shares **35 vertices with face 4 and 35 with face 5**, both of which undergo large token
changes (vc 122→109 and 116→111).

**Interpretation**: per EXP-028 the DisplayList is re-serialized wholesale on any face change, yet
five of eight faces come through byte-identical in both geometry and tokens. A global/serialization
-state effect (H4) would not leave them untouched. H4 is further weakened, on a pair with a genuine
**non-similarity** feature edit — unlike C01/C02, the only prior evidence of this kind.

It also extends EXP-039's R2 relation ("one-hop propagation from an already-modified neighbour does
not occur", 12/12 unchanged) to the highest-contact case in the corpus: 35 shared vertices with each
of two heavily-changed neighbours, and still no change.

---

## 5. Finding 5 — The discriminating cell is still empty, now corpus-wide

Cross-tabulation over 12 pairs and 65 matched face correspondences, from source:

| | **adjacent to a NEW face** | **not adjacent to a new face** |
|---|---|---|
| **vertices changed** | 17 rows — **17 changed**, 0 unchanged | 12 rows — 11 changed, **1 unchanged** (C06 cylinder, §3) |
| **vertices unchanged** | **0 rows — EMPTY** | 36 rows — 0 changed, **36 unchanged** |

`RESEARCH_DESIGN_next_experiment.md` §1 established the empty cell over five feature models. It now
holds over the **complete 13-model corpus**, including the five models never previously analyzed.

**Interpretation**: the confound between H1b (non-similarity modification of the face itself) and H2
(adjacency to newly created geometry) is confirmed structural to this corpus, not an artifact of
which subset had been examined. **The five newly supplied models do not break it and cannot.** The
C13 split-line model specified in `RESEARCH_DESIGN_next_experiment.md` §6 remains required and
remains unbuilt.

Note also that outside the empty cell the table is exceptionless in both directions: every face
adjacent to new geometry changed (17/17), and every unmodified non-adjacent face did not (36/36).

---

## 6. Methodological caution for the next session

The C06 cylinder correspondence passed at `centroidDist = 0.0019999998616 m` against the
`CENTROID_THRESHOLD = 0.002 m` inherited from EXP-038 — a margin of ~1.4 × 10⁻¹⁰ m. The match is
genuine (verified independently by the uniform `[0.002, 0, 0]` vertex delta and identical `vc`), but
it passed by luck, not by design: **any feature translated further than 2 mm will fail
correspondence outright and be reported as removed+added.** C04→C07 already shows this behaviour
(`removed=[6], added=[6,7]`), correctly and by design.

Do not retune the threshold to force matches. If a future model needs larger translations, the
correspondence key needs a principled revision (and re-validation across all archived pairs, as
EXP-038 did), not a bigger number.

---

## 7. Anti-overclaim register

- Provenance (§1) and the invariant counts (§2) are **observations**, verified field-by-field.
- §3 and §4 are **observations** with clearly separated interpretation. Neither promotes any
  hypothesis to invariant status; per project rule, nothing from v0.4.7 has been promoted to
  `KNOWN_INVARIANTS.md` and this experiment promotes nothing either.
- H1a remains falsified; **H1b and H2 remain live and remain mutually inseparable** in this corpus.
  H4 is further weakened but not falsified. H3 is unaffected by this experiment.
- No semantic meaning is assigned to any Block1/Block2 token value anywhere in this experiment.
- The invariant re-verification reuses `parser/v0.1` extraction code; it is data-independent from
  the archive but not code-independent.

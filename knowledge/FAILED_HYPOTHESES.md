# Failed Hypotheses

> **2026-09-14 current-state correction — EXP-042–046:** Read [the v0.4.8 format report](../v0.4.8/README.md) before using the historical conclusions below. Block2 describes triangle strips, not CAD loops; Block1 annotates strip edges and links exactly to downstream edge IDs. The predecessor array is always present on the tested corpus. A third byte array and a forward metadata grammar are now recorded. `parser/v0.2` implements the verified read-only path. Old text is retained as evidence, not current guidance.

Project-wide list of hypotheses that have been falsified or made unusable by later experiments.

Source migrated from `v0.3.5/docs/research/FAILED_HYPOTHESES.md`.

---

## FH-001: Block 1 Is Only A Rendering Cache

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 1 contains lossy or incidental rendering-cache data, not required grammar/topology data.

**Evidence against**: Block 1 has deterministic structure, starts with ONE for every tested face, and its ONE count equals Block 2 entry count for 595/595 faces.

**Disproving experiment**: EXP-006, EXP-007

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-002: Holes Are Stored As Separate Faces

**Status**: Disproven Hypothesis

**Original hypothesis**: Faces with holes are stored as multiple face blocks.

**Evidence against**: Multi-loop faces are represented inside single face blocks. Block 2 decodes multiple loop sizes whose sum equals the single face `vertexCount`.

**Disproving experiment**: EXP-004

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-003: The Gap Marker Contains Loop Boundaries

**Status**: Disproven Hypothesis

**Original hypothesis**: The 16-byte gap between positions and normals contains loop-boundary data.

**Evidence against**: The gap marker is fixed as `[12, 100, 2, vertexCount]` and repeats as a structural separator.

**Disproving experiment**: EXP-005

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 aggregate faces, with forensic dumps on selected GEAR faces.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-004: All Block 1 Non-Zero Values Are Global Vertex Indices

**Status**: Disproven Hypothesis

**Original hypothesis**: Every non-zero Block 1 value is a global vertex index.

**Evidence against**: Complex faces include many values in local ranges while simple faces include values that look global. The branch notebook records a complex face with `vc=1324` where 2324/2404 Block 1 values were in the local range `0..1323`, while a simple `vc=4` face had 4/6 values in a global-looking range `1559..1588`. Current evidence does not support one uniform global-index rule.

**Disproving experiment**: Block 1 range comparison recorded in branch notebook.

**Files tested**: GEAR and other modern corpus files.

**Faces/models tested**: Multiple simple and complex faces; exact count not preserved in project-wide migration.

**Confidence**: Medium-high

**Date last updated**: 2026-06-27

---

## FH-005: Normal-Gap Loop Splitting Works

**Status**: Disproven Hypothesis

**Original hypothesis**: Loop boundaries can be recovered by detecting normal-vector discontinuities.

**Evidence against**: Gap detection fired on strip diagonals rather than true loop boundaries. Block 2 provides the reliable loop-size decomposition.

**Disproving experiment**: EXP-003

**Files tested**: Current modern corpus during v0.3.0-v0.3.3 experiments.

**Faces/models tested**: Multiple faces; exact count not preserved in project-wide migration.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-006: Face Blocks Start With `[12, 100, 2, vertexCount]`

**Status**: Disproven Hypothesis

**Original hypothesis**: `[12, 100, 2, vertexCount]` is the face-start marker.

**Evidence against**: Forensic layout shows face blocks start with `[edgeCount, 100, 2, vertexCount]`. `[12, 100, 2, vertexCount]` is the gap marker between positions and normals.

**Disproving experiment**: EXP-001, EXP-005

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 aggregate faces, with forensic dumps on selected GEAR faces.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-007: Block 1 `N / vertexCount` Is Constant

**Status**: Disproven Hypothesis

**Original hypothesis**: The Block 1 body length has a constant ratio to face vertex count.

**Evidence against**: The ratio varies by face and appears affected by loop complexity. The branch notebook records BOTTOM ratios ranging from about 1.500 for `vc=4` faces to about 1.960 for `vc=50` faces, with GEAR also varying.

**Disproving experiment**: Aggregate Block 1 ratio analysis in branch notebook.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-008: Block 1 Encodes Normals

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 1 contains per-vertex normal vectors.

**Evidence against**: Normals are stored separately as float32 vectors after the gap marker. Block 1 values are u32 integers dominated by ZERO/ONE/LARGE grammar patterns.

**Disproving experiment**: EXP-002, EXP-005, EXP-006

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-009: Block 1 Encodes UV Coordinates

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 1 contains texture coordinate data.

**Evidence against**: UV coordinates would normally be float-like values; Block 1 is u32 token data with strong ONE/ZERO/LARGE grammar.

**Disproving experiment**: EXP-006

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-010: Block 1 Has Fixed-Size Records

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 1 is made of fixed-width records.

**Evidence against**: Block 1 body length and apparent ONE-delimited section size vary across faces and loop counts.

**Disproving experiment**: EXP-006

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-011: Block 2 Raw Values Are Vertex Indices

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 2 body values are vertex indices.

**Evidence against**: Block 2 raw values decode through `(raw + 2) / 2` to loop vertex counts, and decoded counts sum to face `vertexCount`.

**Disproving experiment**: EXP-004

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595/595 faces across 4 models.

**Confidence**: High

**Cross-reference**: INV-017 (Verified Structural Invariant) further confirms that Block 2 values encode per-loop size data via the decoding formula `(raw + 2) / 2`, consistent with the falsification of vertex-index interpretation.

**Date last updated**: 2026-06-27

---

## FH-012: DisplayLists Contains Only Face Data

**Status**: Disproven Hypothesis

**Original hypothesis**: The main DisplayLists stream is only serialized face geometry.

**Evidence against**: DisplayLists includes section-like `[1,1]` structures, strings/class names, metadata regions, and candidate markers that do not validate as faces.

**Disproving experiment**: EXP-008

**Files tested**: BOTTOM, GEAR, plus supporting stream inventory from TOP and DEKOR.

**Faces/models tested**: BOTTOM 39 faces, GEAR 113 faces in section audit.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## FH-013: VALUE Tokens Encode A Property Table

**Status**: Disproven Hypothesis

**Original hypothesis**: Block 1 `VALUE` tokens encode or index a property table.

**Evidence against**: Today's falsification report records three controls against the property-table model:

- Random-base controls did not support the property-table interpretation.
- Frequency bias was observed in the candidate VALUE distribution.
- The apparent structure was attributable to a delimiter artifact rather than stable VALUE semantics.

These observations return VALUE semantics to UNKNOWN. `VALUE` remains only an observational class for non-zero/non-one integers.

**Disproving experiment**: EXP-010

**Files tested**: Today's measured corpus; exact file list not yet archived in project-wide evidence.

**Faces/models tested**: Today's measured corpus; exact face/model count not yet archived in project-wide evidence.

**Confidence**: High for rejecting the reported property-table hypothesis, pending raw evidence archival.

**Date last updated**: 2026-06-27

**Cross-reference**: EXP-011 records that section length alone does not uniquely determine token-class sequence across 3429 sections. This corpus statistic is consistent with — but does not prove — the falsification of uniform VALUE semantics.

---

## FH-014: EXP-019 H2/H3/H5 Are Genuine Structural Tests

**Status**: Falsified — these are tautologies, not data tests.

**Original hypothesis**: H2 (no extra bytes between normals and B1), H3 (gap is exactly 16 bytes), and H5 (block ordering is correct) were claimed as "surviving" structural tests.

**Evidence against**: Each test verifies its own variable definition, not a data property:
- H2: `normalsEnd` and `block1Start` are the same variable.
- H3: `normalsStart` is defined as `gapStart + 16`.
- H5: Block ordering is mathematically guaranteed by offset construction.

These tests cannot fail by design and provide no information about the data.

**Disproving experiment**: v0.4.5 Critical Review — code analysis of EXP-019.

**Files tested**: EXP-019 source code.

**Faces/models tested**: N/A — methodological analysis.

**Confidence**: High

**Date last updated**: 2026-07-16

---

## FH-015: N=2 Alternative Body[0] Is Previous Face's EdgeCount

**Status**: Falsified

**Original hypothesis**: For faces with N=2 alternative header `[4,8,2,2]` at mp-24, the body[0] value at mp-8 is the previous face's edgeCount.

**Evidence against**: Cross-face traversal in DisplayLists order across 8 files shows 292/299 (97.7%) failures. The value at mp-8 is overwhelmingly `3` (241/300 = 80.3%), not the previous face's edgeCount.

**Disproving experiment**: `v0.4.3/docs/research/exp021_prev_edgecount_falsification.js`

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 300 N=2 faces across 8 files.

**Confidence**: High

**Date last updated**: 2026-07-16

---

## FH-016: Cylindrical Surface VC Scales Linearly with Hole Diameter

**Status**: Falsified

**Original hypothesis**: The cylindrical surface vertex count scales approximately linearly with hole diameter: vc ≈ 14 * diameter_mm.

**Evidence against**: EXP-028 measured vc=70 for 5mm hole (C04) and vc=56 for 3mm hole (C05). Ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67. Linear scaling rejected.

**Disproving experiment**: EXP-028 Investigation 1

**Files tested**: C04, C05, C07, C08

**Faces/models tested**: 4 models with holes

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-017: Feature Changes Are Localized to Affected Faces in Binary Representation

**Status**: Falsified

**Original hypothesis**: Feature operations (fillet, chamfer, hole, shell) only affect the binary data of affected faces; unrelated faces remain completely unchanged in the binary diff.

**Evidence against**: EXP-028 showed binary diffs dominated by inter-face metadata (50-80%). Face start offsets shift globally. The entire DL is re-serialized on any face change.

**Disproving experiment**: EXP-028 Investigation 2

**Files tested**: C00↔C03, C00↔C04, C00↔C09, C00↔C10

**Faces/models tested**: 4 pairs

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-018: SLDPRT Vertices Are Exact B-Rep Geometry

**Status**: Falsified

**Original hypothesis**: SLDPRT vertex coordinates correspond exactly to STEP B-rep vertices.

**Evidence against**: EXP-028 showed SLDPRT↔STEP exact matches only 3-12.5% (3/24 for C00, 6/212 for C04, 4/60 for C03). Mean distance ~0.01mm. SLDPRT vertices are tessellated approximations.

**Disproving experiment**: EXP-028 Investigation 3

**Files tested**: C00, C03, C04

**Faces/models tested**: 3 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-019: Block1 Tokens Encode Geometry-Specific Parameters

**Status**: Falsified

**Original hypothesis**: Block1 section-body tokens encode geometry-specific parameters that change predictably when geometry changes.

**Evidence against**: EXP-029 found that cylindrical face tokens are identical up to length between C04 (vc=70, diameter=5mm) and C05 (vc=56, diameter=3mm). Tokens do NOT change with diameter. Token length is determined by vc via INV-017 (structural invariant).

**Disproving experiment**: EXP-029

**Files tested**: C00, C03, C04, C05, C09

**Faces/models tested**: 30 faces across 5 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-020: Block1 Tokens Encode Vertex Indices

**Status**: Falsified

**Original hypothesis**: Block1 tokens correspond to vertex indices (0 to vc-1) in the face's tessellation.

**Evidence against**: EXP-030 found that token values exceed vertex count for all faces tested. For cube face with 4 vertices, tokens are [1, 5, 82, 0, 79, 62] — values 5, 82, 79, 62 are OUT OF RANGE for 4 vertices.

**Disproving experiment**: EXP-030

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-021: Block1 Tokens Encode Edge Counts

**Status**: Falsified

**Original hypothesis**: Block1 tokens correspond to edge counts or identifiers in the face's topology.

**Evidence against**: EXP-030 found only 2 matches across all faces tested. No consistent mapping between tokens and edge counts.

**Disproving experiment**: EXP-030

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-022: Block1 Tokens Encode Loop Sizes

**Status**: Falsified

**Original hypothesis**: Block1 tokens correspond to loop sizes or boundaries in the face's topology.

**Evidence against**: EXP-030 found only 5 matches across all faces tested. No consistent mapping between tokens and loop sizes.

**Disproving experiment**: EXP-030

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-023: Block1 Tokens Correlate with Block2 Values

**Status**: Falsified

**Original hypothesis**: Block1 tokens correspond to Block2 values (loop vertex counts) in the face's data.

**Evidence against**: EXP-030 found only 5 matches across all faces tested. No consistent mapping between tokens and Block2 values.

**Disproving experiment**: EXP-030

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-024: All Planar Faces Share One Normalized Token Signature

**Status**: Falsified

**Original hypothesis**: All planar faces (ec=4, vc=4, secCount=1) share one normalized token signature.

**Evidence against**: EXP-031 found that 27 planar cube faces have 9 unique first-20 patterns. Token signatures differ by face orientation.

**Disproving experiment**: EXP-031

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-025: Token Signatures Are Determined Primarily by Geometry Dimensions

**Status**: Falsified

**Original hypothesis**: Token signatures are determined primarily by geometry dimensions (e.g., hole diameter).

**Evidence against**: EXP-031 found that cylindrical faces with different diameters (C04 vc=70, C05 vc=56, C11 vc=64) have identical token patterns.

**Disproving experiment**: EXP-031

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-026: Token Signatures Are Invariant for the Same Orientation Across Models

**Status**: Falsified

**Original hypothesis**: Token signatures are invariant for the same orientation across models.

**Evidence against**: EXP-032 found that same orientation has different tokens across models for +X and +Y orientations. C03 and C09 have modified patterns compared to C00, C04, C05, C11.

**Disproving experiment**: EXP-032

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-027: Token Signatures Are Primarily Determined by Serialization Position

**Status**: Falsified

**Original hypothesis**: Token signatures are primarily determined by serialization position (face index).

**Evidence against**: EXP-032 found that same face index has different tokens across models.

**Disproving experiment**: EXP-032

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-028: Token Signatures Are Primarily Determined by Topology/Vertex Ordering

> **Correction, 2026-09-14 (EXP-042–046):** The broad rejection of topology/vertex-order involvement is superseded by the explicit strip-edge mapping in EXP-043/045. The historical test did not test this mapping. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Falsified

**Original hypothesis**: Token signatures are primarily determined by topology/vertex ordering.

**Evidence against**: EXP-032 found that faces with same vertex position have different tokens.

**Disproving experiment**: EXP-032

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-029: Token Signatures Are Determined Primarily by Local Topology

> **Correction, 2026-09-14 (EXP-042–046):** The broad rejection of local topology is superseded by the edge-ID/metadata correspondence. Preserve the narrow original comparison, not the universal interpretation. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Falsified

**Original hypothesis**: Token signatures are determined primarily by local topology (ec, vc, secCount, b1Len).

**Evidence against**: EXP-033 found that signature changes occur while all structural properties (ec=4, vc=4, secCount=1, b1Len=6) remain identical across models.

**Disproving experiment**: EXP-033

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-030: Token Signatures Depend on Direct Feature Modification

**Status**: Falsified (EXP-033, original claim) — **CORRECTION (2026-08-16, EXP-039): this falsification is unreliable, mirroring the correction already applied to FH-031 on 2026-08-14/15.** EXP-033's claim that +X/+Y are "NOT directly modified" used `ec`/`vc`/`secCount`/`b1Len` staying constant as the modification criterion. But `exp037_edge_location_and_adjacency.js`'s `facesIdentical()` (built 2026-08-14, used ever since) already compares full per-vertex coordinates, and its own raw output (`EXP037_RESULTS.json`, `EXP038_RESULTS.json`) records `identical: false` for exactly these faces — their corner vertex nearest the fillet/chamfer moves from `0.01` to `~0.009` while vertex count stays 4. This signal existed since 2026-08-14 but was never used to revisit FH-030, even though the equivalent adjacency signal was used to correct FH-031 on the same/following days. EXP-039 (2026-08-16) surfaced it explicitly and cross-tabulated it against token-changed status: every face with `identical: false` that has a token comparison recorded also has a changed token (11/11, no counterexamples across the corpus tested through EXP-039). **The original hypothesis (H3, direct modification) is NOT falsified; on the vertex-coordinate-based definition it holds with 0 counterexamples in the tested corpus.** This entry is retained per evidence-preservation policy; do not delete the original text below.

**Original hypothesis**: Token signatures depend on whether a face is directly modified by a feature.

**Evidence against (EXP-033, now known unreliable)**: EXP-033 found that signature changes occur on +X/+Y faces, which are NOT directly modified by fillet/chamfer features.

**Disproving experiment**: EXP-033 — **superseded by EXP-039**, which found the disproof relied on a modification criterion (ec/vc/secCount/b1Len) that the project's own later, more careful tooling (EXP-037/038) already contradicts via vertex-coordinate comparison. See `knowledge/evidence/2026-08-16_v0.4.7-EXP039.md`.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High (original claim) — **now Low/rejected**, see correction. EXP-039's corrected finding carries High confidence (real vertex-coordinate measurement, already computed by validated tooling, 11/11 consistent, 0 counterexamples in the tested corpus).

**Date last updated**: 2026-08-16 (correction); original 2026-08-14

**CORRECTION NOTE (2026-08-17, audit of EXP-037→EXP-040)**: The "11/11" figure in the 2026-08-16 correction above (and in "Confidence") is not supported by `EXP039_DIRECT_MODIFICATION_NECESSITY.json` — that script's `rows` array structurally excludes every directly-modified face by design (it only evaluates unmodified faces), so it never computed 11/11. Recomputed directly from `EXP037_RESULTS.json`/`EXP038_RESULTS.json`: 15 directly-modified (vertex-position) faces exist across the tested corpus, 14 with a confirmed token change, 1 with no archived token data. **Correct figure: 14/14 known cases, 1 unknown — not 11/11.** This does not change the correction's conclusion (FH-030 should read Unknown, not Falsified — the vertex-coordinate-based definition still holds with 0 counterexamples among the known cases); only the specific count is fixed. See `v0.4.7/EXP039_SUMMARY.md`'s matching correction note for the full derivation.

**UPDATE NOTE (2026-09-13, EXP-041)**: A new data point from the first from-source parse of the controlled corpus (`d0c6c54` added the C00–C11 binaries). In `C04 → C06` (hole position moved only), the cylindrical face's 70 vertices are translated by a single uniform delta — `[0.002, 0, 0]` exactly, one distinct delta across all 70 — while `vc`(70), `secCount`(1) and `b1Len`(138) stay constant, so both token arrays have equal length and are comparable element-wise. **Its Block1 tokens and `b2Body` are byte-identical.** This is the first face in the corpus whose own vertex coordinates *all* changed with no token change *inside a model pair where other faces did change* (faces 4/5 change, length-forced by INV-016). It matters for this entry because the existing evidence that raw vertex modification is not *sufficient* (see `v0.4.7/RESEARCH_DESIGN_next_experiment.md` §0.1) rested entirely on C01/C02 — whole-model similarity transforms, which `matchFaces` cannot correspond at all (0 matched rows), so they never appear in any cross-tabulation and that figure had to be assembled by hand from EXP-034. C06 supplies the same conclusion from a **local** change inside a non-similarity model edit, and it appears directly in the table. **This does not revive the falsification of this entry and does not alter its corrected status (Unknown, not Falsified)**: a pure translation is a similarity transform of the face itself, so the refined form of the hypothesis — that a *non-similarity* change to the face's own shape is what matters — is untouched. What it does is sharpen the distinction between "the face's own vertices moved" (not sufficient) and "the face's own shape changed" (still live). See `knowledge/evidence/2026-09-13_v0.4.7-EXP041.md` §4.1.

---

## FH-031: Token Signatures Depend on Adjacency to Modified Geometry

**Status**: Falsified

**Original hypothesis**: Token signatures depend on adjacency to modified geometry.

**Evidence against**: EXP-033 found that signature changes occur on +X/+Y faces, which are NOT adjacent to modified geometry.

**Disproving experiment**: EXP-033

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High

**Date last updated**: 2026-08-14

---
### CORRECTION NOTE (2026-08-14, Archivist Audit)

**Status effectively downgraded: this hypothesis was never genuinely tested, so it cannot be recorded as Falsified with High confidence.**

The disproving script's adjacency check (`isAdjacentToModified()` in `v0.4.7/exp033_feature_state.js`) tests only whether a face shares an orientation *label* with a directly-modified face, not real topological (edge/vertex-sharing) adjacency — see the function's own source comment. On this cube corpus the test is structurally incapable of ever returning `true` for +X/+Y against a fillet/chamfer feature, so "signature changes occur without adjacency" does not follow from the data; adjacency (in the geometric sense) was never computed. Geometrically, a fillet/chamfer along the edge shared by +X and +Y is, by construction, adjacent to both.

**Corrected status: Unknown (test invalid) — not Falsified, not Verified.** The original entry above is retained unmodified for historical continuity per policy. Re-testing requires a real edge/vertex-sharing adjacency computation from vertex coordinates, which the corpus data supports but which was not implemented in `v0.4.7/exp033_feature_state.js`.

See `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding A).

---
### UPDATE (2026-08-14, EXP-037)

The re-test recommended above was performed, using a real edge/vertex-sharing adjacency computation (`v0.4.7/exp037_edge_location_and_adjacency.js`) against archived per-face vertex coordinates. Result: for the one edge this corpus contains (C03/C09), the real adjacency set of the new feature face is exactly {+X, +Y, +Z, -Z} — precisely the set of faces whose token signature changed. This is the **opposite** of this hypothesis's original "Falsified" claim: it is evidence *for*, not against, "token signatures depend on adjacency to modified geometry" — at least for fillet/chamfer, on this one edge.

**This hypothesis should NOT be re-recorded as Falsified.** It also should not yet be promoted to Verified/Strong-Evidence-general: (a) it is correlational, not causal, on a single edge (NQ-028, still blocked on a new model, is the test that would generalize or falsify it); (b) the shell contrast case in EXP-037 shows real adjacency to a new face does NOT reliably produce a token change for shell (its new inner walls are adjacent to unmodified, token-identical outer walls per EXP-035) — so "adjacency" is not a universal sufficient condition across feature types, only a fillet/chamfer-specific correlation so far. **Current status: Strong Evidence (fillet/chamfer, single edge) — not Falsified, not a general Verified invariant.** See `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §3–§5.

### UPDATE (2026-08-15, EXP-038)

NQ-028's blocking condition (no second edge in the corpus) is resolved: a real C12 model (1mm fillet, edge shared by -X/-Y, supplied by the user) was tested. Result: the real adjacency set again exactly equals the token-changed set — {-X,-Y,+Z,-Z} for C12, mirroring C03's {+X,+Y,+Z,-Z} — replicating (a) from the update above at a second, independent edge location. **This hypothesis should still NOT be recorded as Falsified, and is further strengthened toward (but still short of) Verified: current status upgraded to Strong Evidence, n=2 independently tested edges** (was: single edge). Caveats (a)/(b) from the 2026-08-14 update still apply unchanged: still correlational, not causal (mechanism unknown); shell's contrasting behavior (adjacency without a token change) still means this is not a universal cross-feature-type law. A new caveat identified by EXP-038: for edge-type features (fillet/chamfer) specifically, "real topological adjacency to the new face" and "this face's own vertices were directly, if minutely, modified by the trim" are indistinguishable in this corpus — both hypotheses predict the identical face set, since an edge fillet by construction trims exactly its two bordering faces. See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md` §6–§7.

### CORRECTION NOTE (2026-08-16, Audit + EXP-040)

**The "shell's contrasting behavior" caveat in the update immediately above is not supported by the data and should not be relied on.** A 2026-08-16 audit, followed up by EXP-040, found that EXP-037's claim of shell adjacency-without-a-token-change rests on a face-indexing error: `EXP037_SUMMARY.md` and its evidence file named C10 indices 7 and 9 as "unmodified outer walls" that the new inner-wall faces are adjacent to — but indices 7 and 9 are themselves new inner-wall faces (per the same documents' own face census), not outer walls. Two independent recomputations (one reusing EXP-037's own already-archived `adjacentToModelFaces` records, one a from-scratch shared-vertex recount directly from `VERTEX_ANALYSIS.json`'s raw coordinates, bypassing EXP-037's code entirely) both show **zero** shared vertices between any of C10's five new inner-wall faces and any of its five unmodified, token-identical outer walls. The new inner-wall faces are real-adjacent only to the shell's own directly-modified opening face and to each other. Shell therefore contributes **no** adjacent-but-unchanged counterexample at all — it simply supplies no adjacency test case in either direction, since none of its unmodified faces are ever adjacent to new geometry.

**This does not newly prove "adjacency causes a token change" is a universal, cross-feature-type law** — it removes a specific piece of evidence that had been cited against that generalization; it does not add a new confirming case beyond what fillet/chamfer already established. Also unaffected: the n=2-edges caveat that the two tested edges (C03's +X/+Y, C12's -X/-Y) are related by the cube's own 180°-rotation symmetry, not fully independent samples (this was already disclosed in `EXP038_SUMMARY.md`'s "What This Does NOT Establish" point 4, but is repeated here since headline text elsewhere in this knowledge base sometimes drops that qualifier). **Current status unchanged at Strong Evidence, n=2 independently tested edges (symmetry-related) — not Verified, not Falsified.** A full corpus-wide adjacency/token-change tally (all four feature types, not just fillet/chamfer) is now 0 exceptions in either direction (10 adjacent+changed, 0 adjacent+unchanged, 0 non-adjacent+changed, 13 non-adjacent+unchanged, 1 unknown) — see `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md`. This is compatible with, not contradicted by, the separately-run EXP-039 above (its own "0/12" figure already used fresh adjacency data, not the erroneous claim being corrected here).

---

## FH-032: Block1 Tokens Encode Geometric Transformations

**Status**: Falsified

**Original hypothesis**: Block1 tokens encode geometric transformations (scale, translation) and change when geometry is transformed.

**Evidence against**: EXP-034 found that Block1 tokens are COMPLETELY INVARIANT under scale (C00→C01, 2x) and translation (C00→C02, 50mm). All 18 face comparisons show identical Block1 tokens despite vertex coordinate changes. **Strong evidence:** Block1/Block2 structures are independent of the tested absolute vertex coordinates. Unknown: exact semantic meaning. Not established: that they specifically encode topology.

**Disproving experiment**: EXP-034

**Files tested**: C00, C01, C02

**Faces/models tested**: 18 face comparisons across 3 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-033: Shell Causes Token Changes on Remaining Faces

**Status**: Falsified

**Original hypothesis**: Shell operation causes Block1 token-signature changes on remaining faces, consistent with the fillet/chamfer pattern observed in EXP-033.

**Evidence against**: EXP-035 found that C10's 5 original outer faces have IDENTICAL Block1 tokens to C00. Shell does NOT change tokens on existing faces. Shell adds 5 new inner wall faces with unique token signatures, but these are NEW faces, not changes to existing faces.

**Disproving experiment**: EXP-035

**Files tested**: C00, C10

**Faces/models tested**: 17 faces across 2 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-034: Number of Faces Distinguishes Global Token Change Models

**Status**: Falsified

**Original hypothesis**: The number of faces distinguishes fillet/chamfer (global token changes) from holes/shell (no global token changes).

**Evidence against**: EXP-036 found that C03/C09/C04/C05/C11 all have 7 faces. Face count does NOT distinguish the groups. Only C10 (shell) has 11 faces, but it does NOT produce global token changes.

**Disproving experiment**: EXP-036

**Files tested**: C00, C03, C04, C05, C09, C10, C11

**Faces/models tested**: 52 faces across 7 models

**Confidence**: High

**Date last updated**: 2026-08-14

---

## FH-035: Multi-Loop Faces Distinguish Global Token Change Models

**Status**: Falsified

**Original hypothesis**: The presence of multi-loop faces distinguishes fillet/chamfer (global token changes) from holes/shell (no global token changes).

**Evidence against**: EXP-036 found that C09 (chamfer) has 0 multi-loop faces but produces global token changes. C04/C05/C11 (holes) have 2 multi-loop faces but do NOT produce global token changes. Multi-loop faces do NOT distinguish the groups.

**Disproving experiment**: EXP-036

**Files tested**: C00, C03, C04, C05, C09, C10, C11

**Faces/models tested**: 52 faces across 7 models

**Confidence**: High

**Date last updated**: 2026-08-14

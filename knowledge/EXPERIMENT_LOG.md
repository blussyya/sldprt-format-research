# Experiment Log

> **2026-09-14 current-state correction — EXP-042–046:** Read [the v0.4.8 format report](../v0.4.8/README.md) before using the historical conclusions below. Block2 describes triangle strips, not CAD loops; Block1 annotates strip edges and links exactly to downstream edge IDs. The predecessor array is always present on the tested corpus. A third byte array and a forward metadata grammar are now recorded. `parser/v0.2` implements the verified read-only path. Old text is retained as evidence, not current guidance.

Project-wide experiment ledger. Each experiment should end with facts, hypotheses, tested files/counts, confidence, and follow-up.

Source migrated from `v0.3.5/docs/research/EXPERIMENT_LOG.md`.

---

## EXP-001: Face Marker Detection

**Status**: Observation

**Goal**: Locate candidate face blocks in DisplayLists.

**Method**: Scan for `[12, 0, 0, 0, 100, 0, 0, 0]`, then validate nearby `edgeCount` and `vertexCount`.

**Evidence / facts**:

- 156 candidate markers were found in BOTTOM DisplayLists.
- 39 faces parsed after validation.
- The marker corresponds to the gap marker, not the actual face start.
- Face start is before the marker at the `edgeCount` field.

**Files tested**: `USB hub case BOTTOM.SLDPRT`

**Faces/models tested**: 1 model, 39 validated faces.

**Confidence**: High that the scanner can locate faces; low on false-positive causes.

**Date last updated**: 2026-06-27

---

## EXP-002: Block 1/2 Structure Discovery

**Status**: Verified Conclusion for headers; Hypothesis for Block 1 semantics.

**Goal**: Understand topology-like blocks after vertex and normal arrays.

**Method**: Parse `[4, 8, 2, N]` headers and compare body lengths.

**Evidence / facts**:

- Block 1 header is `[4, 8, 2, N]`.
- Block 2 header is `[4, 8, 2, M]`.
- Block 2 entries decode to loop vertex counts with `(raw + 2) / 2`.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High for headers and Block 2 count behavior; medium-low for Block 1 interpretation.

**Date last updated**: 2026-06-27

---

## EXP-003: Gap-Based Loop Splitting

**Status**: Failed Experiment / Disproving Evidence

**Goal**: Determine whether loop boundaries can be recovered from normal discontinuities.

**Method**: Compare adjacent vertex normals and split when deviation exceeds threshold.

**Evidence / facts**:

- Detected breaks appeared on strip diagonals rather than true loop boundaries.
- Normal data is not a reliable loop-boundary source.

**Disproved hypotheses**: FH-005

**Files tested**: v0.3.0-v0.3.3 modern test corpus.

**Faces/models tested**: Multiple faces; exact count not preserved in migration.

**Confidence**: High that this method is invalid.

**Date last updated**: 2026-06-27

---

## EXP-004: Block 2 Slicing Mask Formula

**Status**: Verified Conclusion

**Goal**: Decode Block 2 loop-size entries.

**Method**: Decode each raw value with `(raw + 2) / 2` and check whether the decoded sum equals face `vertexCount`.

**Evidence / facts**:

- Formula holds for all tested faces.
- Decoded loop sizes sum exactly to each face's vertex count.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: BOTTOM 39/39, TOP 68/68, GEAR 113/113, DEKOR 375/375. Total 595/595.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## EXP-005: Gap Marker Identification

**Status**: Verified Conclusion

**Goal**: Identify the 16-byte gap between position and normal arrays.

**Method**: Forensic byte-offset dump of selected simple and complex face blocks.

**Evidence / facts**:

- Gap marker is `[12, 100, 2, vertexCount]`.
- Face block starts with `[edgeCount, 100, 2, vertexCount]`.
- Earlier face scanner finds the gap marker, then works backward to face start.

**Disproved hypotheses**: FH-003, FH-006

**Files tested**: GEAR selected faces, with aggregate support from BOTTOM/TOP/DEKOR.

**Faces/models tested**: Selected forensic faces plus 595 aggregate parsed faces.

**Confidence**: High

**Date last updated**: 2026-06-27

---

## EXP-006: Block 1 Grammar Discovery

**Status**: Correlation

**Goal**: Discover Block 1 grammar without assigning semantics.

**Method**: Classify Block 1 u32 values as ZERO, ONE, SMALL, LARGE. Analyze starts, run lengths, bigrams, and trigrams.

**Evidence / facts**:

- 595/595 faces start with ONE.
- ONE count equals Block 2 entry count in 595/595 faces.
- ONE values are singleton runs.
- Dominant bigrams are `LARGE -> ZERO` and `ZERO -> LARGE`.
- Dominant trigram is generally `ZERO -> LARGE -> ZERO`.
- The branch notebook records a single-loop pattern `ONE [ZERO LARGE]*` and variable multi-loop patterns.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High for grammar observations; low for semantic interpretation.

**Date last updated**: 2026-06-27

---

## EXP-007: Loop Correspondence Verification

**Status**: Verified Conclusion for count equality; Correlation for segment meaning.

**Goal**: Test whether Block 1 ONE count equals Block 2 loop count.

**Method**: Count `1` values in Block 1 and compare to Block 2 body length.

**Evidence / facts**:

- BOTTOM: 39/39 faces match.
- TOP: 68/68 faces match.
- GEAR: 113/113 faces match.
- DEKOR: 375/375 faces match.
- Total: 595/595 faces match.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: Very high for count equality.

**Date last updated**: 2026-06-27

---

## EXP-008: DisplayLists Stream Audit

**Status**: Observation

**Goal**: Map internal structure of main DisplayLists streams.

**Method**: Analyze decompressed streams for markers, topology headers, strings, entropy, and `[1,1]` structures.

**Evidence / facts**:

- BOTTOM DisplayLists size: 98481 bytes.
- BOTTOM had 156 candidate face markers and 39 parsed faces.
- BOTTOM had 63 topology headers and 11 `[1,1]` section-like headers.
- GEAR section audit recorded 59 `[1,1]` section-like structures and 113 parsed faces.
- Embedded strings included class-name-like values such as `uiUserModelEnv_c`, `moAmbientLight_c`, and `uoBodyPropInfo_c`.

**Files tested**: BOTTOM, with supporting GEAR section audit.

**Faces/models tested**: BOTTOM 39 parsed faces; GEAR 113 parsed faces for section counts.

**Confidence**: High that DisplayLists contains more than face blocks; low for section semantics.

**Date last updated**: 2026-06-27

---

## EXP-009: Observed Block 1 Section Length Forms

**Status**: Observation

**Goal**: Record today's measured Block 1 section-form observation without assigning semantics.

**Method**: Reported measurement over the current measured corpus compared Block 1 section length against decoded loop size.

**Evidence / facts**:

- The observed section length relation is `len = 2 * loopSize - 2`.
- The class `VALUE` is observational only: any Block 1 integer other than `0` or `1`.
- The observation does not distinguish whether Block 1 is best modeled as grammar or as opcode/operand bytecode.

**Files tested**: Today's measured corpus; exact file list not yet archived.

**Faces/models tested**: Today's measured corpus; exact face/model count not yet archived.

**Confidence**: High for the reported measured corpus, pending raw evidence archival.

**Date last updated**: 2026-06-27

---

## EXP-010: Property-Table Hypothesis Falsification

**Status**: Failed Experiment / Disproving Evidence

**Goal**: Test whether Block 1 `VALUE` tokens encode or index a property table.

**Method**: Today's report cites random-base controls, frequency-bias analysis, and delimiter-artifact analysis.

**Evidence / facts**:

- Random-base controls did not support the property-table model.
- Frequency bias was observed in the candidate VALUE distribution.
- The apparent property-table signal was attributed to a delimiter artifact.
- VALUE semantics remain UNKNOWN.

**Disproved hypotheses**: FH-013

**Files tested**: Today's measured corpus; exact file list not yet archived.

**Faces/models tested**: Today's measured corpus; exact face/model count not yet archived.

**Confidence**: High for rejecting the property-table hypothesis, pending raw evidence archival.

**Date last updated**: 2026-06-27

---

## EXP-011: Block 1 Invariant Validation (v0.4.0)

**Status**: Verified Structural Invariant for I1/I2/I3; Observation for corpus statistics

**Goal**: Validate three Block 1 structural invariants across the full corpus and collect corpus-wide statistics.

**Method**: Parse 4 modern openswx-like files with `v0.4.0/block1_parser.js`; build per-face AST; validate I1 (`b1len = 2 × (vertexCount − sectionCount)`), I2 (`sectionBodyTokenCount = Block2[i] − 1`), I3 (`Σ Block2[i] = b1len`); collect section length distribution, ZERO run lengths, positional frequency, VALUE repetition counts.

**Evidence / facts**:

- I1 passes: 593/593 (100%)
- I2 passes: 593/593 (100%)
- I3 passes: 593/593 (100%)
- 3429 ONE-delimited sections across the corpus
- 53 distinct section lengths observed (odd numbers: 3, 5, 7, ..., 215)
- Section length alone does not uniquely determine token-class sequence: only 16/53 lengths (30.2%) have a single unique class pattern
- Most common section lengths: 3 (882/3429), 7 (825/3429), 11 (497/3429)
- VALUE tokens repeat in 1937/3429 sections (56.5%)
- Total VALUE tokens: 16174; distinct: 6082; repeat occurrences: 2636
- ZERO run lengths: heavily skewed to length 1 (11020/14536 runs); runs up to 95 observed

**Disproved hypotheses**: None directly; FH-011 and FH-013 remain falsified and are consistent with invariant data.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 593 of 595 corpus faces across 4 models. BOTTOM: 39/39, TOP: 68/68, GEAR: 113/113, DEKOR: 373/375. The 2 DEKOR faces that failed v0.4.0 parser validation are under investigation.

**Confidence**: High for invariants (I1/I2/I3); low for interpretation of corpus statistics.

**Date last updated**: 2026-06-27

**Raw evidence**: `knowledge/evidence/2026-06-27_v0.4.0-invariant-validation.md`, `knowledge/evidence/2026-06-27_v0.4.0-corpus-analysis.txt`

---

## EXP-012: Rewrite System Analysis

**Status**: Observation

**Goal**: Determine whether a deterministic rewrite function exists between VALUE tokens in structurally equivalent Block 1 encodings across files.

**Method**: Cross-file VALUE→VALUE mapping construction. Compare sections by structural key (vc, ec, b1len, b2len). Test context resolution for ambiguous mappings.

**Evidence / facts**:

- BOTTOM→TOP: 20 ambiguous source values out of 887 mappings (max fan-out 3). Resolution requires (section index, position) context.
- BOTTOM→GEAR: 4 ambiguous out of 40 mappings. Global mapping is a bijection.
- BOTTOM→DEKOR: 6 ambiguous out of 42 mappings.
- TOP→GEAR: 15 ambiguous out of 64 mappings.
- TOP→DEKOR: 18 ambiguous out of 81 mappings.
- GEAR→DEKOR: 47 ambiguous out of 189 mappings.
- BOTTOM↔TOP deep analysis: 28 face pairs analyzed. Context (secIdx, pos) resolves all ambiguities. Section length, left/right neighbors, and their combinations insufficient without section index.

**Interpretation**: The rewrite function exists and is deterministic given (section index, position). Why section index matters for some file pairs (BOTTOM↔TOP) but not others (BOTTOM→GEAR) is unknown.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models; 28 BOTTOM↔TOP face pairs for deep analysis.

**Confidence**: High that the mapping is deterministic with (secIdx, pos) context; low on why section index is the disambiguator.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.1-rewrite-analysis.md`

---

## EXP-013: Stress Test Of Currently Testable Invariants

**Status**: Verified

**Goal**: Stress-test every verified invariant across expanded corpus. Treat every invariant as guilty until proven innocent.

**Method**: Parse 8 files with `v0.4.2/stress_test_invariants.js`. Test all 17 currently testable invariants on every face. Produce minimal reproducers for any failure.

**Evidence / facts**:

- Corpus expanded from 4 files (593 faces) to 8 files (1,232 faces), adding HEADPHONE (62), DISTRIBUTOR (51), POCKET (400), PTC (126).
- All currently testable invariants evaluated by the v0.4.2 pipeline survived the stress test. Zero structural violations.
- INV-012 formula `len = 2 * loopSize - 2` is incorrect: 0/3429 sections match. Correct relationship is `sectionBodyTokenCount = Block2[i] - 1` (INV-017).
- OLE2 files (SW2000, PLATE4, CHAINWHEEL) remain unparseable by current pipeline.
- Edge cases observed: HEADPHONE has MeshData/Config-0-Mesh-27 stream; PTC has Config-0-FeatureBodies/LocalBodies stream.
- DEKOR 2-face discrepancy (v0.4.0 counted 375, v0.4.2 counts 373) persists — caused by vc<=5000 filter threshold.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 1,232 faces across 8 files (3,429 ONE-delimited sections).

**Confidence**: High for all 17 tested invariants; INV-012 formula downgraded.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`

---

## EXP-014: Reviewer Criticism Audit

**Status**: Verified

**Goal**: Evaluate four specific reviewer criticisms: (1) parser filtering circularity, (2) two DEKOR face discrepancy, (3) INV-018 mathematical independence, (4) INV-012 formula discrepancy.

**Method**: Audit script `v0.4.2a/audit_v042a.js` traces every candidate through the extraction funnel and tests criticized claims. Byte-level traces for any failures.

**Evidence / facts**:

- **Audit 1 — Circularity CONFIRMED**: Filters F8 (B1 header magic) and F11 (B2 header magic) pre-assume INV-005 and INV-006. These invariants are unfalsifiable by the current pipeline. INV-007 through INV-018 are not affected.
- **Audit 2 — DEKOR faces RESOLVED**: The 2 missing faces (marker offsets 0x2636, 0x35d7d) have vertexCount=5862 and were rejected by the vc<=5000 filter. With vc<=10000 (as in v0.3.5), they pass all invariants.
- **Audit 3 — INV-018 DEPENDENCY CONFIRMED**: INV-018 is a mathematical consequence of INV-017 plus the definition of section splitting. 1232/1232 faces where INV-017 passes also pass INV-018.
- **Audit 4 — INV-012 DISCREPANCY CONFIRMED**: Documentation mistake. Formula is off by +1. Correct relationship is `len = 2 * loopSize - 3` (= `raw - 1`), not `len = 2 * loopSize - 2` (= `raw`).

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 4,936 marker candidates across 8 files; 1,232 accepted faces; 3,704 rejected.

**Confidence**: High for all four audit findings.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.2a-audit.md`

---

## EXP-015: Non-Circular Validation Pipeline

**Status**: Verified with Limitations

**Goal**: Test INV-005 and INV-006 without pre-filtering on header magic. Accept any marker match, read bytes at computed positions, and test headers only after reading.

**Method**: Script `v0.4.2a/non_circular_validation.js` skips all header-based pre-filtering. Accepts any candidate where a [12,100,2,vc] marker is found. Tests B1/B2 headers on raw-read bytes.

**Evidence / facts**:

- 4,936 total candidates across 8 files.
- INV-005: 1,234 pass (valid [4,8,2,N]), 3,702 fail (readable bytes that are not [4,8,2,N] — all clearly false positives from non-face data).
- INV-006: 1,234 pass, 0 fail — every candidate with a readable B2 position has [4,8,2,M].

**Limitations — remaining assumptions not removed**:

1. **Marker selection**: Faces are still located by the [12,100,2,vc] gap marker pattern. Any face not preceded by this marker would be missed.
2. **Normal-offset layout assumption**: The pipeline assumes normals follow immediately after the 16-byte gap. Empirically validated but remains an assumption.
3. **Vertex-count bounds**: The vc limit (6000) bounds the search.
4. **Float validity filters**: Position validation discards candidates with non-finite or extreme float values.
5. **Block ordering**: Assumes positions → gap → normals → Block 1 → Block 2 in strict linear order.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 4,936 candidates; 1,234 with valid B1/B2 headers.

**Confidence**: High that INV-005 and INV-006 hold for marker-detectable face blocks; medium that no undetected face violates them.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.2a-non-circular.md`

---

## EXP-016: Independent Implementation Reproducing INV-016/017/018

**Status**: Verified

**Goal**: Reproduce INV-016/017/018 using a completely different implementation, independent of block1_parser.js and stress_test_invariants.js.

**Method**: Script `v0.4.2a/independent_parser.js` implements marker-based face extraction with independent code. Reports INV-005/006 as pre-conditions (tested, not assumed). Validates INV-016/017/018 on accepted faces.

**Evidence / facts**:

- Total faces: 1,234 (vc limit 10000).
- B1 valid [4,8,2,N]: 1,234/1,234.
- B2 valid [4,8,2,M]: 1,234/1,234.
- INV-016 pass: 1,234/1,234 (100%).
- INV-017 pass: 1,234/1,234 (100%).
- INV-018 pass: 1,234/1,234 (100%).
- Zero failures across all three invariants.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 1,234 faces across 8 files.

**Confidence**: High — independent implementation eliminates implementation-specific bias for INV-016/017/018.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.2a-independent-parser.md`

---

## EXP-017: Expanded Corpus Test

**Status**: Verified

**Goal**: Include 2 previously-rejected DEKOR faces (vc=5862) by raising vc limit from 5000 to 6000. Verify all invariants hold on expanded corpus.

**Method**: Script `v0.4.2a/expanded_corpus_test.js` extracts faces with vc<=6000 (vs v0.4.2's vc<=5000). Logs every high-vc face (vc>5000) as special observation. Runs all invariants.

**Evidence / facts**:

- Total faces at vc<=6000: 1,234 (2 more than v0.4.2's 1,232).
- High-vc faces: 2 (DEKOR, vc=5862 each).
- Both high-vc faces pass all invariants: INV-002/003/004/007/008/009/010/016/017/018.
- The 2 DEKOR faces have b1len=9636, b2count=1044, b2sum=9636, sectionCount=1044.
- The earlier 2-face discrepancy is resolved: the faces are genuine and satisfy all structural invariants. The discrepancy was caused by an arbitrary filter threshold (vc<=5000 vs vc<=10000), not a format or parser error.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 1,234 faces across 8 files.

**Confidence**: High — the 2-face discrepancy in the v0.4.0 corpus is explained and resolved.

**Date last updated**: 2026-07-10

**Raw evidence**: `knowledge/evidence/2026-07-10_v0.4.2a-expanded-corpus.md`

---

## EXP-027: Binary Differential Analysis of Controlled Corpus

**Status**: Observation

**Goal**: Investigate how known geometric changes (scale, translation, hole diameter/position, fillet, chamfer, shell) manifest in decompressed DisplayLists streams using controlled differential pairs.

**Method**: Byte-level differential analysis of 9 controlled model pairs with known geometric differences, plus vertex position extraction and structural comparison. All 11 controlled models (C00-C10) parsed with the validated v0.4.5/v0.4.6 pipeline.

**Evidence / facts**:

- **Scale (C00↔C01)**: 355 bytes changed (2.95%). DL sizes identical. 0/6 structural differences. Vertex positions scaled by factor of 2.0. Pure position-data transformation.
- **Translation (C00↔C02)**: 1,141 bytes changed (9.47%). DL sizes identical. 0/6 structural differences. Vertex positions translated by (50,50,0)mm. Pure position-data transformation.
- **Hole Diameter (C04↔C05)**: 6,853 bytes changed (36.00%). DL sizes different (19,036 vs 17,688). 3/7 structural differences. Cylindrical surface vc scales with diameter (70 for 5mm, 56 for 3mm).
- **Hole Position (C04↔C06)**: 6,075 bytes changed (31.80%). DL sizes slightly different. 2/7 structural differences. Top/bottom face vc changes, cylindrical vc unchanged.
- **Fillet (C00↔C03)**: 7,477 bytes changed (52.10%). DL sizes different (12,050 vs 14,350). +1 face. Fillet surface ec=13, vc=16.
- **Hole Introduction (C00↔C04)**: 14,218 bytes changed (74.69%). DL sizes very different (12,050 vs 19,036). +1 face. Cylindrical surface ec=70, vc=70.
- **Second Hole Modified (C07↔C08)**: 9,682 bytes changed (37.28%). DL sizes different. 3/8 structural differences. Only affected hole's faces change.
- **Chamfer (C00↔C09)**: 6,444 bytes changed (48.30%). DL sizes different (12,050 vs 13,342). +1 face. Chamfer surface ec=4, vc=4 (flat).
- **Shell (C00↔C10)**: 9,413 bytes changed (54.47%). DL sizes very different (12,050 vs 17,280). +5 faces. Inner walls ec=4, vc=4 each.

**Key findings**:
1. Vertex positions are Float32. Scale/translation are pure position-data transformations.
2. Feature operations change face counts and vertex/edge counts.
3. Hole diameter affects cylindrical surface vc (approximately linear scaling).
4. Feature operations are localized to affected faces.
5. Curved surfaces (fillet, cylinder) have high ec/vc; flat chamfer has low ec/vc.

**Files tested**: C00-C10 (11 controlled models)

**Faces/models tested**: 85 faces across 11 models. All pass INV-016/017/018.

**Confidence**: High for structural observations. Medium for vertex position interpretations (limited to matching-structure faces).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP027.md`, `v0.4.7/CORPUS_AUDIT.json`, `v0.4.7/BINARY_DIFF_SUMMARY.json`, `v0.4.7/VERTEX_ANALYSIS.json`

### CORRECTION NOTE (2026-08-14, Archivist Audit)

Key findings (3) "Hole diameter affects cylindrical surface vc (approximately linear scaling)" and (4) "Feature operations are localized to affected faces" are **falsified/weakened by the very next experiment, EXP-028**, run the same day:

- (3) is **FALSIFIED**: EXP-028 Investigation 1 found vc ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67 (only 2 data points; "linear" was an overclaim from n=2 without checking the ratio). See `FAILED_HYPOTHESES.md`.
- (4) is **WEAKENED**: EXP-028 Investigation 2 found binary diffs are dominated by inter-face metadata (50–80%), not face geometry, because the DisplayLists stream is re-serialized in full whenever any face changes (global byte offsets shift). "Localized" overstated what byte-level differencing can show.

This entry (EXP-027) is retained unmodified above for historical continuity per the append-only policy. See EXP-028 below and `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding C).

---

## EXP-028: Validation/Falsification of EXP-027 Conclusions

> **Correction, 2026-09-14 (EXP-042–046):** Low STEP endpoint equality is not a surface-error measurement. EXP-045 compares all controlled face vertices to analytic STEP surfaces and validates plane/cylinder metadata; original mismatches remain recorded. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Verified (with falsifications)

**Goal**: Validate or falsify EXP-027's conclusions through three targeted investigations: (1) hole-diameter relationship, (2) feature-change localization, (3) SLDPRT↔STEP/STL vertex correspondence.

**Method**: Three dedicated scripts analyzing controlled corpus pairs with explicit tolerance thresholds and numerical comparison.

**Evidence / facts**:

- **Investigation 1 (Hole-Diameter)**: C04 cylindrical vc=70, C05 cylindrical vc=56. Ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67. **EXP-027's "linear scaling" claim FALSIFIED.** With only 2 data points, exact relationship unknown.
- **Investigation 2 (Feature Localization)**: Binary diffs dominated by inter-face metadata (50-80%), not face geometry. Face start offsets shift globally. **EXP-027's "localized to affected faces" claim WEAKENED.** DL is re-serialized entirely on face changes.
- **Investigation 3 (Vertex Correspondence)**: SLDPRT↔STEP exact matches: 3/24 (C00), 6/212 (C04), 4/60 (C03). Mean distance ~0.01mm. **SLDPRT vertices are tessellated approximations, NOT exact B-rep vertices.**

**Key findings**:
1. VC-diameter relationship is NOT linear (ratio mismatch).
2. Feature changes are NOT localized in binary representation.
3. SLDPRT vertices are DisplayList tessellation, not exact geometry.
4. DL is re-serialized entirely on any face change.

**Files tested**: C00, C03, C04, C05, C07, C08, C09, C10

**Faces/models tested**: 8 models, 3 investigations

**Confidence**: High for all three investigations. Explicit tolerance thresholds used.

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`, `v0.4.7/EXP028_HOLE_DIAMETER.json`, `v0.4.7/EXP028_FEATURE_LOCALIZATION.json`, `v0.4.7/EXP028_VERTEX_CORRESPONDENCE.json`

---

## EXP-029: Block1/Block2 Geometry-Encoding Differential

**Status**: Complete

**Goal**: Determine whether Block1/Block2 section-body values contain geometry-dependent information, using the controlled C00–C10 corpus.

**Method**: Extract Block1/Block2 token sequences for all faces, match faces between models using structural properties, compare token sequences, analyze C04↔C05 cylindrical face tokens specifically.

**Evidence / facts**:

- **Cube face tokens consistent**: All cube faces (ec=4, vc=4) have identical tokens across C00, C03, C04, C09. Face 0 tokens: `[1, 5, 82, 0, 79, 62]` in all four models.
- **Cylindrical face tokens identical up to length**: C04 (vc=70) and C05 (vc=56) cylindrical faces have identical first 110 tokens. Pattern: `1, 0, 150, 0, 153, 0, 150, 0, 153, ...`
- **Token length correlates with vc**: Length = 2 * vc - 2 (matches INV-017 for secCount=1).
- **Face matching ambiguous**: All 6 cube faces in C00 have ec=4, vc=4, secCount=1 but different tokens.
- **Token values follow pattern**: Cube face tokens show correlation between token 1 and token 2 (sum increases with token 1).

**Key findings**:
1. Tokens are NOT random or structural-only (identical across models for same geometry).
2. Tokens do NOT encode diameter-specific information (identical up to length for different diameters).
3. Token length is determined by vc via INV-017 (structural invariant).
4. Face matching is ambiguous when using only ec/vc/secCount.
5. Token values may encode tessellation parameters or face orientation.

**Files tested**: C00, C03, C04, C05, C09

**Faces/models tested**: 30 faces across 5 models

**Confidence**: High for structural observations. Medium for token semantics (unknown).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP029.md`, `v0.4.7/EXP029_BLOCK1_GEOMETRY.json`, `v0.4.7/EXP029_SUMMARY.md`

---

## EXP-030: Block1 Token Structural Correspondence

> **Correction, 2026-09-14 (EXP-042–046):** Rejected indices/counts do not exclude edge IDs. EXP-043/045 demonstrates an explicit geometry-to-ID mapping that this candidate list did not test. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Complete

**Goal**: Determine whether Block1 body tokens correspond to structural/topological information rather than geometry-specific parameters.

**Method**: Test tokens against structural candidates (vertex indices, edge counts, loop sizes, Block2 values, etc.) across 6 controlled models.

**Evidence / facts**:

- **Cylindrical face pattern identical**: C04 (vc=70), C05 (vc=56), C11 (vc=64) all have same alternating pattern: `1, 0, 150, 0, 153, 0, 150, 0, 153, 0, ...`
- **Cube face tokens identical**: All cube faces (ec=4, vc=4) have identical tokens `[1, 5, 82, 0, 79, 62]` across all models.
- **No structural correspondence found**: Tokens do NOT correspond to vertex indices, edge counts, loop sizes, or Block2 values.
- **B1Len formula explained**: `b1Len = 2*(vc - secCount)` holds for all 41 faces.
- **Token values not vertex indices**: Token values exceed vertex count for all faces tested.

**Key findings**:
1. Cylindrical face pattern (150, 153) is a structural signature, not geometry-specific.
2. Cube face tokens are a structural signature.
3. No structural correspondence found for any tested candidate.
4. B1Len formula is a structural invariant.
5. Tokens cannot be vertex/edge indices.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High for structural observations. Medium for token semantics (unknown).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP030.md`, `v0.4.7/EXP030_STRUCTURAL_CORRESPONDENCE.json`, `v0.4.7/EXP030_SUMMARY.md`

---

## EXP-031: Block1 Token Signature Classification

> **Correction, 2026-09-14 (EXP-042–046):** Cylinder values are boundary edge IDs, not a universal face-type signature. EXP-043/045 supplies the explicit mapping; retain the original observed patterns only. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Complete

**Goal**: Determine whether Block1 token sequences have reproducible signatures associated with face/serialization structure or face type.

**Method**: Classify faces by type (planar_cube, cylindrical, chamfer, multi_loop) and compute token signatures.

**Evidence / facts**:

- **C11 discrepancy resolved**: Preliminary output incorrectly identified face 5 (vc=57) as cylindrical. Actual cylindrical face is face 6 (vc=64).
- **Cylindrical faces share identical token signature**: C04 (vc=70), C05 (vc=56), C11 (vc=64) all have same alternating pattern: `1,0,150,0,153,0,...`
- **Planar cube faces have diverse token signatures**: 27 faces have 9 unique first-20 patterns.
- **Chamfer faces have diverse token signatures**: 2 faces have 2 unique patterns.
- **Multi-loop faces have diverse token signatures**: 9 faces have 9 unique patterns.
- **H1 (planar faces share one signature)**: FALSIFIED.
- **H2 (cylindrical faces share one signature)**: SUPPORTED.
- **H4 (geometry dimensions determine signature)**: FALSIFIED.

**Key findings**:
1. Cylindrical faces share a structural token signature regardless of hole diameter.
2. Planar cube faces have diverse token signatures that differ by face orientation.
3. Token signatures are partially determined by face type.
4. C11 confirms cylindrical face signature consistency.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High for structural observations. Medium for token semantics (unknown).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP031.md`, `v0.4.7/EXP031_TOKEN_SIGNATURES.json`, `v0.4.7/EXP031_SUMMARY.md`

---

## EXP-032: Token Signatures vs Face Orientation

> **Correction, 2026-09-14 (EXP-042–046):** The topology/vertex-order falsification does not cover the correct strip-edge interpretation, now demonstrated by EXP-043/045. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Complete

**Goal**: Determine whether Block1 token signature differences observed among planar cube faces correlate with face orientation / surface normal direction.

**Method**: Determine face orientation from normal records (authoritative source) and compare token signatures across faces with same/different orientations.

**Evidence / facts**:

- **Planar cube faces have consistent token signatures for same orientation**: -X, -Y orientations have identical patterns across all models. +X, +Y orientations have two variants (standard and modified).
- **Token signature variation correlates with model type**: C03 (fillet) and C09 (chamfer) have modified patterns for +X and +Y orientations.
- **Cylindrical faces have consistent token signature regardless of orientation**: All 3 cylindrical faces have pattern `[1,0,150,0,153,0]`.
- **Multi-loop and chamfer faces have diverse token signatures**: 6 unique patterns for each orientation.
- **Opposite orientations have identical patterns**: +X/-X, +Y/-Y, +Z/-Z have same patterns.
- **H2 (orientation invariance)**: FALSIFIED - same orientation has different tokens across models.
- **H4 (serialization position)**: FALSIFIED - same face index has different tokens across models.
- **H5 (topology/vertex ordering)**: FALSIFIED - faces with same vertex position have different tokens.

**Key findings**:
1. Token signatures correlate with face orientation for planar cube faces.
2. Token signatures are influenced by model type (fillet/chamfer features).
3. Cylindrical faces share a structural token signature regardless of orientation.
4. Multi-loop and chamfer faces have diverse token signatures.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: High for structural observations. Medium for token semantics (unknown).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP032.md`, `v0.4.7/EXP032_TOKEN_ORIENTATION.json`, `v0.4.7/EXP032_SUMMARY.md`

---

## EXP-033: Token Signatures vs Feature-Induced Model State

> **Correction, 2026-09-14 (EXP-042–046):** The global-state framing is superseded by source edge labels and metadata. This is in addition to, not a replacement for, the earlier adjacency-method corrections. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Complete

**Goal**: Determine why C03 (fillet) and C09 (chamfer) produce modified Block1 token signatures for otherwise comparable planar orientations, while C00/C04/C05/C11 retain the standard signatures.

**Method**: Controlled comparison of token signatures across models with different features (fillet, chamfer, hole), testing hypotheses about feature type, local topology, direct modification, adjacency, and global model state.

**Evidence / facts**:

- **Fillet and chamfer produce identical signature changes**: Both produce same changes for +X and +Y (4 changes each, identical patterns).
- **Signature changes occur without structural changes**: +X/+Y faces have identical ec=4, vc=4, secCount=1, b1Len=6 across all models.
- **Signature changes occur without direct modification**: +X/+Y faces are NOT directly modified by fillet/chamfer.
- **Signature changes occur without adjacency**: +X/+Y faces are NOT adjacent to modified geometry.
- **Signature changes occur with same face index**: +X at index 2, +Y at index 3 across all models.
- **Hole models do NOT produce signature changes**: C04/C05/C11 retain standard +X/+Y signatures.
- **+Z/-Z faces are replaced in feature models**: Planar_cube → multi_loop/chamfer.
- **H1 (feature type)**: SUPPORTED — fillet and chamfer produce identical changes.
- **H2 (local topology)**: FALSIFIED — signature changes occur without structural changes.
- **H3 (direct modification)**: FALSIFIED — signature changes occur without direct modification.
- **H4 (adjacency)**: FALSIFIED — signature changes occur without adjacency.
- **H5 (global model state)**: SUPPORTED — signature changes correlate with model type.
- **H6 (orientation plus structural variable)**: SUPPORTED — orientation alone explains variation within C00.

**Key findings**:
1. Signature changes are caused by global model state, not local topology or feature type specifically.
2. Fillet and chamfer share a common property that affects token signatures.
3. Hole models do not have this property.
4. Token signatures encode information about global model state, not just local face properties.

**Files tested**: C00, C03, C04, C05, C09, C10, C11

**Faces/models tested**: 41 faces across 6 models (C10 unparseable)

**Confidence**: High for structural observations. Medium for semantic interpretation (global model state mechanism unknown).

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP033.md`, `v0.4.7/EXP033_FEATURE_STATE.json`, `v0.4.7/EXP033_SUMMARY.md`

### CORRECTION NOTE (2026-08-14, Archivist Audit)

**"H4 (adjacency) FALSIFIED" is not a genuine test of topological adjacency and should not be relied upon.**

`isAdjacentToModified()` in `v0.4.7/exp033_feature_state.js` (lines 122–140) tests only whether a face shares an **orientation label** with a directly-modified face — its own source comment states "This is a simplification - true adjacency would require topology analysis." On an axis-aligned cube, no two distinct faces ever share an orientation, and the fillet/chamfer face itself is `NON_AXIS`, so this function is structurally incapable of ever returning `true` for +X/+Y against a fillet/chamfer/hole feature, regardless of real edge-sharing topology. Geometrically, a fillet/chamfer along the edge shared by the +X and +Y faces is, by construction (SolidWorks edge features operate on an edge shared by exactly two faces), adjacent to both faces. The claim "signature changes occur without adjacency" (§5.4, §6.3 of the evidence file) is therefore **not established** by this experiment; real topological adjacency was never measured. The "Adjacent to Modified" counts in EXP-033 §4.4 use the same flawed heuristic and should not be cited as adjacency counts.

This does not affect EXP-033's H1/H2/H3/H5/H6 conclusions, which do not depend on `isAdjacentToModified()`.

Downstream: `OPEN_QUESTIONS.md` OQ-032/OQ-033 restate "without adjacency" — corrected there. `FAILED_HYPOTHESES.md` FH-031 records this as Falsified/Confidence:High — corrected there (status downgraded to reflect that the test was invalid, not that the hypothesis was confirmed).

**Recommended fix if corpus becomes available:** replace the orientation-collision heuristic with a real edge/vertex-sharing adjacency check computed from vertex coordinates (available in the same face records), then re-run H4.

See `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding A).

---

## EXP-034: Controlled Transformation Invariance of Block1/Block2

**Status**: Complete

**Goal**: Determine whether the validated Block1/Block2 token structures are invariant under known geometric transformations (scale, translation) when topology and feature state remain unchanged.

**Method**: Compared C00 (baseline), C01 (2x scale), C02 (50mm translate) for all face structures: Block1 header/body, Block2 header/body, ec/vc/secCount/b1Len, gap markers, loop sizes, section lens, vertex coordinates, marker offsets.

**Evidence / facts**:

- **Block1 tokens are COMPLETELY INVARIANT**: All Block1 body tokens identical across C00/C01/C02 for all 6 faces (18 comparisons).
- **Block2 is COMPLETELY INVARIANT**: All Block2 body values identical across C00/C01/C02 for all 6 faces.
- **Structural properties are INVARIANT**: ec=4, vc=4, secCount=1, b1Len=6 identical across all models.
- **Block1/Block2 headers are INVARIANT**: [4,8,2,6] and [4,8,2,1] respectively.
- **Gap markers, loop sizes, section lens are INVARIANT**: All identical across models.
- **Marker offsets are INVARIANT**: All face positions identical (Face 0: 5140, Face 1: 6024, etc.).
- **Vertex coordinates CHANGE as expected**: C01 shows 2x ratio, C02 shows 50mm offset.
- **Byte-level differential**: C00 vs C01 = 355 bytes (2.95%), C00 vs C02 = 1141 bytes (9.47%). All changes in vertex coordinate regions.
- **All invariants PASS**: INV-005/006/008/009/016/017/018 all pass across all models.
- **H1 (Block1 invariant under scale)**: SUPPORTED.
- **H2 (Block1 invariant under translation)**: SUPPORTED.
- **H3 (Block2 invariant under scale)**: SUPPORTED.
- **H4 (Block2 invariant under translation)**: SUPPORTED.
- **H5 (structural properties invariant)**: SUPPORTED.
- **H6 (vertex coordinates encode geometry)**: SUPPORTED (expected).

**Key findings**:
1. Block1/Block2 structures are invariant under geometric transformations (2× scaling and translation).
2. Geometric transformations (scale, translate) do NOT affect Block1/Block2 tokens.
3. Only vertex coordinates change under geometric transformations.
4. This clarifies EXP-033: ordinary geometric transformations do NOT produce token-signature changes.
5. Block1 tokens are NOT vertex indices, NOT coordinate-dependent, NOT geometry-encoded.
6. **Unknown:** Exact semantic meaning of Block1/Block2 tokens.
7. **Not established:** That Block1/Block2 specifically encode topology.

**Files tested**: C00, C01, C02

**Faces/models tested**: 18 face comparisons across 3 models (6 faces each)

**Confidence**: High for structural invariance claims. All 18 face comparisons show identical Block1/Block2 tokens.

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP034.md`, `v0.4.7/EXP034_TRANSFORMATION_INVARIANCE.json`, `v0.4.7/EXP034_SUMMARY.md`

---

## EXP-035: Shell Feature Token Analysis

**Status**: Complete

**Goal**: Determine whether the shell operation produces Block1/Block2 token-signature changes in the remaining faces, and whether those changes resemble the fillet/chamfer behavior observed in EXP-033.

**Method**: Parsed C10 (shell) and C00 (baseline). Investigated why C10 was reported as "no parseable faces" in EXP-033. Compared Block1 tokens for corresponding faces. Tested hypotheses H1-H4.

**Evidence / facts**:

- **C10 IS parseable**: Parser extracted 11 faces from C10, all passing INV-016/017/018.
- **EXP-033 failure was a tooling/filtering issue**: The EXP-033 script filtered on `faceType === 'planar_cube'`, but C10's Face 0 has `faceType=planar_other` (ec=10, vc=10). Faces 1-10 have `faceType=planar_cube`.
- **C10 has 11 faces**: 5 original outer faces (Faces 1-5), 1 modified top face (Face 0, ec=10, vc=10, multi-loop), 5 new inner wall faces (Faces 6-10).
- **Original outer faces are TOKEN-IDENTICAL to C00**: All 5 original outer faces (Faces 1-5) have IDENTICAL Block1 tokens to C00.
- **New inner wall faces have unique tokens**: All 5 new inner faces (Faces 6-10) have unique token signatures not found in C00.
- **Shell does NOT change tokens on existing faces**: Original outer face tokens are identical to C00.
- **All C10 faces pass structural invariants**: INV-016 and INV-018 pass for all 11 faces.
- **H1 (shell causes changes)**: FALSIFIED.
- **H2 (shell no changes)**: SUPPORTED.
- **H3 (distinct pattern)**: NOT APPLICABLE.
- **H4 (outside extraction model)**: FALSIFIED.

**Key findings**:
1. C10 IS parseable under the validated extraction model.
2. EXP-033's "no parseable faces" was a filtering issue, not a structural failure.
3. Shell does NOT change tokens on existing outer faces.
4. Shell adds 5 new inner wall faces with unique token signatures.
5. Shell modifies the +Z face from ec=4/vc=4 to ec=10/vc=10 (multi-loop).
6. Fillet/chamfer are unique in producing global token changes; shell and holes do not.

**Files tested**: C00, C10

**Faces/models tested**: 17 faces across 2 models (6 + 11)

**Confidence**: High for original outer face invariance. High for new inner face uniqueness. High for structural invariant compliance.

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP035.md`, `v0.4.7/EXP035_RESULTS.json`, `v0.4.7/EXP035_SUMMARY.md`

---

## EXP-036: Fillet/Chamfer vs Hole/Shell Structural Differential

> **Correction, 2026-09-14 (EXP-042–046):** Use the explicit edge-ID mapping in EXP-043/045 rather than inferring global token effects from feature categories. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Complete

**Goal**: Identify the concrete structural difference between C03/C09 (fillet/chamfer) which cause global token-signature changes, and C04/C05/C11 (holes) and C10 (shell) which do not.

**Method**: For each feature model against C00, characterized number of faces added/removed, face types, ec/vc/secCount distributions, Block1/Block2 sizes, which faces retain identical tokens, which faces receive changed tokens, and whether new faces have distinctive structural properties.

**Evidence / facts**:

- **Fillet/chamfer add a new face at an edge location**: C03/C09 have 1 added face. C04/C05/C10/C11 have 0 added faces.
- **Fillet/chamfer produce token changes on unrelated faces**: +X/+Y faces have IDENTICAL structural properties but different tokens. Holes/shell do NOT produce token changes on unrelated faces.
- **Multi-loop faces do NOT distinguish the groups**: C09 (chamfer) has 0 multi-loop faces but produces global token changes. C04/C05/C11 (holes) have 2 multi-loop faces but do NOT produce global token changes.
- **Face count does NOT distinguish the groups**: All models except C10 have 7 faces.
- **Block1 size correlates**: Fillet/chamfer have smaller avg B1 sizes (10.14) than holes/shell (37.34). But C10 (shell) has small B1 (7.1) similar to fillet/chamfer.
- **H1 (external boundary modification)**: FALSIFIED. Shell modifies external boundary but does not cause global token changes.
- **H2 (number of faces)**: FALSIFIED. All models except C10 have 7 faces.
- **H3 (multi-loop faces)**: FALSIFIED. C09 has 0 multi-loop faces but produces global token changes.
- **H8 (adding a new face at an edge)**: SUPPORTED. C03/C09 add a new face; C04/C05/C10/C11 do not.

**Key findings**:
1. Fillet/chamfer add a new face at an edge location. Holes/shell do not.
2. Fillet/chamfer produce token changes on +X/+Y faces with identical structural properties.
3. Multi-loop faces do NOT distinguish the groups.
4. Face count does NOT distinguish the groups.
5. The distinguishing factor is adding a new face at an edge location.

**Files tested**: C00, C03, C04, C05, C09, C10, C11

**Faces/models tested**: 52 faces across 7 models

**Confidence**: High for the observation that fillet/chamfer add a new face while holes/shell do not. High for the observation that fillet/chamfer produce token changes on unrelated faces while holes/shell do not. Medium for the hypothesis that adding a new face at an edge is the distinguishing factor.

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP036.md`, `v0.4.7/EXP036_RESULTS.json`, `v0.4.7/EXP036_SUMMARY.md`

### CORRECTION NOTE (2026-08-14, Archivist Audit)

**The quantitative "added" column in the Cross-Model Analysis table is unreliable and should not be cited as evidence.**

`computeTokenDiff()` in `v0.4.7/exp036_feature_class_differential.js` (lines 104–191) buckets faces by orientation label and only classifies a model face as `'added'` if its orientation is entirely absent from C00's 6 occupied buckets. Verified directly against `v0.4.7/EXP036_RESULTS.json`: `structuralComparison.C04_cube_hole_5mm.tokenDiffSummary.added = 0` and `structuralComparison.C10_cube_shell_1mm.tokenDiffSummary.added = 0`, with empty `addedFaceDetails` in both — even though C04 genuinely gained a 7th (cylindrical) face and C10 genuinely gained 5 new inner-wall faces (both independently established: C04's face count in `CORPUS_AUDIT.json`/EXP-027's "+1 face" language; C10's 5 new faces directly in EXP-035, `knowledge/evidence/2026-08-14_v0.4.7-EXP035.md`). Both new-face sets were silently dropped from the diff because their orientation labels collided with an already-occupied C00 bucket (a hole's near-zero-average-normal cylindrical face, and shell's inward-facing walls that mirror an existing outer wall's bucket) and lost the greedy best-match competition. Only the fillet/chamfer's new face happens to land on a genuinely novel `NON_AXIS(...)` orientation, which is why it is the only one detected.

Consequence: the table's claim `added: avg=1.00 (fillet/chamfer) vs avg=0.00 (holes/shell) — Distinguishes: YES` is misleading — holes and shell add faces too; the metric just fails to see it. "Adds a face" is therefore **not, by itself,** what distinguishes fillet/chamfer from hole/shell in this corpus (all four feature types add at least one face). What may still distinguish them — untested directly here — is whether the added face shares an edge with a **pre-existing** face (splitting that face's original boundary) versus being bounded entirely by brand-new edges. EXP-036 itself is appropriately conservative about this: H4 (Topology), H6 (Serialization position), and H7 (Feature type) are correctly marked **UNKNOWN**, not falsified, and H8 ("adding a new face at an edge") is offered as a plausible domain-informed inference (fillet/chamfer are CAD "edge features" by definition) rather than as something this script directly measured.

This does not overturn EXP-036's core qualitative finding — independently corroborated in EXP-033/EXP-035 by direct per-face comparison, not by this orientation-bucket algorithm — that +X/+Y token changes occur under fillet/chamfer and not under hole/shell. It does mean the "added" statistic should not be cited as supporting evidence for *why*.

See `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding B) and the confound analysis appended to `NEXT_QUESTIONS.md` NQ-027.

---

## EXP-037: NQ-028 — Edge-Location Discrimination + Corrected Adjacency/Correspondence Tooling

**Question**: NQ-028 — does moving a fillet/chamfer to a *different* physical cube edge move the Block1 token changes to the corresponding faces (spatial/adjacency, Hypothesis A), or do the same +X/+Y faces change regardless of feature location (global/feature-type state, Hypothesis B)?

**Status**: **NQ-028's core question NOT answered.** Before writing any analysis code, checked whether the existing corpus could answer it: the controlled-corpus SLDPRT files (`test files original/controlled/`) are absent from this repository and from the entire container filesystem (confirmed by search), and the archived JSON corpus contains exactly one fillet model (C03) and one chamfer model (C09), both confirmed (independently, via face-index tables in EXP-033 §4.3 and via this experiment's own vertex-based adjacency computation) to modify the *same* physical edge (shared by +X and +Y). No second-edge model exists anywhere. Per the task constraint against faking an answer from C03/C09, NQ-028 is left unanswered, and a full specification for the required new model (`C12_cube_fillet_1mm_edge2` or equivalent, 1mm fillet/chamfer on the edge shared by -X/-Y, all else identical to C00/C03/C09) is documented for a future session.

**What was done instead**, using only already-archived data (no SLDPRT files needed): built and validated a corrected, reusable adjacency + face-correspondence tool, addressing both defects flagged by the 2026-08-14 archivist audit as NQ-028 prerequisites.

- **Corrected face correspondence** (fixes Finding B / EXP-036's orientation-bucket bug): scores every (C00 face, feature-model face) pair by **centroid distance** rather than orientation label or raw vertex-overlap fraction (an initial vertex-overlap version produced tied, ambiguous scores between the true corresponding face and an unrelated face, because every cube corner is shared by three faces). Re-derives, with zero discrepancies against independently-established ground truth (EXP-027/EXP-035), that fillet/chamfer/hole/shell **all** add at least one new face: C03 +1, C09 +1, C04 +1 (cylindrical), C10 +5 (inner walls) — where EXP-036's algorithm reported 0 for the hole and shell.
- **Corrected adjacency** (fixes Finding A / EXP-033's same-orientation-label `isAdjacentToModified()`): counts genuinely shared vertices (≥2 = shares an edge) between faces, computed from the full per-face vertex coordinate arrays already archived in `VERTEX_ANALYSIS.json`. For both C03 and C09, the new feature face's real within-model adjacency set is exactly {+X, +Y, +Z, -Z} — i.e. the two directly-modified faces (+Z/-Z) plus the two faces whose token signature changed without direct modification (+X/+Y) — and excludes -X/-Y, whose tokens are unchanged.
- **Cross-check**: for the one edge this corpus contains, the real-adjacency set (computed from vertex coordinates) is **exactly equal** to the set of faces with a changed Block1 token array, for both fillet and chamfer. This upgrades "the +X/+Y faces that change are genuinely adjacent to the new feature face" from an unmeasured "by construction" assumption to a directly measured fact — but remains correlational (not causal) and single-edge (not general).
- **Contrast case (shell)**: shell's 5 new inner-wall faces ARE, by the same real-adjacency test, adjacent to several of its unmodified outer walls — yet EXP-035 independently established those outer walls keep identical tokens to C00. Real adjacency to a new face is therefore **not universally sufficient** for a token change across the feature types tested; the fillet/chamfer correlation does not generalize into a universal law.

**Hypotheses strengthened**: "+X/+Y faces changed in C03/C09 are genuinely topologically adjacent to the new feature face" (now measured, not assumed). "All four feature types tested add at least one new face" (now reproduced by a second, independent, geometry-based method).

**Hypotheses weakened/falsified**: None newly falsified. "Adjacency causes token change," if read as a *universal* cross-feature-type rule, is weakened by the shell contrast — scope-narrowed to "correlated for fillet/chamfer, on this edge," not falsified for that narrower claim.

**Files tested**: No SLDPRT files (none available). Data sources: `v0.4.7/VERTEX_ANALYSIS.json`, `v0.4.7/EXP033_FEATURE_STATE.json`, `v0.4.7/EXP035_RESULTS.json` — covering C00, C03, C04, C09, C10.

**Faces/models tested**: 56 face-records across 4 model pairs (C00↔C03, C00↔C09, C00↔C04, C00↔C10).

**Confidence**: High for the corrected added-face census (reproduces independent ground truth with zero discrepancies). Strong Evidence (not Verified — single edge, correlational) for the real-adjacency-equals-token-change-set finding. None for NQ-028's core edge-location-generality question — explicitly not attempted; requires new data.

**Date last updated**: 2026-08-14

**Raw evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md`, `v0.4.7/EXP037_RESULTS.json`, `v0.4.7/EXP037_SUMMARY.md`, `v0.4.7/exp037_edge_location_and_adjacency.js`

**CORRECTION NOTE (2026-08-16, Audit + EXP-040)**: The "Contrast case (shell)" bullet above is factually wrong. It names C10 indices 7 and 9 (via the underlying summary) as "unmodified outer walls" adjacent to the new inner-wall faces — indices 6-10 are all new inner-wall faces (per this same entry's own face-record description), not outer walls. Two independent recomputations (reusing EXP-037's own already-computed adjacency records, and a from-scratch shared-vertex recount from raw `VERTEX_ANALYSIS.json` coordinates) both find zero shared vertices between any new C10 inner-wall face and any of its five genuinely unmodified outer walls — the new faces are real-adjacent only to the shell's own directly-modified opening face and to each other. Shell therefore is not a counterexample to the adjacency correlation; it supplies no adjacent-but-unchanged test case at all. The "Hypotheses weakened/falsified" line above (shell contrast narrowing the claim's scope) is likewise withdrawn — nothing in this corpus currently weakens the fillet/chamfer adjacency correlation. `EXP037_RESULTS.json`'s own computed data was correct throughout; only this entry's and the source documents' prose interpretation was wrong. See `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md` and the EXP-040 entry below.

---

## EXP-038: NQ-028 — C12 (Second-Edge Fillet) vs C00 and C03

**Question**: Executes NQ-028's actual discriminating test using C12, a new controlled model supplied by the user (not generated by this session): the same C00 base cube with a 1mm fillet on the edge shared by the -X and -Y faces — verified directly from C12's own STEP file (`Fillet1` solid, 1mm cylindrical-surface radius, fillet axis at `(1,1,z)`) to be the edge diagonally opposite the one C03/C09 use, exactly as EXP-037 §6 specified. Does the Block1 token-changed face set move with the fillet's physical location, or stay fixed?

**Status**: Answered for the two edges tested. **Result**: The changed-face set relocated from {+X, +Y} (C03) to {-X, -Y} (C12) — exactly the two faces bordering the NEW fillet edge in each case, structurally unmodified (ec/vc/secCount/b1Len identical to C00) in both, matching EXP-033's original signature-change pattern at a new location. Face index of the changed faces also changed ({2,3}→{0,1}), ruling out a serialization-index explanation. In both models, the changed-face set is exactly equal to that model's own real (vertex-computed) within-model adjacency set for its new fillet face (C03: {2,3,4,5}; C12: {0,1,4,5}). Hypothesis A (spatial/topological) is supported; Hypothesis B (global/feature-type state, "same +X/+Y faces regardless of edge"), as literally stated in NQ-028, is **falsified**.

**Tooling note**: EXP-037's `matchFaces()` centroid-distance correspondence (vertex-average centroid, 0.004m threshold) misclassified C00's faces 4/5 when applied to real C12 data — a genuine same-face shift of up to 0.0046m (driven by uneven fillet-arc tessellation pulling the vertex average) exceeded the threshold. Fixed by switching to axis-aligned bounding-box center (insensitive to point density), validated across all five archived pairs (C03/C09/C04/C10/C12) before adoption, not tuned only to C12. `exp037_edge_location_and_adjacency.js` and its results are unmodified; the refinement applies only within `exp038_nq028_c12_second_edge.js`.

**Anti-overclaim**: Classified as Strong Evidence (two independently tested edges), not Verified/invariant. Does not establish a causal mechanism. Does not distinguish "caused by real topological adjacency to the new face" from "caused by this face's own vertices being directly, if minutely, modified by the trim" — for an edge fillet these pick out the identical face set by construction, so this corpus cannot separate them. Does not reopen "vertex position change causes token change" as a general claim — EXP-034 already showed uniform scale/translation (which moves every vertex) leaves tokens invariant; the effect here is local/topological, not general vertex-coordinate sensitivity. n=2 edges, both vertical, both on the same 10mm cube — generalization beyond that is untested.

**Files tested**: C00 (archived JSON), C03 (archived JSON), C12 (real `model.SLDPRT`/`model.step`/`model.STL`, parsed directly — first real-file verification in this thread for the model under test). C12 corpus files placed at `test files original/controlled/C12_cube_fillet_1mm_edge2/`.

**Faces/models tested**: 20 face-records across 3 models (C00: 6, C03: 7, C12: 7); 0 ambiguous correspondences in either pair.

**Confidence**: High that the pattern is genuine (unambiguous correspondence, new face's structural signature matches C03's exactly, internally consistent). Strong Evidence, not Verified, for "token-changed faces track the physical fillet edge location."

**Date last updated**: 2026-08-15

**No further experiment begun** (per instruction). See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md` Section 6 "Highest-information next experiment" for context only.

**Raw evidence**: `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md`, `v0.4.7/EXP038_RESULTS.json`, `v0.4.7/EXP038_SUMMARY.md`, `v0.4.7/exp038_nq028_c12_second_edge.js`

---

## EXP-039: Is Direct Vertex Modification Necessary for a Token Change?

**Status**: Complete

**Continuity note**: This session started on a stale branch cut before EXP-037/038 existed, and initially built an independent re-derivation under the same "EXP-037" name before discovering the real `claude` branch (via a git push ref conflict) already contained the genuine EXP-037/038 plus a 2026-08-14 archivist audit. That independent work is superseded; EXP-039 continues from the real EXP-037/038 state rather than restating it.

**Question**: EXP-038 states that "real topological adjacency to the new face" and "this face's own vertices were directly, if minutely, modified by the trim" are indistinguishable for any single edge-type feature (fillet/chamfer/C12) in this corpus, because a trim that creates adjacency is itself a modification of the trimmed face's boundary. Is there anything in the existing corpus that separates these two properties, and if so, does adjacency alone (without the face's own vertices moving) ever produce a token change?

**Method**: Reused `vertClose`/`sharedVertexCount` (copied verbatim, cited in-file) from the already-validated `exp037_edge_location_and_adjacency.js`. Read all correspondence/adjacency/token data from `EXP037_RESULTS.json`, `EXP038_RESULTS.json`, `EXP035_RESULTS.json` — no Block1/Block2 extraction, correspondence, or adjacency logic re-implemented. For every face recorded `identical: true` (full vertex-coordinate equality — this is what the existing `facesIdentical()` already checks, not merely ec/vc/secCount/b1Len) in a modified model, computed real adjacency (>=2 shared vertices) to any `identical: false` or newly `added` face in the same model, cross-referenced against the already-validated token-changed verdict.

**Evidence / facts**:

- `EXP037_RESULTS.json`/`EXP038_RESULTS.json` already record `identical: false` (real vertex-coordinate mismatch, not just ec/vc/secCount/b1Len) for C03/C09's +X/+Y and C12's -X/-Y — the exact faces every prose write-up (including `FAILED_HYPOTHESES.md` FH-030) still describes as "not directly modified." This signal existed since 2026-08-14 but was never used to correct FH-030, even though the matching adjacency signal WAS used to correct FH-031 on the same dates.
- Cross-tabulation across C03, C09, C04, C10, C12 (12 genuinely-unmodified-and-real-adjacent-to-changed/added-geometry face instances, 3 genuinely-unmodified-and-not-adjacent controls): **0/12 token-changed** in the adjacent-without-modification cell, **0/3** in the not-adjacent control cell.
- This extends EXP-037's single qualitative shell observation ("shell's new inner walls are adjacent to unmodified, token-identical outer walls") into a quantified result spanning 4 feature types (fillet, chamfer, hole, shell) and 2 independent edge locations (C03/C09's edge, C12's edge).
- **FH-030 is corrected** (see FAILED_HYPOTHESES.md): its "Falsified" verdict used ec/vc/secCount/b1Len as the modification criterion; the same validated pipeline's own `identical` field already contradicts it.
- The confound EXP-038 identified for the co-occurring case (adjacency and direct modification both present, as in C03/C09/C12) is not resolved by this experiment, and is argued — not just observed — to be structurally unresolvable for any feature that creates a new face by editing an existing face's boundary loop: gaining a shared boundary with a new face is, by construction, a change to the neighbor's own boundary.

**Files tested**: No new SLDPRT parsing; reused already-validated JSON covering C00, C03, C04, C09, C10, C12.

**Faces/models tested**: 15 face-instances with known token status, across 5 model pairs.

**Confidence**: High (real, verified vertex-coordinate data, 0 counterexamples) that adjacency alone, without direct modification, does not cause a token change, across the feature types tested. Medium-high (structural/topological argument, not exhaustive search) that the co-occurring case is unresolvable for this feature class without a fundamentally different feature type.

**CORRECTION NOTE (2026-08-17, re-audit of EXP-037→EXP-040, no new experiment run)**: Two issues found checking this entry against the raw script/JSON directly. (1) "2 independent edge locations" (line above, "Evidence / facts" bullet 3) overstates the 12-instance figure's scope: all 12 come from edge 1 only (C03/C09/C04/C10); C12 (edge 2) contributes only to the separate 3-instance control cell. (2) More substantively: checking `EXP037_RESULTS.json`'s own `added[].adjacentToModelFaces` data shows every one of the 12 "adjacent, unmodified" instances is adjacent only to an already-directly-modified neighboring face (hole's/shell's own modified faces), never to the genuinely new/added geometry (the cylindrical wall, the inner walls) itself. So this experiment does not actually separate "adjacent to new geometry" from "adjacent to a directly-modified neighbor" for any of the four feature types tested — the co-occurring confound is universal in this corpus, not resolved or narrowed here as the "Confidence" line above implies. The raw 0/12 and 0/3 counts remain correct; their interpretive weight is revised. Separately, an "11/11" figure for directly-modified faces appears elsewhere in the knowledge base (`FAILED_HYPOTHESES.md`, `NEXT_QUESTIONS.md`, `OPEN_QUESTIONS.md`, `RESEARCH_HANDOFF.md`) but was never computed by this experiment's own script (`rows` excludes all directly-modified faces by construction); recomputed directly from `EXP037_RESULTS.json`/`EXP038_RESULTS.json`, the correct figure is 14/14 known cases, 1 unknown. Full derivation: `v0.4.7/EXP039_SUMMARY.md`'s matching correction note.

**Date last updated**: 2026-08-16

**Raw evidence**: `knowledge/evidence/2026-08-16_v0.4.7-EXP039.md`, `v0.4.7/EXP039_DIRECT_MODIFICATION_NECESSITY.json`, `v0.4.7/EXP039_SUMMARY.md`, `v0.4.7/exp039_direct_modification_necessity.js`

**Note added by the following EXP-040 (2026-08-16, reconciliation of two independently-run "EXP-039"s)**: this experiment's own adjacency data (freshly computed via `sharedVertexCount`, not taken from EXP-037's prose) already agrees with EXP-040's correction below — none of its 12 "adjacent-and-unmodified" data points rely on the erroneous "shell inner walls adjacent to unmodified outer walls" claim (verified by re-running this experiment's script and inspecting its per-row output: shell's contribution to the 12 comes entirely from outer walls' real adjacency to shell's own directly-modified opening face, not to the new inner walls). No correction to this entry's own findings is needed.

---

## EXP-040: Full-Corpus Adjacency Cross-Check + Correction of EXP-037's Shell Contrast Case

**Question**: Follow-up to a 2026-08-16 independent audit of EXP-037/038. Two parts: (1) extend EXP-037's real-adjacency-vs-token-change crossCheck (built only for C03/C09) to the two feature types it skipped (C04 hole, C10 shell), using only already-archived `EXP037_RESULTS.json` data; (2) independently re-derive C10's real adjacency from raw vertex coordinates, after the audit found EXP-037's written "shell contrast case" claim named the wrong faces as "unmodified outer walls."

**Status**: Complete. **Result**: (1) Full-corpus tally across all four feature types (24 pre-existing-face checks): 10 adjacent+changed, 0 adjacent+unchanged, 0 non-adjacent+changed, 13 non-adjacent+unchanged, 1 unknown (no archived comparison data for C10's own opening face). Zero exceptions in either direction. (2) C10's five new inner-wall faces (indices 6-10) have **zero** shared vertices with any of C10's five genuinely unmodified outer walls (indices 1-5) — confirmed by two independent methods (reusing EXP-037's own `adjacentToModelFaces` records, and a from-scratch shared-vertex recount from `VERTEX_ANALYSIS.json` raw coordinates). The new faces are real-adjacent only to the shell's own directly-modified opening face (index 0) and to each other. `EXP037_SUMMARY.md` §4 and `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §5 had named indices 7 and 9 as "outer walls" the new faces were adjacent to — both are themselves new inner-wall faces, not outer walls, per the same documents' own face census. This was an error in the written interpretation only; `EXP037_RESULTS.json`'s own computed adjacency data was correct throughout and required no changes.

**Consequence**: shell no longer counts as a counterexample to "real adjacency correlates with a token change" — it contributes zero adjacent-but-unchanged data points, not a disconfirming one. This does not newly prove the correlation universal (shell also contributes no new confirming case beyond fillet/chamfer's own). Correction notes appended (append-only, nothing rewritten) to `FAILED_HYPOTHESES.md` (FH-031), `OPEN_QUESTIONS.md` (OQ-032, OQ-036), the EXP-037 entry above, `RESEARCH_DASHBOARD.md`, `RESEARCH_HANDOFF.md`, `v0.4.7/EXP037_SUMMARY.md`, and `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md`.

**Independently-run, differently-scoped EXP-039 note**: this experiment was developed on a separate branch in parallel with the EXP-039 entry immediately above (which corrects FH-030 using adjacency-vs-direct-modification cross-tabulation). Both independently used the "EXP-039" number; this one is renumbered to EXP-040 during reconciliation. The two findings are compatible, not contradictory: EXP-039's own adjacency data was computed fresh (not taken from EXP-037's erroneous prose) and already agrees with this entry's correction — see the note appended to the EXP-039 entry above.

**Methodological note**: this script's own first draft had a sign-inversion bug (token-equality read backwards, so "unchanged" was reported as "changed") — caught before use by checking the first run's C03 row against EXP-038's already-published table, not by post-hoc review. Fixed and re-run; corrected output matches EXP-038 exactly.

**Hypotheses strengthened**: "Token signature changes correlate with real geometric adjacency to modified geometry" (FH-031) — the specific counter-evidence previously cited against generalizing past fillet/chamfer is retracted. Status remains Strong Evidence (fillet/chamfer, n=2 edges), not promoted further — this removes contrary evidence, it does not add new confirming evidence.

**Hypotheses weakened/falsified**: None. This is a documentation correction, not a new geometric finding.

**Files tested**: No SLDPRT files. Data sources: `v0.4.7/EXP037_RESULTS.json`, `v0.4.7/EXP033_FEATURE_STATE.json`, `v0.4.7/EXP035_RESULTS.json`, `v0.4.7/VERTEX_ANALYSIS.json`.

**Faces/models tested**: 24 pre-existing-face checks across 4 model pairs (tabulation) + 25 pairwise shared-vertex checks for the C10 independent recheck (5 new faces × 5 outer walls).

**Confidence**: High — the tally is a direct read of already-validated data, and the shell recheck was independently reproduced two ways with matching results.

**Date last updated**: 2026-08-16

**Raw evidence**: `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md`, `v0.4.7/EXP040_RESULTS.json`, `v0.4.7/EXP040_SUMMARY.md`, `v0.4.7/exp040_full_corpus_adjacency_crosscheck.js`

---

## EXP-041: Controlled Corpus Unblocked — From-Source Verification of the v0.4.7 Record

**Question**: Commit `d0c6c54` (2026-09-13) added the real `model.SLDPRT`/`model.step`/`model.STL` files for C00–C11, removing the standing blocker recorded in `RESEARCH_HANDOFF.md` ("C00 through C11 are still archive-only", reconfirmed by EXP-037 via a full-filesystem search). Three questions become answerable for the first time: (1) are the supplied binaries the same models the entire v0.4.7 archive was derived from, or regenerated look-alikes? (2) do INV-016/017/018 hold when recomputed from source rather than from archived JSON? (3) do the five models no prior experiment analyzed for tokens or adjacency (C06, C07, C08, C11, and the C04↔C11 pair) change the H1b-vs-H2 confound described in `v0.4.7/RESEARCH_DESIGN_next_experiment.md`?

**Status**: Complete.

**Result (1) — Provenance: 11/11 EXACT_MATCH.** Every model in `CORPUS_AUDIT.json` re-parsed from its binary and compared field by field — per-face byte offsets (`verticesStart`, `gapStart`, `normalsStart`, `block1Start`, `block2Start`), `edgeCount`/`vertexCount`/`secCount`/`b1Len`, `sectionLens`, `loopSizes`, `b2Body`, vertex previews, normal previews, Block1 token previews. **0 mismatches in any field, in any face, in any model.** The supplied binaries are the models the v0.4.7 archive came from. This was a genuine risk worth checking first: a re-run of the SolidWorks COM build could have produced different tessellation and silently invalidated any comparison between fresh and archived measurements, and every EXP-027→EXP-040 conclusion is archive-based.

**Result (2) — Invariants from source.** INV-016 94/94 faces; INV-017 273/273 sections; INV-018 94/94 faces; across all 13 controlled models, all PASS individually. *Anti-overclaim*: this is a new **data** path (binaries rather than archived JSON), not a new **code** path — extraction reuses `parser/v0.1`. It is not a fourth independent implementation in the sense EXP-016 was and must not be cited as one.

**Result (3a) — C04→C06 (hole position only), NEW.** The cylindrical face's 70 vertices are translated by a single uniform delta, `[0.002, 0, 0]` exactly (one distinct delta across all 70, matching hole centre (5,5)→(7,5)), while `vc`(70), `secCount`(1) and `b1Len`(138) are unchanged — so both token arrays have equal length and are comparable element-wise. **Block1 tokens and `b2Body` are byte-identical.** First case in the corpus of a face whose own vertex coordinates all changed while its tokens did not, *inside a model pair where other faces did change* (faces 4/5 change, length-forced by INV-016). The prior evidence that raw vertex modification is not sufficient (H1a) rested entirely on C01/C02, whole-model similarity transforms that `matchFaces` cannot correspond at all (0 matched rows), so they never appear in a cross-tabulation. C06 supplies the same conclusion from a **local** change inside a non-similarity model edit. Does **not** falsify H1b (a pure translation is a similarity transform of the face itself). Sharpens H4: within one model pair, one face translates with unchanged tokens while two others change — the token change behaves as a per-face property, not a model-global one. Confirms, by measurement, the Candidate-E forecast in `RESEARCH_DESIGN_next_experiment.md` §4.

**Result (3b) — C07→C08 (second hole only, 5→3 mm), NEW.** Face count 8→8, nothing added or removed. Side walls 0–3 **and** face 6 — the *first* hole's cylinder at centre (3,3), untouched by the edit — are identical in both vertices and Block1 tokens; faces 4, 5 and 7 change. Face 6 shares **35 vertices with face 4 and 35 with face 5**, both of which undergo large token changes. Per EXP-028 the DisplayList is re-serialized wholesale on any face change, yet five of eight faces come through byte-identical: **strongest H4 (global/serialization state) control in the project**, and the first on a pair with a genuine *non-similarity* feature edit. Also extends EXP-039's R2 relation ("one-hop propagation from an already-modified neighbour does not occur", previously 12/12) to the highest-contact case in the corpus.

**Result (3c) — C04→C11 and C04→C07.** C04→C11 behaves as C04→C05: every changed face is `b1Len`-forced by INV-016, therefore low-information, exactly as `RESEARCH_DESIGN_next_experiment.md` §2/H5 predicted for the diameter series. C04→C07 reports `removed=[6], added=[6,7]` — `matchFaces` correctly declines to force-match C04's centre-(5,5) cylinder to either of C07's (3,3)/(7,7) cylinders.

**Result (4) — The discriminating cell is still empty, now corpus-wide.** Cross-tabulation over 12 pairs and 65 matched face correspondences:

| | adjacent to a NEW face | not adjacent to a new face |
|---|---|---|
| vertices changed | 17 rows — 17 token-changed, 0 unchanged | 12 rows — 11 changed, 1 unchanged (C06 cylinder) |
| vertices unchanged | **0 rows — EMPTY** | 36 rows — 0 changed, 36 unchanged |

`RESEARCH_DESIGN_next_experiment.md` §1 established the empty cell over five feature models; it now holds over the **complete 13-model corpus**. The confound between H1b (non-similarity modification of the face itself) and H2 (adjacency to newly created geometry) is confirmed **structural to this corpus**, not an artifact of which subset had been examined. **The five newly supplied models do not break it and cannot.** The `C13` split-line model specified in `RESEARCH_DESIGN_next_experiment.md` §6 remains required and remains unbuilt. Outside the empty cell the table is exceptionless in both directions (17/17 and 36/36).

**Reconciliation note**: §0.1 of the design document counts 12 faces (C01/C02) as "vertices changed, tokens unchanged". Those 12 do **not** appear in the table above — `matchFaces` returns zero correspondences for both pairs by construction. The "1 unchanged" cell above is the C06 cylinder only. The two figures are different row sets, not a contradiction.

**Methodological caution (carried into `RESEARCH_HANDOFF.md`)**: the C06 cylinder correspondence passed at `centroidDist = 0.0019999998616 m` against the inherited `CENTROID_THRESHOLD = 0.002 m` — a margin of ~1.4 × 10⁻¹⁰ m. The match is genuine (independently confirmed by the uniform delta and identical `vc`), but it passed by luck. **Any feature translated further than 2 mm will fail correspondence outright and be reported as removed+added**, as C04→C07 already is. Do not retune the threshold to force matches; a principled revision needs re-validation across all archived pairs, as EXP-038 did.

**Hypotheses strengthened**: H4 further weakened (3a, 3b) — not falsified. EXP-039's R2 finding extended to a 35-shared-vertex case.

**Hypotheses weakened/falsified**: None newly falsified. H1a remains falsified and now has a local, in-table instance. H1b and H2 remain live and remain mutually inseparable.

**Nothing promoted**: no v0.4.7 finding, including this one, is promoted to `KNOWN_INVARIANTS.md`. No semantic meaning assigned to any token value.

**Tooling**: reused, not rewritten, per the binding constraints in `RESEARCH_HANDOFF.md` — `computeAdjacency`/`sharedVertexCount` from `exp037_edge_location_and_adjacency.js` (real ≥2-shared-vertex test), `matchFaces` with bounding-box-centre centroid from `exp038_nq028_c12_second_edge.js`, `facesIdentical` (full per-vertex comparison, tol 1e-6) as the modification criterion. Face correspondence never uses token similarity. `parser/` was not modified.

**Files tested**: all 13 controlled models — `test files original/controlled/C00..C12/model.SLDPRT`. Archive baseline: `v0.4.7/CORPUS_AUDIT.json`.

**Faces/models tested**: 13 models, 94 faces, 273 sections; 12 pairwise comparisons; 65 matched face correspondences.

**Confidence**: High for (1), (2), (3a), (3b) — all are direct measurements from source with exact, reproducible outputs. High for (4) as a statement about this corpus; it is a negative result and carries no claim beyond the corpus.

**Date last updated**: 2026-09-13

**Raw evidence**: `knowledge/evidence/2026-09-13_v0.4.7-EXP041.md`, `v0.4.7/EXP041_RESULTS.json`, `v0.4.7/EXP041_SUMMARY.md`, `v0.4.7/exp041_corpus_unblocked_from_source.js`


## EXP-042: Forward strip-layout and winding validation

**Date:** 2026-09-14. **Status:** Verified observations on the supplied modern corpus; interpretations scoped as in the v0.4.8 report.

1,272 faces in 21 decoded modern files; 50,976 positive-winding triangles; zero measured relation failures. Original STL comparisons retain all matches and mismatches.

**Method:** `node v0.4.8/exp042_strip_layout.js`. Candidate extraction is independent of the numerical relation being tested where described in the source; container decompression is shared. No full format-support claim.

**Evidence:** [evidence note](evidence/2026-09-14_v0.4.8-EXP042.md), [raw JSON](../v0.4.8/EXP042_RESULTS.json), [interpretation and limits](../v0.4.8/README.md).


## EXP-043: Strip-edge annotation semantics

**Date:** 2026-09-14. **Status:** Verified observations on the supplied modern corpus; interpretations scoped as in the v0.4.8 report.

41,010 nonzero boundary annotations, 71,037 zero interior annotations; no exceptions and no shared-label conflicts. Exact mesh incidence and the fan control are preserved.

**Method:** `node v0.4.8/exp043_edge_tokens.js`. Candidate extraction is independent of the numerical relation being tested where described in the source; container decompression is shared. No full format-support claim.

**Evidence:** [evidence note](evidence/2026-09-14_v0.4.8-EXP043.md), [raw JSON](../v0.4.8/EXP043_RESULTS.json), [interpretation and limits](../v0.4.8/README.md).


## EXP-044: Initial downstream metadata scan

**Date:** 2026-09-14. **Status:** Verified observations on the supplied modern corpus; interpretations scoped as in the v0.4.8 report.

1,271 uniquely located records all match Block1 label sets; one ambiguous scan is recorded. Superseded for locating records by EXP-045, not edited to remove the ambiguity.

**Method:** `node v0.4.8/exp044_metadata_bridge.js`. Candidate extraction is independent of the numerical relation being tested where described in the source; container decompression is shared. No full format-support claim.

**Evidence:** [evidence note](evidence/2026-09-14_v0.4.8-EXP044.md), [raw JSON](../v0.4.8/EXP044_RESULTS.json), [interpretation and limits](../v0.4.8/README.md).


## EXP-045: Forward metadata grammar and independent STEP comparison

**Date:** 2026-09-14. **Status:** Verified observations on the supplied modern corpus; interpretations scoped as in the v0.4.8 report.

1,272 records parse; all edge-ID sets and optional scalar counts match. All 94 controlled faces match the tested independent STEP planes/cylinders.

**Method:** `node v0.4.8/exp045_forward_metadata.js`. Candidate extraction is independent of the numerical relation being tested where described in the source; container decompression is shared. No full format-support claim.

**Evidence:** [evidence note](evidence/2026-09-14_v0.4.8-EXP045.md), [raw JSON](../v0.4.8/EXP045_RESULTS.json), [interpretation and limits](../v0.4.8/README.md).


## EXP-046: Boundary cycles and cross-face edge pairing

**Date:** 2026-09-14. **Status:** Verified observations on the supplied modern corpus; interpretations scoped as in the v0.4.8 report.

1,698 cycles across all 1,272 faces, zero branching ambiguities. All 3,278 IDs have two face owners; 389 differ in segment sampling. Maximum endpoint-to-polyline discrepancy 8.32697841716346e-9 m.

**Method:** `node v0.4.8/exp046_boundary_cycles.js`. Candidate extraction is independent of the numerical relation being tested where described in the source; container decompression is shared. No full format-support claim.

**Evidence:** [evidence note](evidence/2026-09-14_v0.4.8-EXP046.md), [raw JSON](../v0.4.8/EXP046_RESULTS.json), [interpretation and limits](../v0.4.8/README.md).

---

## EXP-049: Independent Replication of INV-020/021/022, Edge-Order Control, and Correction of EXP-042's STL Residual Attribution

**Question**: v0.4.8's EXP-042–046 were produced by a single implementation (`v0.4.8/research-common.js`, forward precursor-array scan). Do the strip layout, the Block1 edge-annotation partition, and the Block3 byte array replicate through a *different* code path? Is the edge ordering actually load-bearing, or would any ordering produce a clean partition? And are EXP-042's unexplained STL residuals really tessellation differences?

**Status**: Complete. Replication plus one corrective finding. **No new invariant proposed; nothing promoted.**

**Independence (stated precisely, not assumed)**: *Independent* — face discovery (`parser/v0.1` scans for the gap marker `[12,100,2,vertexCount]`, a different strategy from the forward precursor scan), Block3 offsets (computed from `parser/v0.1`'s own `block2Start`/`secCount`; v0.1 has no concept of Block3 and never reads it), plus the strip triangulation, edge enumeration, face-level incidence classification and STL reader written in this experiment. *Not independent* — the openswx container decompressor is shared, so a container-level decoding error would affect both paths identically. v0.4.8 flags the same limitation for itself; it is not resolved here.

**Result (replication) — all three replicate exactly.** 21 modern files decoded (3 legacy OLE2 unsupported), **1,272 faces, 10,095 strips, 71,166 serialized vertices, 50,976 strip triangles, all 50,976 agreeing with the stored normals** — identical to EXP-042. Block1: **112,047 edge tokens, 41,010 nonzero on face-boundary edges, 71,037 zero on face-interior edges, 0 nonzero-on-interior, 0 zero-on-boundary** — identical to EXP-043. Block3: **1,272/1,272 valid `[1,8,2,N]` headers, 0 malformed, N equal to the Block1 word count on all 1,272, 122,142 payload bytes, 0 nonzero** — identical to EXP-042. Two different face-discovery strategies converging on the same 1,272 faces is the substantive part of this check.

**Result (new control, absent from v0.4.8) — the edge ordering is load-bearing.** The partition is only meaningful if the *specific* ordering carries the information; if any ordering split cleanly, the finding would be vacuous. Control: same tokens, same incidence map, edge order deterministically shuffled within each strip. **0 exceptions with the documented order vs 44,640 with the shuffled order.** The result is not an artifact of the classification.

**Derivation note**: the section edge ordering (`ID(0,1)`, then `ID(i-2,i), ID(i-1,i)` per new vertex) was derived here independently from the `2L-3` edge count of an L-vertex strip, before v0.4.8's write-up was readable. The two derivations agree. Independent convergence on the ordering is stronger evidence than either alone.

**Result (correction to EXP-042) — part of its STL residual is a defective export, not tessellation.** `v0.4.8/README.md` attributes STL mismatches to tessellation ("Different STL tessellation remains visible and is archived; curved-model triangle equality is not claimed"). **That cannot apply to C09**, which is a chamfered cube — entirely planar, no curved surface — yet `EXP042_RESULTS.json` records `unmatchedGenerated: 2, unmatchedReference: 0`. Auditing every controlled `model.STL` by facet-normal group: **C03, C09 and C11 each contain no `-1,0,0` group at all — the −X face is absent from the export.** A missing axis-aligned normal group cannot arise from tessellation choice, since a differently-tessellated planar face still produces facets with that normal. Therefore: (1) **C09's residual is fully explained** — it needs 16 triangles, the STL has 14, and the 2 unmatched generated triangles are the two 50 mm² halves of the absent face (`unmatchedReference: 0`, i.e. the strip reading reproduces every triangle the STL does contain and adds the ones it lacks); (2) for C03/C11, 2 unmatched triangles are this missing face and the rest is genuine tessellation difference; (3) **the SLDPRT display mesh is more complete than the STL export**, consistent with EXP-046's finding that all 13 controlled SLDPRT meshes are closed under exact triangle-edge matching — the meshes are closed, three of the exports are not; (4) **C03/C09/C11's STL must not be used as watertight ground truth** without accounting for the missing face. This strengthens v0.4.8's conclusions: the residual it conservatively left unexplained is not a defect in the strip reading.

**Hypotheses affected**: none falsified. INV-020/021/022 corroborated through a partly-independent path and keep exactly the status and scope v0.4.8 gave them.

**Files tested**: all 24 `.sldprt` under `test files original` (21 decoded, 3 legacy OLE2 unsupported) and the 13 controlled `model.STL` exports.

**Faces/models tested**: 1,272 faces / 21 modern models; 112,047 edge tokens; 122,142 Block3 bytes; 13 STL exports.

**Confidence**: High for the replication and the control (exact, deterministic, reproducible). High for the missing-face finding (a facet-normal group is either present or absent). The *cause* of the omission is not established.

**Known gaps**: shared decompressor (partial pipeline independence); same corpus, not an independent holdout; no semantic claim about Block3, surface tags or scalar arrays; cause of the missing −X exports uninvestigated.

**Date last updated**: 2026-09-15

**Raw evidence**: `knowledge/evidence/2026-09-15_v0.4.8-EXP049.md`, `v0.4.8/EXP049_RESULTS.json`, `v0.4.8/exp049_independent_replication.js`

---

## EXP-050: Off-Cone Display Samples Are Chord Points, Not a Metadata Failure

**Question**: EXP-048's closing open thread — localize the off-cone samples on USB hub bottom face 35 and the 19 Pocket Wheel faces from EXP-047, and distinguish chord/interpolation samples from stale display data and correspondence issues, without altering original coordinates.

**Status**: Complete. Open thread resolved. No new invariant; no parser change.

**Method**: EXP-047 scores each tag-4003 face by `coneMinus = MAX over vertices of |rho − |radius − h·tan(angle)||` at 1e-7 m (27/47 pass). Being a maximum, one deviant vertex fails a whole face and the metric cannot separate "the stored surface is wrong" from "one sample is not on it". This replaces the max with the per-vertex distribution and applies four discriminators: **D1** deviation sign (inside vs outside the cone), **D2** distance to a chord joining two vertices of the same face that *do* satisfy the stored cone, **D3** an independent least-squares cone refit, **D4** the surface tags of faces co-owning each failing vertex. EXP-047's threshold was held at exactly 1e-7 m; no failure was rescued by loosening it, and no coordinate was modified.

**Result — 20 failing faces (19 Pocket Wheel, 1 USB hub bottom face 35), 250 failing vertices:**
- **D1: 250 inside the cone, 0 outside.** Perfectly one-sided. Random error, stale data or wrong parameters would deviate both ways; a secant of a convex surface can only fall inside.
- **D2: 250/250 lie on a chord** joining two on-cone vertices of the same face, worst distance **7.596e-9 m** — about 13× tighter than the tolerance they fail, and four orders of magnitude below their own residuals (up to 1.2e-4 m). They are interpolated points on a straight span, not independent surface samples.
- **D3: 0/20 faces rescued by a refit.** The stored parameters are not the problem — the failing vertices lie on chords *of the stored cone itself*.
- **D4: all 250 sit on boundaries shared with a face of a different surface type** (247 × tag-4002 cylinder, 3 × tag-4001 plane).

**Conclusion**: **The cone metadata is correct on all 47 tag-4003 faces.** EXP-047's 27/47 measures display-mesh interpolation, not metadata validity. Where a cone's boundary is shared with a cylinder or plane whose tessellation subdivides that edge more finely, the extra vertices are inserted along the straight span and therefore fall inside the cone — the same mechanism EXP-046 measured from the other direction as its 389 `different-sampling` edge-ID groups. This is exactly the separation EXP-048 asked for ("Metadata validity and tessellation fidelity must be evaluated separately"): they are now separated and the metadata side is clean. The discrepancy is resolved, not explained away — the vertices genuinely are off the cone, for a measured, one-sided geometric reason that says nothing against the stored surface.

**Corpus note**: this could not use the controlled C00–C12 models because **they contain no cone faces**. Per-model tags from `EXP045_RESULTS.json`: the controlled corpus covers only tag-4001 (plane) and tag-4002 (cylinder); tag-4003 occurs only in `distributor main boss rev a` (17), `Pocket Wheel` (20), `USB hub case BOTTOM` (8), `Helical Bevel Gear` (2), and tags 4005/4006/4007/4009 occur in no controlled model at all. A corpus gap, not a methodological choice — recorded as NQ-030.

**Hypotheses affected**: none falsified. EXP-047's and EXP-048's archived numbers stand exactly as recorded; only the interpretation of the 20 failures changes. INV-020–024 unaffected.

**Files tested**: all modern models with tag-4003 faces; 47 cone faces total.

**Confidence**: High. The signals are categorical (250/0 one-sided; 250/250 on-chord at 7.6e-9 m) and deterministic.

**Known gaps**: cone faces only, other surface tags untested for the same behaviour; the chord search is local (six nearest on-cone vertices — none required a wider search); the *reason* the exporter inserts these subdivision points is not established.

**Date last updated**: 2026-09-15

**Raw evidence**: `knowledge/evidence/2026-09-15_v0.4.8-EXP050.md`, `v0.4.8/EXP050_RESULTS.json`, `v0.4.8/exp050_offcone_localization.js`

---

## EXP-051: Visual Validation of parser/v0.2 Output

**Question**: Every check through EXP-050 has been numerical. A mesh can satisfy correct triangle counts, correct per-triangle normals, correct residual thresholds and every invariant while still rendering as webbing, spikes or an inside-out shell — a triangulation connecting the right vertices in the wrong order would pass all of them. Does the parser's output actually look like the part?

**Status**: Complete. Visual verification only. No new invariant, no parser change.

**Method**: A self-contained software rasteriser written for this experiment — no three.js, no CDN, no external dependency. Orthographic isometric projection, z-buffer, flat shading from the geometric face normal, one hue per face index, plus an overlay drawing every edge whose Block1 annotation is **nonzero** (INV-021's boundary edges) onto the mesh. Input is `parser/v0.2`'s own `triangleIndices` and `edgeAnnotations`, consumed verbatim — nothing re-derived, welded, re-ordered or repaired.

**Result — all seven models render correctly.** C03 (7 faces/36 tris): 1 mm fillet on exactly one vertical edge with the top face's corner correctly rounded. C04 (7/152): clean circular through-hole, cylinder wall with correct facet banding, diameter reading 50% of the face — 5 mm in a 10 mm cube. C07 (8/292): two separate clean through-holes. **C10 (11/28): the decisive case** — 1 mm rim at the opening, hollow interior with inner walls visible through it, wall thickness ~10% of the edge. USB hub TOP (68/4,704): recognisable enclosure with walls, cutout, screw bosses, counterbored holes and lip. Pocket Wheel (400/17,078): sprocket with pocketed teeth, raised hub, central bore with a resolved keyway notch. Dekor (375/15,282): ornate fretwork panel with a phoenix cutout, fine detail intact.

**No webbing, no stray triangles spanning unrelated vertices, no inverted or missing faces.** The boundary-edge overlay lands on real face outlines in every model — an independent visual confirmation of INV-021's partition, since a wrong edge classification would decorate face interiors rather than their borders. C10 is the strongest single check: a fan triangulation, a mis-ordered strip or a dropped section would close or web across the opening rather than produce a correctly hollowed box with a uniform rim.

**Note on Dekor**: 311 of its 375 faces are tag-4009, the surface type with no external validation anywhere in this project (NQ-030). Its mesh renders as coherent fine detail — which says the display mesh for those faces is well-formed, and nothing about the 4009 metadata.

**Rasteriser bugs found and fixed before accepting results** (rasteriser faults, not parser faults): an inverted depth test rendering back faces over front faces, and a wrong field name in the edge overlay (`ids`/`token` rather than `vertices`/`id`) which silently drew nothing. Both were caught by noticing the first C10 image showed a solid cube where a shell was expected.

**Hypotheses affected**: none. This complements the numerical work and does not strengthen it — visual inspection asserts no tolerance.

**Files tested**: C03, C04, C07, C10, USB hub TOP, Pocket Wheel, Dekor.

**Confidence**: High that the display mesh is well-formed for these seven. Scope is the display tessellation only — nothing about B-rep fidelity, trim accuracy or surface parameters.

**Known gaps**: one viewpoint per model, so a defect hidden by self-occlusion would not appear; colour is per face index and carries no semantic meaning; validates display mesh, not CAD surfaces.

**Date last updated**: 2026-09-16

**Raw evidence**: `knowledge/evidence/2026-09-16_v0.4.8-EXP051.md`, `v0.4.8/EXP051_renders/` (7 PNGs), `v0.4.8/exp051_render_validation.js`

**Extension, 2026-09-20 (EXP-051 continued — six viewpoints, four more models, mesh-closure check).** The original entry recorded "one viewpoint per model" as a limitation. Each model now renders as a 3×2 contact sheet of six labelled viewpoints (ISO FRONT/BACK/LEFT at 35.264° elevation, ISO UNDER at −35.264°, TOP at 89.9°, BOTTOM at −89.9°; 520 px panels, exact angles archived in `v0.4.8/EXP051_RENDER_INDEX.json`). Four models added — USB hub BOTTOM (39 faces), Helical Bevel Gear (113), distributor main boss rev a (51), PTC GE8080-8 (126) — giving **11 sheets, 66 renders**. All remain coherent from every angle. C10's TOP view resolves the shell opening as a clean square annulus with the interior floor visible through it and BOTTOM shows a closed base; the gear shows correct helical tooth twist, splined shaft and hollow bore. A second rasteriser fault was fixed: malformed 3×5 label glyph bitmaps (17-character strings where 15 are needed) rendered panel labels as garbage.

**A visual doubt checked rather than assumed.** In the gear's isometric views, background is visible between the bevel teeth where a root-cone surface might be expected — the signature a missing face would produce. Counting triangles per exact-coordinate edge: **Pocket Wheel, USB hub TOP, C04 and C10 are fully closed (0 open edges)**; the gear has 32 open edges of 9,079 (0.35%) and Dekor 72 of 22,959 (0.31%); **no edge anywhere is shared by more than two triangles**. Testing those open edges: **32/32 on the gear and 72/72 on Dekor are collinearly paired with another open edge**, i.e. the same physical edge subdivided differently by the two faces sharing it, so coordinate-exact matching fails while the geometry coincides; 16 of the gear's 32 additionally carry a vertex strictly in their interior (a T-junction, worst offset 8.33e-9 m). This is exactly the phenomenon EXP-046 recorded from the other direction (its 389 `different-sampling` groups and its 7,048 single-occurrence triangle edges "although the labeled boundaries pair"). **Conclusion: no missing faces** — a visible hole would need hundreds or thousands of open edges bounding it; 32, all collinearly paired, cannot bound any visible region, so the gaps between teeth are genuine open geometry. The single-viewpoint limitation is resolved; the other limits (display mesh not CAD surfaces, no tolerance asserted, no invariant proposed) stand.

---

## EXP-053 — First conversion pass: SLDPRT → STL / STEP (`converter/v0.1`)

> **Numbering note:** originally drafted as EXP-052. A concurrent session pushed its own
> EXP-052 (parser views compared with the original STL exports, `v0.4.8/exp052_*`) first, so
> this work was renumbered to 053. The two are unrelated.

**Question**: every experiment through EXP-051 *reads* the format. Is the decoded geometry good
enough to write back out as STL and STEP, and where exactly does its fidelity stop?

**Method**: new `converter/v0.1` consuming `parser/v0.2`. STL is an exact dump of the display
mesh. STEP is a boundary representation with tag-4001 faces emitted as analytic `PLANE` surfaces
trimmed by their INV-024 boundary cycles, all other faces faceted, vertices and edges shared
across the body; closed meshes become `MANIFOLD_SOLID_BREP`, open ones
`SHELL_BASED_SURFACE_MODEL`. Two external checks that do not reuse the converter's arithmetic:
STL compared triangle-for-triangle against SolidWorks' own `.STL` export (unordered vertex sets,
so winding and strip order cannot mask a mismatch), and the emitted STEP re-parsed by
`step-tools/step-parse.js` — written for the original SolidWorks exports, not for this writer —
checking every reference resolves and comparing `CARTESIAN_POINT` sets against the original
`.step`. Plus independent volume (divergence theorem), bounding box and open-edge counts.
Tolerance 2e-5 mm, set from float32 resolution rather than chosen to pass.

**Result — 13/13 controlled models convert; 0 dangling references in any emitted STEP; all 13
exported meshes closed; bounding box delta 0 against the reference STL on all 13.** STL is
exactly equal to SolidWorks' export on C00, C01, C02 and C10; a strict superset on C09; and
re-tessellated on the remaining 8. **Volumes reproduce analytic values exactly on every planar
model** — C00 1000.000000, C01 8000.000000, C02 1000.000000, C10 424.000000, C09 995.000000
mm³ — and differ by 5.7e-5 to 8.8e-4 relative on the curved ones, which is tessellation density:
SolidWorks re-tessellates when exporting STL, so its STL and the stored display mesh are two
different meshes of the same solid (C03's fillet is 8 angular steps in the export, 4 in the
display mesh). Production models convert without error: USB hub TOP 342 ms, Dekor 570 ms,
Helical Bevel Gear 288 ms, PTC GE8080-8 94 ms (114 of its 126 faces analytic).

**Corroborates EXP-049 from a new direction.** C03, C09 and C11's reference STL exports each
have 4 open edges where ours have 0, and for C09 the *entire* difference between the two meshes
is the `-1,0,0` facet group: 0 triangles in SolidWorks' export, 2 in ours. EXP-049 found the
missing −X face by grouping facet normals in the STL files; this finds it from mesh topology on
a re-exported mesh. Where those models read "mismatch" against the reference, the reference is
incomplete, not the converter.

**Hypotheses affected**: none proposed or promoted. This is an implementation result that
measures existing decode quality; it introduces no new structural claim.

**What this does not show** — the limits are structural, not polish. Curved faces are faceted
because exact trimming curves are not recovered, and EXP-050 established why they cannot be
re-fitted from this data: display vertices on a cone lie *inside* it, on chords between
on-surface vertices, so the mesh approximates the surface rather than sampling it. Coordinates
are float32, so a 10 mm cube round-trips as 9.9999998 mm — the stored precision, which bounds
every tolerance above. Cylinders and cones *do* carry validated analytic parameters (EXP-045,
EXP-048), so `CYLINDRICAL_SURFACE`/`CONICAL_SURFACE` emission is reachable and blocked only on
exact circular trim curves. No feature history, sketches, constraints, materials,
configurations or assembly structure. Legacy OLE2 unsupported. Nothing claimed for tags
4005/4006/4007/4009 (NQ-030).

**Files tested**: C00–C12 (13 controlled models) for validation; USB hub TOP, Dekor, Helical
Bevel Gear, PTC GE8080-8 for scale.

**Confidence**: High that display-mesh conversion is correct and its fidelity is as measured.
No confidence claimed about B-rep equivalence — explicitly not demonstrated.

**Date last updated**: 2026-09-20

**Raw evidence**: `knowledge/evidence/2026-09-20_converter-v0.1-EXP053.md`,
`converter/v0.1/VALIDATION.json`, `converter/v0.1/README.md`

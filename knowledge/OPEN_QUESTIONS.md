# Open Questions

> **2026-09-14 current-state correction — EXP-042–046:** Read [the v0.4.8 format report](../v0.4.8/README.md) before using the historical conclusions below. Block2 describes triangle strips, not CAD loops; Block1 annotates strip edges and links exactly to downstream edge IDs. The predecessor array is always present on the tested corpus. A third byte array and a forward metadata grammar are now recorded. `parser/v0.2` implements the verified read-only path. Old text is retained as evidence, not current guidance.

Project-wide unresolved questions. Do not promote any item here into a fact without a falsifiable experiment and evidence update.

Source migrated from `v0.3.5/docs/research/OPEN_QUESTIONS.md`.

---

## OQ-001: What Grammar Does Block 1 Follow?

**Status**: Hypothesis Space

**Evidence so far**: Block 1 starts with ONE, ONE count equals Block 2 entry count, ONE values are singleton, and ZERO/LARGE alternation is common. Additionally, three structural invariants have been verified (INV-016/017/018): Block 1 body length relates to vertex count and section count; each ONE-delimited section body length equals `Block2[i] − 1`; and Block 2 values sum to Block 1 body length. However, section length alone does not uniquely determine token-class sequence (only 30.2% of lengths have a single unique pattern across 3429 sections).

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High that grammar exists; low on complete grammar.

**Date last updated**: 2026-06-27

---

## OQ-001A: Is Block 1 A Grammar Or An Opcode/Operand Bytecode Language?

**Status**: Open Question

**Evidence so far**: Current observations include ONE-delimited sections, token classes, repeated local forms, the verified length relation INV-017 (`sectionBodyTokenCount = Block2[i] − 1`), and the observation that section length alone does not uniquely determine token-class sequence. These measurements describe stable surface structure, but they do not distinguish between a declarative grammar of section forms and an imperative bytecode-like stream with opcodes and operands.

**Why current evidence cannot distinguish the models**: The project has not yet shown whether values control parser state as operations, or whether they are terminals in a fixed structural grammar. No execution model, opcode table, operand arity table, or complete finite-state grammar has been verified. The non-uniqueness of token-class patterns by section length is consistent with both models.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR for earlier grammar observations; v0.4.0 corpus for INV-017 verification.

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High that both models remain viable; no answer assigned.

**Date last updated**: 2026-06-27

---

## OQ-002: What Does Each ONE-Delimited Segment Represent?

**Status**: Hypothesis

**Evidence so far**: Count of ONE values equals Block 2 loop count for 595/595 faces. INV-017 further shows that each section body length equals `Block2[i] − 1`, which is consistent with — but does not prove — a one-segment-per-loop interpretation.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High on count correlation and structural pairing (INV-017), medium-low on semantic meaning.

**Date last updated**: 2026-06-27

---

## OQ-003: What Do LARGE Values Represent?

**Status**: Hypothesis Space

**Evidence so far**: LARGE values appear in Block 1 sections and often alternate with ZERO values. Some values fall into ranges that could be local or global indices, but the current evidence disproves a uniform "all global vertex indices" rule.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models for token grammar; selected simple/complex faces for range checks.

**Confidence**: Low for semantics.

**Date last updated**: 2026-06-27

---

## OQ-003A: What Do VALUE Tokens Mean?

**Status**: Open Question

**Evidence so far**: `VALUE` is currently only an observational class for any Block 1 integer other than `0` or `1`. The property-table hypothesis was falsified by today's reported random-base controls, frequency-bias analysis, and delimiter-artifact finding. The v0.4.0 corpus statistics show that VALUE tokens repeat in 1937/3429 sections (56.5%) and that section length alone does not uniquely determine token-class sequence. These observations constrain but do not resolve VALUE semantics.

**Current conclusion**: VALUE semantics are UNKNOWN.

**Promotion rule**: Future hypotheses about VALUE must include at least one discriminating experiment before being promoted beyond Hypothesis.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR for earlier VALUE/token observations; v0.4.0 corpus for statistics.

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High that VALUE semantics are unknown; high that the property-table hypothesis is currently failed, pending raw evidence archival.

**Date last updated**: 2026-06-27

---

## OQ-004: What Do ZERO Values Represent Inside Block 1?

**Status**: Hypothesis Space

**Evidence so far**: ZERO is frequent and forms dominant `ZERO -> LARGE` and `LARGE -> ZERO` bigrams. It may be a separator, null field, flag, or part of a record grammar.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High for frequency, low for meaning.

**Date last updated**: 2026-06-27

---

## OQ-005: Why Do Some Faces Have SMALL Values?

**Status**: Observation

**Evidence so far**: SMALL values in range `2..255` were observed in GEAR but not in BOTTOM, TOP, or DEKOR in the current classification run. The branch notebook records 546 SMALL values in GEAR and 0 in BOTTOM, TOP, and DEKOR.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High for observed distribution, low for explanation.

**Date last updated**: 2026-06-27

---

## OQ-006: What Is The Meaning Of Block 2's Raw Encoding?

> **Correction, 2026-09-14 (EXP-042–046):** Answered operationally: each B2 element is the word length of a B1 strip section, 2*L-2. The precursor separately stores L. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Hypothesis

**Evidence so far**: The formula `(raw + 2) / 2` works as a loop vertex-count decoder for all tested faces. The reason for this encoding is unknown.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High on decoder, low on derivation.

**Date last updated**: 2026-06-27

---

## OQ-007: What Is The Small DisplayLists/LWDATA-Adjacent Stream?

**Status**: Observation

**Evidence so far**: `Contents/Config-0-LWDATA` appears metadata-like and contains class-name-like strings, but its full structure is not decoded.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 4 models, stream-level analysis.

**Confidence**: Medium that it is metadata in current corpus, low on exact grammar.

**Date last updated**: 2026-06-27

---

## OQ-008: What Are DisplayLists Sections?

**Status**: Hypothesis Space

**Evidence so far**: Repeated `[1,1]` section-like structures exist. Section 0 often contains metadata strings. Other sections may group faces, but grouping semantics are unverified.

**Files tested**: BOTTOM, GEAR

**Faces/models tested**: 2 models, 152 parsed faces in section audit.

**Confidence**: High that sections exist, low on semantics.

**Date last updated**: 2026-06-27

---

## OQ-009: What Is `Contents/Config-0-Partition`?

**Status**: Observation

**Evidence so far**: Current tooling sees this stream as unreadable/high entropy. It may be compressed, encrypted, encoded, or otherwise transformed.

**Files tested**: BOTTOM and related modern corpus inventory.

**Faces/models tested**: Stream-level analysis.

**Confidence**: Medium on unreadable/high-entropy observation, low on cause.

**Date last updated**: 2026-06-27

---

## OQ-010: How Do LARGE-LARGE Pairs At Segment Boundaries Work?

**Status**: Observation

**Evidence so far**: The branch notebook records some Block 1 sections ending with `LARGE LARGE` rather than `ZERO LARGE`, including BOTTOM faces #35-38. This pattern appears near the end of some Block 1 bodies.

**Files tested**: BOTTOM, with broader corpus status not yet audited.

**Faces/models tested**: At least 4 named BOTTOM faces; aggregate prevalence not yet preserved in project-wide evidence.

**Confidence**: Medium for existence, low for meaning.

**Date last updated**: 2026-06-27

---

## OQ-011: Can Block 1 Grammar Be Decoded Without Geometric Validation?

**Status**: Hypothesis Space

**Evidence so far**: Structural analysis shows strong grammar signals such as ONE delimiters and ZERO/LARGE alternation, but current evidence does not establish the meaning of positions inside each segment.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: Medium that structural decoding can go further; low that full decoding can be completed without geometry checks.

**Date last updated**: 2026-06-27

---

## OQ-012: Why Do Structurally Equivalent Faces Require Position-Dependent VALUE Mappings In Some File Pairs But Only A Global Bijection In Others?

**Status**: Open Question

**Evidence so far**: Experiment EXP-012 (v0.4.1 rewrite analysis) found that BOTTOM↔TOP requires (section index, position) context to resolve VALUE→VALUE mappings, while BOTTOM→GEAR forms a global bijection (0 ambiguous mappings). The same VALUE at the same position can map to different targets in different sections for BOTTOM↔TOP, but for BOTTOM→GEAR the mapping is consistent across all sections.

This asymmetry is unexplained. It does not correlate with file size, face count, or vertex count in any obvious way.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR

**Faces/models tested**: 595 faces; 28 BOTTOM↔TOP face pairs for deep analysis.

**Confidence**: High that the asymmetry exists; low on explanation.

**Date last updated**: 2026-07-10

---

## OQ-013: Can The Position-Dependent VALUE Mapping Function Be Expressed As Arithmetic?

**Status**: Open Question

**Evidence so far**: The rewrite function `f(src, secIdx, pos) → tgt` is deterministic (EXP-012), but the current evidence does not distinguish between:
- An arithmetic function (linear, affine, or modular transform on src, secIdx, pos)
- A lookup-table model where each (secIdx, pos) position has a specific expected value independent of arithmetic context
- A hybrid model where some positions are arithmetic and others are table-driven

**Why current evidence cannot distinguish**: The v0.4.1 analysis only verified existence and determinism of the mapping. No attempt was made to derive or fit an arithmetic formula.

**Files tested**: BOTTOM, TOP

**Faces/models tested**: 28 BOTTOM↔TOP face pairs.

**Confidence**: High that the function is deterministic; low on its form.

**Date last updated**: 2026-07-10

---

## OQ-014: What Does The [4,8,2,N] Pattern Mean In DisplayLists?

> **Correction, 2026-09-14 (EXP-042–046):** A local typed-array interpretation now parses the face sequence. This does not establish a complete global object serialization grammar. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Open Question

**Evidence so far**: The pattern [4,8,2,N] appears 3,516 times across 7 files (0.96 per 1KB). N ranges from 1 to 9,636 (175 distinct values). 661 occurrences are at face-relative positions mp - 16 - 4*N (face containers). The remaining 2,855 occurrences are elsewhere in the stream. Classification attempts in EXP-022/025 failed due to offset bugs (see FALSIFICATION_REVIEW.md). Whether this is one container format with variable N or multiple unrelated structures is unknown.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 7 files, stream-level scan. Face-level: 1,172 faces with 661 face containers.

**Confidence**: Low for meaning; medium that the pattern is non-random.

**Date last updated**: 2026-07-16

---

## OQ-015: What Does The N=2 Body[0] Value At mp-8 Represent?

> **Correction, 2026-09-14 (EXP-042–046):** Answered: it is the first of two serialized strip lengths, not a previous face edgeCount. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Open Question

**Evidence so far**: For N=2 face containers ([4,8,2,2] at mp-24), the body[0] at mp-8 is overwhelmingly 3 (241/300 = 80.3%). It is NOT the previous face edgeCount (falsified by FH-015). Does not correlate with ec, vc, or face index. Other values observed: 4 (3x), 5 (21x), 7 (5x), 9 (7x), 11 (1x), 13 (2x), 21 (1x), 25 (1x), 33 (1x). Non-3 values appear only in GEAR, DEKOR, DISTRIBUTOR, and PTC.

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, HEADPHONE, DISTRIBUTOR, POCKET, PTC

**Faces/models tested**: 300 N=2 alternative faces across 8 files.

**Confidence**: High that it is not prev_edgeCount; low for what it actually is.

**Date last updated**: 2026-07-16

---

## OQ-016: What Is The Correct B2 Offset In The Face Layout?

**Status**: Answered (2026-08-13, see correction note below) -- original entry retained per evidence-preservation policy.

**Evidence so far**: Multiple experiments read B2 at block1Start + b1Word0 * 4 (EXP-023/024). Byte-level inspection shows this reads B1 body data (large index values), not clean section lengths. Three candidate offsets produce mixed data: none yields consistently [1,500] values. The B2 section-length model itself may be incomplete or the B1 header size (4 vs 8 bytes) is unknown.

**Files tested**: BOTTOM, GEAR (selected faces)

**Faces/models tested**: 10 representative faces across 2 files.

**Confidence**: Low -- fundamental uncertainty about B2 position and structure.

**Date last updated**: 2026-07-16

---
### CORRECTION NOTE (2026-08-13)

**Root cause identified.** EXP-023/024's `b1Word0` was read at `block1Start + 0`, which is the Block1 header's constant first word (always `4`, per INV-005), not the body length `N`. Direct inspection of `v0.4.4/EXP023_RESULTS.json` confirms `b1Len` (== `b1Word0`) is exactly `4` for all 1,172 faces with zero exceptions. Because of this, `block1Start + b1Word0*4` always evaluated to `block1Start + 16` -- the start of Block1's own body, not Block2. This explains the byte-level observation in this entry ("reads B1 body data, not clean section lengths") exactly.

**Correct offset**, per the already-established layout (INV-005, EXP-018, EXP-021): read the true 4-word header `[4,8,2,N]` at `block1Start`, validate its shape, then

```
block2Start = block1Start + (N + 4) * 4
```

with `N` taken from `block1Start + 12` (the header's 4th word), not `block1Start + 0`. The B1 header size is 16 bytes (4 words), not 4 or 8 bytes as this entry speculated.

**Verification**: at the corrected offset, the real Block2 header `[4,8,2,M]` is valid for 1,172/1,172 faces (100%) across the 7-file corpus, and the resulting `M` (section count) matches an independent cross-check (count of `ONE` values in the Block1 body, per INV-009) for 1,172/1,172 faces (100%).

**Discovered by:** EXP-023-CORRECTED / EXP-024-CORRECTED (v0.4.5).

**Raw evidence:** `v0.4.5/CORRECTION_NOTE.md`, `knowledge/evidence/2026-08-13_v0.4.5-EXP023-corrected.md`, `knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md`.

---

## OQ-017: Why Does HEADPHONE Have Zero [4,8,2,N] Alternatives?

**Status**: Open Question

**Evidence so far**: HEADPHONE (62 faces) has 0 alternatives at mp - 16 - 4*N for N=1 or N=2. PTC (126 faces) has 92.9% alternative rate. The bimodal distribution (0% vs 92.9%) is unexplained.

**Files tested**: HEADPHONE, PTC, and 6 other files for comparison.

**Faces/models tested**: 1,234 faces across 8 files.

**Confidence**: Medium that the pattern is version or exporter-specific.

**Date last updated**: 2026-07-16

---

## OQ-018: Does Section Count Fully Determine Alternative-Header Presence?

> **Correction, 2026-09-14 (EXP-042–046):** Resolved as a detector-window artifact; the full precursor exists for all observed strip counts. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Correlation confirmed exceptionless (2026-08-13, EXP-026); causal direction remains Open. See correction note below. Original entry retained per evidence-preservation policy.

**Evidence so far**: Once the Block1->Block2 offset bug in EXP-023/024 was corrected (v0.4.5), the true `secCount` (Block2 body length M) was cross-tabulated against alternative-header presence/N-value for all 1,172 faces in the 7-file corpus. The correlation has zero exceptions: `secCount=1` occurs in exactly the 368 faces with an N=1 alternative header (and no others); `secCount=2` occurs in exactly the 293 faces with an N=2 alternative header (and no others); `secCount>=3` occurs in exactly the 511 faces with no alternative header (and no others). This is stronger than the previously-reported "VC=4,8,10 always have alternatives" correlation (OQ-014/EXP-023) and may subsume it, since VC and secCount are likely correlated with each other via INV-016 (`b1len = 2*(vc - secCount)`). No causal mechanism or semantic meaning is established. Per project rules, do not infer that the alternative header "encodes" secCount or vice versa without a discriminating experiment (e.g., testing whether N always equals secCount for secCount in {1,2}, and why the pattern stops being observed at secCount=3, which could be a container-format cutoff or filtering artifact of the mp-20/mp-24 search window used to detect the alternative header).

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, DISTRIBUTOR, POCKET, PTC.

**Faces/models tested**: 1,172 faces across 7 files. HEADPHONE (62 faces, known to have 0% alternative rate per OQ-017) is untested for this specific correlation -- file not present in this repository checkout.

**Confidence**: High that the correlation is exact and non-random on the tested corpus; zero confidence on causal direction or semantics.

**Date last updated**: 2026-08-13

**Related evidence**: `knowledge/evidence/2026-08-13_v0.4.5-EXP023-corrected.md`, `v0.4.5/SUMMARY.md`.

---
### DISCRIMINATING TEST NOTE (2026-08-13)

**EXP-026 (v0.4.6)** ran the narrow counterexample hunt this entry called for: an independently-derived extraction pass (reusing only the v0.4.5-corrected offset formula, not the buggy v0.4.4 arithmetic) checked all 1,172 faces for four specific counterexample patterns (secCount=1 without an N=1 alternative; secCount=2 without an N=2 alternative; secCount>=3 with any alternative; alternative N inconsistent with secCount).

**Result: 0 counterexamples in all four directions, across all 1,172 faces and all 7 files individually.** The correlation is now recorded as **INV-019** (`knowledge/KNOWN_INVARIANTS.md`, Status: Correlation) — an empirical pattern with zero known exceptions on the tested corpus, not a proven causal or structural law. Causality (which variable determines the other, if either) remains unresolved. Two caveats carried forward, not resolved by this test: (1) the alternative-header detection window is limited to N∈{1,2} at fixed offsets, so "no alternative" for secCount>=3 faces is not a general absence claim; (2) HEADPHONE (62 faces) is untested (not present in this repository checkout).

**Discovered by:** EXP-026 (v0.4.6).

**Raw evidence:** `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`, `v0.4.6/SUMMARY.md`.

---

## OQ-019: Is Sequential Loop Segmentation The Correct Vertex-To-Loop Mapping?

> **Correction, 2026-09-14 (EXP-042–046):** Resolved for the corpus: sequential strip grouping and alternating strip winding pass EXP-042/043. Sequential polygon/fan interpretation is falsified. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Open Question

**Evidence so far**: INV-007 proves that loop vertex counts decoded from Block2 (`(raw+2)/2`) sum to the face's total vertex count. It does not establish which vertices belong to which loop, or in what order loops appear relative to the vertex array. The parser/viewer (`parser/v0.1/src/parser-core.js`, originally produced as v0.5) introduces a labeled, unverified rendering hypothesis (`loopModel: 'sequential-assumed'`): vertices are segmented sequentially into runs matching the Block2-decoded loop sizes, in Block2 order, and each run is fan-triangulated for display. Empirical observation from browser verification (`knowledge/evidence/2026-08-13_v0.5-parser-validation.md`): faces with `secCount=1` (single loop) render as clean, plausible geometry under this assumption (e.g. USB hub case BOTTOM). Faces with large `secCount` (e.g. Dekor's `secCount=1044` faces) render as a visually chaotic, implausible starburst. This is *consistent with* the sequential-ordering assumption being wrong for multi-loop faces, but does **not prove** it -- alternative explanations not yet ruled out: (a) loops are not simple/convex polygons, so fan triangulation is inappropriate even with correct membership; (b) the loop order in the vertex array does not match Block2's order, but some other grouping (e.g. interleaved, or a different sequential order) would render correctly; (c) the visual "wrongness" for large-secCount faces is expected even with fully correct topology, if the underlying geometry is itself complex/non-convex.

**Files tested**: BOTTOM (secCount=1 faces, plausible render), DEKOR (secCount up to 1044, implausible render). Qualitative visual observation only, not a quantitative test.

**Faces/models tested**: 2 files spot-checked visually; not a systematic corpus-wide test.

**Confidence**: Low. This is a hypothesis about a hypothesis (the render result is suggestive, not diagnostic).

**Date last updated**: 2026-08-13

**Related evidence**: `knowledge/evidence/2026-08-13_v0.5-parser-validation.md`, `parser/v0.1/README.md`, `parser/v0.1/SUMMARY.md`.

**Will eliminate or constrain**: Whether the parser/v0.1 viewer's rendered mesh can be trusted for multi-loop (secCount>1) faces; whether a future experiment should target loop-membership/ordering directly (e.g. via geometric planarity/adjacency analysis of candidate loop segmentations) before further viewer work.

---

## OQ-021: What Determines Cylindrical Surface Vertex Count?

**Status**: Hypothesis

**Evidence so far**: EXP-027 claimed vc ≈ 14 * diameter_mm (linear scaling). EXP-028 FALSIFIED this: vc ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67. With only 2 data points (3mm, 5mm), exact relationship unknown. C07/C08 confirm consistent vc values across models (5mm→70, 3mm→56).

**Hypotheses**: (1) Power law vc = a * diameter^b; (2) Chord-error tessellation with constant tolerance; (3) Fixed angular step with diameter-dependent subdivision.

**Files tested**: C04, C05, C07, C08

**Faces/models tested**: 4 models with holes

**Confidence**: High that linear scaling is falsified; low on exact relationship.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`, `v0.4.7/EXP028_HOLE_DIAMETER.json`.

---

## OQ-022: Is DisplayList Re-Serialized on Any Face Change?

**Status**: Verified Conclusion

**Evidence so far**: EXP-028 confirmed binary diffs dominated by inter-face metadata (50-80%). Face start offsets shift globally. DL is re-serialized entirely when faces are added/modified.

**Conclusion**: Yes, DL is re-serialized on any face change. Incremental parsing not possible.

**Files tested**: C00↔C03, C00↔C04, C00↔C09, C00↔C10

**Faces/models tested**: 4 pairs

**Confidence**: High.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`, `v0.4.7/EXP028_FEATURE_LOCALIZATION.json`.

---

## OQ-023: Do SLDPRT Vertices Represent Exact B-Rep Geometry?

**Status**: Falsified

**Evidence so far**: EXP-028 FALSIFIED exact correspondence. SLDPRT↔STEP exact matches: 3/24 (C00), 6/212 (C04), 4/60 (C03). Mean distance ~0.01mm. SLDPRT vertices are DisplayList tessellation, not exact B-rep vertices.

**Conclusion**: No, SLDPRT vertices are tessellated approximations. Parser output cannot be directly compared to STEP geometry with tight tolerances.

**Files tested**: C00, C03, C04

**Faces/models tested**: 3 models

**Confidence**: High.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`, `v0.4.7/EXP028_VERTEX_CORRESPONDENCE.json`.

---

## OQ-024: What Is the Chord-Error Tolerance for DisplayList Tessellation?

**Status**: Hypothesis

**Evidence so far**: EXP-028 observed consistent ~0.01mm offset from STEP/STL vertices. This suggests a chord-error tolerance, but exact value unknown.

**Hypothesis**: SolidWorks uses constant chord-error tessellation with tolerance ~0.01mm.

**Files tested**: C00, C03, C04

**Faces/models tested**: 3 models

**Confidence**: Medium. Consistent offset observed, but tolerance not precisely measured.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`, `v0.4.7/EXP028_VERTEX_CORRESPONDENCE.json`.

---

## OQ-025: Do Block1 Tokens Encode Tessellation Parameters?

**Status**: Hypothesis

**Evidence so far**: EXP-029 found that cylindrical face tokens are identical up to length between C04 (vc=70) and C05 (vc=56). The alternating pattern (150, 153) suggests fixed tessellation angles. However, token semantics remain unknown.

**Hypothesis**: Block1 tokens encode tessellation parameters (e.g., angular step, chord error) rather than geometry-specific data.

**Files tested**: C00, C03, C04, C05, C09

**Faces/models tested**: 30 faces across 5 models

**Confidence**: Medium. Pattern observed, but semantics unknown.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP029.md`, `v0.4.7/EXP029_BLOCK1_GEOMETRY.json`.

---

## OQ-026: Do Block1 Tokens Encode Face Orientation?

**Status**: Hypothesis

**Evidence so far**: EXP-029 found that token values differ between cube faces with identical ec/vc/secCount. The correlation between token 1 and token 2 in cube faces suggests a relationship to face coordinates.

**Hypothesis**: Token values encode face orientation or position in the model space.

**Files tested**: C00, C03, C04, C05, C09

**Faces/models tested**: 30 faces across 5 models

**Confidence**: Low. Correlation observed, but semantics unknown.

**Date last updated**: 2026-08-14

---

## OQ-027: What Do the Specific Token Values (150, 153, 5, 82, etc.) Represent?

> **Correction, 2026-09-14 (EXP-042–046):** Answered on the corpus: nonzero words label boundary edges; EXP-043 maps them geometrically and EXP-045 matches the downstream ID table. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Open Question

**Evidence so far**: EXP-030 found that cylindrical faces have alternating tokens (150, 153) across all hole diameters. Cube faces have tokens [1, 5, 82, 0, 79, 62] across all models. Token values do NOT correspond to vertex indices, edge counts, loop sizes, or Block2 values.

**Hypothesis**: Token values encode tessellation parameters, face type signatures, or other structural information.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Low. Pattern observed, but semantics unknown.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP030.md`, `v0.4.7/EXP030_STRUCTURAL_CORRESPONDENCE.json`.

---

## OQ-028: Why Do Planar Cube Faces Have Diverse Token Signatures?

**Status**: Open Question

**Evidence so far**: EXP-031 found that 27 planar cube faces (ec=4, vc=4, secCount=1) have 9 unique first-20 patterns. Token signatures differ by face orientation but are consistent across models for the same face orientation.

**Hypothesis**: Token signatures encode face orientation or position in the model space.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Low. Pattern observed, but semantics unknown.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP031.md`, `v0.4.7/EXP031_TOKEN_SIGNATURES.json`.

---

## OQ-029: Can Token Signatures Be Used for Face Classification?

**Status**: Hypothesis

**Evidence so far**: EXP-031 found that cylindrical faces can be classified by their token signature (alternating 150/153 pattern), but planar cube faces cannot be classified by their token signature.

**Hypothesis**: Token signatures can be used to classify face types (cylindrical vs non-cylindrical).

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Medium. Cylindrical faces can be classified, but planar faces cannot.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP031.md`, `v0.4.7/EXP031_TOKEN_SIGNATURES.json`.

---

## OQ-030: Why Do C03 and C09 Have Different Token Patterns for +X and +Y?

**Status**: Open Question

**Evidence so far**: EXP-032 found that C03 (fillet) and C09 (chamfer) have modified token patterns for +X and +Y orientations compared to C00, C04, C05, C11.

**Hypothesis**: Token signatures are influenced by model type (fillet/chamfer features).

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Medium. Pattern observed, but relationship to features not understood.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP032.md`, `v0.4.7/EXP032_TOKEN_ORIENTATION.json`.

---

## OQ-031: Can Token Signatures Be Used for Model Type Classification?

**Status**: Hypothesis

**Evidence so far**: EXP-032 found that token signatures correlate with model type (fillet/chamfer/hole). C03 and C09 have modified patterns for +X and +Y orientations.

**Hypothesis**: Token signatures can be used to classify model type (fillet, chamfer, hole).

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Medium. Pattern observed, but more data needed.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP032.md`, `v0.4.7/EXP032_TOKEN_ORIENTATION.json`.

---

## OQ-032: What Global Model State Property Causes Token Signature Changes?

**Status**: Open Question

**Evidence so far**: EXP-033 found that fillet and chamfer produce identical signature changes for +X and +Y, while hole models do not. Signature changes occur without structural changes (ec/vc/secCount/b1Len identical), without direct modification, and without adjacency. This suggests global model state affects token signatures.

**Hypothesis**: Global model state (e.g., feature type, model complexity, serialization context) affects token signatures of unrelated faces.

**Files tested**: C00, C03, C04, C05, C09, C11

**Faces/models tested**: 41 faces across 6 models

**Confidence**: Medium. Pattern observed, but mechanism unknown.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP033.md`, `v0.4.7/EXP033_FEATURE_STATE.json`.

**CORRECTION NOTE (2026-08-14, Archivist Audit)**: The "Evidence so far" text above states signature changes occur "without adjacency" — this is not established. EXP-033's adjacency test (`isAdjacentToModified()`) uses a same-orientation-label heuristic, not real topological adjacency, and is structurally incapable of detecting the +X/+Y faces as adjacent to a fillet/chamfer edge regardless of whether they truly are (geometrically, they should be, since a fillet/chamfer edge is shared by exactly those two faces). Treat "adjacency" as **untested**, not ruled out, when reasoning about this question. See `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding A).

**UPDATE (2026-08-14, EXP-037)**: Adjacency is no longer untested for the one edge this corpus contains. A real vertex/edge-sharing adjacency computation (`v0.4.7/exp037_edge_location_and_adjacency.js`, replacing `isAdjacentToModified()`) directly measured, from archived per-face vertex coordinates, that the new fillet/chamfer face's within-model adjacency set is exactly {+X, +Y, +Z, -Z} for both C03 and C09 — precisely the set of faces whose token signature changed. This is Strong Evidence (correlational, single edge) that "genuine topological adjacency" and "token change" coincide for fillet/chamfer, superseding the "untested" status above **for that specific claim**. It does not establish causation, and it does not answer whether the effect would move to a different edge (NQ-028) — that remains blocked on a new model (see `NEXT_QUESTIONS.md` NQ-028). It also does not establish a universal "adjacency causes change" rule: shell's new inner-wall faces are, by the same test, adjacent to several outer walls whose tokens EXP-035 showed are unchanged. See `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md`.

**UPDATE (2026-08-15, EXP-038)**: NQ-028's "different edge" question is now answered using a real second-edge model (C12, 1mm fillet on the -X/-Y edge, supplied by the user). The token-changed face set relocated from {+X,+Y} to {-X,-Y}, exactly matching C12's own real (vertex-computed) adjacency set — the same pattern EXP-037 found on the first edge, replicated at a second, independent location. This is Strong Evidence across n=2 edges that the effect is genuinely tied to the modified edge's physical location, not to a fixed face/index/orientation. It is still not a proven causal mechanism, and EXP-038 explicitly found that "real topological adjacency" and "this face's own vertices being directly, if minutely, modified by the trim" remain indistinguishable in this corpus (they pick out the identical face set for any edge-type feature) — so "adjacency, specifically, is the trigger" (as opposed to "any local, non-uniform geometric touch is the trigger") is still not established. See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md`.

**UPDATE (2026-08-16, EXP-039)**: "Global model state," as originally hypothesized in this entry's title/framing (some property beyond the modified face's own geometry), is not required to explain any observation in the corpus tested through EXP-039. EXP-037/038's own `facesIdentical()` (already-validated tooling) already recorded `identical: false` (real vertex-coordinate mismatch) for the +X/+Y (or -X/-Y) faces since 2026-08-14 — this had never been used to check the "direct modification" side of the confound, only the adjacency side. EXP-039 did so and additionally isolated the SEPARABLE case using shell/hole controls: adjacency without direct modification never causes a change (0/12, across fillet/chamfer/hole/shell), while direct modification, wherever it occurs, always coincides with a change (11/11). Direct, local vertex modification is therefore the simplest sufficient explanation for every case observed so far; a genuinely non-local "global state" mechanism remains logically possible but has no supporting evidence and is not required. See `knowledge/evidence/2026-08-16_v0.4.7-EXP039.md`.

**CORRECTION NOTE (2026-08-17, audit of EXP-037→EXP-040)**: "11/11" above is wrong (the script never computed it — `EXP039_DIRECT_MODIFICATION_NECESSITY.json`'s rows exclude every directly-modified face by construction); recomputed from `EXP037_RESULTS.json`/`EXP038_RESULTS.json` directly, the correct figure is **14/14 known cases, 1 unknown**. Also: the "0/12 ... adjacency without direct modification" claim is weaker than stated — every one of the 12 cases is adjacent only to an already-directly-modified neighbor, never to genuinely new geometry (verified against `EXP037_RESULTS.json`'s own `added[].adjacentToModelFaces`), so this experiment does not actually isolate "adjacency to new geometry" from "adjacency to a directly-modified neighbor" for any feature type — the confound is universal in this corpus, not resolved here. Full derivation: `v0.4.7/EXP039_SUMMARY.md`'s matching correction note.

**CORRECTION NOTE (2026-08-16, Audit + EXP-040)**: EXP-037's shell "contrast case" — cited above and elsewhere via `OQ-036` as evidence that adjacency is "not universally sufficient" across feature types — is retracted. It was based on a face-indexing error (naming two of shell's own new inner-wall faces as "unmodified outer walls"); a corrected recheck (two independent methods, both bypassing the original error) finds shell's new inner-wall faces have **zero** real adjacency to any of its unmodified outer walls at all — only to the shell's own directly-modified opening face and to each other. Shell therefore no longer counts as a counterexample, though this does not newly prove universality either (see `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md`). A full four-feature-type tally is now 0 exceptions in either direction (10 adjacent+changed / 0 adjacent+unchanged / 0 non-adjacent+changed / 13 non-adjacent+unchanged / 1 unknown). This is consistent with, not contradicted by, EXP-039's "0/12" figure immediately above: EXP-039's 12 adjacent-and-unmodified data points come from real adjacency to each shell model's own directly-modified opening face (not from the erroneous outer-wall claim), and its own freshly-computed adjacency data already agreed with this correction. "Global model state" (the phenomenon description, i.e. that fillet/chamfer change tokens on faces not directly touched) is unaffected by this — only the specific "shell disproves universality" caveat is withdrawn.

**UPDATE (2026-09-13, EXP-041)**: First from-source analysis of the controlled corpus (`d0c6c54` added the C00–C11 binaries). Two new observations bear on "global model state" as a candidate mechanism, and both weaken it further:

1. **`C07 → C08`** changes *only* the second hole (5 mm → 3 mm Ø), face count 8→8, nothing added or removed. The four side walls **and** face 6 — the *first* hole's cylinder at centre (3,3), untouched by the edit — are identical in both vertices and Block1 tokens, while faces 4, 5 and 7 change. Face 6 shares **35 vertices with face 4 and 35 with face 5**, both of which undergo large token changes. Per EXP-028 the DisplayList is re-serialized wholesale on any face change, yet five of eight faces come through byte-identical. This is the strongest global-state control in the project and the first on a pair with a genuine **non-similarity** feature edit (C01/C02, the only prior evidence of this kind, are similarity transforms). It also extends EXP-039's R2 relation — one-hop propagation from an already-modified neighbour does not occur — to the highest-contact case in the corpus.
2. **`C04 → C06`** (hole position only): within a single model pair, the cylindrical face translates rigidly (`[0.002, 0, 0]`, all 70 vertices) with **byte-identical** tokens while faces 4/5 change. The token change behaves as a **per-face** property, not a model-global one.

Neither observation falsifies a global-state mechanism outright, but nothing in the corpus now requires one. See `knowledge/evidence/2026-09-13_v0.4.7-EXP041.md` §4.1–4.2.

---

## OQ-033: Why Do Fillet and Chamfer Produce Identical Signature Changes?

**Status**: Open Question

**Evidence so far**: EXP-033 found that fillet (C03) and chamfer (C09) produce identical signature changes for +X and +Y, despite being different feature types. This suggests they share a common property that affects token signatures.

**Hypothesis**: Fillet and chamfer share a common property (e.g., edge modification, surface replacement) that affects global model state and thus token signatures.

**Files tested**: C00, C03, C09

**Faces/models tested**: 20 faces across 3 models

**Confidence**: Low. Pattern observed, but common property not identified.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP033.md`, `v0.4.7/EXP033_FEATURE_STATE.json`.

---

## OQ-034: What Do Block1/Block2 Tokens Encode?

> **Correction, 2026-09-14 (EXP-042–046):** Answered at the display-mesh level by EXP-042–046: B1 edge annotations, B2 strip-section lengths, precursor vertex counts. Whole-format semantics remain open. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Open Question

**Evidence so far**: EXP-034 found that Block1/Block2 tokens are COMPLETELY INVARIANT under geometric transformations (scale, translation), while vertex coordinates change as expected. This provides strong evidence that these structures are independent of the tested absolute vertex coordinates. The exact semantic meaning of Block1/Block2 tokens remains unknown.

**Hypothesis**: Block1/Block2 tokens encode some structural property of the face that is independent of absolute vertex coordinates. The hypothesis that they encode topology is plausible but not established by EXP-034 alone.

**Files tested**: C00, C01, C02

**Faces/models tested**: 18 face comparisons across 3 models

**Confidence**: High for invariance claims. Unknown for semantic meaning.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP034.md`, `v0.4.7/EXP034_TRANSFORMATION_INVARIANCE.json`.

---

## OQ-035: Why Do Feature Operations Cause Token Changes While Geometric Transformations Do Not?

**Status**: Open Question

**Evidence so far**: EXP-033 found that fillet/chamfer features cause token signature changes on unrelated faces (global model state effect). EXP-034 found that geometric transformations (scale, translation) do NOT cause token changes. This establishes that the EXP-033 effect cannot be explained simply by absolute scale or translation. The exact mechanism remains unknown.

**Hypothesis**: Feature operations affect some property of the model that is captured by Block1/Block2 tokens, while geometric transformations do not. The hypothesis that this property is topological is plausible but not established.

**Files tested**: C00, C01, C02, C03, C09

**Faces/models tested**: 24 faces across 5 models

**Confidence**: Medium. Pattern observed, but mechanism not fully understood.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP033.md`, `knowledge/evidence/2026-08-14_v0.4.7-EXP034.md`.

---

## OQ-036: Why Do Fillet/Chamfer Produce Global Token Changes While Shell and Holes Do Not?

**Status**: Open Question

**Evidence so far**: EXP-033 found that fillet/chamfer cause token changes on unrelated faces (+X/+Y). EXP-035 found that shell does NOT cause token changes on existing outer faces (5/5 IDENTICAL to C00). EXP-033 also found that holes do NOT cause token changes. This establishes that fillet/chamfer are unique in producing global token changes.

**Hypothesis**: Fillet/chamfer have some property that shell and holes lack, which causes Block1 tokens to change on unrelated faces. The hypothesis that this property is "external boundary modification" is NOT supported by EXP-035 (shell modifies external boundary but does not cause token changes). EXP-036 found that the distinguishing factor is adding a new face at an edge location.

**Files tested**: C00, C03, C04, C05, C09, C10, C11

**Faces/models tested**: 48 faces across 7 models

**Confidence**: Medium. Pattern observed (fillet/chamfer unique), but mechanism unknown.

**Date last updated**: 2026-08-14

**Related evidence**: `knowledge/evidence/2026-08-14_v0.4.7-EXP033.md`, `knowledge/evidence/2026-08-14_v0.4.7-EXP035.md`, `knowledge/evidence/2026-08-14_v0.4.7-EXP036.md`.

**CORRECTION NOTE (2026-08-14, Archivist Audit)**: EXP-036's own cross-model "added" statistic (used to argue holes/shell add 0 faces vs. fillet/chamfer's 1) is a measurement artifact, not a real count — see `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md` (Finding B). Holes and shell also add faces (C04 gains a cylindrical face; C10 gains 5 inner-wall faces, per EXP-035); the orientation-bucket algorithm in `exp036_feature_class_differential.js` silently drops them because their orientation collides with an existing C00 bucket. "Adds a face" is therefore not, by itself, the discriminator. The narrower "adding a new face at an edge [shared with a pre-existing face]" framing may still be correct, but it has not been directly measured (no edge/topology computation was performed) — it is currently a plausible domain-informed inference, not a tested result. Also unverified: whether the effect is specific to *which* edge is modified, since the corpus's fillet (C03) and chamfer (C09) appear to modify the same physical edge (both consistently change face index 2/3, i.e. +X/+Y) — see Finding E in the same audit file, and the confound analysis appended to `NEXT_QUESTIONS.md` NQ-027.

**UPDATE (2026-08-14, EXP-037)**: The "adding a new face at an edge shared with a pre-existing face" framing is no longer untested — a corrected, geometry-based correspondence + adjacency tool now directly confirms it for the one edge this corpus contains: the fillet/chamfer's new face genuinely shares an edge (≥2 coincident vertices) with the +X/+Y faces (and with the directly-modified +Z/-Z faces), and this real-adjacency set is exactly the token-changed set. Also newly confirmed by the same tool: the corrected "added" census reproduces EXP-027/EXP-035's independent ground truth exactly (C04 +1, C10 +5) with zero discrepancies, fully superseding EXP-036's broken statistic. What remains unverified is whether this is specific to *which* edge is modified — C03/C09 still only test one edge, and EXP-037 could not generate a second-edge model (the controlled-corpus SLDPRT files are absent from this environment). See `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` and NQ-028's updated status in `NEXT_QUESTIONS.md`.

**UPDATE (2026-08-15, EXP-038)**: The remaining "specific to which edge" gap is now closed for a second, independent edge. Using a real C12 model (supplied by the user, 1mm fillet on the -X/-Y edge, verified from its own STEP file), the effect reproduced exactly, mirrored: the changed-face set is {-X,-Y} in C12 vs. {+X,+Y} in C03, in both cases equal to that model's own real adjacency set for the new face. This is Strong Evidence (n=2 edges) that fillet/chamfer's distinguishing property from hole/shell is location-generalizable adjacency to a newly created face, not a fixed face/index/orientation artifact — though the underlying mechanism, and whether "adjacency" or "direct vertex modification" is the operative trigger, both remain open (they are indistinguishable for edge-type features in this corpus). See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md`.

**UPDATE (2026-08-16, EXP-039)**: "Direct vertex modification" is now the better-supported of the two candidate triggers specifically (not resolved for the co-occurring case, but no longer a coin-flip between the two): using shell/hole as controls where adjacency and modification separate, adjacency alone never causes a change (0/12) while modification, wherever it occurs, always does (11/11). This also means fillet/chamfer are not distinguished from hole/shell by "adjacency to a new face" as an independently causal property — they are distinguished by the fact that fillet/chamfer's edge trim directly perturbs two pre-existing faces' own vertices, which hole/shell's own genuinely-new faces (cylindrical wall, inner walls) do not do to any pre-existing face. See `knowledge/evidence/2026-08-16_v0.4.7-EXP039.md`.

**CORRECTION NOTE (2026-08-17, audit of EXP-037→EXP-040)**: "11/11" is wrong (correct: **14/14 known, 1 unknown** — the script never actually computed this figure; see `v0.4.7/EXP039_SUMMARY.md`'s correction note). More substantively for this entry: "adjacency alone never causes a change (0/12)" should not be read as a real test of adjacency-to-new-geometry specifically — every one of the 12 cases is adjacent only to a face that was already directly modified for other reasons (hole's/shell's own directly-modified faces), never to the genuinely new geometry (cylindrical wall / inner walls) itself. So this entry's claim that fillet/chamfer are distinguished from hole/shell by something other than "adjacency to a new face" is not actually tested here — no case in this corpus isolates that comparison. The distinguishing-property question remains as open as before this experiment.

**CORRECTION NOTE (2026-08-16, Audit + EXP-040)**: This question's title and framing ("...While Shell and Holes Do Not") remain correct — shell/hole genuinely do not change tokens on unrelated faces, independently established by EXP-035/033. What is corrected is a claim used to explain *why* fillet/chamfer differ from shell: EXP-037 had argued shell's new inner-wall faces ARE adjacent to unmodified outer walls (yet don't change them), positioned as a disanalogy limiting any adjacency-based explanation. That claim was a face-indexing error (see `FAILED_HYPOTHESES.md` FH-031's 2026-08-16 correction note and `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md`) — shell's new faces are, in fact, never real-adjacent to its unmodified outer walls at all. Shell is therefore consistent with, not a disanalogy against, an adjacency-based explanation of the fillet/chamfer effect; it just doesn't itself generate any new-face-adjacent-to-old-unmodified-face case to test the explanation with. The open "why" question this entry asks is unaffected — still unresolved — but one previously-cited piece of contrary evidence for it is withdrawn, and it is fully compatible with EXP-039's finding immediately above (EXP-039's own adjacency data for shell already reflected zero adjacency to outer walls, since it was computed fresh rather than taken from EXP-037's prose).


**UPDATE (2026-09-13, EXP-041)**: The premise of this question is now known to rest on a distinction the corrected tooling does not reproduce. EXP-040 already showed a single uniform rule across all four feature types once adjacency is measured with real vertex sharing rather than orientation labels (0 exceptions in either direction). EXP-041 recomputed the whole table from source across all 13 models, 12 pairs and 65 matched face correspondences — adding C06, C07, C08 and C11, which no prior experiment had analyzed for tokens or adjacency — and found the same: **17/17 faces adjacent to newly created geometry changed; 36/36 unmodified non-adjacent faces did not.** No feature-type-specific behaviour is visible. The apparent fillet/chamfer-vs-hole/shell split this question was named after is attributable to EXP-033's broken orientation-label adjacency test, not to the format.

The question that remains is **not** "why do fillet/chamfer differ from hole/shell" but the H1b-vs-H2 confound: every face adjacent to new geometry in this corpus also had its own vertices perturbed, so "adjacency to new geometry" and "non-similarity change to the face's own shape" cannot be separated. EXP-041 confirms the discriminating cell {vertices unchanged} × {adjacent to a new face} is **empty across the complete corpus** — 0 rows — so this is structural to the corpus, not an artifact of which subset had been examined. The `C13` split-line model (`v0.4.7/RESEARCH_DESIGN_next_experiment.md` §6) remains required and unbuilt. See `knowledge/evidence/2026-09-13_v0.4.7-EXP041.md` §5.

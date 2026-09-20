# Next Questions

> **2026-09-14 current-state correction — EXP-042–046:** Read [the v0.4.8 format report](../v0.4.8/README.md) before using the historical conclusions below. Block2 describes triangle strips, not CAD loops; Block1 annotates strip edges and links exactly to downstream edge IDs. The predecessor array is always present on the tested corpus. A third byte array and a forward metadata grammar are now recorded. `parser/v0.2` implements the verified read-only path. Old text is retained as evidence, not current guidance.

## NQ-030: Decode the optional scalar arrays and remaining surface records

**Status/date:** Open, 2026-09-14. EXP-045 reads the optional arrays and raw parameters but validates external geometry only for controlled planes/cylinders. Match appropriate independent surface exports before naming the arrays UV or naming remaining tag values. Evidence: [EXP-045](evidence/2026-09-14_v0.4.8-EXP045.md).

## NQ-031: Obtain a discriminating nonzero Block3 sample

**Status/date:** Open, 2026-09-14. All current payload bytes are zero. Try controlled visibility/edge-style changes only as candidate interventions; archive the real binaries and failed interventions too. No specific trigger is established. Evidence: [EXP-042](evidence/2026-09-14_v0.4.8-EXP042.md).

## NQ-032: Decode raw edge-type families and following object records

**Status/date:** Open, 2026-09-14. EXP-044/045 gives an ID bridge and raw 300x/480xx families. Establish curve-type/flag meaning against independent geometry, then parse the variable serialization following the edge table. Do not infer a universal packing formula from approximate numeric similarity.

## NQ-033: Validate container and body/configuration scoping

**Status/date:** Open, 2026-09-14. The new local grammar reuses the existing openswx decompressor. Directory-based discovery, CRC validation, duplicate stream/configuration policy and cross-body edge-ID namespaces remain unvalidated. This is distinct from the successful face-local grammar.

---

Historical queue follows; use the dated resolution notes and current handoff when prioritizing.

Operational research queue for the SLDPRT reverse-engineering project.

This is not the same as `OPEN_QUESTIONS.md`. Open questions describe broad unknowns. Next questions are concrete, experiment-driving questions that can be answered, falsified, or retired.

Each entry should include:

```text
Status:
Depends on:
If answered:
Will eliminate or constrain:
Evidence to archive:
Last updated:
```

Statuses:

- `Active`: current research priority.
- `Ready`: well-formed and ready to run.
- `Blocked`: requires missing tooling, data, or manual review.
- `Deferred`: valid, but not next in sequence.
- `Answered`: resolved by evidence; link experiment and conclusion.
- `Retired`: no longer useful because direction changed or premise failed.

---

## NQ-001: Can Block 1 Be Parsed By A Finite-State Grammar Over Observed Section Forms?

> **Correction, 2026-09-14 (EXP-042–046):** The corpus grammar is decoded as length-delimited strip-edge annotation sections; no inferred finite-state language is needed for these records. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Active

**Depends on**: EXP-006, EXP-007

**If answered**: Tests whether Block 1 can be described by observed section forms without assigning semantics to `VALUE` tokens.

**Will eliminate or constrain**: OQ-001, OQ-001A, OQ-002, OQ-004, OQ-010, OQ-011; ASM-003.

**Evidence to archive**: Segment token sequences by face, observed section forms, accepted/rejected form cases, per-file exception tables.

**Last updated**: 2026-06-27

---

## NQ-002: Do ONE-Delimited Block 1 Segment Lengths Correlate With Block 2 Loop Vertex Counts?

**Status**: Active

**Depends on**: EXP-004, EXP-006, EXP-007

**If answered**: Tests whether ONE-delimited segments are structurally paired with Block 2 loop entries beyond count equality.

**Will eliminate or constrain**: ASM-003, OQ-002, OQ-005 from branch-local notebook, OQ-010.

**Evidence to archive**: CSV/table with face id, vertex count, Block 2 decoded counts, ONE segment lengths, token-class histograms, mismatches.

**Last updated**: 2026-06-27

---

## NQ-002A: Does `len = 2 * loopSize - 2` Hold Across The Full Archived Corpus?

**Status**: Answered

**Depends on**: EXP-004, EXP-009, EXP-011

**Answer**: This formula has been verified as INV-017 (Verified Structural Invariant). For every ONE-delimited section, `sectionBodyTokenCount = Block2[i] - 1`, which is equivalent to `len = 2 * loopSize - 3`. Verified across 8,763/8,763 sections (100%) across 8 files by EXP-013, with independent reproduction by EXP-016.

**Note on INV-012 equivalence**: The original INV-012 formula `len = 2 * loopSize - 2` was found to be incorrect (off by +1). The correct equivalent is `len = 2 * loopSize - 3`. See INV-012 correction note for details.

**Evidence archive**: `knowledge/evidence/2026-06-27_v0.4.0-invariant-validation.md`, `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`, `knowledge/evidence/2026-07-10_v0.4.2a-independent-parser.md`

**Will eliminate or constrain**: OQ-001, OQ-001A, OQ-002, ASM-003.

**Evidence to archive**: Raw table with file name, face id, Block 2 loop size, observed Block 1 section length, formula result, and mismatch count.

**Last updated**: 2026-06-27

---

## NQ-003: Are SMALL Tokens In GEAR Structurally Localized?

**Status**: Ready

**Depends on**: EXP-006

**If answered**: Determines whether SMALL values are a rare grammar production, a file/model-specific feature, or an artifact of the token threshold.

**Will eliminate or constrain**: OQ-005, ASM-004.

**Evidence to archive**: List of faces containing SMALL tokens, token positions, surrounding token windows, section ids if available, face vertex counts, Block 2 loop counts.

**Last updated**: 2026-06-27

---

## NQ-004: Are `LARGE LARGE` Boundary Patterns A Distinct Block 1 Production?

**Status**: Ready

**Depends on**: EXP-006

**If answered**: Determines whether `LARGE LARGE` near segment/block boundaries is grammar, terminator-like structure, or incidental adjacency.

**Will eliminate or constrain**: OQ-003, OQ-004, OQ-010, ASM-004.

**Evidence to archive**: All `LARGE LARGE` occurrences by file/face/segment, boundary classification, preceding/following token windows, relation to Block 2 loop index.

**Last updated**: 2026-06-27

---

## NQ-004A: Can The Property-Table Falsification Evidence Be Reproduced And Archived?

**Status**: Active

**Depends on**: EXP-010, FH-013

**If answered**: Replaces today's handoff-only property-table falsification with reproducible project-wide evidence.

**Will eliminate or constrain**: OQ-003A, ASM-004, future VALUE hypotheses.

**Evidence to archive**: Raw script output for random-base controls, frequency-bias analysis, delimiter-artifact analysis, exact command/script, corpus size, files analyzed, and numeric results.

**Last updated**: 2026-06-27

---

## NQ-005: Can DisplayLists `[1,1]` Section Maps Be Completed For TOP And DEKOR?

**Status**: Ready

**Depends on**: EXP-008

**If answered**: Completes the current section-count corpus and tests whether BOTTOM/GEAR section behavior generalizes.

**Will eliminate or constrain**: OQ-008, ASM-005, INV-014 confidence level.

**Evidence to archive**: Section offsets, sizes, face counts per section, string/class-name hits, candidate marker counts, parsed face counts for TOP and DEKOR.

**Last updated**: 2026-06-27

---

## NQ-006: Can The Section-0 Contradiction Be Resolved By Byte-Level Re-Audit?

**Status**: Blocked

**Depends on**: EXP-008 raw section-map output, branch-local section audit scripts.

**If answered**: Resolves the documented inconsistency where one note says Section 0 has no face markers while another records GEAR Section 0 with 4 faces.

**Will eliminate or constrain**: INV-014, OQ-008, ASM-005.

**Evidence to archive**: Raw section map for BOTTOM and GEAR, exact Section 0 offset/range, face-marker offsets inside or outside Section 0.

**Last updated**: 2026-06-27

---

## NQ-007: Can R0/R1 Position-Normal Evidence Be Reproduced And Archived?

**Status**: Blocked

**Depends on**: Locating or recreating the R0/R1 comparison script/output.

**If answered**: Upgrades INV-003 from handoff-supported documentation to project-wide reproducible evidence.

**Will eliminate or constrain**: Any remaining ambiguity about position vs normal record interpretation.

**Evidence to archive**: Script name, input files, vector-length statistics, equality statistics, min/max component ranges, model/face counts.

**Last updated**: 2026-06-27

---

## NQ-009: Does Correcting The EXP-023/024 Block1->Block2 Offset Change Their Reported Results?

**Status**: Answered

**Depends on**: EXP-023, EXP-024, v0.4.4/FALSIFICATION_REVIEW.md, INV-005, EXP-018, EXP-021

**Answer**: Yes, substantially. The bug (EXP-023/024 read the Block1 header's constant first word, always `4`, and mislabeled it as the body length `N`, causing `block1Start + b1Word0*4` to always land on Block1's own body instead of Block2) was corrected using the already-established formula `block2Start = block1Start + (N+4)*4` with `N` read from `block1Start+12`. Results: (1) `secCount=0 for ALL 1,172 faces` is corrected -- at the right offset, Block2 header is valid for 1,172/1,172 faces and `secCount` matches an independent INV-009 cross-check 1,172/1,172. (2) `0 VALID candidates in EXP-024` is corrected -- 1,172/4,688 candidates are now VALID, exactly matching EXP-023's face count and resolving the previously unacknowledged contradiction between the two experiments. INV-016/017/018 all pass 100% under the corrected pipeline. (3) The `661/1,172 alternative-header correlation` is **unchanged** -- that detection logic never used the buggy offset. A new, exceptionless correlation was found between `secCount` and alternative-header presence/N-value (see OQ-018); this is recorded as an observation only, with no semantic meaning assigned.

**Evidence archive**: `v0.4.5/CORRECTION_NOTE.md`, `v0.4.5/SUMMARY.md`, `knowledge/evidence/2026-08-13_v0.4.5-EXP023-corrected.md`, `knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md`

**Will eliminate or constrain**: OQ-016 (answered), OQ-018 (new).

**Evidence to archive**: Corrected scripts, corrected raw JSON results, before/after comparison tables, root-cause analysis. (Complete -- see evidence archive above.)

**Last updated**: 2026-08-13

---

## NQ-010: Is The secCount / Alternative-Header Correlation (OQ-018) Exceptionless?

**Status**: Answered

**Depends on**: NQ-009, EXP-023-CORRECTED (v0.4.5), OQ-018

**Answer**: Yes, on the tested corpus. EXP-026 (v0.4.6) independently re-derived the 1,172-face set using the v0.4.5-corrected Block1/Block2 offset formula (not the buggy v0.4.4 arithmetic) and hunted for counterexamples in four directions: secCount=1 without an N=1 alternative; secCount=2 without an N=2 alternative; secCount>=3 with any alternative; alternative N inconsistent with secCount. Result: 0 counterexamples in all four directions, across all 1,172 faces and each of the 7 files individually. The correlation is recorded as INV-019 (Status: Correlation, not a proven causal or structural law). Causal direction and semantic meaning remain explicitly unresolved. The alternative-header detection window (N∈{1,2} at fixed offsets mp-20/mp-24) was not extended, and HEADPHONE (62 faces) was not tested (not present in this repository checkout) — both noted as known gaps, not resolved by this experiment.

**Evidence archive**: `v0.4.6/SUMMARY.md`, `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`, `knowledge/KNOWN_INVARIANTS.md` INV-019.

**Will eliminate or constrain**: OQ-018 (causal-direction question narrowed, not closed).

**Evidence to archive**: Corrected extraction script, raw per-face JSON, counterexample counts by direction and by file. (Complete — see evidence archive above.)

**Last updated**: 2026-08-13

---

## NQ-008: Can Normal-Gap Loop-Splitting Failure Be Reproduced And Archived?

**Status**: Deferred

**Depends on**: v0.3.0-v0.3.3 diagnostic scripts and representative files.

**If answered**: Strengthens FH-005 with raw evidence and exact corpus counts.

**Will eliminate or constrain**: Attempts to revive normal-discontinuity loop splitting without new evidence.

**Evidence to archive**: Diagnostic output showing false splits on strip diagonals, input files, face ids, threshold settings.

**Last updated**: 2026-06-27

---

## NQ-013: What Is the Exact VC-Diameter Relationship for Cylindrical Surfaces?

**Status**: Answered (relationship NOT linear)

**Depends on**: EXP-027, EXP-028

**Answer**: EXP-028 FALSIFIED the linear scaling hypothesis. C04 (5mm) vc=70, C05 (3mm) vc=56. Ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67. With only 2 data points, exact relationship cannot be determined. Need third diameter (e.g., 4mm) to fit power law vc = a * diameter^b.

**Will eliminate or constrain**: OQ-021 (hole geometry encoding). Linear scaling rejected.

**Evidence to archive**: `v0.4.7/EXP028_HOLE_DIAMETER.json`, `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`.

**Last updated**: 2026-08-14

---

## NQ-014: Is the DisplayList Re-Serialized on Any Face Change?

**Status**: Answered (YES, re-serialized)

**Depends on**: EXP-027, EXP-028

**Answer**: EXP-028 confirmed that binary diffs are dominated by inter-face metadata (50-80%). Face start offsets shift globally when faces are added/modified. The entire DL is re-serialized, not just affected faces.

**Will eliminate or constrain**: OQ-022 (feature locality). Incremental parsing not possible.

**Evidence to archive**: `v0.4.7/EXP028_FEATURE_LOCALIZATION.json`, `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`.

**Last updated**: 2026-08-14

---

## NQ-015: Do SLDPRT Vertices Correspond to Exact STEP/STL Vertices?

**Status**: Answered (NO, tessellated approximations)

**Depends on**: EXP-027, EXP-028

**Answer**: EXP-028 FALSIFIED exact correspondence. SLDPRT↔STEP exact matches: 3/24 (C00), 6/212 (C04), 4/60 (C03). Mean distance ~0.01mm. SLDPRT vertices are DisplayList tessellation, not exact B-rep vertices.

**Will eliminate or constrain**: OQ-023 (vertex semantics). Parser output cannot be directly compared to STEP geometry.

**Evidence to archive**: `v0.4.7/EXP028_VERTEX_CORRESPONDENCE.json`, `knowledge/evidence/2026-08-14_v0.4.7-EXP028.md`.

**Last updated**: 2026-08-14

---

## NQ-016: What Is the Chord-Error Tolerance for DisplayList Tessellation?

**Status**: Ready

**Depends on**: EXP-028

**If answered**: Determines the maximum distance from SLDPRT vertices to true B-rep surfaces.

**Will eliminate or constrain**: OQ-024 (tessellation parameters), provides validation tolerance for parser output.

**Evidence to archive**: Distance from SLDPRT vertices to STEP surfaces, chord error calculation, tolerance bounds.

**Last updated**: 2026-08-14

---

## NQ-017: Does a Third Diameter Data Point Confirm VC-Diameter Relationship?

**Status**: Ready

**Depends on**: EXP-028, new controlled model (C11 with 4mm hole)

**If answered**: Fits power law vc = a * diameter^b, distinguishes linear from non-linear relationships.

**Will eliminate or constrain**: OQ-021 (hole geometry encoding), provides exact vc prediction formula.

**Evidence to archive**: vc for 4mm hole, power law fit, R² value, residual analysis.

**Last updated**: 2026-08-14

---

## NQ-018: Do Block1 Tokens Change with Scale or Translation?

**Status**: Ready

**Depends on**: EXP-029, C01 (20mm cube), C02 (translated cube)

**If answered**: Determines if tokens encode face orientation or tessellation parameters.

**Will eliminate or constrain**: OQ-001 (Block 1 grammar), H5 (tessellation parameters), H6 (face orientation).

**Evidence to archive**: Token comparison between C00 (10mm) and C01 (20mm), C00 and C02 (translated).

**Last updated**: 2026-08-14

---

## NQ-019: What Do the Alternating Tokens (150, 153) in Cylindrical Faces Represent?

> **Correction, 2026-09-14 (EXP-042–046):** Answered by geometric edge mapping and downstream metadata. Values 150/153 label the two cylinder boundary curves in the corresponding controlled models. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Ready

**Depends on**: EXP-029

**If answered**: Determines if tokens encode tessellation angles or other parameters.

**Will eliminate or constrain**: H5 (tessellation parameters), OQ-003A (VALUE semantics).

**Evidence to archive**: Token analysis across multiple cylindrical faces, correlation with geometry.

**Last updated**: 2026-08-14

---

## NQ-020: Do Different Face Types Have Different Token Signatures?

**Status**: Ready

**Depends on**: EXP-030

**If answered**: Determines if token patterns can be used to classify face types (cube, cylindrical, fillet, etc.).

**Will eliminate or constrain**: OQ-001 (Block 1 grammar), H5 (tessellation parameters), OQ-003A (VALUE semantics).

**Evidence to archive**: Token comparison across face types (cube, cylindrical, fillet, chamfer), correlation with surface geometry.

**Last updated**: 2026-08-14

---

## NQ-021: Do Token Signatures Correlate with Face Orientation?

**Status**: Ready

**Depends on**: EXP-031

**If answered**: Determines if token signatures can be used to predict face orientation.

**Will eliminate or constrain**: OQ-001 (Block 1 grammar), H5 (tessellation parameters), OQ-026 (face orientation).

**Evidence to archive**: Token comparison across faces with different orientations, correlation with face coordinates.

**Last updated**: 2026-08-14

---

## NQ-022: Do Token Signatures Correlate with Model Type (Fillet/Chamfer/Hole)?

**Status**: Ready

**Depends on**: EXP-032

**If answered**: Determines if token signatures can be used to predict model type or feature type.

**Will eliminate or constrain**: OQ-001 (Block 1 grammar), H5 (tessellation parameters), OQ-028 (face orientation).

**Evidence to archive**: Token comparison across models with different features (fillet, chamfer, hole), correlation with model type.

**Last updated**: 2026-08-14

---

## NQ-023: What Global Model State Property Causes Signature Changes?

**Status**: Ready

**Depends on**: EXP-033

**If answered**: Determines what property is common to fillet/chamfer models but absent in hole models that causes token signature changes.

**Will eliminate or constrain**: OQ-032 (global model state mechanism), provides predictive model for signature changes.

**Evidence to archive**: Comparison of global model state properties across C00, C03, C09, C04; identification of distinguishing property; prediction test on new models.

**Last updated**: 2026-08-14

---

## NQ-024: Why Do -X/-Y Signatures Remain Unchanged While +X/+Y Change?

**Status**: Ready

**Depends on**: EXP-033

**If answered**: Determines the mechanism by which global model state affects some orientations but not others.

**Will eliminate or constrain**: OQ-032 (global model state mechanism), OQ-030 (C03/C09 signature differences).

**Evidence to archive**: Analysis of -X/-Y vs +X/+Y face properties, adjacency patterns, serialization order.

**Last updated**: 2026-08-14

---

## NQ-025: What Distinguishes Feature-Induced Changes from Geometric Transformations?

**Status**: Ready

**Depends on**: EXP-033, EXP-034

**If answered**: Determines why fillet/chamfer features cause token signature changes on unrelated faces, while scale/translation do not. Identifies the specific property that distinguishes feature-induced changes from geometric transformations.

**Will eliminate or constrain**: OQ-032 (global model state mechanism), OQ-033 (fillet/chamfer common property), provides predictive model for token signature changes.

**Evidence to archive**: Comparison of C00/C03/C09 (feature models) vs C00/C01/C02 (transformation models); identification of distinguishing property; analysis of topological changes vs geometric changes.

**Last updated**: 2026-08-14

---

## NQ-026: Why Do Fillet/Chamfer Produce Global Token Changes While Shell and Holes Do Not?

**Status**: Ready

**Depends on**: EXP-033, EXP-034, EXP-035

**If answered**: Determines the specific property that distinguishes fillet/chamfer from shell and holes. Identifies why fillet/chamfer cause token changes on unrelated faces while shell and holes do not.

**Will eliminate or constrain**: OQ-032 (global model state mechanism), OQ-033 (fillet/chamfer common property), OQ-035 (why feature operations cause token changes).

**Evidence to archive**: Comparison of C00/C03/C09 (fillet/chamfer) vs C00/C04/C05/C10/C11 (hole/shell); analysis of what fillet/chamfer have in common that shell/holes do not; analysis of external boundary modification hypothesis.

**Last updated**: 2026-08-14

---

## NQ-027: Why Does Adding a New Face at an Edge Cause Global Token Changes?

**Status**: Ready

**Depends on**: EXP-036

**If answered**: Determines the mechanism by which adding a new face at an edge location causes token changes on unrelated faces. Identifies what property of the added face causes the token changes.

**Will eliminate or constrain**: OQ-036 (why fillet/chamfer produce global token changes), OQ-032 (global model state mechanism), OQ-033 (fillet/chamfer common property).

**Evidence to archive**: Comparison of C03/C09 (which add a new face) vs C04/C05/C10/C11 (which do not); analysis of the added face's properties; analysis of token change patterns.

**Last updated**: 2026-08-14

**AUDIT NOTE (2026-08-14, Archivist Audit) — confound analysis before running any follow-up experiment:**

This question's premise ("adding a new face at an edge correlates with global token-signature changes") is plausible but not yet cleanly isolated from several confounds present in the current corpus. Full detail in `knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md`.

1. **"Adds a face" is not the discriminator.** EXP-036's own "added" metric (0 for holes/shell) is a measurement artifact of an orientation-bucket-collision bug in `exp036_feature_class_differential.js` — holes and shell also add faces (C04: +1 cylindrical face; C10: +5 inner walls, per EXP-035), the script just fails to detect them. So all four feature types tested (fillet, chamfer, hole, shell) add at least one face; "adding a face" per se cannot be what separates the two groups.
2. **"At an edge" has not been directly measured.** No script in EXP-027–036 computes real topological adjacency (shared edges/vertices) between the new face and existing faces. EXP-033's `isAdjacentToModified()` uses a same-orientation-label heuristic that cannot detect true adjacency on this corpus (Finding A in the audit file) — its "FALSIFIED" adjacency conclusion should be treated as untested, not as ruling adjacency out. "Adding a face at an edge" is currently a plausible domain-informed inference (fillet/chamfer are CAD edge features by definition) rather than a measured discriminator.
3. **Single edge location tested.** C03 (fillet) and C09 (chamfer) both consistently change face index 2/3 (+X/+Y) — see EXP-033 §4.3. No evidence in the archive shows the fillet and chamfer were applied to *different* edges of the cube. If both were applied to the same edge, the corpus has tested one edge-feature location with two feature types, not multiple independent locations, and cannot distinguish "faces adjacent to *the* modified edge change" from "faces at index 2/3 change whenever any edge-type feature is applied, regardless of which edge."
4. **Confounded variables not yet separated**, per the task's own list: feature type (edge feature vs. cut/hole feature) is perfectly confounded with "adds a face touching a pre-existing edge" in this corpus, because SolidWorks has no edge-modifying feature that doesn't also add a face, and no non-edge feature in the corpus that adds a face touching a pre-existing edge. Face ordering/serialization order is not ruled out either (face index happens to be identical across all compared models, so index-based and adjacency-based explanations remain indistinguishable with the current data).

**Recommendation**: NQ-027 is a reasonable next research direction in principle, but should not be pursued via a repeat of EXP-036's methodology. See NQ-028 for the smallest experiment that would discriminate "location-specific/adjacency-based" from "feature-type/global-state-based" explanations. Do not promote H8 ("adding a new face at an edge") beyond Hypothesis status until that test (or an equivalent one) is run.

**UPDATE (2026-08-15, EXP-037/EXP-038)**: Confounds (2) and (3) above are resolved. (2) "At an edge" is now directly measured via real vertex/edge-sharing adjacency (`computeAdjacency()`, EXP-037/038) rather than inferred — confirmed true for both tested edges. (3) A second edge location was tested (EXP-038, using a real C12 model supplied by the user): the changed-face set relocated to track the new edge, ruling out the "always faces 2/3 regardless of edge" alternative. Confound (1) ("adds a face" is not the discriminator — all four feature types add a face) remains valid and untouched by EXP-037/038. Confound (4) (WHY adjacency/direct-modification triggers a token change, and whether "real adjacency" vs. "this face's own vertices were directly modified" can be separated) remains open — see `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md` Section 7. NQ-027's core "why" question is therefore still open, but with two of its four original confounds removed and Hypothesis H8 upgraded from Hypothesis to Strong Evidence (not Verified) for the location/adjacency-based framing specifically.

---

## NQ-028: Does Fillet/Chamfer Applied to a Different Edge Move the Affected Faces? (Smallest Discriminating Test for NQ-027)

**Status**: **Answered 2026-08-15 (EXP-038)**, for the two edge locations tested. A real C12 model (1mm fillet, edge shared by -X/-Y, verified from its own STEP file) was supplied by the user and compared against C00/C03 using EXP-037's tooling (with a validated bounding-box-center correspondence refinement). Result: the Block1 token-changed face set relocated from {+X,+Y} (C03) to {-X,-Y} (C12) — exactly the two faces bordering the new fillet edge, matching each model's own real (vertex-computed) adjacency set, and structurally unmodified in both cases. Face index also changed ({2,3}→{0,1}). **Verdict: Strong Evidence for the location/adjacency-based explanation (a) below, and Hypothesis B / (b) as literally stated is falsified** — not Verified/invariant (n=2 edges; mechanism and the adjacency-vs-direct-modification confound remain open). See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md`. No further experiment was begun after EXP-038, per instruction.

Status history: Blocked — attempted 2026-08-14 (EXP-037), core question NOT answered at that time. The controlled-corpus SLDPRT files were absent from this repository/environment entirely, and the archived JSON corpus contained exactly one fillet model (C03) and one chamfer model (C09), both confirmed (independently, by face-index tables in EXP-033 §4.3 and by EXP-037's own vertex-based adjacency computation) to modify the same physical edge. A new model was required; see `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §6 for the exact specification (base = C00, 1mm fillet or chamfer on the edge shared by -X/-Y, suggested name `C12_cube_fillet_1mm_edge2`) — this is exactly the model the user supplied for EXP-038. EXP-037 built and validated the analysis tooling this question needed (`v0.4.7/exp037_edge_location_and_adjacency.js`: real vertex/edge-sharing adjacency, centroid-distance face correspondence); EXP-038 reused it with one measured refinement (bounding-box center) required once tested against the real C12 file.

**Depends on**: EXP-033, EXP-036, EXP-037, EXP-038, and the confound analysis in NQ-027 above.

**Answer** (EXP-038, 2026-08-15): (a) **location/adjacency-based** is supported by the evidence: for both tested edges, the specific faces that change are exactly the ones topologically adjacent (real, vertex-computed adjacency, not orientation label) to the edge actually modified, and this relocates correctly when the edge moves. (b) **feature-type/global-state-based, as literally stated** ("the same faces, index 2/3 or +X/+Y, change... independent of which edge") is falsified: C12 changes indices {0,1} / orientations {-X,-Y}, not {2,3} / {+X,+Y}. This is Strong Evidence, not a Verified invariant — n=2 edges, both vertical, both on the same cube; the mechanism is unknown; and "real topological adjacency" vs. "this face's own vertices were directly, if minutely, modified by the trim" remain confounded for edge-type features in this corpus (both point to the identical face set by construction). See `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md` Section 7 for the full anti-overclaim discussion.

**Historical text below retained for continuity (proposed method, written before EXP-038 executed it):**

**If answered**: Directly discriminates two competing explanations for the EXP-033/036 "global token change" effect: (a) **location/adjacency-based** — the specific faces that change are always the ones topologically adjacent to whichever edge was actually modified; vs. (b) **feature-type/global-state-based** — the same faces (index 2/3, +X/+Y) change whenever *any* edge-type feature (fillet/chamfer) is applied anywhere on the model, independent of which edge. The current corpus cannot distinguish these because only one edge (the one between +X and +Y) has ever been filleted/chamfered.

**Proposed method** (generation not executed by EXP-037 — analysis tooling built and validated there, 2026-08-14; model supplied by the user and executed as EXP-038, 2026-08-15): Generate one additional controlled model — the same C00 base cube with a 1mm fillet (or chamfer) applied to a *different* edge, e.g. the edge shared by -X and -Y (or by +X and -Y), rather than the +X/+Y edge used by C03/C09. Parse it with the validated pipeline (or, for consistency with EXP-037, extract full per-face vertex arrays the way `vertex_analysis.js` does), and run `v0.4.7/exp037_edge_location_and_adjacency.js`'s `analyzePair`/`computeAdjacency`/`matchFaces` against a new `C00_cube_10mm_vs_C12_...` pair to check which faces' Block1 token signatures change relative to C00, and whether the real (vertex-computed) adjacency set moves with the new edge.
- If the changed faces are now -X/-Y (i.e., track the new edge location) → supports the location/adjacency-based explanation. **This is what happened** — see Answer above.
- If the changed faces are still +X/+Y (i.e., independent of which edge was modified) → falsifies the adjacency-based explanation and supports a feature-type or global-serialization-counter explanation instead (e.g., "the first edge-type feature in the tree always perturbs faces 2/3" or a monotonically-incrementing internal ID unrelated to geometric location).

Either outcome is a clean falsification of one branch, making this the highest information-gain single experiment available for NQ-027. It requires generating exactly one new SLDPRT file (not currently in the archived corpus) — no new tooling.

**Will eliminate or constrain**: NQ-027, OQ-032, OQ-033, OQ-036. (See those entries for updates reflecting EXP-038's answer.)

**Evidence to archive**: New model's Block1 token signatures by orientation, side-by-side with C00/C03/C09; explicit statement of which edge was modified; face index/orientation table matching EXP-033 §4.3's format. **Archived**: `knowledge/evidence/2026-08-15_v0.4.7-EXP038.md`, `v0.4.7/EXP038_RESULTS.json`, `v0.4.7/EXP038_SUMMARY.md`.

**Last updated**: 2026-08-15 (answered by EXP-038; originally added 2026-08-14 by Archivist Audit)

---

## NQ-029: Is Adjacency-Without-Modification Ever Sufficient, and Can a Model Fully Isolate It From Direct Modification?

> **Correction, 2026-09-14 (EXP-042–046):** C13 is no longer a prerequisite for parsing B1/B2. Its causal/persistent-ID question is distinct from the now-established format mapping; keep it as optional future input. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Partially Answered (EXP-039); fully isolating the co-occurring case is Blocked (requires a new SolidWorks model, design-stage only)

**Depends on**: EXP-037, EXP-038, EXP-039

**Answer (partial, EXP-039, 2026-08-16)**: Using shell (C10) and hole (C04) as controls where real adjacency and direct vertex modification come apart (unlike fillet/chamfer/C12, where they always co-occur), adjacency to changed/added geometry WITHOUT the face's own vertices moving never causes a token change: 0/12 across fillet, chamfer, hole, and shell, extending EXP-037's single qualitative shell observation to a quantified, multi-feature-type result. This makes direct modification the parsimonious explanation for every case tested (11/11 modified faces changed token, 0 counterexamples).

**What remains unanswered**: the complementary cell — direct modification WITHOUT any adjacency to new/changed geometry — has zero examples in this corpus, and EXP-039 argues (topologically) that no feature which creates a new face by editing an existing face's boundary loop can produce one: gaining a shared boundary with a new face is itself a boundary change for the neighbor, so "adjacent to new face" and "directly modified" are coextensive for that class of feature by construction. Testing modification-in-total-isolation from adjacency would need a fundamentally different mechanism.

**Proposed model** (`C14`, design-stage only, NOT built, NOT verified against real SolidWorks behavior): same `C00_cube_10mm` base, with a Split Line (or equivalent projected-curve/sketch-split feature) bisecting the +Z face into two coplanar rectangular halves (e.g. a line at `x=0.005`, spanning `y=0` to `y=0.01`, projected onto +Z). Predicted (unverified) effect: adds one new internal edge and two new vertices to +Z, splitting it into two new faces, without moving any of +Z's four original corner vertices and without touching any of the four side walls' own vertices at all. If the four side walls remain token-unchanged despite each now bordering one of the two new half-faces instead of the single original +Z face, that extends EXP-039's finding to a case with zero vertex perturbation anywhere near the new boundary. If their tokens DO change, that is the first case where pure new-face adjacency (with provably zero modification) causes a change, overturning EXP-039's interpretation. See `knowledge/RESEARCH_HANDOFF.md` "Possible Future Directions" for the same spec.

**Will eliminate or constrain**: OQ-032, OQ-033, OQ-036, Current Unknown #5 in `RESEARCH_HANDOFF.md`.

**Evidence to archive**: C14's Block1 tokens for the four side walls, before/after comparison against C00, real vertex-coordinate identity check for the side walls (expect: 100% identical), real adjacency check between each side wall and the two new split-half faces (expect: newly adjacent, 0 shared vertices with old +Z beyond the unchanged corners).

**Last updated**: 2026-08-16

**CORRECTION NOTE (2026-08-17, audit of EXP-037→EXP-040)**: The "0/12 ... 11/11" answer above needs two corrections. (1) "11/11" is wrong — `EXP039_DIRECT_MODIFICATION_NECESSITY.json` never computed it (its `rows` array excludes every directly-modified face by construction); recomputed directly from `EXP037_RESULTS.json`/`EXP038_RESULTS.json`, the real figure is **14/14 known cases (1 unknown)**. (2) More importantly for this question specifically: re-checking which faces make up the 12 "adjacent" cases against `EXP037_RESULTS.json`'s own `added[].adjacentToModelFaces` data shows every one of them is adjacent only to an already-*directly-modified* neighbor (hole's -X/-Y/+X/+Y are adjacent to the hole's own modified +Z/-Z, not to the new cylindrical face; shell's four "adjacent" faces are adjacent to the shell's own modified opening, not to any of the five new inner walls; fillet/chamfer's -X/-Y are adjacent to +Y/+Z/-Z, not to the new face). **None of the 12 cases actually test "adjacent to newly-created geometry without modification" — they test "adjacent to a directly-modified neighbor without modification," which is a different, weaker claim.** This means NQ-029's title question ("Is Adjacency-Without-Modification Ever Sufficient?") is not actually answered even partially by the existing corpus — the confound this question was meant to test around is universal across all four feature types tested here, not specific to edge-type features as EXP-038 originally scoped it. The `C14` proposal below is unaffected by this correction and remains the way to actually test the question — if anything, this correction strengthens the case for it, since no existing model in this corpus can substitute. Full derivation: `v0.4.7/EXP039_SUMMARY.md`'s matching correction note. No new experiment was run to produce this note.

**UPDATE (2026-09-13, EXP-041)**: The controlled-corpus SLDPRT files for C00–C11 were committed (`d0c6c54`), so this question can now be attacked with real binaries instead of archived JSON for the first time. It was, and **the answer is unchanged: still unanswered, and now demonstrably unanswerable within this corpus.** EXP-041 recomputed the full cross-tabulation from source across all 13 models, 12 pairs and 65 matched face correspondences — including C06, C07, C08 and C11, which no prior experiment had analyzed for tokens or adjacency at all. The discriminating cell {vertices unchanged} × {adjacent to a newly created face} contains **0 rows**. The 2026-08-17 correction above established this over five feature models; it now holds over the complete corpus. **The five newly supplied models do not break the confound and cannot** — no feature in this corpus's vocabulary creates a new face without perturbing its neighbour's own vertices. The `C13` split-line model specified in `v0.4.7/RESEARCH_DESIGN_next_experiment.md` §6 (called `C14` in the proposal below) remains **required and unbuilt**; it is now the single highest-value missing input in the project, and the case for it is strictly stronger than before, since the corpus expansion that might have substituted for it has been tried and did not. See `knowledge/evidence/2026-09-13_v0.4.7-EXP041.md` §5 and `v0.4.7/EXP041_SUMMARY.md` §5.

---

## NQ-030: Controlled models covering surface tags beyond plane and cylinder

**Status**: Open. Requires new models from the user; no analysis can substitute.

**Why**: The controlled corpus C00–C12 exercises only **tag-4001 (plane)** and **tag-4002 (cylinder)** — cubes, through-holes, fillets, chamfers and a shell produce nothing else (per-model tags verified from `EXP045_RESULTS.json`, 2026-09-15). Every other surface tag is validated only against complex production models with no analytic ground truth and no controlled single-variable structure:

| tag | occurrences | models containing it |
|---|---|---|
| 4003 | 47 | distributor (17), Pocket Wheel (20), USB hub BOTTOM (8), Helical Bevel Gear (2) |
| 4005 | 35 | Pocket Wheel (26), USB hub TOP (7), distributor (1), Helical Bevel Gear (1) |
| 4006 | 42 | Helical Bevel Gear (32), Dekor (8), USB hub TOP (2) |
| 4007 | 33 | Pocket Wheel (32), USB hub TOP (1) |
| 4009 | 311 | Dekor (311) |

Consequences already visible: EXP-047/048 had to validate cone metadata against production models; EXP-050 resolved their open thread but only for tag-4003; and tags 4005/4006/4007/4009 have **no external validation at all** — only `4001` and `4002` have been checked against independently exported STEP geometry (EXP-045, 94/94 controlled faces).

**What would close it** — controlled models in the C-series style (one primitive each, built in SolidWorks 2022, exported as `model.SLDPRT` + `model.step` + `model.STL`, volume-verified at build time):

- **C13_cone** — a simple revolved or lofted cone of known half-angle and base radius (exercises tag-4003 with analytic ground truth, which no current controlled model provides).
- **C14_torus** — a revolved circular profile (a likely candidate for one of 4005/4006).
- **C15_sphere** — a revolved semicircle.
- **C16_spline_surface** — a lofted or swept surface over a known spline (a likely candidate for 4009, which currently occurs *only* in Dekor).
- **C17_cube_splitline** — the Split Line model specified in `v0.4.7/RESEARCH_DESIGN_next_experiment.md` §6, still unbuilt and still the only construction that populates the empty adjacency/modification cell (see NQ-029).

Each should be a single feature on a known base so the surface parameters are analytically predictable, matching how C00–C12 were built.

**Blocking**: no SolidWorks access exists from this environment; these must be supplied the same way C12 and C00–C11 were.

**Date raised**: 2026-09-15 (EXP-050).

---

## NQ-031: Can curved faces be exported as analytic STEP surfaces rather than facets?

**Raised by**: EXP-053 (`converter/v0.1`).

`converter/v0.1` emits analytic `PLANE` surfaces for tag-4001 faces and facets everything else.
The blocker is *not* the surface definitions — cylinders and cones carry axis point, direction
and radius, validated against independently exported STEP in EXP-045 (94/94 controlled faces)
and EXP-048 (8/8 USB hub cone records). C04's cylinder, for instance, gives axis base
`(0.005, 0.005, 0)`, direction `(0,0,1)`, radius `0.0025` — a complete `CYLINDRICAL_SURFACE`.

The blocker is the **trim curves**. A cylindrical face's boundary is a circle, but the stored
boundary cycle is a polygon (34 segments on C04's hole). Emitting `CYLINDRICAL_SURFACE` trimmed
by a 34-gon would be worse than faceting: it claims an exact surface while bounding it with an
inexact curve.

**Measured immediately, 2026-09-20, and the answer is "not yet".** Radial residual of tag-4002
boundary-cycle vertices against the stored radius:

| corpus | 4002 faces | vertices | worst residual | worse than 1e-5 mm |
|---|---|---|---|---|
| controlled C00–C12 | 10 | 538 | **6.05e-7 mm** | 0 |
| full corpus (24 files) | 276 | 9,669 | **1.20e-1 mm** | **1,518** |

On the controlled corpus the boundary vertices *are* on the cylinder — worst residual 6e-7 mm,
at float32 noise for these dimensions (~1.2e-7 mm at a 2.5 mm radius), mean below 4e-7 mm on
every face. Taken alone that would say circles are directly fittable and analytic export is
straightforward.

It does not generalise. Across the full corpus 1,518 of 9,669 boundary vertices lie more than
1e-5 mm off the stored radius, the worst by 0.12 mm in Pocket Wheel — five orders of magnitude
beyond float32 noise. Those vertices are not on the cylinder at all. This is the EXP-050
situation generalised: some boundary-cycle vertices are interpolated or chord points rather than
surface samples, and the controlled corpus's simple full-circle through-holes happen to avoid
the case entirely.

**So the caution was right and the controlled corpus is not sufficient to settle this.** Building
`CYLINDRICAL_SURFACE` export on the controlled-corpus result would produce exact output for
cubes with holes and silently wrong trim curves on real parts.

**What would settle it**: characterise *which* boundary vertices deviate. Candidate
explanations to separate — (a) the cycle includes vertices belonging to an adjoining face rather
than the cylinder, (b) the face is a partial or trimmed cylinder whose boundary is not a circle,
(c) the stored radius applies to a different portion of a compound face. The per-vertex data
needed is already in `parser/v0.2` output; no new models are required. Worth also checking
whether the deviating vertices correlate with the `edgeIds` on the cycle, since a cycle mixing
two edge IDs is a hint for (a).

**Not blocked on new models** — the existing corpus has 276 tag-4002 faces with parameters.

**Date raised**: 2026-09-20 (EXP-053). **Measured same day**; left open.

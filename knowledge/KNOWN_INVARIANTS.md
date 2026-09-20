# Known Invariants

> **2026-09-14 current-state correction — EXP-042–046:** Read [the v0.4.8 format report](../v0.4.8/README.md) before using the historical conclusions below. Block2 describes triangle strips, not CAD loops; Block1 annotates strip edges and links exactly to downstream edge IDs. The predecessor array is always present on the tested corpus. A third byte array and a forward metadata grammar are now recorded. `parser/v0.2` implements the verified read-only path. Old text is retained as evidence, not current guidance.

## INV-020: Explicit Strip-Length Precursor and Triangle Ordering

> **Corroboration, 2026-09-15 (EXP-049):** Replicated through a different face-discovery path (`parser/v0.1`'s gap-marker scan rather than the forward precursor scan): same 21 files, 1,272 faces, 10,095 strips, 71,166 vertices, 50,976 triangles, all 50,976 agreeing with stored normals. The openswx decompressor is shared, so pipeline independence is partial. Status and scope unchanged. Evidence: [EXP-049](evidence/2026-09-15_v0.4.8-EXP049.md).

**Status:** Verified on the supplied modern corpus; not a universal file-version claim.
**Evidence:** `[4,8,2,S] + u32[S]` directly precedes the position array. Its entries sum to V and satisfy `B2[i]=2*L[i]-2`. Alternating triangle-strip winding produces 50,976 triangles, all agreeing with stored normals. The controlled fan alternative fails; the simple cubes and shell agree with original STL triangles at the documented comparison tolerance.
**Files/counts:** All 21 decoded modern files under `test files original`, 1,272 faces; three OLE2 inputs unsupported. Exact input list/hashes in raw output.
**Confidence/date:** High within corpus, 2026-09-14.
**Sources:** [EXP-042](evidence/2026-09-14_v0.4.8-EXP042.md), [EXP-043](evidence/2026-09-14_v0.4.8-EXP043.md). Header recognition is part of candidate selection; arithmetic, geometry and external comparisons are separate checks.

## INV-021: Block1 Strip-Edge Annotations

> **Corroboration, 2026-09-15 (EXP-049):** Independently replicated (112,047 tokens; 41,010 nonzero on face-boundary edges, 71,037 zero on face-interior edges, 0 exceptions either way), with the edge ordering derived independently before this write-up was readable. **New control:** shuffling the edge order within each strip, holding tokens and incidence fixed, yields 44,640 exceptions versus 0 — so the specific ordering is load-bearing and the partition is not an artifact of the classification. Status and scope unchanged. Evidence: [EXP-049](evidence/2026-09-15_v0.4.8-EXP049.md).

**Status:** Verified correspondence on the supplied corpus.
**Evidence:** Each section contains leading control `1`, then `ID(0,1)`, followed by `ID(i-2,i), ID(i-1,i)` for each new vertex i. All 41,010 boundary annotations are nonzero; all 71,037 internal annotations are zero. All nonzero label sets match independently reached downstream metadata. No conflict for geometrically shared edge segments.
**Files/counts:** Same 21 modern files / 1,272 faces; 10,095 strips, with all per-face measurements archived.
**Confidence/date:** High, 2026-09-14. Label allocation, persistence across arbitrary edits, and control-word enum remain unknown; numeric `1` is not assumed globally forbidden as an ID.
**Sources:** [EXP-043](evidence/2026-09-14_v0.4.8-EXP043.md), [EXP-045](evidence/2026-09-14_v0.4.8-EXP045.md).

## INV-022: Block3 Byte-Array Layout

> **Corroboration, 2026-09-15 (EXP-049):** Replicated from offsets computed independently of v0.4.8 (`parser/v0.1`'s `block2Start` + `secCount`; v0.1 never reads Block3): 1,272/1,272 valid `[1,8,2,N]` headers, 0 malformed, N equal to the Block1 word count on all faces, 122,142 payload bytes, 0 nonzero. The caution against inferring meaning from constant data stands. Evidence: [EXP-049](evidence/2026-09-15_v0.4.8-EXP049.md).

**Status:** Verified syntax; semantics unknown.
**Evidence:** `[1,8,2,N]` directly follows Block2; payload is N bytes, where N is Block1's word count. All 122,142 observed payload bytes are zero.
**Files/counts:** 21 modern files / 1,272 faces.
**Confidence/date:** High for observed shape/count; no semantic confidence, 2026-09-14.
**Source:** [EXP-042](evidence/2026-09-14_v0.4.8-EXP042.md). Do not infer flag meanings from constant data.

## INV-023: Forward Metadata Edge-ID Link

**Status:** Verified local grammar and ID correspondence, not full metadata semantics.
**Evidence:** The forward sequence documented in the v0.4.8 report reaches a surface record and counted edge-ID/type pairs on all 1,272 faces; ID sets equal the nonzero Block1 sets. Optional scalar arrays on 390 faces each have one scalar per serialized vertex. All 94 controlled face records agree with independently exported STEP on tested plane/cylinder properties.
**Files/counts:** 21 modern files / 1,272 faces; STEP check uses 13 controlled models / 94 faces.
**Confidence/date:** High within scope, 2026-09-14. Opaque prefix, other surface tags, and optional-array purpose remain unknown.
**Source:** [EXP-045](evidence/2026-09-14_v0.4.8-EXP045.md); [byte map](../v0.4.8/README.md).

## INV-024: Display Boundary Cycles and Two-Face Edge-ID Ownership

**Status:** Verified topology of the supplied display data; not exact B-rep coedge reconstruction.
**Evidence:** Exact-coordinate boundary graphs have degree two everywhere, producing 1,698 cycles on 1,272 faces. All 3,278 file-scoped edge-ID groups have two face owners. Paired sampling is identical for 2,889 groups and differs for 389; no welding is performed.
**Files/counts:** 21 modern files / 1,272 faces.
**Confidence/date:** High within corpus, 2026-09-14. No universal multi-body ID namespace, outer/hole orientation, or watertight-export claim.
**Source:** [EXP-046](evidence/2026-09-14_v0.4.8-EXP046.md).

---

The entries below are historical; their dated corrections take precedence over the original semantic names.

Project-wide SLDPRT reverse-engineering knowledge. These entries are version-independent unless the files tested say otherwise.

Source migrated from `v0.3.5/docs/research/KNOWN_INVARIANTS.md` and related experiment notes.

**Corpus note (2026-06-27)**: The documented corpus count is 595 faces across 4 models. The v0.4.0 parser validates 593 of 595 faces (DEKOR 373/375). The 2-face discrepancy is under investigation. See EXP-011 and `knowledge/evidence/2026-06-27_v0.4.0-invariant-validation.md`.

---

## INV-001: Modern Geometry Is In `Contents/DisplayLists`

**Status**: Verified Conclusion

**Evidence**: Modern test files expose readable face geometry in the main `Contents/DisplayLists` stream. Other readable streams examined contain metadata, configuration, feature, preview, or third-party data. `Contents/Config-0-Partition` remains unreadable/high entropy in current tooling.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 4 models, 595 parsed faces for DisplayLists face layout checks.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-008

---

## INV-002: Face Block Layout

> **Correction, 2026-09-14 (EXP-042–046):** The old `edgeCount` name and start diagram are superseded. The position header is [12,100,2,V]; its preceding word is the last precursor strip length. Positions and normals remain valid. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Verified Conclusion

**Evidence**: Parsed face blocks follow this layout:

```text
+0000  u32 edgeCount
+0004  u32 100
+0008  u32 2
+000c  u32 vertexCount
+0010  float32[vertexCount * 3] positions
+....  u32[4] gap marker: [12, 100, 2, vertexCount]
+....  float32[vertexCount * 3] normals
+....  Block 1 header/body
+....  Block 2 header/body
```

Forensic byte-offset dumps of simple and complex gear faces support the layout, and aggregate parsers validate it across the current corpus.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-002, EXP-005

---

### v0.4.3 VALIDATION NOTE (2026-07-16)

**INV-002 layout validated by EXP-018 and EXP-019:**

- EXP-018: 1,234/1,234 genuine faces match the layout exactly
- EXP-019: Only H1 (normals are unit vectors, max deviation = 4.14e-8) is a genuine test
  - H2 "no extra bytes between normals and B1" is a **tautology** — tests same variable
  - H3 "gap is always 16 bytes" is a **tautology** — normalsStart defined as gapStart + 16
  - H5 "block ordering is always correct" is a **tautology** — guaranteed by offset definitions
- Alternative `[4,8,2,N]` patterns found in 332 non-B2 positions (not 525 as originally reported)
- **N=2 body[0] = prev_edgeCount claim FALSIFIED** (EXP-021 critical review): 292/299 cross-face checks fail (97.7%)
- The `[4,8,2,N]` container semantics are unknown for both N=1 and N=2 cases

**Raw evidence:** `knowledge/evidence/2026-07-16_v0.4.3-EXP018.md`, `knowledge/evidence/2026-07-16_v0.4.3-EXP019.md`, `knowledge/evidence/2026-07-16_v0.4.3-EXP021.md`, `v0.4.4/FALSIFICATION_REVIEW.md`

---

## INV-003: Position Records And Normal Records Are Distinct

**Status**: Verified Conclusion

**Evidence**: R0 records contain position floats. R1 records contain unit-length vectors constrained to `[-1, 1]`. Tests found 0% direct float equality between R0 and R1 and 100% unit-vector behavior for R1.

**Files tested**: Current modern corpus represented by BOTTOM, TOP, GEAR, and DEKOR analysis.

**Faces/models tested**: Hundreds of faces; exact face count recorded in branch notebook as part of the 595-face corpus.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: Branch-local R0/R1 comparison report; project-wide raw evidence still needs preservation.

---

## INV-004: Gap Marker Between Positions And Normals

**Status**: Verified Conclusion

**Evidence**: The 16-byte separator between position data and normal data is always:

```text
u32[4] = [12, 100, 2, vertexCount]
```

This marker is also the byte pattern used by earlier scanners to locate candidate face blocks.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models, with forensic byte dumps on selected gear faces.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-001, EXP-005

---

## INV-005: Block 1 Header Shape

**Status**: Verified Conclusion

**Evidence**: Block 1 starts with:

```text
u32[0] = 4
u32[1] = 8
u32[2] = 2
u32[3] = N
```

`N` is the number of `u32` values in the Block 1 body. Total Block 1 byte size is `(N + 4) * 4`.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-002

---

## INV-006: Block 2 Header Shape

**Status**: Verified Conclusion

**Evidence**: Block 2 starts with:

```text
u32[0] = 4
u32[1] = 8
u32[2] = 2
u32[3] = M
```

`M` is the number of `u32` values in the Block 2 body. Total Block 2 byte size is `(M + 4) * 4`.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-002

---

## INV-007: Block 2 Encodes Loop Vertex Counts

> **Correction, 2026-09-14 (EXP-042–046):** The formula remains correct but yields strip vertex counts, not boundary-loop sizes. See INV-020/024 and EXP-042/046. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Verified Conclusion

**Evidence**: For every Block 2 body entry:

```text
vertexCountPerLoop = (raw + 2) / 2
```

The decoded loop vertex counts sum exactly to the face `vertexCount`.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: BOTTOM 39/39 faces, TOP 68/68, GEAR 113/113, DEKOR 375/375. Total 595/595.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-002, EXP-004

---

## INV-008: Block 1 Starts With ONE

**Status**: Verified Conclusion

**Evidence**: Position 0 of every Block 1 body is value `1`.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595/595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-006, EXP-007

---

## INV-009: Block 1 ONE Count Equals Block 2 Entry Count

**Status**: Verified Conclusion

**Evidence**: Count of value `1` in Block 1 body equals Block 2 body entry count for every tested face.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: BOTTOM 39/39, TOP 68/68, GEAR 113/113, DEKOR 375/375. Total 595/595.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-006, EXP-007

---

## INV-010: Block 1 ONE Values Are Singleton Runs

**Status**: Verified Conclusion

**Evidence**: Run-length analysis found no consecutive `1` values in Block 1 bodies. Every ONE run has length exactly 1.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High

**Date last updated**: 2026-06-27

**Related experiments**: EXP-006

---

## INV-011: Block 1 Token Classes

**Status**: Observation

**Evidence**: Current classification divides Block 1 body values into:

```text
ZERO  = value 0
ONE   = value 1
VALUE = any integer other than 0 or 1
```

`VALUE` is an observational class only. It means "non-zero/non-one integer" and does not imply edge IDs, vertex IDs, entity IDs, references, operands, or any other semantic role.

VALUE semantics are currently UNKNOWN. The property-table hypothesis was falsified and archived as FH-013.

Earlier notes also used magnitude subclasses:

```text
SMALL = values 2..255
LARGE = values >255
```

Those subclasses are retained only as descriptive range bins for old reports and should not be treated as semantic categories.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High as a classification, low for semantics.

**Date last updated**: 2026-06-27

**Related experiments**: EXP-006

---

## INV-012: Observed Section Forms

**Status**: Observation (formula incorrect — see correction note)

**Evidence**: Earlier measurements found that Block 1 section length follows:

```text
len = 2 * loopSize - 2
```

across the measured corpus. This records the first-time observation prior to formula verification.

This observation has since been verified as INV-017 (Verified Structural Invariant) across 593/593 faces in EXP-011. INV-012 remains as the historical observation record.

**Files tested**: v0.4.0 corpus: BOTTOM, TOP, GEAR, DEKOR. (593 of 595 faces validated.)

**Faces/models tested**: 593/595 faces across 4 models. 2-face discrepancy under investigation.

**Confidence**: High — verified by INV-017.

**Date last updated**: 2026-06-27

**Related experiments**: EXP-009, EXP-011; formal verification in INV-017

---
### CORRECTION NOTE (2026-07-10)

**The documented formula `len = 2 * loopSize - 2` is mathematically incorrect.**

Algebraic substitution:
```
len = 2 * loopSize - 2
loopSize = (raw + 2) / 2    (from INV-007)
len = 2 * ((raw + 2) / 2) - 2 = raw + 2 - 2 = raw
```

So INV-012's formula predicts `sectionBodyTokenCount = raw` (the raw Block 2 value).

**Corpus verification (8,763 sections across 8 files, v0.4.2a):**
- Matches `len = raw` (INV-012 prediction): **0 / 8,763 (0.0%)**
- Matches `len = raw - 1` (INV-017): **8,763 / 8,763 (100.0%)**

**Root cause:** Off-by-one documentation error. The constant should be `-3`, not `-2`:
```
len = 2 * loopSize - 3    (correct, equivalent to INV-017's `raw - 1`)
```

INV-012 remains as the historical observation record. INV-017 supersedes it with the correct formula.

**Discovered by:** EXP-013 (v0.4.2 stress test), confirmed by EXP-014 (v0.4.2a audit).

**Raw evidence:** `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`, `knowledge/evidence/2026-07-10_v0.4.2a-audit.md`

---

## INV-013: Dominant Block 1 Local Patterns

**Status**: Correlation

**Evidence**: The most frequent Block 1 bigrams are `LARGE -> ZERO` and `ZERO -> LARGE`. The most frequent trigram is generally `ZERO -> LARGE -> ZERO`, with TOP affected by high zero-fill in single-loop faces.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 595 faces across 4 models.

**Confidence**: High for pattern frequency, low for interpretation.

**Date last updated**: 2026-06-27

**Related experiments**: EXP-006

---

## INV-014: DisplayLists Has Section-Like `[1, 1]` Structures

**Status**: Observation

**Evidence**: The main DisplayLists stream contains repeated structures beginning with `u32[2] = [1, 1]`. BOTTOM had 11 such sections and 39 parsed faces. GEAR had 59 such sections and 113 parsed faces.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `Helical Bevel Gear.SLDPRT`

**Faces/models tested**: 2 models, 152 parsed faces in this section audit.

**Confidence**: High that the pattern exists, low for section semantics.

**Date last updated**: 2026-06-27

**Related experiments**: EXP-008

---

## INV-015: LWDATA Is Metadata In Current Corpus

**Status**: Observation

**Evidence**: `Contents/Config-0-LWDATA` contains no detected face markers, no topology headers, and no `[1,1]` section headers in current analysis. It contains class-name-like strings such as `gcXhatch_c` and `moLWPlaneNodeData_c`.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 4 models; stream-level analysis, not face-level.

**Confidence**: High for tested streams, medium for generalization.

**Date last updated**: 2026-06-27

**Related experiments**: EXP-008

---

## INV-016: Block 1 Body Length

**Status**: Verified Structural Invariant

**Evidence**: Block 1 body length (in u32s) follows:

```text
b1len = 2 * (vertexCount - sectionCount)
```

where `sectionCount` is the number of ONE-delimited sections in the Block 1 body.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High — 593/593 validated faces pass (100%).

**Date last updated**: 2026-06-27

**Related experiments**: EXP-011

---
### CORPUS EXTENSION NOTE (2026-07-10)

- v0.4.2 stress test (EXP-013): 1,232/1,232 faces pass (8 files, 6,859 sections). Strengthened by +639 new faces (HEADPHONE, DISTRIBUTOR, POCKET, PTC).
- v0.4.2a expanded corpus test (EXP-017): 1,234/1,234 faces pass (vc limit 6000, includes 2 previously-excluded DEKOR vc=5862 faces).
- v0.4.2a independent parser (EXP-016): 1,234/1,234 faces pass — eliminates implementation-specific bias.

**Raw evidence:** `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`, `knowledge/evidence/2026-07-10_v0.4.2a-expanded-corpus.md`, `knowledge/evidence/2026-07-10_v0.4.2a-independent-parser.md`

---
### CORPUS EXTENSION NOTE (2026-08-13)

EXP-024-CORRECTED (v0.4.5) — a third, independently-written pipeline — confirms INV-016 on 1,172/1,172 faces across 7 files (BOTTOM, TOP, GEAR, DEKOR, DISTRIBUTOR, POCKET, PTC; HEADPHONE not included in this corpus). This run corrects a prior Block1→Block2 offset bug in EXP-023/024 (v0.4.4) that had caused INV-016 to never execute; see `v0.4.5/CORRECTION_NOTE.md`.

**Raw evidence:** `knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md`

---

## INV-017: ONE-Delimited Section Length

**Status**: Verified Structural Invariant

**Evidence**: For every ONE-delimited section in Block 1, the number of body tokens equals the decoded loop entry minus 1:

```text
sectionBodyTokenCount = Block2[i] - 1
```

This formula is equivalent to the earlier observed relation `len = 2 * loopSize - 2` (INV-012). Each section body length corresponds to a single Block 2 loop entry.

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High — 593/593 validated faces pass (100%).

**Date last updated**: 2026-06-27

**Related experiments**: EXP-011

---
### CORPUS EXTENSION NOTE (2026-07-10)

- v0.4.2 stress test (EXP-013): 8,763/8,763 sections match (100%) across 8 files, 1,232 faces. Formula `sectionBodyTokenCount = Block2[i] - 1` holds universally.
- v0.4.2a expanded corpus test (EXP-017): 1,234/1,234 faces pass. High-vc faces (vc=5862) with 1,044 sections each also satisfy the formula.
- v0.4.2a independent parser (EXP-016): 1,234/1,234 faces pass — independent implementation confirms.
- INV-012's formula `len = 2 * loopSize - 2` has been corrected: it reduces to `len = raw`, but the correct relationship is `len = raw - 1` (= `2 * loopSize - 3`). See INV-012 correction note.

**Raw evidence:** `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`, `knowledge/evidence/2026-07-10_v0.4.2a-expanded-corpus.md`, `knowledge/evidence/2026-07-10_v0.4.2a-independent-parser.md`

---
### CORPUS EXTENSION NOTE (2026-08-13)

EXP-024-CORRECTED (v0.4.5) confirms INV-017 on 1,172/1,172 sections/faces across 7 files, using the section-splitting algorithm already established in `v0.4.2a/audit_v042a.js` (trailing partial section included). Same corrected pipeline as the INV-016 note above.

**Raw evidence:** `knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md`

---

## INV-018: Block 2 Sum

**Status**: Verified Structural Invariant (mathematical consequence of INV-017 — see dependency note)

**Evidence**: The sum of all Block 2 body values equals the Block 1 body length:

```text
sum(Block2[i]) = b1len
```

**Files tested**: `USB hub case BOTTOM.SLDPRT`, `USB hub case TOP.SLDPRT`, `Helical Bevel Gear.SLDPRT`, `Dekor.SLDPRT`

**Faces/models tested**: 593/595 faces across 4 models (2-face discrepancy under investigation).

**Confidence**: High — 593/593 validated faces pass (100%).

**Date last updated**: 2026-06-27

**Related experiments**: EXP-011

---
### CORPUS EXTENSION NOTE (2026-07-10)

- v0.4.2 stress test (EXP-013): 1,232/1,232 faces pass.
- v0.4.2a expanded corpus test (EXP-017): 1,234/1,234 faces pass.
- v0.4.2a independent parser (EXP-016): 1,234/1,234 faces pass.

**Raw evidence:** `knowledge/evidence/2026-07-10_v0.4.2-stress-test.md`, `knowledge/evidence/2026-07-10_v0.4.2a-expanded-corpus.md`, `knowledge/evidence/2026-07-10_v0.4.2a-independent-parser.md`

---
### MATHEMATICAL DEPENDENCY NOTE (2026-07-10)

INV-018 is **not mathematically independent**. It follows from INV-017 plus the definition of section splitting. Proven by EXP-014 (v0.4.2a audit).

**Proof:**
1. From section splitting: `sum(sectionLen[i]) = b1len - sectionCount` (the ONE delimiters are removed from the body).
2. From INV-017: `sectionLen[i] = Block2[i] - 1` for all sections.
3. Substituting: `sum(Block2[i] - 1) = b1len - sectionCount`
   → `sum(Block2) - sectionCount = b1len - sectionCount`
   → `sum(Block2) = b1len`
4. This is exactly INV-018. QED.

**Empirical verification:** 1,232/1,232 faces where INV-017 passes also pass INV-018. Zero counterexamples.

INV-018 adds zero independent information beyond INV-017. It is retained as a derived relationship for convenience, not an independent structural invariant.

**Discovered by:** EXP-014 (v0.4.2a audit).

**Raw evidence:** `knowledge/evidence/2026-07-10_v0.4.2a-audit.md`

---
### CORPUS EXTENSION NOTE (2026-08-13)

EXP-024-CORRECTED (v0.4.5) confirms INV-018 on 1,172/1,172 faces across 7 files. This is the same corrected pipeline referenced in the INV-016/INV-017 notes above; it fixes a Block1→Block2 offset bug in the original v0.4.4 EXP-023/024 that had prevented INV-016/017/018 from ever executing (the pipeline failed at B2 validation for 100% of candidates). See `v0.4.5/CORRECTION_NOTE.md` for the root-cause analysis.

**Raw evidence:** `knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md`

---

## INV-019: secCount / Alternative-Header Correlation

> **Correction, 2026-09-14 (EXP-042–046):** This is a fixed-window detection result, not actual optional-header absence. EXP-042 reads the precursor at its variable-length position on every recovered face. Evidence: [v0.4.8 report](../v0.4.8/README.md).

**Status**: Correlation (not causal; see notes — modeled on INV-013's precedent for high-confidence, non-causal patterns)

**Evidence**: Once Block2 is read at the corrected offset (`block1Start + (N+4)*4`), the Block2 body length (`secCount`, i.e. `M`) and the presence/N-value of the alternative `[4,8,2,N']` header (detected at the established fixed positions `mp-20` for N'=1, `mp-24` for N'=2) correlate with zero known counterexamples:

```text
secCount = 1   <->  alternative header present with N' = 1
secCount = 2   <->  alternative header present with N' = 2
secCount >= 3  <->  no alternative header (within the tested N'∈{1,2} detection window)
```

This was first observed in EXP-023-CORRECTED (v0.4.5) and then specifically stress-tested by EXP-026 (v0.4.6), which independently re-derived the same face set and hunted for counterexamples in four directions (secCount=1 without N'=1; secCount=2 without N'=2; secCount>=3 with any alternative; alternative N' inconsistent with secCount). Result: 0 counterexamples in any direction, across 1,172/1,172 faces, in every one of the 7 tested files individually.

**No causal or semantic claim is made.** This entry does NOT establish: which variable (if either) determines the other; what `secCount` or the alternative header represent; behavior outside the tested corpus (HEADPHONE, 62 faces, is excluded — not present in this repository checkout); or whether an N'>=3 alternative exists at a different offset for `secCount>=3` faces (the detection window was not extended — see Known gaps in the EXP-026 evidence file).

**Files tested**: BOTTOM, TOP, GEAR, DEKOR, DISTRIBUTOR, POCKET, PTC.

**Faces/models tested**: 1,172 faces across 7 files.

**Confidence**: High that the correlation holds with zero exceptions on the tested corpus. Zero confidence on causal direction or semantics.

**Date last updated**: 2026-08-13

**Related experiments**: EXP-023-CORRECTED (v0.4.5, first observation), EXP-026 (v0.4.6, discriminating counterexample hunt).

**Raw evidence:** `knowledge/evidence/2026-08-13_v0.4.5-EXP023-corrected.md`, `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`

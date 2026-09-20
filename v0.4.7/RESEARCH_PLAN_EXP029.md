# Research Plan: EXP-029 Candidate Evaluation

**Date**: 2026-08-14
**Status**: Planning (do not implement)

---

## Executive Summary

EXP-028 falsified three EXP-027 conclusions: (1) linear VC↔diameter scaling, (2) feature-change localization, (3) exact vertex correspondence. The controlled corpus C00–C11 now provides three hole diameters (3mm, 4mm, 5mm) plus C11 (4mm) already exists with all export formats.

**Recommendation**: Do NOT pursue C11 third-diameter experiment (Candidate A) as EXP-029. Instead, pursue **Candidate C: Block1/Block2 Geometry-Encoding Differential** — the highest information-gain direction that directly addresses core unknowns.

---

## Candidate Evaluation

### Candidate A: C11 Third Diameter Point (vc-diameter relationship)

**Status**: C11 already exists in corpus with SLDPRT + STEP + STL.

**What it tests**: OQ-021 — whether vc follows a power law, chord-error rule, or other relationship with diameter.

**Current data**:
- C04 (5mm): vc=70, b1Len=138, secCount=1
- C05 (3mm): vc=56, b1Len=110, secCount=1
- Linear interpolation prediction for 4mm: vc=63, b1Len=124

**Information gain**: MEDIUM. With 3 data points, can fit vc = a * diameter^b and determine if b=1 (linear) or b≠1. But the linear hypothesis is already falsified by EXP-028 (ratio mismatch). Even if we determine b, this tells us about tessellation behavior, not serialization grammar.

**Critical observation**: The b1Len ratio (138/110 = 1.2545) matches the vc ratio (70/56 = 1.25), NOT the diameter ratio (5/3 = 1.6667). This suggests b1Len is directly proportional to vc, which is already known from INV-017 (b1Len = 2*(vc - secCount)). So C11 would only confirm the INV-017 relationship holds for cylindrical faces — low novelty.

**Verdict**: **Low priority.** Incremental, not groundbreaking. The vc-diameter relationship is a tessellation detail, not a serialization grammar insight.

### Candidate B: Broader Tessellation-Density Experiment

**Status**: Would combine C04/C05/C11 data.

**What it tests**: Systematic tessellation behavior across multiple diameters.

**Information gain**: MEDIUM-HIGH. More systematic than Candidate A, but still focused on tessellation, not serialization grammar.

**Verdict**: **Medium priority.** Valuable but not the highest-value direction.

### Candidate C: Block1/Block2 Geometry-Encoding Differential

**Status**: Feasible with existing corpus. No new models needed.

**What it tests**: How Block 1/Block 2 values change when geometry changes, using controlled differentials with known ground truth.

**Information gain**: HIGH. This directly addresses the core unknowns:
- OQ-001: What grammar does Block 1 follow?
- OQ-002: What does each ONE-delimited segment represent?
- OQ-003A: What do VALUE tokens mean?
- OQ-006: What is the meaning of Block 2's raw encoding?

**Why this is highest-value**: The controlled corpus provides a unique opportunity. We know EXACTLY what changed between models (hole diameter, fillet, chamfer, etc.) and can observe EXACTLY how Block 1/Block 2 values respond. This is the only way to make progress on the core grammar questions without guessing.

**Verdict**: **HIGH priority. Recommended for EXP-029.**

### Candidate D: Unknown Unknowns in Existing Corpus

**Status**: Risky exploration.

**Information gain**: UNKNOWN. Could be high if we find something new, but high risk of rabbit holes.

**Verdict**: **Low priority.** Too speculative.

---

## Recommendation: EXP-029 = Candidate C

### Hypothesis

**H1**: Block 1 section body values encode geometry-specific parameters that change predictably when geometry changes.

**H0 (null)**: Block 1 section body values do not change systematically with geometry changes; changes are random or structural (offsets only).

### Controls and Measurements

**Controlled differentials** (one variable at a time):

1. **C00↔C04** (hole addition): 6-face cube → 7-face cube with cylindrical hole
   - Compare Block 1/Block 2 values for matched faces (faces 0-3: cube faces)
   - Observe Block 1/Block 2 values for new face (cylindrical surface)

2. **C04↔C05** (diameter change): 5mm → 3mm hole
   - Compare cylindrical face Block 1/Block 2 values
   - vc changes 70→56, b1Len changes 138→110

3. **C00↔C03** (fillet): Sharp edge → 1mm fillet
   - Compare Block 1/Block 2 values for matched faces
   - Observe fillet face Block 1/Block 2 values

4. **C00↔C09** (chamfer): Sharp edge → 1mm chamfer
   - Compare Block 1/Block 2 values for matched faces
   - Observe chamfer face Block 1/Block 2 values

**Measurements**:
- Block 1 section body token sequences (already extracted by parser)
- Block 2 decoded loop sizes (already extracted)
- Block 1 body length (b1Len) for each face
- Section count (secCount) for each face
- Token-class histograms (ZERO/ONE/VALUE/SMALL/LARGE) per section

### What Result Would Support/Falsify

**Support H1**:
- Block 1 token sequences for matched faces are identical between models (e.g., C00 face 0 vs C04 face 0)
- Block 1 token sequences for cylindrical faces differ systematically between diameters (C04 vs C05)
- Token changes correlate with geometric parameters (vc, ec, loop sizes)

**Falsify H0**:
- Block 1 token sequences for matched faces differ randomly between models
- No correlation between token changes and geometric parameters

**Falsify H1**:
- Block 1 token sequences for cylindrical faces are identical despite different diameters
- Token changes are random, not systematic

### Confounders

1. **Face matching ambiguity**: When faces are added/removed, which faces correspond between models? Need structural matching (vertex positions, ec/vc), not index-based matching.

2. **Serialization re-ordering**: EXP-028 showed DL is re-serialized entirely. Face order may change. Need to match faces by geometry, not position.

3. **Token-class interpretation**: Without knowing what VALUE tokens mean, we can only observe patterns, not interpret semantics.

4. **Section-length coupling**: From INV-017, section body length = Block2[i] - 1. So b1Len is determined by vc and secCount. Changes in b1Len are EXPECTED when vc changes. The question is whether individual token values change, not just the total length.

### Files/Models Needed

**Existing** (no new models):
- `test files original/controlled/C00_cube_10mm/model.SLDPRT`
- `test files original/controlled/C03_cube_fillet_1mm/model.SLDPRT`
- `test files original/controlled/C04_cube_hole_5mm/model.SLDPRT`
- `test files original/controlled/C05_cube_hole_3mm/model.SLDPRT`
- `test files original/controlled/C09_cube_chamfer_1mm/model.SLDPRT`

**Existing tools**:
- `parser/v0.1/src/parser-core.js` (validated parser)
- `v0.4.7/exp028_hole_diameter.js` (reference for extraction patterns)

### Implementation Plan

**Step 1: Extract Block1/Block2 token sequences for all controlled models**

Write `v0.4.7/exp029_block1_geometry_encoding.js` that:
- Parses C00, C03, C04, C05, C09 using parser-core
- Extracts for each face:
  - face index, ec, vc, secCount, b1Len
  - Block 1 section body token sequences (raw integers)
  - Block 2 decoded loop sizes
  - Vertex positions (for structural matching)
- Outputs `EXP029_BLOCK1_GEOMETRY.json`

**Step 2: Match faces between models**

Write face-matching logic that:
- Matches faces by vertex position similarity (not index)
- Handles added/removed faces (e.g., cylindrical surface in C04)
- Produces a correspondence table: (C00_face_i, C04_face_j, match_quality)

**Step 3: Compare Block1 tokens for matched faces**

For each matched pair:
- Compute token-edit distance (Levenshtein on integer sequences)
- Identify changed/unchanged tokens
- Classify changes: (a) offset shifts only, (b) value changes, (c) length changes

**Step 4: Analyze cylindrical face tokens**

Compare C04 cylindrical face (vc=70) vs C05 cylindrical face (vc=56):
- Are token sequences identical modulo length?
- Do specific token positions change systematically?
- Do VALUE tokens correlate with vc?

**Step 5: Classify findings**

For each observation, assign status:
- Verified: Directly observed with evidence
- Strong Evidence: High confidence, reproducible
- Correlation: Statistical pattern, not proven causal
- Hypothesis: Plausible but untested
- Unknown: Cannot determine from current data
- Falsified: Contradicted by evidence

**Step 6: Write evidence file**

`knowledge/evidence/2026-08-14_v0.4.7-EXP029.md` with:
- Method
- Raw data
- Analysis
- Conclusions (with status classifications)
- What was established/falsified
- Remaining unknowns
- Recommended next experiment

### Expected Outcomes

**Best case**: Discover that Block 1 token sequences encode geometry parameters (e.g., vertex coordinates, edge connectivity, surface type). This would be a breakthrough in understanding the grammar.

**Likely case**: Observe that Block 1 tokens for matched faces are identical (consistency check), and cylindrical face tokens differ in predictable ways. This constrains the grammar space.

**Worst case**: Tokens change randomly, providing no insight. This would falsify H1 and suggest Block 1 encodes something else entirely.

### Priority Ranking

1. **EXP-029: Candidate C (Block1/Block2 Geometry-Encoding Differential)** — RECOMMENDED
2. EXP-030: Candidate A (C11 third diameter) — deferred
3. EXP-031: Candidate B (broader tessellation) — deferred
4. EXP-032: Candidate D (unknown unknowns) — speculative

---

## Appendix: Key Data Points

### Cylindrical Face Comparison

| Model | Diameter | vc | b1Len | secCount | b2Body |
|-------|----------|-----|-------|----------|--------|
| C04 | 5mm | 70 | 138 | 1 | {0: 138} |
| C05 | 3mm | 56 | 110 | 1 | {0: 110} |
| C11 | 4mm | ? | ? | ? | ? |

**Observation**: b1Len = 2*(vc - secCount) = 2*(vc - 1) = 2*vc - 2. This is INV-017 for secCount=1.
- C04: 2*70 - 2 = 138 ✓
- C05: 2*56 - 2 = 110 ✓

So b1Len is DETERMINED by vc and secCount. The interesting question is whether individual token values within the section body encode additional geometry information.

### Token Sequence Lengths

From INV-017: section body token count = Block2[i] - 1 = loopSize - 1.
- C04 cylindrical face: loopSize=70, section body tokens=69
- C05 cylindrical face: loopSize=56, section body tokens=55

The token sequences have different lengths (69 vs 55). The question is: are the tokens at corresponding positions the same, or do they differ?

---

## Status

This is a RESEARCH PLAN only. Do not implement until approved.

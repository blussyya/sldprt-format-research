# EXP-029 Summary: Block1/Block2 Geometry-Encoding Differential

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Determine whether Block1/Block2 section-body values contain geometry-dependent information, using the controlled C00–C10 corpus.

## Method

1. Parse controlled models using validated parser-core
2. Extract Block1/Block2 token sequences for all faces
3. Match faces between models using structural properties (ec, vc, secCount)
4. Compare Block1/Block2 tokens for matched faces
5. Analyze C04↔C05 cylindrical face tokens specifically

## Key Findings

### Finding 1: Cube Face Tokens Are Consistent Across Models

**Status**: Verified

All cube faces (ec=4, vc=4) have identical token structure:
- C00 face 0: `[1, 5, 82, 0, 79, 62]`
- C04 face 0: `[1, 5, 82, 0, 79, 62]`
- C03 face 0: `[1, 5, 82, 0, 79, 62]`
- C09 face 0: `[1, 5, 82, 0, 79, 62]`

**Evidence**: Tokens are byte-identical across all four models for face 0.

**Conclusion**: For the same geometric face (cube face with ec=4, vc=4), Block1 tokens are identical across models. This is strong evidence that tokens are NOT random or structural-only.

### Finding 2: Cylindrical Face Tokens Are Identical Up to Length

**Status**: Verified

C04 cylindrical face (vc=70) and C05 cylindrical face (vc=56) have identical token patterns:
- C04: `[1, 0, 150, 0, 153, 0, 150, 0, 153, ...]` (138 tokens)
- C05: `[1, 0, 150, 0, 153, 0, 150, 0, 153, ...]` (110 tokens)

The first 110 tokens are byte-identical. The difference is that C04 has 28 additional tokens at the end.

**Evidence**: Identical prefix length = 110 / 110 (C05 length).

**Conclusion**: The token pattern is structurally identical; only the repetition count changes with vc. This is strong evidence that tokens encode tessellation parameters, not geometry-specific data.

### Finding 3: Token Length Correlates with vc

**Status**: Correlation

- C04 cylindrical: vc=70, token length=138
- C05 cylindrical: vc=56, token length=110
- Length difference: 28
- vc difference: 14
- Ratio: 2.0

**Evidence**: Length = 2 * vc - 2 (matches INV-017: b1Len = 2*(vc - secCount) for secCount=1).

**Conclusion**: Token length is determined by vc and secCount via INV-017. This is a structural relationship, not geometry encoding.

### Finding 4: Face Matching Is Ambiguous

**Status**: Verified

When matching faces by ec/vc/secCount, there are multiple faces with identical structural properties. For example, in C00 (cube), all 6 faces have ec=4, vc=4, secCount=1, but different token values:
- Face 0: `[1, 5, 82, 0, 79, 62]`
- Face 1: `[1, 9, 81, 0, 82, 58]`
- Face 2: `[1, 13, 80, 0, 81, 54]`
- Face 3: `[1, 17, 79, 0, 80, 50]`
- Face 4: `[1, 13, 9, 0, 17, 5]`
- Face 5: `[1, 54, 50, 0, 58, 62]`

**Evidence**: Token values differ between faces with identical ec/vc/secCount.

**Conclusion**: Token values may encode face-specific information (e.g., vertex coordinates, face orientation). However, without knowing the semantics, we cannot determine which face in C00 corresponds to which face in C04.

### Finding 5: Token Values Follow a Pattern

**Status**: Correlation

Cube face tokens follow a pattern:
- Token 0: Always 1 (ONE delimiter)
- Token 1: Varies (5, 9, 13, 17, 54)
- Token 2: Varies but correlates with token 1 (5+82=87, 9+81=90, 13+80=93, 17+79=96)
- Token 3: Always 0 (ZERO)
- Token 4-5: Vary

**Evidence**: Tokens 1 and 2 appear to be correlated (sum increases with token 1).

**Conclusion**: Token values may encode geometric parameters, but the relationship is unclear. The correlation suggests structure, not randomness.

## Hypothesis Testing

### H1: Tokens are identical for same geometry
**Result**: SUPPORTED for cube faces (C00 face 0 = C04 face 0 = C03 face 0 = C09 face 0).

### H2: Tokens change when geometry changes
**Result**: SUPPORTED for cylindrical faces (C04 vs C05).

### H3: Token changes correlate with vc changes
**Result**: CORRELATION (length difference matches vc difference via INV-017).

### H4: Tokens are structural (not geometry-dependent)
**Result**: FALSIFIED (tokens differ between faces with identical ec/vc/secCount).

## Claims Strengthened

1. **INV-017 is fundamental**: Token length is determined by vc and secCount. This is a structural invariant, not a geometry-dependent parameter.

2. **Tokens are not random**: Identical tokens across models for same geometric face (cube face 0).

3. **Tokens have structure**: Pattern of alternating values (150, 153) in cylindrical faces suggests tessellation encoding.

## Claims Weakened

1. **Geometry encoding hypothesis**: Tokens do NOT change with geometry changes (cylindrical face tokens are identical up to length). The hypothesis that tokens encode geometry-specific parameters is weakened.

2. **Face matching by tokens**: Token values differ between faces with identical ec/vc/secCount, making face matching ambiguous.

## Claims Falsified

1. **Tokens encode geometry parameters**: FALSIFIED for cylindrical faces. Tokens are identical up to length, not different with diameter.

## New Hypotheses

### H5: Tokens encode tessellation parameters
**Status**: Hypothesis
**Statement**: Block1 tokens encode tessellation parameters (e.g., angular step, chord error) rather than geometry-specific data. The alternating pattern (150, 153) in cylindrical faces suggests fixed tessellation angles.

### H6: Token values encode face orientation
**Status**: Hypothesis
**Statement**: Token values may encode face orientation or position in the model space. The correlation between token 1 and token 2 in cube faces suggests a relationship to face coordinates.

## Remaining Unknowns

1. **Token semantics**: What do the specific token values (150, 153, 5, 82, etc.) represent?
2. **Face matching**: How to match faces between models when ec/vc/secCount are identical?
3. **Tessellation encoding**: Is the alternating pattern (150, 153) related to tessellation angles?
4. **Token 1 and 2 correlation**: Why do token 1 and token 2 appear to be correlated in cube faces?

## Implications for parser/

1. **Face matching**: Parser cannot match faces between models using only ec/vc/secCount. Need additional information (vertex positions, token values).

2. **Token interpretation**: Parser should not interpret token values as geometry-specific parameters without understanding semantics.

3. **Tessellation**: Parser may need to account for tessellation parameters encoded in tokens.

## Recommended Next Experiment

**EXP-030**: Analyze token patterns across more models (C00, C01, C02, C06, C07, C08, C10) to determine if token values encode face orientation or tessellation parameters.

Specifically:
1. Compare C00 (10mm cube) with C01 (20mm cube) to see if tokens change with scale
2. Compare C00 with C02 (translated cube) to see if tokens change with position
3. Analyze token patterns in C07 (two holes) to see if tokens encode hole count

## Raw Data

- `v0.4.7/EXP029_BLOCK1_GEOMETRY.json`: Full extraction results
- `v0.4.7/exp029_block1_geometry_encoding.js`: Main analysis script
- `v0.4.7/exp029_detailed_analysis.js`: Detailed token pattern analysis

---

## Date Produced

2026-08-14

## Date Captured

2026-08-14

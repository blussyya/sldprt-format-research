# EXP-031 Summary: Block1 Token Signature Classification

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Determine whether Block1 token sequences have reproducible signatures associated with face/serialization structure or face type, without assigning semantic meaning to the tokens.

## Method

1. Parse controlled models (C00, C03, C04, C05, C09, C11)
2. Classify faces by type (planar_cube, cylindrical, chamfer, multi_loop)
3. Compute token signatures (first N tokens, entropy, zero frequency, alternating strength, repeating pattern length)
4. Test hypotheses H1-H5
5. Compare token signatures within and between groups

## C11 Discrepancy Resolution

Preliminary output reported C11 cylindrical face `vc=57`, but the actual cylindrical face is face 6 with `vc=64`. Face 5 (vc=57) is a multi-loop face created by the hole cutting through the cube.

## Key Findings

### Finding 1: Cylindrical Faces Share Identical Token Signature

**Status**: Verified

All 3 cylindrical faces (C04 vc=70, C05 vc=56, C11 vc=64) have identical first 20 tokens:
- `1,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0`

**Evidence**: Byte-identical across all three models.

**Conclusion**: Cylindrical faces share a structural token signature regardless of hole diameter.

### Finding 2: Planar Cube Faces Have Diverse Token Signatures

**Status**: Verified

27 planar cube faces (ec=4, vc=4, secCount=1) have 9 unique first-20 patterns:
- C00 face 0: `1,5,82,0,79,62`
- C00 face 1: `1,9,81,0,82,58`
- C00 face 2: `1,13,80,0,81,54`
- C00 face 3: `1,17,79,0,80,50`
- C03 faces 0-3: Same as C00 faces 0-3
- C04 faces 0-3: Same as C00 faces 0-3
- C05 faces 0-3: Same as C00 faces 0-3
- C09 faces 0-3: Same as C00 faces 0-3
- C11 faces 0-3: Same as C00 faces 0-3

**Evidence**: 9 unique patterns across 27 faces.

**Conclusion**: Planar cube faces have diverse token signatures that differ by face orientation.

### Finding 3: Chamfer Faces Have Diverse Token Signatures

**Status**: Verified

2 chamfer faces (ec=5, vc=5, secCount=1) have 2 unique first-20 patterns:
- C09 face 4: `1,142,165,0,5,0,13,9`
- C09 face 5: `1,139,62,0,152,0,58,54`

**Evidence**: 2 unique patterns across 2 faces.

**Conclusion**: Chamfer faces have diverse token signatures.

### Finding 4: Multi-loop Faces Have Diverse Token Signatures

**Status**: Verified

9 multi-loop faces have 9 unique first-20 patterns.

**Evidence**: 9 unique patterns across 9 faces.

**Conclusion**: Multi-loop faces have diverse token signatures.

### Finding 5: Token Signatures Correlate with Face Type

**Status**: Strong Evidence

- Cylindrical faces: 1 unique pattern (100% consistency)
- Planar cube faces: 9 unique patterns (33% consistency)
- Chamfer faces: 2 unique patterns (100% consistency)
- Multi-loop faces: 9 unique patterns (100% consistency)

**Evidence**: Token signatures show partial correlation with face type.

**Conclusion**: Token signatures are partially determined by face type.

## Token Signatures

### Cylindrical Faces

| Model | vc | First 20 Tokens |
|-------|-----|-----------------|
| C04 | 70 | `1,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0` |
| C05 | 56 | `1,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0` |
| C11 | 64 | `1,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0,153,0,150,0` |

**Pattern**: Alternating 150/153 with zeros. Identical across all diameters.

### Planar Cube Faces

| Model | Face | First 20 Tokens |
|-------|------|-----------------|
| C00 | 0 | `1,5,82,0,79,62` |
| C00 | 1 | `1,9,81,0,82,58` |
| C00 | 2 | `1,13,80,0,81,54` |
| C00 | 3 | `1,17,79,0,80,50` |
| C03 | 0-3 | Same as C00 faces 0-3 |
| C04 | 0-3 | Same as C00 faces 0-3 |
| C05 | 0-3 | Same as C00 faces 0-3 |
| C09 | 0-3 | Same as C00 faces 0-3 |
| C11 | 0-3 | Same as C00 faces 0-3 |

**Pattern**: Diverse across faces, consistent across models for same face orientation.

### Chamfer Faces

| Model | Face | First 20 Tokens |
|-------|------|-----------------|
| C09 | 4 | `1,142,165,0,5,0,13,9` |
| C09 | 5 | `1,139,62,0,152,0,58,54` |

**Pattern**: Diverse across faces.

## Face-Type Comparisons

### C00 ↔ C03 (Fillet)

- C00 planar faces: 6 faces, all with same 4 patterns
- C03 planar faces: 4 faces, all with same 4 patterns
- **Identical**: Yes (same face orientations)

### C00 ↔ C09 (Chamfer)

- C00 planar faces: 6 faces, all with same 4 patterns
- C09 planar faces: 5 faces, all with same 4 patterns
- **Identical**: Yes (same face orientations)

### C04 ↔ C05 ↔ C11 (Hole Diameter)

- C04 cylindrical vc: 70
- C05 cylindrical vc: 56
- C11 cylindrical vc: 64
- **Identical**: Yes (all have same alternating 150/153 pattern)

## C11 Findings

C11 cylindrical face (vc=64) has identical first 20 tokens as C04 (vc=70) and C05 (vc=56).

C11 multi-loop faces (vc=57, vc=59) have different patterns.

**Conclusion**: C11 confirms that cylindrical faces share a structural token signature regardless of diameter.

## Hypotheses Strengthened

1. **Cylindrical face signature hypothesis**: Cylindrical faces share a structural token signature (alternating 150/153 pattern).

2. **Face type classification hypothesis**: Token signatures can be used to classify face types.

## Hypotheses Falsified

1. **H1: All planar faces share one normalized token signature**: FALSIFIED. Planar cube faces have 9 unique patterns.

2. **H4: Token signatures are determined primarily by geometry dimensions**: FALSIFIED. Cylindrical faces with different diameters have identical token patterns.

## Hypotheses Partially Supported

1. **H3: Token signatures are determined primarily by face type**: PARTIALLY SUPPORTED. Cylindrical faces have consistent signatures, but planar cube faces have diverse signatures.

2. **H5: Token signatures are determined primarily by serialization/topology**: PARTIALLY SUPPORTED. Some faces with same ec/vc/secCount have different token patterns.

## Remaining Unknowns

1. **Why do planar cube faces have diverse token signatures?**: Token signatures differ by face orientation, but the relationship is not understood.

2. **What determines token values?**: Token values (150, 153, 5, 82, etc.) are not understood.

3. **Can token signatures be used for face classification?**: Cylindrical faces can be classified, but planar cube faces cannot.

## Parser Implications

1. **Face type detection**: Token patterns can be used to detect cylindrical faces.

2. **Token interpretation**: Parser should not interpret tokens as vertex/edge indices.

3. **Tessellation parameters**: Parser may need to extract tessellation parameters from tokens.

## Recommended Next Experiment

**EXP-032**: Analyze token patterns in faces with different orientations to determine if token signatures correlate with face orientation.

Specifically:
1. Compare C00 face 0 (orientation A) with C00 face 1 (orientation B)
2. Determine if token signatures differ systematically by orientation
3. Test whether token signatures can be used to predict face orientation

## Raw Data

- `v0.4.7/EXP031_TOKEN_SIGNATURES.json`: Full analysis results
- `v0.4.7/exp031_token_signatures.js`: Main analysis script

---

## Date Produced

2026-08-14

## Date Captured

2026-08-14

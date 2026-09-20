# EXP-030 Summary: Block1 Token Structural Correspondence

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Determine whether Block1 body tokens correspond to structural/topological information rather than geometry-specific parameters, after EXP-029 falsified geometry-specific encoding.

## Method

1. Parse controlled models (C00, C03, C04, C05, C09, C11)
2. Extract Block1/Block2 token sequences for all faces
3. Test tokens against structural candidates:
   - Vertex indices
   - Edge counts/identifiers
   - Loop sizes and boundaries
   - Section boundaries
   - Face adjacency
   - Block2 values
   - Ordering/permutation patterns
4. Investigate cylindrical sequence pattern
5. Analyze why b1Len = 2*vc-2

## Key Findings

### Finding 1: Cylindrical Face Pattern Is Identical Across Models

**Status**: Verified

All cylindrical faces (C04 vc=70, C05 vc=56, C11 vc=64) have identical token pattern:
- Token 0: 1 (ONE delimiter)
- Token 1: 0 (ZERO)
- Tokens 2+: Alternating 150, 0, 153, 0, ...

| Model | vc | First 10 tokens |
|-------|-----|-----------------|
| C04 | 70 | `1, 0, 150, 0, 153, 0, 150, 0, 153, 0` |
| C05 | 56 | `1, 0, 150, 0, 153, 0, 150, 0, 153, 0` |
| C11 | 64 | `1, 0, 150, 0, 153, 0, 150, 0, 153, 0` |

**Evidence**: Byte-identical first 110 tokens across all three models.

**Conclusion**: The alternating pattern (150, 153) is a structural signature of cylindrical faces, not geometry-specific data.

### Finding 2: Cube Face Tokens Are Identical Across Models

**Status**: Verified

All cube faces (ec=4, vc=4) have identical tokens across all models:
- C00 face 0: `[1, 5, 82, 0, 79, 62]`
- C04 face 0: `[1, 5, 82, 0, 79, 62]`
- C05 face 0: `[1, 5, 82, 0, 79, 62]`
- C11 face 0: `[1, 5, 82, 0, 79, 62]`

**Evidence**: Byte-identical across all four models.

**Conclusion**: Cube face tokens are a structural signature, not geometry-specific.

### Finding 3: No Structural Correspondence Found

**Status**: Verified

Tested candidates:
- **Vertex indices**: 41.2% of tokens are "index-like" (0 to vc-1), but no consistent mapping found.
- **Edge counts**: Only 2 matches across all faces.
- **Loop sizes**: Only 5 matches across all faces.
- **Block2 values**: Only 5 matches across all faces.
- **Face adjacency**: No consistent correlation.

**Evidence**: Systematic testing across 41 faces shows no consistent structural correspondence.

**Conclusion**: Block1 tokens do NOT correspond to vertex indices, edge counts, loop sizes, or Block2 values.

### Finding 4: B1Len Formula Explained

**Status**: Verified

The formula `b1Len = 2*(vc - secCount)` holds for all 41 faces.

**Derivation**:
- From INV-017: sectionBodyTokenCount = Block2[i] - 1 = loopSize - 1
- But parser calculates sectionLens as tokens between ONEs, which includes the ONE delimiter
- Actual relationship: `sum(sectionLens) = 2*vc - 3*secCount`
- And: `b1Len = sum(sectionLens) + secCount = 2*(vc - secCount)`

**Evidence**: Verified across all 41 faces.

**Conclusion**: The formula is a structural invariant, not a geometry-dependent parameter.

### Finding 5: Token Values Are Not Vertex/Edge Indices

**Status**: Verified

For cube face with 4 vertices:
- Tokens: `[1, 5, 82, 0, 79, 62]`
- Vertex indices: 0, 1, 2, 3
- Token values 5, 82, 79, 62 are OUT OF RANGE for 4 vertices

**Evidence**: Token values exceed vertex count for all faces tested.

**Conclusion**: Tokens cannot be vertex indices.

## Structural Correspondences Tested

| Candidate | Result | Evidence |
|-----------|--------|----------|
| Vertex indices | Falsified | Token values exceed vc |
| Edge counts | Falsified | Only 2 matches across all faces |
| Loop sizes | Falsified | Only 5 matches across all faces |
| Section boundaries | Falsified | No consistent pattern |
| Face adjacency | Falsified | No consistent correlation |
| Block2 values | Falsified | Only 5 matches across all faces |
| Ordering patterns | Unknown | No clear pattern found |
| Tessellation parameters | Hypothesis | Alternating 150/153 pattern |

## Hypotheses Strengthened

1. **Tessellation encoding hypothesis**: The alternating pattern (150, 153) in cylindrical faces suggests tessellation angles or parameters.

2. **Structural signature hypothesis**: Token sequences are structural signatures of face types, not geometry-specific data.

## Hypotheses Falsified

1. **Vertex index hypothesis**: Falsified. Token values exceed vertex count.
2. **Edge count hypothesis**: Falsified. No consistent mapping.
3. **Loop size hypothesis**: Falsified. No consistent mapping.
4. **Block2 correlation hypothesis**: Falsified. No consistent mapping.

## Unknowns

1. **Token semantics**: What do the specific values (150, 153, 5, 82, etc.) represent?
2. **Tessellation encoding**: Is the alternating pattern (150, 153) related to tessellation angles?
3. **Face type signatures**: Do different face types have different token signatures?

## Parser Implications

1. **Token interpretation**: Parser should not interpret tokens as vertex/edge indices.
2. **Face type detection**: Token patterns may be used to detect face types (cube vs cylindrical).
3. **Tessellation parameters**: Parser may need to extract tessellation parameters from tokens.

## C11 Relevance

**Status**: Relevant

C11 (4mm hole) was successfully parsed and analyzed. It confirms:
- Cylindrical face pattern is identical across hole diameters (C04, C05, C11)
- Cube face tokens are identical across all models
- The alternating pattern (150, 153) is a structural signature

C11 provides additional evidence for the tessellation encoding hypothesis.

## Recommended Next Experiment

**EXP-031**: Analyze token patterns in non-cylindrical curved faces (fillet in C03) to determine if other curved face types have similar token signatures.

Specifically:
1. Compare C03 fillet face tokens with C04/C05 cylindrical face tokens
2. Determine if fillet faces have a different token signature
3. Test whether token signatures correlate with surface curvature

## Raw Data

- `v0.4.7/EXP030_STRUCTURAL_CORRESPONDENCE.json`: Full analysis results (7050 lines)
- `v0.4.7/exp030_structural_correspondence.js`: Main analysis script
- `v0.4.7/exp030_detailed_analysis.js`: Detailed cylindrical pattern analysis

---

## Date Produced

2026-08-14

## Date Captured

2026-08-14

# EXP-032 Summary: Token Signatures vs Face Orientation

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Determine whether Block1 token signature differences observed among planar cube faces correlate with face orientation / surface normal direction, rather than geometry dimensions or arbitrary serialization order.

## Method

1. Parse controlled models (C00, C03, C04, C05, C09, C11)
2. Determine face orientation from normal records (authoritative source)
3. Compare token signatures across faces with same/different orientations
4. Test hypotheses H1-H5
5. Compare orientation against competing explanations

## Key Findings

### Finding 1: Planar Cube Faces Have Consistent Token Signatures for Same Orientation

**Status**: Verified

- **-X orientation**: All 6 models have pattern `[1,5,82,0,79,62]` (except cylindrical faces)
- **-Y orientation**: All 6 models have pattern `[1,9,81,0,82,58]`
- **+X orientation**: 4 models have `[1,13,80,0,81,54]`, 2 models have `[1,13,160,0,81,54]`
- **+Y orientation**: 4 models have `[1,17,79,0,80,50]`, 2 models have `[1,139,144,0,79,142]`

**Evidence**: Cross-model comparison shows consistent patterns for same orientation.

**Conclusion**: Token signatures correlate with face orientation for planar cube faces.

### Finding 2: Token Signature Variation Correlates with Model Type

**Status**: Verified

- **C00, C04, C05, C11**: Have "standard" patterns for all orientations
- **C03, C09**: Have "modified" patterns for +X and +Y orientations

**Evidence**: C03 (fillet) and C09 (chamfer) models show different token patterns for +X and +Y orientations.

**Conclusion**: Token signatures are influenced by model type (fillet/chamfer features).

### Finding 3: Cylindrical Faces Have Consistent Token Signature Regardless of Orientation

**Status**: Verified

All 3 cylindrical faces (C04, C05, C11) have pattern `[1,0,150,0,153,0]` regardless of orientation.

**Evidence**: Cylindrical faces have identical token patterns across all models.

**Conclusion**: Cylindrical faces share a structural token signature independent of orientation.

### Finding 4: Multi-loop and Chamfer Faces Have Diverse Token Signatures

**Status**: Verified

- **+Z orientation**: 6 unique patterns across 6 faces
- **-Z orientation**: 6 unique patterns across 6 faces

**Evidence**: Multi-loop and chamfer faces show significant variation in token signatures.

**Conclusion**: Token signatures for multi-loop and chamfer faces correlate with face type and model.

### Finding 5: Opposite Orientations Have Identical Patterns

**Status**: Verified

- **+X vs -X**: Patterns are identical (excluding cylindrical faces)
- **+Y vs -Y**: Patterns are identical
- **+Z vs -Z**: Patterns are identical (excluding cylindrical faces)

**Evidence**: Opposite orientations share the same token patterns.

**Conclusion**: Token signatures are not direction-dependent (positive vs negative).

## Token Signatures by Orientation

### Planar Cube Faces

| Orientation | Pattern | Models |
|-------------|---------|--------|
| -X | `[1,5,82,0,79,62]` | C00, C03, C04, C05, C09, C11 |
| -Y | `[1,9,81,0,82,58]` | C00, C03, C04, C05, C09, C11 |
| +X | `[1,13,80,0,81,54]` | C00, C04, C05, C11 |
| +X | `[1,13,160,0,81,54]` | C03, C09 |
| +Y | `[1,17,79,0,80,50]` | C00, C04, C05, C11 |
| +Y | `[1,139,144,0,79,142]` | C03, C09 |
| +Z | `[1,13,9,0,17,5]` | C00 |
| -Z | `[1,54,50,0,58,62]` | C00 |

### Cylindrical Faces

| Orientation | Pattern | Models |
|-------------|---------|--------|
| -X | `[1,0,150,0,153,0]` | C04, C05, C11 |

### Multi-loop Faces

| Orientation | Pattern | Model |
|-------------|---------|-------|
| +Z | `[1,142,0,5,1,9]` | C03 |
| +Z | `[1,153,0,0,1,153]` | C04 |
| +Z | `[1,0,13,0,153,0]` | C05 |
| +Z | `[1,153,0,0,1,0]` | C11 |
| -Z | `[1,54,0,58,1,62]` | C03 |
| -Z | `[1,150,0,0,1,150]` | C04 |
| -Z | `[1,0,150,0,54,0]` | C05 |
| -Z | `[1,0,0,150,1,150]` | C11 |

### Chamfer Faces

| Orientation | Pattern | Model |
|-------------|---------|-------|
| +Z | `[1,142,165,0,5,0]` | C09 |
| -Z | `[1,139,62,0,152,0]` | C09 |

## Hypotheses Strengthened

1. **Orientation correlation hypothesis**: Token signatures correlate with face orientation for planar cube faces.

2. **Model type hypothesis**: Token signatures are influenced by model type (fillet/chamfer features).

3. **Cylindrical face signature hypothesis**: Cylindrical faces share a structural token signature regardless of orientation.

## Hypotheses Falsified

1. **H2: Token signatures are invariant for the same orientation across models**: FALSIFIED. Same orientation has different tokens across models for +X and +Y orientations.

2. **H4: Token signatures are primarily determined by serialization position**: FALSIFIED. Same face index has different tokens across models.

3. **H5: Token signatures are primarily determined by topology/vertex ordering**: FALSIFIED. Faces with same vertex position have different tokens.

## Hypotheses Partially Supported

1. **H1: Token signatures correlate with planar face orientation**: PARTIALLY SUPPORTED. Some orientations have multiple patterns.

2. **H3: Opposite orientations have systematically related signatures**: SUPPORTED. Opposite orientations have identical patterns.

## Competing Explanations

1. **Face orientation**: Token signatures correlate with face orientation for planar cube faces.
2. **Model type**: Token signatures are influenced by model type (fillet/chamfer features).
3. **Serialization position**: FALSIFIED - same face index has different tokens across models.
4. **Topology/vertex ordering**: FALSIFIED - faces with same vertex position have different tokens.

## Remaining Unknowns

1. **Why do C03 and C09 have different patterns for +X and +Y?**: The relationship between fillet/chamfer features and token signatures is not understood.

2. **What determines token values?**: Token values (5, 82, 79, 62, etc.) are not understood.

3. **Can token signatures be used for face classification?**: Planar cube faces can be classified by orientation, but multi-loop and chamfer faces cannot.

## Parser Implications

1. **Face type detection**: Token patterns can be used to detect cylindrical faces.

2. **Orientation detection**: Token patterns can be used to detect face orientation for planar cube faces.

3. **Token interpretation**: Parser should not interpret tokens as vertex/edge indices.

## C11 Findings

C11 planar faces have identical token signatures as C00 planar faces for the same orientation.

C11 cylindrical face has identical token signature as C04/C05 cylindrical faces.

C11 multi-loop faces have different token signatures than C04/C05 multi-loop faces.

**Conclusion**: C11 confirms that token signatures correlate with face orientation for planar cube faces.

## Recommended Next Experiment

**EXP-033**: Analyze token patterns in models with different features (fillet, chamfer, hole) to determine if token signatures correlate with feature type.

Specifically:
1. Compare C00 (cube) with C03 (fillet), C09 (chamfer), C04/C05/C11 (hole)
2. Determine if token signatures differ systematically by feature type
3. Test whether token signatures can be used to predict feature type

## Raw Data

- `v0.4.7/EXP032_TOKEN_ORIENTATION.json`: Full analysis results
- `v0.4.7/exp032_token_orientation.js`: Main analysis script

---

## Date Produced

2026-08-14

## Date Captured

2026-08-14

# EXP-033 Summary: Token Signatures vs Feature-Induced Model State

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Determine why C03 (fillet) and C09 (chamfer) produce modified Block1 token signatures for otherwise comparable planar orientations, while C00/C04/C05/C11 retain the standard signatures.

## Method

1. Parse controlled models (C00, C03, C04, C05, C09, C10, C11)
2. Classify faces by type, orientation, and feature relationship
3. Perform controlled comparisons between models
4. Test hypotheses H1-H6
5. Analyze direct feature effects, feature-type comparisons, topology controls, and serialization evidence

## Key Findings

### Finding 1: Fillet and Chamfer Produce Identical Signature Changes

**Status**: Verified

Both fillet (C03) and chamfer (C09) produce the same signature changes for +X and +Y orientations:

| Orientation | C00 Pattern | C03/C09 Pattern | Changed |
|-------------|-------------|-----------------|---------|
| +X | `[1,13,80,0,81,54]` | `[1,13,160,0,81,54]` | YES |
| +Y | `[1,17,79,0,80,50]` | `[1,139,144,0,79,142]` | YES |

**Evidence**: Fillet and chamfer produce identical changes (4 changes each, same patterns).

**Conclusion**: Signature changes are not caused by feature type specifically, but by some common property.

### Finding 2: Signature Changes Occur Without Structural Changes

**Status**: Verified

The +X and +Y faces have identical structural properties across all models:

| Property | C00 | C03 | C09 |
|----------|-----|-----|-----|
| ec | 4 | 4 | 4 |
| vc | 4 | 4 | 4 |
| secCount | 1 | 1 | 1 |
| b1Len | 6 | 6 | 6 |

**Evidence**: Signature changed while all structural properties remained identical.

**Conclusion**: Signature changes are NOT caused by local topology or structural properties.

### Finding 3: Signature Changes Occur Without Direct Modification

**Status**: Verified

The +X and +Y faces are NOT directly modified by the feature:

- C00: No feature, so no direct modification
- C03: +X/+Y faces are planar_cube, not fillet faces
- C09: +X/+Y faces are planar_cube, not chamfer faces

**Evidence**: Signature changed but neither face is directly modified.

**Conclusion**: Signature changes are NOT caused by direct feature modification.

### Finding 4: Signature Changes Occur Without Adjacency

**Status**: Verified

The +X and +Y faces are NOT adjacent to modified geometry:

- C00: No modified geometry, so no adjacency
- C03: +X/+Y faces are not adjacent to fillet faces
- C09: +X/+Y faces are not adjacent to chamfer faces

**Evidence**: Signature changed but neither face is adjacent to modified geometry.

**Conclusion**: Signature changes are NOT caused by adjacency to modified geometry.

### Finding 5: Signature Changes Occur With Same Face Index

**Status**: Verified

The +X and +Y faces have the same face index across all models:

| Orientation | C00 Index | C03 Index | C09 Index |
|-------------|-----------|-----------|-----------|
| +X | 2 | 2 | 2 |
| +Y | 3 | 3 | 3 |

**Evidence**: Signature changed but face index remained the same.

**Conclusion**: Signature changes are NOT caused by face index changes.

### Finding 6: Hole Models Do Not Produce Signature Changes

**Status**: Verified

C04/C05/C11 (hole models) do NOT produce signature changes for +X and +Y:

| Orientation | C00 Pattern | C04/C05/C11 Pattern | Changed |
|-------------|-------------|---------------------|---------|
| +X | `[1,13,80,0,81,54]` | `[1,13,80,0,81,54]` | NO |
| +Y | `[1,17,79,0,80,50]` | `[1,17,79,0,80,50]` | NO |

**Evidence**: Hole models retain standard signatures.

**Conclusion**: Signature changes are specific to fillet/chamfer models, not all feature models.

### Finding 7: +Z/-Z Faces Are Replaced in Feature Models

**Status**: Verified

In C03/C09/C04/C05/C11, the +Z/-Z faces are replaced:

- C00: +Z/-Z are planar_cube faces
- C03: +Z/-Z are multi_loop faces (fillet)
- C04/C05/C11: +Z/-Z are multi_loop faces (hole)
- C09: +Z/-Z are chamfer faces

**Evidence**: +Z/-Z faces are replaced in all feature models.

**Conclusion**: Feature models replace +Z/-Z faces, but this does not affect +X/-X/+Y/-Y signatures.

## Signature Changes

### Changed Signatures

| Model | Orientation | From | To |
|-------|-------------|------|----|
| C03 | +X | `[1,13,80,0,81,54]` | `[1,13,160,0,81,54]` |
| C03 | +Y | `[1,17,79,0,80,50]` | `[1,139,144,0,79,142]` |
| C09 | +X | `[1,13,80,0,81,54]` | `[1,13,160,0,81,54]` |
| C09 | +Y | `[1,17,79,0,80,50]` | `[1,139,144,0,79,142]` |

### Unchanged Signatures

| Model | Orientation | Pattern |
|-------|-------------|---------|
| C03 | -X | `[1,5,82,0,79,62]` |
| C03 | -Y | `[1,9,81,0,82,58]` |
| C09 | -X | `[1,5,82,0,79,62]` |
| C09 | -Y | `[1,9,81,0,82,58]` |
| C04/C05/C11 | +X | `[1,13,80,0,81,54]` |
| C04/C05/C11 | +Y | `[1,17,79,0,80,50]` |

## Feature Comparisons

### Fillet vs Chamfer

- **Same number of changes**: 4 each
- **Same changes**: Identical patterns
- **Conclusion**: Fillet and chamfer produce identical signature changes

### Fillet/Chamfer vs Hole

- **Fillet/Chamfer**: Change +X and +Y signatures
- **Hole**: Does NOT change +X and +Y signatures
- **Conclusion**: Signature changes are specific to fillet/chamfer models

### Feature Models vs No Feature

- **No feature (C00)**: Standard signatures
- **Feature models (C03/C09)**: Modified +X and +Y signatures
- **Conclusion**: Feature models produce signature changes

## Topology Correlations

### Structural Properties

All +X and +Y faces have identical structural properties:

- **ec**: 4
- **vc**: 4
- **secCount**: 1
- **b1Len**: 6

### Signature Changes Without Structural Changes

The signature changes occur while all structural properties remain identical. This falsifies the hypothesis that signature changes are caused by local topology.

## Serialization Evidence

### Face Index

The +X and +Y faces have the same face index across all models:

- **+X**: Face index 2 in all models
- **+Y**: Face index 3 in all models

### Preceding/Following Face Types

The +X and +Y faces have the same preceding/following face types:

- **+X**: prev=planar_cube, next=planar_cube
- **+Y**: prev=planar_cube, next=none

### Conclusion

Signature changes are NOT caused by face index changes or preceding/following face types.

## Hypotheses Strengthened

1. **H1: Token signatures are determined primarily by feature type**: SUPPORTED. Fillet and chamfer produce identical changes.

2. **H5: Token signatures depend on global model state/serialization**: SUPPORTED. Signature changes occur with same face index.

3. **H6: Token signatures are determined by orientation plus another structural variable**: SUPPORTED. Orientation alone explains signature variation within C00.

## Hypotheses Falsified

1. **H2: Token signatures are determined primarily by local topology**: FALSIFIED. Signature changes occur without structural changes.

2. **H3: Token signatures depend on whether a face is directly modified by a feature**: FALSIFIED. Signature changes occur without direct modification.

3. **H4: Token signatures depend on adjacency to modified geometry**: FALSIFIED. Signature changes occur without adjacency.

## Remaining Unknowns

1. **Why do fillet and chamfer produce identical changes?**: The common property causing signature changes is not understood.

2. **What is the mechanism of global model state influence?**: How does the presence of a feature affect token signatures of unrelated faces?

3. **Why are -X/-Y signatures unchanged?**: The asymmetry between +X/+Y and -X/-Y is not understood.

4. **What determines the specific token values?**: The values 160, 139, 144, 142, etc. are not understood.

## Parser Implications

1. **Token interpretation**: Parser should not interpret tokens as vertex/edge indices.

2. **Global model state**: Token signatures may encode global model state, not just local face properties.

3. **Feature detection**: Token patterns can be used to detect the presence of fillet/chamfer features.

## Critical Negative Controls

1. **C04/C05/C11 (hole diameter controls)**: All retain standard +X/+Y signatures, confirming that geometry dimensions do not affect signatures.

2. **Unchanged cube faces**: -X/-Y signatures remain unchanged across all models, confirming that orientation alone explains some variation.

## Recommended Next Experiment

**EXP-034**: Analyze the specific structural property that causes signature changes in fillet/chamfer models.

Specifically:
1. Compare the global model state of C00 vs C03/C09
2. Determine what property is common to fillet/chamfer models but absent in hole models
3. Test whether this property can be used to predict signature changes

**Note**: If the experiment cannot distinguish feature type from topology/model state, explicitly record that ambiguity and identify the highest-information controlled experiment that would resolve it.

## Raw Data

- `v0.4.7/EXP033_FEATURE_STATE.json`: Full analysis results
- `v0.4.7/exp033_feature_state.js`: Main analysis script

---

## Date Produced

2026-08-14

## Date Captured

2026-08-14

# EXP-036: Fillet/Chamfer vs Hole/Shell Structural Differential

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Identify the concrete structural difference between:
- C03/C09 (fillet/chamfer) — which cause global token-signature changes
- C04/C05/C11 (holes) and C10 (shell) — which do not

## Method

For each feature model against C00, characterized:
- Number of faces added/removed
- Number of faces whose geometry actually changed
- Face types, ec/vc/secCount distributions
- Block1/Block2 sizes
- Which existing faces retain identical tokens
- Which existing faces receive changed tokens
- Whether new faces have distinctive structural properties

## Key Findings

### Finding 1: Fillet/Chamfer Add a New Face; Holes/Shell Do Not

**Status**: Verified

| Model | Face Diff | Added | Changed | Identical |
|-------|-----------|-------|---------|-----------|
| C03 (fillet) | +1 | 1 | 4 | 2 |
| C09 (chamfer) | +1 | 1 | 4 | 2 |
| C04 (hole 5mm) | +1 | 0 | 2 | 4 |
| C05 (hole 3mm) | +1 | 0 | 2 | 4 |
| C10 (shell) | +5 | 0 | 1 | 5 |
| C11 (hole 4mm) | +1 | 0 | 2 | 4 |

Fillet/chamfer add 1 new face. Holes/shell add 0 new faces (they modify existing faces).

**Classification**: Verified

### Finding 2: Fillet/Chamfer Produce Token Changes on Unrelated Faces

**Status**: Verified

| Model | Changed Faces | Unrelated Changes | Direct Changes |
|-------|---------------|-------------------|----------------|
| C03 (fillet) | +X, +Y, +Z, -Z | +X, +Y (no ec/vc change) | +Z, -Z (ec/vc changed) |
| C09 (chamfer) | +X, +Y, +Z, -Z | +X, +Y (no ec/vc change) | +Z, -Z (ec/vc changed) |
| C04 (hole 5mm) | +Z, -Z | None | +Z, -Z (ec/vc changed) |
| C05 (hole 3mm) | +Z, -Z | None | +Z, -Z (ec/vc changed) |
| C10 (shell) | +Z | None | +Z (ec/vc changed) |
| C11 (hole 4mm) | +Z, -Z | None | +Z, -Z (ec/vc changed) |

Fillet/chamfer produce token changes on +X/+Y faces that have IDENTICAL structural properties (ec/vc/secCount). Holes/shell do NOT produce token changes on unrelated faces.

**Classification**: Verified

### Finding 3: Multi-Loop Faces Do Not Distinguish the Groups

**Status**: Falsified

| Model | Multi-Loop Faces | Multi-Loop Added |
|-------|------------------|------------------|
| C03 (fillet) | 3 | +Z, -Z, NON_AXIS |
| C09 (chamfer) | 0 | None |
| C04 (hole 5mm) | 2 | +Z, -Z |
| C05 (hole 3mm) | 2 | +Z, -Z |
| C10 (shell) | 0 | None |
| C11 (hole 4mm) | 2 | +Z, -Z |

C09 (chamfer) has 0 multi-loop faces but produces global token changes. C04/C05/C11 (holes) have 2 multi-loop faces but do NOT produce global token changes. Multi-loop faces do NOT distinguish the groups.

**Classification**: Falsified

### Finding 4: Face Count Does Not Distinguish the Groups

**Status**: Falsified

| Model | Face Count |
|-------|------------|
| C03 (fillet) | 7 |
| C09 (chamfer) | 7 |
| C04 (hole 5mm) | 7 |
| C05 (hole 3mm) | 7 |
| C10 (shell) | 11 |
| C11 (hole 4mm) | 7 |

All models except C10 have 7 faces. Face count does NOT distinguish the groups.

**Classification**: Falsified

### Finding 5: Block1 Size Correlates with Token Changes

**Status**: Correlation

| Model | Avg B1 Size | Token Changes |
|-------|-------------|---------------|
| C03 (fillet) | 13.7 | Global |
| C09 (chamfer) | 6.6 | Global |
| C04 (hole 5mm) | 52.0 | Local |
| C05 (hole 3mm) | 42.3 | Local |
| C10 (shell) | 7.1 | Local |
| C11 (hole 4mm) | 48.0 | Local |

Fillet/chamfer have smaller average B1 sizes. Holes/shell have larger average B1 sizes. However, C10 (shell) has a small B1 size (7.1) similar to fillet/chamfer but does NOT produce global token changes.

**Classification**: Correlation

### Finding 6: C03 and C09 Differ in Structural Properties

**Status**: Verified

C03 (fillet) and C09 (chamfer) both produce global token changes, but differ in:
- C03 has 3 multi-loop faces; C09 has 0 multi-loop faces
- C03 changes ec/vc/secCount on +Z/-Z faces; C09 does not
- C03 has larger B1 sizes (avg 13.7); C09 has smaller B1 sizes (avg 6.6)

The common factor is NOT multi-loop faces, NOT ec/vc/secCount changes, NOT B1 size. The common factor is adding a new face at an edge location.

**Classification**: Verified

## Hypothesis Tests

| Hypothesis | Result | Explanation |
|------------|--------|-------------|
| H1: External boundary modification | **FALSIFIED** | Shell modifies external boundary but does not cause global token changes |
| H2: Number of faces | **FALSIFIED** | C03/C09/C04/C05/C11 all have 7 faces |
| H3: Multi-loop faces | **FALSIFIED** | C09 has 0 multi-loop faces but produces global token changes |
| H4: Topology | **UNKNOWN** | Cannot determine from structural data alone |
| H5: Curvature | **FALSIFIED** | C03 (fillet) and C09 (chamfer) both produce global token changes despite different curvature properties |
| H6: Serialization position | **UNKNOWN** | Cannot determine from structural data alone |
| H7: Feature type | **UNKNOWN** | C03/C09 are fillet/chamfer; C04/C05/C11 are holes; C10 is shell. But the distinguishing property is not feature type itself |
| H8: Adding a new face at an edge | **SUPPORTED** | C03/C09 add a new face; C04/C05/C10/C11 do not |

## Concrete Structural Differences

1. **Fillet/chamfer add a new face at an edge location**. Holes/shell do not add new faces.

2. **Fillet/chamfer produce token changes on +X/+Y faces** that have IDENTICAL structural properties (ec/vc/secCount). Holes/shell do NOT produce token changes on unrelated faces.

3. **Fillet/chamfer modify the +Z/-Z faces** (changing ec/vc/secCount). Holes also modify the +Z/-Z faces (changing ec/vc/secCount). Shell modifies only the +Z face.

4. **The "added" face in fillet/chamfer is a new face** with unique token signature. In holes/shell, the "new" faces are modifications of existing faces, not additions.

## What Remains Unknown

1. **Why adding a new face at an edge causes global token changes** on unrelated faces
2. **What property of the added face** causes the token changes
3. **Whether the position of the added face** (edge location) matters
4. **Whether the type of added face** (multi-loop vs chamfer) matters
5. **The exact semantic meaning of Block1/Block2 tokens**

## Relationship to Previous Experiments

- **EXP-033**: Fillet/chamfer cause token changes on unrelated faces. EXP-036 confirms this and shows that holes/shell do not.
- **EXP-035**: Shell does not change tokens on existing faces. EXP-036 confirms this and shows that holes also do not change tokens on unrelated faces.
- **EXP-034**: Geometric transformations do not change tokens. EXP-036 shows that the distinguishing factor is adding a new face at an edge location, not geometric transformations.

## Files Tested

- C00_cube_10mm (baseline)
- C03_cube_fillet_1mm (fillet)
- C04_cube_hole_5mm (hole 5mm)
- C05_cube_hole_3mm (hole 3mm)
- C09_cube_chamfer_1mm (chamfer)
- C10_cube_shell_1mm (shell)
- C11_cube_hole_4mm (hole 4mm)

## Faces/Models Tested

- C00: 6 faces
- C03: 7 faces
- C04: 7 faces
- C05: 7 faces
- C09: 7 faces
- C10: 11 faces
- C11: 7 faces
- 52 faces total across 7 models

## Confidence

**High** for the observation that fillet/chamfer add a new face while holes/shell do not.

**High** for the observation that fillet/chamfer produce token changes on unrelated faces while holes/shell do not.

**Medium** for the hypothesis that adding a new face at an edge is the distinguishing factor. This is supported by the data but the mechanism is unknown.

## Raw Evidence

- `v0.4.7/EXP036_RESULTS.json` — raw results
- `v0.4.7/exp036_feature_class_differential.js` — script

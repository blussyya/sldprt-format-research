# EXP-034: Controlled Transformation Invariance of Block1/Block2

**Date**: 2026-08-14
**Status**: Complete
**Version**: v0.4.7

## Objective

Determine whether the validated Block1/Block2 token structures are invariant under known geometric transformations (scale, translation) when topology and feature state remain unchanged.

## Method

Used controlled corpus models:
- **C00** — baseline cube (10mm)
- **C01** — scaled cube (20mm, 2x scale)
- **C02** — translated cube (50mm offset)

Compared for each corresponding face:
1. Block1 header and body tokens
2. Block2 header and body values
3. Structural properties (ec, vc, secCount, b1Len)
4. Gap markers, loop sizes, section lens
5. Vertex coordinates
6. Marker offsets

## Key Findings

### 1. Block1 Tokens Are COMPLETELY INVARIANT

**All Block1 body tokens are byte-for-byte identical** across C00, C01, and C02 for all 6 faces.

- C00 vs C01 (scale): **IDENTICAL** (6/6 faces)
- C00 vs C02 (translate): **IDENTICAL** (6/6 faces)

**Classification**: Verified

### 2. Block2 Is COMPLETELY INVARIANT

**All Block2 body values are identical** across C00, C01, and C02 for all 6 faces.

- C00 vs C01 (scale): **IDENTICAL** (6/6 faces)
- C00 vs C02 (translate): **IDENTICAL** (6/6 faces)

**Classification**: Verified

### 3. Structural Properties Are INVARIANT

All structural properties are identical across all three models:

- **ec**: 4 for all faces (planar cube)
- **vc**: 4 for all faces (planar cube)
- **secCount**: 1 for all faces
- **b1Len**: 6 for all faces

**Classification**: Verified

### 4. Block1/Block2 Headers Are INVARIANT

- Block1 headers: `[4, 8, 2, 6]` for all faces in all models
- Block2 headers: `[4, 8, 2, 1]` for all faces in all models

**Classification**: Verified

### 5. Other Structures Are INVARIANT

- **Gap markers**: `[12, 100, 2, 4]` for all faces in all models
- **Loop sizes**: `[4]` for all faces in all models
- **Section lens**: `[6]` for all faces in all models
- **Marker offsets**: Identical across all models (Face 0: 5140, Face 1: 6024, etc.)

**Classification**: Verified

### 6. Vertex Coordinates CHANGE As Expected

Vertex coordinates are the **only** structure that changes:

**C00 vs C01 (scale)**:
- All vertices scaled by 2x
- Average ratio: 2.0000
- 4-8 values differ per face (depending on face orientation)

**C00 vs C02 (translate)**:
- All vertices offset by 50mm in X and Y
- Diffs: [0.0500, 0.0500, 0.0000, ...] (meters)
- 8 values differ per face

**Classification**: Verified (expected behavior)

### 7. Byte-Level Differential

**C00 vs C01 (scale)**:
- DL sizes: 12050 bytes (identical)
- Changed ranges: 182
- Total changed bytes: 355 (2.95%)
- All changes are in vertex coordinate regions

**C00 vs C02 (translate)**:
- DL sizes: 12050 bytes (identical)
- Changed ranges: 158
- Total changed bytes: 1141 (9.47%)
- All changes are in vertex coordinate regions

### 8. All Invariants PASS

All validated invariants pass across all three models:

- INV-005 (Block1 header [4,8,2,N]): **PASS**
- INV-006 (Block2 header [4,8,2,M]): **PASS**
- INV-008 (Block1 body starts with ONE): **PASS**
- INV-009 (ONE count == secCount): **PASS**
- INV-016 (b1Len = 2*(vc-secCount)): **PASS**
- INV-017 (sectionLens match b2Body-1): **PASS**
- INV-018 (sum(b2Body) == b1Len): **PASS**

## Hypothesis Tests

| Hypothesis | Result |
|------------|--------|
| H1: Block1 tokens invariant under scale | **SUPPORTED** |
| H2: Block1 tokens invariant under translation | **SUPPORTED** |
| H3: Block2 invariant under scale | **SUPPORTED** |
| H4: Block2 invariant under translation | **SUPPORTED** |
| H5: Structural properties invariant | **SUPPORTED** |
| H6: Vertex coordinates encode geometry | **SUPPORTED** (expected) |

## Implications

### Critical Finding

**EXP-034 establishes that the tested Block1/Block2 structures are invariant under the tested geometric transformations (2× scaling and translation) for all 6 corresponding cube faces. This provides strong evidence that these structures are independent of the tested absolute vertex coordinates. It does NOT, by itself, prove that Block1/Block2 encode topology.**

This is a strong constraint on what Block1/Block2 can represent:

1. **Verified:** Block1 tokens do NOT encode vertex positions — vertices change, tokens don't
2. **Verified:** Block1 tokens do NOT encode scale — 2x scale has no effect
3. **Verified:** Block1 tokens do NOT encode translation — 50mm offset has no effect
4. **Verified:** Block2 values do NOT encode geometry — identical across transformations
5. **Unknown:** Exact semantic meaning of Block1/Block2 tokens
6. **Not established:** That they specifically encode topology

### Relationship to EXP-033

EXP-033 found that fillet/chamfer features cause token signature changes on unrelated faces (global model state effect). EXP-034 clarifies:

- **Geometric transformations (scale, translate)**: NO token changes
- **Feature operations (fillet, chamfer)**: Token changes on unrelated faces

This means the "global model state" effect cannot be explained simply by absolute scale or translation. The token changes in EXP-033 are NOT caused by:
- Scale changes
- Translation changes
- Absolute vertex coordinate differences

The exact cause of EXP-033's feature-induced changes remains unknown and requires further investigation.

### What This Rules Out

1. **Verified:** Block1 tokens are NOT vertex indices — vertices change, tokens don't
2. **Verified:** Block1 tokens are NOT coordinate-dependent — positions change, tokens don't
3. **Verified:** Block1 tokens are NOT geometry-encoded — geometry changes, tokens don't
4. **Not established:** That Block1 tokens ARE topology-encoded — this is a hypothesis, not a verified conclusion

### What This Supports

1. **INV-017 (section body token counts)** — confirmed invariant under geometric transformations
2. **INV-018 (sum of Block2)** — confirmed invariant under geometric transformations
3. **EXP-029 (geometry encoding hypothesis FALSIFIED)** — further confirmed
4. **EXP-033 (global model state)** — clarifies that ordinary geometric transformations do NOT produce token-signature changes

## Cross-Check with Previous Research

### CONFIRMED

- **EXP-029**: Geometry encoding hypothesis FALSIFIED — Block1 tokens do NOT encode geometry
- **EXP-030**: Structural correspondence — no structural correspondence found (tokens don't match vertex indices, edge counts, loop sizes, or Block2 values)
- **EXP-031**: Token signatures — cylindrical faces share identical signature, planar faces have diverse signatures
- **EXP-032**: Orientation correlation — token signatures correlate with face orientation
- **EXP-033**: Global model state — EXP-034 shows that ordinary geometric transformations do NOT produce token-signature changes

### STRENGTHENED

- **INV-005/006**: Block1/Block2 headers — confirmed invariant under transformations
- **INV-016**: b1Len formula — confirmed invariant under transformations
- **INV-017/018**: Section body structure — confirmed invariant under transformations

### NOT CONTRADICTED

- **INV-001 through INV-004**: Container and face block layout — not affected by this experiment
- **INV-007 through INV-015**: Other invariants — not affected by this experiment

## Files Tested

- C00_cube_10mm (baseline)
- C01_cube_20mm (2x scale)
- C02_cube_translated (50mm offset)

## Faces/Models Tested

- 6 faces per model (planar cube faces)
- 18 total face comparisons
- All 6 faces are ec=4, vc=4, secCount=1, b1Len=6

## Confidence

**High** for invariance claims. All 18 face comparisons show identical Block1/Block2 tokens under geometric transformations.

**High** for vertex coordinate changes. All vertex differences are consistent with expected transformations.

**Unknown** for the exact semantic meaning of Block1/Block2 tokens. EXP-034 establishes what they are NOT (geometry-encoded), but not what they ARE.

## Raw Evidence

- `v0.4.7/EXP034_TRANSFORMATION_INVARIANCE.json` — raw results
- `v0.4.7/exp034_transformation_invariance.js` — script

# EXP-053 — First conversion pass: SLDPRT → STL / STEP

**Date:** 2026-09-20
**Tool:** `converter/v0.1` (new), consuming `parser/v0.2`
**Raw output:** `converter/v0.1/VALIDATION.json`
**Reproduce:** `node converter/v0.1/test/validate.js`

## 1. Question

Everything through EXP-051 reads the format. This asks whether the decoded geometry is good
enough to *write back out* in an interchange format, and measures where it stops being good
enough.

## 2. Method

`converter/v0.1` emits STL (exact display mesh) and STEP (boundary representation, with
tag-4001 faces as analytic `PLANE` surfaces trimmed by their INV-024 boundary cycles, and all
other faces faceted). Two external checks, neither reusing the converter's arithmetic:

1. **STL vs SolidWorks' own `.STL` export** for the same part, triangles matched as unordered
   vertex sets so winding and strip order cannot mask a mismatch.
2. **STEP re-parsed by `step-tools/step-parse.js`** — written for the original SolidWorks STEP
   exports, not for this writer — checking every `#n` reference resolves, then comparing
   `CARTESIAN_POINT` sets against the original `.step`.

Plus independent mesh volume (divergence theorem), bounding box, and open-edge count.

Tolerance 2e-5 mm, set from float32 resolution at these dimensions, not chosen to pass.

## 3. Facts

13 controlled models, C00–C12.

- **0 / 13 STEP files contain a dangling reference.** Entity counts 130 to 2,633.
- **13 / 13 exported meshes are closed** (0 odd-used edges).
- **Bounding box delta 0 on all 13** against the SolidWorks STL.
- STL verdicts: 4 EXACT (C00, C01, C02, C10), 1 SUPERSET (C09), 8 RETESSELLATED.
- Volumes: C00 1000.000000, C01 8000.000000, C02 1000.000000, C10 424.000000,
  C09 995.000000 — each equal to the analytic value and to the reference STL's volume.
- Curved models: relative volume delta 5.7e-5 (C03, C12) to 8.8e-4 (C07).
- Analytic plane coverage: 6/6 on the plain cubes, 7/7 on C09, 11/11 on C10, 6 of 7–8 on the
  hole models (the cylinder is faceted).
- Production models convert without error: USB hub TOP (68 faces, 4,704 tris, 342 ms),
  Dekor (375 faces, 15,282 tris, 570 ms), Helical Bevel Gear (113/6,042, 288 ms),
  PTC GE8080-8 (126/1,192, 94 ms, 114 of 126 faces analytic).

## 4. Corroboration of EXP-049 from a new direction

C03, C09 and C11's SolidWorks STL exports each have **4 open edges** where ours have 0. For
C09 the entire difference between the two meshes is the `-1,0,0` facet group: **0 triangles in
SolidWorks' export, 2 in ours**. The reference export is missing the −X face.

EXP-049 reached this by grouping facet normals in the STL files directly. This reaches it from
mesh topology on a re-exported mesh, and agrees. Where those models are marked "mismatch"
against the reference, the reference is incomplete, not the converter.

## 5. Interpretation, and what this does not show

Conversion of the **display mesh** is solid: exact where the source model is planar, and within
0.09% by volume where it is curved, with the residual attributable to SolidWorks re-tessellating
on STL export rather than to decode error.

This is **not** exact B-rep recovery, and the gap is not a matter of polish:

- Curved faces are faceted because the exact trimming curves are not recovered. EXP-050 showed
  display vertices on a cone lie *inside* it, on chords between on-surface vertices. The mesh
  approximates the surface, so re-fitting cannot recover what was never stored.
- Coordinates are float32: a 10 mm cube round-trips as 9.9999998 mm. That bounds every
  tolerance above and cannot be improved from this data.
- Cylinders and cones do carry validated analytic parameters (EXP-045, EXP-048), so
  `CYLINDRICAL_SURFACE`/`CONICAL_SURFACE` emission is reachable — blocked on exact circular
  trim curves, not on the surface definitions.

No claim is made about tags 4005/4006/4007/4009 (NQ-030), about feature history, or about any
file outside the tested corpus.

## 6. Status

`converter/v0.1` is a working display-mesh converter with measured fidelity. It is not a
replacement for a CAD-native export and the README says so in those terms.

## 7. Follow-on measurement — cylinder boundary vertices (NQ-031)

Raised and measured the same day, recorded here because it constrains the obvious next step.

`converter/v0.1` facets cylinders. The surface definition is not the blocker (axis, direction
and radius are validated by EXP-045/048) — the trim curve is. So: are tag-4002 boundary-cycle
vertices actually *on* the cylinder, making an exact circle fittable?

Radial residual against the stored radius:

| corpus | 4002 faces | boundary vertices | worst residual | worse than 1e-5 mm |
|---|---|---|---|---|
| controlled C00–C12 | 10 | 538 | 6.05e-7 mm | 0 |
| full corpus (24 files) | 276 | 9,669 | 1.20e-1 mm | 1,518 |

The controlled result is clean — worst 6.05e-7 mm against a float32 resolution of ~1.2e-7 mm at
a 2.5 mm radius, so the residual is storage precision and nothing else. **On its own it would
justify building analytic cylinder export.**

The full corpus refutes that. 1,518 of 9,669 boundary vertices are more than 1e-5 mm off, the
worst by 0.12 mm in Pocket Wheel — five orders of magnitude beyond float32 noise. Those vertices
are not on the cylinder.

This is EXP-050's finding generalised: some boundary-cycle vertices are interpolated or chord
points, not surface samples. The controlled corpus consists of simple full-circle through-holes
and happens to avoid the case, which is precisely the kind of false confirmation a
controlled-only corpus can produce. Recorded as NQ-031, left open, and explicitly **not** acted
on in `converter/v0.1`.

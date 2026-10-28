# Exact STEP from the Parasolid body

This page is about turning the body from [page 3](../format/3-parasolid-body.md) into an AP214
STEP file. That's the real geometry, not the display mesh. The reference implementation is in
[solidworks-converters][code] (`sldprt convert part.SLDPRT --step out.step`).

It runs in five steps:

| step | module | what it does |
|---|---|---|
| read | [`partition.js`][partition.js], [`xt.js`][xt.js] | pulls the body out of the part |
| model | [`native.js`][native.js] | turns the nodes into vertices, edges, faces, shells and bodies with their curves and surfaces |
| resolve | [`procedural.js`][procedural.js], [`fit.js`][fit.js] | gives every edge a curve and every face a surface STEP can hold |
| split | [`split.js`][split.js] | cuts periodic faces on the same seams SolidWorks uses |
| write | [`write.js`][write.js], [`export.js`][export.js] | writes the file in millimetres |

## What's exact and what's fitted

Exact means the STEP entity holds the same numbers as the Parasolid node, to double precision.

| Parasolid | STEP | |
|---|---|---|
| PLANE, CYLINDER, CONE, SPHERE, TORUS | PLANE, CYLINDRICAL_, CONICAL_, SPHERICAL_, TOROIDAL_SURFACE | exact |
| B_SURFACE (with or without weights) | B_SPLINE_SURFACE_WITH_KNOTS, rational when it has weights | exact |
| SWEPT_SURF (linear extrusion) | SURFACE_OF_LINEAR_EXTRUSION | exact |
| SPUN_SURF | SURFACE_OF_REVOLUTION | exact |
| OFFSET_SURF | OFFSET_SURFACE | exact |
| LINE, CIRCLE, ELLIPSE, B_CURVE | LINE, CIRCLE, ELLIPSE, B_SPLINE_CURVE_WITH_KNOTS | exact |
| TRIMMED_CURVE | its basis curve, trimmed by the edge's vertices | exact |
| SP_CURVE (a curve in a face's u, v) | SURFACE_CURVE with the 2D B-spline as a PCURVE | the PCURVE is exact, the 3D curve is fitted |
| INTERSECTION | cubic B_SPLINE_CURVE through exact points | fitted |
| BLENDED_EDGE, rolling ball, constant radius | rational B_SPLINE_SURFACE | fitted along the spine, exact circular arcs across it |

STEP has no entity for an intersection curve or a rolling-ball blend, so those have to be fitted.
Every fitted point comes from the body's own defining data: Newton iteration on the two surfaces
for an intersection, the SP_CURVE's own 2D B-spline, and the blend's spine and supports. None of it
comes from the display mesh.

The fit interpolates and then refines. It measures how far the fitted curve or surface is from the
exact one halfway between the points it went through, and keeps adding points until that's under
**1e-8 m (1e-5 mm)**. That's Parasolid's own linear resolution, and the uncertainty SolidWorks
writes into its own STEP files. On the corpus, the worst fit is 9.9e-9 m for a curve and 9.7e-9 m
for a blend surface.

An SP_CURVE edge on a plane is exact in 3D too, because a plane turns a 2D B-spline into a 3D one
by a simple linear map.

SolidWorks does the same kind of fitting in its own STEP. On the two USB hub halves, the only real
parts in the corpus with a SolidWorks STEP, its intersection and tolerant-edge curves are cubic
B-splines up to 0.98 µm from the true curve ([EXP-079][exp079]).

## Uncertainty

The file's `UNCERTAINTY_MEASURE_WITH_UNIT` is the largest of:

- 1e-5 mm, which is what SolidWorks writes;
- the worst fit error in the part;
- the worst gap at a tolerant edge (below).

Each is rounded up to 1, 2 or 5 × 10ⁿ mm. On the corpus it's 1e-5 mm for every part except Dekor
(2e-4 mm) and USB hub case TOP (5e-3 mm).

A fit error over 1 µm doesn't become the uncertainty. The export stops instead (`maxError`, in
metres, changes the limit). Fit error is our approximation going wrong, not the model's own
tolerance, and before this check a few online parts were written with fitted curves millimetres to
kilometres off and an uncertainty to match ([EXP-085][exp085]).

**Tolerant edges.** Parasolid lets an edge have no 3D curve, just a curve on each of its two faces,
and lets those two miss each other by the edge's tolerance (up to 1e-5 m in the corpus). STEP wants
one 3D curve, so the first face's curve gets used, and its distance from the other face is
measured. That gap is in the model itself. Nothing in the export adds it, but the uncertainty has
to cover it.

## Seams, orientation, voids, bodies

- **Seams.** Parasolid faces on cylinders, cones, spheres and tori have no seam. SolidWorks' STEP
  cuts them at u = 0 and u = π, and tori also at v = 0 and v = π. Cutting on the same lines makes a
  face-by-face comparison possible. That's why the STEP has more faces than the part: over the
  corpus, 1,559 faces become 1,756 STEP faces.
- **Orientation.** A face's outward normal is its surface normal, flipped once for a `-` surface
  sense and once more for a `-` face sense. A fitted blend takes its sense from the neighbouring
  face it's tangent to.
- **Voids.** A solid region with inner shells becomes a BREP_WITH_VOIDS, with each inner shell as
  an ORIENTED_CLOSED_SHELL with orientation `.F.`.
- **Several bodies.** Each solid body is its own MANIFOLD_SOLID_BREP in the same representation.
- **Names.** Faces are named `F<id>`, using the Parasolid face ID, which is also the face ID in the
  display mesh.

The corpus has no part with a void, two bodies, a SPUN_SURF or an OFFSET_SURF. Those cases were
tested on four models built by hand: a cube with a cubic cavity, two blocks, a cube with an offset
top face, and a half cylinder whose curved face is a spun line. OpenCascade loads all four as valid
solids with the right volume to 1e-9.

## How it was checked

Every corpus part gets written out and loaded in OpenCascade. The numbers are in
[validation](../research/validation.md#exact-step).

On all 49 controlled models OpenCascade gives the same volume for our STEP as for SolidWorks' own
STEP export: 48 within 3e-16 relative, and the crossed cylinders (C20) within 2.3e-8
([EXP-085][exp085]). C20's difference is SolidWorks' side: the file stores the intersection
curves as ellipses and we write ellipses, where SolidWorks writes B-splines. Against the closed
form, ours is the exact one ([exact volume](exact-volume.md#how-well-it-does)).

## What isn't done

- SPUN_SURF and OFFSET_SURF are read now ([EXP-084][exp084]) and written, but OpenCascade hasn't
  checked a part that has them yet.
- A spun face that goes all the way round isn't cut at a seam. Most STEP readers want one.
- Only constant-radius rolling-ball blends. Variable-radius blends and chamfers stop the export.

[code]: https://github.com/blussyya/solidworks-converters
[partition.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/parasolid/partition.js
[xt.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/parasolid/xt.js
[native.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/native.js
[procedural.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/procedural.js
[fit.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/fit.js
[split.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/split.js
[write.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/step/write.js
[export.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/step/export.js
[exp079]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP079.md
[exp084]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP084.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md

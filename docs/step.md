# Exact STEP export

`sldprt convert part.SLDPRT --step out.step` and `toSTEP(file)` write the Parasolid body stored
in the part as an AP214 B-rep. That's the real geometry, not the display mesh. The old mesh
output is still there behind `--mesh` and `--faceted`.

The pipeline is four modules, all plain JavaScript that runs in Node and in the browser:

| step | module | what it does |
|---|---|---|
| read | `src/parasolid/partition.js`, `xt.js` | pulls the body out of `Config-0-Partition` ([parasolid.md](format/parasolid.md)) |
| model | `src/brep/native.js` | turns the nodes into vertices, edges, faces, shells and bodies with their curves and surfaces |
| resolve | `src/brep/procedural.js`, `fit.js` | gives every edge a curve and every face a surface STEP can hold |
| split | `src/brep/split.js` | cuts periodic faces at the seams SolidWorks uses |
| write | `src/step/write.js`, `export.js` | writes the file in millimetres |

## What's exact and what's fitted

Exact means the STEP entity holds the same numbers as the Parasolid node, to double precision.

| Parasolid | STEP | |
|---|---|---|
| PLANE, CYLINDER, CONE, SPHERE, TORUS | PLANE, CYLINDRICAL_, CONICAL_, SPHERICAL_, TOROIDAL_SURFACE | exact |
| B_SURFACE (with or without weights) | B_SPLINE_SURFACE_WITH_KNOTS, rational when weighted | exact |
| SWEPT_SURF (linear extrusion) | SURFACE_OF_LINEAR_EXTRUSION | exact |
| SPUN_SURF | SURFACE_OF_REVOLUTION | exact |
| OFFSET_SURF | OFFSET_SURFACE | exact |
| LINE, CIRCLE, ELLIPSE, B_CURVE | LINE, CIRCLE, ELLIPSE, B_SPLINE_CURVE_WITH_KNOTS | exact |
| TRIMMED_CURVE | its basis curve, trimmed by the edge's vertices | exact |
| SP_CURVE (curve in a face's u, v) | SURFACE_CURVE with the 2D B-spline as a PCURVE | PCURVE exact, 3D curve fitted |
| INTERSECTION | cubic B_SPLINE_CURVE through exact points | fitted |
| BLENDED_EDGE, rolling ball, constant radius | rational B_SPLINE_SURFACE | fitted along the spine, exact circular arcs across |

STEP has no entity for an intersection curve or a rolling-ball blend, so those get fitted. Every
fitted point is computed from the body's own defining data: Newton iteration on the two
surfaces for an intersection, the SP_CURVE's own 2D B-spline, the blend's spine and supports.
Nothing comes from the display mesh.

The fit is interpolation with adaptive refinement. It measures the distance from the exact
geometry to the fitted one halfway between the interpolation points and adds points until that
distance is under **1e-8 m (1e-5 mm)**. That's Parasolid's own linear resolution and the
uncertainty SolidWorks writes into its STEP files. On the corpus the worst fit error is
9.9e-9 m for a curve and 9.7e-9 m for a blend surface.

An SP_CURVE edge on a plane is exact in 3D too: a plane maps a 2D B-spline to a 3D one by an
affine map.

## Uncertainty

The file's `UNCERTAINTY_MEASURE_WITH_UNIT` is the largest of:

- 1e-5 mm, what SolidWorks writes;
- the worst fit error in the part;
- the worst gap at a tolerant edge (below),

each rounded up to 1, 2 or 5 × 10ⁿ mm. `report.uncertaintyMM` gives the number. On the corpus
it's 1e-5 mm for every part except Dekor (2e-4 mm) and USB hub case TOP (5e-3 mm).

**Tolerant edges.** Parasolid lets an edge have no 3D curve, only a curve on each of its two
faces, and lets those faces miss each other by the edge's tolerance (1e-5 m in the corpus). STEP
needs one 3D curve, so we take the first face's and measure how far it is from the other face.
That gap is in the model itself, not something we added, and the uncertainty has to cover it.

## Seams, orientation, voids, bodies

- **Seams.** Parasolid faces on cylinders, cones, spheres and tori have no seam. SolidWorks' STEP
  cuts them at u = 0 and u = π, and tori also at v = 0 and v = π. We cut them on the same lines,
  so a face-by-face comparison works. That's why the STEP has more faces than the part: 1,559
  native faces become 1,756 STEP faces over the corpus.
- **Orientation.** A face's outward normal is the surface's normal, flipped once for a '-'
  surface sense and once for a '-' face sense. Fitted blends take their sense from the
  neighbouring face they're tangent to.
- **Voids.** A solid region with inner shells becomes a BREP_WITH_VOIDS, each inner shell an
  ORIENTED_CLOSED_SHELL with orientation .F..
- **Several bodies.** Each solid body is its own MANIFOLD_SOLID_BREP in the same representation.
- **Names.** Faces are named `F<id>`, the Parasolid face id, which is also the face id in the
  display mesh.

The corpus has no part with a void, two bodies, a SPUN_SURF or an OFFSET_SURF. Those paths are
tested on models built by hand (`test/helpers/synthetic.js`): a cube with a cubic cavity, two
blocks, a cube with an offset top face, and a half cylinder whose curved face is a spun line.
OpenCascade loads all four as valid solids with the right volume to 1e-9.

## Checking it

`node tools/validate.js` writes our STEP for every corpus part and has OpenCascade check it. The
numbers are in [validation.md](validation.md#exact-step-export). It needs a Python with
`cadquery-ocp`, which is dev tooling only and never a dependency of the package:

```sh
SLDPRT_OCP_PYTHON=/path/to/venv/bin/python node tools/validate.js
```

Without one, `npm test` reports the OpenCascade tests as skipped.

## What's not done

- SPUN_SURF and OFFSET_SURF are written correctly, but the XT reader doesn't have their field
  layouts yet because no corpus file has one. The reader stops with an error on a part that uses
  them.
- A spun face that goes all the way round isn't cut at a seam. Most STEP readers want one.
- Only constant-radius rolling-ball blends. Variable-radius blends and chamfers stop the export
  with an error.
- Parts older than 2011 have no partition we can find, so they can't be exported.

# Exact volume from the Parasolid body

The enclosed volume of a part can be worked out straight from its surfaces and curves, with no
mesh anywhere. The reference implementation is [`volume.js`][volume.js] in solidworks-converters
(`sldprt brep part.SLDPRT --volume`).

## How it works

The divergence theorem turns the volume into a sum over the faces. Green's theorem then turns each
face into an integral around its boundary, in the surface's own (u, v) parameters. The
parametrisations are Parasolid's own, and the tolerant-edge check on [page 3](../format/3-parasolid-body.md#curves-that-arent-on-the-edge)
confirms them for planes, cylinders, tori and B-spline surfaces: each fin curve, mapped through its
surface, lands on its stored trim points to 1e-16 m.

Faces on cylinders, cones, spheres and tori are cut at the same seams the STEP writer uses
([`split.js`][split.js]) before they're integrated. Integrated whole, a face whose loops don't
simply go round the axis came out wrong: a sphere face with three circular holes gave 0, and a
cylinder face with a slit edge used in both directions gave 2.7 times the volume
([EXP-085][exp085]). If the cut fails, `volume` refuses instead of integrating the uncut face.

### Edges that aren't quite on their faces

Parasolid lets an edge sit a little off its faces and records a tolerance for it. The loft
control C16 is the clearest case. Its top edges are exact circles of 4 mm radius, but the side
faces are B-spline patches whose top rows are cubics up to 0.83 µm inside the circles (Parasolid
gives those edges 2.07 µm). SolidWorks' STEP export has the same gap.

That matters for a divergence-theorem volume, because the result only stops depending on the
origin once the faces close. Here they didn't: each side face ran up to the point on the patch
nearest the circle, the top plane ran out to the circle, and a strip under a micrometre wide was
left uncovered. Moving the origin 1 mm along the loft's axis moved the volume by 0.0028 mm³.

The integrator now adds, for each face along such an edge, the thin ribbon from the face's own
boundary to the edge curve, so the shell closes. On B-spline faces it also follows the boundary
at the right speed: when the edge is off the surface, how fast the nearest point moves depends on
how the surface curves. With both in, moving the origin changes the loft's volume by 2e-7 mm³
per mm.

## How well it does

| check | result |
|---|---|
| against SolidWorks' own STEP, 47 controlled models | worst 4e-14 relative ([EXP-085][exp085]) |
| C20, two crossed cylinders, against 2πr²L − 16r³/3 | 1.6e-15 |
| C16 loft, against a watertight rebuild in OpenCascade | 2e-9 |
| values worked out by hand (cubes, shell, chamfer, holes, cone, sphere, torus, half cylinder), 24 files | worst 4.3e-15 ([EXP-076][exp076]) |

The two controls left out of the first row are the ones where SolidWorks' STEP isn't exact. In C20
the file stores the four intersection curves as ellipses, and so does our STEP; SolidWorks' STEP
writes them as B-splines, and OpenCascade's volume of it is 2.1e-8 high.

For C16 the reference is a version of the loft that closes by construction. It's rebuilt in
OpenCascade from the four full side patches, the original bottom, and a top face bounded by the
patches' own top rows instead of the circles. That solid sews with no free edges.

| | 2011 loft | 2022 loft |
|---|---|---|
| OpenCascade, SolidWorks' STEP (doesn't close) | 893.827180 mm³ | 739.818761 mm³ |
| this integrator | 893.819774 | 739.806315 |
| OpenCascade, watertight rebuild | 893.819774 | 739.806316 |

OpenCascade's own answer on the unclosed STEP looks steady when you move the part, but only
because it centres the integral on the part itself. It ignores the reference point you give it.

## Real parts

`volume` resolves the body first: intersection curves and blends get exact fitted curves from the
[STEP page](exact-step.md), then everything integrates. Four online parts were checked against
OpenCascade on our STEP after the seam cut went in; the three without toleranced edges agree to
1e-10. For the fourth, `065f38b0`, a four-segment pipe elbow with toleranced edges, the volume moved by 0.94 mm³
with the origin before the gap closing and by 4e-4 mm³ (7e-10) after.

[split.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/split.js
[volume.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/volume.js
[exp076]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP076.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md

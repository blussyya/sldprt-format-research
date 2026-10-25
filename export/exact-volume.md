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

A whole sphere or torus has no boundary to integrate around, so it gets cut along seams first, the
way SolidWorks' STEP export cuts it ([`seams.js`][seams.js]).

## How well it does

All numbers here are from [EXP-076][exp076] unless they say otherwise.

| check | result |
|---|---|
| against SolidWorks' own STEP, 49 controlled models | worst difference 5.6e-15 relative |
| against values worked out by hand (cubes, shell, chamfer, holes, cone, sphere, torus, half cylinder, crossed cylinders), 24 files | worst 4.3e-15 relative |
| OpenCascade equals ours to 1e-12 | 47 of 49 |

Both misses are C20, two crossed cylinders. OpenCascade gives three different volumes for three
ways of cutting up the same solid, all about 1e-4 mm³ off the hand-worked value. Ours is 3e-12 off.

The C16 loft is a special case. Its boundary circles are Parasolid tolerant edges: 1.9e-8 m off the
surface, with 2.07e-6 m declared. So its volume is only defined to about 0.025 mm³, and SolidWorks,
OpenCascade and this integrator all land inside that.

## Real parts

The integrator in solidworks-converters handles bodies made of the exact curves and surfaces
only. On the real parts that means PTC GE8080-8 (81,662.186 mm³), cube.SLDPRT (64,000 mm³) and
plate4 (38,400,000 mm³). Parts with intersection curves, tolerant edges, swept surfaces or blends
need the curves from the [STEP page](exact-step.md) first. Until then it says which of those it
met instead of giving a number.

[EXP-078][exp078] extended the integrator to all of those, and ran it on every real part with a
solid. That version isn't in solidworks-converters yet. There's no SolidWorks volume for the real
parts, so the check is against OpenCascade. OpenCascade's exact volume agrees with ours to 3e-8
relative or better on every part except two. On Dekor it moves by 0.7 % with its own tolerance
setting, while its triangulated volume closes in on ours. On USB hub TOP the difference is 3.4e-7,
which is about as precisely as its tolerant edges (fin curves 1.76 µm apart) define the volume at
all.

[volume.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/volume.js
[seams.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/brep/seams.js
[exp076]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP076.md
[exp078]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP078.md

# 4. The mesh and the body together

The display mesh ([page 2](2-display-mesh.md)) and the Parasolid body ([page 3](3-parasolid-body.md))
were decoded by two readers written separately. Neither was built to make them agree, and yet three
things hold on all 1,414 modern faces ([EXP-074][exp074]):

1. **Identity.** The face ID in the display surface record is the body's `FACE.node_id`, on 1,414
   of 1,414 faces. The edge table, and the face's nonzero Block1 IDs, are exactly the `node_id`s of
   the body edges around that face. The edge-table check covers 1,408 faces. The other 6 are C23's
   empty tables, where Block1 still matches. The ID is unique within a body, not within a part, so
   on parts with several bodies a join by ID alone can pick the wrong face
   ([page 2](2-display-mesh.md#face-ids-repeat-across-bodies)).
2. **Type.** Each display tag maps to exactly one Parasolid surface type, including 4007 →
   BLENDED_EDGE and 4009 → SWEPT_SURF. That's how those two tags got their names.
3. **Geometry.** On analytic faces, the display mesh lies on the body's surface. The display
   normals agree with the outward surface normal: 88,257 agree and 0 point the other way. That
   count includes the 2011 models. The 240 normals that aren't defined sit at cone apexes.

## Files without face IDs

SolidWorks 2011 meshes and older ones have no surface record, so no face ID. Their Block1 edge IDs
are still the body's EDGE `node_id`s, and the set of edge IDs on a display face matches exactly one
body face ([EXP-078][exp078]):

| file | edge IDs that are body edges | display faces matched to one body face |
|---|---|---|
| SW2011 C04 | 28 of 28 | 7 of 7 |
| SW2011 C16 | 24 of 24 | 6 of 6 |
| SW2011 C20 | 16 of 16 | 8 of 8 |
| chainwheel (pre-2011) | 1,092 of 1,092 | 189 of 189 |

So any mesh with edge IDs can be joined to its body. Over the 72 parts with a solid, that joins
1,762 faces with none left over: 1,414 by face ID, 328 by edge set and 20 by geometry. The 20 are
plate4's 14 faces, whose mesh has no edge IDs at all, and the edgeless whole spheres and tori in
the 2011 models.

The two fallbacks were tested on files where the answer is known. Strip the face IDs from the
modern parts and the edge-set join gets 1,410 of 1,410 faces right. Strip the edge tables too, on
modern parts up to 150 faces, and the geometry join gets 625 of 625 right.

## How close the mesh sits to the surface

| surface (modern, joined by ID) | faces | every vertex within 1e-6 m |
|---|---|---|
| plane | 645 | 645 (worst 2.5e-8 m) |
| cylinder | 292 | 120 |
| cone | 48 | 28 |
| sphere | 1 | 1 |
| torus | 38 | 2 |

The faces that aren't fully on their surface come down to where the mesh puts its boundary points.
An edge's polyline is shared by the two faces on either side, and it's drawn as straight segments,
so on a curved surface it sits slightly inside. Declared tolerances don't explain it. On the 2022
controlled models, all 158 off-surface vertices are chord points like this ([EXP-074][exp074]).

EXP-078 counted this on the real parts with a looser and fairer test: a boundary vertex counts as
a chord point if it lies on the straight line between its two neighbours along the edge, within
float32 resolution ([EXP-078][exp078]).

| | 8 modern parts | chainwheel | plate4 | total |
|---|---|---|---|---|
| vertices | 69,344 | 4,658 | 82 | 74,084 |
| on the surface (1e-6 m) | 62,927 | 3,768 | 82 | 66,777 |
| boundary chord points | 6,241 | 824 | 0 | 7,065 |
| boundary, not a chord point | 2 (USB TOP) | 9 | 0 | 11 |
| inside the face, off the surface | 174 | 57 | 0 | 231 |

That leaves **231 interior vertices and 11 boundary vertices unexplained**: Dekor 59 (up to 25 µm),
chainwheel 57, Helical Bevel Gear 47, USB TOP 38, Pocket Wheel 27, distributor 3. One Pocket Wheel
blend vertex is 1.5e-5 m off the exact rolling-ball surface.

### Curved faces in three online parts

A later look at cylinder and cone faces in `8cd79ff5`, `2f121983` and `a4ecc6f5` found the same
cause at larger scale. Measured, not blind-checked ([EXP-105][exp105]).

Every vertex that isn't shared with a neighbouring face is within 1e-9 m of the joined surface
(largest 9.8e-10 m). The vertices that are off it are shared boundary vertices, and they sit on
straight chords of this face's boundary rather than on the surface:

| part | vertices over 1e-9 m | on a chord of their own face |
|---|---:|---:|
| `8cd79ff5` | 619 of 2,419 | 619 |
| `2f121983` | 987 of 3,403 | 814 |
| `a4ecc6f5` | 2,338 of 4,586 | 1,439 |

In `8cd79ff5` face 1462 (a cylinder, radius 3.24 mm), 10 of 14 vertices are at 1e-11 m and 4 sit
1.10e-5 m inward, in pairs, one per rim, at one angle. Controls: a lone cone (C13) has 144
vertices, none off, with a maximum of 1.8e-10 m; C04 and C19 have none; the crossed cylinders (C20)
and the cylinder fillet (C21) show the effect, with 20 and 66 vertices off, all on chords and
shared. The radius field, the units, transforms and a stale mesh are ruled out.

It does not explain 173 vertices in `2f121983` and 899 in `a4ecc6f5` that are on no chord of their
own face. A display-to-surface distance check has to leave out vertices shared with other faces,
or test them against the boundary edge, or curved faces fail a 1e-8 m bar for reasons that have
nothing to do with the surface.

So for exact geometry, the body is the source and the mesh isn't. The face and edge IDs connect the
two exactly.

[exp074]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md
[exp078]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP078.md
[exp105]: https://github.com/blussyya/sldprt-research-dump/blob/validation/knowledge/evidence/2026-11-09_v0.5-EXP105.md

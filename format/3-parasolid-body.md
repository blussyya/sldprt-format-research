# 3. The Parasolid body

SolidWorks runs on the Parasolid kernel, and every part keeps its solid as a Parasolid transmit
file inside the SLDPRT. That body is the exact geometry: analytic planes, cylinders, cones, spheres
and tori, B-spline surfaces and curves with their control points and knots, and the full
face–loop–edge–vertex topology. It's stored in a framed, zlib-compressed stream called
`Config-0-Partition`.

The transmit format itself is documented by its owner, in the *Parasolid XT Format Reference*
(UGS, October 2006). In its own words, it's written for people building translators to and from
the format. The SolidWorks packaging around it isn't documented anywhere, and that part was worked
out here.

The reference readers are [`partition.js`][partition.js] (streams, sections, picking the body),
[`xt.js`][xt.js] (the transmit format, which also reads standalone `.x_t` and `.x_b` files) and
[`topology.js`][topology.js] (graph checks).

## Partition streams

### Section frame

Every stream that carries a partition is a chain of sections:

```
u32le size                          size = compressed + 32
16-byte GUID 231dd571-da81-48a2-a858-98b21b89ef99
u32le inflated length
u32le compressed length
zlib member                         compressed bytes
8 zero bytes
```

| stream | sections | chains exactly to the end of the stream |
|---|---|---|
| `Config-N-Partition` | `TRANSMIT FILE (partition)`, then `TRANSMIT FILE (deltas)` | 70 of 70 |
| `Config-N-GhostPartition` | one `(partition)` | 65 of 65 |
| `Config-0-FeatureBodies/LocalBodies` | one plain `TRANSMIT FILE`, after a 64-byte prefix | 1 file |
| `Config-N-ResolvedFeatures` | plain one-face PLANE bodies, 36 sections in 14 files | |

All 242 sections end in eight zero bytes ([EXP-074][exp074]). The same GUID-and-lengths frame,
without the size word, wraps the 2011 `DisplayLists__ZLB` stream
([page 1](1-container.md#the-compressed-stream-frame)).

### Which body is the part

Take the first section of `Config-0-Partition`. If that body has no faces, take the first section
with faces from any other stream that carries the GUID.

The corpus needs that second rule once. PTC GE8080-8's main partition holds nothing but a WORLD
node, and its 126-face body is an imported body in `Config-0-FeatureBodies/LocalBodies`. With the
rule, the body's face count equals the mesh's face count on all 21 original modern parts and all 49
controlled parts. That's what the corpus supports. It isn't a model of configurations or rollback
states.

### The other partition streams

**The ghost partition never holds the solid.** In 61 of the 73 files, `Config-0-GhostPartition`
holds one body made of a single vertex at (0,0,0) with no edges or faces, and an INT attribute
10001 (distributor has six of these, 10001 to 10006). Five files have a partition but no ghost
partition, and the three pre-2011 files have no partitions at all. In the other four, the ghost
partition holds wire and sheet bodies with real geometry and a `GHOST_REF_BODY_ID_2001` attribute
([EXP-078][exp078]):

- C16, both versions: four lines making a 10 mm square, and a circle of radius 4 mm 10 mm above
  it. Those are the loft's two profile sketches. There are also two planes, at the square and at
  the circle, and both are part planes. Every wire edge lies on a part edge.
- Helical Bevel Gear: three flat sheets and 96 circular wire edges. Two of the planes are part
  planes and the third is 0.66 mm from any of them.
- Pocket Wheel: one conical sheet 29 mm from any part cone, plus wires on part edges.

So the ghost partition holds what features were built from: profile sketches, section planes,
reference surfaces. Which feature each body belongs to, and what the lone default vertex stands
for, are still open.

The `(deltas)` section and the ResolvedFeatures bodies are read as sections, but what they're for
hasn't been worked out ([open questions](../research/open-questions.md#partition-streams)).

## The transmit format

There are two encodings of the same content: **text** (`.x_t`) and **neutral binary** (`.x_b`, and
every partition embedded in a part). Binary is big-endian.

### Header

Binary starts with `PS 00 00`, then:

| field | type |
|---|---|
| description length, description (`: TRANSMIT FILE (partition) created by modeller version 3301247`) | u16 + bytes |
| schema name length, schema name (`SCH_3301247_33103_13006`) | u32 + bytes |
| maximum number of node types | u16 |
| user field size, must be 0 | u32 |

A standalone `.x_b` has an ASCII banner first, ending in `**END_OF_HEADER` and a newline. Text files
have the same banner, then `T`, then the same fields as text tokens.

Every modern and 2011 file in the corpus uses base schema **13006**, under five modeller versions:

| schema | files (21 original modern) |
|---|---|
| `SCH_3301247_33103_13006` | 15 |
| `SCH_3501251_35102_13006` | 2 |
| `SCH_3101290_31100_13006` | 2 |
| `SCH_3401247_34101_13006` | 1 |
| `SCH_3201230_32001_13006` | 1 |

Older files are written in schema 13006 itself or in schema 9008. Both are on
[page 5](5-pre-2011.md#the-parasolid-body).

### Schema edits

A file doesn't repeat the field layout of every node type. The first time a node type shows up, it
comes with a description of how its fields differ from the base schema:

- `u8` = 255: same as the base.
- Otherwise `u8` = the number of fields, then an edit script over the base fields: `C` copy, `D`
  delete, `I` insert a new field, `A` append a new field, ending with `Z`.
- A type that has no base layout gets a full declaration: name, description and every field
  descriptor.

A field descriptor is a name (short string), `ptr_class` (i16), an element count (pointer-encoded:
0 means one, 1 means variable length, anything else is a fixed count), the type letter only when
`ptr_class` is 0, and a transmit flag for variable-length fields.

That's how one reader handles both SolidWorks 2011 and 2022 files. The 2022 BODY has three more
pointer fields than the 2011 one, and its edit script says so.

### Nodes

```
u16 node type
[i32 element count]      only for types with a variable-length field
pointer node index       unique, positive
fields                   in schema order
```

The stream ends with node type `1` and index `0`. The reference reader insists on that terminator,
rejects trailing bytes and repeated indices, and stops with the position at anything it can't
describe. It never scans ahead for a marker.

### Values

| letter | binary encoding |
|---|---|
| `u` unsigned byte, `c` char, `l` logical | 1 byte |
| `n` short, `w` unicode unit | i16 |
| `d` integer | i32 |
| `f` double | IEEE binary64 |
| `v` vector, `i` interval, `h` hvec, `b` box | 3, 2, 3, 6 doubles |
| `p` pointer | see below |

**Nulls.** The integer −32764 and the double −3.14158e13 mean null (`?` in text).

**Pointers.** A signed i16 `r`. If `r > 0` the index is `r − 1`, so null is written `0001`. If
`r < 0`, a second positive i16 `q` follows and the index is `q·32767 − r − 1`. A pointer word can
legitimately equal the integer null value, so never run pointers through null conversion.

Text files write logicals as `T` and `F`, and `c` and `l` fields have no space after them.

## What's in a body

| type | node | key fields |
|---|---|---|
| 101 | WORLD | root of a partition: `body`, `highest_id`, `current_id` |
| 12 | BODY | `highest_node_id`, `res_size` (1000), `res_linear` (1e-8), `body_type`, `shell`, `region` |
| 19 | REGION | `shell`, `type` (one solid region, one void) |
| 13 | SHELL | `face`, `edge`, `vertex` |
| 14 | FACE | `surface`, `sense`, `loop`, `tolerance`, `node_id` |
| 15 | LOOP | `face`, `fin`, `next` (more loops are holes) |
| 17 | FIN | half-edge: `loop`, `forward`, `backward`, `other`, `edge`, `vertex`, `sense` |
| 16 | EDGE | `fin`, `curve`, `tolerance`, `node_id` |
| 18 | VERTEX | `point`, `tolerance` |
| 29 | POINT | `pvec` |
| 50 | PLANE | `pvec`, `normal`, `x_axis` |
| 51 | CYLINDER | `pvec`, `axis`, `radius`, `x_axis` |
| 52 | CONE | `pvec`, `axis`, `radius`, `sin_half_angle`, `cos_half_angle`, `x_axis` |
| 53 | SPHERE | `centre`, `radius`, `axis`, `x_axis` |
| 54 | TORUS | `centre`, `axis`, `major_radius`, `minor_radius`, `x_axis` |
| 124 / 126 | B_SURFACE / NURBS_SURF | degrees, vertex counts, knot types, `rational`, periodic and closed flags, control points, knot multiplicities, knots |
| 134 / 136 | B_CURVE / NURBS_CURVE | the same, for curves |
| 30, 31, 32 | LINE, CIRCLE, ELLIPSE | |
| 133 | TRIMMED_CURVE | `basis_curve`, end points and parameters |
| 137 | SP_CURVE | a curve in a surface's parameter space |
| 38, 40, 41 | INTERSECTION, CHART, LIMIT | intersection curves, stored as their defining data (below) |
| 56, 59 | BLENDED_EDGE, BLEND_BOUND | rolling-ball blends |
| 67 | SWEPT_SURF | `section`, `sweep`, `scale` |
| 70, 74, 79–84, 98 | LIST, POINTER_LIS_BLOCK, attributes and value arrays | |

Every surface and curve has the common geometry fields (`node_id`, `owner`, `next`, `previous`,
`geometric_owner`, `sense`). Coordinates are in **metres**. A face's outward side is the surface
normal flipped once for a `-` surface sense and once more for a `-` face sense.

Where the corpus disagrees with the 2006 reference, the corpus wins. Each of these is backed by
complete parses ([EXP-071][exp071]):

- BODY has `nom_geom_state`. The reference's field table lists it, but its C struct leaves it out.
- EDGE has one attributes pointer. The C struct lists it twice.
- ELLIPSE has the common `sense` field. The C struct leaves it out.
- LIST's base fields are a nine-field reconstruction from the edit scripts in the files. Reading
  every file all the way through backs it up, but there was no separate schema file to check it
  against.

A few more conventions came out of writing the body back out as STEP ([EXP-078][exp078]). In the
corpus, SWEPT_SURF is always a linear extrusion. Rational control points are stored homogeneous
(already multiplied by their weight). A trimmed curve runs in the direction of its own sense times
its basis curve's sense. A plane's (u, v) is `pvec + u·x_axis + v·(normal × x_axis)`.

### Faces and loops with no edges

Two kinds of face have boundaries that are easy to trip over:

- **A cone's apex** is a loop with one fin and no edge, so the loop is a single vertex.
- **A whole sphere or torus** is one face with no loops at all.

Neither has a direct form in STEP, which wants every face bounded by edges. SolidWorks' own STEP
export splits such faces along seams ([EXP-076][exp076]).

## Curves that aren't on the EDGE

On most edges the EDGE node points straight at a line, circle, ellipse or B-spline. Real parts
have two kinds of edge that don't ([EXP-077][exp077]).

**INTERSECTION curves** (node type 38) are the curve where two surfaces meet. The node holds:

- `surface[2]`: the two surfaces;
- `chart`: a CHART node (type 40) with `chart_count` points (`hvec[]`, three doubles each) along
  the curve, and the errors they were made to: `chordal_error`, `angular_error`, `parameter_error[2]`;
- `start`, `end`: LIMIT nodes (type 41) that set where the curve stops.

The seven parts that have them hold 394 intersection curves. On the 392 whose two surfaces we can
evaluate (the other two touch a blend), all 2,170 chart points lie on **both** surfaces to 3e-15 m.
So the chart is a list of 2 to 20 exact points on the true curve, and `chordal_error` says how far
the straight lines between them stray from it (up to 2.5 mm, in Helical Bevel Gear). The exact
curve is the intersection of the two surfaces, and the chart is where to start tracing it. Charts
alone aren't accurate enough to write out.

Each INTERSECTION belongs to exactly one edge, and its chart runs a little past the edge's
vertices. A LIMIT of type `H` with start equal to end marks a closed curve ([EXP-078][exp078]).

**Tolerant edges** (20 in Dekor, 7 in USB hub TOP) have `curve` set to null and a nonzero
`tolerance` (5e-7 m in Dekor, 1e-5 m in USB TOP). Each of the edge's two FINs carries its own
curve instead:

```
FIN.curve → TRIMMED_CURVE (point_1, point_2, parm_1, parm_2)
          → SP_CURVE (surface, b_curve)
          → B_CURVE → NURBS_CURVE, with 2D (u,v) control points in that surface's parameters
```

So the edge is stored twice, once drawn on each face it separates. Evaluated through its surface,
each fin curve hits the stored trim points to 1e-16 m (54 of 54). The two copies stay within the
edge's tolerance of each other (27 of 27 edges, at worst 0.21 µm apart in Dekor and 1.76 µm in USB
TOP).

## How well it reads

| set | result |
|---|---|
| 49 controlled models, `.x_t` and `.x_b` exports (98 files) | every file parses to its terminator; 28,428 graph checks, 0 failures; face counts equal SolidWorks' own |
| the same 49 models' embedded partitions | 8,209 nodes, 287 faces, 14,262 graph checks, 0 failures; face counts equal the exports' |
| 21 original modern parts | 43,158 nodes, 1,272 faces, 0 graph failures |
| C00 cube, both versions | 6 planes, 12 edges, 8 vertices, Euler characteristic 2, loops facing outward, corners exactly at 0 and 0.01 m, volume exactly 1e-6 m³ |

The graph checks cover who owns each face and loop, closed fin rings, forward and backward fins
that point at each other, edges with two fins of opposite sense, vertex points, and B-spline
control-point and knot array sizes with knots that go up.

**The text and binary exports differ only in IDs.** A model's `.x_t` and `.x_b` are two separate
exports. Across all 49 pairs they differ only in 24 `BODY.highest_node_id` values and 308
attribute node IDs, plus floating-point noise up to 1.1e-13. No FACE ID differs.

**It matches SolidWorks' own STEP.** On all 49 controlled models, the body decoded from the SLDPRT
matches the `model.step` SolidWorks exported from the same part, face for face, edge for edge and
vertex for vertex. The worst difference is 9e-18 m, which is double-precision rounding of the same
numbers printed in millimetres. The checks:

- every vertex in the body is a STEP vertex;
- every STEP edge lies on exactly one body edge's curve, inside its extent;
- the STEP pieces of each body edge add up to its exact length;
- every STEP face lies on one body face's surface, on the same side;
- the two faces of every edge correspond.

The only differences are seams. STEP splits closed faces (cylinders, cones, spheres, tori) along
seam edges, so 287 faces in the bodies become 331 STEP faces through 90 seams. Even the B-spline
loft surfaces have identical control points and knots. Twenty deliberate errors of 1e-7 m or less,
four of them wrong-model pairings, all get caught, so the agreement isn't a loose test letting
things through ([EXP-075][exp075]).

**The embedded body and the exported one.** Compared node graph against node graph from the BODY
down, the body inside the part equals the exported one on 47 of 49 models. The two lofts (C16, in
both versions) differ: the embedded `nom_geom_state` is 2 where the export has 1, and several curve
references and types differ ([EXP-072][exp072]).

[partition.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/parasolid/partition.js
[xt.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/parasolid/xt.js
[topology.js]: https://github.com/blussyya/solidworks-converters/blob/main/src/parasolid/topology.js
[exp071]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP071.md
[exp072]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP072.md
[exp074]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md
[exp075]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP075.md
[exp076]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP076.md
[exp077]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP077.md
[exp078]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP078.md

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
u32le size                          bytes after this word
16-byte GUID 231dd571-da81-48a2-a858-98b21b89ef99
chunks, each:
  u32le inflated length
  u32le compressed length
  zlib member                       compressed bytes
8 zero bytes
```

The body is the chunks' output joined. Most sections have one chunk, so size = compressed + 32.
A body over 1 MiB comes as a 1 MiB chunk and then either 4 KiB chunks or one remainder: 1,142,601
bytes in 24 chunks, 1,863,177 bytes in 2 ([EXP-084][exp084]).

| stream | sections | chains exactly to the end of the stream |
|---|---|---|
| `Config-N-Partition` | `TRANSMIT FILE (partition)`, then `TRANSMIT FILE (deltas)` | 70 of 70 |
| `Config-N-GhostPartition` | one `(partition)` | 65 of 65 |
| `Config-N-FeatureBodies/LocalBodies` | one plain `TRANSMIT FILE` per imported body, with other data between them | not a chain |
| `Config-N-ResolvedFeatures` | plain one-face PLANE bodies, 36 sections in 14 files | |

All 242 sections end in eight zero bytes ([EXP-074][exp074]). The same GUID-and-lengths frame,
without the size word, wraps the 2011 `DisplayLists__ZLB` stream
([page 1](1-container.md#the-compressed-stream-frame)).

### Which body is the part

**First, which configuration.** A part keeps a `Config-N-Partition` for every configuration that
was rebuilt, and they can be quite different: one online part has configurations 0 to 3 with 378,
318, 777 and 13 faces, and its mesh shows 13. The one to read is the one active at save time.
`Header2` is a copy of that configuration's `Contents/Config-N-ModelHeader` (only the document
name can differ, after a rename), so pick the ModelHeader that matches it best. On the two
online parts where it matters, the match is exact for one configuration and at most 0.874 for
any other ([EXP-084][exp084]).

Files from before about SolidWorks 2020 have no ModelHeader streams, and nothing else found so far
says which configuration was active. The reference reader takes the lowest N then. In the
corpus those configurations all have the same face count, but they can still differ in size.

**Then, which bodies.** The bodies are the first section of that `Config-N-Partition` plus the
ones in `Config-N-FeatureBodies/LocalBodies`: imported bodies, one per section, with other data
between the sections. An online part with an empty partition has 8 LocalBodies of 70, 201, 219,
31, 22, 444, 117 and 13 faces, and its mesh has 1,117.

Not every body there is in the finished part. Each one carries an INT attribute
`BODY_IN_LIGHTWEIGHT_PERM`, and SolidWorks sets it to 0 on a body that isn't: an imported body a
later feature used up, or a surface body kept for reference. In one part, a LocalBody flagged 0
shares 128 of its 130 vertices with the partition's solid, which was built from it. Leaving out
the bodies flagged 0 gives the mesh's face count on 187 of 188 parts with a mesh
([EXP-084][exp084]). Bodies without the attribute count as in.

Each LocalBodies section was cut out of a bigger model, so its BODY `next`/`previous` and
ATTRIB_DEF `next` pointers lead nowhere (13 or 14 per section). That's expected. Each section
also numbers its node_ids from 1, so a reader that puts them together has to renumber.

The same goes for bodies inside one partition: node_ids are unique within a body, not within the
stream. One online part's solid and its four reference sheets each have an EDGE with node_id 7, and
keying edges by node_id gave the solid a sheet's line ([EXP-085][exp085]).

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

One trap for anyone porting a reader: the constants of one modeller build are not the format's
constants. In the 24 SW2022 controls, export bytes 0–349 (13 declarations; schema token at byte
349; the partition prefix, 8 declarations, at byte 257) are byte-identical in all 24 files, so
"24 of 24 files agree" there is really one SolidWorks build read 24 times. The original corpus
alone carries five distinct prefixes ([EXP-058][exp058], [EXP-059][exp059]). The same holds the
other way: what the corpus says is the only thing verifiable — a schema-early-2022 preamble
matches because that's what's in it.

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

### The first BODY's table

In text, the declaration prefix ends with a `Z` line, and the numbers after it are the first
body's: index (1 in every corpus file), `highest_node_id`, the BODY's pointer fields, then
`res_size` (1000) and `res_linear` (1e-8) in that order. That is the 2006 spec's `BODY_s`, and
the SW2011 gap of six pointers between the ceiling and `res_size` matches the spec's own worked
example. The SW2022 gap of nine is the edit script at work: the lattice, mesh and polyline types
are inserted ahead of the residuals, which is where the pointer count goes ([EXP-067][exp067],
[EXP-068][exp068]).

`highest_node_id` is what the name says: an ID ceiling. It equals the highest decoded node_id in
94 of the 98 text and binary export pairs in the audit; the four misses are the two loft models
in both eras, whose decoded bodies run 16 IDs past the stored ceiling ([EXP-071][exp071]).
Every decoded positive ID is unique and at or below the ceiling anyway, so a reader can still
use it to bound its work. Why the lofts overshoot is open. An allocation-history explanation is
plausible but unproven.

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
| 60 | OFFSET_SURF | `check`, `true_offset`, `surface`, `offset`, `scale` |
| 68 | SPUN_SURF | `profile`, `base`, `axis`, `start`, `end`, `start_param`, `end_param`, `x_axis`, `scale` |
| 163 | HELIX_SU_FORM | a surface's helical shape: `axis_pt`, `axis_dir`, `hand`, `turns`, `pitch`, `gap`, `tol` |
| 184 | HELIX_CU_FORM | a curve's helical shape: `axis_pt`, `axis_dir`, `point`, `hand`, `turns`, `pitch`, `tol` |
| 100 | TRANSFORM | `rotation_matrix` (9 doubles), `translation_vector`, `scale`, `flag`, `perspective_vector` |
| 86 | VECTOR_VALUES | a list of vectors (on cosmetic threads, [page 2](2-display-mesh.md#cosmetic-threads)) |
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
- **The helix numbers are the other way round.** The reference's table has 163 for the curve helix
  and 184 for the surface one. In the files, a SURFACE_DATA's `analytic_form` (type 'H') points at
  a 163 with the surface layout, and a CURVE_DATA's at a 184 with the curve layout. The bytes
  settle it: read with the surface layout, ReducerBox's first 163 is 89 bytes of fields that end
  exactly where the next node's type starts, with axis (0, 0, 1), hand '+', 13.75 turns, pitch
  0.8 mm and a null gap. The curve layout would run 24 bytes into the next node ([EXP-084][exp084]).

The layouts of 60, 68, 86, 100, 163 and 184 aren't in the 13006 schema the files edit, and files
that use them say "same as the base", so the bytes don't spell them out. They come from the
reference and are checked the usual way: every node ends where the next begins, every pointer
resolves, and the graph checks pass. POINT, AXIS, TAG and DIRECTION_VALUES (85, 87, 88, 89) are in
the reader with their reference layouts but haven't turned up in a file yet.

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

**Which way round (u, v) is.** An SP_CURVE's control points are in its surface's own parameters,
so they're only right if you evaluate the surface the way Parasolid does. Plane, cylinder, torus
and B-surface match the obvious reading. Two don't ([EXP-085][exp085]):

- SPUN_SURF: u is the profile curve's parameter and v the angle of rotation.
- CONE: v runs along the axis, not the slant: the point at (u, v) is at radius r + v·tan α, a
  distance v along the axis from `pvec`.

Read the other way, the pcurves on one online part landed up to 499 m (spun) and 35 mm (a 79°
cone) from their own vertices. Read this way, every end is within 1e-6 mm.

## How well it reads

| set | result |
|---|---|
| 49 controlled models, `.x_t` and `.x_b` exports (98 files) | every file parses to its terminator; 28,428 graph checks, 0 failures; face counts equal SolidWorks' own |
| the same 49 models' embedded partitions | 8,209 nodes, 287 faces, 14,262 graph checks, 0 failures; face counts equal the exports' |
| 21 original modern parts | 43,158 nodes, 1,272 faces, 0 graph failures |
| 136 online parts saved 2007–2026, from public GitHub repositories | every body reads to its terminator, 0 graph failures; the face count equals the mesh's on all but one part ([EXP-084][exp084]) |
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
[exp067]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-22_v0.5-EXP067.md
[exp068]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-22_v0.5-EXP068.md
[exp058]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_v0.4.9-EXP058.md
[exp059]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-21_v0.4.9-EXP059.md
[exp076]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP076.md
[exp077]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP077.md
[exp078]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP078.md
[exp084]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP084.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md

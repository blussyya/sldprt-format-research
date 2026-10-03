# The Parasolid body: exact geometry

SolidWorks is built on the Parasolid kernel, and every part stores its solid as a Parasolid
transmit file inside the SLDPRT. That body has the exact geometry: analytic planes, cylinders,
cones, spheres and tori, B-spline surfaces and curves with their control points and knots, and
the full face–loop–edge–vertex topology. It is stored in a framed, zlib-compressed stream
(`Config-0-Partition`).

The transmit format itself is documented by its owner: the *Parasolid XT Format Reference*
(UGS, October 2006), written, in its own words, for people writing translators to and from the
format. The SolidWorks wrapping around it is not documented anywhere and was worked out here.

Readers: [`src/parasolid/partition.js`](../../src/parasolid/partition.js) (streams, sections,
body selection), [`src/parasolid/xt.js`](../../src/parasolid/xt.js) (the transmit reader, also
reads standalone `.x_t` / `.x_b`), [`src/parasolid/topology.js`](../../src/parasolid/topology.js)
(graph checks). Node.js only.

```sh
sldprt brep part.SLDPRT            # census and graph checks
sldprt brep part.SLDPRT --nodes    # every typed node as JSON
```

---

## Partition streams

### Section frame

Every partition-bearing stream is a chain of sections:

```
u32le size                          size = compressed + 32
16-byte GUID 231dd571-da81-48a2-a858-98b21b89ef99
u32le inflated length
u32le compressed length
zlib member                         compressed bytes
8 zero bytes
```

| stream | sections | chained exactly to the end of the stream |
|---|---|---|
| `Config-N-Partition` | `TRANSMIT FILE (partition)`, then `TRANSMIT FILE (deltas)` | 70/70 |
| `Config-N-GhostPartition` | one `(partition)` | 65/65 |
| `Config-0-FeatureBodies/LocalBodies` | one plain `TRANSMIT FILE`, after a 64-byte prefix | 1 file |
| `Config-N-ResolvedFeatures` | plain one-face PLANE bodies, 36 sections in 14 files | |

All 242 sections end in eight zero bytes
([EXP-074](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md)).
The same GUID-and-lengths frame, without the size word, wraps the legacy `DisplayLists__ZLB`
stream ([container.md](container.md#the-compressed-stream-wrapper)).

The `(deltas)` section, the ghost partition and the ResolvedFeatures bodies are read as sections
but their role is not established (see [open questions](../open-questions.md)).

### Which body is the part

The reader takes the first section of `Config-0-Partition`. If that body has no faces, it takes
the first section with faces from any other stream that carries the GUID.

In the corpus that rule is needed once. PTC GE8080-8's primary partition holds only a WORLD node,
and its 126-face body is an imported body in `Config-0-FeatureBodies/LocalBodies`. With it, the
native face count equals the display face count on all 21 original modern parts and all 49
controlled parts. This is what the corpus supports. It is not a model of configurations or
rollback states.

---

## The transmit format

The reader handles both encodings of the same content: **text** (`.x_t`) and **neutral binary**
(`.x_b`, and every embedded partition). Binary is big-endian.

### Header

Binary: `PS 00 00`, then

| field | type |
|---|---|
| description length, description (`: TRANSMIT FILE (partition) created by modeller version 3301247`) | u16 + bytes |
| schema name length, schema name (`SCH_3301247_33103_13006`) | u32 + bytes |
| maximum number of node types | u16 |
| user field size; must be 0 | u32 |

A standalone `.x_b` first has an ASCII banner ending `**END_OF_HEADER` and a newline. Text files
have the same banner, then `T` and the same fields as text tokens.

Every file in the corpus uses base schema **13006**, under five modeller versions:

| schema | files (21 original modern) |
|---|---|
| `SCH_3301247_33103_13006` | 15 |
| `SCH_3501251_35102_13006` | 2 |
| `SCH_3101290_31100_13006` | 2 |
| `SCH_3401247_34101_13006` | 1 |
| `SCH_3201230_32001_13006` | 1 |

The reader refuses any other base schema.

### Schema edits

The file does not repeat the field layout of every node type. The first time a node type
appears, it is preceded by a description of how that type's fields differ from the base schema:

- `u8` = 255: identical to the base.
- otherwise `u8` = number of fields, then an edit script over the base fields: `C` copy, `D`
  delete, `I` insert a new field, `A` append a new field, terminated by `Z`.
- A type with no base layout carries a full declaration: name, description and every field
  descriptor.

A field descriptor is: name (short string), `ptr_class` (i16), element count (pointer-encoded:
0 means one, 1 means variable-length, otherwise fixed), the type letter only when `ptr_class` is
0, and a transmit flag for variable-length fields.

This is how the same reader handles SolidWorks 2011 and 2022 files: the 2022 BODY carries three
more pointer fields than the 2011 one, and the edit script says so.

### Nodes

```
u16 node type
[i32 element count]      only for types with a variable-length field
pointer node index       unique, positive
fields                   in schema order
```

The stream ends with node type `1` and index `0`. The reader requires the terminator, rejects
trailing bytes and duplicate indices, and stops (with the position) at anything it cannot
describe. It never scans forward for a marker.

### Values

| letter | binary encoding |
|---|---|
| `u` unsigned byte, `c` char, `l` logical | 1 byte |
| `n` short, `w` unicode unit | i16 |
| `d` integer | i32 |
| `f` double | IEEE binary64 |
| `v` vector, `i` interval, `h` hvec, `b` box | 3, 2, 3, 6 doubles |
| `p` pointer | see below |

**Nulls.** The integer −32764 and the double −3.14158e13 are null (`?` in text).

**Pointers.** A signed i16 `r`. If `r > 0` the index is `r − 1`, so null is encoded as `0001`.
If `r < 0`, a second positive i16 `q` follows and the index is `q·32767 − r − 1`. A pointer word
can legitimately equal the integer null sentinel, so pointers are never passed through null
conversion.

Text files write logicals as `T`/`F`, and `c` and `l` fields are not followed by a space.

---

## What is in a body

| type | node | key fields |
|---|---|---|
| 101 | WORLD | root of a partition; `body`, `highest_id`, `current_id` |
| 12 | BODY | `highest_node_id`, `res_size` (1000), `res_linear` (1e-8), `body_type`, `shell`, `region` |
| 19 | REGION | `shell`, `type` (one solid region, one void) |
| 13 | SHELL | `face`, `edge`, `vertex` |
| 14 | FACE | `surface`, `sense`, `loop`, `tolerance`, `node_id` |
| 15 | LOOP | `face`, `fin`, `next` (further loops = holes) |
| 17 | FIN | half-edge: `loop`, `forward`, `backward`, `other`, `edge`, `vertex`, `sense` |
| 16 | EDGE | `fin`, `curve`, `tolerance`, `node_id` |
| 18 | VERTEX | `point`, `tolerance` |
| 29 | POINT | `pvec` |
| 50 | PLANE | `pvec`, `normal`, `x_axis` |
| 51 | CYLINDER | `pvec`, `axis`, `radius`, `x_axis` |
| 52 | CONE | `pvec`, `axis`, `radius`, `sin_half_angle`, `cos_half_angle`, `x_axis` |
| 53 | SPHERE | `centre`, `radius`, `axis`, `x_axis` |
| 54 | TORUS | `centre`, `axis`, `major_radius`, `minor_radius`, `x_axis` |
| 124 / 126 | B_SURFACE / NURBS_SURF | degrees, vertex counts, knot types, `rational`, periodic/closed flags, control points, knot multiplicities, knots |
| 134 / 136 | B_CURVE / NURBS_CURVE | the same for curves |
| 30, 31, 32 | LINE, CIRCLE, ELLIPSE | |
| 133 | TRIMMED_CURVE | `basis_curve`, end points and parameters |
| 137 | SP_CURVE | a curve in a surface's parameter space |
| 38, 40, 41 | INTERSECTION, CHART, LIMIT | intersection curves, kept as their defining data |
| 56, 59 | BLENDED_EDGE, BLEND_BOUND | rolling-ball blends |
| 67 | SWEPT_SURF | `section`, `sweep`, `scale` |
| 70, 74, 79–84, 98 | LIST, POINTER_LIS_BLOCK, attributes and value arrays | |

Every surface and curve shares the common geometry fields (`node_id`, `owner`, `next`,
`previous`, `geometric_owner`, `sense`). Coordinates are in **metres**. The surface is oriented
by `surface.sense × face.sense`.

Where the corpus disagrees with the 2006 reference, the reader follows the corpus, and each
point is backed by complete parses
([EXP-071](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP071.md)):

- BODY includes `nom_geom_state`. The reference's field table has it; its C struct omits it.
- EDGE has one attributes pointer. The C struct repeats it.
- ELLIPSE has the common `sense` field. The C struct omits it.
- LIST's base fields are a nine-field reconstruction from the embedded edit scripts. It is
  corroborated by full traversal on every file, but no independent schema file was available.

---

## How well it reads

| set | result |
|---|---|
| 49 controlled models, `.x_t` and `.x_b` exports (98 files) | every file parses to its terminator; 28,428 graph checks, 0 failures; face counts equal SolidWorks' own |
| the same 49 models' embedded partitions | 8,209 nodes, 287 faces, 14,262 graph checks, 0 failures; face counts equal the exports' |
| 21 original modern parts | 43,158 nodes, 1,272 faces, 0 graph failures |
| C00 cube, both eras | 6 planes, 12 edges, 8 vertices, Euler characteristic 2, outward loops, corners exactly at 0 and 0.01 m, volume exactly 1e-6 m³ |

The graph checks cover face and loop ownership, closed fin rings, reciprocal forward and backward
fins, two-fin edges with opposite senses, vertex points, and B-spline control-point and knot array
sizes with increasing knots. All of this is re-run by `test/parasolid.test.js`.

**Text and binary exports differ only in IDs.** The `.x_t` and `.x_b` of a model are two separate
exports. Across all 49 pairs they differ only in 24 `BODY.highest_node_id` values and 308
attribute node IDs, plus floating-point noise up to 1.1e-13. No FACE ID differs.

**Against SolidWorks' STEP export.** On all 49 controlled models, the body decoded from the
SLDPRT matches the `model.step` SolidWorks exported from the same part, face for face, edge for
edge and vertex for vertex. The worst deviation is 9e-18 m, which is double-precision rounding of
the same numbers printed in millimetres. The checks are:

- every native vertex is a STEP vertex;
- every STEP edge lies on exactly one native edge's curve, inside its extent;
- the STEP pieces of each native edge add up to its exact length;
- every STEP face lies on one native face's surface, on the same side;
- every edge's two faces correspond.

The only differences are seams. STEP splits closed faces (cylinders, cones, spheres, tori) into
pieces along seam edges: 287 native faces become 331 STEP faces through 90 seams. Even the B-spline
loft surfaces have identical control points and knots. Twenty mutations, each 1e-7 m or less and
including four wrong-model pairings, are all detected, so the agreement is not an artifact of a
loose test
([EXP-075](https://github.com/blussyya/sldprt-research-dump/blob/staging/knowledge/evidence/2026-10-03_v0.5-EXP075.md),
`test/brep-step.test.js`).

**Native vs exported.** Compared graph-to-graph from the BODY down, the embedded body equals the
exported one on 47 of 49 models. The two lofts (C16, both eras) differ: native `nom_geom_state` is
2 against the export's 1, and several curve references and types differ
([EXP-072](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP072.md)).

---

## The join with the display mesh

The display reader and this reader were written independently. Three things hold across all
1,414 modern faces that neither was built to make true
([EXP-074](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md)):

1. **Identity.** The display surface record's face ID is the native `FACE.node_id`, 1,414/1,414.
   Its edge table, and the face's nonzero Block1 IDs, are exactly the `node_id`s of the native
   edges around that face. The edge-table check covers 1,408 faces; the other 6 are C23's empty
   tables, where Block1 still matches.
2. **Type.** Each display tag maps to exactly one native surface type, including 4007 →
   BLENDED_EDGE and 4009 → SWEPT_SURF.
3. **Geometry.** On analytic faces, the display mesh lies on the native surface. The display
   normals agree with the oriented surface normal: 88,257 agree and 0 oppose. That count includes
   the SW2011 models, whose faces are joined by best fit because their surface records are not
   decoded. The 240 undefined normals sit at cone apexes.

| surface (modern, joined by ID) | faces | every vertex within 1e-6 m |
|---|---|---|
| plane | 645 | 645 (worst 2.5e-8 m) |
| cylinder | 292 | 120 |
| cone | 48 | 28 |
| sphere | 1 | 1 |
| torus | 38 | 2 |

The faces that are not fully on-surface are explained by where the mesh puts its boundary points.
Off-surface vertices sit on the face boundary, on a straight chord between two on-surface
samples. This holds for 158/158 such vertices in the 2022 models and 3,147 of 3,461 in the
production parts. The edge polyline is shared between two faces and drawn straight, so it sits
slightly inside a curved surface. Declared tolerances do not explain it. **314 vertices in
production parts remain unexplained.**

So for exact geometry, the native body is the source and the mesh is not, and the face and edge
IDs connect the two exactly.

---

## Not yet established

- Geometry types that occur only in the production parts, which have no STEP export to compare
  against: INTERSECTION curves, edges whose curve lives on their fins, SWEPT_SURF and
  BLENDED_EDGE surfaces.
- Evaluating B-spline, swept and blended surfaces against the mesh. They are read and counted but
  not evaluated.
- The role of `(deltas)` sections, ghost partitions and ResolvedFeatures bodies.
- The 64-byte LocalBodies prefix.
- Attribute meanings beyond their structure, and enum values beyond those observed.

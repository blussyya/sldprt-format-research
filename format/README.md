# The format, start here

This is the whole `.SLDPRT` file on one page, from the outside in. Each layer has its own page,
and they're numbered in the order you'd read them.

| page | what's in it |
|---|---|
| [1. Container](1-container.md) | How the file is packed: modern and 2011 containers, stream headers, names, CRC, versions |
| [2. Display mesh](2-display-mesh.md) | The triangles SolidWorks draws: face records, strips, edge IDs, bounding box, surface record |
| [3. Parasolid body](3-parasolid-body.md) | The exact solid: partition sections, the XT transmit encoding, node types, where every curve lives |
| [4. Mesh and body together](4-mesh-and-body.md) | How the mesh and the body point at each other by ID, and how closely they agree |
| [5. Files older than 2011](5-pre-2011.md) | PKWARE implode, Parasolid 13 and Parasolid 9 bodies, the older mesh layouts |
| [6. Which SolidWorks saved the file](6-version-history.md) | `_MO_VERSION_` stream name, release codes 1995–2026, the History stream and build dates |

## The file at a glance

```
.SLDPRT
├── container ─────────────────────────────── 1-container.md
│   ├── modern (2015+): ZIP-like stream headers, rotated names, raw DEFLATE, CRC-32
│   ├── 2011: OLE2 compound document, framed zlib streams
│   └── before 2011: OLE2, PKWARE DCL "implode" streams ─ 5-pre-2011.md
│
├── DisplayLists ──────────────────────────── 2-display-mesh.md
│   │   the mesh SolidWorks draws, one record per B-rep face
│   ├── strip lengths, positions, normals             float32, metres
│   ├── Block1: one ID per strip edge (0 inside the face, else the Parasolid edge node_id)
│   ├── Block2, Block3                                 lengths / always zero
│   ├── bounding record: analytic box and sphere       float64
│   └── surface record: face node_id, surface tag, parameters, edge table   (modern only)
│
├── Config-N-Partition ────────────────────── 3-parasolid-body.md
│   │   framed zlib sections: (partition) then (deltas); N = the configuration
│   │   (imported bodies: Config-N-FeatureBodies/LocalBodies)
│   └── Parasolid XT neutral binary, schema 13006
│       WORLD → BODY → REGION/SHELL → FACE → LOOP → FIN → EDGE / VERTEX
│       surfaces: plane, cylinder, cone, sphere, torus, B-spline, swept, blend
│       curves:   line, circle, ellipse, B-spline, intersection, trimmed, SP-curve
│
└── everything else: previews, feature tree, configurations, custom properties
    (stream names in 1-container.md; the feature tree is being worked on, see open questions)
```

## Two ways to get the geometry

A part file stores the same shape twice, and the two copies are linked.

| | display mesh | Parasolid body |
|---|---|---|
| stream | DisplayLists | Config-N-Partition (or LocalBodies) |
| what you get | triangles, normals, boundary edges, surface type | exact surfaces, curves, topology |
| curved faces | facets, with boundary points on chords | exact |
| good for | STL, viewing | exact STEP, measuring, STL when there's no mesh |
| SolidWorks 2011 | mesh and bounding boxes, no surface record | the full body |
| before 2011 | mesh and bounding boxes | the full body |
| link | face and edge IDs are the same numbers in both | |

The mesh got decoded first. It had no spec anywhere, and the partition looked like random bytes.
It turned out to be compressed, not encrypted. [History](../research/history.md) has the whole
story, including what we got wrong on the way.

## How to read these pages

- Offsets are in bytes. Integers and floats are little-endian in the container and DisplayLists,
  big-endian in Parasolid binary (except one Parasolid 9 file, see page 5).
- Every number comes from the test corpus and can be reproduced. Each one links to the experiment
  that produced it in the [research dump][dump], or is re-checked by the converter's test suite.
- "The corpus" is 73 files: 25 SolidWorks 2011 and 24 SolidWorks 2022 models built for this
  project, each with SolidWorks' own STEP, STL, X_T and X_B exports and a log of every face's
  surface type, plus 24 real parts (21 modern, 3 older than 2011).
- "Verified" means verified on that corpus. It's not a promise about every file SolidWorks has
  ever written.

[dump]: https://github.com/blussyya/sldprt-research-dump/tree/main/knowledge/evidence

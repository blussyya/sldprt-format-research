# Format overview

A SolidWorks part file, read from the outside in. Each layer links to its full description.

```
.SLDPRT
├── container ─────────────────────────────── container.md
│   ├── modern (2015+): ZIP-like stream headers, rotated names, raw DEFLATE, CRC-32
│   ├── legacy (2011): OLE2 compound document, framed zlib streams
│   └── pre-2011 (Parasolid 9–13 era): OLE2, PKWARE DCL "implode" streams
│
├── DisplayLists ──────────────────────────── displaylists.md
│   │   the mesh SolidWorks draws, one record per B-rep face
│   ├── strip lengths, positions, normals             float32, metres
│   ├── Block1: per-edge IDs (0 = interior, else the Parasolid edge node_id)
│   ├── Block2, Block3                                 lengths / always zero
│   ├── bounding record: analytic box + sphere         float64
│   └── surface record: face node_id, surface tag, parameters, edge table   (modern only)
│
├── Config-0-Partition ────────────────────── parasolid.md
│   │   framed zlib sections: (partition) + (deltas)
│   │   (pre-2011: Config-0-Body, PKWARE-compressed, or a bare little-endian
│   │    transmit stream named after the configuration)
│   └── Parasolid XT neutral binary, schema 13006 (pre-2011 also schema 9008)
│       WORLD → BODY → REGION/SHELL → FACE → LOOP → FIN → EDGE / VERTEX
│       surfaces: plane, cylinder, cone, sphere, torus, B-spline, swept, blend
│       curves:   line, circle, ellipse, B-spline, intersection, trimmed, SP-curve
│
└── everything else: previews, feature tree, configurations, custom properties
    (stream names in container.md; contents not decoded)
```

## The two routes to geometry

| | display mesh | Parasolid body |
|---|---|---|
| stream | DisplayLists | Config-0-Partition (or LocalBodies) |
| what you get | triangles, normals, boundary edges, surface type | exact surfaces, curves, topology |
| curved faces | facets; boundary points sit on chords | exact |
| use it for | STL, viewing, a fallback when no body can be read | exact STEP, measurement |
| SW2011 | mesh and bounding boxes; no surface record | full body |
| pre-2011 | mesh and bounding boxes, from `DisplayLists__Zip` or plain `DisplayLists` | full body, from `Config-0-Body` or the configuration stream |
| link between them | face and edge IDs are the same numbers in both | |

The project read the display mesh first, because it carried no published specification and the
partition looked like random bytes. It was compressed, not encrypted. The [history](../history.md)
records how each layer was worked out and what was believed wrongly along the way.

## Conventions in these documents

- Offsets are byte offsets; `u32`, `float32` and `float64` are little-endian in DisplayLists and
  the container, big-endian in Parasolid binary.
- Every number quoted comes from this repository's corpus and is reproducible. Most are re-checked
  by `npm test`; the others link to the experiment that produced them in the
  [research dump](https://github.com/blussyya/sldprt-research-dump/tree/main/knowledge/evidence).
- "Corpus" means 73 files: 25 SolidWorks 2011 and 24 SolidWorks 2022 purpose-built models, each
  with SolidWorks' own STEP, STL, X_T and X_B exports and a build log recording each face's surface
  type, plus 24 production parts (21 modern, 3 pre-2011).
- "Verified" means checked on that corpus. It is not a claim about every file SolidWorks has ever
  written.

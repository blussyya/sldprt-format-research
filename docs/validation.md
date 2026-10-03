# Validation

What each reader is checked against, and the current numbers. Everything here is re-run by
`npm test` against the research corpus (see [test/README.md](../test/README.md)) unless a link to
an experiment says otherwise.

## The corpus

| set | files | what makes it useful |
|---|---|---|
| `test files new/SW2022` | 24 | Purpose-built, one feature per model, dimensions fixed in advance. Each ships `model.SLDPRT`, `model.step`, `model.STL`, `model.x_t`, `model.x_b`, and the build log records the face count and SolidWorks' own surface type for every face. |
| `test files new/SW2011` | 25 | The same models built in SolidWorks 2011 (legacy container), geometry-matched to the 2022 set. |
| `test files original` | 24 | Production parts (gear, sprocket, enclosures, an ornamental panel, an imported STEP body), the first controlled cubes C00–C12, and three pre-2011 parts. |

That is 73 SLDPRT files in all. The corpus is in the
[dump repository](https://github.com/blussyya/sldprt-research-dump), not this one.

## Display mesh

| check | result |
|---|---|
| Parse output equals the golden record (SHA-256 of the full parse) | 73 / 73 files |
| SW2011 files read; face count equals SolidWorks' | 25 / 25 files, 145 faces |
| Modern files read with no rejected record; face count equals SolidWorks' (2022 set) | 45 / 45 files, 1,414 faces |
| Modern faces with a surface record | 1,414 / 1,414 |
| Surface tag equals SolidWorks' reported type (2022 set without the upgraded C23) | 136 / 136 faces |
| Browser decompressor gives an identical parse to Node's zlib | 73 / 73 |
| Stream CRC-32, inflated size and extra length as stored | 1,730 / 1,730 named streams |
| Strip triangles agreeing with stored normals (original modern parts) | 50,976 / 50,976 |
| Boundary annotations nonzero / interior annotations zero | 41,010 / 41,010 and 71,037 / 71,037 |
| Legacy mesh box equals the dimensions fixed before building ([EXP-066](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-22_v0.5-EXP066.md)) | 7 / 7 |
| Legacy mesh box equals the geometry-matched 2022 model's (within 2e-5 m) | 22 / 22 |
| Pre-2011 files refused with an explicit error | 3 / 3 |

Corruption controls: a flipped CRC bit, a truncated OLE header, truncated OLE sectors, an invalid
sector shift, a cyclic directory chain, a bad zlib Adler-32, truncated zlib data, and an edge table
that disagrees with Block1. Each is rejected or reported.

## STL and STEP export (display mesh)

Against SolidWorks' own exports of the 13 controlled cubes C00–C12:

| check | result |
|---|---|
| Emitted STEP has no dangling references | 13 / 13 |
| Exported mesh is closed | 13 / 13 |
| Bounding box equals SolidWorks' STL | 13 / 13, difference 0 |
| STL identical to SolidWorks' | C00, C01, C02, C10 |
| STL a strict superset (SolidWorks' export is missing a face) | C09 |
| Volume, planar models | exact: 1000, 8000, 1000, 995, 424 mm³ |
| Volume, curved models | within 0.09%, which is the difference between the stored mesh and SolidWorks' re-tessellated STL, not decode error |

SolidWorks' STL exports of C03, C09 and C11 have no −X face at all, and C04's has no top cap. The
SLDPRT's own mesh has them. Do not use those STL files as watertight ground truth.

That is the mesh STEP (`--mesh`), which writes planes exactly and everything else as facets. By
default STEP now comes from the Parasolid body instead (next section); the mesh is the fallback.

## Exact STEP export (B-rep)

Against SolidWorks' own `model.step` of all 49 controlled models
([EXP-076](https://github.com/blussyya/sldprt-research-dump/blob/staging/knowledge/evidence/2026-10-03_v0.5-EXP076.md)):

| check | result |
|---|---|
| Our STEP reads back as the native body (EXP-075's comparison, 1e-8 m) | 49 / 49 (first writer: 42 / 49) |
| OpenCascade reads it as one valid solid | 49 / 49 |
| OpenCascade boolean difference with SolidWorks' STEP, both directions | 0 on 49 / 49 |
| Exact volume, ours vs SolidWorks' STEP | worst 5.6e-15 relative |
| Exact volume vs closed form (cubes, shell, chamfer, holes, cone, sphere, torus, half cylinder, crossed cylinders) | 24 files, worst 4.3e-15 relative |
| OpenCascade's volume equals ours to 1e-12 | 47 / 49; both misses are C20, where OpenCascade is the one off the closed form |
| Real parts with a body exported exactly | 2 / 8 (PTC, cube); the other 6 fall back to the mesh |

The OpenCascade checks need Python and run in the dump, not in `npm test`.

## Parasolid body

| check | result |
|---|---|
| `.x_t` / `.x_b` exports parsed to the terminator, full byte coverage of binary | 98 / 98 |
| Graph checks on the exports | 28,428, 0 failures |
| Face count equals SolidWorks' | 98 / 98 |
| Text and binary export of the same model differ only in IDs | 49 / 49 pairs |
| Embedded partitions parsed (controlled) | 49 / 49: 8,209 nodes, 287 faces, 14,262 checks, 0 failures |
| Embedded body = SolidWorks' STEP export: every vertex, edge and face, within 1e-8 m (worst 9e-18 m) | 49 / 49 |
| Mutations of 1e-7 m or less, and wrong-model pairings, detected by that comparison | 20 / 20 |
| Embedded body equals the export graph-to-graph ([EXP-072](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP072.md)) | 47 / 49 (both lofts differ) |
| Original modern parts parsed | 21 / 21: 43,158 nodes, 1,272 faces, 0 failures |
| Native face count equals display face count | 70 / 70 files |
| C00 decoded exactly: corners at 0 and 0.01 m, volume 1e-6 m³, Euler characteristic 2 | both eras |
| Display face ID = native FACE `node_id` | 1,414 / 1,414 |
| Display edge IDs = native edges around the face | 1,408 / 1,408 (+6 empty tables) |
| Display tag = one native surface type | 1,414 / 1,414 |
| Analytic modern faces with every display vertex within 1e-6 m of the native surface | 796 / 1,024 (the rest: boundary chord points, [EXP-074](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md)) |

Reader controls: a corrupted fin pointer is caught by the graph checks. Truncation, a trailing
byte, a malformed number and the node limit each stop the reader. Long-form pointer encoding is
exercised synthetically.

## What is not validated

- Real-browser interaction with the viewer. The worker and server are tested, but no browser runs
  in the suite.
- Hostile input in general. The readers are bounded (128 MiB, 2 million vertices, 50,000 faces)
  and strict, but this is not a security audit.
- Any file unlike the corpus: other SolidWorks versions, assemblies, drawings, multi-body parts
  with several bodies, sheet metal, weldments.

# Validation

What each finding is checked against, and the current numbers. Unless a row links to an
experiment, the [solidworks-converters][code] test suite re-checks it on every run against the
research corpus (see its [test/README.md][tests]).

## The corpus

| set | files | why it's useful |
|---|---|---|
| `test files new/SW2022` | 24 | Built for this project, one feature per model, with sizes picked before building. Each comes with `model.SLDPRT`, `model.step`, `model.STL`, `model.x_t` and `model.x_b`, and the build log records the face count and SolidWorks' own surface type for every face. |
| `test files new/SW2011` | 25 | The same models built in SolidWorks 2011 (legacy container), with matching geometry. |
| `test files original` | 24 | Real parts (a gear, a sprocket, enclosures, an ornamental panel, an imported STEP body), the first controlled cubes C00–C12, and three parts older than 2011 (one of them empty). |

That's 73 SLDPRT files. The corpus lives in the [research dump][dump].

## Display mesh

| check | result |
|---|---|
| Parse output equals the recorded output (SHA-256 of the full parse) | 73 of 73 files |
| SW2011 files read, face count equals SolidWorks' | 25 of 25 files, 145 faces |
| Modern files read with no rejected record, face count equals SolidWorks' (2022 set) | 45 of 45 files, 1,414 faces |
| Modern faces with a surface record | 1,414 of 1,414 |
| Surface tag equals the type SolidWorks reports (2022 set, without the upgraded C23) | 136 of 136 faces |
| The browser decompressor gives the same parse as Node's zlib | 73 of 73 |
| Stream CRC-32, inflated size and extra length as stored | 1,730 of 1,730 named streams |
| Strip triangles that agree with the stored normals (original modern parts) | 50,976 of 50,976 |
| Boundary annotations nonzero, interior annotations zero | 41,010 of 41,010 and 71,037 of 71,037 |
| 2011 mesh box equals the sizes picked before building ([EXP-066][exp066]) | 7 of 7 |
| 2011 mesh box equals the matching 2022 model's (within 2e-5 m) | 22 of 22 |
| Pre-2011 meshes read, face count equals the body's ([EXP-077][exp077]) | chainwheel 189 of 189, plate4 14 of 14. SW2000-s01 has no solid and no faces |
| PKWARE implode streams decoded with every input byte used | 3 of 3 |

Corruption controls: a flipped CRC bit, a truncated OLE header, truncated OLE sectors, a bad sector
shift, a directory chain that loops, a bad zlib Adler-32, truncated zlib data, and an edge table
that disagrees with Block1. Each one is rejected or reported.

## STL and mesh STEP

Against SolidWorks' own exports of the 13 controlled cubes C00–C12:

| check | result |
|---|---|
| STEP has no dangling references | 13 of 13 |
| The exported mesh is closed | 13 of 13 |
| Bounding box equals SolidWorks' STL | 13 of 13, difference 0 |
| STL identical to SolidWorks' | C00, C01, C02, C10 |
| STL has everything SolidWorks' has and more (SolidWorks' is missing a face) | C09 |
| Volume, flat-faced models | exact: 1000, 8000, 1000, 995, 424 mm³ |
| Volume, curved models | within 0.09%. That's the difference between the stored mesh and SolidWorks' re-tessellated STL, not a decoding error |

SolidWorks' own STL exports of C03, C09 and C11 have no −X face at all, and C04's has no top cap.
The mesh stored in the SLDPRT has them. Don't use those STL files as watertight ground truth.

## Exact STEP

Every corpus part was written out as exact STEP ([exact STEP](../export/exact-step.md)) and loaded in
OpenCascade:

| result | files |
|---|---|
| Valid solid, volume and area equal to SolidWorks' own STEP export | 64 |
| Valid solid, no SolidWorks export to compare with, volume within 0.4% of the display mesh | 6 |
| Older than 2011 | 3 (see below) |

On the 64 with a SolidWorks export, volume and area differ only at rounding level (under 3e-16
relative) on every part with only exact geometry. Parts with fitted curves or blends differ by at
most 2.6e-6 (USB hub case BOTTOM). There, SolidWorks' own edges sit up to 7.1e-4 mm off its
surfaces while ours sit 3.4e-6 mm off, so most of that difference is theirs. The worst fit error
anywhere is 9.9e-6 mm. Face counts go up where periodic faces get cut at seams, for example from 1
to 4 on the torus.

That run happened before the pre-2011 reader existed, so it refused the three older files. They
read now. plate4 and chainwheel both export exact STEP, and EXP-078 found both to be valid single
solids in OpenCascade ([EXP-078][exp078]). SW2000-s01 has no solid to export.

Four models built by hand cover what the corpus doesn't have (a void, two bodies, an offset face, a
spun face). All four load as valid solids with the right volume to 1e-9.

## Parasolid body

| check | result |
|---|---|
| `.x_t` / `.x_b` exports parsed to the terminator, every binary byte accounted for | 98 of 98 |
| Graph checks on the exports | 28,428, 0 failures |
| Face count equals SolidWorks' | 98 of 98 |
| Text and binary export of the same model differ only in IDs | 49 of 49 pairs |
| Embedded partitions parsed (controlled models) | 49 of 49: 8,209 nodes, 287 faces, 14,262 checks, 0 failures |
| Embedded body equals SolidWorks' STEP export: every vertex, edge and face within 1e-8 m (worst 9e-18 m) | 49 of 49 |
| Deliberate errors of 1e-7 m or less, and wrong-model pairings, caught by that comparison | 20 of 20 |
| Embedded body equals the export, node graph against node graph ([EXP-072][exp072]) | 47 of 49 (both lofts differ) |
| Pre-2011 bodies parsed to the terminator, every byte used, 0 graph failures | chainwheel (Parasolid 13, 4,279 nodes, 13,527 checks), plate4 (Parasolid 9, 277 nodes, 900 checks) |
| INTERSECTION chart points lie on both of their surfaces | 392 of 394 curves checkable (2 touch a blend), 2,170 points, worst 3e-15 m |
| Tolerant edges: fin curves hit their stored trim points, and the two fin curves stay within the edge tolerance | 54 of 54 (1e-16 m) and 27 of 27 |
| Original modern parts parsed | 21 of 21: 43,158 nodes, 1,272 faces, 0 failures |
| Body face count equals display face count | 70 of 70 files |
| C00 decoded exactly: corners at 0 and 0.01 m, volume 1e-6 m³, Euler characteristic 2 | both versions |
| Display face ID = body FACE `node_id` | 1,414 of 1,414 |
| Display edge IDs = body edges around the face | 1,408 of 1,408 (plus 6 empty tables) |
| Display tag = one Parasolid surface type | 1,414 of 1,414 |
| Analytic modern faces with every display vertex within 1e-6 m of the body's surface | 796 of 1,024 (the rest are boundary chord points, [EXP-074][exp074]) |

Reader controls: a corrupted fin pointer gets caught by the graph checks. Truncation, a trailing
byte, a malformed number and the node limit each stop the reader. The long pointer encoding is
tested on made-up data.

## Exact volume

See [exact volume](../export/exact-volume.md). Against SolidWorks' STEP on the 49 controlled models
the worst difference is 5.6e-15 relative, and against hand-worked values on 24 files it's 4.3e-15
([EXP-076][exp076]).

## What isn't validated

- Real-browser use of the viewer. The worker and the server are tested, but no browser runs in the
  suite.
- Hostile input in general. The readers have limits (128 MiB, 2 million vertices, 50,000 faces) and
  they're strict, but nobody has done a security audit.
- The 231 interior and 11 boundary display vertices that sit off their surface with no explanation
  yet ([page 4](../format/4-mesh-and-body.md#how-close-the-mesh-sits-to-the-surface)).
- Any file unlike the corpus: other SolidWorks versions, assemblies, drawings, parts with several
  bodies, sheet metal, weldments.

[code]: https://github.com/blussyya/solidworks-converters
[tests]: https://github.com/blussyya/solidworks-converters/blob/main/test/README.md
[dump]: https://github.com/blussyya/sldprt-research-dump
[exp066]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-22_v0.5-EXP066.md
[exp072]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP072.md
[exp074]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-29_v0.4.9-EXP074.md
[exp076]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP076.md
[exp077]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-03_v0.5-EXP077.md
[exp078]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP078.md

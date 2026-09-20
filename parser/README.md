# Read-only strip and edge parser

Built on [EXP-042–046](../v0.4.8/README.md)

The parser reads the serialized strip-length array, positions, normals, Block1 edge annotations, Block2 section lengths, and Block3 raw bytes. It emits correctly alternating triangle-strip indices and exact-coordinate display-boundary cycles. It also reads the downstream face metadata and cross-checks its edge IDs with Block1. Unknown type tags, parameter slots, auxiliary arrays, and flags remain raw.

```sh
node parser/src/node-cli.js "test files original/controlled/C04_cube_hole_5mm/model.SLDPRT" > parsed.json
node parser/test/validate.js
```

The CLI emits JSON only. No mesh conversion or file writing is built into the parser. The core is isomorphic; for browser use load `parser/v0.1/src/parser-core.js` first for the existing container reader, then this version's core as `SLDPRTParserV2`. There is no new browser UI in this release.

Important fields:

| Field | Interpretation |
|---|---|
| `stripLengths` | Vertex counts read directly from the precursor array |
| `triangleIndices` | Triples into the face's positions/normals; alternating strip winding |
| `edgeAnnotations` | Geometry endpoint indices plus source Block1 ID; zero means internal display-triangulation edge on the tested corpus |
| `boundaryCycles` | Exact-coordinate graph cycles from nonzero annotations; no outer/hole or CAD periodic-seam classification |
| `block1`, `block2`, `block3` | Original data retained |
| `metadata.edgeRecords` | Downstream ID/type pairs, checked against Block1 |
| `metadata.scalarArrays` | Optional per-vertex Float32 arrays; purpose unverified |
| `metadata.parameters` | Raw Float64 slots; only the tested plane/cylinder interpretation is externally validated here |

Validation: 1,272 faces, 50,976 triangles and all metadata records agree with the research pipeline across 21 modern files. Seven malformed-input cases exercise rejection or explicit withholding of invalid metadata. Eight records with nonempty, uninterpreted auxiliary arrays deliberately produce warnings; these are not failed geometry parses. Evidence: [PARSER_V02_VALIDATION.json](../v0.4.8/PARSER_V02_VALIDATION.json).

Limits: modern-container decompression is inherited unchanged from v0.1 and still uses heuristic stream discovery. Legacy OLE2, feature histories, encrypted/opaque partitions, assemblies, full exact B-rep, unknown display-record versions, and watertight mesh conversion are not implemented. Original surface boundaries can have different subdivisions on neighboring faces; the parser preserves those coordinates and does not silently weld or heal them. It rejects unsupported geometry layouts and retains geometry with a metadata error when the metadata schema does not validate. Original v0.1 API names such as `edgeCount` and `loopSizes` are intentionally not carried forward with their incorrect meanings.

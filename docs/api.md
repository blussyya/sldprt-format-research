# API

```js
const sldprt = require('sldprt');            // or require('./src') from a clone
```

Every function takes a file path, a `Buffer`, a `Uint8Array` or an `ArrayBuffer`.

## `parse(file)` → display result

The saved display mesh. Never throws for a bad file: problems are reported in `errors`, `rejected`
and `warnings`.

```js
{
  format: 'modern DisplayLists' | 'legacy OLE2 DisplayLists',
  displayListsLength, stream,
  errors: [],          // nonempty: nothing usable was read
  rejected: [],        // candidate face records that failed a structural check: output is partial
  partial: false,
  warnings: [],        // e.g. empty edge table, unvalidated auxiliary values
  stats: { faces, triangles, metadataFaces },
  faces: [ face, … ]
}
```

A face:

| field | meaning |
|---|---|
| `vertexCount` | number of vertices |
| `vertices`, `normals` | `Float32Array`, xyz per vertex, metres |
| `triangleIndices` | `Uint32Array`, triples into the face's vertices |
| `stripLengths` | vertices per triangle strip |
| `edgeAnnotations` | per strip edge: `{strip, vertices:[a,b], id, tokenOffset}`; `id` 0 = interior, else the Parasolid edge `node_id` |
| `boundaryCycles` | `[{vertices, edgeIds}]` closed display boundary polylines, or `null` with `boundaryError` |
| `bounds` | `{min, max, center, radius}` analytic box of the face (float64), or `null` |
| `metadata` | modern only; `null` with `metadataError` if it did not validate: |
| `metadata.rawId` | Parasolid FACE `node_id` |
| `metadata.typeTag` | 4001 plane, 4002 cylinder, 4003 cone, 4004 sphere, 4005 torus, 4006 B-surface, 4007 blend, 4009 swept |
| `metadata.direction`, `metadata.parameters` | see [displaylists.md](format/displaylists.md#surface-parameters) |
| `metadata.edgeRecords` | `[{id, typeTag}]` the face's B-rep edges |
| `block1`, `block2`, `block3`, `offsets`, … | raw arrays and byte offsets, so any value can be checked against the file |
| `legacyTail` | SW2011 only: the undecoded bytes after the bounding record |

## `readBrep(file, {maxNodes})` → native body

```js
{
  source: 'Contents/Config-0-Partition',   // or LocalBodies; pre-2011: 'Config-0-Body' or the configuration stream
  kind: 'partition',
  parsed: {
    header: { schema, description, maxTypes, userfields },
    nodes: [ { type, name, index, values, pointers, start, end }, … ],
    edits,        // schema edit scripts per node type
    spans,        // every byte range and what it decoded to
    terminated, error, unresolved
  },
  graph: { checks, errors, rings }         // errors: [] when every graph check passed
}
```

`values` holds the fields by name. Pointers are node indices; resolve them with
`new Map(parsed.nodes.map(n => [n.index, n]))`. Throws if the file has no body at all (a part with
no solid). `parsed.header` says which form was read: `schema`, `isBase` (written in schema 13006 or
9008 itself, no edit scripts) and `littleEndian` (Parasolid 9 bare binary).

## `info(file)` → summary

Container type, stream names and sizes, DisplayLists version, display counts and surface tags,
partition sections, B-rep census and graph-check totals. This is what `sldprt info --json` prints.

## Export

```js
sldprt.toSTL(file)                       // Buffer, binary STL in millimetres
sldprt.toSTL(file, { ascii: true })      // string
sldprt.toSTEP(file)                      // { text, report }  AP214, exact if it can be
sldprt.toSTEP(file, { source: 'brep' })  // exact or throw
sldprt.toSTEP(file, { source: 'mesh' })  // from the display mesh (same as mode: 'faceted')
sldprt.volume(file)                      // { volume (m³), faces, unsupported }
```

STL is always the display mesh. STEP, by default, is written from the Parasolid body: exact
surfaces and curves, the same solid as SolidWorks' own export on every controlled model. If the
body uses something the writer doesn't handle yet (INTERSECTION curves, curveless edges) or fails
a graph check, `toSTEP` falls back to the mesh and says so: `report.source` is `'brep'` or
`'mesh'`, and `report.fallback` holds the reason. `scale` (default 1000) converts metres to the
output unit; `scale: 1` writes metres.

`volume` integrates the exact enclosed volume from the body's surfaces and curves, with no mesh.

The pieces are exposed too, for working with the body directly:

```js
const model = sldprt.brep.model(sldprt.readBrep(file).parsed);  // vertices, edges, faces
sldprt.brep.volume(model);
sldprt.step.write(model, { name, scale });   // { text, report }
sldprt.step.read(text);                      // a STEP file back into the same model shape
```

## Lower-level modules

```js
sldprt.display                // parseSLDPRT(bytes, inflateRaw, inflateZlib), extractDisplayLists(bytes, legacy)
sldprt.container.modern       // decompressOpenSX, findDisplayLists, displayListsVersion, crc32, isOLE2
sldprt.container.ole          // read(bytes) -> {entries, stream(entry)}, displayLists(bytes, inflate)
sldprt.container.blast        // blast(bytes) -> {data, consumed}: PKWARE DCL implode (pre-2011 streams)
sldprt.parasolid.xt           // parse(bytes, binary, {maxNodes}) — also for standalone .x_t / .x_b
sldprt.parasolid.partition    // streams, sections, extractPrimary, survey, readBody
sldprt.parasolid.topology     // graph checks
sldprt.convert                // loadModel(parsed), toSTLBinary, toSTLAscii, toSTEP
```

## In the browser

`src/inflate.js`, `src/container/modern.js`, `src/container/blast.js`, `src/container/ole.js` and
`src/display.js` load as plain scripts and define `SLDPRTInflate`, `SLDPRTModern`, `SLDPRTBlast`,
`SLDPRTOLE` and `SLDPRTDisplay`. `blast.js` is only needed for pre-2011 files and must load
before `ole.js`:

```html
<script src="src/inflate.js"></script>
<script src="src/container/modern.js"></script>
<script src="src/container/blast.js"></script>
<script src="src/container/ole.js"></script>
<script src="src/display.js"></script>
<script>
  const result = SLDPRTDisplay.parseSLDPRT(bytes, SLDPRTInflate.inflateRaw, SLDPRTInflate.inflate);
</script>
```

The Parasolid reader and the exporters use Node's `Buffer` and `zlib`, and are Node-only for now.

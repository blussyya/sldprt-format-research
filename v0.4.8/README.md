# DisplayLists strips, edge IDs, and downstream metadata

**Date:** 2026-09-14. **Research:** EXP-042–046. **Implementation:** `parser/v0.2`.
**Status:** Verified observations on the supplied modern corpus, with independently corroborated strip/edge interpretation. This is not a claim that every SolidWorks file version or the full exact B-rep is decoded.

## What changed

The main blockage was a mistaken semantic premise: Block2's decoded sizes are **triangle-strip vertex counts**, not CAD boundary-loop sizes. The vertices are sequential within each strip, but fan triangulation is wrong. Block1 annotates the edges encountered while constructing those strips. Its nonzero labels link to downstream face metadata and are shared across adjoining faces.

This directly explains the old failures: treating strip vertices as perimeter polygons creates webbing; calling the strip count a hole count creates false topology conclusions; comparing arbitrary edge-ID patterns as an orientation signature hides the actual edge correspondence. The arithmetic in INV-016–018 survives, but its interpretation changes.

| Experiment | Discriminating observation | Evidence |
|---|---|---|
| EXP-042 | A forward precursor-array scan finds 1,272 faces in 21 modern files; all strip-length/B1/B2/B3 relationships pass. All 50,976 strip triangles have positive agreement with stored normals. | [Results](EXP042_RESULTS.json) |
| EXP-043 | All 41,010 boundary annotations are nonzero; all 71,037 interior annotations are zero. No geometric-edge label conflicts. Fan triangulation fails the controlled comparison. | [Results](EXP043_RESULTS.json) |
| EXP-044 | A downstream metadata signature scan independently finds matching edge-ID sets on every uniquely located record; one ambiguous scan is preserved rather than silently resolved by tokens. | [Results](EXP044_RESULTS.json) |
| EXP-045 | A forward metadata grammar resolves that ambiguity and matches Block1 IDs on all 1,272 faces. All 94 controlled face records match the tested independent STEP plane/cylinder geometry. | [Results](EXP045_RESULTS.json) |
| EXP-046 | All 1,272 faces yield unambiguous boundary graphs: 1,698 cycles. All 3,278 model-scoped edge IDs have exactly two face owners. | [Results](EXP046_RESULTS.json) |

Each result records input SHA-256 values and per-file/per-face evidence. The corpus consists of all 24 `.sldprt` files under `test files original`, including controlled C00–C12. Three legacy OLE2 files are explicitly unsupported. These modern inputs are not an independent random holdout; the controlled corpus is supplemented by the existing complex models. The shared openswx decompressor remains a limitation of pipeline independence.

## Geometry grammar

All integers here are little-endian. `S` is strip count, `L[i]` strip vertex count, `V` total serialized vertices, and `N` Block1 word count. Header names are local descriptive names, not an asserted universal serialization type system.

| Record, in serialization order | Header | Body |
|---|---|---|
| Strip lengths (formerly “alternative header”) | `u32[4] = [4,8,2,S]` | `u32[S] = L` |
| Positions | `[12,100,2,V]` | `float32[V][3]` |
| Normals | `[12,100,2,V]` | `float32[V][3]` |
| Block1 | `[4,8,2,N]` | `u32[N]` |
| Block2 | `[4,8,2,S]` | `u32[S]` |
| Block3, newly followed | `[1,8,2,N]` | `uint8[N]` |

Measured relations:

```text
V = sum(L)
B2[i] = 2*L[i] - 2
N = sum(B2) = 2*(V-S)
```

The earlier parser's `edgeCount` was read at `positionHeaderOffset-4`: it is the **last element of L**, not an edge count. The allegedly optional predecessor is present on every recovered face; looking only at offsets for `S=1` or `S=2` manufactured the old presence/absence correlation. No header is absent merely because `S>=3`.

Within a strip of `n` vertices, emit triangles:

```text
i = 2,4,6,... : (i-2, i-1, i)
i = 3,5,7,... : (i-1, i-2, i)
```

Reset vertex base and winding parity at each serialized strip boundary. Do not connect different strips and do not fan from the first vertex.

## Block1's edge mapping

A section contains one leading control word (`1` on every tested strip), followed by:

```text
ID(0,1),
ID(0,2), ID(1,2),
ID(1,3), ID(2,3),
ID(2,4), ID(3,4), ...
```

Each newly appended vertex contributes two new geometric edges. The initial edge contributes one. Including the leading control word gives `1 + 1 + 2*(n-2) = 2*n-2`, exactly Block2's stored section length. Thus Block2 is a Block1 section-length table; the precursor already stores the vertex-strip lengths directly.

Use lengths to delimit sections, rather than treating every integer `1` as an unconditional sentinel. The corpus does not contain an edge label of `1`; whether other files can do so is unknown. The leading word's existence/value is established; a broader opcode enum or reason for choosing `1` is not.

On the tested files, zero marks an interior edge of the face's display triangulation. Nonzero IDs identify boundary curves/edges and agree with downstream metadata. An individual ID can label many tessellated segments of a curved boundary; it is neither a local vertex index nor a file-byte offset. Scope IDs to the source model/body context; no global cross-file identity guarantee is established.

Example, C00's -X face: `[1,5,82,0,79,62]`. The five post-control words annotate its five strip edges. The diagonal is `0`; the top, bottom and side edges use labels also present on the neighboring faces. C04's cylinder alternates `150` and `153` on its two circular boundaries. EXP-046 independently finds those two cycles; no token-based face matching is used.

## Real boundaries versus strips

Construct an exact-coordinate graph from the nonzero annotated edges. Every vertex has degree two on every tested face, so its components are unambiguous closed cycles. This is a display-mesh boundary graph, not a reconstruction of periodic CAD parameter seams, B-rep coedge directions, or outer/inner bound roles.

C04's upper planar face has 12 strips, but **two** boundary cycles (34 and 4 vertices). Its cylinder has one strip and **two** cycles (34 vertices each). The two large Dekor faces each have **121** boundary cycles; their strip counts must not be called loop counts. Source: EXP-046 per-face rows.

All 3,278 edge-ID groups have exactly two owning faces. 2,889 have identical segment sets; 389 have differing subdivisions/samples. The maximum measured endpoint-to-opposite-polyline distance is `8.32697841716346e-9 m`. This is a sampled endpoint metric, **not** a continuous Hausdorff bound. Most differences are collinear subdivision differences. Consequently, 7,048 triangle edges across six models have only one exact-coordinate mate occurrence, although the labeled boundaries pair. Do not silently weld them or claim that untouched display triangulation is always a watertight export. The 13 controlled models are all closed under exact triangle-edge matching. Evidence: EXP-043 and EXP-046.

## Third array and following metadata

**Block3 exists.** It contains 122,142 bytes across the corpus; every observed byte is zero, and each face's byte count equals Block1's word count. There is no evidence yet to call these bytes visibility flags, orientations, colors, or opcodes. Reading their syntax does not identify their purpose.

Starting at `E = end(Block3)`, the following forward layout reaches the metadata edge table on every tested face:

| Offset / next step | Observed structure |
|---|---|
| `E .. E+132` | Opaque fixed-length prefix; not semantically decoded |
| `E+132` | Typed array `[8,100,2,K]`, payload `8*K` bytes |
| next | `u32` observed `1` |
| next | Typed positions-like array `[12,100,2,A]` |
| next | Typed normals-like array `[12,100,2,B]` |
| next | `u32 scalarFlag` |
| if `scalarFlag=1` | Two consecutive `[4,100,2,V]` Float32 arrays |
| next | Three `u32` words, all observed zero |
| next | Raw record ID (`u32`) |
| next | Direction vector (`float64[3]`) |
| next | Raw surface-type tag (`u32`) |
| next | Parameter slots (`float64[8]`) |
| next | Edge-record count (`u32`) |
| next | Repeated `(edge ID u32, raw type tag u32)` |

The optional scalar arrays occur on 390 faces and have one scalar per original vertex in each array; their semantics are unresolved. The positions-like and normals-like auxiliary arrays are empty on this corpus. The first auxiliary array is nonempty on eight distributor faces (four with `K=50`, four with `K=54`); its raw payload is preserved. A fixed `E+228` surface-tag shortcut is therefore **not** a general decoder. EXP-044's scan also misidentifies a raw record ID `4007` as a candidate type tag in one Pocket Wheel face; EXP-045 resolves it by following the actual record sequence, without selecting based on label equality.

Raw surface tags: `4001`, `4002`, `4003`, `4005`, `4006`, `4007`, `4009`. Only the controlled plane/cylinder meanings are externally validated in this session. For those tested records:

- `4001`: stored direction agrees with the STEP plane normal up to sign; points lie on the corresponding plane. Its eight parameter slots must not be used as a plane origin: they are zero even on displaced cube faces.
- `4002`: direction is the cylinder axis; parameter slots 0–2 give a point on that axis, slot 6 its radius. These agree with STEP to the explicit tolerances in EXP-045. Multiple STEP surfaces can match one display face because the STEP representation can split a cylinder; no 1:1 B-rep face-count claim is made.

The controlled geometry residual is at most `1.341104505225843e-9 m`. This corroborates existing positions against analytic surfaces and exact metadata, rather than demanding equality with STEP topological endpoints. Different STL tessellation remains visible and is archived; curved-model triangle equality is **not** claimed. Other surface tags and edge-type families remain raw until tested against suitable independent geometry.

## Corrections to prior interpretations

- INV-002's old face-start layout and `edgeCount` name are wrong: the position array starts with `12`; the previous word belongs to the precursor array. Positions/normals themselves remain correct.
- INV-007's numerical `(raw+2)/2` formula survives, but the semantic name “loop” does not. INV-016–018 remain valid arithmetic.
- INV-019 is a fixed-window detector result, not an optional-container property. EXP-021–026's recorded bytes need not be discarded, but the absence inference is superseded.
- OQ-019's failure was not evidence that sequential vertex slicing inherently fails. The segmentation is into strips, requiring strip triangulation rather than fans.
- EXP-030's rejected vertex-index/count hypotheses do not exclude edge identifiers. EXP-031–036's stronger “signature,” topology-falsification, or global-state interpretations do not survive the explicit edge/metadata mapping. Their narrow differential observations remain historical evidence.
- C13 remains useful for ID-persistence/feature-history experiments, but is **not required to decode Block1/Block2**. The old H1b/H2 causal comparison was not an exhaustive set of format interpretations.
- EXP-028's low STEP endpoint match rate does not measure error to a CAD surface. EXP-045's surface comparison is the relevant controlled geometry check; it does not assert lossless recovery of exact B-rep.

## Parser and remaining limits

`parser/v0.2` implements the verified strip/edge layout and forward metadata read, retaining unknown data and original coordinates. It exports triangle indices and boundary cycles, not a converter. Its corpus checks compare against this research implementation, and malformed-input checks require explicit rejection or withheld metadata. See [validation results](PARSER_V02_VALIDATION.json).

Still open: Block3's nonzero semantics, optional scalar-array meaning, raw curve-type packing, unvalidated surface-tag parameter meanings, the rest of each serialized object after the edge table, complete body/configuration scoping, outer container directory/CRC/stream selection correctness, legacy OLE2, opaque `Config-0-Partition`, exact B-rep, and feature history. These are real limits; the first two blocks' practical mesh/edge relationship is now established, but the entire format is not fully understood.

## Reproduction

Run from repository root, using Node's built-in modules only:

```sh
node v0.4.8/exp042_strip_layout.js
node v0.4.8/exp043_edge_tokens.js
node v0.4.8/exp044_metadata_bridge.js
node v0.4.8/exp045_forward_metadata.js
node v0.4.8/exp046_boundary_cycles.js
node parser/v0.2/test/validate.js > v0.4.8/PARSER_V02_VALIDATION.json
```

The experiment JSON outputs are deterministic for these source files. No original model or archived experiment is modified. `research-common.js` reuses only the existing container decompressor; its forward geometry scan does not filter candidates using INV-016–018, ONE counts, or alleged edgeCount bounds. Structural header recognition is still part of selection and cannot be presented as an independent test of those header values.

---

## Correction, 2026-09-15 (EXP-049): part of the STL residual is a defective export, not tessellation

Appended by a later, partly-independent replication ([EXP-049](../knowledge/evidence/2026-09-15_v0.4.8-EXP049.md)). Nothing above is rewritten.

This report attributes the EXP-042 STL comparison mismatches to tessellation ("Different STL tessellation remains visible and is archived; curved-model triangle equality is **not** claimed"). That explanation cannot cover **C09**, which is a chamfered cube — entirely planar, no curved surface anywhere — yet `EXP042_RESULTS.json` records `unmatchedGenerated: 2, unmatchedReference: 0` for it.

Auditing every controlled `model.STL` by facet-normal group: **C03, C09 and C11 each contain no `-1,0,0` group at all — the −X face is absent from the export.** A missing axis-aligned normal group cannot arise from tessellation choice, since a differently-tessellated planar face still produces facets with that normal.

- **C09's residual is fully explained**: it needs 16 triangles, the STL has 14, and the two unmatched generated triangles are the two 50 mm² halves of the absent −X face. `unmatchedReference: 0` means the strip reading reproduces every triangle the STL *does* contain and adds the ones it lacks.
- For **C03** and **C11**, 2 unmatched triangles are this missing face; the remainder is genuine tessellation difference.
- **The SLDPRT display mesh is more complete than the STL export.** This agrees with EXP-046's own result that all 13 controlled SLDPRT meshes are closed under exact triangle-edge matching: the meshes are closed, three of the exports are not.
- **C03/C09/C11's STL must not be used as watertight ground truth** for parser validation without accounting for the missing face.

This strengthens the strip interpretation rather than qualifying it — the residual left conservatively unexplained here is not a defect in the strip reading. The *cause* of the omission (exporter bug, export setting, or something in how those three models were generated) is not established.

EXP-049 also replicates INV-020/021/022 through a different face-discovery path and adds an edge-order falsification control absent from this report: shuffling the edge order within each strip, holding tokens and incidence fixed, produces 44,640 exceptions versus 0 for the documented order — so the ordering documented above is load-bearing, not an artifact of the classification.

---

## Visual validation, 2026-09-16 / 2026-09-20 (EXP-051)

Appended by a later experiment; nothing above is rewritten.

`parser/v0.2`'s output is rendered directly by [`exp051_render_validation.js`](exp051_render_validation.js)
— a self-contained software rasteriser, no external dependencies, consuming this parser's own
`triangleIndices` and `edgeAnnotations` verbatim. Eleven models, six viewpoints each, in
[`EXP051_renders/`](EXP051_renders); view angles in [`EXP051_RENDER_INDEX.json`](EXP051_RENDER_INDEX.json).
All render coherently, and the nonzero-annotation overlay lands on real face outlines in every
model — an independent visual check on the Block1 edge partition described above.

A mesh-closure check prompted by one of the images: Pocket Wheel, USB hub TOP, C04 and C10 are
fully closed (0 open edges); the Helical Bevel Gear has 32 open edges of 9,079 and Dekor 72 of
22,959, **all of them collinearly paired with another open edge** — the differing-subdivision
phenomenon this report already records as 389 `different-sampling` edge-ID groups, not missing
faces. No edge anywhere is shared by more than two triangles.

Scope: this validates the display mesh, not the CAD surfaces, and asserts no tolerance. See
[the evidence file](../knowledge/evidence/2026-09-16_v0.4.8-EXP051.md).

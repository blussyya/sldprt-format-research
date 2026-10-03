# Open questions

What is not known yet, roughly in the order it blocks useful work. Each item names what would
settle it. The research queue with full history is
[NEXT_QUESTIONS.md](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/NEXT_QUESTIONS.md)
in the dump.

## Toward exact conversion

**Does the decoded body match SolidWorks' STEP export face for face?** The native body parses
completely and passes every graph check, and its surfaces carry the display mesh. What has not
been measured is a direct comparison with each model's `model.step`: surface parameters,
vertex positions, edge curve types and enclosed volume, for all 49 controlled models. This is
the current work. It is the gate for a STEP writer that emits exact geometry instead of facets.

**Evaluating B-spline, swept and blended surfaces.** Their control points, knots and defining
data are read, but nothing yet evaluates them, so the mesh cannot be checked against them and a
writer cannot sample them. STEP has B-spline surfaces natively. Swept surfaces and rolling-ball
blends have no direct STEP equivalent and will need either an exact mapping or a stated
approximation.

**Procedural curves.** INTERSECTION and SP_CURVE edges are stored as defining data rather than
explicit curves. Exact STEP output needs either their STEP equivalents (`SURFACE_CURVE`,
`PCURVE`) or a fitted B-spline with a stated tolerance.

**The two lofts.** In C16, both eras, the embedded body differs from the exported one in
`nom_geom_state` and in several curve references. Which one SolidWorks treats as the part is
unknown.

**314 off-surface display vertices** in the production parts are neither on the surface nor on a
chord between on-surface samples. Everything else off-surface is explained.

## Partition streams

- What the `(deltas)` section after each partition encodes, and whether it ever changes the body.
- What `GhostPartition` is for.
- The one-face PLANE bodies in `ResolvedFeatures`. In the controlled cubes their number follows
  the number of cuts or split lines. That is an observation, not a decoded role.
- The 64-byte prefix before the LocalBodies section, which contains the imported file's name in
  UTF-16LE and fields not yet decoded.
- How bodies are chosen for multi-configuration parts. The corpus has one configuration per part.

## DisplayLists

- The SolidWorks 2011 surface record. Legacy faces have geometry and bounding records but no
  decoded surface record, so no face ID or tag. The native body still has both.
- Block3. Every byte observed is zero.
- The optional per-vertex scalar arrays (390 faces), the eight-byte auxiliary array (8 faces), and
  the edge type tags in the edge table.
- The first 12 and last 40 bytes of the bounding record, and the per-configuration bounding record.
- Faces with zero normals. Another project's code allows them; none occur here, and the reader
  rejects them.

## Container and versions

- The modern container's directory: the reader finds streams by signature scan.
- The per-file value at stream header +0.
- Pre-2011 files: `DisplayLists__Zip`, the `plate4` array layout, and their B-rep (`Config-0-Body`
  in chainwheel).
- SolidWorks versions other than 2011 and 2022 are covered only by the production parts, whose
  versions are not recorded.
- Assemblies and drawings are out of scope so far.

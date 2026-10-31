# Open questions

What isn't known yet, roughly in the order it gets in the way. Each item says what would settle
it. The research queue, with its full history, is [NEXT_QUESTIONS.md][next] in the dump.

## Exact geometry

**Answered: the decoded body matches SolidWorks' STEP export.** It agrees on all 49 controlled
models to 9e-18 m ([page 3](../format/3-parasolid-body.md#how-well-it-reads)), and the exact STEP
export built on it is validated ([validation](validation.md#exact-step)).

**Answered: the geometry that only real parts use.** Intersection curves, SP_CURVE edges, swept
surfaces and constant-radius rolling-ball blends can all be evaluated from their own data. STEP
gets exact entities where it has them, and B-splines fitted to 1e-5 mm where it doesn't
([exact STEP](../export/exact-step.md)).

Still open:

- **Two online parts don't resolve yet.** In `2f121983` a blend's spine is where two offset swept
  surfaces cross. The file's chart for it is exact, but it has 5 points over 28 mm and the curve
  bows 1.4 mm away from the first chord, and near the start the foot on the offsets jumps. In
  `82981f2a` (head_back) the blend surface fit stops on an interpolation band. Three others that
  used to stop are fixed ([EXP-086][exp086]).
- Variable-radius blends and chamfer blends. None of the corpus parts with a solid needs them, but
  the export stops if it meets one.
- The XT field layouts of SPUN_SURF and OFFSET_SURF. No corpus file uses either. A file that has
  one would settle it.
- **The two lofts.** In C16, in both versions, the embedded body differs from the exported one in
  `nom_geom_state` and in several curve references. Which one SolidWorks treats as the part isn't
  known.
- **Off-surface display vertices.** 231 interior and 11 boundary vertices in the real parts are
  neither on their surface nor on a chord between on-surface points
  ([page 4](../format/4-mesh-and-body.md#how-close-the-mesh-sits-to-the-surface)). Everything else
  that's off the surface is explained.

## Partition streams

- What the `(deltas)` section after each partition encodes, and whether it ever changes the body.
- The ghost partition holds feature inputs (profile sketches, section planes, reference surfaces),
  never the solid ([page 3](../format/3-parasolid-body.md#the-other-partition-streams)). Still
  open: which feature each body belongs to, and what the single default vertex in most files
  stands for.
- The one-face PLANE bodies in `ResolvedFeatures`. In the controlled cubes, how many there are
  follows the number of cuts or split lines. That's an observation, not a decoded meaning.
- The 64-byte prefix before the LocalBodies section. It contains the imported file's name in
  UTF-16LE, plus fields nobody has decoded.
- Which configuration was active, in files without `Config-N-ModelHeader` (before about
  SolidWorks 2020). From 2020 on, `Header2` says so ([page 3](../format/3-parasolid-body.md#which-body-is-the-part)).
- STL from the B-rep, for parts with no display mesh, doesn't close on every online part yet
  ([EXP-085][exp085], section 7).
- What makes a save rewrite DisplayLists. In 18 of 175 files the stream is from an older save
  than the last one, but four community re-saves all got a new one ([page 1](../format/1-container.md#displaylists-version)).
- XT types 85, 87, 88 and 89 are in the reader with their 2006-reference layouts but haven't
  been seen in a file.

## Display mesh

- The SolidWorks 2011 surface record. 2011 faces have geometry and bounding records but no decoded
  surface record, so no face ID or tag. The body still has both, and the mesh joins it by edge IDs.
- Block3. Every byte seen so far is zero.
- The cosmetic-thread band record after its normals, and how a band links to its VECTOR_VALUES
  node in the body ([page 2](../format/2-display-mesh.md#cosmetic-threads)).
- One 2013 part (head_back) has 535 faces in its body and 532 in its mesh. Which three faces have
  no tessellation, and why, isn't known.
- The optional per-vertex arrays (390 faces), the 8-byte extra array (8 faces), and the edge type
  tags in the edge table.
- The first 12 and last 40 bytes of the bounding record, and the bounding record that shows up
  once per configuration.
- Faces with zero normals. Another project's code allows them. None turn up here, and the
  reference reader rejects them.
- The tessellation vertex count of a cylindrical face doesn't track diameter. 70 vertices for
  the 5 mm hole, 56 for the 3 mm one: a 1.25 ratio against an expected 1.67. Two diameters isn't
  enough to guess the rule, only to kill the linear one ([EXP-028][exp028]).
- What makes Block1's tokens change. Faces next to a newly added face changed in 17 of 17 cases;
  36 of 36 untouched non-adjacent faces kept theirs. Between those sit the 12 faces whose
  vertices moved without new neighbours: 11 changed, one (the C06 cylinder) didn't. So neither
  candidate explanation, adjacency or own vertices moving, can be eliminated yet — the
  discriminating cell, adjacent faces whose vertices did not change, has zero rows corpus-wide.
  The split-line model that would fill it (spec'd as C13) is designed and has never been built
  ([EXP-041][exp041]).

## Container and versions

- The modern container's directory. Right now streams are found by scanning for a signature.
- The per-file value at stream header +0.
- Files older than 2011: what strip control word 0 means beyond "a single triangle", and the two
  empty arrays in chainwheel's face records ([page 5](../format/5-pre-2011.md#the-mesh)).
- Releases 2008, 2009 and 2012 have no sample yet. Every other release from 2007 to 2026 is
  covered by at least one public part ([page 6](../format/6-version-history.md#verified-on)).
- Assemblies and drawings haven't been looked at yet. One suspicion ahead of that: a display
  reader run on two assemblies outside the corpus — SolidWorks 2020 and 2023 — decoded the
  first's mesh but found no strip-length signatures in the second's (DisplayLists 16000), and
  neither file offered a `Config-N-Partition`. Parts through 17000 read fine, so nothing here
  contradicts [page 1](../format/1-container.md). But both observations come from one run each,
  on files nobody stored, so treat them as something to test, not as facts.

## Feature tree

The history (features, sketches, dimensions, configurations, materials) is stored in MFC
`CArchive` object streams. The tree itself is in `Config-N-ResolvedFeatures`. The class names are
plain text (`moPart_c`, `moRefPlane_c`, `moOriginProfileFeature_c`, `sgSketch`, …), so the stream
reads as a tree of objects.

Decoding the fields has started, and it's in progress in the dump:

- `swXmlContents/KeyWords` is a plain XML index of the tree: every feature's ID, name and type,
  and some dimension values ([EXP-079][exp079]).
- Sketches decode on every SolidWorks 2022 controlled model, and a sequential reader gets through
  all 24 of those models to the end of the stream ([EXP-079][exp079]).
- What SolidWorks 2022 changes when it re-saves a 2011 file ([EXP-080][exp080]), the `Config-0`
  configuration archive ([EXP-081][exp081]), and the first real parts ([EXP-082][exp082]).

None of that is written up here yet. Rebuilding a part from its history would need every feature
type SolidWorks has, which is a far bigger job than the geometry. Nothing in exact STEP or STL
depends on it.

[next]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/NEXT_QUESTIONS.md
[exp079]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-04_v0.5-EXP079.md
[exp028]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-08-14_v0.4.7-EXP028.md
[exp041]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-09-13_v0.4.7-EXP041.md
[exp080]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-05_v0.5-EXP080.md
[exp081]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-05_v0.5-EXP081.md
[exp082]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-05_v0.5-EXP082.md
[exp084]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-27_v0.5-EXP084.md
[exp085]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-28_v0.5-EXP085.md
[exp086]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/evidence/2026-10-31_v0.5-EXP086.md

# Tests

```sh
npm test                 # everything
node test/run.js samples # only files whose name contains "samples"
```

`samples.test.js`, `web.test.js` and the fuzz half of `inflate.test.js` run from a fresh clone.
Everything else checks the readers against the **research corpus**: 73 `.SLDPRT` files plus
SolidWorks' own STEP, STL, X_T and X_B exports of the 49 purpose-built models. The corpus lives
in the dump repository, not here:

```sh
git clone https://github.com/blussyya/sldprt-research-dump ../sldprt-research-dump
npm test
```

The tests look for the corpus in `$SLDPRT_CORPUS`, then in `../sldprt-research-dump`. Without it,
corpus tests are reported as skipped, not passed.

| file | what it holds the code to |
|---|---|
| `samples.test.js` | Face counts, surface tags, closed meshes, B-rep census, ID join, STL/STEP validity, corruption controls, every CLI command — on `samples/` |
| `display.test.js` | Golden output for all 73 files; 25 SW2011 files / 145 faces and 45 modern / 1,414 faces with SolidWorks' face counts; browser = Node decompression; empty-edge-table rule; container CRC on every stream |
| `convert.test.js` | The 13 controlled cubes against SolidWorks' STL and STEP: closed meshes, exact bounding boxes and planar volumes, no dangling STEP references |
| `parasolid.test.js` | All 98 X_T/X_B exports and 49 embedded partitions parse to the terminator with 0 graph-check failures; C00 is exactly the 10 mm cube; 21 original parts; display IDs and tags join the native body on 1,414/1,414 faces |
| `brep-step.test.js` | The native body against SolidWorks' `model.step` on all 49 controlled models (EXP-075), plus 20 mutations that must be caught |
| `step-write.test.js` | Our exact STEP reads back as the body and holds the same volume as SolidWorks' STEP on all 49; closed-form volumes; real parts are exact or fall back to the mesh for a stated reason |
| `inflate.test.js` | `src/inflate.js` against Node's zlib |
| `web.test.js` | Viewer worker in an isolated context; server serves every asset |

`fixtures/display-golden.json` is the SHA-256 of every file's complete display parse as produced
by `parser/v0.3`. If a change alters any parse, the golden test names the file. Regenerate it
only when the change is intended, and say why in the commit.

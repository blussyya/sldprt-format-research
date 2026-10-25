# How the format was worked out

The project started in mid-2026 with no spec for anything inside a SLDPRT. This is the short
version: what got found, in what order, and what we believed wrongly along the way. The full lab
notebook (every experiment with its script, its raw output and its later corrections) is in the
[research dump][dump-knowledge], and this page links into it.

## Timeline

| when | version | what happened |
|---|---|---|
| June 2026 | v0.2–v0.3 | First converter prototypes. Both containers recognised. Faces found by scanning for the `[12,100,2,V]` marker, and loops split where the normals jump, which later turned out to be wrong. The code is kept in the dump. |
| late June | v0.3.5 | The evidence rule: every number needs its script, its corpus and its raw output. The knowledge base starts. |
| 27 June | v0.4.0 | First verified structure: positions, normals, the Block1 and Block2 headers, and the arithmetic `B2 → (raw+2)/2` that adds up to the vertex count. 595 faces in 4 files. The converter is taken out to focus on the format. |
| July | v0.4.1–v0.4.4 | Stress tests up to 1,234 faces, a second implementation written separately, and an off-by-one in a documented formula found and fixed. A Block1→Block2 offset bug made two experiments quietly test nothing. |
| 13 Aug | v0.4.5–v0.4.6 | Offset bug fixed and the runs repeated. A "header present only if there are 2 sections or fewer" pattern holds with zero exceptions on 1,172 faces. It later turned out to come from where the scan looked. |
| Aug – mid Sept | v0.4.7 | The first controlled models (C00–C12, cubes with one change each). Fifteen experiments tried to explain Block1's values as "token signatures" of geometry, orientation, topology or feature history. Most were proven wrong, and all of them rested on a wrong starting point. |
| 14 Sept | v0.4.8 | **The breakthrough.** Block2 entries are triangle-strip lengths, not CAD loops. Block1 labels strip edges, and its nonzero values are edge IDs shared with the face next door. A surface record follows the mesh. Parser v0.2. Reproduced through a different code path with a shuffle control (EXP-049), and rendered from six angles (EXP-051). |
| 20 Sept | | First converter on the new decoding: STL exact, STEP with analytic planes (EXP-053). `Config-0-Partition`, written down for months as unreadable high-entropy data, turns out to be a 28-byte header plus ordinary zlib, with a Parasolid transmit file inside. |
| 21 Sept | v0.4.9 | A second corpus built for the project: 24 SolidWorks 2022 and 25 SolidWorks 2011 models, each exported to STEP, STL, X_T and X_B, with SolidWorks' own surface type for every face. Surface tags 4003–4006 identified (EXP-055). The container CRC-32 confirmed on every stream (EXP-057). The 132-byte "opaque prefix" turns out to be an analytic bounding box (EXP-061–064). |
| 22 Sept | | Parser v0.3 reads SolidWorks 2011 files, checked against sizes picked before the models were built (EXP-066). Reading the published Parasolid XT reference shows that the "type letters" in the schema table are an edit script (EXP-067). |
| 28–29 Sept | | A typed Parasolid reader parses all 98 exports and all 49 embedded partitions to the terminator with zero graph-check failures, then 21 real parts (EXP-071–073). The display mesh and the body join by face and edge ID on 1,414 of 1,414 faces. Tags 4007 and 4009 are identified through that join, and the partition section frame is decoded (EXP-074). |
| 2 Oct | v0.5 | The parser, converter, Parasolid reader and viewers are merged into one package, and this documentation replaces the per-version research folders. |
| 3 Oct | | The decoded body matches SolidWorks' own STEP export on all 49 controlled models, to 9e-18 m (EXP-075). A first exact STEP writer gets 42 of 49, because STEP has no direct form for a cone's edgeless apex loop or a whole sphere or torus with no boundary. With those handled, 49 of 49 are the same solid as SolidWorks' export, checked by OpenCascade and by exact volume (EXP-076). The three pre-2011 parts turn out to use PKWARE implode instead of zlib, and the oldest holds a Parasolid 9 body in little-endian bare binary. Both read now, and the empty-looking SW2000 part really is empty. Intersection curves and tolerant edges are located and checked (EXP-077). |
| 4–5 Oct | | Intersection curves, tolerant edges, swept surfaces and rolling-ball blends are all evaluated, and every real part with a solid exports exact STEP. The ghost partition turns out to hold feature input geometry, and the mesh joins the body in every version through its edge IDs (EXP-078). How SolidWorks' own STEP handles the curves STEP can't express (EXP-079 part A). Reading the feature tree starts: sketches decode on every SolidWorks 2022 controlled model, along with what a 2011 file looks like after SolidWorks 2022 saves it again and the `Config-0` configuration archive (EXP-079 part B, EXP-080–082, all in progress). |
| 20–21 Oct | | Exact STEP becomes the default export. Every corpus part with a partition passes OpenCascade, and 64 match SolidWorks' own export. The same path runs in the browser. |
| 25 Oct | | The code moves to its own repository, [solidworks-converters][code], under Apache-2.0. This repository becomes documentation only, under CC BY-SA 4.0. |

### The October staging branch

The 3 October work lived on a separate `staging` branch of this repository for three weeks, in
two commits: "Write exact STEP from the B-rep, with the mesh as fallback" (`0f3ef48`) and "Read
pre-2011 parts and document where every curve is stored" (`61cdff2`). Meanwhile `main` got its own
exact STEP writer on 20–21 October. The two were merged by hand on 24 October, before the branch
was deleted:

- **The pre-2011 reader** (PKWARE implode, Parasolid 13 and Parasolid 9 bodies, the older mesh
  layouts) and **exact volume** went into solidworks-converters, in the commit "Read pre-2011
  parts and add exact volume, from the staging branch". The reader was rewritten in main's style
  so it also runs in the browser.
- **Its tests** went in too. The STEP ones were later pointed at main's writer, and they still
  read every STEP back as the native body.
- **Its findings** are in these docs: [page 5](../format/5-pre-2011.md), the curve storage on
  [page 3](../format/3-parasolid-body.md#curves-that-arent-on-the-edge), and
  [exact volume](../export/exact-volume.md).
- **Its STEP writer** was dropped. Main's writer exports every real part with a solid exactly,
  so staging's fallback to a mesh STEP wasn't needed any more.

## What we got wrong, and why it mattered

Most of the time went into ideas that were wrong. They're worth knowing before you try something
like this.

**Naming something before knowing what it is.** The Block2 entries decoded to numbers that added
up to the vertex count, so they got called "loop sizes". For three months every Block1 experiment
looked for loop structure that isn't there, and fanning triangles over "loops" made webbing that
got read as a decoding problem. The arithmetic was right the whole time. The name was wrong. What
fixed it was asking what else adds up to a vertex count: triangle strips.

**Checks that couldn't fail.** Some early checks were true by definition: "no bytes between the
normals and Block1", when the Block1 offset was defined as the end of the normals. A review found
four of them. They're recorded as failed hypotheses, not deleted.

**Mistaking where we looked for what the file does.** The strip-length array was believed to be an
optional "alternative header" that only shows up on faces with one or two strips, with zero
counterexamples on 1,172 faces. It's on every face. The scanner only looked for it at offsets
where short arrays end.

**Reading high entropy as "encrypted".** The partition measured 7.93–8.00 bits per byte and got
written down as unreadable. Entropy that high means compressed. Trying to inflate it would have
taken a minute.

**A parse that looked fine and wasn't.** An early schema-table reader returned 5 entries out of 19,
missing exactly the ones that carry geometry, and it looked clean. Only comparing it with the text
encoding of the same body caught it. That's why the readers now stop and say where they stopped,
instead of guessing past something they don't know.

**Trusting the reference export.** SolidWorks' own STL exports of C03, C09 and C11 are missing a
whole face (−X), and the C04 export is missing its top cap. Mismatches against them got blamed on
the parser at first. The mesh stored in the SLDPRT is more complete than SolidWorks' own STL of the
same part.

The full list, with evidence, is [FAILED_HYPOTHESES.md][failed] (35 entries).

## Method

The rules that came out of those mistakes:

1. Every claim has a script, a corpus size and raw output in the repository.
2. Every number comes with its corpus. "0 exceptions" means nothing without "in N files, M faces".
3. Verified and inferred stay separate, and "readable" doesn't mean "decoded".
4. Controlled models change one thing at a time and are built to sizes picked in advance, so a
   decoded number can be checked against a known answer.
5. Wherever possible, the check is against a separate encoding of the same thing: SolidWorks' own
   STEP, STL, X_T and X_B exports and its per-face report. Checking against the parser's own
   expectations doesn't count.
6. Claims from outside are hypotheses. Several were wrong when tested on the corpus.

## Prior art

Other public work on these formats, as of September 2026. None of this is evidence, and nothing
here depends on it.

- **Container and metadata:** openswx (C++, MIT), swformat (Python, Apache-2.0), cadmpeg (Rust,
  Apache-2.0, which covers the modern container's block layer in more detail than this project).
- **Display mesh:** sldprt-export (Python, MIT, which also rebuilds assemblies, something this
  project doesn't do).
- **Parasolid partition:** sldprt2step (Python, Apache-2.0), solid-diff, parasolid-kit
  (Rust/Python, MIT/Apache-2.0).
- **Historical:** Bryan Bishop's pre-2015 page was the first to name the stream publicly, as
  `Contents/DisplayLists__ZLB`, without decoding it. That suffix only exists in the legacy
  container.

What this project has that the survey didn't find anywhere else: the surface tag values, what
Block1's edge IDs mean, the boundary-cycle topology, the analytic bounding record, and a controlled
corpus with per-face ground truth in two SolidWorks versions.

No SolidWorks or Dassault source code, decompiled binaries, Siemens SDK schema files or other
projects' schema files were used. The Parasolid layer follows the published 2006 XT reference, and
every field layout is checked against the corpus.

[dump-knowledge]: https://github.com/blussyya/sldprt-research-dump/tree/main/knowledge
[failed]: https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/FAILED_HYPOTHESES.md
[code]: https://github.com/blussyya/solidworks-converters

# How the format was worked out

The project started in mid-2026 with no specification for anything inside a SLDPRT. This is the
short account: what was found, in what order, and what was believed wrongly on the way. The full
ledger (every experiment, its script, its raw output and its corrections) is kept in the
[research dump](https://github.com/blussyya/sldprt-research-dump/tree/main/knowledge), and this
page links into it.

## Timeline

| when | version | what happened |
|---|---|---|
| June 2026 | v0.2–v0.3 | First converter prototypes. Both containers recognised. Faces located by scanning for the `[12,100,2,V]` marker; loops split by normal discontinuities, a heuristic later shown wrong. Code preserved in the dump. |
| late June | v0.3.5 | Evidence preservation policy: every number must come with its script, corpus and raw output. The knowledge base starts. |
| 27 June | v0.4.0 | First verified structure: positions, normals, Block1 and Block2 headers, and the arithmetic `B2 → (raw+2)/2` that sums to the vertex count. 595 faces in 4 files. The converter is removed to focus on the format. |
| July | v0.4.1–v0.4.4 | Stress tests to 1,234 faces, an independent second implementation, and an off-by-one in a documented formula found and corrected. A Block1→Block2 offset bug made two experiments silently test nothing. |
| 13 Aug | v0.4.5–v0.4.6 | Offset bug fixed and runs repeated. A "header present iff section count ≤ 2" correlation holds with zero exceptions on 1,172 faces. It later turned out to be an artifact of where the scan looked. |
| Aug – mid Sept | v0.4.7 | The first controlled models (C00–C12: cubes with one change each). Fifteen experiments tried to explain Block1's values as "token signatures" of geometry, orientation, topology or feature history. Most were falsified. All of them rested on a wrong premise. |
| 14 Sept | v0.4.8 | **The breakthrough.** Block2 entries are triangle-strip lengths, not CAD loops. Block1 annotates strip edges, and its nonzero values are edge IDs shared with the neighbouring face. A forward surface record follows the mesh. Parser v0.2. Replicated through a different code path with a shuffle control (EXP-049); rendered from six angles (EXP-051). |
| 20 Sept | | First converter on the new decode: STL exact, STEP with analytic planes (EXP-053). `Config-0-Partition`, recorded for months as unreadable high-entropy data, turns out to be a 28-byte header plus ordinary zlib, and inside it a Parasolid transmit file. |
| 21 Sept | v0.4.9 | A second purpose-built corpus: 24 SolidWorks 2022 and 25 SolidWorks 2011 models, each exported to STEP, STL, X_T and X_B, with SolidWorks' own per-face surface types. Surface tags 4003–4006 identified (EXP-055). Container CRC-32 confirmed on every stream (EXP-057). The 132-byte "opaque prefix" decoded as an analytic bounding box (EXP-061–064). |
| 22 Sept | | Parser v0.3 reads SolidWorks 2011 legacy files, checked against dimensions fixed before the models were built (EXP-066). Reading the published Parasolid XT reference shows that the "type letters" in the schema table are an edit script (EXP-067). |
| 28–29 Sept | | A typed Parasolid reader parses all 98 exports and all 49 embedded partitions to the terminator with zero graph-check failures, then 21 production parts (EXP-071–073). The display mesh and the native body join by face and edge ID on 1,414/1,414 faces; tags 4007 and 4009 are identified through the join; the partition section frame is decoded (EXP-074). |
| 2 Oct | v0.5 | The parser, converter, Parasolid reader and viewers are merged into one package. This documentation replaces the per-version research folders. |
| 3 Oct | | The decoded body matches SolidWorks' own STEP export on all 49 controlled models, to 9e-18 m (EXP-075). An exact STEP writer follows: the first version gets 42 of 49 because it has no STEP form for a cone's edgeless apex loop or a whole sphere or torus with no boundary. With those added, 49 of 49 are the same solid as SolidWorks' export, checked by OpenCascade and by exact volume (EXP-076). |

## What was wrong, and why it mattered

Most of the time went into ideas that were wrong. These are worth knowing before attempting
something similar.

**Naming a quantity before knowing what it is.** The Block2 entries decoded to numbers that
summed to the vertex count, so they were called "loop sizes". For three months every Block1
experiment looked for loop structure that is not there, and fan triangulation over "loops"
produced webbing that was read as a decoding problem. The arithmetic was right the whole time;
the name was wrong. The fix came from asking what else sums to a vertex count: triangle strips.

**A tautology counted as a test.** Several early checks could not fail: "no bytes between normals
and Block1" when the Block1 offset was defined as the end of the normals. A review found four of
them. They are recorded as failed hypotheses rather than deleted.

**A detection window mistaken for a property.** The strip-length array was believed to be an
optional "alternative header" present only on faces with one or two strips, with zero
counterexamples on 1,172 faces. It is present on every face. The scanner only looked for it at
offsets where short arrays end.

**High entropy read as "encrypted".** The partition measured 7.93–8.00 bits per byte and was
written down as unreadable. That entropy means compressed. Trying to inflate it would have taken a
minute.

**A plausible parse that was wrong.** An early schema-table reader returned 5 entries out of 19,
missing exactly the geometry-bearing ones, and looked clean. Only cross-checking against the text
encoding of the same body caught it. The readers in this package stop and report where they
stopped rather than guess past an unknown.

**Trusting the reference export.** SolidWorks' own STL exports of C03, C09 and C11 are missing a
whole face (−X), and the C04 export is missing its top cap. Mismatches against them were
initially blamed on the parser. The display mesh in the SLDPRT is more complete than SolidWorks'
STL of the same part.

The full list, with evidence, is in
[FAILED_HYPOTHESES.md](https://github.com/blussyya/sldprt-research-dump/blob/main/knowledge/FAILED_HYPOTHESES.md)
(35 entries).

## Method

The rules that came out of those mistakes:

1. Every claim has a script, a corpus size and raw output in the repository.
2. Every number is stated with its corpus: "0 exceptions" means nothing without "in N files, M faces".
3. Verified and inferred are kept apart, and "readable" is not "decoded".
4. Controlled models change one thing at a time and are built to dimensions fixed in advance, so
   a decoded number can be checked against a known answer.
5. Wherever possible, the check is against an independent encoding of the same thing: SolidWorks'
   STEP, STL, X_T and X_B exports and its own per-face report. A check against the parser's own
   expectations does not count.
6. Outside claims are hypotheses. Several turned out wrong when tested on the corpus.

## Prior art

Other public work on these formats, as surveyed in September 2026. This is not evidence, and
nothing here depends on it.

- **Container and metadata:** openswx (C++, MIT), swformat (Python, Apache-2.0), cadmpeg (Rust,
  Apache-2.0; documents the modern container's block layer in more detail than this project).
- **Display mesh:** sldprt-export (Python, MIT; also reconstructs assemblies, which this project
  does not).
- **Parasolid partition:** sldprt2step (Python, Apache-2.0), solid-diff, parasolid-kit
  (Rust/Python, MIT/Apache-2.0).
- **Historical:** the stream was first named publicly on Bryan Bishop's pre-2015 page as
  `Contents/DisplayLists__ZLB`, undecoded. That suffix is legacy-only.

What this project has that the survey did not find elsewhere: the surface tag values, Block1's
edge-ID meaning, the boundary-cycle topology, the analytic bounding record, and a controlled
corpus with per-face ground truth in two SolidWorks versions.

This project uses no SolidWorks or Dassault source code, decompiled binaries, Siemens SDK schema
files, or other projects' schema assets. The Parasolid layer follows the published 2006 XT
reference, and every field layout is checked against the corpus.

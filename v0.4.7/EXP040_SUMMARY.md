# EXP-040: Full-Corpus Adjacency Cross-Check + Correction of EXP-037's Shell Contrast Case

**Date**: 2026-08-16
**Status**: Complete
**Version**: v0.4.7

---

## Objective

Two things, both identified during a 2026-08-16 independent audit of EXP-037/038:

1. Build the full-corpus real-adjacency-vs-token-change table that EXP-037 only built for
   C03/C09 (fillet/chamfer), extending it to C04 (hole) and C10 (shell) — using **only
   already-archived `v0.4.7/EXP037_RESULTS.json` data**, no new SLDPRT files, no new tooling.
2. Independently re-derive C10's (shell) real adjacency from raw vertex coordinates, because
   the audit found `EXP037_SUMMARY.md` §4 and `knowledge/evidence/2026-08-14_v0.4.7-EXP037.md`
   §5 both contain a factual error: they claim shell's new inner-wall faces are adjacent to
   "several of the five unmodified outer walls," naming specific indices (7 and 9) as "outer
   walls." **Indices 7 and 9 are themselves new inner-wall faces**, per the same documents'
   own face census ("C10 ... +5 faces 6-10 (inner walls)") — the claim confused two members of
   the *added* set for two members of the *unchanged* set.

## Method

`v0.4.7/exp040_full_corpus_adjacency_crosscheck.js`:

1. **Part 1** (tabulation only, no new computation): reads the already-committed
   `EXP037_RESULTS.json`'s `matched`/`added`/`adjacentToModelFaces` records for all four
   archived pairs (C03, C09, C04, C10) and builds one table of
   `(structurallyModified, realAdjacentToNewFace, tokenChanged)` per pre-existing face,
   cross-referencing tokens from `EXP033_FEATURE_STATE.json` and — for C10's outer walls,
   where raw token arrays were never archived — the directly-recorded `identical` flag from
   `EXP035_RESULTS.json`'s `originalOuterFaceComparison`.
2. **Part 2** (independent re-derivation, bypassing EXP-037's script and JSON output
   entirely): re-implements shared-vertex counting from scratch directly against
   `VERTEX_ANALYSIS.json`'s raw per-face vertex coordinates for C10, and checks every one of
   the 5 new inner-wall faces against every one of the 5 unmodified outer walls.

A sign-inversion bug was found and fixed in this script's own first draft (token-equality was
initially read backwards, making every result look inverted against known results like "C03's
-X face is unchanged") — caught by checking Part 1's C03 row against EXP-038's already-published
table before trusting any new output, not by post-hoc review.

## Results

### Part 1: Full-corpus tally (24 pre-existing-face checks across 4 feature types)

| | Adjacent to new face | Not adjacent to new face |
|---|---|---|
| **Token changed** | 10 | 0 |
| **Token unchanged** | 0 | 13 |
| Unknown (no archived data) | — | 1 (C10's own opening face, index 4 — the directly-modified feature face itself, not a candidate "unrelated face" test) |

**Zero exceptions** in either direction, across fillet, chamfer, hole, and shell: every
pre-existing face that is genuinely adjacent (≥2 shared vertices) to a feature's new face has a
changed token, and every pre-existing face that is not adjacent is unchanged. (For fillet/
chamfer/hole, the "adjacent + changed" faces include the directly-modified faces themselves —
e.g. hole's own +Z/-Z, which the hole punches through — so this table does not by itself
separate "changed because adjacent" from "changed because directly modified"; see What This
Does NOT Establish.)

### Part 2: Independent shell (C10) recheck — corrects EXP-037

| New inner-wall face | Shared vertices with unmodified outer walls (indices 1-5) | Shared vertices with opening face (index 0) |
|---|---|---|
| 6 | 0, 0, 0, 0, 0 | 2 |
| 7 | 0, 0, 0, 0, 0 | 2 |
| 8 | 0, 0, 0, 0, 0 | 2 |
| 9 | 0, 0, 0, 0, 0 | 2 |
| 10 | 0, 0, 0, 0, 0 | 0 |

**Every new inner-wall face has zero shared vertices with every one of C10's five unmodified
outer walls.** The only real adjacency any new inner-wall face has is to (a) the directly,
structurally-modified opening face (index 0) and (b) other new inner-wall faces. This directly
contradicts EXP-037's written claim (not its underlying computation — `EXP037_RESULTS.json`'s
own `added[].adjacentToModelFaces` field never listed indices 1-5 as neighbors either; the error
was in the prose summary/evidence write-up, not the analysis code).

**Corrected conclusion**: shell contributes **zero** adjacent-but-unchanged data points to this
research question. It is not a counterexample to "real adjacency correlates with a token
change" — it simply supplies no test case for that question at all, since none of its
unmodified faces are ever real-adjacent to anything new. This does **not** prove the
adjacency-correlation is universal (see below) — it removes what was believed to be the one
piece of evidence against universality within this corpus.

## What This Does NOT Establish

1. **Not proof that adjacency is universally sufficient for a token change.** The corrected
   shell data removes a counterexample; it does not supply a new confirming case for "adjacent
   but not directly modified" outside of fillet/chamfer's own {+X,+Y} / {-X,-Y} results (already
   established by EXP-037/038). No feature type in this corpus produces a face that is
   adjacent-to-new-geometry without also being (at minimum, minutely) directly modified itself,
   except fillet/chamfer's own two-face pattern — which is exactly the case already tested.
2. **Does not resolve the adjacency-vs-direct-modification confound** flagged by EXP-038 §7 for
   edge-type features — unaffected by this correction.
3. **Does not change hole's or fillet/chamfer's own findings** — only the shell "contrast case"
   framing changes. Hole's own +Z/-Z faces (structurally modified by the hole itself) remain the
   only adjacent faces to hole's new cylindrical face, unchanged from EXP-037.
4. Not Verified/invariant-level — still correlational, still a bounded set of feature types on
   one cube geometry.

## Correction Scope

This is a correction of **prose claims** in `v0.4.7/EXP037_SUMMARY.md` §4 and
`knowledge/evidence/2026-08-14_v0.4.7-EXP037.md` §5, and of everywhere in `knowledge/` that
repeated the "shell is a counterexample / adjacency is not universally sufficient" framing
sourced from those claims: `knowledge/FAILED_HYPOTHESES.md` (FH-031), `knowledge/OPEN_QUESTIONS.md`
(OQ-032, OQ-036), `knowledge/EXPERIMENT_LOG.md` (EXP-037 entry), `knowledge/RESEARCH_DASHBOARD.md`,
`knowledge/RESEARCH_HANDOFF.md`. Per project policy, none of these are rewritten — dated
correction notes are appended to each, pointing here. EXP-037/038's own JSON results
(`EXP037_RESULTS.json`, `EXP038_RESULTS.json`) and scripts are **not modified** — the underlying
`computeAdjacency()`/`matchFaces()` computation was correct throughout; only the written
interpretation of the shell case was wrong.

## Files Tested / Data Sources

No SLDPRT files parsed. Reads only already-archived `v0.4.7/EXP037_RESULTS.json`,
`EXP033_FEATURE_STATE.json`, `EXP035_RESULTS.json`, `VERTEX_ANALYSIS.json`.

## Confidence

**High** for both the full-corpus tally (Part 1, a direct tabulation of already-validated data)
and the shell recheck (Part 2, an independent from-scratch recomputation using the same
tolerance and method as EXP-037's own `computeAdjacency()`, cross-checked twice: once via the
existing `EXP037_RESULTS.json` adjacency records, once via a fully independent pairwise
recomputation from raw coordinates — both agree).

## Raw Evidence

- `v0.4.7/EXP040_RESULTS.json` — raw results (full table + shell recheck matrix)
- `v0.4.7/exp040_full_corpus_adjacency_crosscheck.js` — script
- `knowledge/evidence/2026-08-16_v0.4.7-EXP040.md` — full evidence writeup

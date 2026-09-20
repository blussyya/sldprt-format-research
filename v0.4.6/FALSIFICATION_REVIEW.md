# v0.4.6 Falsification Review — EXP-026

**Reviewer:** Project Falsification Agent
**Date:** 2026-08-13
**Version:** v0.4.6
**Scope:** `v0.4.6/exp026_seccount_altheader_correlation_test.js`, `v0.4.6/EXP026_RESULTS.json`, `v0.4.6/SUMMARY.md`, `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`, and EXP-026's direct dependencies (v0.4.5 EXP-023-CORRECTED, and — where EXP-026's own claims require it — EXP-021's establishment of the alternative-header offset formula). This review does **not** reopen the general `[4,8,2,N]` semantics investigation.

**Method:** Cloned the repository, read every file in scope plus the v0.4.5 correction chain and the original v0.4.3/v0.4.4 experiments it depends on, then re-ran `v0.4.6/exp026_seccount_altheader_correlation_test.js` from the actual `test files original/` corpus (verified present on disk, 13 MB, all 7 usable files) and diffed the freshly generated output against the archived `EXP026_RESULTS.json` and against `v0.4.5/EXP023_RESULTS_CORRECTED.json` at the per-face level.

---

## What EXP-026 Claims

1. 0 counterexamples across 1,172 faces in 4 directions: `secCount=1` without an N=1 alternative; `secCount=2` without an N=2 alternative; `secCount>=3` with any alternative; alternative N inconsistent with secCount.
2. Distribution matches v0.4.5 exactly: secCount=1: 368, secCount=2: 293, secCount>=3: 511, with-alternative: 661.
3. The result is produced by "a second, independently-written extraction pass built specifically to hunt for exceptions rather than confirm a hypothesis" (SUMMARY.md, evidence file).
4. The correlation is recorded as INV-019, Status: Correlation (not causal).

## What It Actually Does

Re-implements the full v0.4.5-corrected face-extraction pipeline (OpenSX stream decompression → DisplayLists location → face-marker scan → edge/vertex/gap/vertex-float validation → Block1 header `[4,8,2,N]` validation → `block2Start = block1Start + (N+4)*4` → Block2 header `[4,8,2,M]` validation → alternative-header check at fixed offsets `mp-20` (N'=1) and `mp-24` (N'=2)), then adds four explicit boolean counterexample flags (`isCE1`..`isCE4`) per face and aggregates them.

---

## Verification

### 1. Reproduction of the raw result — CONFIRMED

Re-ran the script against the actual corpus files (not the archived JSON). Console output and the regenerated `EXP026_RESULTS.json` matched the committed file exactly except for the `timestamp` field:

```
Total validated faces: 1172
1. secCount=1 with NO N=1 alternative: 0
2. secCount=2 with NO N=2 alternative: 0
3. secCount>=3 WITH an alternative (any N): 0
4. alternative N inconsistent with secCount: 0
secCount=1 faces: 368 | secCount=2 faces: 293 | secCount>=3 faces: 511 | with-alt: 661
Per-file: BOTTOM 39, TOP 68, GEAR 113, DEKOR 375, DISTRIBUTOR 51, POCKET 400, PTC 126 — all CE1-4: 0
```

`SW2000-s01.SLDPRT` genuinely produces no DisplayLists (confirmed: OLE2 container, unsupported by this pipeline, matches the disclosed corpus note). Candidate face-marker counts per file (156/272/452/1500/204/1600/504) match `v0.4.5/EXP024_RESULTS_CORRECTED.json` exactly. **The zero-counterexample claim is verified from source, not just trusted from the archived summary.**

A per-face join between `v0.4.6/EXP026_RESULTS.json` and `v0.4.5/EXP023_RESULTS_CORRECTED.json` on `(file, mp)` shows **1,172/1,172 exact matches** on `secCount`, `hasAlt`, `altN`, `N`/`b1Len`, and `block2Start`. There is not one face where the two runs disagree.

**Verdict: CONFIRMED.** The four counterexample counts, the distribution, and the per-file breakdown are all real, reproducible, and correctly computed from the stated corrected offset formula. This is not a fabricated or cherry-picked result.

### 2. Independence of the second extraction pass — FALSIFIED (claim as stated is overstated)

`SUMMARY.md` and the evidence file describe EXP-026 as "a second, independently-written extraction pass built specifically to hunt for exceptions rather than confirm a hypothesis" and "independently re-derived face extraction."

A line-by-line diff of `v0.4.6/exp026_seccount_altheader_correlation_test.js` against `v0.4.5/exp023_alternative_header_characterization_corrected.js` shows the decompression routine (`rolByte`, `findAll`, `decompressOpenSX`, `findDisplayLists`), the face-marker scan, the edge/vertex/gap/vertex-float validation, the Block1 header read and validation, the `block2Start = block1Start + (N+4)*4` computation, the Block2 header read and validation, and the alternative-header check at `mp-20`/`mp-24` are **byte-for-byte identical algorithms**, differing only in variable names (`b1Len`→`N`, `sectionCount`→`secCount`), comment wording, and the order in which the alt-header check and the B2-validity check happen (which has no effect on the result set, since 100% of this corpus's B2 headers are valid). The only genuinely new code in EXP-026 is the four-line `isCE1`..`isCE4` classification block appended at the end.

This is corroborated by the per-face identity result above: two supposedly independent implementations producing **byte-identical** output on every single field, for every one of 1,172 faces, is exactly what a code copy predicts and is much stronger agreement than two genuinely independent implementations of a non-trivial binary parser would typically produce (compare EXP-016, which the project itself describes as "a completely different implementation, independent of block1_parser.js and stress_test_invariants.js" — that standard is not met here).

This does **not** mean the zero-counterexample result is wrong — it is correctly and reproducibly computed (see §1). But it means EXP-026 does not provide the kind of independent corroboration that terms like "independently-written" imply elsewhere in this project's own vocabulary (EXP-016, EXP-018). What EXP-026 actually adds beyond EXP-023-CORRECTED is: (a) an explicit, auditable four-direction counterexample classification instead of an implicit cross-tabulation, and (b) a fresh, from-source re-run rather than trusting archived JSON. Both are useful, but they are not "independent verification" in the strong sense the surrounding prose repeatedly claims.

**Verdict: FALSIFIED (documentation-accuracy issue, not a data issue).** Recommend downgrading "independently-written extraction pass" language wherever it appears (SUMMARY.md, evidence file, INV-019, OQ-018, RESEARCH_DASHBOARD.md, NEXT_QUESTIONS.md NQ-010) to something like "a second, from-source re-run of the same corrected pipeline with an added explicit counterexample classification" — see Documentation Corrections Required below.

### 3. Circularity from reusing the v0.4.5 offset formula — DISCLOSED, BUT WORTH STATING EXPLICITLY

The script's own header comment discloses that `block2Start = block1Start + (N+4)*4` is reused "verbatim" from v0.4.5, and the task scope explicitly permits this (EXP-026 is a counterexample hunt for the *correlation*, not a re-verification of the *offset formula*). This is honest framing, not a hidden flaw.

However, because the formula is reused rather than re-derived, EXP-026 cannot detect a bug in the offset formula itself — if `block2Start` were still subtly wrong, EXP-026 would faithfully reproduce that wrongness with zero counterexamples, exactly as it reproduced the correct answer here. The formula's correctness rests on evidence *outside* EXP-026: the INV-009 cross-check in EXP-023-CORRECTED (Block2 `M` == count of `ONE` in Block1 body, 1,172/1,172 match) and the pre-existing establishment of the formula by EXP-018/EXP-021. EXP-026 itself does not re-run this cross-check.

**Verdict: Acceptable scope boundary, but the review found it worth stating plainly: EXP-026 tests the correlation given the offset formula, not the offset formula itself.** No fix required beyond making this boundary explicit in the record (done here; also recommend one line in the evidence file).

### 4. Fixed-offset detector limited to N∈{1,2} — CORRECTLY AND CONSISTENTLY CAVEATED

Checked every location that states the correlation (SUMMARY.md, evidence file, INV-019, OQ-018, RESEARCH_DASHBOARD.md). All of them explicitly scope the "no alternative" claim for `secCount>=3` faces to "within the tested N'∈{1,2} detection window" and explicitly disclose that an N'>=3 alternative at a different offset would not be detected. This is the correct, non-overclaiming way to state the finding.

**Verdict: No issue found.** Already properly scoped; no correction needed.

### 5. Missing HEADPHONE corpus — DISCLOSED; MATERIALITY IS A TESTABLE, STILL-UNTESTED PREDICTION

HEADPHONE (62 faces, 0% alternative-header rate per OQ-017) is not present in this repository checkout and is consistently disclosed as excluded everywhere the corpus is described. Under INV-019, HEADPHONE's 0% alternative rate predicts all 62 of its faces should have `secCount>=3`. This prediction is stated in `v0.4.5/SUMMARY.md`'s unresolved questions but has never been tested. It does not weaken the claim about the *tested* corpus, but it is the single most direct, cheap falsification test still available for INV-019 and should be prioritized if the file becomes available.

**Verdict: Disclosed limitation, not a defect. Recommend keeping/raising priority in `NEXT_QUESTIONS.md`.**

### 6. INV-019 classification as Correlation vs. Verified Invariant — CORRECT

INV-019's status field reads "Correlation (not causal; see notes — modeled on INV-013's precedent for high-confidence, non-causal patterns)", explicitly distinct from the "Verified Structural Invariant" status used for INV-016/017/018 (which have a proven or provable structural/mathematical basis) and from "Verified Conclusion" (INV-001 through INV-010). No causal or semantic claim is made anywhere in INV-019's text. This is the correct, conservative classification per the project's own conventions.

**Verdict: No issue found.**

### 7. NEW FINDING (surfaced during this review, not in the original checklist): EXP-021's "332 alternatives (26.9%)" figure is an artifact of a search-window bug, not independent corroboration of the offset formula

This finding is a **direct dependency** of EXP-026: multiple documents (`v0.4.5/CORRECTION_NOTE.md`, `v0.4.5/exp023_alternative_header_characterization_corrected.js` header comment) justify the `mp-20`/`mp-24` fixed-offset alternative-header positions by saying the formula was "already used and validated by ... `v0.4.3/exp021_alternative_headers.js`". EXP-026 inherits this detection logic unchanged (see §2). The review traced this provenance claim and found a problem with it.

`v0.4.3/exp021_alternative_headers.js` (line 28, line 195-196) searches for `[4,8,2,N]` patterns only within `SEARCH_RANGE = 256` bytes of `block1Start`. Because `block1Start = mp + 16 + 24·vc` grows with vertex count while the true alternative-header position is a *fixed* small offset from `mp` (`mp-20` for N'=1, `mp-24` for N'=2), the distance from `block1Start` to the alternative header grows as `-(52 + 24·vc)` (N'=1) or `-(56+24·vc)` (N'=2) — i.e., it exceeds EXP-021's ±256-byte window for any face with roughly `vc > 8-10`. EXP-021 therefore silently misses the alternative header for every higher-vertex-count face.

This was verified computationally against the archived `v0.4.6/EXP026_RESULTS.json` (which records `block1Start` and `altOffset` for every face with an alternative):

```
Of 661 alternatives (v0.4.6/v0.4.5 corrected count):
  |altOffset - block1Start| <= 256:  332   (would be found by EXP-021's window)
  |altOffset - block1Start| >  256:  329   (would be MISSED by EXP-021's window)

Per-file, "in-window" subset vs. EXP-021's reported counts (exact match, every file):
  BOTTOM:      27 total, 22 out-of-window -> 5  in-window   | EXP-021 reported: 5
  TOP:         34 total, 18 out-of-window -> 16 in-window   | EXP-021 reported: 16
  GEAR:        75 total, 18 out-of-window -> 57 in-window   | EXP-021 reported: 57
  DEKOR:      252 total,177 out-of-window -> 75 in-window   | EXP-021 reported: 75
  DISTRIBUTOR: 31 total, 29 out-of-window -> 2  in-window   | EXP-021 reported: 2
  POCKET:     125 total, 50 out-of-window -> 75 in-window   | EXP-021 reported: 75
  PTC:        117 total, 15 out-of-window -> 102 in-window  | EXP-021 reported: 102

N=1: 368 total, 240 in-window (EXP-021 reported N=1: 240) — exact match
N=2: 293 total,  92 in-window (EXP-021 reported N=2: 92)  — exact match
```

Every single per-file and per-N count matches EXP-021's published numbers exactly, to the face. This is not circumstantial: EXP-021's 332 is provably the ±256-byte-windowed subset of the true 661-alternative population, not an independent measurement that happens to be smaller. DEKOR is hit hardest (70.2% of its true alternatives fall outside EXP-021's window, because DEKOR's vertex counts range up to 5,862).

This has never been reconciled anywhere in the knowledge base. `knowledge/KNOWN_INVARIANTS.md` (INV-002, v0.4.3 validation note) and `knowledge/RESEARCH_DASHBOARD.md` (EXP-021 completed-experiments entry) both still state "332 non-B2 alternatives" / "332 alternatives (332/1,234 faces, 26.9%)" without any note that this is a strict, window-truncated subset of the 661 figure reported by EXP-023 (v0.4.4) onward and unchanged through EXP-023-CORRECTED/EXP-026. This is the same category of "unacknowledged contradiction" the project's own `v0.4.4/FALSIFICATION_REVIEW.md` flagged for EXP-023 vs. EXP-024 — it just wasn't previously noticed for EXP-021 vs. EXP-023.

**Impact on EXP-026 specifically: none.** EXP-026 (and EXP-023-CORRECTED before it) check the two fixed offsets directly and unconditionally, with no windowing, so this bug does not affect EXP-026's own 661/1,172/0-counterexample numbers — those are correct and were independently re-verified in §1. The impact is narrower: the claim that the `mp-20`/`mp-24` formula was "already validated" by EXP-021 overstates how much of the corpus EXP-021 actually validated it against (roughly half, by face count, and disproportionately less for high-vertex-count files like DEKOR).

**Verdict: CONFIRMED, new finding.** Recommend an append-only correction note (see below) — not a rewrite of EXP-021's evidence, which remains historically accurate for what it actually measured (patterns within ±256 bytes of `block1Start`).

---

## Confirmed Findings

| Finding | Verification |
|---|---|
| 0 counterexamples in all 4 directions, 1,172/1,172 faces | Reproduced from source; per-face identical to v0.4.5 |
| secCount distribution 368/293/511, alt total 661 | Reproduced from source |
| Per-file breakdown (39/68/113/375/51/400/126, all CE=0) | Reproduced from source |
| SW2000-s01.SLDPRT yields no DisplayLists (OLE2) | Reproduced from source |
| Candidate face-marker counts (156/272/452/1500/204/1600/504) | Match v0.4.5 EXP-024-CORRECTED exactly |
| INV-019 correctly labeled "Correlation," not causal | Confirmed by inspection |
| N∈{1,2}-only detection window caveat | Present and consistent everywhere it's cited |
| HEADPHONE exclusion caveat | Present and consistent everywhere it's cited |

## Falsified or Weakened Findings

| Finding | Status | Reason |
|---|---|---|
| "Second, independently-written extraction pass" (SUMMARY.md, evidence file, INV-019, OQ-018, RESEARCH_DASHBOARD.md, NQ-010) | **WEAKENED / OVERSTATED** | Diff shows ~95% verbatim code reuse from v0.4.5's EXP-023-CORRECTED; only the CE1-4 classification is new. Per-face output is byte-identical to v0.4.5, consistent with a code copy rather than an independent implementation. Does not affect the correctness of the 0-counterexample result. |
| "Delta formula ... already used and validated by v0.4.3/exp021_alternative_headers.js" (v0.4.5/CORRECTION_NOTE.md, exp023-corrected.js header) | **WEAKENED** | EXP-021 only validated the formula within a ±256-byte window of `block1Start`, which excludes roughly half of the true alternative population (all higher-vertex-count faces). EXP-021's own reported "332 alternatives (26.9%)" is exactly the in-window subset of the true 661, not an independent count. Not previously reconciled anywhere in the knowledge base. |

## Documentation Corrections Required

1. **`v0.4.6/SUMMARY.md` and `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`:** Add an append-only note (not a rewrite) clarifying that the extraction/offset/alt-header-detection logic is reused near-verbatim from `v0.4.5/exp023_alternative_header_characterization_corrected.js`, and that the new contribution is the explicit four-direction counterexample classification plus a from-source re-run, not an independent second implementation.
2. **`knowledge/KNOWN_INVARIANTS.md` INV-019:** Append a caveat note softening "independently re-derived the same face set" to reflect the actual degree of code reuse (see finding #2 above).
3. **`knowledge/OPEN_QUESTIONS.md` OQ-018 (DISCRIMINATING TEST NOTE):** Same caveat.
4. **`knowledge/KNOWN_INVARIANTS.md` INV-002 (v0.4.3 validation note, "332 non-B2 positions") and `knowledge/RESEARCH_DASHBOARD.md` (EXP-021 completed-experiments bullet):** Append a correction note explaining that EXP-021's 332-alternative count is the ±256-byte-windowed subset of the true 661-alternative population established later by EXP-023/EXP-023-CORRECTED/EXP-026, verified exactly per-file and per-N (finding #7). Do not alter EXP-021's original numbers or evidence file — they remain accurate for what was actually measured.

All four corrections have been applied as append-only notes in this pass (see Knowledge-Base Changes in the final report). None of them change INV-019's status, OQ-018's open/closed state, or any face count.

## Impact on Existing Documentation

- **INV-019 status**: unchanged (Correlation, non-causal) — correctly classified, not affected by any finding here.
- **OQ-018**: unchanged (causal direction still Open) — the discriminating-test result stands; only the "independence" framing needed softening.
- **EXP-026's core numeric claims**: unchanged and now independently re-verified by this review (stronger footing than before).
- **EXP-021's 332-alternative figure**: still historically accurate for its own stated method (±256-byte window), but must no longer be read as an independent corroboration of the mp-20/mp-24 formula, nor be quoted as "the" alternative-header count without the 661 figure alongside it.

## Conclusion

EXP-026's central claim — zero counterexamples to the secCount/alternative-header correlation across all 1,172 faces in 4 tested directions — is **CONFIRMED**: independently reproduced from source, and cross-checked at the individual-face level against v0.4.5's data with a perfect 1,172/1,172 match. INV-019's classification as a non-causal Correlation, and all of its stated caveats (N∈{1,2}-only detection window, HEADPHONE exclusion), are accurate and were not weakened by this review.

What this review found wrong is **framing, not data**: EXP-026 is described in multiple places as an "independently-written extraction pass," but it is in fact a near-verbatim refactor of v0.4.5's script with one new piece of logic (explicit counterexample classification) added on top. Separately, and unprompted by the task's checklist, this review traced EXP-026's inherited detection offsets back to EXP-021 and found that EXP-021's "332 alternatives (26.9%)" — cited elsewhere as validating the same formula — is a search-window artifact that captures only the subset of alternatives near lower-vertex-count faces, not an independent measurement of the full population. Neither finding changes any conclusion currently drawn from INV-019 or OQ-018, but both should be corrected in the record so future contributors don't cite either claim as stronger evidence than it is.

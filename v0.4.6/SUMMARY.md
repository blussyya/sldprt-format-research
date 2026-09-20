# v0.4.6 Summary: OQ-018 Discriminating Test (EXP-026)

**Date:** 2026-08-13
**Objective:** Narrow test of OQ-018 only — does the secCount/alternative-header correlation observed in v0.4.5 (EXP-023-CORRECTED) survive a direct hunt for counterexamples, or is it a coincidence of the small corpus? Not a broader investigation of `[4,8,2,N]`.

## Experiment

### EXP-026: secCount / Alternative-Header Correlation Discriminating Test
- **Method:** Independently re-derived face extraction using the v0.4.5-corrected Block1/Block2 offset formula (`block2Start = block1Start + (N+4)*4`, N from `block1Start+12`) — the buggy v0.4.4 arithmetic is not present anywhere in this script. For all 1,172 validated faces (7-file corpus, same as v0.4.5), checked four counterexample directions.
- **Result:** **0 counterexamples in all four directions, across all 1,172 faces.**
  1. `secCount=1` with no N=1 alternative: 0
  2. `secCount=2` with no N=2 alternative: 0
  3. `secCount>=3` with an alternative (any N): 0
  4. Alternative N inconsistent with secCount: 0
- **Distribution (matches v0.4.5 exactly):** secCount=1: 368 faces; secCount=2: 293 faces; secCount>=3: 511 faces; total with alternative: 661.

## Facts

1. 1,172/1,172 validated faces checked; 0 counterexamples in any of the 4 tested directions.
2. Results are numerically identical to v0.4.5's EXP-023-CORRECTED cross-tabulation, now reproduced by a second, independently-written extraction pass built specifically to hunt for exceptions rather than confirm a hypothesis.
3. Per-file breakdown: 0 counterexamples in every one of the 7 files individually (BOTTOM, TOP, GEAR, DEKOR, DISTRIBUTOR, POCKET, PTC).

## Interpretation (per task constraints — no semantic or causal claim)

The correlation is now recorded as an **empirical correlation with zero known counterexamples on the tested corpus** (see `KNOWN_INVARIANTS.md` INV-019, Status: Correlation — not "Verified Structural Invariant", following the project's existing convention for high-confidence-but-non-causal patterns, e.g. INV-013).

**What this does NOT establish:**
- Causality in either direction (whether secCount determines the alternative header, the alternative header determines secCount, or both are driven by a third variable).
- Any semantic meaning for `secCount`, the alternative header, or `[4,8,2,N]` in general.
- Behavior beyond `secCount<=2` vs `secCount>=3` — the correlation was tested exactly as observed; no new boundary values were probed.
- Behavior on the excluded HEADPHONE corpus (62 faces, not present in this repository checkout).

**A structural limitation, disclosed rather than investigated further (out of scope for this narrow test):** the alternative-header detection only checks two fixed positions (`mp-20` for N=1, `mp-24` for N=2), the same window used since EXP-021/023. It cannot detect an N=3+ alternative even if one existed at `mp-28`. This means "no alternative" for `secCount>=3` faces is only established with respect to N∈{1,2} at those two fixed offsets — not a general absence of any `[4,8,2,N]` structure near those faces. Extending the search window would be a new experiment (out of scope here, per instruction not to broaden into a general `[4,8,2,N]` investigation).

## Unresolved Questions (carried forward, not newly opened)

- Causal direction between secCount and the alternative header (OQ-018, still open).
- Whether N=3+ alternatives exist near secCount>=3 faces at other offsets (would require broadening scope — explicitly not done here).
- HEADPHONE's behavior under this correlation (untestable in this repo checkout).

## Files Created

- `v0.4.6/exp026_seccount_altheader_correlation_test.js`
- `v0.4.6/EXP026_RESULTS.json`
- `v0.4.6/SUMMARY.md` (this file)
- `knowledge/evidence/2026-08-13_v0.4.6-EXP026.md`

No file under `v0.4.4/` or `v0.4.5/` was modified.

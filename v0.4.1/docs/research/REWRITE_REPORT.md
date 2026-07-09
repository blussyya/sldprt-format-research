# Rewrite Analysis Report (v0.4.1)

## Answer

**Does a deterministic rewrite system exist between equivalent Block 1 encodings?**

**YES** — but it is **position-dependent**, not a global symbol mapping.

---

## Results

### Pair: BOTTOM → TOP

| Metric | Value |
|--------|-------|
| Face pairs analyzed | 28 |
| Total VALUE mappings | 197 |
| Ambiguous source values (global) | 20 |
| Max fan-out | 3 (VALUE 565 → {974, 1699, 1981}) |

### Context Resolution

| Context | Resolves All Ambiguities? |
|---------|--------------------------|
| (secIdx, pos) | **YES** |
| (secLen, pos) | NO |
| (secIdx, secLen, pos) | YES (redundant with above) |
| (left, pos) | NO |
| (left, right, pos) | NO |
| (secIdx, left, pos) | **YES** |
| (secIdx, left, right, pos) | YES (redundant) |
| (secLen, left, right, pos) | NO |

### Key Finding

The minimal resolving context is **(section index, position)**. Neither section length, nor left/right neighbors, nor their combinations suffice without section index.

---

## Interpretation

### What This Means

1. The rewrite function is: `f(src, secIdx, pos) → tgt`
2. The same VALUE in the same position maps to DIFFERENT targets in different sections
3. Section index is the critical disambiguator — not section length, not neighbors
4. The rewrite is **deterministic** given (secIdx, pos) — no exceptions found

### What This Does NOT Mean

- It does NOT mean VALUEs encode section indices
- It does NOT mean VALUEs encode position information
- It does NOT mean the mapping is simple arithmetic
- It does NOT explain WHY section index matters

### Formal Statement

For structurally equivalent faces in BOTTOM and TOP:

```
∀ face pairs (A, B) with same structural key:
  ∀ section s with same index in A and B:
    ∀ position p within section s:
      map(A[s][p], s, p) = B[s][p]  (deterministic)
```

The rewrite function exists, is deterministic, and depends on (section index, position).

---

## Counterexamples to Simpler Models

| Model | Counterexample |
|-------|---------------|
| Global symbol mapping (src → tgt) | VALUE 565 → {974, 1699, 1981} |
| Position-only mapping (pos → tgt) | VALUE 555 at pos 1 in sec0 → 969, but at pos 1 in sec1 → 974 |
| Neighbor-dependent mapping (left, pos → tgt) | VALUE 555 with left=ZERO at pos 1 → {969, 974} |
| Length-dependent mapping (secLen, pos → tgt) | VALUE 1123 at pos 1 in len=23 sections → {522, 1699, 1957} |

---

## Consistency Check

For BOTTOM→GEAR and TOP→GEAR: the global mapping IS a bijection (0 ambiguities). This means for these pairs, a simpler model (global symbol mapping) suffices. The position-dependent model is only needed for BOTTOM↔TOP.

---

## Open Questions

1. Why does section index matter for BOTTOM↔TOP but not for BOTTOM→GEAR?
2. Is the position-dependent mapping consistent across ALL structurally equivalent faces, or only within the sampled pairs?
3. Can the mapping be expressed as arithmetic on (src, secIdx, pos)?

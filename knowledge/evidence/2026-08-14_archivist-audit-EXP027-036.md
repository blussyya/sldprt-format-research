# Evidence: Archivist/Debunker Audit of EXP-027 → EXP-036

**Source script or method:** Manual code/data audit. No new experiment was run; this file documents defects found in existing scripts and JSON by direct inspection, with exact reproduction pointers.

**Exact command:** N/A (read-only audit: `Read`/`Grep` over `v0.4.7/*.js`, `v0.4.7/*.json`, `knowledge/evidence/2026-08-14_v0.4.7-EXP0{27..36}.md`, `knowledge/EXPERIMENT_LOG.md`, `knowledge/OPEN_QUESTIONS.md`, `knowledge/NEXT_QUESTIONS.md`, `knowledge/FAILED_HYPOTHESES.md`).

**Script paths inspected:** `v0.4.7/exp033_feature_state.js`, `v0.4.7/exp036_feature_class_differential.js`, `v0.4.7/EXP033_FEATURE_STATE.json`, `v0.4.7/EXP036_RESULTS.json`, `v0.4.7/CORPUS_AUDIT.json`.

**Corpus size:** Controlled corpus C00–C11 (12 single-feature cube variants; C11 not present in `CORPUS_AUDIT.json`, referenced only from later scripts). No `test files original/controlled/` directory is present in this dump — the controlled corpus itself is **not archived in this repository**; only its JSON/MD outputs are.

**Date produced:** 2026-08-14
**Date captured:** 2026-08-14

---

## Finding A: EXP-033's "adjacency" test does not measure topological adjacency

`v0.4.7/exp033_feature_state.js` lines 122–140 (`isAdjacentToModified`):

```js
function isAdjacentToModified(face, allFaces, featureType) {
  // For now, we use a heuristic: faces that share orientation with modified faces
  // This is a simplification - true adjacency would require topology analysis
  ...
  for (const modified of modifiedFaces) {
    if (modified.orientation === face.orientation) {
      return true;
    }
  }
  return false;
}
```

The function's own comment admits it is a same-orientation heuristic, not topology. On an axis-aligned cube, no two distinct faces ever share an orientation label, and the fillet/chamfer face itself gets a `NON_AXIS(...)` orientation. Consequently `isAdjacentToModified` returns `false` for **every** face in this corpus whenever `featureType` is fillet/chamfer/hole — it cannot ever return `true` for the +X/+Y faces regardless of their real (edge-sharing) topological relationship to the new fillet/chamfer face. The "H4 (adjacency) FALSIFIED" conclusion in EXP-033 (`knowledge/evidence/2026-08-14_v0.4.7-EXP033.md` §5.4, §6.3) is therefore not a genuine test of geometric/topological adjacency — it is close to a tautological negative. Geometrically, a fillet/chamfer along the edge shared by the +X and +Y faces is, by construction, adjacent to both faces (SolidWorks fillet/chamfer are edge features operating on a shared edge between exactly two faces). The claim "signature changes occur without adjacency" is not supported by this script and should not be relied upon.

This also means the "Adjacent to Modified" column in EXP-033 §4.4 (C03: 3, C04: 4, C09: 2, C11: 4) is computed by the same orientation-collision heuristic and does not represent real topological adjacency counts.

**Downstream propagation:** `OPEN_QUESTIONS.md` OQ-032 and OQ-033 both restate "without adjacency" as an established fact, inheriting the flaw. `FAILED_HYPOTHESES.md` FH-031 records "Token Signatures Depend on Adjacency to Modified Geometry" as **Falsified** with **Confidence: High**, which overstates what was tested.

**Correction applied:** see correction notes appended to `EXPERIMENT_LOG.md` (EXP-033 entry), `FAILED_HYPOTHESES.md` (FH-031), and `OPEN_QUESTIONS.md` (OQ-032, OQ-033).

---

## Finding B: EXP-036's "added face" metric silently drops genuinely new faces (orientation-bucket collision)

`v0.4.7/exp036_feature_class_differential.js` lines 104–191 (`computeTokenDiff`) buckets faces by `orientation` string, then for each C00 face in a bucket picks the single best-scoring match among model faces sharing that bucket. A model face is only classified `'added'` if its orientation key is **entirely absent** from the C00 bucket set (`if (!(orient in c00ByOrient))`, line 175). Model faces that share an orientation label with an *existing* C00 face, but are not chosen as anyone's `bestMatch`, are never emitted in `identical`/`changed`/`removed`/`added` — they are silently dropped from the entire diff.

Reproduction from `v0.4.7/EXP036_RESULTS.json`:

- `structuralComparison.C04_cube_hole_5mm`: `faceCountC00=6`, `faceCountModel=7` (the hole model has a genuine 7th, cylindrical face — confirmed independently by `CORPUS_AUDIT.json` faceCount=7 and by EXP-027/EXP-029's explicit "+1 face" language for hole introduction). Yet `tokenDiffSummary = {identical:4, changed:2, removed:0, added:0}` and `addedFaceDetails: []` — the new cylindrical face appears in **none** of the four buckets. It was silently dropped.
- `structuralComparison.C10_cube_shell_1mm`: `faceCountC00=6`, `faceCountModel=11` (shell adds 5 new inner-wall faces — established directly in EXP-035, `knowledge/evidence/2026-08-14_v0.4.7-EXP035.md`, by explicit per-face structural comparison, not by this orientation-bucket algorithm). Yet `tokenDiffSummary = {identical:5, changed:1, removed:0, added:0}` and `addedFaceDetails: []`. All 5 new inner-wall faces are silently dropped.

Root cause: C00's 6 faces already occupy all 6 axis-aligned orientation buckets (`-X,-Y,+X,+Y,+Z,-Z`). A hole's cylindrical face has a near-zero/degenerate average normal that collides with an occupied bucket instead of forming a new key; shell's inner walls have normals that are the mirror image of their originating outer wall and land in an already-occupied opposite-facing bucket. Only fillet/chamfer's new face happens to land on a `NON_AXIS(...)` orientation that is genuinely absent from C00, so it is the *only* feature type in this corpus whose added face survives this particular detection method.

**Consequence:** The EXP-036 cross-model table (`knowledge/evidence/2026-08-14_v0.4.7-EXP036.md`, "Cross-Model Analysis") reports `added: avg=1.00 (fillet/chamfer) vs avg=0.00 (holes/shell) — Distinguishes: YES`. This is misleading: holes and shell also add faces (0 is wrong for both), so "adds a face" is not actually what this metric measures or what distinguishes the groups. The metric that is actually reliable — and that the qualitative writeup in EXP-036 correctly falls back on — is *"does the newly added face receive an orientation-bucket collision with an existing face, or a clean/unique one,"* which is a proxy for whether the added face's normal direction coincides with existing model directions, not a direct measurement of "adds a face at an edge shared with a pre-existing face." EXP-036 itself is more careful than its summary table: H4 (Topology) and H6 (Serialization position) and H7 (Feature type) are correctly marked **UNKNOWN**, not "falsified" — the "adding a new face at an edge" framing (H8) is a plausible, domain-knowledge-informed inference (fillet/chamfer are literally CAD "edge features"), not something the script directly measured via computed topology/adjacency data.

**Correction applied:** see correction note appended to `EXPERIMENT_LOG.md` (EXP-036 entry) and `OPEN_QUESTIONS.md` (OQ-036), and the confound analysis appended to `NEXT_QUESTIONS.md` (NQ-027).

---

## Finding C: EXP-027's "linear scaling" and "localized to affected faces" claims are contradicted one experiment later, with no in-place cross-reference

`EXPERIMENT_LOG.md` EXP-027 §"Key findings" states (3) "Hole diameter affects cylindrical surface vc (approximately linear scaling)" and (4) "Feature operations are localized to affected faces." The very next entry, EXP-028, explicitly falsifies (3) ("EXP-027's 'linear scaling' claim FALSIFIED", ratio 70/56=1.25 ≠ diameter ratio 5/3=1.67) and weakens (4) ("EXP-027's 'localized to affected faces' claim WEAKENED... DL is re-serialized entirely on face changes"). `FAILED_HYPOTHESES.md` independently records both falsifications (entries citing "Disproving experiment: EXP-028 Investigation 1" and "Investigation 2"). However, the EXP-027 entry itself in `EXPERIMENT_LOG.md` and its bullet in `RESEARCH_DASHBOARD.md` were never annotated with a forward pointer, contrary to the project's own stated policy ("When adding a correction to an existing invariant or observation... Append a clearly marked correction note with the date," `RESEARCH_DASHBOARD.md` "Maintenance Protocol"). A reader consulting only the EXP-027 entry (e.g., via search for "EXP-027") would not learn that two of its five headline findings were subsequently falsified/weakened.

**Correction applied:** see correction note appended to `EXPERIMENT_LOG.md` (EXP-027 entry).

---

## Finding D (positive / no defect found): No hypothesis from EXP-027–036 was silently promoted to `KNOWN_INVARIANTS.md`

Checked: `KNOWN_INVARIANTS.md` contains no `INV-020` or later entry. The correlational/hypothesis-level findings from EXP-029–036 (token signatures, "global model state," "adding a face at an edge") are correctly kept in `EXPERIMENT_LOG.md`/`OPEN_QUESTIONS.md` at Hypothesis/Correlation/Complete status, not promoted to invariant status. This is consistent with the project's discipline and is called out here so it is not lost in a report that is otherwise mostly corrective.

---

## Finding E: The controlled corpus tests only one physical edge location

Across EXP-029 through EXP-036, the fillet (C03) and chamfer (C09) models are the only two "edge feature" instances in the corpus, and in every experiment where face index is reported (`EXP-033 §4.3`), the changed faces are the **same face indices (2, 3 / +X, +Y)** for both C03 and C09. No script or evidence file states that the fillet and chamfer were applied to different edges of the cube; the consistent index/orientation match across both models is most simply explained by both features having been applied to the same edge (the one shared by the +X and +Y faces). If so, the corpus contains **one** edge-feature location tested with two feature types, not two independent edge locations. This means the current evidence cannot distinguish "faces topologically adjacent to *the* modified edge change" from "faces at index 2/3 (or orientation +X/+Y) change whenever *any* edge-type feature is applied, regardless of which edge" — i.e., location-generality of the effect is untested. See the confound analysis appended to `NEXT_QUESTIONS.md` NQ-027.

---

## Known Gaps

- The controlled corpus SLDPRT files (`test files original/controlled/C00...C11`) referenced by every v0.4.7 script are not present in this repository snapshot; findings above are derived entirely from the archived JSON outputs and evidence markdown, not by re-running the scripts. If the corpus becomes available, Findings A and B should be reproduced directly (re-run `exp033_feature_state.js` with a real topological-adjacency check, and re-run `exp036_feature_class_differential.js` with a face-count-based rather than orientation-bucket-based "added" metric).
- This audit did not re-verify EXP-030's exhaustive structural-correspondence sweep or EXP-034's full byte-level diff at the binary level; those conclusions were accepted from their evidence files after checking their face-matching methodology (orientation-via-normal, not token-based — non-circular) and sample sizes.

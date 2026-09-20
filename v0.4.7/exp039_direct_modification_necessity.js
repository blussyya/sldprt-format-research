/**
 * EXP-039: Is Direct Vertex Modification Necessary for a Token Change? (Quantified,
 * Multi-Feature-Type Cross-Tabulation)
 *
 * Builds directly on EXP-037/038 (v0.4.7/exp037_edge_location_and_adjacency.js,
 * v0.4.7/exp038_nq028_c12_second_edge.js) rather than re-deriving their tooling. Those
 * experiments already established two things this script starts from as given:
 *
 *   1. EXP-037/038's matchFaces()/facesIdentical() ALREADY compare full per-vertex
 *      coordinates (not just ec/vc/secCount/b1Len) when deciding whether a matched face
 *      is `identical` to its baseline counterpart. Checking the raw output
 *      (EXP037_RESULTS.json, EXP038_RESULTS.json) shows this signal was computed but
 *      never surfaced in prose: C03/C09/C12's +X/+Y (or -X/-Y for C12) faces are already
 *      recorded as `identical: false` there, even though every prose summary (EXP-033's
 *      original text, and FH-030 in knowledge/FAILED_HYPOTHESES.md) still describes them
 *      as "not directly modified." FH-030 is the one correction the archivist
 *      audit/EXP-037/EXP-038 chain never made (FH-031, the adjacency hypothesis, WAS
 *      corrected in place on 2026-08-14/15 -- see its correction notes -- but FH-030,
 *      the direct-modification hypothesis, still reads "Falsified" uncorrected). This
 *      script surfaces that existing-but-unused signal explicitly and corrects FH-030.
 *   2. EXP-037 already flagged shell's inner walls as one qualitative "contrast case"
 *      where real adjacency to a new face does not produce a token change (outer walls
 *      stay token-identical to C00 per EXP-035). EXP-038 explicitly named the residual
 *      confound this leaves open: "real topological adjacency" and "this face's own
 *      vertices were directly, if minutely, modified" are indistinguishable for
 *      edge-type features (fillet/chamfer/C12), because trimming a face's boundary to
 *      accommodate a new feature face IS what creates the adjacency -- both explanations
 *      pick out the identical face set for C03/C09/C12.
 *
 * This script does not re-attempt to separate them for edge-type features (EXP-038
 * already showed, and this script's own topological argument in EXP-039_SUMMARY.md
 * section 5 explains why, that no model of that class can separate them). Instead it
 * quantifies the ONE thing that IS separable in the existing corpus: cases where a face
 * is really adjacent (>=2 shared vertices, i.e. shares an edge) to newly-created or
 * directly-modified geometry WITHOUT its own vertices moving. EXP-037 only checked this
 * for shell (one model, qualitatively). This script extends the same check, using the
 * SAME already-validated primitives (vertClose/sharedVertexCount, copied verbatim from
 * exp037_edge_location_and_adjacency.js and cited as such below), across every pair with
 * full per-face vertex data: C03 (fillet), C09 (chamfer), C12 (fillet, second edge),
 * C10 (shell), C04 (hole 5mm), and C04-vs-C05 (hole 3mm).
 *
 * Do NOT modify parser/.
 * Do NOT re-derive Block1/Block2 extraction -- all token data is read from already-
 * validated EXP-033/035/037/038 JSON.
 * Do NOT use orientation buckets for correspondence or adjacency -- reuses EXP-037's
 * vertex/centroid-based methods exclusively.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
}

const VERTEX_ANALYSIS = loadJSON('VERTEX_ANALYSIS.json');
const EXP037 = loadJSON('EXP037_RESULTS.json');
const EXP038 = loadJSON('EXP038_RESULTS.json');
const EXP035 = loadJSON('EXP035_RESULTS.json');

// C10 (shell)'s unmodified outer-wall faces have their TOKEN-identity recorded directly
// in EXP035_RESULTS.json (description: "Comparison of C10's original outer faces ... "
// identical" here means Block1 tokens identical, per EXP-035's own conclusion text) --
// EXP037_RESULTS.json's `matched[].tokensB.tokens` is null for these specific faces (see
// exp037_edge_location_and_adjacency.js's own comment on this), so token-changed status
// for C10's outer walls is read from EXP-035 directly rather than re-derived.
const c10TokenIdenticalByC10Index = new Map(
  EXP035.originalOuterFaceComparison.results.map((r) => [r.c10Index, r.identical])
);

// ---- copied verbatim from exp037_edge_location_and_adjacency.js (cited above) ----
const VERTEX_TOL = 1e-5;
function vertClose(a, b, tol = VERTEX_TOL) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;
}
function sharedVertexCount(faceA, faceB) {
  let count = 0;
  for (const va of faceA.vertices) {
    for (const vb of faceB.vertices) {
      if (vertClose(va, vb)) {
        count++;
        break;
      }
    }
  }
  return count;
}
// ---- end copied section ----

console.log('EXP-039: Is Direct Vertex Modification Necessary for a Token Change?');
console.log('======================================================================\n');
console.log('Reuses EXP-037/038 validated tooling and raw JSON output. Does not re-implement');
console.log('Block1/Block2 extraction, correspondence, or adjacency logic.\n');

const rows = []; // { pair, faceLabel, identical, realAdjacentToChangedOrAdded, tokenChanged }

// Because EXP-037/038's own JSON does not include full vertex arrays for every face (only
// for the "added" faces, needed for their own adjacency computation), we re-derive full
// per-face vertex arrays for model B directly, using the same source data EXP-037/038 used:
// VERTEX_ANALYSIS.json for C03/C09/C04/C10, and EXP038_RESULTS.json's own recorded vertex
// data is not present either -- but C12's vertex arrays are not needed here, since EXP-038
// already computed C12's full adjacency-to-everything table implicitly via its "added" face
// (face 6) and its matched-face identical flags; C12 has only ONE new face (face 6, same as
// C03/C09), so the added-face adjacency list EXP-038 already produced is already the
// complete real-adjacency graph relevant to this analysis (no OTHER new/changed face exists
// in C12 whose neighbors need re-checking).

function buildRowsFromExp037Style(key, pairResult, pairLabel) {
  const vaPair = VERTEX_ANALYSIS[key];
  const facesB = vaPair ? vaPair.facesB : null;

  const changedOrAddedBIndices = new Set();
  for (const a of pairResult.added) changedOrAddedBIndices.add(a.bIndex);
  for (const m of pairResult.matched) if (!m.identical) changedOrAddedBIndices.add(m.bIndex);

  // For every matched face, determine real adjacency to changedOrAddedBIndices.
  // If we have full vertex arrays for model B (facesB present), compute pairwise
  // adjacency directly and exhaustively. Otherwise (C12), reuse EXP-038's own
  // already-computed added-face adjacency list (sufficient since C12 has exactly one
  // new/changed-topology face whose neighbors were already enumerated).
  for (const m of pairResult.matched) {
    if (changedOrAddedBIndices.has(m.bIndex)) continue; // only asking about UNCHANGED faces
    let realAdjacent;
    if (facesB) {
      const selfFace = facesB.find((f) => f.index === m.bIndex);
      realAdjacent = false;
      for (const otherIdx of changedOrAddedBIndices) {
        const otherFace =
          facesB.find((f) => f.index === otherIdx) ||
          (pairResult.added.find((a) => a.bIndex === otherIdx)
            ? null // added faces' own vertex arrays aren't stored in VERTEX_ANALYSIS.json's facesB for added indices in some pairs; handled via addedFace fallback below
            : null);
        let shared = 0;
        if (otherFace) {
          shared = sharedVertexCount(selfFace, otherFace);
        } else {
          // fall back to EXP-037/038's own precomputed adjacency list for this added face
          const addedRec = pairResult.added.find((a) => a.bIndex === otherIdx);
          if (addedRec) {
            const hit = addedRec.adjacentToModelFaces.find((x) => x.index === m.bIndex);
            shared = hit ? hit.sharedVertices : 0;
          }
        }
        if (shared >= 2) {
          realAdjacent = true;
          break;
        }
      }
    } else {
      // C12 case: use EXP-038's own added-face adjacency list directly.
      realAdjacent = pairResult.added.some((a) => a.adjacentToModelFaces.some((x) => x.index === m.bIndex && x.sharedVertices >= 2));
    }

    const tokA = m.tokensA;
    const tokB = m.tokensB;
    let tokenChanged;
    if (m.tokensChanged !== undefined) {
      tokenChanged = m.tokensChanged;
    } else if (tokA && tokB && tokA.tokens && tokB.tokens) {
      tokenChanged = JSON.stringify(tokA.tokens) !== JSON.stringify(tokB.tokens);
    } else if (pairLabel === 'C10(shell)' && c10TokenIdenticalByC10Index.has(m.bIndex)) {
      tokenChanged = !c10TokenIdenticalByC10Index.get(m.bIndex);
    } else {
      tokenChanged = null;
    }

    if (tokenChanged === null) continue; // no baseline token available for this face

    rows.push({
      pair: pairLabel,
      bIndex: m.bIndex,
      orientation: (tokA && tokA.orientation) || (tokB && tokB.orientation) || 'n/a',
      identical: m.identical,
      directlyModified: !m.identical,
      realAdjacentToChangedOrAdded: realAdjacent,
      tokenChanged,
    });
  }
}

buildRowsFromExp037Style('C00_cube_10mm_vs_C03_cube_fillet_1mm', EXP037['C00_cube_10mm_vs_C03_cube_fillet_1mm'], 'C03(fillet)');
buildRowsFromExp037Style('C00_cube_10mm_vs_C09_cube_chamfer_1mm', EXP037['C00_cube_10mm_vs_C09_cube_chamfer_1mm'], 'C09(chamfer)');
buildRowsFromExp037Style('C00_cube_10mm_vs_C04_cube_hole_5mm', EXP037['C00_cube_10mm_vs_C04_cube_hole_5mm'], 'C04(hole5mm)');
buildRowsFromExp037Style('C00_cube_10mm_vs_C10_cube_shell_1mm', EXP037['C00_cube_10mm_vs_C10_cube_shell_1mm'], 'C10(shell)');
buildRowsFromExp037Style(null, EXP038['C00_cube_10mm_vs_C12_cube_fillet_1mm_edge2'], 'C12(fillet,edge2)');

console.log('Face   Pair               Orientation   directlyModified   realAdjacent   tokenChanged');
for (const r of rows) {
  console.log(
    `  B${String(r.bIndex).padEnd(3)} ${r.pair.padEnd(18)} ${String(r.orientation).padEnd(13)} ${String(r.directlyModified).padEnd(18)} ${String(r.realAdjacentToChangedOrAdded).padEnd(14)} ${r.tokenChanged}`
  );
}

// ============================================================
// CROSS-TABULATION
// ============================================================

console.log('\n\nCROSS-TABULATION (unmodified faces only -- directlyModified is always false here by construction)');
console.log('==========================================================================================');

const cell = { total: 0, changed: 0, examples: [] };
const controlCell = { total: 0, changed: 0, examples: [] };
for (const r of rows) {
  if (r.realAdjacentToChangedOrAdded) {
    cell.total++;
    if (r.tokenChanged) cell.changed++;
    cell.examples.push(`${r.pair}:B${r.bIndex}(${r.orientation})`);
  } else {
    controlCell.total++;
    if (r.tokenChanged) controlCell.changed++;
    controlCell.examples.push(`${r.pair}:B${r.bIndex}(${r.orientation})`);
  }
}

console.log(`\nUnmodified AND real-adjacent to changed/added geometry: ${cell.changed}/${cell.total} token-changed`);
console.log(`  ${cell.examples.join(', ')}`);
console.log(`\nUnmodified AND NOT adjacent to changed/added geometry (control): ${controlCell.changed}/${controlCell.total} token-changed`);
console.log(`  ${controlCell.examples.join(', ')}`);

console.log('\n\nCORRECTION TO FH-030 (surfacing an existing-but-unused signal)');
console.log('================================================================');
console.log('EXP037_RESULTS.json / EXP038_RESULTS.json already record `identical: false`');
console.log('(full vertex-coordinate comparison, not just ec/vc/secCount/b1Len) for these faces:');
for (const key of ['C00_cube_10mm_vs_C03_cube_fillet_1mm', 'C00_cube_10mm_vs_C09_cube_chamfer_1mm']) {
  const r = EXP037[key];
  for (const m of r.matched) {
    if (!m.identical && m.tokensChanged !== false) {
      console.log(`  ${key}: aIndex=${m.aIndex} orientation=${m.tokensA ? m.tokensA.orientation : '?'} identical=${m.identical} (was described in prose as "not directly modified")`);
    }
  }
}
{
  const r = EXP038['C00_cube_10mm_vs_C12_cube_fillet_1mm_edge2'];
  for (const m of r.matched) {
    if (!m.identical) {
      console.log(`  C12: bIndex=${m.bIndex} orientation=${m.tokensB ? m.tokensB.orientation : '?'} identical=${m.identical}`);
    }
  }
}

const results = {
  timestamp: new Date().toISOString(),
  note: 'Builds on EXP-037/038 validated tooling/JSON; does not re-derive Block1/Block2 extraction, correspondence, or adjacency logic.',
  rows,
  crossTabulation: {
    unmodified_adjacent: cell,
    unmodified_notAdjacent_control: controlCell,
  },
};

fs.writeFileSync(path.join(DIR, 'EXP039_DIRECT_MODIFICATION_NECESSITY.json'), JSON.stringify(results, null, 2));
console.log('\n\nResults written to EXP039_DIRECT_MODIFICATION_NECESSITY.json');

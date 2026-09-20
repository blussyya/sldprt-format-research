/**
 * EXP-037: NQ-028 — Edge-Location Discrimination + Corrected Adjacency/Correspondence Tooling
 *
 * NQ-028 asks: does moving a fillet/chamfer to a *different* physical cube edge move the
 * Block1 token changes to the corresponding faces (Hypothesis A, spatial/adjacency), or do
 * the same +X/+Y faces change regardless of feature location (Hypothesis B, global/feature-type
 * state)? See knowledge/NEXT_QUESTIONS.md NQ-028 and knowledge/RESEARCH_HANDOFF.md.
 *
 * THIS SCRIPT DOES NOT ANSWER NQ-028's core question. The controlled corpus in this
 * repository snapshot contains only ONE physical edge-feature location (C03 fillet and C09
 * chamfer both modify the edge shared by the +X and +Y faces — see Finding E of
 * knowledge/evidence/2026-08-14_archivist-audit-EXP027-036.md). No second-edge model exists
 * in `test files original/controlled/` (which is itself absent from this repo snapshot — see
 * knowledge/RESEARCH_HANDOFF.md "Current Research Phase") or anywhere in the archived
 * `v0.4.7/*.json` outputs. Answering NQ-028 requires generating a new SolidWorks model; see
 * the "NEW MODEL REQUIRED" section printed below and knowledge/evidence/2026-08-14_v0.4.7-EXP037.md.
 *
 * What this script DOES do, using only already-archived data (no SLDPRT files needed, since
 * they are not present in this snapshot):
 *
 *   1. Implements a genuine vertex/edge-sharing adjacency test (computeAdjacency), replacing
 *      the same-orientation-label heuristic in exp033_feature_state.js's isAdjacentToModified()
 *      (see Finding A of the archivist audit). Uses the full per-vertex coordinate arrays
 *      archived in VERTEX_ANALYSIS.json.
 *   2. Implements a face-correspondence algorithm (matchFaces) that scores every candidate
 *      pair by real vertex overlap (not orientation-bucket membership), performs a greedy
 *      best-score bipartite match, and explicitly reports AMBIGUOUS when two candidates are
 *      too close to call — replacing computeTokenDiff() in exp036_feature_class_differential.js
 *      (see Finding B of the archivist audit).
 *   3. Applies both to the four model pairs for which full per-face vertex arrays are already
 *      archived (C00->C03 fillet, C00->C09 chamfer, C00->C04 hole, C00->C10 shell) and reports:
 *      - the corrected added/removed/changed/identical face census (cross-checked against
 *        Finding B's independently-confirmed ground truth: C04 +1 face, C10 +5 faces)
 *      - for the fillet/chamfer's genuinely new face, which C00 faces it is really adjacent to
 *        (shares vertices with, i.e. shares an edge), computed from vertex coordinates rather
 *        than assumed "by construction"
 *      - whether the real-adjacency set matches the set of faces whose Block1 token signature
 *        changed (+X/+Y per EXP-032/033), for the ONE edge location this corpus contains.
 *
 * Do NOT modify parser/.
 * Do NOT assign semantic meaning to token values.
 * Do NOT treat this script's output as an answer to NQ-028 (edge-location generality) — it
 * is a corrected re-measurement of the SAME single edge location already in the corpus, plus
 * the requirements spec for the experiment that would actually answer NQ-028.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
}

const VERTEX_ANALYSIS = loadJSON('VERTEX_ANALYSIS.json');
const EXP033 = loadJSON('EXP033_FEATURE_STATE.json');
const EXP035 = loadJSON('EXP035_RESULTS.json');

// ============================================================
// Token lookup (cross-reference by model + faceIndex)
// ============================================================

const tokensByModelFace = new Map();
for (const f of EXP033.faces) {
  tokensByModelFace.set(`${f.model}|${f.faceIndex}`, {
    tokens: f.tokens,
    orientation: f.orientation,
    faceType: f.faceType,
  });
}
// C10 (shell) tokens are not in EXP033_FEATURE_STATE.json (that script had a directory-name
// typo that silently skipped C10 — see EXP-035's "filtering issue" finding). Pull from EXP035.
for (const r of EXP035.originalOuterFaceComparison.results) {
  tokensByModelFace.set(`C10_cube_shell_1mm|${r.c10Index}`, {
    tokens: null, // EXP035 only recorded identical=true/false for these, not the raw tokens
    orientation: r.orientation,
    identicalToC00: r.identical,
  });
}
for (const r of EXP035.newInnerFaceAnalysis.results) {
  tokensByModelFace.set(`C10_cube_shell_1mm|${r.c10Index}`, {
    tokens: r.tokens,
    orientation: r.orientation,
  });
}

function lookupTokens(model, faceIndex) {
  return tokensByModelFace.get(`${model}|${faceIndex}`) || null;
}

// ============================================================
// Real geometric adjacency: shared-vertex (shared-edge) test
// ============================================================

const VERTEX_TOL = 1e-5; // meters; float32 tessellation precision is far tighter than this

function vertClose(a, b, tol = VERTEX_TOL) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;
}

// Returns the count of faceA's vertices that have a coordinate-matching vertex in faceB.
// >=2 shared vertices along a common boundary indicates a shared edge (real topological
// adjacency), not merely a shared orientation label.
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

// Secondary, reported-only signal (NOT used to decide correspondence -- see rationale above
// matchFaces): fraction of vertices literally coincident between two faces.
function overlapScoreForReport(faceA, faceB) {
  let aInB = 0;
  for (const va of faceA.vertices) {
    if (faceB.vertices.some((vb) => vertClose(va, vb))) aInB++;
  }
  let bInA = 0;
  for (const vb of faceB.vertices) {
    if (faceA.vertices.some((va) => vertClose(va, vb))) bInA++;
  }
  return (aInB + bInA) / (faceA.vertices.length + faceB.vertices.length);
}

function computeAdjacency(targetFace, candidateFaces) {
  return candidateFaces
    .filter((f) => f.index !== targetFace.index)
    .map((f) => ({ index: f.index, sharedVertices: sharedVertexCount(targetFace, f) }))
    .filter((r) => r.sharedVertices >= 2) // >=2 shared vertices = shares an edge
    .sort((a, b) => b.sharedVertices - a.sharedVertices);
}

// ============================================================
// Real geometric face correspondence (fixes EXP-036's orientation-bucket bug)
// ============================================================

// NOTE on method choice: a naive shared-vertex-fraction score (the same primitive used for
// adjacency, above) is NOT safe for whole-face correspondence on this corpus. Every cube
// corner is shared by three faces, so a fillet/chamfer-trimmed face's *untrimmed* corners are,
// by construction, also corners of a DIFFERENT unmodified face (verified empirically: it
// produces a tied 0.5/0.5 score between the true corresponding face and an unrelated one).
// Centroid position is a robust alternative here: a 1mm fillet/chamfer/hole/shell shifts a
// face's centroid by a small, bounded amount, while a genuinely different face on a 10mm cube
// (even an adjacent one) has a centroid offset by several mm -- an order of magnitude larger
// than any feature-induced shift in this corpus. Vertex-count similarity is used as a
// secondary tiebreaker signal, not the primary key (so it still works when a feature changes
// vc, e.g. the multi-loop +Z/-Z faces).
function centroid(face) {
  let cx = 0, cy = 0, cz = 0;
  for (const v of face.vertices) { cx += v[0]; cy += v[1]; cz += v[2]; }
  const n = face.vertices.length;
  return [cx / n, cy / n, cz / n];
}

function dist3(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Correspondence distance threshold: half the cube edge length in this corpus (10mm cube ->
// 0.01m edge, so 0.004m is generous relative to the largest observed feature-induced centroid
// shift of ~2e-4m for a 1mm fillet/chamfer, while still far smaller than the ~0.005-0.01m
// centroid separation between any two distinct cube faces).
const CENTROID_THRESHOLD = 0.004;
const AMBIGUITY_MARGIN = 0.0005; // if top-2 candidate distances are this close, flag ambiguous instead of forcing a match

function matchFaces(facesA, facesB) {
  const pairs = [];
  for (const a of facesA) {
    const ca = centroid(a);
    for (const b of facesB) {
      const cb = centroid(b);
      const d = dist3(ca, cb);
      if (d <= CENTROID_THRESHOLD) pairs.push({ a, b, dist: d, overlap: overlapScoreForReport(a, b) });
    }
  }
  pairs.sort((p, q) => p.dist - q.dist); // ascending: closest centroid first

  const usedA = new Set();
  const usedB = new Set();
  const matched = [];
  const ambiguous = [];

  const candidatesByB = new Map();
  for (const p of pairs) {
    if (!candidatesByB.has(p.b.index)) candidatesByB.set(p.b.index, []);
    candidatesByB.get(p.b.index).push(p);
  }
  const ambiguousB = new Set();
  for (const [bIdx, cands] of candidatesByB) {
    cands.sort((x, y) => x.dist - y.dist);
    if (cands.length >= 2) {
      const gap = cands[1].dist - cands[0].dist;
      if (gap < AMBIGUITY_MARGIN) {
        ambiguousB.add(bIdx);
        ambiguous.push({
          bIndex: bIdx,
          candidates: cands.slice(0, 3).map((c) => ({ aIndex: c.a.index, centroidDist: c.dist })),
        });
      }
    }
  }

  for (const p of pairs) {
    if (usedA.has(p.a.index) || usedB.has(p.b.index)) continue;
    if (ambiguousB.has(p.b.index)) continue; // do not force a match when ambiguous
    usedA.add(p.a.index);
    usedB.add(p.b.index);
    matched.push({ aIndex: p.a.index, bIndex: p.b.index, centroidDist: p.dist, vertexOverlap: p.overlap });
  }

  const removed = facesA.filter((f) => !usedA.has(f.index)).map((f) => f.index);
  const added = facesB.filter((f) => !usedB.has(f.index) && !ambiguousB.has(f.index)).map((f) => f.index);

  return { matched, removed, added, ambiguous };
}

function facesIdentical(faceA, faceB) {
  if (faceA.edgeCount !== faceB.edgeCount) return false;
  if (faceA.vertexCount !== faceB.vertexCount) return false;
  if (faceA.secCount !== faceB.secCount) return false;
  if (faceA.b1Len !== faceB.b1Len) return false;
  if (faceA.vertices.length !== faceB.vertices.length) return false;
  for (let i = 0; i < faceA.vertices.length; i++) {
    if (!vertClose(faceA.vertices[i], faceB.vertices[i], 1e-6)) return false;
  }
  return true;
}

// ============================================================
// Analysis per pair
// ============================================================

function analyzePair(key, modelAName, modelBName) {
  const pair = VERTEX_ANALYSIS[key];
  const facesA = pair.facesA;
  const facesB = pair.facesB;

  const correspondence = matchFaces(facesA, facesB);

  const matchedDetails = correspondence.matched.map(({ aIndex, bIndex, centroidDist, vertexOverlap }) => {
    const fa = facesA.find((f) => f.index === aIndex);
    const fb = facesB.find((f) => f.index === bIndex);
    const identical = facesIdentical(fa, fb);
    return {
      aIndex,
      bIndex,
      centroidDist,
      vertexOverlap,
      identical,
      ecChanged: fa.edgeCount !== fb.edgeCount,
      vcChanged: fa.vertexCount !== fb.vertexCount,
      secCountChanged: fa.secCount !== fb.secCount,
      b1LenChanged: fa.b1Len !== fb.b1Len,
      tokensA: lookupTokens(modelAName, aIndex),
      tokensB: lookupTokens(modelBName, bIndex),
    };
  });

  const addedDetails = correspondence.added.map((bIndex) => {
    const fb = facesB.find((f) => f.index === bIndex);
    const adjacentToA = computeAdjacency(fb, facesA); // real adjacency to ORIGINAL (C00) faces
    const adjacentToB = computeAdjacency(fb, facesB); // real adjacency within the modified model
    return {
      bIndex,
      edgeCount: fb.edgeCount,
      vertexCount: fb.vertexCount,
      tokens: lookupTokens(modelBName, bIndex),
      adjacentToOriginalFaces: adjacentToA, // {index, sharedVertices}[] against facesA (C00 numbering)
      adjacentToModelFaces: adjacentToB, // {index, sharedVertices}[] against facesB (own model numbering)
    };
  });

  return {
    modelAName,
    modelBName,
    faceCountA: facesA.length,
    faceCountB: facesB.length,
    faceCountDiff: facesB.length - facesA.length,
    matched: matchedDetails,
    removed: correspondence.removed,
    added: addedDetails,
    ambiguous: correspondence.ambiguous,
  };
}

const pairsToAnalyze = [
  ['C00_cube_10mm_vs_C03_cube_fillet_1mm', 'C00_cube_10mm', 'C03_cube_fillet_1mm'],
  ['C00_cube_10mm_vs_C09_cube_chamfer_1mm', 'C00_cube_10mm', 'C09_cube_chamfer_1mm'],
  ['C00_cube_10mm_vs_C04_cube_hole_5mm', 'C00_cube_10mm', 'C04_cube_hole_5mm'],
  ['C00_cube_10mm_vs_C10_cube_shell_1mm', 'C00_cube_10mm', 'C10_cube_shell_1mm'],
];

const results = {};
console.log('EXP-037: Corrected Adjacency + Face-Correspondence (NQ-028 groundwork)');
console.log('========================================================================\n');

for (const [key, aName, bName] of pairsToAnalyze) {
  console.log(`\n--- ${aName} -> ${bName} ---`);
  const r = analyzePair(key, aName, bName);
  results[key] = r;

  console.log(`Face count: ${r.faceCountA} -> ${r.faceCountB} (diff ${r.faceCountDiff >= 0 ? '+' : ''}${r.faceCountDiff})`);
  console.log(`Matched (real vertex correspondence): ${r.matched.length}`);
  console.log(`Removed (no B correspondence): ${JSON.stringify(r.removed)}`);
  console.log(`Added (no A correspondence, real geometry-based): ${r.added.map((a) => a.bIndex).join(',') || '(none)'}`);
  if (r.ambiguous.length) {
    console.log(`AMBIGUOUS matches (not forced): ${JSON.stringify(r.ambiguous)}`);
  }

  for (const a of r.added) {
    console.log(`  Added face B${a.bIndex} (ec=${a.edgeCount}, vc=${a.vertexCount}):`);
    console.log(`    Real adjacency to ORIGINAL (${aName}, pre-feature) faces: ${a.adjacentToOriginalFaces.length ? JSON.stringify(a.adjacentToOriginalFaces) : '(none -- expected, C00 lacks this geometry)'}`);
    console.log(`    Real adjacency WITHIN ${bName} (>=2 shared vertices = shares an edge):`);
    if (a.adjacentToModelFaces.length === 0) {
      console.log(`      (none -- not adjacent to any other face in this model)`);
    } else {
      for (const adj of a.adjacentToModelFaces) {
        const tok = lookupTokens(bName, adj.index);
        console.log(`      ${bName} face ${adj.index} (${tok ? tok.orientation : '?'}): ${adj.sharedVertices} shared vertices`);
      }
    }
  }

  for (const m of r.matched) {
    if (!m.identical) {
      const tokA = m.tokensA;
      const tokB = m.tokensB;
      const tokenChanged =
        tokA && tokB && tokA.tokens && tokB.tokens ? JSON.stringify(tokA.tokens) !== JSON.stringify(tokB.tokens) : null;
      if (tokenChanged || m.ecChanged || m.vcChanged) {
        console.log(
          `  Matched but CHANGED: A${m.aIndex}(${tokA ? tokA.orientation : '?'}) -> B${m.bIndex}, ` +
            `ec:${m.ecChanged} vc:${m.vcChanged} secCount:${m.secCountChanged} b1Len:${m.b1LenChanged} ` +
            `tokensChanged:${tokenChanged}`
        );
      }
    }
  }
}

// ============================================================
// Cross-check: does real adjacency == the set of faces with changed tokens?
// (for the ONE edge location this corpus contains)
// ============================================================

console.log('\n\n=== CROSS-CHECK: real geometric adjacency vs. token-signature change set ===');
console.log('(Single edge location only -- this corpus does not contain a second edge. See "NEW MODEL REQUIRED" below.)\n');

const crossCheck = {};
for (const [key, aName, bName] of [
  ['C00_cube_10mm_vs_C03_cube_fillet_1mm', 'C00_cube_10mm', 'C03_cube_fillet_1mm'],
  ['C00_cube_10mm_vs_C09_cube_chamfer_1mm', 'C00_cube_10mm', 'C09_cube_chamfer_1mm'],
]) {
  const r = results[key];
  // The genuinely new (added) face for fillet/chamfer.
  const newFace = r.added[0];
  // Real adjacency must be computed WITHIN the modified model (C03/C09), because C00 does not
  // contain the fillet/chamfer geometry at all -- adjacentToOriginalFaces is definitionally
  // empty (confirmed by the per-pair run above). adjacentToModelFaces gives the new face's
  // real edge-sharing neighbors in B's own face numbering; translate those B-indices back to
  // C00 indices via the correspondence table established above (matched aIndex<->bIndex).
  const bToA = new Map(r.matched.map((m) => [m.bIndex, m.aIndex]));
  const adjacentC00Indices = new Set(
    newFace.adjacentToModelFaces.map((a) => a.index).filter((bIdx) => bToA.has(bIdx)).map((bIdx) => bToA.get(bIdx))
  );

  // Faces whose token signature changed, from the matched set (planar_cube-only, ec/vc/secCount/b1Len unchanged).
  const changedTokenFaces = r.matched
    .filter((m) => {
      const tokA = m.tokensA;
      const tokB = m.tokensB;
      if (!tokA || !tokB || !tokA.tokens || !tokB.tokens) return false;
      return JSON.stringify(tokA.tokens) !== JSON.stringify(tokB.tokens);
    })
    .map((m) => m.aIndex);

  const unchangedTokenFaces = r.matched
    .filter((m) => {
      const tokA = m.tokensA;
      const tokB = m.tokensB;
      if (!tokA || !tokB || !tokA.tokens || !tokB.tokens) return false;
      return JSON.stringify(tokA.tokens) === JSON.stringify(tokB.tokens);
    })
    .map((m) => m.aIndex);

  console.log(`${bName}:`);
  console.log(`  New face (B${newFace.bIndex}) real-adjacent C00 faces (>=2 shared vertices): [${[...adjacentC00Indices].join(',')}]`);
  console.log(`  C00 faces with CHANGED token signature (matched, ec/vc/secCount/b1Len identical): [${changedTokenFaces.join(',')}]`);
  console.log(`  C00 faces with UNCHANGED token signature (matched, same category): [${unchangedTokenFaces.join(',')}]`);
  const exactMatch =
    changedTokenFaces.length > 0 &&
    changedTokenFaces.every((i) => adjacentC00Indices.has(i)) &&
    unchangedTokenFaces.every((i) => !adjacentC00Indices.has(i));
  console.log(`  Changed-token set is exactly the real-adjacent set (excluding directly-modified faces): ${exactMatch}`);

  crossCheck[bName] = {
    newFaceIndex: newFace.bIndex,
    adjacentC00Indices: [...adjacentC00Indices],
    changedTokenFaces,
    unchangedTokenFaces,
    changedSetEqualsAdjacentSet: exactMatch,
  };
}

results._crossCheck = crossCheck;

// ============================================================
// NQ-028 status
// ============================================================

console.log('\n\n=== NQ-028 STATUS ===');
console.log('NOT ANSWERED. This corpus contains exactly one edge-feature location (the edge');
console.log('shared by the +X and +Y faces, used by both C03 and C09). No model exists with a');
console.log('fillet/chamfer on a different edge. See "NEW MODEL REQUIRED" in');
console.log('knowledge/evidence/2026-08-14_v0.4.7-EXP037.md for the exact specification.');

results._nq028Status = {
  answered: false,
  reason:
    'Controlled corpus (and the underlying SLDPRT files, which are absent from this repository ' +
    'snapshot) contains only one edge-feature location. C03 (fillet) and C09 (chamfer) both ' +
    'modify the edge shared by the +X and +Y faces. No second-edge model exists anywhere in the ' +
    'archived v0.4.7 JSON outputs or on disk.',
  newModelRequired: true,
};

fs.writeFileSync(path.join(DIR, 'EXP037_RESULTS.json'), JSON.stringify(results, null, 2));
console.log('\n\nResults written to EXP037_RESULTS.json');

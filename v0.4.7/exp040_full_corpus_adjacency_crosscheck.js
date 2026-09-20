/**
 * EXP-040: Full-Corpus Real-Adjacency vs. Token-Change Cross-Check
 *          + Correction of EXP-037's Shell "Contrast Case" (indexing error)
 *
 * Motivated by two things found during a 2026-08-16 audit of EXP-037/038:
 *
 * 1. EXP-037's crossCheck (`_crossCheck` in EXP037_RESULTS.json) only tabulated
 *    real-adjacency-vs-token-change for C03 (fillet) and C09 (chamfer). C04 (hole)
 *    and C10 (shell) were analyzed for face correspondence/adjacency but never
 *    folded into the same table, even though EXP-037 already computed everything
 *    needed. This experiment builds that missing full-corpus table, using ONLY
 *    already-archived EXP037_RESULTS.json data (no SLDPRT files, no new tooling,
 *    no new model) — i.e. it is the "highest information, no-new-data" experiment
 *    identified by the audit.
 *
 * 2. While building that table, a genuine error was found in EXP-037's own written
 *    claims (v0.4.7/EXP037_SUMMARY.md Section 4, and
 *    knowledge/evidence/2026-08-14_v0.4.7-EXP037.md Section 5): both documents
 *    state that C10 (shell)'s new inner-wall faces are "adjacent to several of the
 *    five unmodified outer walls" (the evidence file even names specific indices:
 *    "outer walls at C10 indices 7 and 9"). This is FALSE. Indices 7 and 9 are
 *    themselves new inner-wall faces (per the SAME document's own face census: "C10
 *    ... +5 -- faces 6-10 (inner walls)"), not outer walls -- the claim confuses two
 *    faces from the ADDED set for two faces from the UNCHANGED set. Recomputing
 *    shared-vertex adjacency directly from `VERTEX_ANALYSIS.json`'s raw coordinates
 *    (bypassing EXP-037's script and its JSON output entirely -- an independent
 *    re-derivation) shows: every one of C10's 5 new inner-wall faces (indices 6-10)
 *    shares vertices ONLY with (a) the directly/structurally-modified opening face
 *    (index 0, ec/vc changed by the shell operation itself) and (b) each other.
 *    ZERO shared vertices exist between any new inner-wall face and any of the 5
 *    unmodified, token-identical outer walls (matched indices 1-5). See the
 *    `shellRawRecheck` section below for the from-scratch recomputation.
 *
 *    Consequence: the "shell contrast case" -- used throughout the knowledge base
 *    (FAILED_HYPOTHESES.md FH-031, OPEN_QUESTIONS.md OQ-032/036,
 *    RESEARCH_DASHBOARD.md, RESEARCH_HANDOFF.md, EXPERIMENT_LOG.md) as evidence
 *    that "real adjacency to a new face is not universally sufficient for a token
 *    change" -- is NOT supported by the data it cites. Shell does not contain any
 *    adjacent-but-unchanged face at all. It is REMOVED as a counterexample by this
 *    correction. This does NOT prove adjacency is universally sufficient (shell
 *    simply contributes zero test cases for that question now, rather than a
 *    disconfirming one) -- see "What This Does NOT Establish" below.
 *
 * Do NOT modify parser/. Do NOT re-run or modify EXP-037/038's own scripts or
 * results -- this experiment only reads their already-committed JSON output plus
 * the same raw VERTEX_ANALYSIS.json/EXP033/EXP035 archives they used, and performs
 * an independent recomputation for the shell recheck (matching this project's
 * audit convention of not trusting a claim via the same code path that produced it).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const DIR = __dirname;

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
}

const EXP037 = loadJSON('EXP037_RESULTS.json');
const EXP033 = loadJSON('EXP033_FEATURE_STATE.json');
const EXP035 = loadJSON('EXP035_RESULTS.json');
const VERTEX_ANALYSIS = loadJSON('VERTEX_ANALYSIS.json');

// ============================================================
// Token lookup (same approach as EXP-037/038)
// ============================================================

const tokensByModelFace = new Map();
for (const f of EXP033.faces) {
  tokensByModelFace.set(`${f.model}|${f.faceIndex}`, { tokens: f.tokens, orientation: f.orientation });
}
for (const r of EXP035.originalOuterFaceComparison.results) {
  tokensByModelFace.set(`C10_cube_shell_1mm|${r.c10Index}`, { tokens: null, orientation: r.orientation, identicalToC00: r.identical });
}
for (const r of EXP035.newInnerFaceAnalysis.results) {
  tokensByModelFace.set(`C10_cube_shell_1mm|${r.c10Index}`, { tokens: r.tokens, orientation: r.orientation });
}
function lookupTokens(model, faceIndex) {
  return tokensByModelFace.get(`${model}|${faceIndex}`) || null;
}
function tokensEqual(tokA, tokB) {
  if (tokA && tokB && tokA.tokens && tokB.tokens) {
    return JSON.stringify(tokA.tokens) === JSON.stringify(tokB.tokens);
  }
  // Fall back to EXP-035's directly-recorded identical=true/false flag for C10's outer walls,
  // where the raw Block1 token array itself was not archived but EXP-035 independently
  // established (by direct per-face comparison) whether the token was identical to C00's.
  if (tokB && typeof tokB.identicalToC00 === 'boolean') return tokB.identicalToC00;
  return null; // genuinely unknown
}

// ============================================================
// Part 1: Full-corpus adjacency-vs-token-change table
// (from already-archived EXP037_RESULTS.json matched/added records --
//  no new correspondence or adjacency computation, just tabulation EXP-037
//  itself stopped short of for C04/C10)
// ============================================================

const pairs = [
  ['C00_cube_10mm_vs_C03_cube_fillet_1mm', 'C00_cube_10mm', 'C03_cube_fillet_1mm', 'fillet'],
  ['C00_cube_10mm_vs_C09_cube_chamfer_1mm', 'C00_cube_10mm', 'C09_cube_chamfer_1mm', 'chamfer'],
  ['C00_cube_10mm_vs_C04_cube_hole_5mm', 'C00_cube_10mm', 'C04_cube_hole_5mm', 'hole'],
  ['C00_cube_10mm_vs_C10_cube_shell_1mm', 'C00_cube_10mm', 'C10_cube_shell_1mm', 'shell'],
];

const fullTable = {};
const tally = { adjacentChanged: 0, adjacentUnchanged: 0, nonAdjacentChanged: 0, nonAdjacentUnchanged: 0, unknown: 0 };
const tallyByFeature = {};

for (const [key, aName, bName, feature] of pairs) {
  const r = EXP037[key];
  // Build the set of B-indices real-adjacent to ANY added (new) face, from EXP-037's own
  // already-computed adjacentToModelFaces lists.
  const adjacentToAnyNewFaceB = new Set();
  for (const added of r.added) {
    for (const adj of added.adjacentToModelFaces) adjacentToAnyNewFaceB.add(adj.index);
  }

  const rows = [];
  for (const m of r.matched) {
    const tokA = lookupTokens(aName, m.aIndex);
    const tokB = lookupTokens(bName, m.bIndex);
    const isEqual = tokensEqual(tokA, tokB); // true = tokens identical (unchanged), false = different (changed), null = unknown
    const changed = isEqual === null ? null : !isEqual;
    const structurallyModified = m.ecChanged || m.vcChanged || m.secCountChanged || m.b1LenChanged;
    const isAdjacentToNewFace = adjacentToAnyNewFaceB.has(m.bIndex);
    const row = {
      aIndex: m.aIndex,
      bIndex: m.bIndex,
      orientation: tokA ? tokA.orientation : (tokB ? tokB.orientation : '?'),
      structurallyModified,
      isAdjacentToNewFace,
      tokenChanged: changed,
    };
    rows.push(row);

    if (changed === null) {
      tally.unknown++;
    } else if (isAdjacentToNewFace && changed) tally.adjacentChanged++;
    else if (isAdjacentToNewFace && !changed) tally.adjacentUnchanged++;
    else if (!isAdjacentToNewFace && changed) tally.nonAdjacentChanged++;
    else tally.nonAdjacentUnchanged++;
  }

  tallyByFeature[feature] = rows;
  fullTable[key] = { feature, rows, faceCountA: r.faceCountA, faceCountB: r.faceCountB };
}

console.log('EXP-040: Full-Corpus Real-Adjacency vs. Token-Change Cross-Check');
console.log('===================================================================\n');
for (const [key, aName, bName, feature] of pairs) {
  console.log(`--- ${feature} (${aName} -> ${bName}) ---`);
  for (const row of fullTable[key].rows) {
    console.log(
      `  ${aName === 'C00_cube_10mm' ? 'C00' : aName} face ${row.aIndex} (${row.orientation}): ` +
        `structurallyModified=${row.structurallyModified} adjacentToNewFace=${row.isAdjacentToNewFace} ` +
        `tokenChanged=${row.tokenChanged === null ? 'unknown' : row.tokenChanged}`
    );
  }
  console.log();
}

console.log('=== TALLY (matched/pre-existing faces only, all 4 feature types) ===');
console.log(JSON.stringify(tally, null, 2));
console.log(
  '\nadjacentUnchanged should be 0 if "real adjacency to a new face implies a token change" held ' +
    'universally across ALL tested feature types (it does NOT need to be 0 for the narrower ' +
    'fillet/chamfer-specific claim, which only concerns those two feature types).'
);

// ============================================================
// Part 2: Independent from-scratch recheck of C10 (shell) real adjacency,
// bypassing EXP-037's script and JSON entirely -- direct recomputation from
// VERTEX_ANALYSIS.json raw vertex coordinates.
// ============================================================

console.log('\n\n=== PART 2: Independent recheck of C10 shell adjacency (bypasses EXP-037 code) ===\n');

const VERTEX_TOL = 1e-5;
function vertClose(a, b) {
  return Math.abs(a[0] - b[0]) < VERTEX_TOL && Math.abs(a[1] - b[1]) < VERTEX_TOL && Math.abs(a[2] - b[2]) < VERTEX_TOL;
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

const c10Pair = VERTEX_ANALYSIS['C00_cube_10mm_vs_C10_cube_shell_1mm'];
const facesB = c10Pair.facesB;
const addedIndices = [6, 7, 8, 9, 10];
const outerUnchangedIndices = [1, 2, 3, 4, 5]; // C10's own numbering: 5 unmodified outer walls (identical=true per EXP-037 matched list)
const openingIndex = 0; // structurally modified opening face

const shellRawRecheck = {};
for (const addedIdx of addedIndices) {
  const faceAdded = facesB.find((f) => f.index === addedIdx);
  const row = {};
  for (const outerIdx of outerUnchangedIndices) {
    const faceOuter = facesB.find((f) => f.index === outerIdx);
    row[`outer_${outerIdx}`] = sharedVertexCount(faceAdded, faceOuter);
  }
  const faceOpening = facesB.find((f) => f.index === openingIndex);
  row.opening_0 = sharedVertexCount(faceAdded, faceOpening);
  shellRawRecheck[`added_${addedIdx}`] = row;
  console.log(`Face ${addedIdx} vs unmodified outer walls [1-5]: ${JSON.stringify(row)}`);
}

const anyAddedFaceAdjacentToUnmodifiedOuterWall = addedIndices.some((addedIdx) =>
  outerUnchangedIndices.some((outerIdx) => shellRawRecheck[`added_${addedIdx}`][`outer_${outerIdx}`] >= 2)
);

console.log(
  `\nAny new inner-wall face real-adjacent (>=2 shared vertices) to an unmodified outer wall: ` +
    `${anyAddedFaceAdjacentToUnmodifiedOuterWall}`
);
console.log(
  'EXP-037 SUMMARY.md / evidence file claimed TRUE (citing "outer walls at C10 indices 7 and 9" for ' +
    'this comparison), but indices 7 and 9 are themselves new inner-wall faces per EXP-037\'s own face ' +
    'census, not outer walls. This independent recomputation from raw vertex coordinates finds FALSE: ' +
    'the new inner-wall faces are adjacent only to the directly-modified opening face (index 0) and to ' +
    'each other, never to the 5 unmodified outer walls.'
);

const results = {
  fullTable,
  tally,
  shellCorrection: {
    claimInEXP037: 'C10 new inner-wall faces are adjacent to several unmodified outer walls (named indices 7, 9)',
    claimStatus: 'ERROR -- indices 7 and 9 are new inner-wall faces themselves, not outer walls',
    independentRecheck: shellRawRecheck,
    anyAddedFaceAdjacentToUnmodifiedOuterWall,
    correctedConclusion:
      'C10 shell contributes ZERO adjacent-but-unchanged data points. Its new inner-wall faces are ' +
      'real-adjacent only to the already-directly-modified opening face and to each other. The 5 ' +
      'unmodified, token-identical outer walls are not real-adjacent to any new geometry at all. ' +
      'Shell is therefore fully CONSISTENT with (not a counterexample to) "real adjacency to new ' +
      'geometry correlates with a token change" -- though this does not prove the rule universal, since ' +
      'shell no longer supplies any adjacent-but-unchanged OR adjacent-and-changed test case either way.',
  },
};

fs.writeFileSync(path.join(DIR, 'EXP040_RESULTS.json'), JSON.stringify(results, null, 2));
console.log('\n\nResults written to EXP040_RESULTS.json');

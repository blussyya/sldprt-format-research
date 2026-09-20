/**
 * EXP-041: The controlled corpus is unblocked — from-source verification of the v0.4.7 record,
 *          and extension to the five previously-unanalyzed models.
 *
 * CONTEXT
 * -------
 * Every v0.4.7 experiment from EXP-027 through EXP-040 was computed against archived JSON
 * (VERTEX_ANALYSIS.json, EXP033_FEATURE_STATE.json, EXP037_RESULTS.json, ...) derived from
 * controlled-corpus SLDPRT files that were NOT in this repository. `RESEARCH_HANDOFF.md` records
 * this as a standing limitation ("C00 through C11 are still archive-only"), reconfirmed by
 * EXP-037 via a full-filesystem search. Only C12 had a real file, supplied for EXP-038.
 *
 * On 2026-09-13 the user committed the real SLDPRT/STEP/STL files for C00-C11
 * (commit d0c6c54). For the first time the entire controlled corpus can be parsed from source.
 * This experiment does the work that blocker was preventing.
 *
 * WHAT THIS DOES (four parts, all from source)
 * --------------------------------------------
 *   Part 1  PROVENANCE.  Re-parse C00-C11 and check them against CORPUS_AUDIT.json field by
 *           field (DisplayList length, per-face byte offsets, ec/vc/secCount/b1Len, sectionLens,
 *           loopSizes, b2Body, vertex previews, normal previews, Block1 token previews). This
 *           answers a question nobody could answer before: are the supplied binaries the same
 *           models the entire v0.4.7 archive was derived from, or were they regenerated?
 *
 *   Part 2  INVARIANTS.  Re-verify INV-016 / INV-017 / INV-018 from source across all 13 models.
 *
 *   Part 3  CROSS-TABULATION.  Recompute the (direct vertex modification) x (adjacency to newly
 *           created geometry) x (Block1 token change) table from source over twelve controlled
 *           pairs — including C06, C07, C08 and the C04<->C11 diameter pair, which no previous
 *           experiment analyzed for tokens or adjacency at all.
 *
 *   Part 4  EMPTY-CELL CHECK.  `RESEARCH_DESIGN_next_experiment.md` §1 states that the cell
 *           {vertices unchanged} x {adjacent to a new face} is empty in this corpus, which is why
 *           H1b and H2 cannot be separated. That claim was made over five feature models. This
 *           re-tests it over the whole 13-model corpus from source.
 *
 * TOOLING: reused, not rewritten, per the binding methodological constraints in
 * RESEARCH_HANDOFF.md — `computeAdjacency` (real >=2-shared-vertex test) from
 * exp037_edge_location_and_adjacency.js, and `matchFaces` with the bounding-box-center centroid
 * (threshold 0.002m) from exp038_nq028_c12_second_edge.js. Face correspondence never uses
 * Block1/Block2 token similarity, which is the thing under investigation.
 *
 * Do NOT modify parser/. Do NOT assign semantic meaning to token values.
 * Observation and interpretation are kept separate: this script emits observations; the
 * interpretation lives in EXP041_SUMMARY.md and the evidence file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = __dirname;
const REPO_ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'test files original', 'controlled');
const parserCore = require(path.join(REPO_ROOT, 'parser', 'v0.1', 'src', 'parser-core.js'));

const MODELS = [
  'C00_cube_10mm', 'C01_cube_20mm', 'C02_cube_translated', 'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C06_cube_hole_moved', 'C07_cube_two_holes',
  'C08_cube_second_hole_modified', 'C09_cube_chamfer_1mm', 'C10_cube_shell_1mm',
  'C11_cube_hole_4mm', 'C12_cube_fillet_1mm_edge2',
];

// Twelve one-variable-at-a-time comparisons. The last five rows are pairs that no prior
// v0.4.7 experiment analyzed for tokens or adjacency.
const PAIRS = [
  ['C00_cube_10mm', 'C01_cube_20mm', 'uniform scale x2'],
  ['C00_cube_10mm', 'C02_cube_translated', 'translation'],
  ['C00_cube_10mm', 'C03_cube_fillet_1mm', 'fillet, edge 1'],
  ['C00_cube_10mm', 'C09_cube_chamfer_1mm', 'chamfer, edge 1'],
  ['C00_cube_10mm', 'C12_cube_fillet_1mm_edge2', 'fillet, edge 2'],
  ['C00_cube_10mm', 'C04_cube_hole_5mm', 'through-hole added'],
  ['C00_cube_10mm', 'C10_cube_shell_1mm', 'shell'],
  ['C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'hole diameter 5->3'],
  ['C04_cube_hole_5mm', 'C11_cube_hole_4mm', 'hole diameter 5->4 (NEW)'],
  ['C04_cube_hole_5mm', 'C06_cube_hole_moved', 'hole position only (NEW)'],
  ['C04_cube_hole_5mm', 'C07_cube_two_holes', 'one hole -> two holes (NEW)'],
  ['C07_cube_two_holes', 'C08_cube_second_hole_modified', 'second hole only 5->3 (NEW)'],
];

// ============================================================
// Parsing (read-only use of parser/v0.1)
// ============================================================

function parseModel(name) {
  const p = path.join(CORPUS_DIR, name, 'model.SLDPRT');
  const buf = fs.readFileSync(p);
  const parsed = parserCore.parseSLDPRT(
    buf,
    (b) => Buffer.from(zlib.inflateRawSync(b)),
    (b) => Buffer.from(zlib.inflateSync(b))
  );
  const faces = parsed.faces.map((f, idx) => {
    const vertices = [];
    for (let v = 0; v < f.vertexCount; v++) {
      vertices.push([f.vertices[v * 3], f.vertices[v * 3 + 1], f.vertices[v * 3 + 2]]);
    }
    return {
      index: idx,
      edgeCount: f.edgeCount,
      vertexCount: f.vertexCount,
      secCount: f.secCount,
      b1Len: f.b1Len,
      sectionLens: Array.from(f.sectionLens || []),
      loopSizes: Array.from(f.loopSizes || []),
      b2Body: Array.from(f.b2Body || []),
      tokens: Array.from(f.b1Body || []),
      vertices,
      raw: f,
    };
  });
  return { parsed, faces };
}

// ============================================================
// Geometry primitives (reused verbatim in behaviour from EXP-037/038)
// ============================================================

const VTOL = 1e-6;
function vertClose(a, b, tol = VTOL) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;
}

// EXP-037's real adjacency test: >=2 coincident vertices means the faces share an edge.
function sharedVertexCount(faceA, faceB) {
  let count = 0;
  for (const va of faceA.vertices) {
    for (const vb of faceB.vertices) {
      if (vertClose(va, vb)) { count++; break; }
    }
  }
  return count;
}

function computeAdjacency(targetFace, candidateFaces) {
  return candidateFaces
    .filter((f) => f.index !== targetFace.index)
    .map((f) => ({ index: f.index, sharedVertices: sharedVertexCount(targetFace, f) }))
    .filter((r) => r.sharedVertices >= 2)
    .sort((a, b) => b.sharedVertices - a.sharedVertices);
}

// EXP-038's bounding-box center (NOT EXP-037's vertex average -- see the binding methodological
// constraint in RESEARCH_HANDOFF.md: the vertex average is sensitive to tessellation density).
function centroid(face) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const v of face.vertices) {
    if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
    if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

function dist3(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

const CENTROID_THRESHOLD = 0.002;
const AMBIGUITY_MARGIN = 0.0005;

function matchFaces(facesA, facesB) {
  const pairs = [];
  for (const a of facesA) {
    const ca = centroid(a);
    for (const b of facesB) {
      const d = dist3(ca, centroid(b));
      if (d <= CENTROID_THRESHOLD) pairs.push({ a, b, dist: d });
    }
  }
  pairs.sort((p, q) => p.dist - q.dist);

  const candidatesByB = new Map();
  for (const p of pairs) {
    if (!candidatesByB.has(p.b.index)) candidatesByB.set(p.b.index, []);
    candidatesByB.get(p.b.index).push(p);
  }
  const ambiguousB = new Set();
  const ambiguous = [];
  for (const [bIdx, cands] of candidatesByB) {
    cands.sort((x, y) => x.dist - y.dist);
    if (cands.length >= 2 && cands[1].dist - cands[0].dist < AMBIGUITY_MARGIN) {
      ambiguousB.add(bIdx);
      ambiguous.push({ bIndex: bIdx, candidates: cands.slice(0, 3).map((c) => ({ aIndex: c.a.index, centroidDist: c.dist })) });
    }
  }

  const usedA = new Set(), usedB = new Set(), matched = [];
  for (const p of pairs) {
    if (usedA.has(p.a.index) || usedB.has(p.b.index) || ambiguousB.has(p.b.index)) continue;
    usedA.add(p.a.index); usedB.add(p.b.index);
    matched.push({ aIndex: p.a.index, bIndex: p.b.index, centroidDist: p.dist });
  }
  return {
    matched,
    removed: facesA.filter((f) => !usedA.has(f.index)).map((f) => f.index),
    added: facesB.filter((f) => !usedB.has(f.index) && !ambiguousB.has(f.index)).map((f) => f.index),
    ambiguous,
  };
}

// EXP-037/038's operational definition of "directly modified": full per-vertex coordinate
// comparison, not just ec/vc/secCount/b1Len (the criterion FH-030 was originally, wrongly,
// written against).
function facesIdentical(a, b) {
  if (a.edgeCount !== b.edgeCount) return false;
  if (a.vertexCount !== b.vertexCount) return false;
  if (a.secCount !== b.secCount) return false;
  if (a.b1Len !== b.b1Len) return false;
  if (a.vertices.length !== b.vertices.length) return false;
  for (let i = 0; i < a.vertices.length; i++) {
    if (!vertClose(a.vertices[i], b.vertices[i])) return false;
  }
  return true;
}

const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ============================================================
// PART 1 -- Provenance against CORPUS_AUDIT.json
// ============================================================

function partProvenance(loaded) {
  const audit = JSON.parse(fs.readFileSync(path.join(DIR, 'CORPUS_AUDIT.json'), 'utf8'));
  const rows = [];
  for (const model of Object.keys(audit)) {
    const a = audit[model];
    if (!loaded[model]) { rows.push({ model, status: 'NO_FILE' }); continue; }
    const faces = loaded[model].faces;
    const mism = { faceCount: 0, offsets: 0, structure: 0, sections: 0, loops: 0, b2: 0, vertices: 0, normals: 0, tokens: 0 };
    if (faces.length !== a.faceCount) mism.faceCount = 1;
    const n = Math.min(faces.length, a.faces.length);
    for (let i = 0; i < n; i++) {
      const F = faces[i], A = a.faces[i], R = F.raw;
      if (R.block1Start !== A.block1Start || R.block2Start !== A.block2Start ||
          R.verticesStart !== A.verticesStart || R.normalsStart !== A.normalsStart ||
          R.gapStart !== A.gapStart) mism.offsets++;
      if (F.edgeCount !== A.edgeCount || F.vertexCount !== A.vertexCount ||
          F.secCount !== A.secCount || F.b1Len !== A.b1Len) mism.structure++;
      if (!eq(F.sectionLens, A.sectionLens)) mism.sections++;
      if (!eq(F.loopSizes, A.loopSizes)) mism.loops++;
      if (!eq(F.b2Body, A.b2Body)) mism.b2++;
      const vPrev = [];
      for (let k = 0; k < Math.min(9, R.vertices.length); k++) vPrev.push(R.vertices[k]);
      if (!eq(vPrev, A.verticesPreview)) mism.vertices++;
      const nPrev = [];
      for (let k = 0; k < Math.min(9, R.normals.length); k++) nPrev.push(R.normals[k]);
      if (!eq(nPrev, A.normalsPreview)) mism.normals++;
      if (!eq(F.tokens.slice(0, A.b1BodyPreview.length), A.b1BodyPreview)) mism.tokens++;
    }
    const total = Object.values(mism).reduce((x, y) => x + y, 0);
    rows.push({ model, archivedFaceCount: a.faceCount, parsedFaceCount: faces.length,
      archivedDlLength: a.dlLength, mismatches: mism, status: total === 0 ? 'EXACT_MATCH' : 'MISMATCH' });
  }
  return rows;
}

// ============================================================
// PART 2 -- Invariants from source
// ============================================================

function partInvariants(loaded) {
  const rows = [];
  const tot = { faces: 0, inv016: 0, inv018: 0, sections: 0, inv017: 0 };
  for (const model of MODELS) {
    const faces = loaded[model].faces;
    let i16 = 0, i18 = 0, secs = 0, i17 = 0;
    for (const f of faces) {
      tot.faces++;
      if (f.b1Len === 2 * (f.vertexCount - f.secCount)) { i16++; tot.inv016++; }
      for (let s = 0; s < f.secCount; s++) {
        secs++; tot.sections++;
        if (f.sectionLens[s] === f.b2Body[s] - 1) { i17++; tot.inv017++; }
      }
      if (f.b2Body.reduce((x, y) => x + y, 0) === f.b1Len) { i18++; tot.inv018++; }
    }
    rows.push({ model, faces: faces.length, inv016: `${i16}/${faces.length}`,
      inv017: `${i17}/${secs}`, inv018: `${i18}/${faces.length}`,
      pass: i16 === faces.length && i18 === faces.length && i17 === secs });
  }
  return { rows, totals: tot };
}

// ============================================================
// PART 3/4 -- Cross-tabulation and empty-cell check
// ============================================================

function partCrossTab(loaded) {
  const pairResults = [];
  const cells = { modAdj: [], modNotAdj: [], unmodAdj: [], unmodNotAdj: [] };

  for (const [ma, mb, label] of PAIRS) {
    const A = loaded[ma].faces, B = loaded[mb].faces;
    const corr = matchFaces(A, B);
    const addedFaces = corr.added.map((i) => B.find((f) => f.index === i));

    const rows = corr.matched.map(({ aIndex, bIndex, centroidDist }) => {
      const fa = A.find((f) => f.index === aIndex);
      const fb = B.find((f) => f.index === bIndex);
      const unmodified = facesIdentical(fa, fb);
      const tokensChanged = !eq(fa.tokens, fb.tokens);
      // Adjacency measured in model B, between this face and the newly created faces.
      const adjacentToNew = addedFaces
        .map((nf) => ({ index: nf.index, sharedVertices: sharedVertexCount(fb, nf) }))
        .filter((r) => r.sharedVertices >= 2);
      // Adjacency to a face that is matched but directly modified (EXP-039's R2 relation).
      const adjacentToModified = corr.matched
        .filter((m) => m.bIndex !== bIndex)
        .map((m) => ({ m, other: B.find((f) => f.index === m.bIndex), otherA: A.find((f) => f.index === m.aIndex) }))
        .filter(({ other, otherA }) => !facesIdentical(otherA, other))
        .map(({ other }) => ({ index: other.index, sharedVertices: sharedVertexCount(fb, other) }))
        .filter((r) => r.sharedVertices >= 2);

      const row = {
        pair: `${ma} -> ${mb}`, label, aIndex, bIndex, centroidDist,
        vcA: fa.vertexCount, vcB: fb.vertexCount,
        secCountA: fa.secCount, secCountB: fb.secCount,
        b1LenA: fa.b1Len, b1LenB: fb.b1Len,
        directlyModified: !unmodified,
        tokensChanged,
        // b1Len is forced by INV-016 when vc/secCount change; such a "change" is uninformative.
        tokenLengthForced: fa.b1Len !== fb.b1Len,
        adjacentToNew: adjacentToNew.map((r) => r.index),
        adjacentToNewSharedVertices: adjacentToNew.map((r) => r.sharedVertices),
        adjacentToModified: adjacentToModified.map((r) => r.index),
        adjacentToModifiedSharedVertices: adjacentToModified.map((r) => r.sharedVertices),
      };
      const key = (row.directlyModified ? 'mod' : 'unmod') + (adjacentToNew.length ? 'Adj' : 'NotAdj');
      cells[key].push(row);
      return row;
    });

    pairResults.push({
      modelA: ma, modelB: mb, label,
      faceCountA: A.length, faceCountB: B.length,
      matched: corr.matched.length, added: corr.added, removed: corr.removed,
      ambiguous: corr.ambiguous, rows,
    });
  }
  return { pairResults, cells };
}

// ============================================================
// Run
// ============================================================

console.log('EXP-041: controlled corpus unblocked — from-source verification\n');

const loaded = {};
for (const m of MODELS) {
  loaded[m] = parseModel(m);
  console.log(`  parsed ${m.padEnd(32)} ${String(loaded[m].faces.length).padStart(2)} faces`);
}

console.log('\n--- PART 1: PROVENANCE vs CORPUS_AUDIT.json ---');
const provenance = partProvenance(loaded);
for (const r of provenance) {
  console.log(`  ${r.model.padEnd(32)} ${r.status}` +
    (r.status === 'MISMATCH' ? '  ' + JSON.stringify(r.mismatches) : ''));
}
const provExact = provenance.filter((r) => r.status === 'EXACT_MATCH').length;
console.log(`  => ${provExact}/${provenance.length} archived models reproduce EXACTLY from source.`);

console.log('\n--- PART 2: INV-016 / INV-017 / INV-018 FROM SOURCE ---');
const invariants = partInvariants(loaded);
for (const r of invariants.rows) {
  console.log(`  ${r.model.padEnd(32)} faces=${String(r.faces).padStart(2)} INV016=${r.inv016.padEnd(6)} INV017=${r.inv017.padEnd(8)} INV018=${r.inv018.padEnd(6)} ${r.pass ? 'PASS' : 'FAIL'}`);
}
const t = invariants.totals;
console.log(`  => faces=${t.faces}  INV-016 ${t.inv016}/${t.faces}  INV-017 ${t.inv017}/${t.sections} sections  INV-018 ${t.inv018}/${t.faces}`);

console.log('\n--- PART 3: CROSS-TABULATION (12 pairs) ---');
const { pairResults, cells } = partCrossTab(loaded);
for (const p of pairResults) {
  console.log(`\n  ${p.modelA} -> ${p.modelB}  [${p.label}]  ${p.faceCountA}->${p.faceCountB} faces` +
    `  matched=${p.matched} added=[${p.added}] removed=[${p.removed}]`);
  for (const r of p.rows) {
    console.log(`    a${r.aIndex}->b${r.bIndex}  vc ${r.vcA}->${r.vcB}  modified=${String(r.directlyModified).padEnd(5)}` +
      ` tokenChanged=${String(r.tokensChanged).padEnd(5)} lengthForced=${String(r.tokenLengthForced).padEnd(5)}` +
      ` adjToNew=[${r.adjacentToNew}] adjToModified=[${r.adjacentToModified}]`);
  }
}

console.log('\n--- PART 4: CROSS-TAB CELL COUNTS ---');
const summarize = (rows) => {
  const changed = rows.filter((r) => r.tokensChanged).length;
  return `${rows.length} rows (${changed} tokenChanged, ${rows.length - changed} unchanged)`;
};
console.log(`  modified   + adjacent-to-new  : ${summarize(cells.modAdj)}`);
console.log(`  modified   + NOT adjacent     : ${summarize(cells.modNotAdj)}`);
console.log(`  UNMODIFIED + adjacent-to-new  : ${summarize(cells.unmodAdj)}   <-- the discriminating cell`);
console.log(`  UNMODIFIED + NOT adjacent     : ${summarize(cells.unmodNotAdj)}`);
console.log(`\n  EMPTY-CELL STATUS: ${cells.unmodAdj.length === 0 ? 'STILL EMPTY — H1b and H2 remain inseparable in this corpus.' : 'POPULATED — see rows above.'}`);

const results = {
  experiment: 'EXP-041',
  date: '2026-09-13',
  title: 'Controlled corpus unblocked: from-source verification of the v0.4.7 record and extension to five previously-unanalyzed models',
  corpusCommit: 'd0c6c54 (added controlled shapes made in solidworks)',
  method: {
    parser: 'parser/v0.1/src/parser-core.js (read-only, unmodified)',
    adjacency: 'computeAdjacency from exp037_edge_location_and_adjacency.js (>=2 shared vertices)',
    correspondence: 'matchFaces from exp038_nq028_c12_second_edge.js (bounding-box center, threshold 0.002m)',
    modificationCriterion: 'facesIdentical: full per-vertex coordinate comparison (tolerance 1e-6)',
  },
  part1_provenance: { rows: provenance, exactMatches: provExact, total: provenance.length },
  part2_invariants: invariants,
  part3_crossTabulation: pairResults,
  part4_cells: {
    modifiedAdjacentToNew: { count: cells.modAdj.length, tokenChanged: cells.modAdj.filter((r) => r.tokensChanged).length, rows: cells.modAdj },
    modifiedNotAdjacent: { count: cells.modNotAdj.length, tokenChanged: cells.modNotAdj.filter((r) => r.tokensChanged).length, rows: cells.modNotAdj },
    unmodifiedAdjacentToNew: { count: cells.unmodAdj.length, tokenChanged: cells.unmodAdj.filter((r) => r.tokensChanged).length, rows: cells.unmodAdj },
    unmodifiedNotAdjacent: { count: cells.unmodNotAdj.length, tokenChanged: cells.unmodNotAdj.filter((r) => r.tokensChanged).length, rows: cells.unmodNotAdj },
    emptyCellStillEmpty: cells.unmodAdj.length === 0,
  },
};

fs.writeFileSync(path.join(DIR, 'EXP041_RESULTS.json'), JSON.stringify(results, null, 2));
console.log('\nWrote EXP041_RESULTS.json');

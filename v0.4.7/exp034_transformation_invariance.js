/**
 * EXP-034: Controlled Transformation Invariance of Block1/Block2
 *
 * Determine whether the validated Block1/Block2 token structures are
 * invariant under known geometric transformations (scale, translation)
 * when topology and feature state remain unchanged.
 *
 * Uses: C00 (baseline), C01 (scaled), C02 (translated).
 *
 * Do NOT modify parser/.
 * Do NOT assign semantic meaning to individual token values.
 * Do NOT assume invariance — characterize differences.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function parseFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  return parserCore.parseSLDPRT(buf, inflateRaw, inflateZlib);
}

function extractDisplayLists(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  const streams = parserCore.decompressOpenSX(buf, inflateRaw, inflateZlib);
  for (const [name, data] of Object.entries(streams)) {
    if (name.toLowerCase().indexOf('displaylist') !== -1 && data.length > 100) {
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (dv.getUint32(0, true) === 1 && dv.getUint32(4, true) === 1) {
        return Buffer.from(data);
      }
    }
  }
  return null;
}

function computeAverageNormal(normals, vertexCount) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < vertexCount; i++) {
    nx += normals[i * 3];
    ny += normals[i * 3 + 1];
    nz += normals[i * 3 + 2];
  }
  nx /= vertexCount;
  ny /= vertexCount;
  nz /= vertexCount;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return { nx: 0, ny: 0, nz: 0 };
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

function determineOrientation(normal, tolerance = 0.01) {
  const { nx, ny, nz } = normal;
  if (Math.abs(nx - 1) < tolerance && Math.abs(ny) < tolerance && Math.abs(nz) < tolerance) return '+X';
  if (Math.abs(nx + 1) < tolerance && Math.abs(ny) < tolerance && Math.abs(nz) < tolerance) return '-X';
  if (Math.abs(ny - 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(nz) < tolerance) return '+Y';
  if (Math.abs(ny + 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(nz) < tolerance) return '-Y';
  if (Math.abs(nz - 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(ny) < tolerance) return '+Z';
  if (Math.abs(nz + 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(ny) < tolerance) return '-Z';
  const absX = Math.abs(nx);
  const absY = Math.abs(ny);
  const absZ = Math.abs(nz);
  if (absX > 0.99 && absY < 0.01 && absZ < 0.01) return nx > 0 ? '+X' : '-X';
  if (absY > 0.99 && absX < 0.01 && absZ < 0.01) return ny > 0 ? '+Y' : '-Y';
  if (absZ > 0.99 && absX < 0.01 && absY < 0.01) return nz > 0 ? '+Z' : '-Z';
  return `NON_AXIS(${nx.toFixed(3)},${ny.toFixed(3)},${nz.toFixed(3)})`;
}

function classifyFaceType(face) {
  const { edgeCount: ec, vertexCount: vc, secCount } = face;
  if (secCount > 1) return 'multi_loop';
  if (ec === vc && secCount === 1 && vc > 20) return 'cylindrical';
  if (ec === 4 && vc === 4 && secCount === 1) return 'planar_cube';
  if (ec === 5 && vc === 5 && secCount === 1) return 'chamfer';
  if (secCount === 1) return 'planar_other';
  return 'unknown';
}

// ============================================================
// FACE MATCHING BETWEEN MODELS
// ============================================================

/**
 * Match faces between two models by orientation and face type.
 * For C00/C01/C02 (cubes), faces correspond by orientation.
 */
function matchFacesByOrientation(facesA, facesB) {
  const matches = [];
  const usedB = new Set();

  for (const faceA of facesA) {
    let bestMatch = -1;
    let bestScore = 0;

    for (let j = 0; j < facesB.length; j++) {
      if (usedB.has(j)) continue;
      const faceB = facesB[j];

      // Score based on orientation and face type match
      let score = 0;
      if (faceA.orientation === faceB.orientation) score += 0.5;
      if (faceA.faceType === faceB.faceType) score += 0.3;
      if (faceA.ec === faceB.ec) score += 0.1;
      if (faceA.vc === faceB.vc) score += 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = j;
      }
    }

    if (bestMatch >= 0 && bestScore > 0.5) {
      matches.push({ faceA: faceA.faceIndex, faceB: bestMatch, score: bestScore });
      usedB.add(bestMatch);
    } else {
      matches.push({ faceA: faceA.faceIndex, faceB: -1, score: 0 });
    }
  }

  return matches;
}

// ============================================================
// COMPARISON FUNCTIONS
// ============================================================

function compareArrays(a, b, label) {
  if (a.length !== b.length) {
    return { label, identical: false, reason: `length mismatch: ${a.length} vs ${b.length}` };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return { label, identical: false, reason: `diff at index ${i}: ${a[i]} vs ${b[i]}` };
    }
  }
  return { label, identical: true };
}

function compareFloatArrays(a, b, label, tolerance = 1e-6) {
  if (a.length !== b.length) {
    return { label, identical: false, reason: `length mismatch: ${a.length} vs ${b.length}` };
  }
  const diffs = [];
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tolerance) {
      diffs.push({ index: i, a: a[i], b: b[i], diff: Math.abs(a[i] - b[i]) });
    }
  }
  if (diffs.length === 0) {
    return { label, identical: true };
  }
  return {
    label,
    identical: false,
    reason: `${diffs.length} values differ`,
    diffs: diffs.slice(0, 10),
    maxDiff: Math.max(...diffs.map(d => d.diff)),
  };
}

function compareTokenSequences(a, b, label) {
  if (a.length !== b.length) {
    return { label, identical: false, reason: `length mismatch: ${a.length} vs ${b.length}` };
  }
  const diffs = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffs.push({ index: i, a: a[i], b: b[i] });
    }
  }
  if (diffs.length === 0) {
    return { label, identical: true, count: a.length };
  }
  return {
    label,
    identical: false,
    reason: `${diffs.length}/${a.length} tokens differ`,
    diffs,
    identicalTokens: a.length - diffs.length,
  };
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-034: Controlled Transformation Invariance of Block1/Block2');
console.log('==============================================================\n');

// Parse all three models
const modelNames = ['C00_cube_10mm', 'C01_cube_20mm', 'C02_cube_translated'];
const models = {};

for (const name of modelNames) {
  const modelDir = path.join(CORPUS_DIR, name);
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  if (!fs.existsSync(sldprtPath)) {
    console.log(`ERROR: ${sldprtPath} not found`);
    continue;
  }
  console.log(`Parsing ${name}...`);
  const result = parseFile(sldprtPath);
  const dl = extractDisplayLists(sldprtPath);

  models[name] = {
    faces: result.faces.map((face, idx) => {
      const normal = computeAverageNormal(face.normals, face.vertexCount);
      const orientation = determineOrientation(normal);
      return {
        faceIndex: idx,
        edgeCount: face.edgeCount,
        vertexCount: face.vertexCount,
        secCount: face.secCount,
        b1Len: face.b1Len,
        b1Header: Array.from(face.b1Header),
        b1BodyTokens: Array.from(face.b1Body),
        b2Header: Array.from(face.b2Header),
        b2Body: Array.from(face.b2Body),
        sectionLens: Array.from(face.sectionLens),
        loopSizes: Array.from(face.loopSizes),
        vertices: Array.from(face.vertices),
        normals: Array.from(face.normals),
        gap: Array.from(face.gap),
        faceType: classifyFaceType(face),
        orientation,
        // Source offsets
        markerOffset: face.markerOffset,
        faceStartOffset: face.faceStartOffset,
        verticesStart: face.verticesStart,
        gapStart: face.gapStart,
        normalsStart: face.normalsStart,
        block1Start: face.block1Start,
        block2Start: face.block2Start,
      };
    }),
    displayListsLength: dl ? dl.length : 0,
    displayListsBuffer: dl,
    stats: result.stats,
  };

  console.log(`  Faces: ${models[name].faces.length}, DL length: ${models[name].displayListsLength}`);
}

// ============================================================
// 1. BASIC STRUCTURAL COMPARISON
// ============================================================

console.log('\n\n1. BASIC STRUCTURAL COMPARISON');
console.log('==============================');

console.log('\nModel summaries:');
for (const [name, data] of Object.entries(models)) {
  console.log(`  ${name}: ${data.faces.length} faces, DL=${data.displayListsLength} bytes`);
  console.log(`    Stats: ${JSON.stringify(data.stats)}`);
}

// ============================================================
// 2. FACE-LEVEL COMPARISON
// ============================================================

console.log('\n\n2. FACE-LEVEL COMPARISON');
console.log('========================');

// C00 ↔ C01 (SCALE)
console.log('\n--- C00 (baseline) ↔ C01 (2x scale) ---');
const c00Faces = models['C00_cube_10mm'].faces;
const c01Faces = models['C01_cube_20mm'].faces;
const c02Faces = models['C02_cube_translated'].faces;

console.log(`C00: ${c00Faces.length} faces`);
console.log(`C01: ${c01Faces.length} faces`);
console.log(`C02: ${c02Faces.length} faces`);

// Compare face counts
console.log(`\nFace counts: C00=${c00Faces.length}, C01=${c01Faces.length}, C02=${c02Faces.length}`);
console.log(`All same count: ${c00Faces.length === c01Faces.length && c00Faces.length === c02Faces.length}`);

// ============================================================
// 3. STRUCTURAL PROPERTIES COMPARISON
// ============================================================

console.log('\n\n3. STRUCTURAL PROPERTIES (ec, vc, secCount, b1Len)');
console.log('==================================================');

console.log('\nC00 faces:');
for (const f of c00Faces) {
  console.log(`  Face ${f.faceIndex}: ec=${f.edgeCount} vc=${f.vertexCount} secCount=${f.secCount} b1Len=${f.b1Len} type=${f.faceType} orient=${f.orientation}`);
}

console.log('\nC01 faces:');
for (const f of c01Faces) {
  console.log(`  Face ${f.faceIndex}: ec=${f.edgeCount} vc=${f.vertexCount} secCount=${f.secCount} b1Len=${f.b1Len} type=${f.faceType} orient=${f.orientation}`);
}

console.log('\nC02 faces:');
for (const f of c02Faces) {
  console.log(`  Face ${f.faceIndex}: ec=${f.edgeCount} vc=${f.vertexCount} secCount=${f.secCount} b1Len=${f.b1Len} type=${f.faceType} orient=${f.orientation}`);
}

// Compare structural properties by face index
console.log('\nStructural comparison by face index:');
const maxFaces = Math.max(c00Faces.length, c01Faces.length, c02Faces.length);
const structuralResults = [];

for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) {
    console.log(`  Face ${i}: MISSING in one or more models`);
    continue;
  }

  const sameEc = f00.edgeCount === f01.edgeCount && f01.edgeCount === f02.edgeCount;
  const sameVc = f00.vertexCount === f01.vertexCount && f01.vertexCount === f02.vertexCount;
  const sameSec = f00.secCount === f01.secCount && f01.secCount === f02.secCount;
  const sameB1Len = f00.b1Len === f01.b1Len && f01.b1Len === f02.b1Len;

  const result = {
    faceIndex: i,
    orientation: f00.orientation,
    sameEc, sameVc, sameSec, sameB1Len,
    allSame: sameEc && sameVc && sameSec && sameB1Len,
  };
  structuralResults.push(result);

  if (!result.allSame) {
    console.log(`  Face ${i} (${f00.orientation}):`);
    console.log(`    ec: C00=${f00.edgeCount} C01=${f01.edgeCount} C02=${f02.edgeCount} same=${sameEc}`);
    console.log(`    vc: C00=${f00.vertexCount} C01=${f01.vertexCount} C02=${f02.vertexCount} same=${sameVc}`);
    console.log(`    secCount: C00=${f00.secCount} C01=${f01.secCount} C02=${f02.secCount} same=${sameSec}`);
    console.log(`    b1Len: C00=${f00.b1Len} C01=${f01.b1Len} C02=${f02.b1Len} same=${sameB1Len}`);
  }
}

const allStructuralSame = structuralResults.every(r => r.allSame);
console.log(`\nAll faces have identical structural properties: ${allStructuralSame}`);

// ============================================================
// 4. BLOCK1 HEADER COMPARISON
// ============================================================

console.log('\n\n4. BLOCK1 HEADER COMPARISON');
console.log('===========================');

console.log('\nBlock1 headers:');
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const same = JSON.stringify(f00.b1Header) === JSON.stringify(f01.b1Header) &&
               JSON.stringify(f01.b1Header) === JSON.stringify(f02.b1Header);

  if (i === 0 || !same) {
    console.log(`  Face ${i}: C00=${JSON.stringify(f00.b1Header)} C01=${JSON.stringify(f01.b1Header)} C02=${JSON.stringify(f02.b1Header)} same=${same}`);
  }
}

// Check all headers
let allB1HeadersSame = true;
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];
  if (!f00 || !f01 || !f02) continue;
  if (JSON.stringify(f00.b1Header) !== JSON.stringify(f01.b1Header) ||
      JSON.stringify(f01.b1Header) !== JSON.stringify(f02.b1Header)) {
    allB1HeadersSame = false;
    break;
  }
}
console.log(`\nAll Block1 headers identical: ${allB1HeadersSame}`);

// ============================================================
// 5. BLOCK1 BODY TOKEN COMPARISON
// ============================================================

console.log('\n\n5. BLOCK1 BODY TOKEN COMPARISON');
console.log('================================');

const b1BodyResults = [];

for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const comp00_01 = compareTokenSequences(f00.b1BodyTokens, f01.b1BodyTokens, `C00 vs C01 face ${i}`);
  const comp00_02 = compareTokenSequences(f00.b1BodyTokens, f02.b1BodyTokens, `C00 vs C02 face ${i}`);

  b1BodyResults.push({
    faceIndex: i,
    orientation: f00.orientation,
    c00vsC01: comp00_01,
    c00vsC02: comp00_02,
  });

  if (!comp00_01.identical || !comp00_02.identical) {
    console.log(`\nFace ${i} (${f00.orientation}):`);
    console.log(`  C00 vs C01: ${comp00_01.identical ? 'IDENTICAL' : comp00_01.reason}`);
    if (!comp00_01.identical && comp00_01.diffs) {
      console.log(`    Diffs: ${JSON.stringify(comp00_01.diffs.slice(0, 5))}`);
    }
    console.log(`  C00 vs C02: ${comp00_02.identical ? 'IDENTICAL' : comp00_02.reason}`);
    if (!comp00_02.identical && comp00_02.diffs) {
      console.log(`    Diffs: ${JSON.stringify(comp00_02.diffs.slice(0, 5))}`);
    }
  }
}

const allB1BodySame01 = b1BodyResults.every(r => r.c00vsC01.identical);
const allB1BodySame02 = b1BodyResults.every(r => r.c00vsC02.identical);
console.log(`\nAll Block1 bodies identical (C00 vs C01): ${allB1BodySame01}`);
console.log(`All Block1 bodies identical (C00 vs C02): ${allB1BodySame02}`);

// ============================================================
// 6. BLOCK2 HEADER COMPARISON
// ============================================================

console.log('\n\n6. BLOCK2 HEADER COMPARISON');
console.log('===========================');

console.log('\nBlock2 headers:');
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const same = JSON.stringify(f00.b2Header) === JSON.stringify(f01.b2Header) &&
               JSON.stringify(f01.b2Header) === JSON.stringify(f02.b2Header);

  if (i === 0 || !same) {
    console.log(`  Face ${i}: C00=${JSON.stringify(f00.b2Header)} C01=${JSON.stringify(f01.b2Header)} C02=${JSON.stringify(f02.b2Header)} same=${same}`);
  }
}

let allB2HeadersSame = true;
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];
  if (!f00 || !f01 || !f02) continue;
  if (JSON.stringify(f00.b2Header) !== JSON.stringify(f01.b2Header) ||
      JSON.stringify(f01.b2Header) !== JSON.stringify(f02.b2Header)) {
    allB2HeadersSame = false;
    break;
  }
}
console.log(`\nAll Block2 headers identical: ${allB2HeadersSame}`);

// ============================================================
// 7. BLOCK2 BODY COMPARISON
// ============================================================

console.log('\n\n7. BLOCK2 BODY COMPARISON');
console.log('=========================');

const b2BodyResults = [];

for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const comp00_01 = compareArrays(f00.b2Body, f01.b2Body, `C00 vs C01 face ${i}`);
  const comp00_02 = compareArrays(f00.b2Body, f02.b2Body, `C00 vs C02 face ${i}`);

  b2BodyResults.push({
    faceIndex: i,
    orientation: f00.orientation,
    c00vsC01: comp00_01,
    c00vsC02: comp00_02,
  });

  if (!comp00_01.identical || !comp00_02.identical) {
    console.log(`\nFace ${i} (${f00.orientation}):`);
    console.log(`  C00 vs C01: ${comp00_01.identical ? 'IDENTICAL' : comp00_01.reason}`);
    console.log(`  C00 vs C02: ${comp00_02.identical ? 'IDENTICAL' : comp00_02.reason}`);
  }
}

const allB2BodySame01 = b2BodyResults.every(r => r.c00vsC01.identical);
const allB2BodySame02 = b2BodyResults.every(r => r.c00vsC02.identical);
console.log(`\nAll Block2 bodies identical (C00 vs C01): ${allB2BodySame01}`);
console.log(`All Block2 bodies identical (C00 vs C02): ${allB2BodySame02}`);

// ============================================================
// 8. VERTEX COORDINATE COMPARISON
// ============================================================

console.log('\n\n8. VERTEX COORDINATE COMPARISON');
console.log('================================');

const vertexResults = [];

for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const comp00_01 = compareFloatArrays(f00.vertices, f01.vertices, `C00 vs C01 face ${i}`, 1e-4);
  const comp00_02 = compareFloatArrays(f00.vertices, f02.vertices, `C00 vs C02 face ${i}`, 1e-4);

  vertexResults.push({
    faceIndex: i,
    orientation: f00.orientation,
    c00vsC01: comp00_01,
    c00vsC02: comp00_02,
  });

  console.log(`\nFace ${i} (${f00.orientation}):`);
  console.log(`  C00 vs C01 (scale): ${comp00_01.identical ? 'IDENTICAL' : comp00_01.reason}`);
  if (!comp00_01.identical && comp00_01.maxDiff !== undefined) {
    console.log(`    Max diff: ${comp00_01.maxDiff.toFixed(6)}`);
  }
  console.log(`  C00 vs C02 (translate): ${comp00_02.identical ? 'IDENTICAL' : comp00_02.reason}`);
  if (!comp00_02.identical && comp00_02.maxDiff !== undefined) {
    console.log(`    Max diff: ${comp00_02.maxDiff.toFixed(6)}`);
  }

  // Show actual vertex values for first face
  if (i === 0) {
    console.log(`  C00 vertices (first 6): [${f00.vertices.slice(0, 6).map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`  C01 vertices (first 6): [${f01.vertices.slice(0, 6).map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`  C02 vertices (first 6): [${f02.vertices.slice(0, 6).map(v => v.toFixed(4)).join(', ')}]`);
  }
}

// Compute vertex ratios for scale analysis
console.log('\n\nVertex coordinate ratios (C01/C00) for first face:');
if (c00Faces[0] && c01Faces[0]) {
  const v00 = c00Faces[0].vertices;
  const v01 = c01Faces[0].vertices;
  const ratios = [];
  for (let i = 0; i < Math.min(12, v00.length); i++) {
    if (v00[i] !== 0) {
      ratios.push(v01[i] / v00[i]);
    }
  }
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  console.log(`  Ratios: [${ratios.map(r => r.toFixed(4)).join(', ')}]`);
  console.log(`  Average ratio: ${avgRatio.toFixed(4)}`);
}

// Compute vertex differences for translation analysis
console.log('\nVertex coordinate differences (C02-C00) for first face:');
if (c00Faces[0] && c02Faces[0]) {
  const v00 = c00Faces[0].vertices;
  const v02 = c02Faces[0].vertices;
  const diffs = [];
  for (let i = 0; i < Math.min(12, v00.length); i++) {
    diffs.push(v02[i] - v00[i]);
  }
  console.log(`  Diffs: [${diffs.map(d => d.toFixed(4)).join(', ')}]`);
}

// ============================================================
// 9. GAP MARKER COMPARISON
// ============================================================

console.log('\n\n9. GAP MARKER COMPARISON');
console.log('=========================');

let allGapSame = true;
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const same = JSON.stringify(f00.gap) === JSON.stringify(f01.gap) &&
               JSON.stringify(f01.gap) === JSON.stringify(f02.gap);

  if (!same) {
    allGapSame = false;
    console.log(`  Face ${i}: C00=${JSON.stringify(f00.gap)} C01=${JSON.stringify(f01.gap)} C02=${JSON.stringify(f02.gap)}`);
  }
}
console.log(`All gap markers identical: ${allGapSame}`);

// ============================================================
// 10. LOOP SIZES COMPARISON
// ============================================================

console.log('\n\n10. LOOP SIZES COMPARISON');
console.log('=========================');

let allLoopSame = true;
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const same = JSON.stringify(f00.loopSizes) === JSON.stringify(f01.loopSizes) &&
               JSON.stringify(f01.loopSizes) === JSON.stringify(f02.loopSizes);

  if (!same) {
    allLoopSame = false;
    console.log(`  Face ${i}: C00=${JSON.stringify(f00.loopSizes)} C01=${JSON.stringify(f01.loopSizes)} C02=${JSON.stringify(f02.loopSizes)}`);
  }
}
console.log(`All loop sizes identical: ${allLoopSame}`);

// ============================================================
// 11. SECTION LENS COMPARISON
// ============================================================

console.log('\n\n11. SECTION LENS COMPARISON');
console.log('===========================');

let allSectionLensSame = true;
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  const same = JSON.stringify(f00.sectionLens) === JSON.stringify(f01.sectionLens) &&
               JSON.stringify(f01.sectionLens) === JSON.stringify(f02.sectionLens);

  if (!same) {
    allSectionLensSame = false;
    console.log(`  Face ${i}: C00=${JSON.stringify(f00.sectionLens)} C01=${JSON.stringify(f01.sectionLens)} C02=${JSON.stringify(f02.sectionLens)}`);
  }
}
console.log(`All section lens identical: ${allSectionLensSame}`);

// ============================================================
// 12. MARKER OFFSETS COMPARISON
// ============================================================

console.log('\n\n12. MARKER OFFSETS COMPARISON');
console.log('=============================');

console.log('\nFace marker offsets:');
for (let i = 0; i < maxFaces; i++) {
  const f00 = c00Faces[i];
  const f01 = c01Faces[i];
  const f02 = c02Faces[i];

  if (!f00 || !f01 || !f02) continue;

  console.log(`  Face ${i}: C00=${f00.markerOffset} C01=${f01.markerOffset} C02=${f02.markerOffset}`);
}

// ============================================================
// 13. INVARIANT CROSS-CHECKS
// ============================================================

console.log('\n\n13. INVARIANT CROSS-CHECKS');
console.log('===========================');

// INV-005: Block1 header is [4, 8, 2, N]
console.log('\nINV-005 (Block1 header [4,8,2,N]):');
let inv005Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    if (f.b1Header[0] !== 4 || f.b1Header[1] !== 8 || f.b1Header[2] !== 2) {
      inv005Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: ${JSON.stringify(f.b1Header)}`);
    }
  }
}
console.log(`  All models pass: ${inv005Pass}`);

// INV-006: Block2 header is [4, 8, 2, M]
console.log('\nINV-006 (Block2 header [4,8,2,M]):');
let inv006Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    if (f.b2Header[0] !== 4 || f.b2Header[1] !== 8 || f.b2Header[2] !== 2) {
      inv006Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: ${JSON.stringify(f.b2Header)}`);
    }
  }
}
console.log(`  All models pass: ${inv006Pass}`);

// INV-008: Block1 body starts with ONE (value 1)
console.log('\nINV-008 (Block1 body starts with ONE):');
let inv008Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    if (f.b1BodyTokens.length === 0 || f.b1BodyTokens[0] !== 1) {
      inv008Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: first token = ${f.b1BodyTokens[0]}`);
    }
  }
}
console.log(`  All models pass: ${inv008Pass}`);

// INV-009: Block1 ONE count equals Block2 entry count
console.log('\nINV-009 (ONE count == secCount):');
let inv009Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    const oneCount = f.b1BodyTokens.filter(t => t === 1).length;
    if (oneCount !== f.secCount) {
      inv009Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: ONE count=${oneCount} secCount=${f.secCount}`);
    }
  }
}
console.log(`  All models pass: ${inv009Pass}`);

// INV-016: b1len = 2 * (vc - secCount)
console.log('\nINV-016 (b1Len = 2 * (vc - secCount)):');
let inv016Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    const expected = 2 * (f.vertexCount - f.secCount);
    if (f.b1Len !== expected) {
      inv016Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: b1Len=${f.b1Len} expected=${expected}`);
    }
  }
}
console.log(`  All models pass: ${inv016Pass}`);

// INV-017: sectionBodyTokenCount = Block2[i] - 1
console.log('\nINV-017 (sectionLens match b2Body-1):');
let inv017Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    let match = f.sectionLens.length === f.b2Body.length;
    if (match) {
      for (let i = 0; i < f.sectionLens.length; i++) {
        if (f.sectionLens[i] !== f.b2Body[i] - 1) {
          match = false;
          break;
        }
      }
    }
    if (!match) {
      inv017Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: sectionLens=${JSON.stringify(f.sectionLens)} b2Body=${JSON.stringify(f.b2Body)}`);
    }
  }
}
console.log(`  All models pass: ${inv017Pass}`);

// INV-018: sum(b2Body) == b1Len
console.log('\nINV-018 (sum(b2Body) == b1Len):');
let inv018Pass = true;
for (const [name, data] of Object.entries(models)) {
  for (const f of data.faces) {
    const sum = f.b2Body.reduce((a, b) => a + b, 0);
    if (sum !== f.b1Len) {
      inv018Pass = false;
      console.log(`  FAIL: ${name} face ${f.faceIndex}: sum=${sum} b1Len=${f.b1Len}`);
    }
  }
}
console.log(`  All models pass: ${inv018Pass}`);

// ============================================================
// 14. BYTE-LEVEL DIFFERENTIAL (DisplayLists)
// ============================================================

console.log('\n\n14. BYTE-LEVEL DIFFERENTIAL');
console.log('===========================');

function byteDiff(a, b) {
  const len = Math.min(a.length, b.length);
  const changed = [];
  let runStart = -1;

  for (let i = 0; i <= len; i++) {
    const differs = i < len && a[i] !== b[i];
    if (differs) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        changed.push({ start: runStart, end: i, length: i - runStart });
        runStart = -1;
      }
    }
  }

  if (a.length !== b.length) {
    changed.push({
      start: Math.min(a.length, b.length),
      end: Math.max(a.length, b.length),
      length: Math.abs(a.length - b.length),
      type: 'size_difference',
    });
  }

  return changed;
}

const dl00 = models['C00_cube_10mm'].displayListsBuffer;
const dl01 = models['C01_cube_20mm'].displayListsBuffer;
const dl02 = models['C02_cube_translated'].displayListsBuffer;

if (dl00 && dl01) {
  console.log('\nC00 vs C01 (scale):');
  console.log(`  DL sizes: C00=${dl00.length}, C01=${dl01.length}`);
  const changes01 = byteDiff(dl00, dl01);
  let totalChanged01 = 0;
  for (const c of changes01) {
    totalChanged01 += c.length;
  }
  console.log(`  Changed ranges: ${changes01.length}`);
  console.log(`  Total changed bytes: ${totalChanged01}`);
  console.log(`  Percent changed: ${(totalChanged01 / Math.max(dl00.length, dl01.length) * 100).toFixed(2)}%`);

  // Show changed ranges
  for (let ci = 0; ci < changes01.length; ci++) {
    const c = changes01[ci];
    if (c.type === 'size_difference') {
      console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes): SIZE DIFFERENCE`);
      continue;
    }
    console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes)`);
  }
}

if (dl00 && dl02) {
  console.log('\nC00 vs C02 (translate):');
  console.log(`  DL sizes: C00=${dl00.length}, C02=${dl02.length}`);
  const changes02 = byteDiff(dl00, dl02);
  let totalChanged02 = 0;
  for (const c of changes02) {
    totalChanged02 += c.length;
  }
  console.log(`  Changed ranges: ${changes02.length}`);
  console.log(`  Total changed bytes: ${totalChanged02}`);
  console.log(`  Percent changed: ${(totalChanged02 / Math.max(dl00.length, dl02.length) * 100).toFixed(2)}%`);

  for (let ci = 0; ci < changes02.length; ci++) {
    const c = changes02[ci];
    if (c.type === 'size_difference') {
      console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes): SIZE DIFFERENCE`);
      continue;
    }
    console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes)`);
  }
}

// ============================================================
// 15. SUMMARY STATISTICS
// ============================================================

console.log('\n\n15. SUMMARY');
console.log('===========');

console.log('\nInvariant checks:');
console.log(`  INV-005 (B1 header [4,8,2,N]): ${inv005Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-006 (B2 header [4,8,2,M]): ${inv006Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-008 (B1 starts with ONE): ${inv008Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-009 (ONE count == secCount): ${inv009Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-016 (b1Len = 2*(vc-secCount)): ${inv016Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-017 (sectionLens = b2Body-1): ${inv017Pass ? 'PASS' : 'FAIL'}`);
console.log(`  INV-018 (sum(b2Body) = b1Len): ${inv018Pass ? 'PASS' : 'FAIL'}`);

console.log('\nStructural property invariance:');
console.log(`  ec/vc/secCount/b1Len: ${allStructuralSame ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block1 headers: ${allB1HeadersSame ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block1 bodies (C00 vs C01): ${allB1BodySame01 ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block1 bodies (C00 vs C02): ${allB1BodySame02 ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block2 headers: ${allB2HeadersSame ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block2 bodies (C00 vs C01): ${allB2BodySame01 ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Block2 bodies (C00 vs C02): ${allB2BodySame02 ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Gap markers: ${allGapSame ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Loop sizes: ${allLoopSame ? 'IDENTICAL' : 'CHANGED'}`);
console.log(`  Section lens: ${allSectionLensSame ? 'IDENTICAL' : 'CHANGED'}`);

console.log('\nVertex coordinates:');
console.log(`  C00 vs C01 (scale): ${vertexResults.every(r => r.c00vsC01.identical) ? 'IDENTICAL' : 'CHANGED (expected)'}`);
console.log(`  C00 vs C02 (translate): ${vertexResults.every(r => r.c00vsC02.identical) ? 'IDENTICAL' : 'CHANGED (expected)'}`);

// ============================================================
// 16. HYPOTHESIS TESTING
// ============================================================

console.log('\n\n16. HYPOTHESIS TESTING');
console.log('======================');

// H1: Block1 tokens are invariant under scale
console.log('\nH1: Block1 tokens are invariant under scale');
const h1Result = allB1BodySame01;
console.log(`  Result: ${h1Result ? 'SUPPORTED' : 'FALSIFIED'}`);

// H2: Block1 tokens are invariant under translation
console.log('\nH2: Block1 tokens are invariant under translation');
const h2Result = allB1BodySame02;
console.log(`  Result: ${h2Result ? 'SUPPORTED' : 'FALSIFIED'}`);

// H3: Block2 is invariant under scale
console.log('\nH3: Block2 is invariant under scale');
const h3Result = allB2BodySame01;
console.log(`  Result: ${h3Result ? 'SUPPORTED' : 'FALSIFIED'}`);

// H4: Block2 is invariant under translation
console.log('\nH4: Block2 is invariant under translation');
const h4Result = allB2BodySame02;
console.log(`  Result: ${h4Result ? 'SUPPORTED' : 'FALSIFIED'}`);

// H5: Structural properties are invariant under geometric transformations
console.log('\nH5: Structural properties are invariant under geometric transformations');
const h5Result = allStructuralSame;
console.log(`  Result: ${h5Result ? 'SUPPORTED' : 'FALSIFIED'}`);

// H6: Vertex coordinates encode geometry (expected to change under scale/translate)
console.log('\nH6: Vertex coordinates encode geometry');
const h6Result = !vertexResults.every(r => r.c00vsC01.identical) || !vertexResults.every(r => r.c00vsC02.identical);
console.log(`  Result: ${h6Result ? 'SUPPORTED (expected)' : 'FALSIFIED (unexpected)'}`);

// ============================================================
// 17. RAW RESULTS
// ============================================================

const results = {
  timestamp: new Date().toISOString(),
  experiment: 'EXP-034',
  description: 'Controlled Transformation Invariance of Block1/Block2',
  models: modelNames,
  modelStats: Object.fromEntries(Object.entries(models).map(([name, data]) => [name, {
    faces: data.faces.length,
    displayListsLength: data.displayListsLength,
    stats: data.stats,
  }])),
  structuralInvariance: {
    allSame: allStructuralSame,
    byFace: structuralResults,
  },
  block1Invariance: {
    headers: allB1HeadersSame,
    bodiesC00vsC01: allB1BodySame01,
    bodiesC00vsC02: allB1BodySame02,
    bodyDetails: b1BodyResults,
  },
  block2Invariance: {
    headers: allB2HeadersSame,
    bodiesC00vsC01: allB2BodySame01,
    bodiesC00vsC02: allB2BodySame02,
    bodyDetails: b2BodyResults,
  },
  vertexInvariance: {
    scaleC00vsC01: vertexResults.every(r => r.c00vsC01.identical),
    translateC00vsC02: vertexResults.every(r => r.c00vsC02.identical),
    details: vertexResults,
  },
  otherInvariance: {
    gapMarkers: allGapSame,
    loopSizes: allLoopSame,
    sectionLens: allSectionLensSame,
  },
  invariantChecks: {
    INV005: inv005Pass,
    INV006: inv006Pass,
    INV008: inv008Pass,
    INV009: inv009Pass,
    INV016: inv016Pass,
    INV017: inv017Pass,
    INV018: inv018Pass,
  },
  hypothesisTests: {
    H1_block1_invariant_scale: h1Result,
    H2_block1_invariant_translate: h2Result,
    H3_block2_invariant_scale: h3Result,
    H4_block2_invariant_translate: h4Result,
    H5_structural_invariant: h5Result,
    H6_vertices_encode_geometry: h6Result,
  },
};

fs.writeFileSync(
  path.join(__dirname, 'EXP034_TRANSFORMATION_INVARIANCE.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n\nResults written to EXP034_TRANSFORMATION_INVARIANCE.json');

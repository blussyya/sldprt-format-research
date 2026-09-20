/**
 * EXP-027: Vertex Position Tracking Across Controlled Pairs
 *
 * Focuses on the cleanest differentials (C00↔C01 scale, C00↔C02 translation)
 * to determine exactly how known coordinate changes appear in the binary.
 *
 * Also parses STEP files for ground truth geometry correspondence.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

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

function parseFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  return parserCore.parseSLDPRT(buf, inflateRaw, inflateZlib);
}

function extractAllStreams(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  const streams = parserCore.decompressOpenSX(buf, inflateRaw, inflateZlib);
  const result = {};
  for (const [name, data] of Object.entries(streams)) {
    result[name] = Buffer.from(data);
  }
  return result;
}

// Parse STEP file for ground truth vertices
function parseSTEP(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vertices = [];
  const surfaces = [];
  const edges = [];
  
  // Extract CARTESIAN_POINT vertices
  const vertRegex = /CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*\)\s*\)/g;
  let match;
  while ((match = vertRegex.exec(content)) !== null) {
    vertices.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }
  
  // Extract ADVANCED_FACE count
  const faceRegex = /ADVANCED_FACE\s*\(/g;
  let faceCount = 0;
  while (faceRegex.exec(content)) faceCount++;
  
  // Extract EDGE_LOOP count
  const edgeLoopRegex = /EDGE_LOOP\s*\(/g;
  let edgeLoopCount = 0;
  while (edgeLoopRegex.exec(content)) edgeLoopCount++;
  
  return { vertices, faceCount, edgeLoopCount, rawLength: content.length };
}

// Parse STL for ground truth mesh (binary or ASCII)
function parseSTL(filePath) {
  const buf = fs.readFileSync(filePath);
  
  // Check if binary STL (header 80 bytes + u32 triangle count)
  if (buf.length >= 84) {
    const triCount = buf.readUInt32LE(80);
    const expectedSize = 84 + triCount * 50;
    if (expectedSize === buf.length) {
      // Binary STL
      const triangles = [];
      for (let i = 0; i < triCount; i++) {
        const off = 84 + i * 50;
        const normal = [buf.readFloatLE(off), buf.readFloatLE(off + 4), buf.readFloatLE(off + 8)];
        const v1 = [buf.readFloatLE(off + 12), buf.readFloatLE(off + 16), buf.readFloatLE(off + 20)];
        const v2 = [buf.readFloatLE(off + 24), buf.readFloatLE(off + 28), buf.readFloatLE(off + 32)];
        const v3 = [buf.readFloatLE(off + 36), buf.readFloatLE(off + 40), buf.readFloatLE(off + 44)];
        triangles.push({ normal, v1, v2, v3 });
      }
      return { triangleCount: triCount, triangles };
    }
  }
  
  // ASCII STL fallback
  const content = buf.toString('utf8');
  const facetRegex = /facet\s+normal\s+([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)\s+vertex\s+([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)\s+vertex\s+([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)\s+vertex\s+([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)/g;
  const triangles = [];
  let match;
  while ((match = facetRegex.exec(content)) !== null) {
    triangles.push({
      normal: [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])],
      v1: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])],
      v2: [parseFloat(match[7]), parseFloat(match[8]), parseFloat(match[9])],
      v3: [parseFloat(match[10]), parseFloat(match[11]), parseFloat(match[12])],
    });
  }
  
  return { triangleCount: triangles.length, triangles };
}

// ============================================================
// ANALYSIS
// ============================================================

console.log('=== EXP-027: Vertex Position Tracking ===\n');

// --- Parse STEP ground truth ---
console.log('--- STEP Ground Truth ---');
const stepPairs = [
  ['C00_cube_10mm', 'C01_cube_20mm', 'scale'],
  ['C00_cube_10mm', 'C02_cube_translated', 'translation'],
  ['C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'hole_diameter'],
  ['C04_cube_hole_5mm', 'C06_cube_hole_moved', 'hole_position'],
];

for (const [nameA, nameB, purpose] of stepPairs) {
  const stepA = parseSTEP(path.join(CORPUS_DIR, nameA, 'model.step'));
  const stepB = parseSTEP(path.join(CORPUS_DIR, nameB, 'model.step'));
  
  console.log(`\n  ${nameA} vs ${nameB} (${purpose}):`);
  console.log(`    STEP: ${stepA.vertices.length} vertices, ${stepA.faceCount} faces, ${stepA.edgeLoopCount} edge loops`);
  console.log(`    STEP: ${stepB.vertices.length} vertices, ${stepB.faceCount} faces, ${stepB.edgeLoopCount} edge loops`);
  
  // Show first few vertices
  console.log(`    ${nameA} first 4 vertices:`);
  for (let i = 0; i < Math.min(4, stepA.vertices.length); i++) {
    const v = stepA.vertices[i];
    console.log(`      [${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}]`);
  }
  console.log(`    ${nameB} first 4 vertices:`);
  for (let i = 0; i < Math.min(4, stepB.vertices.length); i++) {
    const v = stepB.vertices[i];
    console.log(`      [${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}]`);
  }
}

// --- Parse STL ground truth ---
console.log('\n\n--- STL Ground Truth ---');
for (const [nameA, nameB, purpose] of stepPairs) {
  const stlA = parseSTL(path.join(CORPUS_DIR, nameA, 'model.STL'));
  const stlB = parseSTL(path.join(CORPUS_DIR, nameB, 'model.STL'));
  
  console.log(`\n  ${nameA} vs ${nameB} (${purpose}):`);
  console.log(`    STL: ${stlA.triangleCount} triangles, ${stlB.triangleCount} triangles`);
  
  // Compute bounding box
  if (stlA.triangles.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const t of stlA.triangles) {
      for (const v of [t.v1, t.v2, t.v3]) {
        minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
        minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
      }
    }
    console.log(`    ${nameA} bounding box: X=[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Y=[${minY.toFixed(2)}, ${maxY.toFixed(2)}] Z=[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
  }
  if (stlB.triangles.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const t of stlB.triangles) {
      for (const v of [t.v1, t.v2, t.v3]) {
        minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
        minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
      }
    }
    console.log(`    ${nameB} bounding box: X=[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Y=[${minY.toFixed(2)}, ${maxY.toFixed(2)}] Z=[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
  }
}

// --- SLDPRT Face-Level Analysis ---
console.log('\n\n--- SLDPRT Face-Level Vertex Analysis ---');

const pairs = [
  ['C00_cube_10mm', 'C01_cube_20mm', 'scale'],
  ['C00_cube_10mm', 'C02_cube_translated', 'translation'],
  ['C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'hole_diameter'],
  ['C04_cube_hole_5mm', 'C06_cube_hole_moved', 'hole_position'],
  ['C00_cube_10mm', 'C03_cube_fillet_1mm', 'fillet'],
  ['C00_cube_10mm', 'C04_cube_hole_5mm', 'hole_introduction'],
  ['C07_cube_two_holes', 'C08_cube_second_hole_modified', 'second_hole_modified'],
  ['C00_cube_10mm', 'C09_cube_chamfer_1mm', 'chamfer'],
  ['C00_cube_10mm', 'C10_cube_shell_1mm', 'shell'],
];

const results = {};

for (const [nameA, nameB, purpose] of pairs) {
  console.log(`\n=== ${nameA} ↔ ${nameB} (${purpose}) ===`);
  
  const parseA = parseFile(path.join(CORPUS_DIR, nameA, 'model.SLDPRT'));
  const parseB = parseFile(path.join(CORPUS_DIR, nameB, 'model.SLDPRT'));
  
  console.log(`  Faces: ${nameA}=${parseA.faces.length}, ${nameB}=${parseB.faces.length}`);
  
  // For each face, show full vertex positions
  const pairResult = { nameA, nameB, purpose, facesA: [], facesB: [] };
  
  for (let i = 0; i < parseA.faces.length; i++) {
    const f = parseA.faces[i];
    // Get ALL vertices from the full Float32Array
    const fullVerts = [];
    for (let v = 0; v < f.vertexCount; v++) {
      fullVerts.push([
        f.vertices[v * 3],
        f.vertices[v * 3 + 1],
        f.vertices[v * 3 + 2],
      ]);
    }
    
    console.log(`\n  ${nameA} Face ${i}: ec=${f.edgeCount} vc=${f.vertexCount} b1Len=${f.b1Len} secCount=${f.secCount}`);
    console.log(`    Vertices (all ${f.vertexCount}):`);
    for (let v = 0; v < fullVerts.length; v++) {
      console.log(`      v${v}: [${fullVerts[v][0].toFixed(6)}, ${fullVerts[v][1].toFixed(6)}, ${fullVerts[v][2].toFixed(6)}]`);
    }
    
    pairResult.facesA.push({
      index: i, edgeCount: f.edgeCount, vertexCount: f.vertexCount,
      b1Len: f.b1Len, secCount: f.secCount, b2Body: f.b2Body,
      vertices: fullVerts, b1BodyPreview: f.b1BodyPreview,
    });
  }
  
  for (let i = 0; i < parseB.faces.length; i++) {
    const f = parseB.faces[i];
    const fullVerts = [];
    for (let v = 0; v < f.vertexCount; v++) {
      fullVerts.push([
        f.vertices[v * 3],
        f.vertices[v * 3 + 1],
        f.vertices[v * 3 + 2],
      ]);
    }
    
    console.log(`\n  ${nameB} Face ${i}: ec=${f.edgeCount} vc=${f.vertexCount} b1Len=${f.b1Len} secCount=${f.secCount}`);
    console.log(`    Vertices (all ${f.vertexCount}):`);
    for (let v = 0; v < fullVerts.length; v++) {
      console.log(`      v${v}: [${fullVerts[v][0].toFixed(6)}, ${fullVerts[v][1].toFixed(6)}, ${fullVerts[v][2].toFixed(6)}]`);
    }
    
    pairResult.facesB.push({
      index: i, edgeCount: f.edgeCount, vertexCount: f.vertexCount,
      b1Len: f.b1Len, secCount: f.secCount, b2Body: f.b2Body,
      vertices: fullVerts, b1BodyPreview: f.b1BodyPreview,
    });
  }
  
  // Compare corresponding faces
  if (parseA.faces.length === parseB.faces.length) {
    console.log(`\n  Vertex comparison (face-by-face):`);
    for (let i = 0; i < parseA.faces.length; i++) {
      const fA = parseA.faces[i];
      const fB = parseB.faces[i];
      if (fA.vertexCount !== fB.vertexCount) {
        console.log(`    Face ${i}: vc changed ${fA.vertexCount}→${fB.vertexCount}`);
        continue;
      }
      
      let maxDelta = 0;
      let deltaCount = 0;
      for (let v = 0; v < fA.vertexCount; v++) {
        for (let c = 0; c < 3; c++) {
          const delta = Math.abs(fA.vertices[v * 3 + c] - fB.vertices[v * 3 + c]);
          maxDelta = Math.max(maxDelta, delta);
          if (delta > 1e-6) deltaCount++;
        }
      }
      console.log(`    Face ${i}: max vertex delta = ${maxDelta.toFixed(6)}, ${deltaCount}/${fA.vertexCount * 3} components changed`);
    }
  }
  
  results[`${nameA}_vs_${nameB}`] = pairResult;
}

// Save detailed results
fs.writeFileSync(path.join(__dirname, 'VERTEX_ANALYSIS.json'), JSON.stringify(results, null, 2));
console.log('\n\nResults saved to VERTEX_ANALYSIS.json');

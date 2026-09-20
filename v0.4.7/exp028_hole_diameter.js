/**
 * EXP-028 Investigation 1: Hole-Diameter Relationship
 *
 * Uses C04 ↔ C05 as the primary controlled differential.
 * Determines how vertexCount changes with hole diameter.
 *
 * Key question: Is the relationship linear, or consistent with
 * tessellation/chord-error rules?
 *
 * Only 2 diameter values exist (5mm and 3mm) — insufficient to
 * establish linearity. We explicitly state this limitation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

function parseFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  return parserCore.parseSLDPRT(buf, inflateRaw, inflateZlib);
}

function parseSTEP(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vertices = [];
  const circles = [];
  const cylinders = [];
  const faces = [];
  
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
  
  // Extract CIRCLE entities (for hole diameter)
  const circleRegex = /CIRCLE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*#\d+\s*,\s*([-\d.E+]+)\s*\)/g;
  while ((match = circleRegex.exec(content)) !== null) {
    circles.push({ radius: parseFloat(match[1]) });
  }
  
  // Extract CYLINDRICAL_SURFACE entities
  const cylRegex = /CYLINDRICAL_SURFACE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*([-\d.E+]+)\s*\)/g;
  while ((match = cylRegex.exec(content)) !== null) {
    cylinders.push({ radius: parseFloat(match[1]) });
  }
  
  // Extract ADVANCED_FACE count
  const faceRegex = /ADVANCED_FACE\s*\(/g;
  let faceCount = 0;
  while (faceRegex.exec(content)) faceCount++;
  
  return { vertices, circles, cylinders, faceCount };
}

function parseSTL(filePath) {
  const buf = fs.readFileSync(filePath);
  
  // Binary STL
  if (buf.length >= 84) {
    const triCount = buf.readUInt32LE(80);
    const expectedSize = 84 + triCount * 50;
    if (expectedSize === buf.length) {
      const vertices = new Set();
      const triangles = [];
      for (let i = 0; i < triCount; i++) {
        const off = 84 + i * 50;
        const normal = [buf.readFloatLE(off), buf.readFloatLE(off + 4), buf.readFloatLE(off + 8)];
        const v1 = [buf.readFloatLE(off + 12), buf.readFloatLE(off + 16), buf.readFloatLE(off + 20)];
        const v2 = [buf.readFloatLE(off + 24), buf.readFloatLE(off + 28), buf.readFloatLE(off + 32)];
        const v3 = [buf.readFloatLE(off + 36), buf.readFloatLE(off + 40), buf.readFloatLE(off + 44)];
        triangles.push({ normal, v1, v2, v3 });
        vertices.add(`${v1[0].toFixed(6)},${v1[1].toFixed(6)},${v1[2].toFixed(6)}`);
        vertices.add(`${v2[0].toFixed(6)},${v2[1].toFixed(6)},${v2[2].toFixed(6)}`);
        vertices.add(`${v3[0].toFixed(6)},${v3[1].toFixed(6)},${v3[2].toFixed(6)}`);
      }
      return { triangleCount: triCount, triangles, uniqueVertexCount: vertices.size };
    }
  }
  
  return { triangleCount: 0, triangles: [], uniqueVertexCount: 0 };
}

// ============================================================
// ANALYSIS
// ============================================================

console.log('=== EXP-028 Investigation 1: Hole-Diameter Relationship ===\n');

// --- Parse C04 and C05 ---
const models = ['C04_cube_hole_5mm', 'C05_cube_hole_3mm'];
const diameters = { 'C04_cube_hole_5mm': 5.0, 'C05_cube_hole_3mm': 3.0 };

const results = {};

for (const model of models) {
  console.log(`\n--- ${model} ---`);
  
  const sldprt = parseFile(path.join(CORPUS_DIR, model, 'model.SLDPRT'));
  const step = parseSTEP(path.join(CORPUS_DIR, model, 'model.step'));
  const stl = parseSTL(path.join(CORPUS_DIR, model, 'model.STL'));
  
  console.log(`  SLDPRT faces: ${sldprt.faces.length}`);
  console.log(`  STEP vertices: ${step.vertices.length}, circles: ${step.circles.length}, cylinders: ${step.cylinders.length}`);
  console.log(`  STL triangles: ${stl.triangleCount}, unique vertices: ${stl.uniqueVertexCount}`);
  
  // Show STEP circle/cylinder radii
  if (step.circles.length > 0) {
    console.log(`  STEP circle radii: ${step.circles.map(c => c.radius.toFixed(4)).join(', ')}`);
  }
  if (step.cylinders.length > 0) {
    console.log(`  STEP cylinder radii: ${step.cylinders.map(c => c.radius.toFixed(4)).join(', ')}`);
  }
  
  // Analyze each SLDPRT face
  console.log(`\n  SLDPRT face details:`);
  const faceData = [];
  
  for (const face of sldprt.faces) {
    const fd = {
      index: face.index,
      ec: face.edgeCount,
      vc: face.vertexCount,
      b1Len: face.b1Len,
      secCount: face.secCount,
      b2Body: face.b2Body,
      loopSizes: face.loopSizes,
      sectionLens: face.sectionLens,
    };
    
    // Extract vertex positions
    const verts = [];
    for (let v = 0; v < face.vertexCount; v++) {
      verts.push([
        face.vertices[v * 3],
        face.vertices[v * 3 + 1],
        face.vertices[v * 3 + 2],
      ]);
    }
    fd.vertices = verts;
    
    // Check if this face contains circular geometry
    // Look for vertices that lie on a circle
    const hasCircularVerts = detectCircularVertices(verts);
    fd.hasCircularGeometry = hasCircularVerts.circular;
    fd.estimatedRadius = hasCircularVerts.radius;
    fd.circularVertexIndices = hasCircularVerts.indices;
    
    faceData.push(fd);
    
    console.log(`    Face ${face.index}: ec=${face.edgeCount} vc=${face.vertexCount} b1Len=${face.b1Len} secCount=${face.secCount}`);
    if (hasCircularVerts.circular) {
      console.log(`      Circular geometry detected: radius≈${hasCircularVerts.radius.toFixed(6)} (${(hasCircularVerts.radius * 2).toFixed(6)}mm diameter)`);
      console.log(`      Circular vertices: ${hasCircularVerts.indices.length}/${face.vertexCount}`);
    }
  }
  
  results[model] = {
    diameter: diameters[model],
    step: {
      circles: step.circles,
      cylinders: step.cylinders,
      faceCount: step.faceCount,
    },
    stl: {
      triangleCount: stl.triangleCount,
      uniqueVertexCount: stl.uniqueVertexCount,
    },
    faces: faceData,
  };
}

// --- Compare C04 and C05 ---
console.log('\n\n--- Comparison: C04 (5mm) vs C05 (3mm) ---');

const c04 = results['C04_cube_hole_5mm'];
const c05 = results['C05_cube_hole_3mm'];

console.log(`\n  Diameter: ${c04.diameter}mm vs ${c05.diameter}mm`);
console.log(`  STEP circles: ${c04.step.circles.length} vs ${c05.step.circles.length}`);
console.log(`  STEP cylinders: ${c04.step.cylinders.length} vs ${c05.step.cylinders.length}`);
console.log(`  STL triangles: ${c04.stl.triangleCount} vs ${c05.stl.triangleCount}`);
console.log(`  STL unique vertices: ${c04.stl.uniqueVertexCount} vs ${c05.stl.uniqueVertexCount}`);

// Find cylindrical faces (high vc, circular geometry)
console.log('\n  Cylindrical face identification:');
for (const model of ['C04_cube_hole_5mm', 'C05_cube_hole_3mm']) {
  const data = results[model];
  const cylFaces = data.faces.filter(f => f.hasCircularGeometry && f.ec > 10);
  console.log(`    ${model}: ${cylFaces.length} candidate cylindrical faces`);
  for (const f of cylFaces) {
    console.log(`      Face ${f.index}: ec=${f.ec} vc=${f.vc} radius≈${f.estimatedRadius.toFixed(6)}`);
  }
}

// Analyze vc vs diameter relationship
console.log('\n  Vertex count vs diameter analysis:');
const c04CylFaces = c04.faces.filter(f => f.hasCircularGeometry && f.ec > 10);
const c05CylFaces = c05.faces.filter(f => f.hasCircularGeometry && f.ec > 10);

if (c04CylFaces.length > 0 && c05CylFaces.length > 0) {
  const c04Vc = c04CylFaces[0].vc;
  const c05Vc = c05CylFaces[0].vc;
  const ratio = c04Vc / c05Vc;
  const diameterRatio = c04.diameter / c05.diameter;
  
  console.log(`    C04 cylindrical vc: ${c04Vc}`);
  console.log(`    C05 cylindrical vc: ${c05Vc}`);
  console.log(`    vc ratio (C04/C05): ${ratio.toFixed(4)}`);
  console.log(`    diameter ratio (C04/C05): ${diameterRatio.toFixed(4)}`);
  console.log(`    Linear scaling prediction: vc ∝ diameter → ratio should be ${diameterRatio.toFixed(4)}`);
  console.log(`    Actual ratio: ${ratio.toFixed(4)}`);
  
  if (Math.abs(ratio - diameterRatio) < 0.01) {
    console.log(`    Result: CONSISTENT with linear scaling (within 1%)`);
  } else {
    console.log(`    Result: NOT consistent with linear scaling (difference: ${Math.abs(ratio - diameterRatio).toFixed(4)})`);
  }
  
  // Check if chord-error tessellation could explain the difference
  // Chord error: e = r * (1 - cos(θ/2)), where θ = 2π/n
  // For constant chord error, n ∝ r
  console.log('\n  Chord-error tessellation analysis:');
  console.log(`    If vc ∝ circumference (constant chord error), then vc ∝ diameter`);
  console.log(`    This is mathematically equivalent to linear scaling`);
  console.log(`    Cannot distinguish linear scaling from constant-chord-error tessellation`);
  console.log(`    with only 2 data points`);
  
  // Check if vc ∝ √area (constant area per triangle)
  const areaRatio = Math.sqrt((c04.diameter * c04.diameter) / (c05.diameter * c05.diameter));
  console.log(`    If vc ∝ √area (constant area per triangle), ratio should be ${areaRatio.toFixed(4)}`);
  console.log(`    Actual ratio: ${ratio.toFixed(4)}`);
  if (Math.abs(ratio - areaRatio) < 0.01) {
    console.log(`    Result: CONSISTENT with constant-area tessellation (within 1%)`);
  } else {
    console.log(`    Result: NOT consistent with constant-area tessellation (difference: ${Math.abs(ratio - areaRatio).toFixed(4)})`);
  }
}

// Analyze top/bottom face vc changes
console.log('\n  Top/bottom face vertex count analysis:');
const c04TopFaces = c04.faces.filter(f => f.vc > 4 && f.vc < 100);
const c05TopFaces = c05.faces.filter(f => f.vc > 4 && f.vc < 100);

for (const face of c04TopFaces) {
  console.log(`    C04 Face ${face.index}: ec=${face.ec} vc=${face.vc} loops=${face.loopSizes ? face.loopSizes.length : 'unknown'}`);
}
for (const face of c05TopFaces) {
  console.log(`    C05 Face ${face.index}: ec=${face.ec} vc=${face.vc} loops=${face.loopSizes ? face.loopSizes.length : 'unknown'}`);
}

// Check C07/C08 for additional diameter data points
console.log('\n  Checking C07/C08 for additional data points:');
const c07 = parseFile(path.join(CORPUS_DIR, 'C07_cube_two_holes', 'model.SLDPRT'));
const c08 = parseFile(path.join(CORPUS_DIR, 'C08_cube_second_hole_modified', 'model.SLDPRT'));

console.log(`    C07 faces: ${c07.faces.length}`);
console.log(`    C08 faces: ${c08.faces.length}`);

// Find cylindrical faces in C07/C08
const c07CylFaces = c07.faces.filter(f => f.edgeCount > 10);
const c08CylFaces = c08.faces.filter(f => f.edgeCount > 10);

console.log(`    C07 cylindrical candidates: ${c07CylFaces.length}`);
for (const f of c07CylFaces) {
  console.log(`      Face ${f.index}: ec=${f.edgeCount} vc=${f.vertexCount}`);
}

console.log(`    C08 cylindrical candidates: ${c08CylFaces.length}`);
for (const f of c08CylFaces) {
  console.log(`      Face ${f.index}: ec=${f.edgeCount} vc=${f.vertexCount}`);
}

// Save results
const outputPath = path.join(__dirname, 'EXP028_HOLE_DIAMETER.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n\nResults saved to ${outputPath}`);

// ============================================================
// Helper function to detect circular vertices
// ============================================================

function detectCircularVertices(vertices) {
  if (vertices.length < 3) {
    return { circular: false, radius: 0, indices: [] };
  }
  
  // Check if all vertices lie on a circle
  // Method: Compute centroid, then check if all vertices are equidistant from centroid
  
  // Compute centroid (project to 2D by ignoring the constant coordinate)
  let constAxis = -1;
  const coords = [0, 1, 2];
  for (const axis of coords) {
    const vals = vertices.map(v => v[axis]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max - min < 0.0001) {
      constAxis = axis;
      break;
    }
  }
  
  if (constAxis === -1) {
    return { circular: false, radius: 0, indices: [] };
  }
  
  // Project to 2D
  const axes = coords.filter(a => a !== constAxis);
  const projected = vertices.map(v => [v[axes[0]], v[axes[1]]]);
  
  // Compute centroid
  let cx = 0, cy = 0;
  for (const [x, y] of projected) {
    cx += x;
    cy += y;
  }
  cx /= projected.length;
  cy /= projected.length;
  
  // Compute distances from centroid
  const distances = projected.map(([x, y]) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2));
  const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  // Check if all distances are close to average
  const maxDeviation = Math.max(...distances.map(d => Math.abs(d - avgRadius)));
  const circular = maxDeviation < 0.001 && avgRadius > 0.001;
  
  return {
    circular,
    radius: avgRadius,
    indices: circular ? vertices.map((_, i) => i) : [],
    maxDeviation,
  };
}

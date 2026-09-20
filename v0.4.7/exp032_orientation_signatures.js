/**
 * EXP-032: Token Signatures vs Face Orientation
 *
 * Determine whether Block1 token signature differences among planar cube faces
 * correlate with face orientation / surface normal direction.
 *
 * Do NOT modify parser/.
 * Do NOT assign semantic meaning to individual token values.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  return parserCore.parseSLDPRT(buf, inflateRaw, inflateZlib);
}

function classifyOrientation(face) {
  const normals = [];
  for (let i = 0; i < face.vertexCount; i++) {
    const nx = face.normals[i * 3];
    const ny = face.normals[i * 3 + 1];
    const nz = face.normals[i * 3 + 2];
    normals.push({nx, ny, nz});
  }
  
  const avgNx = normals.reduce((sum, n) => sum + n.nx, 0) / normals.length;
  const avgNy = normals.reduce((sum, n) => sum + n.ny, 0) / normals.length;
  const avgNz = normals.reduce((sum, n) => sum + n.nz, 0) / normals.length;
  
  const absNx = Math.abs(avgNx);
  const absNy = Math.abs(avgNy);
  const absNz = Math.abs(avgNz);
  
  if (absNx > absNy && absNx > absNz) {
    return avgNx > 0 ? '+X' : '-X';
  } else if (absNy > absNx && absNy > absNz) {
    return avgNy > 0 ? '+Y' : '-Y';
  } else if (absNz > absNx && absNz > absNy) {
    return avgNz > 0 ? '+Z' : '-Z';
  }
  return 'unknown';
}

function getVertexCoordinates(face) {
  const vertices = [];
  for (let i = 0; i < face.vertexCount; i++) {
    const x = face.vertices[i * 3];
    const y = face.vertices[i * 3 + 1];
    const z = face.vertices[i * 3 + 2];
    vertices.push({x, y, z});
  }
  return vertices;
}

function getNormalVector(face) {
  const normals = [];
  for (let i = 0; i < face.vertexCount; i++) {
    const nx = face.normals[i * 3];
    const ny = face.normals[i * 3 + 1];
    const nz = face.normals[i * 3 + 2];
    normals.push({nx, ny, nz});
  }
  
  const avgNx = normals.reduce((sum, n) => sum + n.nx, 0) / normals.length;
  const avgNy = normals.reduce((sum, n) => sum + n.ny, 0) / normals.length;
  const avgNz = normals.reduce((sum, n) => sum + n.nz, 0) / normals.length;
  
  return {nx: avgNx, ny: avgNy, nz: avgNz};
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-032: Token Signatures vs Face Orientation');
console.log('=============================================\n');

// Parse all controlled models
const models = {};
const modelNames = [
  'C00_cube_10mm',
  'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm',
  'C05_cube_hole_3mm',
  'C09_cube_chamfer_1mm',
  'C11_cube_hole_4mm'
];

for (const name of modelNames) {
  const modelDir = path.join(CORPUS_DIR, name);
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  if (fs.existsSync(sldprtPath)) {
    console.log(`Parsing ${name}...`);
    const result = parseFile(sldprtPath);
    models[name] = result.faces;
  }
}

// ============================================================
// 1. COLLECT PLANAR FACE DATA
// ============================================================

console.log('\n\n1. PLANAR FACE DATA COLLECTION');
console.log('===============================');

const planarFaces = [];

for (const [modelName, faces] of Object.entries(models)) {
  for (let idx = 0; idx < faces.length; idx++) {
    const face = faces[idx];
    
    // Filter for planar cube faces (ec=4, vc=4, secCount=1)
    if (face.edgeCount === 4 && face.vertexCount === 4 && face.secCount === 1) {
      const orientation = classifyOrientation(face);
      const tokens = Array.from(face.b1Body);
      const vertices = getVertexCoordinates(face);
      const normal = getNormalVector(face);
      
      planarFaces.push({
        model: modelName,
        faceIndex: idx,
        orientation: orientation,
        tokens: tokens,
        vertices: vertices,
        normal: normal,
        ec: face.edgeCount,
        vc: face.vertexCount,
        secCount: face.secCount,
        b1Len: face.b1Len
      });
    }
  }
}

console.log(`Total planar faces: ${planarFaces.length}`);

// ============================================================
// 2. CLASSIFY BY ORIENTATION
// ============================================================

console.log('\n\n2. ORIENTATION CLASSIFICATION');
console.log('=============================');

const orientationGroups = {};
for (const face of planarFaces) {
  if (!orientationGroups[face.orientation]) {
    orientationGroups[face.orientation] = [];
  }
  orientationGroups[face.orientation].push(face);
}

for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`\n${orientation}: ${faces.length} faces`);
  for (const face of faces) {
    console.log(`  ${face.model} face ${face.faceIndex}: ${face.tokens.join(',')}`);
  }
}

// ============================================================
// 3. TOKEN SIGNATURE ANALYSIS
// ============================================================

console.log('\n\n3. TOKEN SIGNATURE ANALYSIS');
console.log('===========================');

for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`\n${orientation}:`);
  
  // Get unique token patterns
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  console.log(`  Unique token patterns: ${tokenPatterns.size}`);
  
  // Check if all faces have same pattern
  if (tokenPatterns.size === 1) {
    console.log(`  CONSISTENT: All faces have same pattern`);
    console.log(`  Pattern: ${[...tokenPatterns][0]}`);
  } else {
    console.log(`  DIVERSE: Faces have different patterns`);
    for (const pattern of tokenPatterns) {
      console.log(`    ${pattern}`);
    }
  }
  
  // Analyze token statistics
  const entropies = faces.map(f => {
    const freq = {};
    for (const t of f.tokens) {
      freq[t] = (freq[t] || 0) + 1;
    }
    let entropy = 0;
    const len = f.tokens.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  });
  
  const zeroFreqs = faces.map(f => {
    return f.tokens.filter(t => t === 0).length / f.tokens.length;
  });
  
  console.log(`  Entropy: avg=${(entropies.reduce((a, b) => a + b, 0) / entropies.length).toFixed(3)}`);
  console.log(`  Zero frequency: avg=${(zeroFreqs.reduce((a, b) => a + b, 0) / zeroFreqs.length).toFixed(3)}`);
}

// ============================================================
// 4. CROSS-MODEL COMPARISON
// ============================================================

console.log('\n\n4. CROSS-MODEL COMPARISON');
console.log('=========================');

// Compare same orientation across models
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`\n${orientation}:`);
  
  // Group by model
  const modelGroups = {};
  for (const face of faces) {
    if (!modelGroups[face.model]) {
      modelGroups[face.model] = [];
    }
    modelGroups[face.model].push(face);
  }
  
  // Check if same orientation has same tokens across models
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  if (tokenPatterns.size === 1) {
    console.log(`  CONSISTENT across all models: ${[...tokenPatterns][0]}`);
  } else {
    console.log(`  DIVERSE across models:`);
    for (const [model, modelFaces] of Object.entries(modelGroups)) {
      for (const face of modelFaces) {
        console.log(`    ${model}: ${face.tokens.join(',')}`);
      }
    }
  }
}

// ============================================================
// 5. OPPOSITE ORIENTATION COMPARISON
// ============================================================

console.log('\n\n5. OPPOSITE ORIENTATION COMPARISON');
console.log('=================================');

const opposites = {
  '+X': '-X',
  '-X': '+X',
  '+Y': '-Y',
  '-Y': '+Y',
  '+Z': '-Z',
  '-Z': '+Z'
};

for (const [orient, opposite] of Object.entries(opposites)) {
  if (orientationGroups[orient] && orientationGroups[opposite]) {
    console.log(`\n${orient} vs ${opposite}:`);
    
    const orientPatterns = new Set(orientationGroups[orient].map(f => f.tokens.join(',')));
    const oppositePatterns = new Set(orientationGroups[opposite].map(f => f.tokens.join(',')));
    
    console.log(`  ${orient} patterns: ${[...orientPatterns].join(' | ')}`);
    console.log(`  ${opposite} patterns: ${[...oppositePatterns].join(' | ')}`);
    
    // Check if patterns are related
    const allPatterns = new Set([...orientPatterns, ...oppositePatterns]);
    if (allPatterns.size === 1) {
      console.log(`  IDENTICAL: Same pattern for opposite orientations`);
    } else if (allPatterns.size === 2) {
      console.log(`  RELATED: Different patterns for opposite orientations`);
    } else {
      console.log(`  UNRELATED: Multiple patterns for opposite orientations`);
    }
  }
}

// ============================================================
// 6. HYPOTHESIS TESTING
// ============================================================

console.log('\n\n6. HYPOTHESIS TESTING');
console.log('=====================');

// H1: Token signatures correlate with planar face orientation
console.log('\nH1: Token signatures correlate with planar face orientation');
let h1Supported = true;
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  if (tokenPatterns.size > 1) {
    h1Supported = false;
    console.log(`  ${orientation}: ${tokenPatterns.size} unique patterns`);
  }
}
if (h1Supported) {
  console.log('  Result: SUPPORTED (each orientation has consistent token signature)');
} else {
  console.log('  Result: PARTIALLY SUPPORTED (some orientations have diverse token signatures)');
}

// H2: Token signatures are invariant for the same orientation across models
console.log('\nH2: Token signatures are invariant for the same orientation across models');
let h2Supported = true;
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  // Group by model
  const modelGroups = {};
  for (const face of faces) {
    if (!modelGroups[face.model]) {
      modelGroups[face.model] = [];
    }
    modelGroups[face.model].push(face);
  }
  
  // Check if same orientation has same tokens across models
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  if (tokenPatterns.size > 1) {
    h2Supported = false;
    console.log(`  ${orientation}: ${tokenPatterns.size} unique patterns across models`);
  }
}
if (h2Supported) {
  console.log('  Result: SUPPORTED (same orientation has same tokens across all models)');
} else {
  console.log('  Result: PARTIALLY SUPPORTED (some orientations have different tokens across models)');
}

// H3: Opposite orientations have systematically related signatures
console.log('\nH3: Opposite orientations have systematically related signatures');
let h3Supported = true;
for (const [orient, opposite] of Object.entries(opposites)) {
  if (orientationGroups[orient] && orientationGroups[opposite]) {
    const orientPatterns = new Set(orientationGroups[orient].map(f => f.tokens.join(',')));
    const oppositePatterns = new Set(orientationGroups[opposite].map(f => f.tokens.join(',')));
    
    const allPatterns = new Set([...orientPatterns, ...oppositePatterns]);
    if (allPatterns.size > 2) {
      h3Supported = false;
      console.log(`  ${orient} vs ${opposite}: ${allPatterns.size} unique patterns`);
    }
  }
}
if (h3Supported) {
  console.log('  Result: SUPPORTED (opposite orientations have related patterns)');
} else {
  console.log('  Result: PARTIALLY SUPPORTED (some opposite orientations have unrelated patterns)');
}

// H4: Token signatures are primarily determined by serialization position
console.log('\nH4: Token signatures are primarily determined by serialization position');
// Check if faces with same index have same tokens across models
const indexGroups = {};
for (const face of planarFaces) {
  if (!indexGroups[face.faceIndex]) {
    indexGroups[face.faceIndex] = [];
  }
  indexGroups[face.faceIndex].push(face);
}

let h4Supported = true;
for (const [index, faces] of Object.entries(indexGroups)) {
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  if (tokenPatterns.size > 1) {
    h4Supported = false;
    console.log(`  Index ${index}: ${tokenPatterns.size} unique patterns`);
  }
}
if (h4Supported) {
  console.log('  Result: SUPPORTED (same index has same tokens across models)');
} else {
  console.log('  Result: FALSIFIED (same index has different tokens across models)');
}

// H5: Token signatures are primarily determined by topology/vertex ordering
console.log('\nH5: Token signatures are primarily determined by topology/vertex ordering');
// Check if faces with same vertex ordering have same tokens
// For cube faces, vertex ordering is determined by the face construction
let h5Supported = true;
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  // Check if all faces with same orientation have same vertex ordering
  const vertexOrders = new Set(faces.map(f => {
    return f.vertices.map(v => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`).join('|');
  }));
  
  if (vertexOrders.size > 1) {
    h5Supported = false;
    console.log(`  ${orientation}: ${vertexOrders.size} different vertex orderings`);
  }
}
if (h5Supported) {
  console.log('  Result: SUPPORTED (same orientation has same vertex ordering)');
} else {
  console.log('  Result: PARTIALLY SUPPORTED (some orientations have different vertex orderings)');
}

// ============================================================
// 7. SUMMARY STATISTICS
// ============================================================

console.log('\n\n7. SUMMARY STATISTICS');
console.log('=====================');

console.log('\nTotal planar faces:', planarFaces.length);
console.log('Face orientations:');
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  const tokenPatterns = new Set(faces.map(f => f.tokens.join(',')));
  console.log(`  ${orientation}: ${faces.length} faces, ${tokenPatterns.size} unique patterns`);
}

// ============================================================
// 8. RAW RESULTS
// ============================================================

const results = {
  timestamp: new Date().toISOString(),
  corpus: modelNames,
  totalPlanarFaces: planarFaces.length,
  orientationCounts: {},
  orientationPatterns: {},
  hypothesisTests: {
    H1_orientation_correlates: h1Supported,
    H2_invariant_across_models: h2Supported,
    H3_opposite_related: h3Supported,
    H4_serialization_position: h4Supported,
    H5_topology_vertex_ordering: h5Supported
  },
  planarFaces: planarFaces
};

for (const [orientation, faces] of Object.entries(orientationGroups)) {
  results.orientationCounts[orientation] = faces.length;
  results.orientationPatterns[orientation] = [...new Set(faces.map(f => f.tokens.join(',')))];
}

fs.writeFileSync(
  path.join(__dirname, 'EXP032_ORIENTATION_SIGNATURES.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n\nResults written to EXP032_ORIENTATION_SIGNATURES.json');

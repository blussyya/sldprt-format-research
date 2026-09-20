/**
 * EXP-032: Token Signatures vs Face Orientation
 *
 * Determine whether Block1 token signature differences observed among
 * planar cube faces correlate with face orientation / surface normal direction.
 *
 * Do NOT modify parser/.
 * Do NOT assign semantic meaning to individual token values.
 * Do NOT infer orientation from Block1 tokens themselves.
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

// Compute face normal from vertices (using Newell's method for planar faces)
function computeFaceNormal(vertices, vertexCount) {
  // Use Newell's method to compute face normal
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < vertexCount; i++) {
    const x1 = vertices[i * 3];
    const y1 = vertices[i * 3 + 1];
    const z1 = vertices[i * 3 + 2];
    const x2 = vertices[((i + 1) % vertexCount) * 3];
    const y2 = vertices[((i + 1) % vertexCount) * 3 + 1];
    const z2 = vertices[((i + 1) % vertexCount) * 3 + 2];
    
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  
  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return { nx: 0, ny: 0, nz: 0 };
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

// Compute average normal from normal records
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

// Determine face orientation category from normal vector
function determineOrientation(normal, tolerance = 0.01) {
  const { nx, ny, nz } = normal;
  
  // Check each axis direction
  if (Math.abs(nx - 1) < tolerance && Math.abs(ny) < tolerance && Math.abs(nz) < tolerance) return '+X';
  if (Math.abs(nx + 1) < tolerance && Math.abs(ny) < tolerance && Math.abs(nz) < tolerance) return '-X';
  if (Math.abs(ny - 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(nz) < tolerance) return '+Y';
  if (Math.abs(ny + 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(nz) < tolerance) return '-Y';
  if (Math.abs(nz - 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(ny) < tolerance) return '+Z';
  if (Math.abs(nz + 1) < tolerance && Math.abs(nx) < tolerance && Math.abs(ny) < tolerance) return '-Z';
  
  // Check for axis-aligned but not exactly unit length
  const absX = Math.abs(nx);
  const absY = Math.abs(ny);
  const absZ = Math.abs(nz);
  
  if (absX > 0.99 && absY < 0.01 && absZ < 0.01) return nx > 0 ? '+X' : '-X';
  if (absY > 0.99 && absX < 0.01 && absZ < 0.01) return ny > 0 ? '+Y' : '-Y';
  if (absZ > 0.99 && absX < 0.01 && absY < 0.01) return nz > 0 ? '+Z' : '-Z';
  
  // Non-axis-aligned face
  return `NON_AXIS(${nx.toFixed(3)},${ny.toFixed(3)},${nz.toFixed(3)})`;
}

// Classify face type based on ec, vc, secCount
function classifyFaceType(face) {
  const { edgeCount: ec, vertexCount: vc, secCount } = face;
  
  // Multi-loop face: secCount > 1
  if (secCount > 1) {
    return 'multi_loop';
  }
  
  // Cylindrical face: ec = vc, secCount = 1, high vc
  if (ec === vc && secCount === 1 && vc > 20) {
    return 'cylindrical';
  }
  
  // Planar cube face: ec = 4, vc = 4, secCount = 1
  if (ec === 4 && vc === 4 && secCount === 1) {
    return 'planar_cube';
  }
  
  // Chamfer face: ec = 5, vc = 5, secCount = 1
  if (ec === 5 && vc === 5 && secCount === 1) {
    return 'chamfer';
  }
  
  // Other planar face
  if (secCount === 1) {
    return 'planar_other';
  }
  
  return 'unknown';
}

// Compute token statistics
function computeTokenStats(tokens) {
  // Entropy
  const freq = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  let entropy = 0;
  const len = tokens.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  // Zero frequency
  const zeroFreq = tokens.filter(t => t === 0).length / len;
  
  // Alternating strength
  let alternations = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] !== tokens[i - 1]) {
      alternations++;
    }
  }
  const altStrength = alternations / (tokens.length - 1);
  
  return { entropy, zeroFreq, altStrength };
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-032: Token Signatures vs Face Orientation');
console.log('==============================================\n');

// Parse all controlled models
const models = {};
const modelNames = [
  'C00_cube_10mm',
  'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm',
  'C05_cube_hole_3mm',
  'C09_cube_chamfer_1mm',
  'C10_shell_1mm',
  'C11_cube_hole_4mm'
];

for (const name of modelNames) {
  const modelDir = path.join(CORPUS_DIR, name);
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  if (fs.existsSync(sldprtPath)) {
    console.log(`Parsing ${name}...`);
    const result = parseFile(sldprtPath);
    models[name] = result.faces.map((face, idx) => ({
      faceIndex: idx,
      edgeCount: face.edgeCount,
      vertexCount: face.vertexCount,
      secCount: face.secCount,
      b1Len: face.b1Len,
      b1BodyTokens: Array.from(face.b1Body),
      b2Body: Array.from(face.b2Body),
      vertices: Array.from(face.vertices),
      normals: Array.from(face.normals),
    }));
  }
}

// ============================================================
// 1. DETERMINE FACE ORIENTATION FROM EXTERNAL EVIDENCE
// ============================================================

console.log('\n\n1. FACE ORIENTATION DETERMINATION');
console.log('=================================');

const allFaces = [];
for (const [modelName, faces] of Object.entries(models)) {
  for (const face of faces) {
    const faceType = classifyFaceType(face);
    
    // Compute face normal from vertices (Newell's method)
    const normalFromVertices = computeFaceNormal(face.vertices, face.vertexCount);
    
    // Compute average normal from normal records
    const normalFromNormals = computeAverageNormal(face.normals, face.vertexCount);
    
    // Determine orientation from vertex-computed normal
    const orientationFromVertices = determineOrientation(normalFromVertices);
    
    // Determine orientation from normal records (authoritative source)
    const orientationFromNormals = determineOrientation(normalFromNormals);
    
    // Use normal records as primary orientation (authoritative)
    const orientation = orientationFromNormals;
    
    // Check if normals are consistent
    const normalsConsistent = 
      Math.abs(normalFromVertices.nx - normalFromNormals.nx) < 0.01 &&
      Math.abs(normalFromVertices.ny - normalFromNormals.ny) < 0.01 &&
      Math.abs(normalFromVertices.nz - normalFromNormals.nz) < 0.01;
    
    // Compute token statistics
    const tokens = face.b1BodyTokens;
    const tokenStats = computeTokenStats(tokens);
    
    // Store face data
    allFaces.push({
      model: modelName,
      faceIndex: face.faceIndex,
      faceType,
      ec: face.edgeCount,
      vc: face.vertexCount,
      secCount: face.secCount,
      b1Len: face.b1Len,
      tokens,
      first5: tokens.slice(0, 5),
      first10: tokens.slice(0, 10),
      first20: tokens.slice(0, 20),
      ...tokenStats,
      
      // Orientation data (from external evidence)
      normalFromVertices,
      normalFromNormals,
      orientation,
      orientationFromVertices,
      orientationFromNormals,
      normalsConsistent,
      
      // Vertex coordinates (for cross-model comparison)
      vertices: face.vertices,
    });
    
    console.log(`${modelName} face ${face.faceIndex}: ${faceType}`);
    console.log(`  Orientation: ${orientation} (from normals)`);
    console.log(`  Normal (vertices): (${normalFromVertices.nx.toFixed(3)}, ${normalFromVertices.ny.toFixed(3)}, ${normalFromVertices.nz.toFixed(3)})`);
    console.log(`  Normal (normals): (${normalFromNormals.nx.toFixed(3)}, ${normalFromNormals.ny.toFixed(3)}, ${normalFromNormals.nz.toFixed(3)})`);
    console.log(`  Tokens: [${tokens.slice(0, 6).join(',')}]`);
  }
}

// ============================================================
// 2. GROUP FACES BY ORIENTATION
// ============================================================

console.log('\n\n2. GROUPING BY ORIENTATION');
console.log('=========================');

const orientationGroups = {};
for (const face of allFaces) {
  const orient = face.orientation;
  if (!orientationGroups[orient]) {
    orientationGroups[orient] = [];
  }
  orientationGroups[orient].push(face);
}

console.log('\nOrientation groups:');
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`\n${orientation}: ${faces.length} faces`);
  for (const face of faces) {
    console.log(`  ${face.model} face ${face.faceIndex}: ${face.faceType}`);
    console.log(`    Tokens: [${face.tokens.slice(0, 6).join(',')}]`);
  }
}

// ============================================================
// 3. COMPARE TOKEN SIGNATURES WITHIN SAME ORIENTATION
// ============================================================

console.log('\n\n3. TOKEN SIGNATURES WITHIN SAME ORIENTATION');
console.log('===========================================');

for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`\n${orientation}:`);
  
  // Get unique first-20 patterns
  const first20Patterns = new Set(faces.map(f => f.first20.join(',')));
  console.log(`  First 20 tokens: ${first20Patterns.size} unique pattern(s)`);
  if (first20Patterns.size <= 10) {
    for (const pattern of first20Patterns) {
      console.log(`    ${pattern}`);
    }
  }
  
  // Get unique first-6 patterns (full tokens for cube faces)
  const first6Patterns = new Set(faces.map(f => f.tokens.slice(0, 6).join(',')));
  console.log(`  First 6 tokens (full): ${first6Patterns.size} unique pattern(s)`);
  if (first6Patterns.size <= 10) {
    for (const pattern of first6Patterns) {
      console.log(`    ${pattern}`);
    }
  }
  
  // Check if all faces have identical tokens
  const allTokensIdentical = faces.every(f => 
    f.tokens.join(',') === faces[0].tokens.join(',')
  );
  console.log(`  All tokens identical: ${allTokensIdentical}`);
  
  // Check entropy distribution
  const entropies = faces.map(f => f.entropy);
  const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  console.log(`  Entropy: avg=${avgEntropy.toFixed(3)}`);
}

// ============================================================
// 4. COMPARE TOKEN SIGNATURES BETWEEN OPPOSITE ORIENTATIONS
// ============================================================

console.log('\n\n4. TOKEN SIGNATURES BETWEEN OPPOSITE ORIENTATIONS');
console.log('=================================================');

const oppositePairs = [
  ['+X', '-X'],
  ['+Y', '-Y'],
  ['+Z', '-Z']
];

for (const [pos, neg] of oppositePairs) {
  const posFaces = orientationGroups[pos] || [];
  const negFaces = orientationGroups[neg] || [];
  
  if (posFaces.length === 0 || negFaces.length === 0) {
    console.log(`\n${pos} vs ${neg}: Not enough faces`);
    continue;
  }
  
  console.log(`\n${pos} (${posFaces.length} faces) vs ${neg} (${negFaces.length} faces):`);
  
  // Get unique patterns for each orientation
  const posPatterns = new Set(posFaces.map(f => f.first20.join(',')));
  const negPatterns = new Set(negFaces.map(f => f.first20.join(',')));
  
  console.log(`  ${pos} patterns: ${posPatterns.size} unique`);
  console.log(`  ${neg} patterns: ${negPatterns.size} unique`);
  
  // Check if patterns are identical
  const allPatternsIdentical = [...posPatterns].every(p => negPatterns.has(p));
  console.log(`  Patterns identical: ${allPatternsIdentical}`);
  
  // Check if patterns are systematically related
  // (e.g., same structure but different values)
  const posEntropies = posFaces.map(f => f.entropy);
  const negEntropies = negFaces.map(f => f.entropy);
  const avgPosEntropy = posEntropies.reduce((a, b) => a + b, 0) / posEntropies.length;
  const avgNegEntropy = negEntropies.reduce((a, b) => a + b, 0) / negEntropies.length;
  
  console.log(`  ${pos} avg entropy: ${avgPosEntropy.toFixed(3)}`);
  console.log(`  ${neg} avg entropy: ${avgNegEntropy.toFixed(3)}`);
  console.log(`  Entropy difference: ${Math.abs(avgPosEntropy - avgNegEntropy).toFixed(3)}`);
}

// ============================================================
// 5. CROSS-MODEL COMPARISON FOR SAME ORIENTATION
// ============================================================

console.log('\n\n5. CROSS-MODEL COMPARISON FOR SAME ORIENTATION');
console.log('===============================================');

// Group by orientation AND model
const orientationModelGroups = {};
for (const face of allFaces) {
  const key = `${face.orientationFromVertices}|${face.model}`;
  if (!orientationModelGroups[key]) {
    orientationModelGroups[key] = [];
  }
  orientationModelGroups[key].push(face);
}

// Check if same orientation has same tokens across models
console.log('\nCross-model token consistency for same orientation:');

const orientations = [...new Set(allFaces.map(f => f.orientation))];
for (const orient of orientations) {
  if (orient.startsWith('NON_AXIS')) continue;
  
  // Get all faces with this orientation
  const facesWithOrientation = allFaces.filter(f => f.orientation === orient);
  
  // Group by model
  const modelGroups = {};
  for (const face of facesWithOrientation) {
    if (!modelGroups[face.model]) {
      modelGroups[face.model] = [];
    }
    modelGroups[face.model].push(face);
  }
  
  console.log(`\n${orient}:`);
  
  // Check if all models have same token pattern
  const modelPatterns = {};
  for (const [model, faces] of Object.entries(modelGroups)) {
    modelPatterns[model] = faces.map(f => f.tokens.slice(0, 6).join(','));
  }
  
  const uniquePatterns = new Set(Object.values(modelPatterns).map(p => p[0]));
  console.log(`  Models: ${Object.keys(modelGroups).length}`);
  console.log(`  Unique token patterns: ${uniquePatterns.size}`);
  
  if (uniquePatterns.size === 1) {
    console.log(`  All models have same token pattern: ${[...uniquePatterns][0]}`);
  } else {
    console.log(`  Different models have different token patterns:`);
    for (const [model, pattern] of Object.entries(modelPatterns)) {
      console.log(`    ${model}: ${pattern[0]}`);
    }
  }
}

// ============================================================
// 6. COMPARE TOKEN SIGNATURES ACROSS DIFFERENT ORIENTATIONS
// ============================================================

console.log('\n\n6. TOKEN SIGNATURES ACROSS DIFFERENT ORIENTATIONS');
console.log('=================================================');

// Get unique token patterns for each orientation
const orientationPatterns = {};
for (const [orient, faces] of Object.entries(orientationGroups)) {
  if (orient.startsWith('NON_AXIS')) continue;
  const patterns = new Set(faces.map(f => f.tokens.slice(0, 6).join(',')));
  orientationPatterns[orient] = [...patterns];
}

console.log('\nToken patterns by orientation:');
for (const [orient, patterns] of Object.entries(orientationPatterns)) {
  console.log(`\n${orient}:`);
  for (const pattern of patterns) {
    console.log(`  ${pattern}`);
  }
}

// Check if different orientations have different patterns
const allPatterns = new Set();
for (const patterns of Object.values(orientationPatterns)) {
  for (const pattern of patterns) {
    allPatterns.add(pattern);
  }
}

console.log(`\nTotal unique patterns across all orientations: ${allPatterns.size}`);

// Check if patterns are unique to orientations
const patternToOrientations = {};
for (const [orient, patterns] of Object.entries(orientationPatterns)) {
  for (const pattern of patterns) {
    if (!patternToOrientations[pattern]) {
      patternToOrientations[pattern] = [];
    }
    patternToOrientations[pattern].push(orient);
  }
}

let patternsSharedAcrossOrientations = 0;
for (const [pattern, orientations] of Object.entries(patternToOrientations)) {
  if (orientations.length > 1) {
    patternsSharedAcrossOrientations++;
    console.log(`Pattern ${pattern} shared across: ${orientations.join(', ')}`);
  }
}

console.log(`\nPatterns shared across orientations: ${patternsSharedAcrossOrientations}/${allPatterns.size}`);

// ============================================================
// 7. HYPOTHESIS TESTING
// ============================================================

console.log('\n\n7. HYPOTHESIS TESTING');
console.log('=====================');

// H1: Token signatures correlate with planar face orientation
console.log('\nH1: Token signatures correlate with planar face orientation');
const planarFaces = allFaces.filter(f => f.faceType === 'planar_cube');
const planarOrientations = [...new Set(planarFaces.map(f => f.orientation))];
const planarPatterns = new Set(planarFaces.map(f => f.tokens.slice(0, 6).join(',')));

console.log(`  Planar cube faces: ${planarFaces.length}`);
console.log(`  Unique orientations: ${planarOrientations.length}`);
console.log(`  Unique token patterns: ${planarPatterns.size}`);

// Check if each orientation has unique pattern
let h1Supported = true;
const orientationPatternMap = {};
for (const face of planarFaces) {
  const pattern = face.tokens.slice(0, 6).join(',');
  if (!orientationPatternMap[face.orientation]) {
    orientationPatternMap[face.orientation] = new Set();
  }
  orientationPatternMap[face.orientation].add(pattern);
}

for (const [orient, patterns] of Object.entries(orientationPatternMap)) {
  if (patterns.size > 1) {
    console.log(`  ${orient}: ${patterns.size} patterns`);
    h1Supported = false;
  }
}

if (h1Supported) {
  console.log('  Result: SUPPORTED (each orientation has unique token pattern)');
} else {
  console.log('  Result: PARTIALLY SUPPORTED (some orientations have multiple patterns)');
}

// H2: Token signatures are invariant for the same orientation across models
console.log('\nH2: Token signatures are invariant for the same orientation across models');
let h2Supported = true;
const crossModelConsistency = {};

for (const face of planarFaces) {
  const key = face.orientation;
  if (!crossModelConsistency[key]) {
    crossModelConsistency[key] = {};
  }
  const pattern = face.tokens.slice(0, 6).join(',');
  if (!crossModelConsistency[key][face.model]) {
    crossModelConsistency[key][face.model] = pattern;
  }
}

for (const [orient, modelPatterns] of Object.entries(crossModelConsistency)) {
  const uniquePatterns = new Set(Object.values(modelPatterns));
  if (uniquePatterns.size > 1) {
    console.log(`  ${orient}: ${uniquePatterns.size} patterns across models`);
    h2Supported = false;
  }
}

if (h2Supported) {
  console.log('  Result: SUPPORTED (same orientation has same tokens across models)');
} else {
  console.log('  Result: FALSIFIED (same orientation has different tokens across models)');
}

// H3: Opposite orientations have systematically related signatures
console.log('\nH3: Opposite orientations have systematically related signatures');
let h3Supported = true;
const oppositeConsistency = {};

for (const [pos, neg] of oppositePairs) {
  const posFaces = planarFaces.filter(f => f.orientationFromVertices === pos);
  const negFaces = planarFaces.filter(f => f.orientationFromVertices === neg);
  
  if (posFaces.length === 0 || negFaces.length === 0) {
    continue;
  }
  
  const posPatterns = new Set(posFaces.map(f => f.tokens.slice(0, 6).join(',')));
  const negPatterns = new Set(negFaces.map(f => f.tokens.slice(0, 6).join(',')));
  
  // Check if patterns are identical
  const patternsIdentical = [...posPatterns].every(p => negPatterns.has(p));
  oppositeConsistency[`${pos} vs ${neg}`] = {
    identical: patternsIdentical,
    posPatterns: [...posPatterns],
    negPatterns: [...negPatterns]
  };
  
  if (!patternsIdentical) {
    h3Supported = false;
    console.log(`  ${pos} vs ${neg}: Different patterns`);
  }
}

if (h3Supported) {
  console.log('  Result: SUPPORTED (opposite orientations have identical patterns)');
} else {
  console.log('  Result: FALSIFIED (opposite orientations have different patterns)');
}

// H4: Token signatures are primarily determined by serialization position
console.log('\nH4: Token signatures are primarily determined by serialization position');
// Check if face index correlates with token pattern
let h4Supported = true;
const faceIndexPatterns = {};

for (const face of planarFaces) {
  const key = `${face.model}_${face.faceIndex}`;
  const pattern = face.tokens.slice(0, 6).join(',');
  faceIndexPatterns[key] = pattern;
}

// Check if same face index in different models has same pattern
const modelFacePatterns = {};
for (const [key, pattern] of Object.entries(faceIndexPatterns)) {
  const [model, faceIdx] = key.split('_');
  if (!modelFacePatterns[faceIdx]) {
    modelFacePatterns[faceIdx] = {};
  }
  modelFacePatterns[faceIdx][model] = pattern;
}

for (const [faceIdx, patterns] of Object.entries(modelFacePatterns)) {
  const uniquePatterns = new Set(Object.values(patterns));
  if (uniquePatterns.size > 1) {
    console.log(`  Face index ${faceIdx}: ${uniquePatterns.size} patterns across models`);
    h4Supported = false;
  }
}

if (h4Supported) {
  console.log('  Result: SUPPORTED (same face index has same tokens across models)');
} else {
  console.log('  Result: FALSIFIED (same face index has different tokens across models)');
}

// H5: Token signatures are primarily determined by topology/vertex ordering
console.log('\nH5: Token signatures are primarily determined by topology/vertex ordering');
// Check if vertex coordinates correlate with token pattern
let h5Supported = true;
const vertexPatternGroups = {};

for (const face of planarFaces) {
  // Use normal direction as proxy for face position
  const key = `${face.normalFromNormals.nx.toFixed(3)}_${face.normalFromNormals.ny.toFixed(3)}_${face.normalFromNormals.nz.toFixed(3)}`;
  const pattern = face.tokens.slice(0, 6).join(',');
  if (!vertexPatternGroups[key]) {
    vertexPatternGroups[key] = new Set();
  }
  vertexPatternGroups[key].add(pattern);
}

for (const [normalKey, patterns] of Object.entries(vertexPatternGroups)) {
  if (patterns.size > 1) {
    console.log(`  Normal direction ${normalKey}: ${patterns.size} patterns`);
    h5Supported = false;
  }
}

if (h5Supported) {
  console.log('  Result: SUPPORTED (faces with same vertex position have same tokens)');
} else {
  console.log('  Result: FALSIFIED (faces with same vertex position have different tokens)');
}

// ============================================================
// 8. C11 FINDINGS
// ============================================================

console.log('\n\n8. C11 FINDINGS');
console.log('===============');

const c11Faces = allFaces.filter(f => f.model === 'C11_cube_hole_4mm');
console.log(`C11 total faces: ${c11Faces.length}`);

for (const face of c11Faces) {
  console.log(`\n  Face ${face.faceIndex}: ${face.faceType}`);
  console.log(`    Orientation: ${face.orientationFromVertices}`);
  console.log(`    Tokens: [${face.tokens.slice(0, 6).join(',')}]`);
  console.log(`    Entropy: ${face.entropy.toFixed(3)}`);
}

// Compare C11 planar faces with other models
const c11Planar = c11Faces.filter(f => f.faceType === 'planar_cube');
const c00Planar = allFaces.filter(f => f.model === 'C00_cube_10mm' && f.faceType === 'planar_cube');

console.log('\nC11 planar faces vs C00 planar faces:');
for (const c11Face of c11Planar) {
  const matchingC00 = c00Planar.find(f => f.orientationFromVertices === c11Face.orientationFromVertices);
  if (matchingC00) {
    console.log(`\n  C11 face ${c11Face.faceIndex} (${c11Face.orientationFromVertices}) vs C00 face ${matchingC00.faceIndex} (${matchingC00.orientationFromVertices}):`);
    console.log(`    C11 tokens: [${c11Face.tokens.slice(0, 6).join(',')}]`);
    console.log(`    C00 tokens: [${matchingC00.tokens.slice(0, 6).join(',')}]`);
    console.log(`    Identical: ${c11Face.tokens.slice(0, 6).join(',') === matchingC00.tokens.slice(0, 6).join(',')}`);
  }
}

// ============================================================
// 9. COMPETING EXPLANATIONS
// ============================================================

console.log('\n\n9. COMPETING EXPLANATIONS');
console.log('=========================');

console.log('\nCompeting explanations for token signature differences:');
console.log('1. Face orientation: Token signatures correlate with face orientation');
console.log('2. Serialization position: Token signatures correlate with face index');
console.log('3. Topology: Token signatures correlate with vertex coordinates');
console.log('4. Face type: Token signatures correlate with face type (cylindrical vs planar)');

// Summary of evidence
console.log('\nEvidence summary:');
console.log(`- H1 (orientation correlation): ${h1Supported ? 'SUPPORTED' : 'PARTIALLY SUPPORTED'}`);
console.log(`- H2 (orientation invariance): ${h2Supported ? 'SUPPORTED' : 'FALSIFIED'}`);
console.log(`- H3 (opposite orientation relation): ${h3Supported ? 'SUPPORTED' : 'FALSIFIED'}`);
console.log(`- H4 (serialization position): ${h4Supported ? 'SUPPORTED' : 'FALSIFIED'}`);
console.log(`- H5 (topology/vertex ordering): ${h5Supported ? 'SUPPORTED' : 'FALSIFIED'}`);

// ============================================================
// 10. SUMMARY STATISTICS
// ============================================================

console.log('\n\n10. SUMMARY STATISTICS');
console.log('======================');

console.log('\nTotal faces analyzed:', allFaces.length);
console.log('Face types:');
const faceTypeCounts = {};
for (const face of allFaces) {
  faceTypeCounts[face.faceType] = (faceTypeCounts[face.faceType] || 0) + 1;
}
for (const [faceType, count] of Object.entries(faceTypeCounts)) {
  console.log(`  ${faceType}: ${count}`);
}

console.log('\nOrientation distribution:');
for (const [orientation, faces] of Object.entries(orientationGroups)) {
  console.log(`  ${orientation}: ${faces.length}`);
}

// ============================================================
// 11. RAW RESULTS
// ============================================================

const results = {
  timestamp: new Date().toISOString(),
  corpus: modelNames,
  totalFaces: allFaces.length,
  faceTypeCounts,
  orientationCounts: {},
  faces: allFaces.map(f => ({
    model: f.model,
    faceIndex: f.faceIndex,
    faceType: f.faceType,
    ec: f.ec,
    vc: f.vc,
    secCount: f.secCount,
    b1Len: f.b1Len,
    tokens: f.tokens,
    first5: f.first5,
    first10: f.first10,
    first20: f.first20,
    entropy: f.entropy,
    zeroFreq: f.zeroFreq,
    altStrength: f.altStrength,
    orientationFromVertices: f.orientationFromVertices,
    orientationFromNormals: f.orientationFromNormals,
    normalsConsistent: f.normalsConsistent,
    normalFromVertices: f.normalFromVertices,
    normalFromNormals: f.normalFromNormals,
  })),
  orientationGroups: {},
  hypothesisTests: {
    H1_orientation_correlation: h1Supported,
    H2_orientation_invariance: h2Supported,
    H3_opposite_orientation_relation: h3Supported,
    H4_serialization_position: h4Supported,
    H5_topology_vertex_ordering: h5Supported
  },
  crossModelConsistency,
  oppositeConsistency
};

for (const [orientation, faces] of Object.entries(orientationGroups)) {
  results.orientationCounts[orientation] = faces.length;
  results.orientationGroups[orientation] = faces.map(f => ({
    model: f.model,
    faceIndex: f.faceIndex,
    faceType: f.faceType,
    tokens: f.tokens,
    entropy: f.entropy,
  }));
}

fs.writeFileSync(
  path.join(__dirname, 'EXP032_TOKEN_ORIENTATION.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n\nResults written to EXP032_TOKEN_ORIENTATION.json');

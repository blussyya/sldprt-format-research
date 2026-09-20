/**
 * EXP-033: Token Signatures vs Feature-Induced Model State
 *
 * Determine why C03 (fillet) and C09 (chamfer) produce modified Block1
 * token signatures for otherwise comparable planar orientations, while
 * C00/C04/C05/C11 retain the standard signatures.
 *
 * Do NOT modify parser/.
 * Do NOT assign semantic meaning to individual token values.
 * Do NOT infer "modified" from token signature itself.
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

// Classify face type based on ec, vc, secCount
function classifyFaceType(face) {
  const { edgeCount: ec, vertexCount: vc, secCount } = face;
  
  if (secCount > 1) return 'multi_loop';
  if (ec === vc && secCount === 1 && vc > 20) return 'cylindrical';
  if (ec === 4 && vc === 4 && secCount === 1) return 'planar_cube';
  if (ec === 5 && vc === 5 && secCount === 1) return 'chamfer';
  if (secCount === 1) return 'planar_other';
  return 'unknown';
}

// Determine feature type from model name
function determineFeatureType(modelName) {
  if (modelName.includes('fillet')) return 'fillet';
  if (modelName.includes('chamfer')) return 'chamfer';
  if (modelName.includes('hole')) return 'hole';
  if (modelName.includes('shell')) return 'shell';
  return 'none';
}

// Determine if face is directly modified by feature
function isDirectlyModified(face, featureType) {
  // For fillet/chamfer: faces with ec=5, vc=5 are directly modified
  // For hole: cylindrical faces and multi-loop faces are directly modified
  // For shell: all faces may be modified
  
  if (featureType === 'fillet' || featureType === 'chamfer') {
    // Chamfer faces are directly modified
    if (face.faceType === 'chamfer') return true;
    // Multi-loop faces are directly modified
    if (face.faceType === 'multi_loop') return true;
  }
  
  if (featureType === 'hole') {
    // Cylindrical faces are directly modified
    if (face.faceType === 'cylindrical') return true;
    // Multi-loop faces are directly modified
    if (face.faceType === 'multi_loop') return true;
  }
  
  if (featureType === 'shell') {
    // Shell modifies all faces
    return true;
  }
  
  return false;
}

// Determine if face is adjacent to modified geometry
function isAdjacentToModified(face, allFaces, featureType) {
  // For now, we use a heuristic: faces that share orientation with modified faces
  // This is a simplification - true adjacency would require topology analysis
  
  if (featureType === 'none') return false;
  
  // Find modified faces
  const modifiedFaces = allFaces.filter(f => isDirectlyModified(f, featureType));
  
  // Check if any modified face shares orientation
  for (const modified of modifiedFaces) {
    if (modified.orientation === face.orientation) {
      return true;
    }
  }
  
  return false;
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-033: Token Signatures vs Feature-Induced Model State');
console.log('========================================================\n');

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
// 1. CLASSIFY ALL FACES
// ============================================================

console.log('\n\n1. FACE CLASSIFICATION');
console.log('=====================');

const allFaces = [];
for (const [modelName, faces] of Object.entries(models)) {
  const featureType = determineFeatureType(modelName);
  
  for (const face of faces) {
    const faceType = classifyFaceType(face);
    const normal = computeAverageNormal(face.normals, face.vertexCount);
    const orientation = determineOrientation(normal);
    
    allFaces.push({
      model: modelName,
      featureType,
      faceIndex: face.faceIndex,
      faceType,
      ec: face.edgeCount,
      vc: face.vertexCount,
      secCount: face.secCount,
      b1Len: face.b1Len,
      tokens: face.b1BodyTokens,
      first6: face.b1BodyTokens.slice(0, 6),
      orientation,
      normal,
    });
  }
}

// ============================================================
// 2. CONTROLLED COMPARISONS
// ============================================================

console.log('\n\n2. CONTROLLED COMPARISONS');
console.log('=========================');

// C00 ↔ C03 — fillet
console.log('\n--- C00 ↔ C03 (fillet) ---');
const c00Faces = allFaces.filter(f => f.model === 'C00_cube_10mm');
const c03Faces = allFaces.filter(f => f.model === 'C03_cube_fillet_1mm');

console.log(`C00: ${c00Faces.length} faces, feature: none`);
console.log(`C03: ${c03Faces.length} faces, feature: fillet`);

// Compare planar faces
const c00Planar = c00Faces.filter(f => f.faceType === 'planar_cube');
const c03Planar = c03Faces.filter(f => f.faceType === 'planar_cube');

console.log(`\nC00 planar faces: ${c00Planar.length}`);
console.log(`C03 planar faces: ${c03Planar.length}`);

// Compare token signatures for same orientation
const c00ByOrientation = {};
for (const face of c00Planar) {
  c00ByOrientation[face.orientation] = face.first6.join(',');
}

const c03ByOrientation = {};
for (const face of c03Planar) {
  c03ByOrientation[face.orientation] = face.first6.join(',');
}

console.log('\nToken signatures by orientation:');
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c03Pattern = c03ByOrientation[orient];
  const changed = c00Pattern !== c03Pattern;
  console.log(`  ${orient}: C00=${c00Pattern} C03=${c03Pattern} ${changed ? 'CHANGED' : 'same'}`);
}

// C00 ↔ C09 — chamfer
console.log('\n--- C00 ↔ C09 (chamfer) ---');
const c09Faces = allFaces.filter(f => f.model === 'C09_cube_chamfer_1mm');

console.log(`C00: ${c00Faces.length} faces, feature: none`);
console.log(`C09: ${c09Faces.length} faces, feature: chamfer`);

const c09Planar = c09Faces.filter(f => f.faceType === 'planar_cube');
console.log(`\nC00 planar faces: ${c00Planar.length}`);
console.log(`C09 planar faces: ${c09Planar.length}`);

const c09ByOrientation = {};
for (const face of c09Planar) {
  c09ByOrientation[face.orientation] = face.first6.join(',');
}

console.log('\nToken signatures by orientation:');
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c09Pattern = c09ByOrientation[orient];
  const changed = c00Pattern !== c09Pattern;
  console.log(`  ${orient}: C00=${c00Pattern} C09=${c09Pattern} ${changed ? 'CHANGED' : 'same'}`);
}

// C00 ↔ C04 — hole
console.log('\n--- C00 ↔ C04 (hole) ---');
const c04Faces = allFaces.filter(f => f.model === 'C04_cube_hole_5mm');

console.log(`C00: ${c00Faces.length} faces, feature: none`);
console.log(`C04: ${c04Faces.length} faces, feature: hole`);

const c04Planar = c04Faces.filter(f => f.faceType === 'planar_cube');
console.log(`\nC00 planar faces: ${c00Planar.length}`);
console.log(`C04 planar faces: ${c04Planar.length}`);

const c04ByOrientation = {};
for (const face of c04Planar) {
  c04ByOrientation[face.orientation] = face.first6.join(',');
}

console.log('\nToken signatures by orientation:');
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c04Pattern = c04ByOrientation[orient];
  const changed = c00Pattern !== c04Pattern;
  console.log(`  ${orient}: C00=${c00Pattern} C04=${c04Pattern} ${changed ? 'CHANGED' : 'same'}`);
}

// C00 ↔ C10 — shell
console.log('\n--- C00 ↔ C10 (shell) ---');
const c10Faces = allFaces.filter(f => f.model === 'C10_shell_1mm');

console.log(`C00: ${c00Faces.length} faces, feature: none`);
console.log(`C10: ${c10Faces.length} faces, feature: shell`);

if (c10Faces.length > 0) {
  const c10Planar = c10Faces.filter(f => f.faceType === 'planar_cube');
  console.log(`\nC00 planar faces: ${c00Planar.length}`);
  console.log(`C10 planar faces: ${c10Planar.length}`);
  
  const c10ByOrientation = {};
  for (const face of c10Planar) {
    c10ByOrientation[face.orientation] = face.first6.join(',');
  }
  
  console.log('\nToken signatures by orientation:');
  for (const orient of Object.keys(c00ByOrientation)) {
    const c00Pattern = c00ByOrientation[orient];
    const c10Pattern = c10ByOrientation[orient];
    const changed = c00Pattern !== c10Pattern;
    console.log(`  ${orient}: C00=${c00Pattern} C10=${c10Pattern} ${changed ? 'CHANGED' : 'same'}`);
  }
} else {
  console.log('\nC10: No parseable faces');
}

// C04 ↔ C05 ↔ C11 — hole diameter controls
console.log('\n--- C04 ↔ C05 ↔ C11 (hole diameter controls) ---');
const c05Faces = allFaces.filter(f => f.model === 'C05_cube_hole_3mm');
const c11Faces = allFaces.filter(f => f.model === 'C11_cube_hole_4mm');

console.log(`C04: ${c04Faces.length} faces, feature: hole (5mm)`);
console.log(`C05: ${c05Faces.length} faces, feature: hole (3mm)`);
console.log(`C11: ${c11Faces.length} faces, feature: hole (4mm)`);

// Compare cylindrical faces
const c04Cyl = c04Faces.filter(f => f.faceType === 'cylindrical');
const c05Cyl = c05Faces.filter(f => f.faceType === 'cylindrical');
const c11Cyl = c11Faces.filter(f => f.faceType === 'cylindrical');

console.log(`\nCylindrical faces: C04=${c04Cyl.length}, C05=${c05Cyl.length}, C11=${c11Cyl.length}`);

if (c04Cyl.length > 0 && c05Cyl.length > 0 && c11Cyl.length > 0) {
  console.log(`C04 cylindrical tokens: ${c04Cyl[0].first6.join(',')}`);
  console.log(`C05 cylindrical tokens: ${c05Cyl[0].first6.join(',')}`);
  console.log(`C11 cylindrical tokens: ${c11Cyl[0].first6.join(',')}`);
  console.log(`All identical: ${c04Cyl[0].first6.join(',') === c05Cyl[0].first6.join(',') && c05Cyl[0].first6.join(',') === c11Cyl[0].first6.join(',')}`);
}

// ============================================================
// 3. FEATURE-INDUCED CHANGES ANALYSIS
// ============================================================

console.log('\n\n3. FEATURE-INDUCED CHANGES ANALYSIS');
console.log('====================================');

// For each model, classify faces and identify changes
const featureAnalysis = {};
for (const [modelName, faces] of Object.entries(models)) {
  const featureType = determineFeatureType(modelName);
  const modelFaces = allFaces.filter(f => f.model === modelName);
  
  featureAnalysis[modelName] = {
    featureType,
    totalFaces: modelFaces.length,
    planarFaces: modelFaces.filter(f => f.faceType === 'planar_cube').length,
    modifiedFaces: modelFaces.filter(f => isDirectlyModified(f, featureType)).length,
    adjacentFaces: modelFaces.filter(f => isAdjacentToModified(f, modelFaces, featureType)).length,
    unchangedFaces: modelFaces.filter(f => !isDirectlyModified(f, featureType) && !isAdjacentToModified(f, modelFaces, featureType)).length,
  };
}

console.log('\nFeature analysis by model:');
for (const [modelName, analysis] of Object.entries(featureAnalysis)) {
  console.log(`\n${modelName}:`);
  console.log(`  Feature type: ${analysis.featureType}`);
  console.log(`  Total faces: ${analysis.totalFaces}`);
  console.log(`  Planar faces: ${analysis.planarFaces}`);
  console.log(`  Directly modified: ${analysis.modifiedFaces}`);
  console.log(`  Adjacent to modified: ${analysis.adjacentFaces}`);
  console.log(`  Unchanged: ${analysis.unchangedFaces}`);
}

// ============================================================
// 4. DIRECT FEATURE EFFECT
// ============================================================

console.log('\n\n4. DIRECT FEATURE EFFECT');
console.log('========================');

// For planar faces whose geometry is demonstrably unchanged between C00 and C03/C09
console.log('\nPlanar faces unchanged between C00 and C03/C09:');

// C00 ↔ C03 comparison
console.log('\n--- C00 ↔ C03 (fillet) ---');
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c03Pattern = c03ByOrientation[orient];
  const changed = c00Pattern !== c03Pattern;
  
  // Find faces with this orientation
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  
  if (c00Face && c03Face) {
    console.log(`\n${orient}:`);
    console.log(`  C00 face ${c00Face.faceIndex}: ${c00Pattern}`);
    console.log(`  C03 face ${c03Face.faceIndex}: ${c03Pattern}`);
    console.log(`  Changed: ${changed}`);
    
    if (changed) {
      // Determine if face is directly modified or adjacent
      const c00Modified = isDirectlyModified(c00Face, 'none');
      const c03Modified = isDirectlyModified(c03Face, 'fillet');
      const c00Adjacent = isAdjacentToModified(c00Face, c00Faces, 'none');
      const c03Adjacent = isAdjacentToModified(c03Face, c03Faces, 'fillet');
      
      console.log(`  C00 directly modified: ${c00Modified}`);
      console.log(`  C03 directly modified: ${c03Modified}`);
      console.log(`  C00 adjacent to modified: ${c00Adjacent}`);
      console.log(`  C03 adjacent to modified: ${c03Adjacent}`);
    }
  }
}

// C00 ↔ C09 comparison
console.log('\n--- C00 ↔ C09 (chamfer) ---');
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c09Pattern = c09ByOrientation[orient];
  const changed = c00Pattern !== c09Pattern;
  
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  if (c00Face && c09Face) {
    console.log(`\n${orient}:`);
    console.log(`  C00 face ${c00Face.faceIndex}: ${c00Pattern}`);
    console.log(`  C09 face ${c09Face.faceIndex}: ${c09Pattern}`);
    console.log(`  Changed: ${changed}`);
    
    if (changed) {
      const c00Modified = isDirectlyModified(c00Face, 'none');
      const c09Modified = isDirectlyModified(c09Face, 'chamfer');
      const c00Adjacent = isAdjacentToModified(c00Face, c00Faces, 'none');
      const c09Adjacent = isAdjacentToModified(c09Face, c09Faces, 'chamfer');
      
      console.log(`  C00 directly modified: ${c00Modified}`);
      console.log(`  C09 directly modified: ${c09Modified}`);
      console.log(`  C00 adjacent to modified: ${c00Adjacent}`);
      console.log(`  C09 adjacent to modified: ${c09Adjacent}`);
    }
  }
}

// ============================================================
// 5. FEATURE-TYPE COMPARISON
// ============================================================

console.log('\n\n5. FEATURE-TYPE COMPARISON');
console.log('==========================');

// Compare signature changes caused by different features
console.log('\nSignature changes by feature type:');

// Fillet changes
const filletChanges = [];
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c03Pattern = c03ByOrientation[orient];
  if (c00Pattern !== c03Pattern) {
    filletChanges.push({
      orientation: orient,
      from: c00Pattern,
      to: c03Pattern,
    });
  }
}

// Chamfer changes
const chamferChanges = [];
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c09Pattern = c09ByOrientation[orient];
  if (c00Pattern !== c09Pattern) {
    chamferChanges.push({
      orientation: orient,
      from: c00Pattern,
      to: c09Pattern,
    });
  }
}

// Hole changes
const holeChanges = [];
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c04Pattern = c04ByOrientation[orient];
  if (c00Pattern !== c04Pattern) {
    holeChanges.push({
      orientation: orient,
      from: c00Pattern,
      to: c04Pattern,
    });
  }
}

console.log(`\nFillet changes: ${filletChanges.length}`);
for (const change of filletChanges) {
  console.log(`  ${change.orientation}: ${change.from} -> ${change.to}`);
}

console.log(`\nChamfer changes: ${chamferChanges.length}`);
for (const change of chamferChanges) {
  console.log(`  ${change.orientation}: ${change.from} -> ${change.to}`);
}

console.log(`\nHole changes: ${holeChanges.length}`);
for (const change of holeChanges) {
  console.log(`  ${change.orientation}: ${change.from} -> ${change.to}`);
}

// Check if fillet and chamfer produce same changes
console.log('\nFillet vs Chamfer changes:');
if (filletChanges.length === chamferChanges.length) {
  let same = true;
  for (let i = 0; i < filletChanges.length; i++) {
    if (filletChanges[i].orientation !== chamferChanges[i].orientation ||
        filletChanges[i].to !== chamferChanges[i].to) {
      same = false;
      break;
    }
  }
  console.log(`  Same number of changes: ${filletChanges.length === chamferChanges.length}`);
  console.log(`  Same changes: ${same}`);
} else {
  console.log(`  Different number of changes: fillet=${filletChanges.length}, chamfer=${chamferChanges.length}`);
}

// ============================================================
// 6. TOPOLOGY CONTROLS
// ============================================================

console.log('\n\n6. TOPOLOGY CONTROLS');
console.log('====================');

// For each changed signature, compare structural properties
console.log('\nStructural properties for changed signatures:');

for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  
  // Find faces with this orientation in C00, C03, C09
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  console.log(`\n${orient}:`);
  
  if (c00Face) {
    console.log(`  C00: ec=${c00Face.ec}, vc=${c00Face.vc}, secCount=${c00Face.secCount}, b1Len=${c00Face.b1Len}`);
  }
  if (c03Face) {
    console.log(`  C03: ec=${c03Face.ec}, vc=${c03Face.vc}, secCount=${c03Face.secCount}, b1Len=${c03Face.b1Len}`);
  }
  if (c09Face) {
    console.log(`  C09: ec=${c09Face.ec}, vc=${c09Face.vc}, secCount=${c09Face.secCount}, b1Len=${c09Face.b1Len}`);
  }
  
  // Check if structural properties are identical
  if (c00Face && c03Face) {
    const sameEc = c00Face.ec === c03Face.ec;
    const sameVc = c00Face.vc === c03Face.vc;
    const sameSecCount = c00Face.secCount === c03Face.secCount;
    const sameB1Len = c00Face.b1Len === c03Face.b1Len;
    
    console.log(`  Same ec: ${sameEc}, Same vc: ${sameVc}, Same secCount: ${sameSecCount}, Same b1Len: ${sameB1Len}`);
    
    if (sameEc && sameVc && sameSecCount && sameB1Len) {
      console.log(`  ** Signature changed while all structural properties identical **`);
    }
  }
}

// ============================================================
// 7. SERIALIZATION CONTROL
// ============================================================

console.log('\n\n7. SERIALIZATION CONTROL');
console.log('========================');

// Check whether changed signatures correlate with face index
console.log('\nChanged signatures vs face index:');

for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  console.log(`\n${orient}:`);
  
  if (c00Face) {
    console.log(`  C00 face index: ${c00Face.faceIndex}`);
  }
  if (c03Face) {
    console.log(`  C03 face index: ${c03Face.faceIndex}`);
  }
  if (c09Face) {
    console.log(`  C09 face index: ${c09Face.faceIndex}`);
  }
}

// Check if changed signatures correlate with preceding/following face types
console.log('\nPreceding/following face types:');

for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  console.log(`\n${orient}:`);
  
  if (c00Face) {
    const prevFace = c00Planar.find(f => f.faceIndex === c00Face.faceIndex - 1);
    const nextFace = c00Planar.find(f => f.faceIndex === c00Face.faceIndex + 1);
    console.log(`  C00: prev=${prevFace ? prevFace.faceType : 'none'}, next=${nextFace ? nextFace.faceType : 'none'}`);
  }
  
  if (c03Face) {
    const prevFace = c03Planar.find(f => f.faceIndex === c03Face.faceIndex - 1);
    const nextFace = c03Planar.find(f => f.faceIndex === c03Face.faceIndex + 1);
    console.log(`  C03: prev=${prevFace ? prevFace.faceType : 'none'}, next=${nextFace ? nextFace.faceType : 'none'}`);
  }
  
  if (c09Face) {
    const prevFace = c09Planar.find(f => f.faceIndex === c09Face.faceIndex - 1);
    const nextFace = c09Planar.find(f => f.faceIndex === c09Face.faceIndex + 1);
    console.log(`  C09: prev=${prevFace ? prevFace.faceType : 'none'}, next=${nextFace ? nextFace.faceType : 'none'}`);
  }
}

// ============================================================
// 8. HYPOTHESIS TESTING
// ============================================================

console.log('\n\n8. HYPOTHESIS TESTING');
console.log('=====================');

// H1: Token signatures are determined primarily by feature type
console.log('\nH1: Token signatures are determined primarily by feature type');
let h1Supported = true;

// Check if fillet and chamfer produce same changes
if (filletChanges.length !== chamferChanges.length) {
  h1Supported = false;
  console.log('  Different number of changes for fillet vs chamfer');
} else {
  for (let i = 0; i < filletChanges.length; i++) {
    if (filletChanges[i].to !== chamferChanges[i].to) {
      h1Supported = false;
      console.log(`  Different changes for ${filletChanges[i].orientation}`);
      break;
    }
  }
}

if (h1Supported) {
  console.log('  Result: SUPPORTED (fillet and chamfer produce same changes)');
} else {
  console.log('  Result: FALSIFIED (fillet and chamfer produce different changes)');
}

// H2: Token signatures are determined primarily by local topology
console.log('\nH2: Token signatures are determined primarily by local topology');
let h2Supported = true;

// Check if changed signatures have identical structural properties
for (const change of filletChanges) {
  const orient = change.orientation;
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  
  if (c00Face && c03Face) {
    const sameEc = c00Face.ec === c03Face.ec;
    const sameVc = c00Face.vc === c03Face.vc;
    const sameSecCount = c00Face.secCount === c03Face.secCount;
    const sameB1Len = c00Face.b1Len === c03Face.b1Len;
    
    if (sameEc && sameVc && sameSecCount && sameB1Len) {
      h2Supported = false;
      console.log(`  ${orient}: Signature changed while structural properties identical`);
    }
  }
}

if (h2Supported) {
  console.log('  Result: SUPPORTED (signature changes correlate with structural changes)');
} else {
  console.log('  Result: FALSIFIED (signature changes occur without structural changes)');
}

// H3: Token signatures depend on whether a face is directly modified by a feature
console.log('\nH3: Token signatures depend on whether a face is directly modified by a feature');
let h3Supported = true;

// Check if directly modified faces have different signatures
for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  if (c00Face && c03Face) {
    const c00Modified = isDirectlyModified(c00Face, 'none');
    const c03Modified = isDirectlyModified(c03Face, 'fillet');
    
    // If signature changed but neither face is directly modified, H3 is falsified
    if (!c00Modified && !c03Modified) {
      h3Supported = false;
      console.log(`  ${orient}: Signature changed but neither face directly modified`);
    }
  }
}

if (h3Supported) {
  console.log('  Result: SUPPORTED (signature changes correlate with direct modification)');
} else {
  console.log('  Result: FALSIFIED (signature changes occur without direct modification)');
}

// H4: Token signatures depend on adjacency to modified geometry
console.log('\nH4: Token signatures depend on adjacency to modified geometry');
let h4Supported = true;

// Check if adjacent faces have different signatures
for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  if (c00Face && c03Face) {
    const c00Adjacent = isAdjacentToModified(c00Face, c00Faces, 'none');
    const c03Adjacent = isAdjacentToModified(c03Face, c03Faces, 'fillet');
    
    // If signature changed but neither face is adjacent, H4 is falsified
    if (!c00Adjacent && !c03Adjacent) {
      h4Supported = false;
      console.log(`  ${orient}: Signature changed but neither face adjacent to modified`);
    }
  }
}

if (h4Supported) {
  console.log('  Result: SUPPORTED (signature changes correlate with adjacency)');
} else {
  console.log('  Result: FALSIFIED (signature changes occur without adjacency)');
}

// H5: Token signatures depend on global model state/serialization
console.log('\nH5: Token signatures depend on global model state/serialization');
let h5Supported = true;

// Check if changed signatures correlate with face index
for (const change of [...filletChanges, ...chamferChanges]) {
  const orient = change.orientation;
  const c00Face = c00Planar.find(f => f.orientation === orient);
  const c03Face = c03Planar.find(f => f.orientation === orient);
  const c09Face = c09Planar.find(f => f.orientation === orient);
  
  if (c00Face && c03Face) {
    // If signature changed but face index is same, H5 is weakened
    if (c00Face.faceIndex === c03Face.faceIndex) {
      console.log(`  ${orient}: Signature changed but face index same (${c00Face.faceIndex})`);
    }
  }
}

// Check if unchanged faces have same face index across models
let unchangedSameIndex = true;
for (const orient of Object.keys(c00ByOrientation)) {
  const c00Pattern = c00ByOrientation[orient];
  const c03Pattern = c03ByOrientation[orient];
  
  if (c00Pattern === c03Pattern) {
    const c00Face = c00Planar.find(f => f.orientation === orient);
    const c03Face = c03Planar.find(f => f.orientation === orient);
    
    if (c00Face && c03Face && c00Face.faceIndex !== c03Face.faceIndex) {
      unchangedSameIndex = false;
      console.log(`  ${orient}: Same signature but different face index`);
    }
  }
}

if (unchangedSameIndex) {
  console.log('  Result: SUPPORTED (unchanged faces have same face index)');
} else {
  console.log('  Result: FALSIFIED (unchanged faces have different face indices)');
}

// H6: Token signatures are determined by orientation plus another structural variable
console.log('\nH6: Token signatures are determined by orientation plus another structural variable');
let h6Supported = true;

// Check if orientation alone explains signature variation
const orientationPatterns = {};
for (const face of c00Planar) {
  if (!orientationPatterns[face.orientation]) {
    orientationPatterns[face.orientation] = new Set();
  }
  orientationPatterns[face.orientation].add(face.first6.join(','));
}

for (const [orient, patterns] of Object.entries(orientationPatterns)) {
  if (patterns.size > 1) {
    h6Supported = false;
    console.log(`  ${orient}: Multiple patterns within C00`);
  }
}

if (h6Supported) {
  console.log('  Result: SUPPORTED (orientation alone explains signature variation within C00)');
} else {
  console.log('  Result: FALSIFIED (orientation alone does not explain signature variation)');
}

// ============================================================
// 9. SUMMARY STATISTICS
// ============================================================

console.log('\n\n9. SUMMARY STATISTICS');
console.log('=====================');

console.log('\nTotal faces analyzed:', allFaces.length);
console.log('Face types:');
const faceTypeCounts = {};
for (const face of allFaces) {
  faceTypeCounts[face.faceType] = (faceTypeCounts[face.faceType] || 0) + 1;
}
for (const [faceType, count] of Object.entries(faceTypeCounts)) {
  console.log(`  ${faceType}: ${count}`);
}

console.log('\nFeature types:');
const featureTypeCounts = {};
for (const face of allFaces) {
  featureTypeCounts[face.featureType] = (featureTypeCounts[face.featureType] || 0) + 1;
}
for (const [featureType, count] of Object.entries(featureTypeCounts)) {
  console.log(`  ${featureType}: ${count}`);
}

console.log('\nOrientation distribution:');
const orientationCounts = {};
for (const face of allFaces) {
  orientationCounts[face.orientation] = (orientationCounts[face.orientation] || 0) + 1;
}
for (const [orientation, count] of Object.entries(orientationCounts)) {
  console.log(`  ${orientation}: ${count}`);
}

// ============================================================
// 10. RAW RESULTS
// ============================================================

const results = {
  timestamp: new Date().toISOString(),
  corpus: modelNames,
  totalFaces: allFaces.length,
  faceTypeCounts,
  featureTypeCounts,
  orientationCounts,
  faces: allFaces.map(f => ({
    model: f.model,
    featureType: f.featureType,
    faceIndex: f.faceIndex,
    faceType: f.faceType,
    ec: f.ec,
    vc: f.vc,
    secCount: f.secCount,
    b1Len: f.b1Len,
    tokens: f.tokens,
    first6: f.first6,
    orientation: f.orientation,
    directlyModified: isDirectlyModified(f, f.featureType),
    adjacentToModified: isAdjacentToModified(f, allFaces.filter(ff => ff.model === f.model), f.featureType),
  })),
  featureAnalysis,
  controlledComparisons: {
    filletChanges,
    chamferChanges,
    holeChanges,
  },
  hypothesisTests: {
    H1_feature_type: h1Supported,
    H2_local_topology: h2Supported,
    H3_direct_modification: h3Supported,
    H4_adjacency: h4Supported,
    H5_global_serialization: h5Supported,
    H6_orientation_plus_structural: h6Supported,
  },
};

fs.writeFileSync(
  path.join(__dirname, 'EXP033_FEATURE_STATE.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n\nResults written to EXP033_FEATURE_STATE.json');

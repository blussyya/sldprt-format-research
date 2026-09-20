/**
 * EXP-028 Investigation 2: Feature-Change Localization
 *
 * Re-examines C00↔C03 (fillet), C00↔C04 (hole), C00↔C09 (chamfer), C00↔C10 (shell)
 * to determine whether binary changes are genuinely localized.
 *
 * Separates changed regions into:
 * 1. geometry belonging to affected/new/removed faces
 * 2. topology/connectivity changes
 * 3. vertex/index renumbering effects
 * 4. global serialization/index structures
 * 5. metadata or bookkeeping
 * 6. changes that cannot currently be classified
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

function findOverlappingFace(faces, start, end) {
  for (const f of faces) {
    const faceEnd = f.block2Start + 16 + f.b2Len * 4;
    if (f.faceStartOffset < end && faceEnd > start) {
      return f;
    }
  }
  return null;
}

function classifyChange(change, parseA, parseB, dlA, dlB) {
  const classifications = [];
  
  // Find overlapping faces in both files
  const overlapA = findOverlappingFace(parseA.faces, change.start, change.end);
  const overlapB = findOverlappingFace(parseB.faces, change.start, change.end);
  
  if (change.type === 'size_difference') {
    classifications.push('size_difference');
    return classifications;
  }
  
  // Check if change overlaps with face geometry (positions, normals)
  if (overlapA && overlapB) {
    // Both files have a face at this location
    if (overlapA.index === overlapB.index) {
      // Same face index
      if (overlapA.vertexCount !== overlapB.vertexCount) {
        classifications.push('topology_change');
      }
      if (overlapA.edgeCount !== overlapB.edgeCount) {
        classifications.push('topology_change');
      }
      if (overlapA.secCount !== overlapB.secCount) {
        classifications.push('topology_change');
      }
      
      // Check if it's in the vertex position area
      const vertsEndA = overlapA.verticesStart + overlapA.vertexCount * 12;
      const vertsEndB = overlapB.verticesStart + overlapB.vertexCount * 12;
      if (change.start >= overlapA.verticesStart && change.end <= vertsEndA) {
        classifications.push('geometry_affected_face');
      } else if (change.start >= overlapB.verticesStart && change.end <= vertsEndB) {
        classifications.push('geometry_affected_face');
      }
      
      // Check if it's in the normal area
      if (change.start >= overlapA.normalsStart && change.end <= overlapA.normalsStart + overlapA.vertexCount * 12) {
        classifications.push('geometry_affected_face');
      }
      
      // Check if it's in Block1/Block2 area
      if (change.start >= overlapA.block1Start && change.end <= overlapA.block2Start + 16 + overlapA.b2Len * 4) {
        classifications.push('metadata_bookkeeping');
      }
    } else {
      // Different face indices - could be renumbering
      classifications.push('vertex_index_renumbering');
    }
  } else if (overlapA && !overlapB) {
    // Only in file A - face was removed or restructured
    classifications.push('geometry_removed_face');
  } else if (!overlapA && overlapB) {
    // Only in file B - face was added
    classifications.push('geometry_new_face');
  } else {
    // No overlapping face in either file
    // Check if it's in the DL header area
    if (change.start < 100) {
      classifications.push('global_serialization');
    } else {
      // Check if it's between faces (inter-face metadata)
      classifications.push('inter_face_metadata');
    }
  }
  
  if (classifications.length === 0) {
    classifications.push('unclassified');
  }
  
  return classifications;
}

// ============================================================
// ANALYSIS
// ============================================================

console.log('=== EXP-028 Investigation 2: Feature-Change Localization ===\n');

const pairs = [
  ['C00_cube_10mm', 'C03_cube_fillet_1mm', 'fillet'],
  ['C00_cube_10mm', 'C04_cube_hole_5mm', 'hole'],
  ['C00_cube_10mm', 'C09_cube_chamfer_1mm', 'chamfer'],
  ['C00_cube_10mm', 'C10_cube_shell_1mm', 'shell'],
];

const results = {};

for (const [nameA, nameB, purpose] of pairs) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PAIR: ${nameA} ↔ ${nameB} (${purpose})`);
  console.log(`${'='.repeat(70)}`);
  
  const dlA = extractDisplayLists(path.join(CORPUS_DIR, nameA, 'model.SLDPRT'));
  const dlB = extractDisplayLists(path.join(CORPUS_DIR, nameB, 'model.SLDPRT'));
  
  if (!dlA || !dlB) {
    console.log('  ERROR: Could not extract DisplayLists');
    continue;
  }
  
  const parseA = parseFile(path.join(CORPUS_DIR, nameA, 'model.SLDPRT'));
  const parseB = parseFile(path.join(CORPUS_DIR, nameB, 'model.SLDPRT'));
  
  console.log(`  DL sizes: ${nameA}=${dlA.length}, ${nameB}=${dlB.length}`);
  console.log(`  Faces: ${nameA}=${parseA.faces.length}, ${nameB}=${parseB.faces.length}`);
  
  // Byte-level diff
  const changes = byteDiff(dlA, dlB);
  let totalChangedBytes = 0;
  for (const c of changes) {
    totalChangedBytes += c.length;
  }
  
  console.log(`  Changed ranges: ${changes.length}`);
  console.log(`  Total changed bytes: ${totalChangedBytes}`);
  
  // Classify each change
  const classifications = {};
  for (const change of changes) {
    const cls = classifyChange(change, parseA, parseB, dlA, dlB);
    for (const c of cls) {
      classifications[c] = (classifications[c] || 0) + change.length;
    }
  }
  
  console.log('\n  Change classification:');
  for (const [cls, bytes] of Object.entries(classifications).sort((a, b) => b[1] - a[1])) {
    const pct = (bytes / totalChangedBytes * 100).toFixed(1);
    console.log(`    ${cls}: ${bytes} bytes (${pct}%)`);
  }
  
  // Analyze face-by-face changes
  console.log('\n  Face-by-face analysis:');
  
  // Map faces between files based on geometric similarity
  const faceMapping = mapFaces(parseA.faces, parseB.faces);
  
  for (const [idxA, idxB] of faceMapping) {
    const fA = parseA.faces[idxA];
    const fB = parseB.faces[idxB];
    
    if (idxB === -1) {
      console.log(`    Face ${idxA} (${nameA}): REMOVED in ${nameB}`);
      continue;
    }
    if (idxA === -1) {
      console.log(`    Face ${idxB} (${nameB}): NEW (not in ${nameA})`);
      continue;
    }
    
    const sameEc = fA.edgeCount === fB.edgeCount;
    const sameVc = fA.vertexCount === fB.vertexCount;
    const sameSec = fA.secCount === fB.secCount;
    
    if (sameEc && sameVc && sameSec) {
      // Check vertex positions
      let maxDelta = 0;
      for (let v = 0; v < fA.vertexCount; v++) {
        for (let c = 0; c < 3; c++) {
          const delta = Math.abs(fA.vertices[v * 3 + c] - fB.vertices[v * 3 + c]);
          maxDelta = Math.max(maxDelta, delta);
        }
      }
      
      if (maxDelta < 1e-6) {
        console.log(`    Face ${idxA}↔${idxB}: IDENTICAL`);
      } else {
        console.log(`    Face ${idxA}↔${idxB}: geometry changed (max delta=${maxDelta.toFixed(6)})`);
      }
    } else {
      console.log(`    Face ${idxA}↔${idxB}: CHANGED (ec:${fA.edgeCount}→${fB.edgeCount}, vc:${fA.vertexCount}→${fB.vertexCount}, sec:${fA.secCount}→${fB.secCount})`);
    }
  }
  
  // Check for global serialization changes
  console.log('\n  Global serialization analysis:');
  console.log(`    DL header (first 8 bytes): A=[${Array.from(dlA.slice(0, 8)).join(',')}], B=[${Array.from(dlB.slice(0, 8)).join(',')}]]`);
  
  // Check face start offsets
  console.log(`    Face start offsets (${nameA}):`);
  for (const f of parseA.faces) {
    console.log(`      Face ${f.index}: offset=${f.faceStartOffset}`);
  }
  console.log(`    Face start offsets (${nameB}):`);
  for (const f of parseB.faces) {
    console.log(`      Face ${f.index}: offset=${f.faceStartOffset}`);
  }
  
  results[`${nameA}_vs_${nameB}`] = {
    purpose,
    dlSizeA: dlA.length,
    dlSizeB: dlB.length,
    facesA: parseA.faces.length,
    facesB: parseB.faces.length,
    changedBytes: totalChangedBytes,
    classifications,
  };
}

// Save results
const outputPath = path.join(__dirname, 'EXP028_FEATURE_LOCALIZATION.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n\nResults saved to ${outputPath}`);

// ============================================================
// Helper function to map faces between files
// ============================================================

function mapFaces(facesA, facesB) {
  const mapping = [];
  const usedB = new Set();
  
  for (let i = 0; i < facesA.length; i++) {
    const fA = facesA[i];
    let bestMatch = -1;
    let bestScore = -1;
    
    for (let j = 0; j < facesB.length; j++) {
      if (usedB.has(j)) continue;
      
      const fB = facesB[j];
      let score = 0;
      
      // Exact match on all structural properties
      if (fA.edgeCount === fB.edgeCount) score += 10;
      if (fA.vertexCount === fB.vertexCount) score += 10;
      if (fA.secCount === fB.secCount) score += 5;
      
      // Vertex position similarity
      if (fA.vertexCount === fB.vertexCount) {
        let posScore = 0;
        for (let v = 0; v < fA.vertexCount; v++) {
          for (let c = 0; c < 3; c++) {
            if (Math.abs(fA.vertices[v * 3 + c] - fB.vertices[v * 3 + c]) < 1e-6) {
              posScore++;
            }
          }
        }
        score += posScore / (fA.vertexCount * 3) * 5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = j;
      }
    }
    
    if (bestScore > 5) {
      mapping.push([i, bestMatch]);
      usedB.add(bestMatch);
    } else {
      mapping.push([i, -1]);
    }
  }
  
  // Add unmatched B faces
  for (let j = 0; j < facesB.length; j++) {
    if (!usedB.has(j)) {
      mapping.push([-1, j]);
    }
  }
  
  return mapping;
}

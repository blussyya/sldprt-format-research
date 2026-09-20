/**
 * Binary Differential Analysis Tool
 *
 * Compares decompressed DisplayLists byte-by-byte between controlled pairs.
 * Identifies changed byte ranges, entropy differences, and structural changes.
 *
 * Usage: node binary_diff.js [pair] e.g. node binary_diff.js C00 C01
 * Or: node binary_diff.js --all (runs all planned pairs)
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

  // Handle tail difference
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

function entropy(buffer, start, end) {
  const counts = new Uint32Array(256);
  const len = end - start;
  for (let i = start; i < end; i++) counts[buffer[i]]++;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / len;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

function u32At(buf, offset) {
  return buf.readUInt32LE(offset);
}

function f32At(buf, offset) {
  return buf.readFloatLE(offset);
}

function analyzePair(nameA, nameB, auditData) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`DIFFERENTIAL: ${nameA} ↔ ${nameB}`);
  console.log(`${'='.repeat(70)}`);

  const pathA = path.join(CORPUS_DIR, nameA, 'model.SLDPRT');
  const pathB = path.join(CORPUS_DIR, nameB, 'model.SLDPRT');

  const dlA = extractDisplayLists(pathA);
  const dlB = extractDisplayLists(pathB);

  if (!dlA || !dlB) {
    console.log('  ERROR: Could not extract DisplayLists');
    return null;
  }

  const parseA = parseFile(pathA);
  const parseB = parseFile(pathB);

  console.log(`\n  File sizes: ${nameA}=${dlA.length} bytes, ${nameB}=${dlB.length} bytes`);
  console.log(`  Faces: ${nameA}=${parseA.faces.length}, ${nameB}=${parseB.faces.length}`);

  // Byte-level diff
  const changes = byteDiff(dlA, dlB);
  let totalChangedBytes = 0;
  for (const c of changes) {
    if (c.type === 'size_difference') {
      totalChangedBytes += c.length;
    } else {
      totalChangedBytes += c.length;
    }
  }

  console.log(`\n  Byte-level diff:`);
  console.log(`    Changed ranges: ${changes.length}`);
  console.log(`    Total changed bytes: ${totalChangedBytes}`);
  console.log(`    Percent changed: ${(totalChangedBytes / Math.max(dlA.length, dlB.length) * 100).toFixed(2)}%`);

  // Show each changed range with context
  console.log(`\n  Changed ranges detail:`);
  for (let ci = 0; ci < changes.length; ci++) {
    const c = changes[ci];
    if (c.type === 'size_difference') {
      console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes): SIZE DIFFERENCE`);
      continue;
    }

    // Check if this range overlaps with any face in either file
    const overlapA = findOverlappingFace(parseA.faces, c.start, c.end);
    const overlapB = findOverlappingFace(parseB.faces, c.start, c.end);

    let contextStr = '';
    if (overlapA || overlapB) {
      contextStr = ` (overlaps face: A=${overlapA ? `face(${overlapA.edgeCount}ec,${overlapA.vertexCount}vc)` : 'none'}, B=${overlapB ? `face(${overlapB.edgeCount}ec,${overlapB.vertexCount}vc)` : 'none'})`;
    }

    // Show first few bytes of change
    const previewLen = Math.min(c.length, 32);
    const bytesA = Array.from(dlA.slice(c.start, c.start + previewLen));
    const bytesB = Array.from(dlB.slice(c.start, c.start + previewLen));
    const preview = `A[${bytesA.map(b => b.toString(16).padStart(2, '0')).join(' ')}] B[${bytesB.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`;

    // Try to interpret as u32/f32
    let interpret = '';
    if (c.length >= 4) {
      const uA = u32At(dlA, c.start);
      const uB = u32At(dlB, c.start);
      const fA = f32At(dlA, c.start);
      const fB = f32At(dlB, c.start);
      interpret = ` u32: ${uA}→${uB} f32: ${fA.toFixed(4)}→${fB.toFixed(4)}`;
    }

    console.log(`    [${ci}] OFFSET ${c.start}-${c.end} (${c.length} bytes)${contextStr}`);
    console.log(`         ${preview}${interpret}`);
  }

  // Face-level structural comparison
  console.log(`\n  Face structural comparison:`);
  console.log(`  ${nameA} faces:`);
  for (const f of parseA.faces) {
    console.log(`    Face ${f.index}: ec=${f.edgeCount} vc=${f.vertexCount} b1Len=${f.b1Len} secCount=${f.secCount} mp=${f.markerOffset}`);
  }
  console.log(`  ${nameB} faces:`);
  for (const f of parseB.faces) {
    console.log(`    Face ${f.index}: ec=${f.edgeCount} vc=${f.vertexCount} b1Len=${f.b1Len} secCount=${f.secCount} mp=${f.markerOffset}`);
  }

  // Compare corresponding faces (same index)
  console.log(`\n  Face-by-face diff (by index):`);
  const maxFaces = Math.max(parseA.faces.length, parseB.faces.length);
  for (let i = 0; i < maxFaces; i++) {
    const fA = parseA.faces[i];
    const fB = parseB.faces[i];
    if (!fA) {
      console.log(`    Face ${i}: ONLY IN ${nameB} (ec=${fB.edgeCount} vc=${fB.vertexCount})`);
      continue;
    }
    if (!fB) {
      console.log(`    Face ${i}: ONLY IN ${nameA} (ec=${fA.edgeCount} vc=${fA.vertexCount})`);
      continue;
    }

    const ecDiff = fA.edgeCount !== fB.edgeCount;
    const vcDiff = fA.vertexCount !== fB.vertexCount;
    const b1Diff = fA.b1Len !== fB.b1Len;
    const secDiff = fA.secCount !== fB.secCount;
    const b2Diff = JSON.stringify(fA.b2Body) !== JSON.stringify(fB.b2Body);
    const b1Diff2 = JSON.stringify(fA.b1BodyPreview) !== JSON.stringify(fB.b1BodyPreview);

    if (!ecDiff && !vcDiff && !b1Diff && !secDiff && !b2Diff && !b1Diff2) {
      console.log(`    Face ${i}: IDENTICAL structure`);
    } else {
      console.log(`    Face ${i}: CHANGED`);
      if (ecDiff) console.log(`      edgeCount: ${fA.edgeCount}→${fB.edgeCount}`);
      if (vcDiff) console.log(`      vertexCount: ${fA.vertexCount}→${fB.vertexCount}`);
      if (b1Diff) console.log(`      b1Len: ${fA.b1Len}→${fB.b1Len}`);
      if (secDiff) console.log(`      secCount: ${fA.secCount}→${fB.secCount}`);
      if (b2Diff) console.log(`      b2Body: [${fA.b2Body}]→[${fB.b2Body}]`);
      if (b1Diff2 && !b1Diff && !secDiff) console.log(`      b1Body (first 20 tokens): CHANGED`);
    }

    // Vertex comparison
    if (!vcDiff && fA.verticesPreview && fB.verticesPreview && fA.verticesPreview.length === fB.verticesPreview.length) {
      let vertChanged = false;
      for (let v = 0; v < fA.verticesPreview.length; v++) {
        if (Math.abs(fA.verticesPreview[v] - fB.verticesPreview[v]) > 1e-6) {
          vertChanged = true;
          break;
        }
      }
      if (vertChanged) {
        console.log(`      vertices: CHANGED (positions differ)`);
        // Show first vertex
        console.log(`        ${nameA} v0: [${fA.verticesPreview.slice(0,3).map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`        ${nameB} v0: [${fB.verticesPreview.slice(0,3).map(v => v.toFixed(4)).join(', ')}]`);
      } else {
        console.log(`      vertices: IDENTICAL positions`);
      }
    }
  }

  // Entropy analysis
  console.log(`\n  Entropy analysis:`);
  const entA = entropy(dlA, 0, dlA.length);
  const entB = entropy(dlB, 0, dlB.length);
  console.log(`    Overall: ${nameA}=${entA.toFixed(3)} bits/byte, ${nameB}=${entB.toFixed(3)} bits/byte`);

  // Per-face entropy
  for (let i = 0; i < Math.min(parseA.faces.length, parseB.faces.length); i++) {
    const fA = parseA.faces[i];
    const fB = parseB.faces[i];
    if (!fA || !fB) continue;
    const faceEndA = fA.block2Start + 16 + fA.b2Len * 4;
    const faceEndB = fB.block2Start + 16 + fB.b2Len * 4;
    if (faceEndA <= dlA.length && faceEndB <= dlB.length) {
      const eA = entropy(dlA, fA.faceStartOffset, faceEndA);
      const eB = entropy(dlB, fB.faceStartOffset, faceEndB);
      if (Math.abs(eA - eB) > 0.01) {
        console.log(`    Face ${i}: ${nameA}=${eA.toFixed(3)}, ${nameB}=${eB.toFixed(3)} bits/byte`);
      }
    }
  }

  return { nameA, nameB, dlA, dlB, parseA, parseB, changes, totalChangedBytes };
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

// Main
const pairs = [
  ['C00_cube_10mm', 'C01_cube_20mm'],       // EXP-A: scale
  ['C00_cube_10mm', 'C02_cube_translated'],  // EXP-B: translation
  ['C04_cube_hole_5mm', 'C05_cube_hole_3mm'], // EXP-C: hole diameter
  ['C04_cube_hole_5mm', 'C06_cube_hole_moved'], // EXP-D: hole position
  ['C00_cube_10mm', 'C03_cube_fillet_1mm'],  // EXP-E: fillet
  ['C00_cube_10mm', 'C04_cube_hole_5mm'],    // EXP-F: hole introduction
  ['C07_cube_two_holes', 'C08_cube_second_hole_modified'], // EXP-G: second hole
  ['C00_cube_10mm', 'C09_cube_chamfer_1mm'], // EXP-H: chamfer
  ['C00_cube_10mm', 'C10_cube_shell_1mm'],   // EXP-I: shell
];

// Load audit data
let auditData = {};
try {
  auditData = JSON.parse(fs.readFileSync(path.join(__dirname, 'CORPUS_AUDIT.json'), 'utf8'));
} catch (e) {
  console.log('WARNING: Could not load CORPUS_AUDIT.json');
}

// Run all pairs
const results = {};
for (const [nameA, nameB] of pairs) {
  const key = `${nameA}_vs_${nameB}`;
  results[key] = analyzePair(nameA, nameB, auditData);
}

// Save results summary
const summaryPath = path.join(__dirname, 'BINARY_DIFF_SUMMARY.json');
const summary = {};
for (const [key, val] of Object.entries(results)) {
  if (!val) continue;
  summary[key] = {
    dlSizeA: val.dlA.length,
    dlSizeB: val.dlB.length,
    facesA: val.parseA.faces.length,
    facesB: val.parseB.faces.length,
    changedRanges: val.changes.length,
    totalChangedBytes: val.totalChangedBytes,
    percentChanged: (val.totalChangedBytes / Math.max(val.dlA.length, val.dlB.length) * 100).toFixed(2),
  };
}
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`\n\nSummary saved to ${summaryPath}`);

/**
 * Corpus Audit — Controlled Corpus Baseline
 *
 * Runs the validated extraction pipeline (parser/v0.1) on all 11 controlled
 * SLDPRT files and records per-face structural data for differential analysis.
 *
 * This is a research script, not a parser. It produces machine-readable
 * baseline data for EXP-027+.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Import the validated parser core
const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

const MODELS = [
  'C00_cube_10mm',
  'C01_cube_20mm',
  'C02_cube_translated',
  'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm',
  'C05_cube_hole_3mm',
  'C06_cube_hole_moved',
  'C07_cube_two_holes',
  'C08_cube_second_hole_modified',
  'C09_cube_chamfer_1mm',
  'C10_cube_shell_1mm',
];

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
        return { name, data: Buffer.from(data), length: data.length };
      }
    }
  }
  return null;
}

// Extract all streams for a file
function extractAllStreams(filePath) {
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  const streams = parserCore.decompressOpenSX(buf, inflateRaw, inflateZlib);
  const result = {};
  for (const [name, data] of Object.entries(streams)) {
    result[name] = { data: Buffer.from(data), length: data.length };
  }
  return result;
}

const results = {};

for (const model of MODELS) {
  const sldprtPath = path.join(CORPUS_DIR, model, 'model.SLDPRT');
  console.log(`\n=== ${model} ===`);

  if (!fs.existsSync(sldprtPath)) {
    console.log(`  SLDPRT not found: ${sldprtPath}`);
    continue;
  }

  const parseResult = parseFile(sldprtPath);
  const dl = extractDisplayLists(sldprtPath);
  const allStreams = extractAllStreams(sldprtPath);

  console.log(`  Format: ${parseResult.format}`);
  console.log(`  DL length: ${dl ? dl.length : 'N/A'} bytes`);
  console.log(`  Faces: ${parseResult.faces.length}`);
  console.log(`  Rejected: ${parseResult.rejected.length}`);
  console.log(`  Stats: ${JSON.stringify(parseResult.stats)}`);

  // Collect face-level data
  const faceData = parseResult.faces.map((f, i) => ({
    index: i,
    markerOffset: f.markerOffset,
    faceStartOffset: f.faceStartOffset,
    edgeCount: f.edgeCount,
    vertexCount: f.vertexCount,
    verticesStart: f.verticesStart,
    gapStart: f.gapStart,
    normalsStart: f.normalsStart,
    block1Start: f.block1Start,
    block2Start: f.block2Start,
    b1Len: f.b1Len,
    secCount: f.secCount,
    sectionLens: f.sectionLens,
    loopSizes: f.loopSizes,
    // Store actual vertex positions (first 3 vertices max for brevity)
    verticesPreview: Array.from(f.vertices.slice(0, 9)),
    // Store actual normals (first 3 vertices max)
    normalsPreview: Array.from(f.normals.slice(0, 9)),
    // Block1 body (first 20 tokens for inspection)
    b1BodyPreview: Array.from(f.b1Body.slice(0, 20)),
    // Block2 body (full, usually small)
    b2Body: Array.from(f.b2Body),
  }));

  // Compute reject breakdown
  const rejectBreakdown = {};
  for (const r of parseResult.rejected) {
    rejectBreakdown[r.category] = (rejectBreakdown[r.category] || 0) + 1;
  }

  // Store stream names
  const streamNames = Object.keys(allStreams);

  results[model] = {
    format: parseResult.format,
    dlLength: dl ? dl.length : 0,
    faceCount: parseResult.faces.length,
    rejectedCount: parseResult.rejected.length,
    rejectBreakdown,
    faces: faceData,
    streamNames,
    streamSizes: streamNames.reduce((acc, n) => { acc[n] = allStreams[n].length; return acc; }, {}),
    errors: parseResult.errors,
    warnings: parseResult.warnings,
  };

  // Show reject breakdown
  if (parseResult.rejected.length > 0) {
    console.log(`  Reject breakdown: ${JSON.stringify(rejectBreakdown)}`);
  }

  // Show per-face summary
  for (const f of faceData) {
    console.log(`  Face ${f.index}: ec=${f.edgeCount} vc=${f.vertexCount} b1Len=${f.b1Len} secCount=${f.secCount} offsets=[mp=${f.markerOffset} b1=${f.block1Start} b2=${f.block2Start}]`);
  }
}

// Save comprehensive results
const outputPath = path.join(__dirname, 'CORPUS_AUDIT.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n\nResults saved to ${outputPath}`);

// Also save a summary table
console.log('\n=== CORPUS SUMMARY ===');
console.log('Model'.padEnd(30) + 'Faces'.padStart(6) + 'Rejected'.padStart(9) + 'DL bytes'.padStart(10) + 'Streams'.padStart(8));
for (const model of MODELS) {
  const r = results[model];
  if (!r) continue;
  console.log(
    model.padEnd(30) +
    String(r.faceCount).padStart(6) +
    String(r.rejectedCount).padStart(9) +
    String(r.dlLength).padStart(10) +
    String(r.streamNames.length).padStart(8)
  );
}

// Show aggregate
let totalFaces = 0, totalRejected = 0;
for (const model of MODELS) {
  const r = results[model];
  if (!r) continue;
  totalFaces += r.faceCount;
  totalRejected += r.rejectedCount;
}
console.log('-'.repeat(63));
console.log('TOTAL'.padEnd(30) + String(totalFaces).padStart(6) + String(totalRejected).padStart(9));

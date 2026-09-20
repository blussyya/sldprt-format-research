#!/usr/bin/env node
/**
 * EXP-026: secCount / Alternative-Header Correlation Discriminating Test
 *
 * Answers OQ-018 (knowledge/OPEN_QUESTIONS.md): is the observed correlation
 *
 *   secCount=1  <-> alternative header present with N=1
 *   secCount=2  <-> alternative header present with N=2
 *   secCount>=3 <-> no alternative header
 *
 * (found in v0.4.5, EXP-023-CORRECTED, 0 exceptions across 1,172 faces)
 * actually exceptionless/structural, or does it break down once specifically
 * hunted for counterexamples?
 *
 * SCOPE: this experiment does ONLY the counterexample hunt described above.
 * It does not search for N>2 alternative headers, does not investigate what
 * [4,8,2,N] "means", and does not extend the corpus. It reuses the
 * already-corrected Block1/Block2 offset arithmetic from v0.4.5
 * (block2Start = block1Start + (N+4)*4, N read from block1Start+12) verbatim
 * -- the buggy v0.4.4 arithmetic (block1Start + b1Word0*4 with b1Word0 misread
 * from block1Start+0) is NOT used anywhere in this script.
 *
 * This is a NEW experiment (EXP-026). No file under v0.4.4/ or v0.4.5/ is
 * modified.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RESEARCH_DIR = path.resolve(__dirname, '..');
const TEST_DIR = path.join(RESEARCH_DIR, 'test files original');

// Same 8-file corpus as v0.4.5 (EXP-023-CORRECTED / EXP-024-CORRECTED), for
// direct comparability. HEADPHONE is not present in this repository checkout
// (see Known gaps in the evidence file) and remains excluded, same as v0.4.5.
const FILES = [
  'usb hub case (ultimate test)/USB hub case BOTTOM.SLDPRT',
  'usb hub case (ultimate test)/USB hub case TOP.SLDPRT',
  'Helical Bevel Gear.SLDPRT',
  'Dekor.SLDPRT',
  'SW2000-s01.SLDPRT',
  'distributor main boss rev a.SLDPRT',
  'Pocket Wheel.SLDPRT',
  'PTC GE8080-8.SLDPRT',
];

const FACE_MARKER = Buffer.from([12, 0, 0, 0, 100, 0, 0, 0]);

// Decompression utilities (unchanged from v0.4.4/v0.4.5)
function rolByte(b, s) {
  s &= 7;
  if (!s) return b;
  return ((b << s) | (b >>> (8 - s))) & 0xFF;
}

function findAll(buf, pattern) {
  const r = [];
  for (let i = 0; i <= buf.length - pattern.length; i++) {
    let ok = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buf[i + j] !== pattern[j]) { ok = false; break; }
    }
    if (ok) r.push(i);
  }
  return r;
}

function decompressOpenSX(buffer) {
  const key = buffer[7];
  const magic = [20, 0, 6, 0, 8, 0];
  const streams = {};
  const matches = findAll(buffer, magic);

  for (const matchPos of matches) {
    const sigStart = matchPos - 4;
    if (sigStart < 0 || sigStart + 30 > buffer.length) continue;

    const compSize = buffer.readUInt32LE(sigStart + 18);
    const nameSize = buffer.readUInt32LE(sigStart + 26);

    if (nameSize > 1024 || compSize > 50e6) continue;

    const nameStart = sigStart + 30;
    const dataStart = nameStart + nameSize;
    const dataEnd = dataStart + compSize;

    if (dataEnd > buffer.length) continue;

    if (buffer.readUInt32LE(sigStart + 14) >= 65536 && compSize > 0) {
      let name = '';
      for (let i = 0; i < nameSize; i++) {
        name += String.fromCharCode(rolByte(buffer[nameStart + i], key));
      }

      if (!name) continue;

      let data;
      try {
        data = zlib.inflateRawSync(Buffer.from(buffer.subarray(dataStart, dataEnd)));
      } catch (e) {
        try {
          data = zlib.inflateSync(Buffer.from(buffer.subarray(dataStart, dataEnd)));
        } catch (e2) { }
      }

      if (data && data.length > 0 && !streams[name]) {
        streams[name] = data;
      }
    }
  }

  return streams;
}

function findDisplayLists(buffer) {
  const decompressed = decompressOpenSX(buffer);

  for (const [name, data] of Object.entries(decompressed)) {
    if (name.toLowerCase().includes('displaylist') && data.length > 100) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.readUInt32LE(0) === 1 && buf.readUInt32LE(4) === 1) {
        return data;
      }
    }
  }

  return null;
}

// Main analysis
console.log('='.repeat(70));
console.log('EXP-026: secCount / Alternative-Header Correlation Discriminating Test');
console.log('='.repeat(70));

const allFaces = [];

for (const file of FILES) {
  const filePath = path.join(TEST_DIR, file);
  console.log('\n--- File: ' + file + ' ---');

  try {
    const raw = fs.readFileSync(filePath);
    const dl = findDisplayLists(raw);

    if (!dl) {
      console.log('  No DisplayLists found');
      continue;
    }

    const dlBuf = Buffer.isBuffer(dl) ? dl : Buffer.from(dl);

    const matches = findAll(dlBuf, FACE_MARKER);
    console.log('  Found ' + matches.length + ' face markers');

    let fileFaceCount = 0;

    for (const mp of matches) {
      const faceStartOffset = mp - 4;
      if (faceStartOffset < 0) continue;

      const edgeCount = dlBuf.readUInt32LE(faceStartOffset);
      if (edgeCount < 1 || edgeCount > 500) continue;

      if (dlBuf.readUInt32LE(mp + 8) !== 2) continue;
      const vertexCount = dlBuf.readUInt32LE(mp + 12);
      if (vertexCount < 3 || vertexCount > 6000) continue;

      const verticesStart = mp + 16;
      if (verticesStart + vertexCount * 12 > dlBuf.length) continue;

      let ok = true;
      for (let i = 0; i < vertexCount; i++) {
        const x = dlBuf.readFloatLE(verticesStart + i * 12);
        if (!isFinite(x) || Math.abs(x) > 1e5) { ok = false; break; }
      }
      if (!ok) continue;

      const verticesEnd = verticesStart + vertexCount * 12;
      const gapStart = verticesEnd;

      if (gapStart + 16 > dlBuf.length) continue;

      const gap = [
        dlBuf.readUInt32LE(gapStart),
        dlBuf.readUInt32LE(gapStart + 4),
        dlBuf.readUInt32LE(gapStart + 8),
        dlBuf.readUInt32LE(gapStart + 12),
      ];

      if (gap[0] !== 12 || gap[1] !== 100 || gap[2] !== 2 || gap[3] !== vertexCount) continue;

      const normalsStart = gapStart + 16;
      const normalsEnd = normalsStart + vertexCount * 12;
      const block1Start = normalsEnd;

      // --- Block1 header, per INV-005 (identical to v0.4.5 corrected logic) ---
      if (block1Start + 16 > dlBuf.length) continue;

      const b1Header = [
        dlBuf.readUInt32LE(block1Start),
        dlBuf.readUInt32LE(block1Start + 4),
        dlBuf.readUInt32LE(block1Start + 8),
        dlBuf.readUInt32LE(block1Start + 12),
      ];

      if (b1Header[0] !== 4 || b1Header[1] !== 8 || b1Header[2] !== 2) continue;
      const N = b1Header[3]; // true Block1 body length

      if (N < 1 || N > 500000) continue;
      if (block1Start + 16 + N * 4 > dlBuf.length) continue;

      // --- Block2 offset, per the v0.4.5 correction: header-inclusive formula ---
      const block2Start = block1Start + (N + 4) * 4;

      let b2Header = null;
      let b2HeaderValid = false;
      let secCount = null; // M, Block2 body length -- only defined faces are counted

      if (block2Start + 16 <= dlBuf.length) {
        b2Header = [
          dlBuf.readUInt32LE(block2Start),
          dlBuf.readUInt32LE(block2Start + 4),
          dlBuf.readUInt32LE(block2Start + 8),
          dlBuf.readUInt32LE(block2Start + 12),
        ];
        if (b2Header[0] === 4 && b2Header[1] === 8 && b2Header[2] === 2) {
          const m = b2Header[3];
          if (m > 0 && m <= 100000 && block2Start + 16 + m * 4 <= dlBuf.length) {
            secCount = m;
            b2HeaderValid = true;
          }
        }
      }

      if (!b2HeaderValid) continue; // not one of the 1,172 validated faces

      // --- Alternative header search: identical detection window as v0.4.5
      //     (mp-20 for N=1, mp-24 for N=2). Not expanded to N>=3 -- this
      //     experiment tests the already-observed correlation, it does not
      //     go looking for new alternative-header shapes. ---
      let altFound = false;
      let altN = 0;
      let altOffset = null;
      let altHeaderRaw = null;

      if (mp >= 20) {
        const alt1Pos = mp - 20;
        const h = [
          dlBuf.readUInt32LE(alt1Pos),
          dlBuf.readUInt32LE(alt1Pos + 4),
          dlBuf.readUInt32LE(alt1Pos + 8),
          dlBuf.readUInt32LE(alt1Pos + 12),
        ];
        if (h[0] === 4 && h[1] === 8 && h[2] === 2 && h[3] === 1) {
          altFound = true;
          altN = 1;
          altOffset = alt1Pos;
          altHeaderRaw = h;
        }
      }

      if (!altFound && mp >= 24) {
        const alt2Pos = mp - 24;
        const h = [
          dlBuf.readUInt32LE(alt2Pos),
          dlBuf.readUInt32LE(alt2Pos + 4),
          dlBuf.readUInt32LE(alt2Pos + 8),
          dlBuf.readUInt32LE(alt2Pos + 12),
        ];
        if (h[0] === 4 && h[1] === 8 && h[2] === 2 && h[3] === 2) {
          altFound = true;
          altN = 2;
          altOffset = alt2Pos;
          altHeaderRaw = h;
        }
      }

      // --- Counterexample classification (per task spec, four directions) ---
      const isCE1 = secCount === 1 && !(altFound && altN === 1);
      const isCE2 = secCount === 2 && !(altFound && altN === 2);
      const isCE3 = secCount >= 3 && altFound;
      const isCE4 = altFound && altN !== secCount;

      allFaces.push({
        file,
        mp,                 // face marker offset -- reproduces face identity
        ec: edgeCount,
        vc: vertexCount,
        block1Start,
        b1Header,           // [4,8,2,N] raw
        N,                  // Block1 body length
        block2Start,        // = block1Start + (N+4)*4, the corrected offset
        b2Header,           // [4,8,2,M] raw
        secCount,           // M
        hasAlt: altFound,
        altN,
        altOffset,
        altHeaderRaw,
        delta: altFound ? mp - altOffset : null,
        isCE1, isCE2, isCE3, isCE4,
        isCounterexample: isCE1 || isCE2 || isCE3 || isCE4,
      });
      fileFaceCount++;
    }

    console.log('  Validated faces (valid B2 header at corrected offset): ' + fileFaceCount);

  } catch (e) {
    console.log('  Error: ' + e.message);
  }
}

// --- Analysis ---
console.log('\n' + '='.repeat(70));
console.log('COUNTEREXAMPLE HUNT');
console.log('='.repeat(70));

console.log('\nTotal validated faces: ' + allFaces.length);

const ce1 = allFaces.filter(f => f.isCE1);
const ce2 = allFaces.filter(f => f.isCE2);
const ce3 = allFaces.filter(f => f.isCE3);
const ce4 = allFaces.filter(f => f.isCE4);
const anyCE = allFaces.filter(f => f.isCounterexample);

console.log('\n1. secCount=1 with NO N=1 alternative: ' + ce1.length);
console.log('2. secCount=2 with NO N=2 alternative: ' + ce2.length);
console.log('3. secCount>=3 WITH an alternative (any N): ' + ce3.length);
console.log('4. alternative N inconsistent with secCount (hasAlt && altN != secCount): ' + ce4.length);
console.log('\nTotal faces violating the correlation in any direction: ' + anyCE.length + ' / ' + allFaces.length);

if (anyCE.length > 0) {
  console.log('\nCOUNTEREXAMPLES FOUND -- listing up to 20:');
  for (const f of anyCE.slice(0, 20)) {
    console.log('  ' + JSON.stringify({
      file: f.file, mp: f.mp, ec: f.ec, vc: f.vc, secCount: f.secCount,
      hasAlt: f.hasAlt, altN: f.altN, ce: { ce1: f.isCE1, ce2: f.isCE2, ce3: f.isCE3, ce4: f.isCE4 },
    }));
  }
} else {
  console.log('\nNo counterexamples found in the tested corpus (0/' + allFaces.length + ').');
}

// Distribution summary for context (not new claims, just corroborating totals)
const secDist = {};
for (const f of allFaces) secDist[f.secCount] = (secDist[f.secCount] || 0) + 1;
const withAlt = allFaces.filter(f => f.hasAlt).length;

console.log('\nsecCount=1 faces: ' + (secDist[1] || 0));
console.log('secCount=2 faces: ' + (secDist[2] || 0));
console.log('secCount>=3 faces: ' + (allFaces.length - (secDist[1] || 0) - (secDist[2] || 0)));
console.log('Faces with any alternative header: ' + withAlt);

// Per-file breakdown
console.log('\nPer-file breakdown:');
const fileStats = {};
for (const f of allFaces) {
  if (!fileStats[f.file]) fileStats[f.file] = { total: 0, ce1: 0, ce2: 0, ce3: 0, ce4: 0 };
  fileStats[f.file].total++;
  if (f.isCE1) fileStats[f.file].ce1++;
  if (f.isCE2) fileStats[f.file].ce2++;
  if (f.isCE3) fileStats[f.file].ce3++;
  if (f.isCE4) fileStats[f.file].ce4++;
}
for (const [file, s] of Object.entries(fileStats)) {
  console.log('  ' + file + ': ' + s.total + ' faces, CE1:' + s.ce1 + ' CE2:' + s.ce2 + ' CE3:' + s.ce3 + ' CE4:' + s.ce4);
}

// --- Save results ---
const outputPath = path.join(RESEARCH_DIR, 'v0.4.6', 'EXP026_RESULTS.json');
fs.writeFileSync(outputPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  experiment: 'EXP-026',
  goal: 'OQ-018 discriminating test: is the secCount <-> alternative-header correlation exceptionless (structural/causal candidate) or does it break under direct counterexample hunting?',
  offsetFormula: 'block2Start = block1Start + (N+4)*4, N from block1Start+12 (v0.4.5-corrected; buggy v0.4.4 arithmetic not used)',
  totalValidatedFaces: allFaces.length,
  counterexampleCounts: { ce1: ce1.length, ce2: ce2.length, ce3: ce3.length, ce4: ce4.length, anyCE: anyCE.length },
  secCountEq1: secDist[1] || 0,
  secCountEq2: secDist[2] || 0,
  secCountGte3: allFaces.length - (secDist[1] || 0) - (secDist[2] || 0),
  facesWithAlt: withAlt,
  perFile: fileStats,
  counterexamples: anyCE,
  faces: allFaces,
}, null, 2));

console.log('\nResults saved to: ' + outputPath);

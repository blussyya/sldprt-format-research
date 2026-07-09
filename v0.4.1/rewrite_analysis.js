#!/usr/bin/env node
/**
 * rewrite_analysis.js — Deterministic Rewrite System Analysis
 *
 * For structurally equivalent sections across files:
 * 1. Build VALUE→VALUE correspondence
 * 2. Determine mapping type (bijection / many-to-one / context-dependent)
 * 3. Check consistency across all occurrences
 * 4. Check dependency on section index, position, length, zero-pattern
 * 5. Attempt deterministic rewrite function
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function rolByte(b, s) { s &= 7; if (!s) return b; return ((b << s) | (b >>> (8 - s))) & 0xFF; }
function findAll(buf, pat) {
  const r = [];
  for (let i = 0; i <= buf.length - pat.length; i++) {
    let ok = true;
    for (let j = 0; j < pat.length; j++) if (buf[i+j] !== pat[j]) { ok = false; break; }
    if (ok) r.push(i);
  }
  return r;
}
function decompressOpenSX(buffer) {
  const key = buffer[7];
  const magic = [20,0,6,0,8,0];
  const s = {};
  for (const mp of findAll(buffer, magic)) {
    const si = mp - 4;
    if (si < 0 || si + 30 > buffer.length) continue;
    const csz = buffer.readUInt32LE(si+18);
    const nsz = buffer.readUInt32LE(si+26);
    if (nsz > 1024 || csz > 50e6) continue;
    const ns = si+30, ds = ns+nsz, de = ds+csz;
    if (de > buffer.length) continue;
    if (buffer.readUInt32LE(si+14) >= 65536 && csz > 0) {
      let n = '';
      for (let i = 0; i < nsz; i++) n += String.fromCharCode(rolByte(buffer[ns+i], key));
      if (!n) continue;
      let d;
      try { d = zlib.inflateRawSync(Buffer.from(buffer.subarray(ds, de))); }
      catch { try { d = zlib.inflateSync(Buffer.from(buffer.subarray(ds, de))); } catch {} }
      if (d && d.length > 0 && !s[n]) s[n] = d;
    }
  }
  return s;
}
function findDisplayLists(buffer) {
  const dc = decompressOpenSX(buffer);
  for (const [name, data] of Object.entries(dc)) {
    if (name.toLowerCase().includes('displaylist') && data.length > 100) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.readUInt32LE(0) === 1 && buf.readUInt32LE(4) === 1) return data;
    }
  }
  return null;
}
const FACE_MARKER = Buffer.from([12,0,0,0,100,0,0,0]);
function extractFaces(dl) {
  const faces = [];
  for (const mp of findAll(dl, FACE_MARKER)) {
    if (mp < 4) continue;
    const ec = dl.readUInt32LE(mp-4);
    if (ec < 1 || ec > 500) continue;
    if (dl.readUInt32LE(mp+8) !== 2) continue;
    const vc = dl.readUInt32LE(mp+12);
    if (vc < 3 || vc > 5000) continue;
    const vs = mp + 16;
    if (vs + vc*12 > dl.length) continue;
    let ok = true;
    for (let i = 0; i < vc; i++) { const x = dl.readFloatLE(vs+i*12); if (!isFinite(x)||Math.abs(x)>1e5){ok=false;break;} }
    if (!ok) continue;
    const ns = vs + vc*12 + 16;
    const ts = ns + vc*12;
    if (ts+16>dl.length) continue;
    if (dl.readUInt32LE(ts)!==4||dl.readUInt32LE(ts+4)!==8||dl.readUInt32LE(ts+8)!==2) continue;
    const b1len = dl.readUInt32LE(ts+12);
    if (b1len>100000||ts+16+b1len*4>dl.length) continue;
    const block1 = [];
    for (let i=0;i<b1len;i++) block1.push(dl.readUInt32LE(ts+16+i*4));
    const b2s = ts+(b1len+4)*4;
    let block2 = [];
    if (b2s+12<=dl.length&&dl.readUInt32LE(b2s)===4&&dl.readUInt32LE(b2s+4)===8&&dl.readUInt32LE(b2s+8)===2) {
      const m=dl.readUInt32LE(b2s+12);
      for (let i=0;i<m;i++) block2.push(dl.readUInt32LE(b2s+16+i*4));
    }
    faces.push({ ec, vc, block1, block2 });
  }
  return faces;
}
function splitSections(block1) {
  const secs = []; let cur = [];
  for (const t of block1) { if (t===1){if(cur.length)secs.push(cur);cur=[];}else cur.push(t); }
  if (cur.length) secs.push(cur);
  return secs;
}
function faceKey(f) { return `${f.vc}_${f.ec}_${f.block1.length}_${f.block2.length}`; }

// ============================================================
// Load files
// ============================================================
const RESEARCH_DIR = 'C:\\Users\\basha\\Desktop\\soldiworks research';
const FILES = {
  BOTTOM: path.join(RESEARCH_DIR, 'test files original', 'usb hub case (ultimate test)', 'USB hub case BOTTOM.SLDPRT'),
  TOP: path.join(RESEARCH_DIR, 'test files original', 'usb hub case (ultimate test)', 'USB hub case TOP.SLDPRT'),
  GEAR: path.join(RESEARCH_DIR, 'test files original', 'Helical Bevel Gear.SLDPRT'),
  DEKOR: path.join(RESEARCH_DIR, 'test files original', 'Dekor.SLDPRT'),
};

console.log('Loading files...');
const allFaces = {};
for (const [name, fp] of Object.entries(FILES)) {
  const raw = fs.readFileSync(fp);
  const dl = findDisplayLists(raw);
  if (!dl) { console.log(`  ${name}: no DL`); continue; }
  const faces = extractFaces(dl);
  console.log(`  ${name}: ${faces.length} faces`);
  for (const f of faces) f.file = name;
  allFaces[name] = faces;
}

// ============================================================
// Group faces by structural key
// ============================================================
const groups = {};
for (const [name, faces] of Object.entries(allFaces)) {
  for (let i = 0; i < faces.length; i++) {
    const k = faceKey(faces[i]);
    if (!groups[k]) groups[k] = [];
    groups[k].push({ file: name, idx: i, face: faces[i] });
  }
}

// ============================================================
// Phase 1: Build VALUE→VALUE mappings per section position
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PHASE 1: VALUE→VALUE MAPPING CONSTRUCTION');
console.log('='.repeat(70));

// For each pair of files, for each structural group, for each section position:
// Build a mapping: source_value → target_value

const filePairs = [];
const fnames = Object.keys(FILES);
for (let a = 0; a < fnames.length; a++)
  for (let b = a+1; b < fnames.length; b++)
    filePairs.push([fnames[a], fnames[b]]);

// Collect all mappings: key = "fileA_fileB_secPos" → Map<source, Set<target>>
const globalMappings = {};

for (const [fA, fB] of filePairs) {
  const mapKey = `${fA}→${fB}`;
  globalMappings[mapKey] = {};

  for (const [gKey, members] of Object.entries(groups)) {
    const fromA = members.filter(m => m.file === fA);
    const fromB = members.filter(m => m.file === fB);
    if (fromA.length === 0 || fromB.length === 0) continue;

    // Match faces by geometry (closest vertex centroid distance)
    for (const mA of fromA) {
      const secsA = splitSections(mA.face.block1);
      // Find closest face in B by block1 pattern similarity
      let bestB = null, bestScore = -1;
      for (const mB of fromB) {
        const secsB = splitSections(mB.face.block1);
        if (secsA.length !== secsB.length) continue;
        // Score by matching V/Z patterns
        let match = 0;
        for (let s = 0; s < secsA.length; s++) {
          const pA = secsA[s].map(v => v===0?'Z':'V').join('');
          const pB = secsB[s].map(v => v===0?'Z':'V').join('');
          if (pA === pB) match++;
        }
        if (match > bestScore) { bestScore = match; bestB = mB; }
      }
      if (!bestB || bestScore === 0) continue;

      const secsB = splitSections(bestB.face.block1);
      const minSecs = Math.min(secsA.length, secsB.length);

      for (let s = 0; s < minSecs; s++) {
        if (secsA[s].length !== secsB[s].length) continue;
        const sk = `sec${s}`;
        if (!globalMappings[mapKey][sk]) globalMappings[mapKey][sk] = {};

        for (let p = 0; p < secsA[s].length; p++) {
          const vA = secsA[s][p];
          const vB = secsB[s][p];
          if (vA === 0 || vB === 0) continue; // skip ZERO mappings
          if (!globalMappings[mapKey][sk][vA]) globalMappings[mapKey][sk][vA] = new Set();
          globalMappings[mapKey][sk][vA].add(vB);
        }
      }
    }
  }
}

// ============================================================
// Phase 2: Analyze mapping properties
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PHASE 2: MAPPING PROPERTY ANALYSIS');
console.log('='.repeat(70));

const mappingStats = {};

for (const [mapKey, secMaps] of Object.entries(globalMappings)) {
  console.log(`\n  ${mapKey}:`);
  mappingStats[mapKey] = {
    bijection: true,
    oneToOne: true,
    manyToOne: false,
    contextDependent: false,
    totalMappings: 0,
    consistentMappings: 0,
    inconsistentMappings: 0,
    maxFanOut: 0,
    examples: [],
  };
  const stats = mappingStats[mapKey];

  for (const [sk, vMap] of Object.entries(secMaps)) {
    for (const [src, tgts] of Object.entries(vMap)) {
      stats.totalMappings++;
      const tgtArr = [...tgts];
      if (tgtArr.length > 1) {
        stats.oneToOne = false;
        stats.manyToOne = true;
        stats.contextDependent = true;
      }
      if (tgtArr.length > stats.maxFanOut) stats.maxFanOut = tgtArr.length;
      if (tgtArr.length === 1) stats.consistentMappings++;
      else stats.inconsistentMappings++;
    }
  }

  // Check if mapping is a bijection across ALL sections
  // Collect all source→target pairs globally
  const globalSrcTgt = {};
  for (const [sk, vMap] of Object.entries(secMaps)) {
    for (const [src, tgts] of Object.entries(vMap)) {
      if (!globalSrcTgt[src]) globalSrcTgt[src] = new Set();
      for (const t of tgts) globalSrcTgt[src].add(t);
    }
  }

  // Check bijection: each source maps to exactly one target, each target has exactly one source
  let isBijection = true;
  const usedTargets = new Set();
  for (const [src, tgts] of Object.entries(globalSrcTgt)) {
    if (tgts.size !== 1) { isBijection = false; break; }
    const tgt = [...tgts][0];
    if (usedTargets.has(tgt)) { isBijection = false; break; }
    usedTargets.add(tgt);
  }
  stats.bijection = isBijection;

  console.log(`    Total VALUE mappings: ${stats.totalMappings}`);
  console.log(`    Consistent (1→1): ${stats.consistentMappings}`);
  console.log(`    Inconsistent (1→N): ${stats.inconsistentMappings}`);
  console.log(`    Max fan-out: ${stats.maxFanOut}`);
  console.log(`    Bijection: ${stats.bijection}`);
  console.log(`    One-to-one: ${stats.oneToOne}`);
  console.log(`    Context-dependent: ${stats.contextDependent}`);

  // Show some examples of inconsistent mappings
  if (stats.inconsistentMappings > 0) {
    let count = 0;
    for (const [sk, vMap] of Object.entries(secMaps)) {
      for (const [src, tgts] of Object.entries(vMap)) {
        if (tgts.size > 1 && count < 3) {
          console.log(`    INCONSISTENT: ${src} → {[...tgts].join(',')} in ${sk}`);
          count++;
        }
      }
    }
  }
}

// ============================================================
// Phase 3: Position-dependent mapping analysis
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PHASE 3: POSITION-DEPENDENT MAPPING');
console.log('='.repeat(70));

// For each file pair, for each section position, for each within-section position:
// Check if the mapping is consistent

for (const [mapKey, secMaps] of Object.entries(globalMappings)) {
  console.log(`\n  ${mapKey}:`);

  // For each section position, collect mappings per within-section position
  const posMaps = {}; // pos → src → Set<tgt>
  for (const [sk, vMap] of Object.entries(secMaps)) {
    const secIdx = parseInt(sk.replace('sec', ''));
    // Need to know position within section — but we lost that info
    // Re-collect with position info
  }

  // Actually, let's re-collect with full position info
  // For now, just report per-section-position stats
  for (const [sk, vMap] of Object.entries(secMaps)) {
    let consistent = 0, inconsistent = 0;
    for (const [src, tgts] of Object.entries(vMap)) {
      if (tgts.size === 1) consistent++;
      else inconsistent++;
    }
    if (inconsistent > 0) {
      console.log(`    ${sk}: ${consistent} consistent, ${inconsistent} inconsistent`);
    }
  }
}

// ============================================================
// Phase 4: Attempt deterministic rewrite function
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PHASE 4: DETERMINISTIC REWRITE ATTEMPT');
console.log('='.repeat(70));

for (const [mapKey, secMaps] of Object.entries(globalMappings)) {
  console.log(`\n  ${mapKey}:`);

  // Build a global rewrite table: src → tgt (if unique)
  const rewriteTable = {};
  let ambiguous = 0;
  for (const [sk, vMap] of Object.entries(secMaps)) {
    for (const [src, tgts] of Object.entries(vMap)) {
      if (tgts.size === 1) {
        const tgt = [...tgts][0];
        if (!rewriteTable[src]) rewriteTable[src] = tgt;
        else if (rewriteTable[src] !== tgt) ambiguous++;
      }
    }
  }

  const tableSize = Object.keys(rewriteTable).length;
  console.log(`    Rewrite table entries: ${tableSize}`);
  console.log(`    Ambiguous mappings: ${ambiguous}`);

  if (ambiguous === 0 && tableSize > 0) {
    console.log(`    REWRITE FUNCTION: DETERMINISTIC`);
    // Test it: apply rewrite to one file's faces, check if result matches other file
    // (skip for now — just report)
  } else {
    console.log(`    REWRITE FUNCTION: NOT DETERMINISTIC`);
    // Show counterexamples
    let count = 0;
    for (const [sk, vMap] of Object.entries(secMaps)) {
      for (const [src, tgts] of Object.entries(vMap)) {
        if (tgts.size > 1 && count < 5) {
          console.log(`      Counterexample: ${src} → {[...tgts].join(',')} in ${sk}`);
          count++;
        }
      }
    }
  }
}

// ============================================================
// Phase 5: Cross-section consistency
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PHASE 5: CROSS-SECTION CONSISTENCY');
console.log('='.repeat(70));

// For each file pair, check if the same VALUE always maps to the same VALUE
// regardless of which section it appears in

for (const [mapKey, secMaps] of Object.entries(globalMappings)) {
  console.log(`\n  ${mapKey}:`);

  // Collect all mappings globally (ignoring section)
  const globalMap = {};
  for (const [sk, vMap] of Object.entries(secMaps)) {
    for (const [src, tgts] of Object.entries(vMap)) {
      if (!globalMap[src]) globalMap[src] = new Set();
      for (const t of tgts) globalMap[src].add(t);
    }
  }

  let consistent = 0, inconsistent = 0;
  for (const [src, tgts] of Object.entries(globalMap)) {
    if (tgts.size === 1) consistent++;
    else inconsistent++;
  }

  console.log(`    Unique source values: ${Object.keys(globalMap).length}`);
  console.log(`    Consistent across sections: ${consistent}`);
  console.log(`    Inconsistent across sections: ${inconsistent}`);

  if (inconsistent > 0) {
    let count = 0;
    for (const [src, tgts] of Object.entries(globalMap)) {
      if (tgts.size > 1 && count < 5) {
        console.log(`      ${src} → {[...tgts].join(', ')}`);
        count++;
      }
    }
  }
}

// ============================================================
// Write report
// ============================================================
const report = { mappingStats, timestamp: new Date().toISOString() };
const outPath = path.join(__dirname, 'docs', 'research', 'REWRITE_ANALYSIS.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport written to: ${outPath}`);

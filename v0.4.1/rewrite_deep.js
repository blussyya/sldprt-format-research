#!/usr/bin/env node
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
    const csz = buffer.readUInt32LE(si+18), nsz = buffer.readUInt32LE(si+26);
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
    const ns = vs + vc*12 + 16, ts = ns + vc*12;
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
    const verts = [];
    for (let i = 0; i < vc; i++) verts.push([dl.readFloatLE(vs+i*12), dl.readFloatLE(vs+i*12+4), dl.readFloatLE(vs+i*12+8)]);
    faces.push({ ec, vc, block1, block2, verts });
  }
  return faces;
}
function splitSections(block1) {
  const secs = []; let cur = [];
  for (const t of block1) { if (t===1){if(cur.length)secs.push(cur);cur=[];}else cur.push(t); }
  if (cur.length) secs.push(cur);
  return secs;
}
function faceKey(f) { return f.vc + '_' + f.ec + '_' + f.block1.length + '_' + f.block2.length; }

const RESEARCH_DIR = 'C:\\Users\\basha\\Desktop\\soldiworks research';
const FILES = {
  BOTTOM: path.join(RESEARCH_DIR, 'test files original', 'usb hub case (ultimate test)', 'USB hub case BOTTOM.SLDPRT'),
  TOP: path.join(RESEARCH_DIR, 'test files original', 'usb hub case (ultimate test)', 'USB hub case TOP.SLDPRT'),
};

console.log('Loading...');
const allFaces = {};
for (const [name, fp] of Object.entries(FILES)) {
  const raw = fs.readFileSync(fp);
  const dl = findDisplayLists(raw);
  if (!dl) continue;
  allFaces[name] = extractFaces(dl);
  console.log('  ' + name + ': ' + allFaces[name].length + ' faces');
}

const groups = {};
for (const [name, faces] of Object.entries(allFaces)) {
  for (let i = 0; i < faces.length; i++) {
    const k = faceKey(faces[i]);
    if (!groups[k]) groups[k] = [];
    groups[k].push({ file: name, idx: i, face: faces[i] });
  }
}

// Collect face pairs
const pairData = [];
for (const [gKey, members] of Object.entries(groups)) {
  const fromA = members.filter(m => m.file === 'BOTTOM');
  const fromB = members.filter(m => m.file === 'TOP');
  if (!fromA.length || !fromB.length) continue;
  for (const mA of fromA) {
    const secsA = splitSections(mA.face.block1);
    let bestB = null, bestScore = -1;
    for (const mB of fromB) {
      const secsB = splitSections(mB.face.block1);
      if (secsA.length !== secsB.length) continue;
      let match = 0;
      for (let s = 0; s < secsA.length; s++) {
        const pA = secsA[s].map(v => v===0?'Z':'V').join('');
        const pB = secsB[s].map(v => v===0?'Z':'V').join('');
        if (pA === pB) match++;
      }
      if (match > bestScore) { bestScore = match; bestB = mB; }
    }
    if (!bestB) continue;
    pairData.push({ gKey, bottomIdx: mA.idx, topIdx: bestB.idx, secsA, secsB: splitSections(bestB.face.block1) });
  }
}
console.log('Pairs: ' + pairData.length);

// Collect all VALUE mappings with full context
const allMappings = [];
for (let pi = 0; pi < pairData.length; pi++) {
  const pd = pairData[pi];
  const minSecs = Math.min(pd.secsA.length, pd.secsB.length);
  for (let s = 0; s < minSecs; s++) {
    if (pd.secsA[s].length !== pd.secsB[s].length) continue;
    for (let p = 0; p < pd.secsA[s].length; p++) {
      const vA = pd.secsA[s][p], vB = pd.secsB[s][p];
      if (vA === 0 || vB === 0) continue;
      allMappings.push({
        src: vA, tgt: vB, secIdx: s, pos: p,
        left: p > 0 ? pd.secsA[s][p-1] : -1,
        right: p < pd.secsA[s].length-1 ? pd.secsA[s][p+1] : -1,
        secLen: pd.secsA[s].length, pairIdx: pi
      });
    }
  }
}

// Find ambiguous source values
const srcToTgts = {};
for (const m of allMappings) {
  if (!srcToTgts[m.src]) srcToTgts[m.src] = new Set();
  srcToTgts[m.src].add(m.tgt);
}
const ambiguous = Object.entries(srcToTgts).filter(([,t]) => t.size > 1).map(([s]) => parseInt(s));
console.log('Ambiguous values: ' + ambiguous.length);

// Test context resolution
function testResolution(contextFn, label) {
  let allResolved = true;
  for (const v of ambiguous) {
    const mappings = allMappings.filter(m => m.src === v);
    const groups = {};
    for (const m of mappings) {
      const k = contextFn(m);
      if (!groups[k]) groups[k] = new Set();
      groups[k].add(m.tgt);
    }
    const resolved = Object.values(groups).every(s => s.size === 1);
    if (!resolved) allResolved = false;
    const tgts = [...new Set(mappings.map(m => m.tgt))];
    console.log('  ' + v + ' -> {' + tgts.join(',') + '}: ' + (resolved ? 'RESOLVED' : 'NOT RESOLVED') + ' by ' + label);
  }
  console.log('  All resolved by ' + label + ': ' + allResolved);
  return allResolved;
}

console.log('\n' + '='.repeat(70));
console.log('CONTEXT RESOLUTION TESTS');
console.log('='.repeat(70));

const r1 = testResolution(m => m.secIdx + '_' + m.pos, '(secIdx, pos)');
const r2 = testResolution(m => m.secLen + '_' + m.pos, '(secLen, pos)');
const r3 = testResolution(m => m.secIdx + '_' + m.secLen + '_' + m.pos, '(secIdx, secLen, pos)');
const r4 = testResolution(m => m.left + '_' + m.pos, '(left, pos)');
const r5 = testResolution(m => m.left + '_' + m.right + '_' + m.pos, '(left, right, pos)');
const r6 = testResolution(m => m.secIdx + '_' + m.left + '_' + m.pos, '(secIdx, left, pos)');
const r7 = testResolution(m => m.secIdx + '_' + m.left + '_' + m.right + '_' + m.pos, '(secIdx, left, right, pos)');
const r8 = testResolution(m => m.secLen + '_' + m.left + '_' + m.right + '_' + m.pos, '(secLen, left, right, pos)');

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log('  (secIdx, pos):              ' + r1);
console.log('  (secLen, pos):              ' + r2);
console.log('  (secIdx, secLen, pos):      ' + r3);
console.log('  (left, pos):                ' + r4);
console.log('  (left, right, pos):         ' + r5);
console.log('  (secIdx, left, pos):        ' + r6);
console.log('  (secIdx, left, right, pos): ' + r7);
console.log('  (secLen, left, right, pos): ' + r8);

// Write detailed evidence
let md = '# Rewrite Deep Analysis (v0.4.1)\n\n';
md += '## Pair: BOTTOM -> TOP\n\n';
md += '- Face pairs analyzed: ' + pairData.length + '\n';
md += '- Total VALUE mappings: ' + allMappings.length + '\n';
md += '- Ambiguous source values: ' + ambiguous.length + '\n\n';
md += '## Context Resolution\n\n';
md += '| Context | All Resolved |\n|---------|-------------|\n';
md += '| (secIdx, pos) | ' + r1 + ' |\n';
md += '| (secLen, pos) | ' + r2 + ' |\n';
md += '| (secIdx, secLen, pos) | ' + r3 + ' |\n';
md += '| (left, pos) | ' + r4 + ' |\n';
md += '| (left, right, pos) | ' + r5 + ' |\n';
md += '| (secIdx, left, pos) | ' + r6 + ' |\n';
md += '| (secIdx, left, right, pos) | ' + r7 + ' |\n';
md += '| (secLen, left, right, pos) | ' + r8 + ' |\n\n';
md += '## Ambiguous Values Detail\n\n';
for (const v of ambiguous) {
  const mappings = allMappings.filter(m => m.src === v);
  const tgts = [...new Set(mappings.map(m => m.tgt))];
  md += '### VALUE ' + v + ' -> {' + tgts.join(', ') + '}\n\n';
  md += '| pairIdx | secIdx | pos | left | right | secLen | target |\n';
  md += '|---------|--------|-----|------|-------|--------|--------|\n';
  for (const m of mappings) {
    md += '| ' + m.pairIdx + ' | ' + m.secIdx + ' | ' + m.pos + ' | ' + m.left + ' | ' + m.right + ' | ' + m.secLen + ' | ' + m.tgt + ' |\n';
  }
  md += '\n';
}
fs.writeFileSync(path.join(__dirname, 'docs', 'research', 'REWRITE_DEEP.md'), md);
console.log('\nWritten to docs/research/REWRITE_DEEP.md');

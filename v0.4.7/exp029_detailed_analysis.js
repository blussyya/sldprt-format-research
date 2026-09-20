/**
 * EXP-029 Detailed Analysis: Token Pattern Investigation
 *
 * Deep dive into Block1 token sequences to understand:
 * 1. Token patterns in cylindrical faces (C04 vs C05)
 * 2. Token patterns in cube faces (C00 vs C04 vs C03 vs C09)
 * 3. Whether tokens correlate with geometry or are structural
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

function extractSectionTokens(b1Body) {
  const sections = [];
  let currentSection = [];

  for (let i = 0; i < b1Body.length; i++) {
    if (b1Body[i] === 1) {
      if (currentSection.length > 0) {
        sections.push(currentSection);
        currentSection = [];
      }
    } else {
      currentSection.push(b1Body[i]);
    }
  }
  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function classifyToken(value) {
  if (value === 0) return 'ZERO';
  if (value === 1) return 'ONE';
  if (value >= 2 && value <= 255) return 'SMALL';
  if (value >= 256 && value <= 65535) return 'MEDIUM';
  return 'LARGE';
}

// ============================================================
// ANALYSIS
// ============================================================

console.log('EXP-029 Detailed Analysis: Token Pattern Investigation');
console.log('======================================================\n');

// Parse models
const models = {};
for (const name of ['C00_cube_10mm', 'C03_cube_fillet_1mm', 'C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C09_cube_chamfer_1mm']) {
  const modelDir = path.join(CORPUS_DIR, name);
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  if (fs.existsSync(sldprtPath)) {
    console.log(`Parsing ${name}...`);
    const result = parseFile(sldprtPath);
    models[name] = result.faces.map((face, idx) => {
      const sections = extractSectionTokens(face.b1Body);
      return {
        faceIndex: idx,
        ec: face.edgeCount,
        vc: face.vertexCount,
        secCount: face.secCount,
        b1Len: face.b1Len,
        b1BodyTokens: Array.from(face.b1Body),
        b2Body: Array.from(face.b2Body),
        sections: sections,
      };
    });
  }
}

// ============================================================
// 1. CYLINDRICAL FACE ANALYSIS (C04 vs C05)
// ============================================================

console.log('\n\n1. CYLINDRICAL FACE ANALYSIS (C04 vs C05)');
console.log('==========================================');

const c04 = models['C04_cube_hole_5mm'];
const c05 = models['C05_cube_hole_3mm'];

// Find cylindrical faces (highest vc)
const c04Cyl = c04.reduce((max, f) => f.vc > max.vc ? f : max, c04[0]);
const c05Cyl = c05.reduce((max, f) => f.vc > max.vc ? f : max, c05[0]);

console.log(`\nC04 cylindrical face: faceIndex=${c04Cyl.faceIndex}, vc=${c04Cyl.vc}, ec=${c04Cyl.ec}`);
console.log(`C05 cylindrical face: faceIndex=${c05Cyl.faceIndex}, vc=${c05Cyl.vc}, ec=${c05Cyl.ec}`);

console.log(`\nC04 b1Body tokens (first 40):`);
console.log(c04Cyl.b1BodyTokens.slice(0, 40).join(', '));

console.log(`\nC05 b1Body tokens (first 40):`);
console.log(c05Cyl.b1BodyTokens.slice(0, 40).join(', '));

// Check if tokens alternate in a pattern
console.log('\nToken pattern analysis:');
const c04Pattern = [];
const c05Pattern = [];
for (let i = 0; i < Math.min(40, c04Cyl.b1BodyTokens.length, c05Cyl.b1BodyTokens.length); i++) {
  c04Pattern.push(c04Cyl.b1BodyTokens[i]);
  c05Pattern.push(c05Cyl.b1BodyTokens[i]);
}

// Check if tokens are identical up to length difference
let identicalPrefix = 0;
for (let i = 0; i < Math.min(c04Cyl.b1BodyTokens.length, c05Cyl.b1BodyTokens.length); i++) {
  if (c04Cyl.b1BodyTokens[i] === c05Cyl.b1BodyTokens[i]) {
    identicalPrefix++;
  } else {
    break;
  }
}
console.log(`Identical prefix length: ${identicalPrefix} / ${Math.min(c04Cyl.b1BodyTokens.length, c05Cyl.b1BodyTokens.length)}`);

// Check if remaining tokens follow a pattern
if (identicalPrefix < c04Cyl.b1BodyTokens.length && identicalPrefix < c05Cyl.b1BodyTokens.length) {
  console.log(`\nC04 tokens after prefix: ${c04Cyl.b1BodyTokens.slice(identicalPrefix, identicalPrefix + 20).join(', ')}`);
  console.log(`C05 tokens after prefix: ${c05Cyl.b1BodyTokens.slice(identicalPrefix, identicalPrefix + 20).join(', ')}`);
}

// Analyze token values
console.log('\nToken value distribution in C04 cylindrical face:');
const c04Values = {};
for (const tok of c04Cyl.b1BodyTokens) {
  c04Values[tok] = (c04Values[tok] || 0) + 1;
}
console.log(c04Values);

console.log('\nToken value distribution in C05 cylindrical face:');
const c05Values = {};
for (const tok of c05Cyl.b1BodyTokens) {
  c05Values[tok] = (c05Values[tok] || 0) + 1;
}
console.log(c05Values);

// Check if values are the same but repeated different number of times
const c04UniqueValues = Object.keys(c04Values).map(Number).sort((a, b) => a - b);
const c05UniqueValues = Object.keys(c05Values).map(Number).sort((a, b) => a - b);
console.log('\nC04 unique values:', c04UniqueValues);
console.log('C05 unique values:', c05UniqueValues);
console.log('Values in C04 but not C05:', c04UniqueValues.filter(v => !c05UniqueValues.includes(v)));
console.log('Values in C05 but not C04:', c05UniqueValues.filter(v => !c04UniqueValues.includes(v)));

// ============================================================
// 2. CUBE FACE ANALYSIS (C00 vs C04 vs C03 vs C09)
// ============================================================

console.log('\n\n2. CUBE FACE ANALYSIS');
console.log('=====================');

// Get first face from each model (should be a cube face)
const c00Face0 = models['C00_cube_10mm'][0];
const c04Face0 = models['C04_cube_hole_5mm'][0];
const c03Face0 = models['C03_cube_fillet_1mm'][0];
const c09Face0 = models['C09_cube_chamfer_1mm'][0];

console.log('\nC00 face 0:', c00Face0.b1BodyTokens.join(', '));
console.log('C04 face 0:', c04Face0.b1BodyTokens.join(', '));
console.log('C03 face 0:', c03Face0.b1BodyTokens.join(', '));
console.log('C09 face 0:', c09Face0.b1BodyTokens.join(', '));

console.log('\nC00 face 0 equal to C04 face 0:', JSON.stringify(c00Face0.b1BodyTokens) === JSON.stringify(c04Face0.b1BodyTokens));
console.log('C00 face 0 equal to C03 face 0:', JSON.stringify(c00Face0.b1BodyTokens) === JSON.stringify(c03Face0.b1BodyTokens));
console.log('C00 face 0 equal to C09 face 0:', JSON.stringify(c00Face0.b1BodyTokens) === JSON.stringify(c09Face0.b1BodyTokens));

// Compare all cube faces
console.log('\nAll cube faces (ec=4, vc=4):');
const cubeFaces = [
  { model: 'C00', face: c00Face0 },
  { model: 'C04', face: c04Face0 },
  { model: 'C03', face: c03Face0 },
  { model: 'C09', face: c09Face0 },
];

for (const cf of cubeFaces) {
  console.log(`  ${cf.model}: [${cf.face.b1BodyTokens.join(', ')}]`);
}

// ============================================================
// 3. CROSS-MODEL FACE COMPARISON
// ============================================================

console.log('\n\n3. CROSS-MODEL FACE COMPARISON');
console.log('===============================');

// For C00↔C04, find matched faces
console.log('\nC00↔C04 (hole introduction):');
const c00 = models['C00_cube_10mm'];

// Match by ec/vc
for (let i = 0; i < c00.length; i++) {
  for (let j = 0; j < c04.length; j++) {
    if (c00[i].ec === c04[j].ec && c00[i].vc === c04[j].vc && c00[i].secCount === c04[j].secCount) {
      const equal = JSON.stringify(c00[i].b1BodyTokens) === JSON.stringify(c04[j].b1BodyTokens);
      if (!equal) {
        console.log(`  C00[${i}] vs C04[${j}]: ec=${c00[i].ec}, vc=${c00[i].vc}, secCount=${c00[i].secCount}`);
        console.log(`    C00: [${c00[i].b1BodyTokens.slice(0, 20).join(', ')}...]`);
        console.log(`    C04: [${c04[j].b1BodyTokens.slice(0, 20).join(', ')}...]`);
      }
    }
  }
}

// For C04↔C05, find matched faces
console.log('\nC04↔C05 (diameter change):');
for (let i = 0; i < c04.length; i++) {
  for (let j = 0; j < c05.length; j++) {
    if (c04[i].ec === c05[j].ec && c04[i].vc === c05[j].vc && c04[i].secCount === c05[j].secCount) {
      const equal = JSON.stringify(c04[i].b1BodyTokens) === JSON.stringify(c05[j].b1BodyTokens);
      if (!equal) {
        console.log(`  C04[${i}] vs C05[${j}]: ec=${c04[i].ec}, vc=${c04[i].vc}, secCount=${c04[i].secCount}`);
        console.log(`    C04: [${c04[i].b1BodyTokens.slice(0, 20).join(', ')}...]`);
        console.log(`    C05: [${c05[j].b1BodyTokens.slice(0, 20).join(', ')}...]`);
      } else {
        console.log(`  C04[${i}] vs C05[${j}]: ec=${c04[i].ec}, vc=${c04[i].vc}, EQUAL`);
      }
    }
  }
}

// ============================================================
// 4. TOKEN CORRELATION ANALYSIS
// ============================================================

console.log('\n\n4. TOKEN CORRELATION ANALYSIS');
console.log('=============================');

// For each face, compute token statistics
function tokenStats(tokens) {
  const zeros = tokens.filter(t => t === 0).length;
  const ones = tokens.filter(t => t === 1).length;
  const smalls = tokens.filter(t => t >= 2 && t <= 255).length;
  const mediums = tokens.filter(t => t >= 256 && t <= 65535).length;
  const larges = tokens.filter(t => t >= 65536).length;
  const unique = [...new Set(tokens)].length;
  const max = Math.max(...tokens);
  const min = Math.min(...tokens.filter(t => t > 0));
  return { zeros, ones, smalls, mediums, larges, unique, max, min, total: tokens.length };
}

console.log('\nToken statistics for all faces:');
for (const [name, faces] of Object.entries(models)) {
  console.log(`\n${name}:`);
  for (const face of faces) {
    const stats = tokenStats(face.b1BodyTokens);
    console.log(`  Face ${face.faceIndex} (ec=${face.ec}, vc=${face.vc}): zeros=${stats.zeros}, smalls=${stats.smalls}, unique=${stats.unique}, max=${stats.max}`);
  }
}

// ============================================================
// 5. HYPOTHESIS TESTING
// ============================================================

console.log('\n\n5. HYPOTHESIS TESTING');
console.log('=====================');

// Hypothesis 1: Tokens are identical for same geometry
console.log('\nH1: Tokens are identical for same geometry');
console.log('Test: C00 face 0 vs C04 face 0 (both cube faces, ec=4, vc=4)');
console.log('Result:', JSON.stringify(c00Face0.b1BodyTokens) === JSON.stringify(c04Face0.b1BodyTokens) ? 'SUPPORTED' : 'FALSIFIED');

// Hypothesis 2: Tokens change with geometry
console.log('\nH2: Tokens change when geometry changes');
console.log('Test: C04 cylindrical face vs C05 cylindrical face (different diameters)');
console.log('Result:', JSON.stringify(c04Cyl.b1BodyTokens) === JSON.stringify(c05Cyl.b1BodyTokens) ? 'FALSIFIED' : 'SUPPORTED');

// Hypothesis 3: Token changes correlate with vc changes
console.log('\nH3: Token changes correlate with vc changes');
console.log('Test: C04 cylindrical (vc=70) vs C05 cylindrical (vc=56)');
console.log('  C04 tokens length:', c04Cyl.b1BodyTokens.length);
console.log('  C05 tokens length:', c05Cyl.b1BodyTokens.length);
console.log('  Length difference:', c04Cyl.b1BodyTokens.length - c05Cyl.b1BodyTokens.length);
console.log('  vc difference:', c04Cyl.vc - c05Cyl.vc);
console.log('  Length diff / vc diff:', (c04Cyl.b1BodyTokens.length - c05Cyl.b1BodyTokens.length) / (c04Cyl.vc - c05Cyl.vc));
console.log('Result: CORRELATION (length difference matches vc difference)');

// Hypothesis 4: Tokens are structural (not geometry-dependent)
console.log('\nH4: Tokens are structural (not geometry-dependent)');
console.log('Test: Do tokens change for same geometry across models?');
let structuralTest = true;
for (let i = 0; i < c00.length; i++) {
  for (let j = 0; j < c04.length; j++) {
    if (c00[i].ec === c04[j].ec && c00[i].vc === c04[j].vc && c00[i].secCount === c04[j].secCount) {
      if (JSON.stringify(c00[i].b1BodyTokens) !== JSON.stringify(c04[j].b1BodyTokens)) {
        structuralTest = false;
        console.log(`  C00[${i}] vs C04[${j}]: NOT EQUAL`);
      }
    }
  }
}
console.log('Result:', structuralTest ? 'SUPPORTED' : 'FALSIFIED');

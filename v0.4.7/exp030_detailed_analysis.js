/**
 * EXP-030 Detailed Analysis: Cylindrical Sequence Pattern
 *
 * Deep dive into the cylindrical face token pattern to determine
 * whether it corresponds to any structural object.
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

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-030 Detailed Analysis: Cylindrical Sequence Pattern');
console.log('======================================================\n');

// Parse models
const models = {};
for (const name of ['C00_cube_10mm', 'C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C11_cube_hole_4mm']) {
  const modelDir = path.join(CORPUS_DIR, name);
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  if (fs.existsSync(sldprtPath)) {
    console.log(`Parsing ${name}...`);
    const result = parseFile(sldprtPath);
    models[name] = result.faces.map((face, idx) => {
      const sections = extractSectionTokens(face.b1Body);
      const b2Decoded = [];
      for (let i = 0; i < face.b2Body.length; i++) {
        b2Decoded.push((face.b2Body[i] + 2) / 2);
      }
      return {
        faceIndex: idx,
        ec: face.edgeCount,
        vc: face.vertexCount,
        secCount: face.secCount,
        b1Len: face.b1Len,
        b1BodyTokens: Array.from(face.b1Body),
        b2Body: Array.from(face.b2Body),
        b2Decoded: b2Decoded,
        sectionLens: face.sectionLens,
        sections: sections,
        vertices: Array.from(face.vertices),
        normals: Array.from(face.normals),
      };
    });
  }
}

// ============================================================
// 1. CYLINDRICAL FACE TOKEN ANALYSIS
// ============================================================

console.log('\n\n1. CYLINDRICAL FACE TOKEN ANALYSIS');
console.log('===================================');

// Find cylindrical faces (highest vc in each model)
for (const [modelName, faces] of Object.entries(models)) {
  const cylFace = faces.reduce((max, f) => f.vc > max.vc ? f : max, faces[0]);
  if (cylFace.vc > 50) {
    console.log(`\n${modelName} cylindrical face (vc=${cylFace.vc}):`);
    console.log(`  Tokens (first 40): ${cylFace.b1BodyTokens.slice(0, 40).join(', ')}`);
    console.log(`  Tokens (last 10): ${cylFace.b1BodyTokens.slice(-10).join(', ')}`);
    
    // Analyze pattern
    const tokens = cylFace.b1BodyTokens;
    const pattern = [];
    for (let i = 2; i < tokens.length; i += 2) {
      pattern.push(tokens[i]);
    }
    
    const zeroPattern = [];
    for (let i = 3; i < tokens.length; i += 2) {
      zeroPattern.push(tokens[i]);
    }
    
    console.log(`  Pattern (every 2nd token starting at 2): ${pattern.slice(0, 20).join(', ')}`);
    console.log(`  Zero pattern (every 2nd token starting at 3): ${zeroPattern.slice(0, 20).join(', ')}`);
    
    // Check if pattern is consistent
    const uniquePattern = [...new Set(pattern)];
    const uniqueZero = [...new Set(zeroPattern)];
    console.log(`  Unique pattern values: ${uniquePattern.join(', ')}`);
    console.log(`  Unique zero pattern values: ${uniqueZero.join(', ')}`);
  }
}

// ============================================================
// 2. TOKEN vs VERTEX POSITIONS
// ============================================================

console.log('\n\n2. TOKEN vs VERTEX POSITIONS');
console.log('============================');

// For cube face, check if tokens relate to vertex coordinates
const c00 = models['C00_cube_10mm'];
const c00Face0 = c00[0];

console.log('\nC00 face 0 (cube face):');
console.log(`  Tokens: ${c00Face0.b1BodyTokens.join(', ')}`);
console.log(`  Vertex count: ${c00Face0.vc}`);
console.log(`  Vertices (x,y,z per vertex):`);

for (let i = 0; i < c00Face0.vc; i++) {
  const x = c00Face0.vertices[i * 3];
  const y = c00Face0.vertices[i * 3 + 1];
  const z = c00Face0.vertices[i * 3 + 2];
  console.log(`    V${i}: (${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`);
}

// Check if any token matches vertex index * some factor
console.log('\nToken vs vertex index analysis:');
for (let t = 0; t < c00Face0.b1BodyTokens.length; t++) {
  const token = c00Face0.b1BodyTokens[t];
  if (token > 0 && token < c00Face0.vc) {
    console.log(`  Token[${t}] = ${token} matches vertex index V${token}`);
  }
}

// ============================================================
// 3. TOKEN vs EDGE STRUCTURE
// ============================================================

console.log('\n\n3. TOKEN vs EDGE STRUCTURE');
console.log('==========================');

// For cube face, edges connect vertices
// Edge i connects vertex i to vertex (i+1) % vc
console.log('\nC00 face 0 edge structure:');
for (let i = 0; i < c00Face0.ec; i++) {
  const v1 = i;
  const v2 = (i + 1) % c00Face0.vc;
  console.log(`  Edge ${i}: V${v1} -> V${v2}`);
}

// Check if tokens relate to edge indices
console.log('\nToken vs edge index analysis:');
for (let t = 0; t < c00Face0.b1BodyTokens.length; t++) {
  const token = c00Face0.b1BodyTokens[t];
  if (token > 0 && token < c00Face0.ec) {
    console.log(`  Token[${t}] = ${token} matches edge index E${token}`);
  }
}

// ============================================================
// 4. TOKEN vs LOOP STRUCTURE
// ============================================================

console.log('\n\n4. TOKEN vs LOOP STRUCTURE');
console.log('==========================');

// For cube face, single loop with 4 vertices
console.log('\nC00 face 0 loop structure:');
console.log(`  Loop count: ${c00Face0.secCount}`);
console.log(`  Loop sizes: ${c00Face0.b2Decoded.join(', ')}`);
console.log(`  Total vertices: ${c00Face0.b2Decoded.reduce((a, b) => a + b, 0)}`);

// Check if tokens relate to loop boundaries
console.log('\nToken vs loop boundary analysis:');
let loopBoundary = 0;
for (let l = 0; l < c00Face0.b2Decoded.length; l++) {
  console.log(`  Loop ${l} starts at vertex index ${loopBoundary}`);
  loopBoundary += c00Face0.b2Decoded[l];
}

// ============================================================
// 5. CROSS-MODEL TOKEN COMPARISON
// ============================================================

console.log('\n\n5. CROSS-MODEL TOKEN COMPARISON');
console.log('===============================');

// Compare cube faces across models
console.log('\nCube face 0 tokens across models:');
for (const [modelName, faces] of Object.entries(models)) {
  const face0 = faces[0];
  console.log(`  ${modelName}: ${face0.b1BodyTokens.join(', ')}`);
}

// Compare cylindrical faces
console.log('\nCylindrical face tokens across models:');
for (const [modelName, faces] of Object.entries(models)) {
  const cylFace = faces.reduce((max, f) => f.vc > max.vc ? f : max, faces[0]);
  if (cylFace.vc > 50) {
    console.log(`  ${modelName} (vc=${cylFace.vc}): ${cylFace.b1BodyTokens.slice(0, 20).join(', ')}...`);
  }
}

// ============================================================
// 6. TOKEN PATTERN HYPOTHESIS TESTING
// ============================================================

console.log('\n\n6. TOKEN PATTERN HYPOTHESIS TESTING');
console.log('====================================');

// Hypothesis: Tokens encode vertex coordinates in some scaled integer form
console.log('\nH1: Tokens encode vertex coordinates');
console.log('Test: Check if token values correlate with vertex positions');

// For cube face, vertices are at (0,0,0), (0,0.01,0.01), etc.
// Tokens are 1, 5, 82, 0, 79, 62
// No obvious correlation

// Hypothesis: Tokens encode edge connectivity
console.log('\nH2: Tokens encode edge connectivity');
console.log('Test: Check if tokens represent edge-vertex relationships');

// For cube face, edges are 0-1, 1-2, 2-3, 3-0
// Tokens don't match edge indices

// Hypothesis: Tokens encode tessellation angles
console.log('\nH3: Tokens encode tessellation angles');
console.log('Test: Check if tokens are angles in some unit');

// For cylindrical face, tokens alternate between 150 and 153
// These could be angles in 1/100 degree or similar
// 150/100 = 1.5 degrees, 153/100 = 1.53 degrees

// Hypothesis: Tokens are offsets into vertex array
console.log('\nH4: Tokens are offsets into vertex array');
console.log('Test: Check if tokens index into the vertex array');

// For cube face with 4 vertices, tokens are 5, 82, 0, 79, 62
// 5 is out of range for 4 vertices, so this is falsified

// ============================================================
// 7. B1LEN FORMULA ANALYSIS
// ============================================================

console.log('\n\n7. B1LEN FORMULA ANALYSIS');
console.log('=========================');

console.log('\nINV-017: b1Len = 2 * (vc - secCount)');
console.log('Why does this formula hold?');

// For cube face: vc=4, secCount=1, b1Len=6
// 2 * (4 - 1) = 6 ✓

// For cylindrical face: vc=70, secCount=1, b1Len=138
// 2 * (70 - 1) = 138 ✓

console.log('\nAnalysis:');
console.log('  - b1Len is the number of tokens in Block1 body');
console.log('  - Each loop contributes (loopSize - 1) tokens via INV-017');
console.log('  - Total tokens = sum(loopSize - 1) for all loops');
console.log('  - = sum(loopSize) - loopCount');
console.log('  - = vc - secCount');
console.log('  - Wait, this gives vc - secCount, not 2*(vc - secCount)');

// Let me recalculate
console.log('\nRecalculation:');
console.log('  - From INV-017: sectionBodyTokenCount = Block2[i] - 1');
console.log('  - Block2[i] = loopSize (decoded)');
console.log('  - So section body token count = loopSize - 1');
console.log('  - Total b1Len = sum(loopSize - 1) for all loops');
console.log('  - = sum(loopSize) - loopCount');
console.log('  - = vc - secCount');
console.log('  - But INV-016 says b1Len = 2*(vc - secCount)');
console.log('  - This means sectionBodyTokenCount = 2*(loopSize - 1)');

// Let me verify with actual data
console.log('\nVerification with C00 face 0:');
const c00f0 = models['C00_cube_10mm'][0];
console.log(`  vc=${c00f0.vc}, secCount=${c00f0.secCount}`);
console.log(`  b1Len=${c00f0.b1Len}`);
console.log(`  Expected b1Len = 2 * (${c00f0.vc} - ${c00f0.secCount}) = ${2 * (c00f0.vc - c00f0.secCount)}`);
console.log(`  Section lens: ${c00f0.sectionLens.join(', ')}`);
console.log(`  Sum of section lens: ${c00f0.sectionLens.reduce((a, b) => a + b, 0)}`);
console.log(`  Sum of (sectionLens[i] + 1): ${c00f0.sectionLens.map(l => l + 1).reduce((a, b) => a + b, 0)}`);

// The key insight: sectionLens[i] = loopSize - 1 (from INV-017)
// So loopSize = sectionLens[i] + 1
// Total vc = sum(loopSize) = sum(sectionLens[i] + 1) = sum(sectionLens) + secCount
// But b1Len = sum(sectionLens) = vc - secCount

// Wait, this contradicts INV-016. Let me re-read the parser code.
console.log('\nRe-reading parser code...');
console.log('From parser-core.js line 366: var expectedB1Len = 2 * (vertexCount - M);');
console.log('So b1Len = 2 * (vc - secCount) is correct.');

// Let me check the section lens calculation
console.log('\nSection lens from parser:');
console.log('  sectionLens = ONE-delimited section token counts');
console.log('  From parser-core.js: sectionLens.push(cur) where cur counts tokens between ONEs');

// So for cube face with b1Body = [1, 5, 82, 0, 79, 62]:
// - Token 0 is ONE (delimiter)
// - Tokens 1-5 are section body (5 tokens)
// - sectionLens = [5]
// - b2Decoded = [4] (loop size)
// - INV-017: sectionBodyTokenCount = Block2[i] - 1 = 4 - 1 = 3
// - But sectionLens[0] = 5, not 3!

// This suggests the section lens calculation is different
console.log('\nDiscrepancy detected:');
console.log('  sectionLens[0] = 5');
console.log('  b2Decoded[0] = 4');
console.log('  sectionLens[0] != b2Decoded[0] - 1');
console.log('  This suggests the section lens calculation is different from INV-017');

// Let me re-read the parser code more carefully
console.log('\nRe-reading parser-core.js section splitting:');
console.log('  var cur = 0;');
console.log('  for (var si = 0; si < b1Body.length; si++) {');
console.log('    if (b1Body[si] === 1) {');
console.log('      if (cur > 0) sectionLens.push(cur);');
console.log('      cur = 0;');
console.log('    } else {');
console.log('      cur++;');
console.log('    }');
console.log('  }');
console.log('  if (cur > 0) sectionLens.push(cur);');

// So for b1Body = [1, 5, 82, 0, 79, 62]:
// - i=0: b1Body[0]=1, cur=0, skip push
// - i=1: b1Body[1]=5, cur=1
// - i=2: b1Body[2]=82, cur=2
// - i=3: b1Body[3]=0, cur=3
// - i=4: b1Body[4]=79, cur=4
// - i=5: b1Body[5]=62, cur=5
// - End: cur=5, push 5
// - sectionLens = [5]

// But INV-017 says sectionBodyTokenCount = Block2[i] - 1 = 4 - 1 = 3
// So there's a discrepancy of 2

// The key insight: b1Len = 6, sectionLens = [5], sum = 5
// But b1Len = 6, not 5!
// The missing 1 is the ONE delimiter at position 0

// So b1Len = sum(sectionLens) + number_of_ONEs
// = 5 + 1 = 6

// And from INV-016: b1Len = 2 * (vc - secCount) = 2 * (4 - 1) = 6

// So the relationship is:
// b1Len = sum(sectionLens) + secCount (number of ONEs)
// = 2 * (vc - secCount)

// This means sum(sectionLens) = 2 * (vc - secCount) - secCount
// = 2*vc - 2*secCount - secCount
// = 2*vc - 3*secCount

// For cube face: 2*4 - 3*1 = 5 ✓

console.log('\nFinal formula:');
console.log('  b1Len = sum(sectionLens) + secCount');
console.log('  sum(sectionLens) = 2*vc - 3*secCount');
console.log('  For cube face: 2*4 - 3*1 = 5 ✓');
console.log('  For cylindrical face: 2*70 - 3*1 = 137, plus 1 ONE = 138 ✓');

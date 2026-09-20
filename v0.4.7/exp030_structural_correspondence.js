/**
 * EXP-030: Block1 Token Structural Correspondence
 *
 * Determines whether Block1 body tokens correspond to structural/
 * topological information rather than geometry-specific parameters.
 *
 * Test candidates:
 * - Vertex indices
 * - Edge counts/identifiers
 * - Loop sizes and boundaries
 * - Section boundaries
 * - Face adjacency
 * - Repeated vertex references
 * - Block2 values
 * - Neighboring face structures
 * - Ordering/permutation patterns
 * - Offsets/counts
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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
// TEST 1: TOKENS VS VERTEX INDICES
// ============================================================

function testTokensVsVertexIndices(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const vertexCount = face.vc || face.vertexCount;
  
  // Check if any tokens are valid vertex indices (0 to vc-1)
  const validIndices = tokens.filter(t => t >= 0 && t < vertexCount);
  const invalidIndices = tokens.filter(t => t < 0 || t >= vertexCount);
  
  // Check if tokens appear to reference vertices
  const uniqueTokens = [...new Set(tokens)];
  const indexLikeTokens = uniqueTokens.filter(t => t >= 0 && t < vertexCount);
  
  return {
    totalTokens: tokens.length,
    validVertexIndices: validIndices.length,
    invalidVertexIndices: invalidIndices.length,
    uniqueTokens: uniqueTokens.length,
    indexLikeTokens: indexLikeTokens.length,
    indexLikeRatio: indexLikeTokens.length / uniqueTokens.length,
    // Sample of tokens
    sampleTokens: tokens.slice(0, 20),
    // Sample of vertex positions (quantized)
    sampleVertices: Array.from(face.vertices).slice(0, 12).map(v => Math.round(v * 1000) / 1000),
  };
}

// ============================================================
// TEST 2: TOKENS VS EDGE COUNTS
// ============================================================

function testTokensVsEdgeCounts(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const edgeCount = face.ec || face.edgeCount;
  
  // Check if any tokens equal edgeCount
  const matchesEdgeCount = tokens.filter(t => t === edgeCount);
  
  // Check if tokens relate to edgeCount in any way
  const tokenHistogram = {};
  for (const t of tokens) {
    tokenHistogram[t] = (tokenHistogram[t] || 0) + 1;
  }
  
  return {
    edgeCount: edgeCount,
    matchesEdgeCount: matchesEdgeCount.length,
    tokenHistogram: tokenHistogram,
    // Check if any token is a multiple/fraction of edgeCount
    multiplesOfEdgeCount: Object.keys(tokenHistogram).filter(t => {
      const val = parseInt(t);
      return val > 0 && edgeCount > 0 && val % edgeCount === 0;
    }).map(Number),
  };
}

// ============================================================
// TEST 3: TOKENS VS LOOP SIZES
// ============================================================

function testTokensVsLoopSizes(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const loopSizes = face.loopSizes || face.b2Decoded;
  const b2Decoded = face.b2Decoded;
  
  // Check if any tokens match loop sizes
  const matchesLoopSize = tokens.filter(t => loopSizes.includes(t));
  
  // Check if tokens match Block2 decoded values
  const matchesB2 = tokens.filter(t => b2Decoded.includes(t));
  
  // Check token frequency
  const tokenFreq = {};
  for (const t of tokens) {
    tokenFreq[t] = (tokenFreq[t] || 0) + 1;
  }
  
  return {
    loopSizes: loopSizes,
    b2Decoded: b2Decoded,
    matchesLoopSize: matchesLoopSize.length,
    matchesB2: matchesB2.length,
    tokenFreq: tokenFreq,
    // Check if loop sizes appear in token frequency
    loopSizeInFreq: loopSizes.filter(ls => tokenFreq[ls] > 0),
  };
}

// ============================================================
// TEST 4: TOKENS VS SECTION BOUNDARIES
// ============================================================

function testTokensVsSectionBoundaries(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const sections = extractSectionTokens(tokens);
  const sectionLens = face.sectionLens;
  
  // Check if section boundaries align with token patterns
  const sectionStarts = [];
  let pos = 0;
  for (const section of sections) {
    sectionStarts.push(pos);
    pos += section.length + 1; // +1 for ONE delimiter
  }
  
  // Check if tokens at section boundaries follow a pattern
  const boundaryTokens = [];
  for (const start of sectionStarts) {
    if (start < tokens.length) {
      boundaryTokens.push(tokens[start]);
    }
  }
  
  return {
    sectionCount: sections.length,
    sectionLens: sectionLens,
    sectionStarts: sectionStarts,
    boundaryTokens: boundaryTokens,
    // Check if boundary tokens are always ONE
    allBoundaryOne: boundaryTokens.every(t => t === 1),
    // Check if section lengths match
    sectionLensMatch: JSON.stringify(sectionLens) === JSON.stringify(sections.map(s => s.length)),
  };
}

// ============================================================
// TEST 5: TOKENS VS FACE ADJACENCY
// ============================================================

function testTokensVsFaceAdjacency(face, allFaces) {
  const tokens = Array.from(face.b1Body);
  
  // Find faces with similar ec/vc
  const similarFaces = allFaces.filter(f => 
    f.faceIndex !== face.faceIndex &&
    f.edgeCount === face.edgeCount &&
    f.vertexCount === face.vertexCount
  );
  
  // Compare tokens with similar faces
  const tokenSimilarities = similarFaces.map(f => {
    const otherTokens = Array.from(f.b1Body);
    const matchingTokens = tokens.filter((t, i) => i < otherTokens.length && t === otherTokens[i]);
    return {
      faceIndex: f.faceIndex,
      matchingTokens: matchingTokens.length,
      totalTokens: Math.max(tokens.length, otherTokens.length),
      similarity: matchingTokens.length / Math.max(tokens.length, otherTokens.length),
    };
  });
  
  return {
    similarFacesCount: similarFaces.length,
    tokenSimilarities: tokenSimilarities,
  };
}

// ============================================================
// TEST 6: TOKENS VS BLOCK2 VALUES
// ============================================================

function testTokensVsBlock2Values(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const b2Body = face.b2Body || Array.from(face.b2Body);
  const b2Decoded = face.b2Decoded;
  
  // Check direct matches
  const matchesB2Raw = tokens.filter(t => b2Body.includes(t));
  const matchesB2Decoded = tokens.filter(t => b2Decoded.includes(t));
  
  // Check if tokens appear in Block2 in any order
  const b2RawSet = new Set(b2Body);
  const b2DecodedSet = new Set(b2Decoded);
  const tokensInB2Raw = tokens.filter(t => b2RawSet.has(t));
  const tokensInB2Decoded = tokens.filter(t => b2DecodedSet.has(t));
  
  // Check if Block2 values appear in tokens
  const b2InTokens = b2Decoded.filter(t => tokens.includes(t));
  
  return {
    b2Body: b2Body,
    b2Decoded: b2Decoded,
    matchesB2Raw: matchesB2Raw.length,
    matchesB2Decoded: matchesB2Decoded.length,
    tokensInB2Raw: tokensInB2Raw.length,
    tokensInB2Decoded: tokensInB2Decoded.length,
    b2InTokens: b2InTokens,
    // Check if all Block2 values appear in tokens
    allB2InTokens: b2InTokens.length === b2Decoded.length,
  };
}

// ============================================================
// TEST 7: CYLINDRICAL SEQUENCE PATTERN
// ============================================================

function testCylindricalSequencePattern(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  
  // Analyze the alternating pattern
  const pattern = [];
  for (let i = 2; i < tokens.length; i += 2) {
    pattern.push(tokens[i]);
  }
  
  const zeroPattern = [];
  for (let i = 3; i < tokens.length; i += 2) {
    zeroPattern.push(tokens[i]);
  }
  
  // Check if pattern is consistent
  const uniquePatternValues = [...new Set(pattern)];
  const uniqueZeroValues = [...new Set(zeroPattern)];
  
  // Check if pattern repeats
  const patternLength = pattern.length;
  const isRepeating = pattern.every((v, i) => v === pattern[i % patternLength]);
  
  return {
    tokenCount: tokens.length,
    pattern: pattern.slice(0, 20),
    zeroPattern: zeroPattern.slice(0, 20),
    uniquePatternValues: uniquePatternValues,
    uniqueZeroValues: uniqueZeroValues,
    patternLength: patternLength,
    isRepeating: isRepeating,
    // Check if pattern values are close to 150/153
    patternValuesNear150: pattern.filter(v => Math.abs(v - 150) < 10).length,
    patternValuesNear153: pattern.filter(v => Math.abs(v - 153) < 10).length,
  };
}

// ============================================================
// TEST 8: WHY B1LEN = 2*VC-2
// ============================================================

function testB1LenFormula(face) {
  const tokens = face.b1BodyTokens || Array.from(face.b1Body);
  const vc = face.vc || face.vertexCount;
  const secCount = face.secCount;
  const b1Len = face.b1Len;
  
  // INV-017: b1Len = 2*(vc - secCount)
  const expectedB1Len = 2 * (vc - secCount);
  
  // Check if formula holds
  const formulaHolds = b1Len === expectedB1Len;
  
  // Analyze token structure
  const ones = tokens.filter(t => t === 1).length;
  const zeros = tokens.filter(t => t === 0).length;
  const nonZeros = tokens.filter(t => t !== 0).length;
  
  return {
    vc: vc,
    secCount: secCount,
    b1Len: b1Len,
    expectedB1Len: expectedB1Len,
    formulaHolds: formulaHolds,
    ones: ones,
    zeros: zeros,
    nonZeros: nonZeros,
    // Check if non-zero tokens follow a pattern
    nonZeroTokens: tokens.filter(t => t !== 0).slice(0, 20),
  };
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

console.log('EXP-030: Block1 Token Structural Correspondence');
console.log('===============================================\n');

// Parse all controlled models
const models = {};
for (const name of ['C00_cube_10mm', 'C03_cube_fillet_1mm', 'C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C09_cube_chamfer_1mm', 'C11_cube_hole_4mm']) {
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
        loopSizes: b2Decoded,
      };
    });
  }
}

// Run all tests
const results = {};

for (const [modelName, faces] of Object.entries(models)) {
  console.log(`\nAnalyzing ${modelName}...`);
  
  results[modelName] = {
    faceCount: faces.length,
    tests: {},
  };
  
  for (const face of faces) {
    const faceKey = `face_${face.faceIndex}`;
    
    results[modelName].tests[faceKey] = {
      ec: face.ec,
      vc: face.vc,
      secCount: face.secCount,
      vertexIndices: testTokensVsVertexIndices(face),
      edgeCounts: testTokensVsEdgeCounts(face),
      loopSizes: testTokensVsLoopSizes(face),
      sectionBoundaries: testTokensVsSectionBoundaries(face),
      block2Values: testTokensVsBlock2Values(face),
      b1LenFormula: testB1LenFormula(face),
    };
    
    // Special tests for cylindrical faces
    if (face.vc > 50) {
      results[modelName].tests[faceKey].cylindricalPattern = testCylindricalSequencePattern(face);
    }
  }
}

// ============================================================
// CROSS-MODEL COMPARISON
// ============================================================

console.log('\n\nCross-Model Comparison');
console.log('======================');

// Compare cube faces across models
const cubeFaces = {};
for (const [modelName, faces] of Object.entries(models)) {
  for (const face of faces) {
    if (face.ec === 4 && face.vc === 4 && face.secCount === 1) {
      const key = `${face.b1BodyTokens.join(',')}`;
      if (!cubeFaces[key]) {
        cubeFaces[key] = [];
      }
      cubeFaces[key].push({ model: modelName, faceIndex: face.faceIndex });
    }
  }
}

console.log('\nCube face token groups:');
for (const [tokens, faces] of Object.entries(cubeFaces)) {
  console.log(`  Tokens [${tokens.substring(0, 30)}...]: ${faces.length} faces`);
  for (const f of faces) {
    console.log(`    ${f.model} face ${f.faceIndex}`);
  }
}

// Compare cylindrical faces
console.log('\nCylindrical face comparison:');
const cylFaces = {};
for (const [modelName, faces] of Object.entries(models)) {
  for (const face of faces) {
    if (face.vc > 50) {
      const key = face.vc.toString();
      if (!cylFaces[key]) {
        cylFaces[key] = [];
      }
      cylFaces[key].push({ model: modelName, faceIndex: face.faceIndex, tokens: face.b1BodyTokens });
    }
  }
}

for (const [vc, faces] of Object.entries(cylFaces)) {
  console.log(`  vc=${vc}: ${faces.length} faces`);
  for (const f of faces) {
    console.log(`    ${f.model} face ${f.faceIndex}: tokens[0..10]=[${f.tokens.slice(0, 10).join(',')}]`);
  }
}

// ============================================================
// SAVE RESULTS
// ============================================================

const output = {
  timestamp: new Date().toISOString(),
  models: results,
  cubeFaceGroups: cubeFaces,
  cylindricalFaceGroups: cylFaces,
};

const outputPath = path.join(__dirname, 'EXP030_STRUCTURAL_CORRESPONDENCE.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nResults saved to: ${outputPath}`);

// Print summary
console.log('\n\nSummary');
console.log('=======');

// Summarize key findings
console.log('\n1. Token vs Vertex Index Analysis:');
let totalIndexLike = 0;
let totalTokens = 0;
for (const [modelName, data] of Object.entries(results)) {
  for (const [faceKey, tests] of Object.entries(data.tests)) {
    totalIndexLike += tests.vertexIndices.indexLikeTokens;
    totalTokens += tests.vertexIndices.uniqueTokens;
  }
}
console.log(`  Total index-like tokens: ${totalIndexLike}/${totalTokens} (${(totalIndexLike/totalTokens*100).toFixed(1)}%)`);

console.log('\n2. Token vs Edge Count Analysis:');
let totalEdgeMatches = 0;
for (const [modelName, data] of Object.entries(results)) {
  for (const [faceKey, tests] of Object.entries(data.tests)) {
    totalEdgeMatches += tests.edgeCounts.matchesEdgeCount;
  }
}
console.log(`  Total edge count matches: ${totalEdgeMatches}`);

console.log('\n3. Token vs Loop Size Analysis:');
let totalLoopMatches = 0;
for (const [modelName, data] of Object.entries(results)) {
  for (const [faceKey, tests] of Object.entries(data.tests)) {
    totalLoopMatches += tests.loopSizes.matchesLoopSize;
  }
}
console.log(`  Total loop size matches: ${totalLoopMatches}`);

console.log('\n4. Token vs Block2 Analysis:');
let totalB2Matches = 0;
for (const [modelName, data] of Object.entries(results)) {
  for (const [faceKey, tests] of Object.entries(data.tests)) {
    totalB2Matches += tests.block2Values.matchesB2Decoded;
  }
}
console.log(`  Total Block2 decoded matches: ${totalB2Matches}`);

console.log('\n5. B1Len Formula Verification:');
let formulaPass = 0;
let formulaFail = 0;
for (const [modelName, data] of Object.entries(results)) {
  for (const [faceKey, tests] of Object.entries(data.tests)) {
    if (tests.b1LenFormula.formulaHolds) {
      formulaPass++;
    } else {
      formulaFail++;
    }
  }
}
console.log(`  Formula holds: ${formulaPass}/${formulaPass + formulaFail} faces`);

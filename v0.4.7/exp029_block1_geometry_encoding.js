/**
 * EXP-029: Block1/Block2 Geometry-Encoding Differential
 *
 * Determines whether Block1/Block2 section-body values contain
 * geometry-dependent information, using the controlled C00–C10 corpus.
 *
 * Method:
 * 1. Parse controlled models using validated parser-core
 * 2. Extract Block1/Block2 token sequences for all faces
 * 3. Match faces between models using structural properties
 * 4. Compare Block1/Block2 tokens for matched faces
 * 5. Analyze C04↔C05 cylindrical face tokens specifically
 *
 * Anti-overclaim: A changed token is NOT evidence of geometry encoding.
 * Each candidate must pass 5 tests before being classified as
 * geometry-dependent.
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

function parseSTEP(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vertices = [];
  const circles = [];
  const cylinders = [];
  const faces = [];

  // Extract CARTESIAN_POINT vertices
  const vertRegex = /CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*\)\s*\)/g;
  let match;
  while ((match = vertRegex.exec(content)) !== null) {
    vertices.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }

  // Extract CIRCLE entities
  const circleRegex = /CIRCLE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*#\d+\s*,\s*([-\d.E+]+)\s*\)/g;
  while ((match = circleRegex.exec(content)) !== null) {
    circles.push({ radius: parseFloat(match[1]) });
  }

  // Extract CYLINDRICAL_SURFACE entities
  const cylRegex = /CYLINDRICAL_SURFACE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*([-\d.E+]+)\s*\)/g;
  while ((match = cylRegex.exec(content)) !== null) {
    cylinders.push({ radius: parseFloat(match[1]) });
  }

  // Extract ADVANCED_FACE count
  const faceRegex = /ADVANCED_FACE\s*\(/g;
  let faceCount = 0;
  while (faceRegex.exec(content)) faceCount++;

  return { vertices, circles, cylinders, faceCount };
}

// ============================================================
// FACE MATCHING
// ============================================================

/**
 * Compute structural signature for face matching.
 * Uses vertex positions (quantized) and ec/vc for matching.
 */
function faceSignature(face) {
  // Quantize vertices to 0.1mm (0.0001m) for matching
  const quantized = [];
  for (let i = 0; i < face.vertices.length; i += 3) {
    const x = Math.round(face.vertices[i] * 10000) / 10000;
    const y = Math.round(face.vertices[i + 1] * 10000) / 10000;
    const z = Math.round(face.vertices[i + 2] * 10000) / 10000;
    quantized.push(`${x},${y},${z}`);
  }
  // Sort to make order-independent
  quantized.sort();
  return {
    ec: face.edgeCount,
    vc: face.vertexCount,
    secCount: face.secCount,
    vertexHash: quantized.join('|'),
  };
}

/**
 * Match faces between two models using structural similarity.
 * Returns array of {faceA, faceB, similarity} where similarity is 0-1.
 */
function matchFaces(facesA, facesB) {
  const sigsA = facesA.map(faceSignature);
  const sigsB = facesB.map(faceSignature);

  const matches = [];
  const usedB = new Set();

  for (let i = 0; i < facesA.length; i++) {
    let bestMatch = -1;
    let bestSimilarity = 0;

    for (let j = 0; j < facesB.length; j++) {
      if (usedB.has(j)) continue;

      const sigA = sigsA[i];
      const sigB = sigsB[j];

      // Compute similarity
      let similarity = 0;
      if (sigA.ec === sigB.ec) similarity += 0.2;
      if (sigA.vc === sigB.vc) similarity += 0.2;
      if (sigA.secCount === sigB.secCount) similarity += 0.2;

      // Vertex position similarity
      if (sigA.vertexHash === sigB.vertexHash) {
        similarity += 0.4;
      } else {
        // Partial credit for overlapping vertices
        const vertsA = new Set(sigA.vertexHash.split('|'));
        const vertsB = new Set(sigB.vertexHash.split('|'));
        let overlap = 0;
        for (const v of vertsA) {
          if (vertsB.has(v)) overlap++;
        }
        similarity += 0.4 * (overlap / Math.max(vertsA.size, 1));
      }

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = j;
      }
    }

    if (bestMatch >= 0 && bestSimilarity > 0.5) {
      matches.push({ faceA: i, faceB: bestMatch, similarity: bestSimilarity });
      usedB.add(bestMatch);
    } else {
      matches.push({ faceA: i, faceB: -1, similarity: 0 });
    }
  }

  return matches;
}

// ============================================================
// TOKEN SEQUENCE ANALYSIS
// ============================================================

/**
 * Extract section body token sequences from Block1 body.
 * Returns array of arrays, one per section.
 */
function extractSectionTokens(b1Body) {
  const sections = [];
  let currentSection = [];

  for (let i = 0; i < b1Body.length; i++) {
    if (b1Body[i] === 1) {
      // ONE marks section boundary
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

/**
 * Classify token into category.
 */
function classifyToken(value) {
  if (value === 0) return 'ZERO';
  if (value === 1) return 'ONE';
  if (value >= 2 && value <= 255) return 'SMALL';
  if (value >= 256 && value <= 65535) return 'MEDIUM';
  return 'LARGE';
}

/**
 * Compute token histogram for a section.
 */
function tokenHistogram(section) {
  const hist = { ZERO: 0, ONE: 0, SMALL: 0, MEDIUM: 0, LARGE: 0 };
  for (const token of section) {
    hist[classifyToken(token)]++;
  }
  return hist;
}

/**
 * Compute edit distance between two token sequences.
 */
function editDistance(seqA, seqB) {
  const lenA = seqA.length;
  const lenB = seqB.length;

  // Handle edge cases
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  // Use simpler comparison for large sequences
  if (lenA > 500 || lenB > 500) {
    // For large sequences, just compare lengths and first/last tokens
    let diff = Math.abs(lenA - lenB);
    if (lenA > 0 && lenB > 0) {
      if (seqA[0] !== seqB[0]) diff++;
      if (seqA[lenA - 1] !== seqB[lenB - 1]) diff++;
    }
    return diff;
  }

  // Standard DP for smaller sequences
  const dp = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = seqA[i - 1] === seqB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[lenA][lenB];
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

function analyzeModel(name, modelDir) {
  const sldprtPath = path.join(modelDir, 'model.SLDPRT');
  const stepPath = path.join(modelDir, 'model.step');

  if (!fs.existsSync(sldprtPath)) {
    console.error(`  SLDPRT not found: ${sldprtPath}`);
    return null;
  }

  console.log(`  Parsing ${name}...`);
  const result = parseFile(sldprtPath);

  if (result.errors.length > 0) {
    console.error(`  Errors parsing ${name}:`, result.errors);
    return null;
  }

  let stepData = null;
  if (fs.existsSync(stepPath)) {
    stepData = parseSTEP(stepPath);
  }

  const faces = result.faces.map((face, idx) => {
    const sections = extractSectionTokens(face.b1Body);
    const histograms = sections.map(tokenHistogram);
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
      b1Header: Array.from(face.b1Header),
      b2Header: Array.from(face.b2Header),
      b2Body: Array.from(face.b2Body),
      b2Decoded: b2Decoded,
      sectionLens: face.sectionLens,
      sections: sections,
      histograms: histograms,
      vertexCount: face.vertices.length / 3,
      // Store raw token sequence for comparison
      b1BodyTokens: Array.from(face.b1Body),
    };
  });

  return {
    name: name,
    faceCount: faces.length,
    faces: faces,
    step: stepData,
  };
}

function compareModels(modelA, modelB, comparisonName) {
  console.log(`\nComparing ${comparisonName}: ${modelA.name} ↔ ${modelB.name}`);

  // Match faces
  const matches = matchFaces(
    modelA.faces.map(f => ({ edgeCount: f.ec, vertexCount: f.vc, secCount: f.secCount, vertices: [] })),
    modelB.faces.map(f => ({ edgeCount: f.ec, vertexCount: f.vc, secCount: f.secCount, vertices: [] }))
  );

  const results = {
    comparison: comparisonName,
    modelA: modelA.name,
    modelB: modelB.name,
    matches: [],
    unmatchedA: [],
    unmatchedB: [],
  };

  const matchedB = new Set();

  for (const match of matches) {
    if (match.faceB === -1) {
      results.unmatchedA.push(match.faceA);
      continue;
    }

    matchedB.add(match.faceB);
    const faceA = modelA.faces[match.faceA];
    const faceB = modelB.faces[match.faceB];

    // Compare Block1/Block2
    const b1BodyEqual = JSON.stringify(faceA.b1BodyTokens) === JSON.stringify(faceB.b1BodyTokens);
    const b2BodyEqual = JSON.stringify(faceA.b2Body) === JSON.stringify(faceB.b2Body);
    const b1HeaderEqual = JSON.stringify(faceA.b1Header) === JSON.stringify(faceB.b1Header);
    const b2HeaderEqual = JSON.stringify(faceA.b2Header) === JSON.stringify(faceB.b2Header);

    // Token histogram comparison
    const histDiffs = [];
    for (let i = 0; i < Math.min(faceA.histograms.length, faceB.histograms.length); i++) {
      const diff = {};
      for (const key of Object.keys(faceA.histograms[i])) {
        diff[key] = faceB.histograms[i][key] - faceA.histograms[i][key];
      }
      histDiffs.push(diff);
    }

    // Section-by-section comparison
    const sectionComparisons = [];
    const minSections = Math.min(faceA.sections.length, faceB.sections.length);
    for (let i = 0; i < minSections; i++) {
      const editDist = editDistance(faceA.sections[i], faceB.sections[i]);
      const tokensEqual = JSON.stringify(faceA.sections[i]) === JSON.stringify(faceB.sections[i]);
      sectionComparisons.push({
        sectionIndex: i,
        tokensEqual: tokensEqual,
        editDistance: editDist,
        lengthA: faceA.sections[i].length,
        lengthB: faceB.sections[i].length,
      });
    }

    results.matches.push({
      faceA: match.faceA,
      faceB: match.faceB,
      similarity: match.similarity,
      ecA: faceA.ec,
      ecB: faceB.ec,
      vcA: faceA.vc,
      vcB: faceB.vc,
      secCountA: faceA.secCount,
      secCountB: faceB.secCount,
      b1HeaderEqual: b1HeaderEqual,
      b2HeaderEqual: b2HeaderEqual,
      b1BodyEqual: b1BodyEqual,
      b2BodyEqual: b2BodyEqual,
      b2DecodedA: faceA.b2Decoded,
      b2DecodedB: faceB.b2Decoded,
      histDiffs: histDiffs,
      sectionComparisons: sectionComparisons,
    });
  }

  // Find unmatched B faces
  for (let j = 0; j < modelB.faces.length; j++) {
    if (!matchedB.has(j)) {
      results.unmatchedB.push(j);
    }
  }

  return results;
}

// ============================================================
// MAIN
// ============================================================

console.log('EXP-029: Block1/Block2 Geometry-Encoding Differential');
console.log('=====================================================\n');

// Models to analyze
const models = [
  'C00_cube_10mm',
  'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm',
  'C05_cube_hole_3mm',
  'C09_cube_chamfer_1mm',
];

// Parse all models
const parsedModels = {};
for (const name of models) {
  const modelDir = path.join(CORPUS_DIR, name);
  parsedModels[name] = analyzeModel(name, modelDir);
}

// Comparisons to make
const comparisons = [
  { a: 'C00_cube_10mm', b: 'C04_cube_hole_5mm', name: 'hole_introduction' },
  { a: 'C04_cube_hole_5mm', b: 'C05_cube_hole_3mm', name: 'hole_diameter_change' },
  { a: 'C00_cube_10mm', b: 'C03_cube_fillet_1mm', name: 'fillet' },
  { a: 'C00_cube_10mm', b: 'C09_cube_chamfer_1mm', name: 'chamfer' },
];

// Run comparisons
const comparisonResults = {};
for (const comp of comparisons) {
  if (parsedModels[comp.a] && parsedModels[comp.b]) {
    comparisonResults[comp.name] = compareModels(
      parsedModels[comp.a],
      parsedModels[comp.b],
      comp.name
    );
  }
}

// ============================================================
// SPECIAL ANALYSIS: C04 ↔ C05 cylindrical face
// ============================================================

console.log('\n\nSpecial Analysis: C04 ↔ C05 Cylindrical Face');
console.log('==============================================');

const c04 = parsedModels['C04_cube_hole_5mm'];
const c05 = parsedModels['C05_cube_hole_3mm'];

if (c04 && c05) {
  // Find cylindrical faces (highest vc)
  const c04CylFace = c04.faces.reduce((max, f) => f.vc > max.vc ? f : max, c04.faces[0]);
  const c05CylFace = c05.faces.reduce((max, f) => f.vc > max.vc ? f : max, c05.faces[0]);

  console.log(`\nC04 cylindrical face: faceIndex=${c04CylFace.faceIndex}, vc=${c04CylFace.vc}, ec=${c04CylFace.ec}`);
  console.log(`C05 cylindrical face: faceIndex=${c05CylFace.faceIndex}, vc=${c05CylFace.vc}, ec=${c05CylFace.ec}`);

  // Compare token sequences
  const editDist = editDistance(c04CylFace.b1BodyTokens, c05CylFace.b1BodyTokens);
  const tokensEqual = JSON.stringify(c04CylFace.b1BodyTokens) === JSON.stringify(c05CylFace.b1BodyTokens);

  console.log(`\nToken sequence comparison:`);
  console.log(`  Length A: ${c04CylFace.b1BodyTokens.length}`);
  console.log(`  Length B: ${c05CylFace.b1BodyTokens.length}`);
  console.log(`  Tokens equal: ${tokensEqual}`);
  console.log(`  Edit distance: ${editDist}`);

  // Section-by-section comparison
  console.log(`\nSection-by-section comparison:`);
  const minSections = Math.min(c04CylFace.sections.length, c05CylFace.sections.length);
  for (let i = 0; i < minSections; i++) {
    const secEditDist = editDistance(c04CylFace.sections[i], c05CylFace.sections[i]);
    const secEqual = JSON.stringify(c04CylFace.sections[i]) === JSON.stringify(c05CylFace.sections[i]);
    console.log(`  Section ${i}: equal=${secEqual}, editDist=${secEditDist}, lenA=${c04CylFace.sections[i].length}, lenB=${c05CylFace.sections[i].length}`);
  }

  // Token value comparison (first 20 tokens)
  console.log(`\nFirst 20 tokens comparison:`);
  for (let i = 0; i < Math.min(20, c04CylFace.b1BodyTokens.length, c05CylFace.b1BodyTokens.length); i++) {
    const tokA = c04CylFace.b1BodyTokens[i];
    const tokB = c05CylFace.b1BodyTokens[i];
    const equal = tokA === tokB;
    console.log(`  [${i}] A=${tokA} B=${tokB} ${equal ? '=' : '≠'}`);
  }

  // Histogram comparison
  console.log(`\nToken histogram comparison:`);
  const histA = c04CylFace.histograms[0] || {};
  const histB = c05CylFace.histograms[0] || {};
  for (const key of Object.keys(histA)) {
    const diff = (histB[key] || 0) - histA[key];
    console.log(`  ${key}: A=${histA[key]} B=${histB[key]} diff=${diff}`);
  }
}

// ============================================================
// SAVE RESULTS
// ============================================================

const output = {
  timestamp: new Date().toISOString(),
  models: {},
  comparisons: comparisonResults,
  cylindricalAnalysis: null,
};

// Add model summaries
for (const [name, model] of Object.entries(parsedModels)) {
  if (model) {
    output.models[name] = {
      faceCount: model.faceCount,
      faces: model.faces.map(f => ({
        faceIndex: f.faceIndex,
        ec: f.ec,
        vc: f.vc,
        secCount: f.secCount,
        b1Len: f.b1Len,
        b1Header: f.b1Header,
        b2Header: f.b2Header,
        b2Decoded: f.b2Decoded,
        sectionLens: f.sectionLens,
        b1BodyTokens: f.b1BodyTokens,
        histograms: f.histograms,
      })),
    };
  }
}

// Add cylindrical analysis
if (c04 && c05) {
  const c04CylFace = c04.faces.reduce((max, f) => f.vc > max.vc ? f : max, c04.faces[0]);
  const c05CylFace = c05.faces.reduce((max, f) => f.vc > max.vc ? f : max, c05.faces[0]);

  output.cylindricalAnalysis = {
    c04: {
      faceIndex: c04CylFace.faceIndex,
      vc: c04CylFace.vc,
      ec: c04CylFace.ec,
      b1BodyTokens: c04CylFace.b1BodyTokens,
      sections: c04CylFace.sections,
    },
    c05: {
      faceIndex: c05CylFace.faceIndex,
      vc: c05CylFace.vc,
      ec: c05CylFace.ec,
      b1BodyTokens: c05CylFace.b1BodyTokens,
      sections: c05CylFace.sections,
    },
    tokensEqual: JSON.stringify(c04CylFace.b1BodyTokens) === JSON.stringify(c05CylFace.b1BodyTokens),
    editDistance: editDistance(c04CylFace.b1BodyTokens, c05CylFace.b1BodyTokens),
  };
}

// Save results
const outputPath = path.join(__dirname, 'EXP029_BLOCK1_GEOMETRY.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\n\nResults saved to: ${outputPath}`);

// Print summary
console.log('\n\nSummary');
console.log('=======');
for (const [name, comp] of Object.entries(comparisonResults)) {
  console.log(`\n${name}:`);
  console.log(`  Matched faces: ${comp.matches.length}`);
  console.log(`  Unmatched A: ${comp.unmatchedA.length}`);
  console.log(`  Unmatched B: ${comp.unmatchedB.length}`);

  let allB1Equal = true;
  let allB2Equal = true;
  for (const match of comp.matches) {
    if (!match.b1BodyEqual) allB1Equal = false;
    if (!match.b2BodyEqual) allB2Equal = false;
  }
  console.log(`  All B1 bodies equal: ${allB1Equal}`);
  console.log(`  All B2 bodies equal: ${allB2Equal}`);
}

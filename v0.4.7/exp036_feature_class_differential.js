'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const parserCore = require('../parser/v0.1/src/parser-core.js');

const CORPUS_DIR = path.join(__dirname, '..', 'test files original', 'controlled');

const MODELS = [
  'C00_cube_10mm',
  'C03_cube_fillet_1mm',
  'C04_cube_hole_5mm',
  'C05_cube_hole_3mm',
  'C09_cube_chamfer_1mm',
  'C10_cube_shell_1mm',
  'C11_cube_hole_4mm'
];

function parseFile(modelName) {
  const filePath = path.join(CORPUS_DIR, modelName, 'model.SLDPRT');
  const buf = fs.readFileSync(filePath);
  const inflateRaw = (b) => Buffer.from(zlib.inflateRawSync(b));
  const inflateZlib = (b) => Buffer.from(zlib.inflateSync(b));
  return parserCore.parseSLDPRT(buf, inflateRaw, inflateZlib);
}

function computeAverageNormal(normals, vertexCount) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < vertexCount; i++) {
    nx += normals[i * 3];
    ny += normals[i * 3 + 1];
    nz += normals[i * 3 + 2];
  }
  nx /= vertexCount;
  ny /= vertexCount;
  nz /= vertexCount;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: nx / len, y: ny / len, z: nz / len };
}

function determineOrientation(normal) {
  const { x, y, z } = normal;
  const tolerance = 0.1;
  if (Math.abs(x + 1) < tolerance && Math.abs(y) < tolerance && Math.abs(z) < tolerance) return '-X';
  if (Math.abs(x - 1) < tolerance && Math.abs(y) < tolerance && Math.abs(z) < tolerance) return '+X';
  if (Math.abs(y + 1) < tolerance && Math.abs(x) < tolerance && Math.abs(z) < tolerance) return '-Y';
  if (Math.abs(y - 1) < tolerance && Math.abs(x) < tolerance && Math.abs(z) < tolerance) return '+Y';
  if (Math.abs(z + 1) < tolerance && Math.abs(x) < tolerance && Math.abs(y) < tolerance) return '-Z';
  if (Math.abs(z - 1) < tolerance && Math.abs(x) < tolerance && Math.abs(y) < tolerance) return '+Z';
  return `NON_AXIS(${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)})`;
}

function classifyFaceType(ec, vc, secCount) {
  if (secCount > 1) return 'multi_loop';
  if (ec === vc && secCount === 1 && vc > 20) return 'cylindrical';
  if (ec === 4 && vc === 4 && secCount === 1) return 'planar_cube';
  if (ec === 5 && vc === 5 && secCount === 1) return 'chamfer';
  if (secCount === 1) return 'planar_other';
  return 'unknown';
}

function extractFaces(parsed, modelName) {
  const faces = [];
  for (let i = 0; i < parsed.faces.length; i++) {
    const f = parsed.faces[i];
    const avgN = computeAverageNormal(f.normals, f.vertexCount);
    const orientation = determineOrientation(avgN);
    const faceType = classifyFaceType(f.edgeCount, f.vertexCount, f.secCount);
    faces.push({
      model: modelName,
      faceIndex: i,
      faceType: faceType,
      edgeCount: f.edgeCount,
      vertexCount: f.vertexCount,
      secCount: f.secCount,
      b1Len: f.b1Len,
      b1Header: Array.from(f.b1Header),
      b1Body: Array.from(f.b1Body),
      b2Header: Array.from(f.b2Header),
      b2Body: Array.from(f.b2Body),
      sectionLens: Array.from(f.sectionLens),
      loopSizes: Array.from(f.loopSizes),
      orientation: orientation,
      markerOffset: f.markerOffset,
      block1Tokens: Array.from(f.b1Body),
      block2Tokens: Array.from(f.b2Body),
      normalX: avgN.x,
      normalY: avgN.y,
      normalZ: avgN.z
    });
  }
  return faces;
}

function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function computeTokenDiff(c00Faces, modelFaces) {
  const results = [];

  const c00ByOrient = {};
  for (const f of c00Faces) {
    const key = f.orientation;
    c00ByOrient[key] = c00ByOrient[key] || [];
    c00ByOrient[key].push(f);
  }

  const modelByOrient = {};
  for (const f of modelFaces) {
    const key = f.orientation;
    modelByOrient[key] = modelByOrient[key] || [];
    modelByOrient[key].push(f);
  }

  for (const orient of Object.keys(c00ByOrient)) {
    const c00Group = c00ByOrient[orient];
    const modelGroup = modelByOrient[orient] || [];

    if (modelGroup.length === 0) {
      for (const c00f of c00Group) {
        results.push({
          orientation: orient,
          c00Face: c00f.faceIndex,
          modelFace: null,
          identical: false,
          type: 'removed',
          c00Tokens: c00f.block1Tokens,
          modelTokens: null
        });
      }
    } else {
      for (const c00f of c00Group) {
        let bestMatch = null;
        let bestScore = -1;

        for (const mf of modelGroup) {
          const tokenMatch = arraysEqual(c00f.block1Tokens, mf.block1Tokens) ? 10 : 0;
          const ecMatch = c00f.edgeCount === mf.edgeCount ? 3 : 0;
          const vcMatch = c00f.vertexCount === mf.vertexCount ? 3 : 0;
          const score = tokenMatch + ecMatch + vcMatch;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = mf;
          }
        }

        if (bestMatch) {
          const identical = arraysEqual(c00f.block1Tokens, bestMatch.block1Tokens);
          results.push({
            orientation: orient,
            c00Face: c00f.faceIndex,
            modelFace: bestMatch.faceIndex,
            identical: identical,
            type: identical ? 'identical' : 'changed',
            c00Tokens: c00f.block1Tokens,
            modelTokens: bestMatch.block1Tokens,
            ecChanged: c00f.edgeCount !== bestMatch.edgeCount,
            vcChanged: c00f.vertexCount !== bestMatch.vertexCount,
            secCountChanged: c00f.secCount !== bestMatch.secCount,
            b1LenChanged: c00f.b1Len !== bestMatch.b1Len
          });
        }
      }
    }
  }

  for (const orient of Object.keys(modelByOrient)) {
    if (!(orient in c00ByOrient)) {
      for (const mf of modelByOrient[orient]) {
        results.push({
          orientation: orient,
          c00Face: null,
          modelFace: mf.faceIndex,
          identical: false,
          type: 'added',
          c00Tokens: null,
          modelTokens: mf.block1Tokens
        });
      }
    }
  }

  return results;
}

function getNested(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[p];
  }
  return current;
}

console.log('EXP-036: Fillet/Chamfer vs Hole/Shell Structural Differential\n');

const allModelsData = {};

for (const modelName of MODELS) {
  console.log(`Parsing ${modelName}...`);

  try {
    const data = parseFile(modelName);
    const extracted = extractFaces(data, modelName);
    allModelsData[modelName] = {
      faceCount: extracted.length,
      faces: extracted
    };
    console.log(`  ${extracted.length} faces`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    allModelsData[modelName] = null;
  }
}

console.log('\n--- Structural Analysis ---\n');

const c00Data = allModelsData['C00_cube_10mm'];
const featureModels = ['C03_cube_fillet_1mm', 'C09_cube_chamfer_1mm', 'C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C10_cube_shell_1mm', 'C11_cube_hole_4mm'];

const structuralComparison = {};

for (const modelName of featureModels) {
  const mData = allModelsData[modelName];
  if (!mData || !c00Data) continue;

  const c00Faces = c00Data.faces;
  const mFaces = mData.faces;

  const faceDiff = mFaces.length - c00Faces.length;

  const c00Types = {};
  for (const f of c00Faces) {
    c00Types[f.faceType] = (c00Types[f.faceType] || 0) + 1;
  }

  const mTypes = {};
  for (const f of mFaces) {
    mTypes[f.faceType] = (mTypes[f.faceType] || 0) + 1;
  }

  const c00EcDist = {};
  for (const f of c00Faces) {
    c00EcDist[f.edgeCount] = (c00EcDist[f.edgeCount] || 0) + 1;
  }

  const mEcDist = {};
  for (const f of mFaces) {
    mEcDist[f.edgeCount] = (mEcDist[f.edgeCount] || 0) + 1;
  }

  const c00VcDist = {};
  for (const f of c00Faces) {
    c00VcDist[f.vertexCount] = (c00VcDist[f.vertexCount] || 0) + 1;
  }

  const mVcDist = {};
  for (const f of mFaces) {
    mVcDist[f.vertexCount] = (mVcDist[f.vertexCount] || 0) + 1;
  }

  const c00SecDist = {};
  for (const f of c00Faces) {
    c00SecDist[f.secCount] = (c00SecDist[f.secCount] || 0) + 1;
  }

  const mSecDist = {};
  for (const f of mFaces) {
    mSecDist[f.secCount] = (mSecDist[f.secCount] || 0) + 1;
  }

  const tokenDiff = computeTokenDiff(c00Faces, mFaces);

  const identicalFaces = tokenDiff.filter(d => d.type === 'identical');
  const changedFaces = tokenDiff.filter(d => d.type === 'changed');
  const removedFaces = tokenDiff.filter(d => d.type === 'removed');
  const addedFaces = tokenDiff.filter(d => d.type === 'added');

  const multiLoopC00 = c00Faces.filter(f => f.secCount > 1).length;
  const multiLoopM = mFaces.filter(f => f.secCount > 1).length;

  const multiLoopC00Faces = c00Faces.filter(f => f.secCount > 1);
  const multiLoopMFaces = mFaces.filter(f => f.secCount > 1);

  const multiLoopC00Orients = multiLoopC00Faces.map(f => f.orientation);
  const multiLoopMOrients = multiLoopMFaces.map(f => f.orientation);

  const multiLoopAdded = multiLoopMOrients.filter(o => !multiLoopC00Orients.includes(o));
  const multiLoopRemoved = multiLoopC00Orients.filter(o => !multiLoopMOrients.includes(o));
  const multiLoopSame = multiLoopMOrients.filter(o => multiLoopC00Orients.includes(o));

  const c00B1Sizes = c00Faces.map(f => f.b1Len);
  const mB1Sizes = mFaces.map(f => f.b1Len);
  const c00B2Sizes = c00Faces.map(f => f.b2Body.length);
  const mB2Sizes = mFaces.map(f => f.b2Body.length);

  const newFaceTypes = {};
  for (const af of addedFaces) {
    const face = mFaces.find(f => f.faceIndex === af.modelFace);
    if (face) {
      newFaceTypes[face.faceType] = (newFaceTypes[face.faceType] || 0) + 1;
    }
  }

  const removedFaceTypes = {};
  for (const rf of removedFaces) {
    const face = c00Faces.find(f => f.faceIndex === rf.c00Face);
    if (face) {
      removedFaceTypes[face.faceType] = (removedFaceTypes[face.faceType] || 0) + 1;
    }
  }

  structuralComparison[modelName] = {
    faceCountC00: c00Faces.length,
    faceCountModel: mFaces.length,
    faceCountDiff: faceDiff,
    faceTypesC00: c00Types,
    faceTypesModel: mTypes,
    ecDistC00: c00EcDist,
    ecDistModel: mEcDist,
    vcDistC00: c00VcDist,
    vcDistModel: mVcDist,
    secDistC00: c00SecDist,
    secDistModel: mSecDist,
    multiLoopC00Count: multiLoopC00,
    multiLoopModelCount: multiLoopM,
    multiLoopC00Orients: multiLoopC00Orients,
    multiLoopModelOrients: multiLoopMOrients,
    multiLoopAdded: multiLoopAdded,
    multiLoopRemoved: multiLoopRemoved,
    multiLoopSame: multiLoopSame,
    tokenDiffSummary: {
      identical: identicalFaces.length,
      changed: changedFaces.length,
      removed: removedFaces.length,
      added: addedFaces.length
    },
    identicalFaceDetails: identicalFaces.map(d => ({
      orientation: d.orientation,
      c00Face: d.c00Face,
      modelFace: d.modelFace
    })),
    changedFaceDetails: changedFaces.map(d => ({
      orientation: d.orientation,
      c00Face: d.c00Face,
      modelFace: d.modelFace,
      ecChanged: d.ecChanged,
      vcChanged: d.vcChanged,
      secCountChanged: d.secCountChanged,
      b1LenChanged: d.b1LenChanged,
      c00Tokens: d.c00Tokens,
      modelTokens: d.modelTokens
    })),
    removedFaceDetails: removedFaces.map(d => ({
      orientation: d.orientation,
      c00Face: d.c00Face,
      c00Tokens: d.c00Tokens
    })),
    addedFaceDetails: addedFaces.map(d => ({
      orientation: d.orientation,
      modelFace: d.modelFace,
      modelTokens: d.modelTokens
    })),
    newFaceTypes: newFaceTypes,
    removedFaceTypes: removedFaceTypes,
    b1SizeStats: {
      c00Min: Math.min(...c00B1Sizes),
      c00Max: Math.max(...c00B1Sizes),
      c00Avg: c00B1Sizes.reduce((a, b) => a + b, 0) / c00B1Sizes.length,
      modelMin: Math.min(...mB1Sizes),
      modelMax: Math.max(...mB1Sizes),
      modelAvg: mB1Sizes.reduce((a, b) => a + b, 0) / mB1Sizes.length
    },
    b2SizeStats: {
      c00Min: Math.min(...c00B2Sizes),
      c00Max: Math.max(...c00B2Sizes),
      c00Avg: c00B2Sizes.reduce((a, b) => a + b, 0) / c00B2Sizes.length,
      modelMin: Math.min(...mB2Sizes),
      modelMax: Math.max(...mB2Sizes),
      modelAvg: mB2Sizes.reduce((a, b) => a + b, 0) / mB2Sizes.length
    },
    orderingC00: c00Faces.map(f => f.faceIndex),
    orderingModel: mFaces.map(f => f.faceIndex)
  };

  const diff = structuralComparison[modelName];
  console.log(`${modelName}:`);
  console.log(`  Faces: ${diff.faceCountC00} → ${diff.faceCountModel} (${diff.faceCountDiff >= 0 ? '+' : ''}${diff.faceCountDiff})`);
  console.log(`  Identical: ${diff.tokenDiffSummary.identical}, Changed: ${diff.tokenDiffSummary.changed}, Added: ${diff.tokenDiffSummary.added}, Removed: ${diff.tokenDiffSummary.removed}`);
  console.log(`  Multi-loop: C00=${diff.multiLoopC00Count}, Model=${diff.multiLoopModelCount}`);
  console.log(`  Multi-loop added: [${diff.multiLoopAdded.join(', ')}]`);
  console.log(`  Multi-loop removed: [${diff.multiLoopRemoved.join(', ')}]`);
  console.log();
}

console.log('--- Cross-Model Analysis ---\n');

const globalTokenChangeModels = ['C03_cube_fillet_1mm', 'C09_cube_chamfer_1mm'];
const noTokenChangeModels = ['C04_cube_hole_5mm', 'C05_cube_hole_3mm', 'C10_cube_shell_1mm', 'C11_cube_hole_4mm'];

const properties = [
  'faceCountDiff',
  'tokenDiffSummary.identical',
  'tokenDiffSummary.changed',
  'tokenDiffSummary.added',
  'tokenDiffSummary.removed',
  'multiLoopC00Count',
  'multiLoopModelCount',
  'b1SizeStats.modelAvg',
  'b2SizeStats.modelAvg'
];

for (const prop of properties) {
  const globalVals = globalTokenChangeModels.map(m => getNested(structuralComparison[m], prop));
  const noChangeVals = noTokenChangeModels.map(m => getNested(structuralComparison[m], prop));

  const globalAvg = globalVals.reduce((a, b) => a + b, 0) / globalVals.length;
  const noChangeAvg = noChangeVals.reduce((a, b) => a + b, 0) / noChangeVals.length;

  const distinguishes = globalAvg !== noChangeAvg;

  console.log(`${prop}:`);
  console.log(`  Global-change models: [${globalVals.join(', ')}] avg=${globalAvg.toFixed(2)}`);
  console.log(`  No-change models: [${noChangeVals.join(', ')}] avg=${noChangeAvg.toFixed(2)}`);
  console.log(`  Distinguishes: ${distinguishes ? 'YES' : 'NO'}`);
  console.log();
}

console.log('--- Feature Type Analysis ---\n');

for (const modelName of featureModels) {
  const diff = structuralComparison[modelName];
  if (!diff) continue;

  console.log(`${modelName}:`);
  console.log(`  Face types C00: ${JSON.stringify(diff.faceTypesC00)}`);
  console.log(`  Face types Model: ${JSON.stringify(diff.faceTypesModel)}`);
  console.log(`  New face types: ${JSON.stringify(diff.newFaceTypes)}`);
  console.log(`  Removed face types: ${JSON.stringify(diff.removedFaceTypes)}`);
  console.log();
}

console.log('--- Detailed Token Changes ---\n');

for (const modelName of featureModels) {
  const diff = structuralComparison[modelName];
  if (!diff) continue;

  if (diff.changedFaceDetails.length > 0) {
    console.log(`${modelName} - Changed faces:`);
    for (const cf of diff.changedFaceDetails) {
      console.log(`  Orientation ${cf.c00Face}→${cf.modelFace}: ec${cf.ecChanged ? '*' : ''} vc${cf.vcChanged ? '*' : ''} sec${cf.secCountChanged ? '*' : ''} b1${cf.b1LenChanged ? '*' : ''}`);
      console.log(`    C00: [${cf.c00Tokens.join(',')}]`);
      console.log(`    Mod: [${cf.modelTokens.join(',')}]`);
    }
    console.log();
  }

  if (diff.addedFaceDetails.length > 0) {
    console.log(`${modelName} - Added faces:`);
    for (const af of diff.addedFaceDetails) {
      console.log(`  Face ${af.modelFace}: [${af.modelTokens.join(',')}]`);
    }
    console.log();
  }
}

const results = {
  timestamp: new Date().toISOString(),
  experiment: 'EXP-036',
  description: 'Fillet/Chamfer vs Hole/Shell Structural Differential',
  c00Baseline: {
    faceCount: c00Data ? c00Data.faceCount : 0
  },
  structuralComparison: structuralComparison,
  crossModelAnalysis: {
    globalTokenChangeModels: globalTokenChangeModels,
    noTokenChangeModels: noTokenChangeModels,
    properties: {}
  }
};

for (const prop of properties) {
  const globalVals = globalTokenChangeModels.map(m => getNested(structuralComparison[m], prop));
  const noChangeVals = noTokenChangeModels.map(m => getNested(structuralComparison[m], prop));
  const globalAvg = globalVals.reduce((a, b) => a + b, 0) / globalVals.length;
  const noChangeAvg = noChangeVals.reduce((a, b) => a + b, 0) / noChangeVals.length;

  results.crossModelAnalysis.properties[prop] = {
    globalChange: { values: globalVals, avg: globalAvg },
    noChange: { values: noChangeVals, avg: noChangeAvg },
    distinguishes: globalAvg !== noChangeAvg
  };
}

fs.writeFileSync(path.join(__dirname, 'EXP036_RESULTS.json'), JSON.stringify(results, null, 2));
console.log('\nResults written to EXP036_RESULTS.json');

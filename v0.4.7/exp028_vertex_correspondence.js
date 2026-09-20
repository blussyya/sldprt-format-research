/**
 * EXP-028 Investigation 3: SLDPRT ↔ STEP/STL Vertex Correspondence
 *
 * Compares vertex coordinates between SLDPRT, STEP, and STL for C00, C04,
 * and one feature-modified model (C03 fillet).
 *
 * Determines whether SLDPRT coordinates correspond to:
 * - exact STEP vertices,
 * - tessellated STL vertices,
 * - generated DisplayList tessellation,
 * - or something else.
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

function parseSTEP(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vertices = [];
  const vertexPoints = [];
  const advancedFaces = [];
  
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
  
  // Extract VERTEX_POINT entities (reference CARTESIAN_POINT)
  const vpRegex = /VERTEX_POINT\s*\(\s*'[^']*'\s*,\s*#(\d+)\s*\)/g;
  while ((match = vpRegex.exec(content)) !== null) {
    vertexPoints.push({ pointId: parseInt(match[1]) });
  }
  
  // Extract ADVANCED_FACE with surface type
  const afRegex = /ADVANCED_FACE\s*\(\s*'[^']*'\s*,\s*\(\s*#\d+\s*\)\s*,\s*#(\d+)\s*,\s*\.(T|F)\.\s*\)/g;
  while ((match = afRegex.exec(content)) !== null) {
    advancedFaces.push({ surfaceId: parseInt(match[1]), orientation: match[2] === 'T' });
  }
  
  return { vertices, vertexPoints, advancedFaces };
}

function parseSTL(filePath) {
  const buf = fs.readFileSync(filePath);
  
  // Binary STL
  if (buf.length >= 84) {
    const triCount = buf.readUInt32LE(80);
    const expectedSize = 84 + triCount * 50;
    if (expectedSize === buf.length) {
      const allVertices = [];
      const uniqueVertices = new Map();
      
      for (let i = 0; i < triCount; i++) {
        const off = 84 + i * 50;
        const normal = [buf.readFloatLE(off), buf.readFloatLE(off + 4), buf.readFloatLE(off + 8)];
        const v1 = [buf.readFloatLE(off + 12), buf.readFloatLE(off + 16), buf.readFloatLE(off + 20)];
        const v2 = [buf.readFloatLE(off + 24), buf.readFloatLE(off + 28), buf.readFloatLE(off + 32)];
        const v3 = [buf.readFloatLE(off + 36), buf.readFloatLE(off + 40), buf.readFloatLE(off + 44)];
        
        allVertices.push(v1, v2, v3);
        
        const key1 = `${v1[0].toFixed(6)},${v1[1].toFixed(6)},${v1[2].toFixed(6)}`;
        const key2 = `${v2[0].toFixed(6)},${v2[1].toFixed(6)},${v2[2].toFixed(6)}`;
        const key3 = `${v3[0].toFixed(6)},${v3[1].toFixed(6)},${v3[2].toFixed(6)}`;
        
        if (!uniqueVertices.has(key1)) uniqueVertices.set(key1, v1);
        if (!uniqueVertices.has(key2)) uniqueVertices.set(key2, v2);
        if (!uniqueVertices.has(key3)) uniqueVertices.set(key3, v3);
      }
      
      return {
        triangleCount: triCount,
        allVertices,
        uniqueVertices: Array.from(uniqueVertices.values()),
      };
    }
  }
  
  return { triangleCount: 0, allVertices: [], uniqueVertices: [] };
}

// ============================================================
// ANALYSIS
// ============================================================

console.log('=== EXP-028 Investigation 3: SLDPRT ↔ STEP/STL Vertex Correspondence ===\n');

const models = ['C00_cube_10mm', 'C04_cube_hole_5mm', 'C03_cube_fillet_1mm'];

const results = {};

for (const model of models) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`MODEL: ${model}`);
  console.log(`${'='.repeat(70)}`);
  
  const sldprt = parseFile(path.join(CORPUS_DIR, model, 'model.SLDPRT'));
  const step = parseSTEP(path.join(CORPUS_DIR, model, 'model.step'));
  const stl = parseSTL(path.join(CORPUS_DIR, model, 'model.STL'));
  
  console.log(`\n  SLDPRT: ${sldprt.faces.length} faces`);
  console.log(`  STEP: ${step.vertices.length} vertices, ${step.vertexPoints.length} vertex points`);
  console.log(`  STL: ${stl.triangleCount} triangles, ${stl.uniqueVertices.length} unique vertices`);
  
  // Extract all SLDPRT vertices
  const sldprtVertices = [];
  for (const face of sldprt.faces) {
    for (let v = 0; v < face.vertexCount; v++) {
      sldprtVertices.push([
        face.vertices[v * 3],
        face.vertices[v * 3 + 1],
        face.vertices[v * 3 + 2],
      ]);
    }
  }
  
  console.log(`\n  SLDPRT total vertices: ${sldprtVertices.length}`);
  
  // Convert STEP vertices to arrays
  const stepVertices = step.vertices.map(v => [v.x, v.y, v.z]);
  
  console.log(`  STEP total vertices: ${stepVertices.length}`);
  console.log(`  STL unique vertices: ${stl.uniqueVertices.length}`);
  
  // Compare SLDPRT ↔ STEP
  console.log('\n  SLDPRT ↔ STEP correspondence:');
  const tolerance = 0.001; // 1 micrometer tolerance
  
  let exactMatches = 0;
  let closestDistances = [];
  
  for (const sv of sldprtVertices) {
    let minDist = Infinity;
    let closestStep = null;
    
    for (const tv of stepVertices) {
      const dist = Math.sqrt(
        (sv[0] - tv[0]) ** 2 +
        (sv[1] - tv[1]) ** 2 +
        (sv[2] - tv[2]) ** 2
      );
      
      if (dist < minDist) {
        minDist = dist;
        closestStep = tv;
      }
    }
    
    closestDistances.push(minDist);
    if (minDist < tolerance) {
      exactMatches++;
    }
  }
  
  console.log(`    Exact matches (< ${tolerance}mm): ${exactMatches}/${sldprtVertices.length}`);
  console.log(`    Max distance: ${Math.max(...closestDistances).toFixed(6)}mm`);
  console.log(`    Mean distance: ${(closestDistances.reduce((a, b) => a + b, 0) / closestDistances.length).toFixed(6)}mm`);
  
  // Compare SLDPRT ↔ STL
  console.log('\n  SLDPRT ↔ STL correspondence:');
  
  let stlExactMatches = 0;
  let stlClosestDistances = [];
  
  for (const sv of sldprtVertices) {
    let minDist = Infinity;
    
    for (const tv of stl.uniqueVertices) {
      const dist = Math.sqrt(
        (sv[0] - tv[0]) ** 2 +
        (sv[1] - tv[1]) ** 2 +
        (sv[2] - tv[2]) ** 2
      );
      
      if (dist < minDist) {
        minDist = dist;
      }
    }
    
    stlClosestDistances.push(minDist);
    if (minDist < tolerance) {
      stlExactMatches++;
    }
  }
  
  console.log(`    Exact matches (< ${tolerance}mm): ${stlExactMatches}/${sldprtVertices.length}`);
  console.log(`    Max distance: ${Math.max(...stlClosestDistances).toFixed(6)}mm`);
  console.log(`    Mean distance: ${(stlClosestDistances.reduce((a, b) => a + b, 0) / stlClosestDistances.length).toFixed(6)}mm`);
  
  // Compare STEP ↔ STL
  console.log('\n  STEP ↔ STL correspondence:');
  
  let stepStlExactMatches = 0;
  let stepStlClosestDistances = [];
  
  for (const sv of stepVertices) {
    let minDist = Infinity;
    
    for (const tv of stl.uniqueVertices) {
      const dist = Math.sqrt(
        (sv[0] - tv[0]) ** 2 +
        (sv[1] - tv[1]) ** 2 +
        (sv[2] - tv[2]) ** 2
      );
      
      if (dist < minDist) {
        minDist = dist;
      }
    }
    
    stepStlClosestDistances.push(minDist);
    if (minDist < tolerance) {
      stepStlExactMatches++;
    }
  }
  
  console.log(`    Exact matches (< ${tolerance}mm): ${stepStlExactMatches}/${stepVertices.length}`);
  console.log(`    Max distance: ${Math.max(...stepStlClosestDistances).toFixed(6)}mm`);
  console.log(`    Mean distance: ${(stepStlClosestDistances.reduce((a, b) => a + b, 0) / stepStlClosestDistances.length).toFixed(6)}mm`);
  
  // Vertex ordering analysis
  console.log('\n  Vertex ordering analysis:');
  
  // Check if SLDPRT vertices appear in the same order as STEP vertices
  let orderMatches = 0;
  for (let i = 0; i < Math.min(sldprtVertices.length, stepVertices.length); i++) {
    const dist = Math.sqrt(
      (sldprtVertices[i][0] - stepVertices[i][0]) ** 2 +
      (sldprtVertices[i][1] - stepVertices[i][1]) ** 2 +
      (sldprtVertices[i][2] - stepVertices[i][2]) ** 2
    );
    if (dist < tolerance) {
      orderMatches++;
    }
  }
  
  console.log(`    Position-ordered matches: ${orderMatches}/${Math.min(sldprtVertices.length, stepVertices.length)}`);
  
  // Analyze per-face correspondence
  console.log('\n  Per-face SLDPRT ↔ STEP correspondence:');
  
  for (const face of sldprt.faces) {
    const faceVerts = [];
    for (let v = 0; v < face.vertexCount; v++) {
      faceVerts.push([
        face.vertices[v * 3],
        face.vertices[v * 3 + 1],
        face.vertices[v * 3 + 2],
      ]);
    }
    
    let faceExactMatches = 0;
    let faceClosestDistances = [];
    
    for (const fv of faceVerts) {
      let minDist = Infinity;
      
      for (const tv of stepVertices) {
        const dist = Math.sqrt(
          (fv[0] - tv[0]) ** 2 +
          (fv[1] - tv[1]) ** 2 +
          (fv[2] - tv[2]) ** 2
        );
        
        if (dist < minDist) {
          minDist = dist;
        }
      }
      
      faceClosestDistances.push(minDist);
      if (minDist < tolerance) {
        faceExactMatches++;
      }
    }
    
    const maxDist = Math.max(...faceClosestDistances);
    const meanDist = faceClosestDistances.reduce((a, b) => a + b, 0) / faceClosestDistances.length;
    
    console.log(`    Face ${face.index}: ${faceExactMatches}/${face.vertexCount} exact matches, max=${maxDist.toFixed(6)}mm, mean=${meanDist.toFixed(6)}mm`);
  }
  
  results[model] = {
    sldprt: {
      faceCount: sldprt.faces.length,
      vertexCount: sldprtVertices.length,
    },
    step: {
      vertexCount: stepVertices.length,
      vertexPointCount: step.vertexPoints.length,
    },
    stl: {
      triangleCount: stl.triangleCount,
      uniqueVertexCount: stl.uniqueVertices.length,
    },
    correspondence: {
      sldprtStep: {
        exactMatches,
        maxDistance: Math.max(...closestDistances),
        meanDistance: closestDistances.reduce((a, b) => a + b, 0) / closestDistances.length,
      },
      sldprtStl: {
        exactMatches: stlExactMatches,
        maxDistance: Math.max(...stlClosestDistances),
        meanDistance: stlClosestDistances.reduce((a, b) => a + b, 0) / stlClosestDistances.length,
      },
      stepStl: {
        exactMatches: stepStlExactMatches,
        maxDistance: Math.max(...stepStlClosestDistances),
        meanDistance: stepStlClosestDistances.reduce((a, b) => a + b, 0) / stepStlClosestDistances.length,
      },
    },
  };
}

// Summary
console.log('\n\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

for (const [model, data] of Object.entries(results)) {
  console.log(`\n${model}:`);
  console.log(`  SLDPRT ↔ STEP: ${data.correspondence.sldprtStep.exactMatches}/${data.sldprt.vertexCount} exact matches`);
  console.log(`  SLDPRT ↔ STL: ${data.correspondence.sldprtStl.exactMatches}/${data.sldprt.vertexCount} exact matches`);
  console.log(`  STEP ↔ STL: ${data.correspondence.stepStl.exactMatches}/${data.step.vertexCount} exact matches`);
}

// Save results
const outputPath = path.join(__dirname, 'EXP028_VERTEX_CORRESPONDENCE.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n\nResults saved to ${outputPath}`);

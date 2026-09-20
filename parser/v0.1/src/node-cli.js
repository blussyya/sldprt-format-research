#!/usr/bin/env node
/**
 * Node CLI wrapper around parser-core.js.
 *
 * This file contains ONLY Node-specific plumbing (fs, zlib, argv). All
 * actual parsing logic lives in parser-core.js and is shared verbatim with
 * the browser viewer (web/) -- nothing here duplicates that logic.
 *
 * Usage:
 *   node src/node-cli.js <file.sldprt> [--json out.json]
 */

'use strict';

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const SLDPRTParser = require('./parser-core.js');

function inflateRaw(bytes) {
  return zlib.inflateRawSync(Buffer.from(bytes));
}

function inflateZlib(bytes) {
  return zlib.inflateSync(Buffer.from(bytes));
}

function parseFile(filePath) {
  const raw = fs.readFileSync(filePath);
  return SLDPRTParser.parseSLDPRT(raw, inflateRaw, inflateZlib);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node src/node-cli.js <file.sldprt> [--json out.json]');
    process.exit(1);
  }

  const filePath = args[0];
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx !== -1 ? args[jsonIdx + 1] : null;

  console.log('Parsing: ' + filePath);
  const result = parseFile(filePath);

  console.log('Format: ' + result.format);
  console.log('DisplayLists length: ' + result.displayListsLength);
  if (result.errors.length) {
    console.log('Errors:');
    result.errors.forEach((e) => console.log('  - ' + e));
  }
  if (result.warnings.length) {
    console.log('Warnings:');
    result.warnings.forEach((w) => console.log('  - ' + w));
  }
  if (result.stats) {
    console.log('Stats: ' + JSON.stringify(result.stats, null, 2));
  }

  if (jsonOut) {
    // Convert typed arrays to plain arrays for JSON serialization.
    const serializable = {
      format: result.format,
      displayListsLength: result.displayListsLength,
      errors: result.errors,
      warnings: result.warnings,
      stats: result.stats,
      faces: result.faces.map((f) => ({
        markerOffset: f.markerOffset,
        faceStartOffset: f.faceStartOffset,
        verticesStart: f.verticesStart,
        gapStart: f.gapStart,
        normalsStart: f.normalsStart,
        block1Start: f.block1Start,
        block2Start: f.block2Start,
        edgeCount: f.edgeCount,
        vertexCount: f.vertexCount,
        vertices: Array.from(f.vertices),
        normals: Array.from(f.normals),
        gap: f.gap,
        b1Header: f.b1Header,
        b1Len: f.b1Len,
        b1Body: Array.from(f.b1Body),
        b2Header: f.b2Header,
        secCount: f.secCount,
        b2Body: Array.from(f.b2Body),
        sectionLens: f.sectionLens,
        loopModel: f.loopModel,
        loopSizes: f.loopSizes,
        loopSumMatchesVertexCount: f.loopSumMatchesVertexCount,
      })),
      rejected: result.rejected,
    };
    fs.writeFileSync(jsonOut, JSON.stringify(serializable, null, 2));
    console.log('Wrote: ' + jsonOut);
  }
}

module.exports = { parseFile, inflateRaw, inflateZlib };

if (require.main === module) {
  main();
}

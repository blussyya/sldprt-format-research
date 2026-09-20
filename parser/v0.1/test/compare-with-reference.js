#!/usr/bin/env node
/**
 * Per-face comparison against the actual v0.4.5 reference data
 * (v0.4.5/EXP023_RESULTS_CORRECTED.json), not just aggregate counts.
 *
 * run-corpus-tests.js checks totals/categories match the published numbers.
 * This script goes one level deeper: for every one of the 1,172 faces in
 * the v0.4.5 reference, it confirms the parser v0.1 extracts a face at the
 * exact same marker offset (mp) with the exact same secCount, and that no
 * face exists in one output but not the other.
 *
 * Exit code 0 = exact match on all (file, mp) -> secCount pairs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseFile } = require('../src/node-cli.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TEST_DIR = path.join(REPO_ROOT, 'test files original');
const REFERENCE_PATH = path.join(REPO_ROOT, 'v0.4.5', 'EXP023_RESULTS_CORRECTED.json');

if (!fs.existsSync(REFERENCE_PATH)) {
  console.error('Reference file not found: ' + REFERENCE_PATH);
  process.exit(1);
}

const reference = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf8'));
console.log('Loaded reference: ' + reference.faces.length + ' faces from ' + REFERENCE_PATH);

// file (relative path, as used by v0.4.5 scripts) -> shortName used by parser v0.1's file list
const FILES = [
  { rel: 'usb hub case (ultimate test)/USB hub case BOTTOM.SLDPRT', shortName: 'BOTTOM' },
  { rel: 'usb hub case (ultimate test)/USB hub case TOP.SLDPRT', shortName: 'TOP' },
  { rel: 'Helical Bevel Gear.SLDPRT', shortName: 'GEAR' },
  { rel: 'Dekor.SLDPRT', shortName: 'DEKOR' },
  { rel: 'distributor main boss rev a.SLDPRT', shortName: 'DISTRIBUTOR' },
  { rel: 'Pocket Wheel.SLDPRT', shortName: 'POCKET' },
  { rel: 'PTC GE8080-8.SLDPRT', shortName: 'PTC' },
];

let mismatches = 0;
let totalCompared = 0;

for (const f of FILES) {
  const filePath = path.join(TEST_DIR, f.rel);
  const result = parseFile(filePath);

  const refFaces = reference.faces.filter((rf) => rf.file === f.rel);
  const v5Faces = result.faces;

  const refByMp = new Map(refFaces.map((rf) => [rf.mp, rf]));
  const v5ByMp = new Map(v5Faces.map((vf) => [vf.markerOffset, vf]));

  console.log('\n--- ' + f.shortName + ' --- reference: ' + refFaces.length + ' faces, parser v0.1: ' + v5Faces.length + ' faces');

  // Every reference face must exist in parser v0.1 output at the same mp, with the
  // same secCount.
  for (const [mp, rf] of refByMp) {
    totalCompared++;
    const vf = v5ByMp.get(mp);
    if (!vf) {
      mismatches++;
      console.error('  MISMATCH: reference face at mp=0x' + mp.toString(16) + ' missing from parser v0.1 output');
      continue;
    }
    if (vf.secCount !== rf.secCount) {
      mismatches++;
      console.error('  MISMATCH: mp=0x' + mp.toString(16) + ' secCount reference=' + rf.secCount + ' parser v0.1=' + vf.secCount);
    }
    if (vf.edgeCount !== rf.ec) {
      mismatches++;
      console.error('  MISMATCH: mp=0x' + mp.toString(16) + ' edgeCount reference=' + rf.ec + ' parser v0.1=' + vf.edgeCount);
    }
    if (vf.vertexCount !== rf.vc) {
      mismatches++;
      console.error('  MISMATCH: mp=0x' + mp.toString(16) + ' vertexCount reference=' + rf.vc + ' parser v0.1=' + vf.vertexCount);
    }
  }

  // Every parser v0.1 face must exist in the reference (no extras).
  for (const [mp] of v5ByMp) {
    if (!refByMp.has(mp)) {
      mismatches++;
      console.error('  MISMATCH: parser v0.1 face at mp=0x' + mp.toString(16) + ' not present in reference');
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('Compared ' + totalCompared + ' reference faces against parser v0.1 output.');
if (mismatches === 0) {
  console.log('EXACT MATCH: every (file, mp) -> {edgeCount, vertexCount, secCount} triple agrees with v0.4.5/EXP023_RESULTS_CORRECTED.json.');
} else {
  console.log(mismatches + ' MISMATCH(ES) FOUND.');
}
console.log('='.repeat(70));

process.exit(mismatches === 0 ? 0 : 1);

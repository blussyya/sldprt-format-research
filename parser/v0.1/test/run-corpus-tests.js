#!/usr/bin/env node
/**
 * Parser v0.1 corpus test harness.
 *
 * Runs the parser v0.1 (src/parser-core.js + src/node-cli.js) against the
 * same 8-file corpus used by v0.4.5/v0.4.6 (EXP-023-CORRECTED,
 * EXP-024-CORRECTED, EXP-026) and asserts the results match the published
 * reference numbers exactly, with one intentional, documented exception:
 * this parser adds an INV-003-backed normals unit-length check that
 * EXP-024-CORRECTED did not include. That addition is verified separately
 * below (expected to remove 0 faces, per EXP-019's finding that max normal
 * deviation across the corpus is 4.14e-8, far inside the 0.001 tolerance).
 *
 * This does NOT re-derive new research conclusions. It is a regression/
 * parity test: the parser is only "functional" if it reproduces already-
 * validated numbers exactly.
 *
 * Exit code 0 = all checks passed. Non-zero = at least one mismatch found;
 * details are printed to stderr.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseFile } = require('../src/node-cli.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TEST_DIR = path.join(REPO_ROOT, 'test files original');

const FILES = [
  { shortName: 'BOTTOM', rel: 'usb hub case (ultimate test)/USB hub case BOTTOM.SLDPRT', expectedFaces: 39 },
  { shortName: 'TOP', rel: 'usb hub case (ultimate test)/USB hub case TOP.SLDPRT', expectedFaces: 68 },
  { shortName: 'GEAR', rel: 'Helical Bevel Gear.SLDPRT', expectedFaces: 113 },
  { shortName: 'DEKOR', rel: 'Dekor.SLDPRT', expectedFaces: 375 },
  { shortName: 'SW2000', rel: 'SW2000-s01.SLDPRT', expectedFaces: 0, expectOLE2: true },
  { shortName: 'DISTRIBUTOR', rel: 'distributor main boss rev a.SLDPRT', expectedFaces: 51 },
  { shortName: 'POCKET', rel: 'Pocket Wheel.SLDPRT', expectedFaces: 400 },
  { shortName: 'PTC', rel: 'PTC GE8080-8.SLDPRT', expectedFaces: 126 },
];

// Reference totals from knowledge/evidence/2026-08-13_v0.4.5-EXP024-corrected.md
// and v0.4.6/EXP026_RESULTS.json (7 files with DisplayLists; SW2000 excluded,
// OLE2 not supported by either the v0.4.5 pipeline or this parser).
const REFERENCE_TOTAL_FACES = 1172; // 39+68+113+375+51+400+126
const REFERENCE_TOTAL_CANDIDATES = 4688;
const REFERENCE_INVALID_EC = 2344;
const REFERENCE_INVALID_VC = 1172;

let failures = 0;
let totalValidFaces = 0;
let totalCandidates = 0;
let totalInvalidEc = 0;
let totalInvalidVc = 0;
let totalInvalidNormals = 0;
let totalRejectByCategory = {};

function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) {
    failures++;
    console.error('FAIL: ' + label + ' -- expected ' + expected + ', got ' + actual);
  } else {
    console.log('PASS: ' + label + ' (' + actual + ')');
  }
  return pass;
}

console.log('='.repeat(70));
console.log('Parser v0.1 Corpus Test (parity with v0.4.5/v0.4.6 reference data)');
console.log('='.repeat(70));

for (const f of FILES) {
  const filePath = path.join(TEST_DIR, f.rel);
  console.log('\n--- ' + f.shortName + ' ---');

  if (!fs.existsSync(filePath)) {
    console.error('FAIL: ' + f.shortName + ' -- file not found at ' + filePath);
    failures++;
    continue;
  }

  const result = parseFile(filePath);

  if (f.expectOLE2) {
    check(f.shortName + ' detected as OLE2', result.format.indexOf('OLE2') === 0, true);
    check(f.shortName + ' reports a clear unsupported-format error (not silently skipped)', result.errors.length > 0, true);
    continue;
  }

  if (result.errors.length > 0) {
    console.error('FAIL: ' + f.shortName + ' -- unexpected errors: ' + JSON.stringify(result.errors));
    failures++;
    continue;
  }

  check(f.shortName + ' valid face count', result.faces.length, f.expectedFaces);

  const candidates = result.stats.totalCandidates;
  const invalidEc = result.stats.rejectByCategory.INVALID_EC || 0;
  const invalidVc = result.stats.rejectByCategory.INVALID_VC || 0;
  const invalidNormals = result.stats.rejectByCategory.INVALID_NORMALS || 0;

  console.log('  candidates=' + candidates + ' INVALID_EC=' + invalidEc + ' INVALID_VC=' + invalidVc + ' INVALID_NORMALS=' + invalidNormals);

  // Every candidate that passes EC/VC/gap/B1/B2 must reach VALID -- i.e. no
  // candidate should fail at INV016/017/018 stages on this known-good
  // corpus (that would indicate a parser bug, since v0.4.5/v0.4.6 already
  // proved 100% pass at those stages for these exact faces).
  const inv016 = result.stats.rejectByCategory.INV016_FAIL || 0;
  const inv017 = result.stats.rejectByCategory.INV017_FAIL || 0;
  const inv018 = result.stats.rejectByCategory.INV018_FAIL || 0;
  check(f.shortName + ' INV016_FAIL count', inv016, 0);
  check(f.shortName + ' INV017_FAIL count', inv017, 0);
  check(f.shortName + ' INV018_FAIL count', inv018, 0);

  // Every face's loop-size sum must match vertexCount (re-verifies INV-007
  // on this specific corpus, independent of the v0.4.x scripts).
  const badLoopSum = result.faces.filter((fc) => !fc.loopSumMatchesVertexCount).length;
  check(f.shortName + ' faces with loopSize sum == vertexCount (INV-007)', badLoopSum, 0);

  totalValidFaces += result.faces.length;
  totalCandidates += candidates;
  totalInvalidEc += invalidEc;
  totalInvalidVc += invalidVc;
  totalInvalidNormals += invalidNormals;
  for (const [cat, count] of Object.entries(result.stats.rejectByCategory)) {
    totalRejectByCategory[cat] = (totalRejectByCategory[cat] || 0) + count;
  }
}

console.log('\n' + '='.repeat(70));
console.log('AGGREGATE (7 files with DisplayLists; SW2000 excluded, same as v0.4.5/v0.4.6)');
console.log('='.repeat(70));

check('Total valid faces', totalValidFaces, REFERENCE_TOTAL_FACES);
check('Total candidates', totalCandidates, REFERENCE_TOTAL_CANDIDATES);
check('Total INVALID_EC', totalInvalidEc, REFERENCE_INVALID_EC);
check('Total INVALID_VC', totalInvalidVc, REFERENCE_INVALID_VC);

console.log('\nDocumented, intentional addition beyond the v0.4.5/v0.4.6 reference pipeline:');
console.log('  Total INVALID_NORMALS (new INV-003 check, not in EXP-024-CORRECTED): ' + totalInvalidNormals);
check('INVALID_NORMALS removes 0 faces from the known-good corpus (expected, per EXP-019 max deviation 4.14e-8)', totalInvalidNormals, 0);

console.log('\nFull reject-by-category totals: ' + JSON.stringify(totalRejectByCategory, null, 2));

console.log('\n' + '='.repeat(70));
if (failures === 0) {
  console.log('ALL CHECKS PASSED (' + REFERENCE_TOTAL_FACES + ' faces, parity with v0.4.5/v0.4.6 confirmed).');
} else {
  console.log(failures + ' CHECK(S) FAILED.');
}
console.log('='.repeat(70));

process.exit(failures === 0 ? 0 : 1);

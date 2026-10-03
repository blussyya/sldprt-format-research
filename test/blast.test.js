'use strict';
/* PKWARE DCL implode decoder (pre-2011 DisplayLists__Zip and Config-N-Body). Runs without the corpus. */
const test=require('node:test'),assert=require('assert/strict');
const {blast}=require('../src/container/blast');

test('decodes the reference stream from zlib contrib/blast',()=>{
  const r=blast(Buffer.from('00048224258f807f','hex'));
  assert.equal(r.data.toString(),'AIAIAIAIAIAIA');assert.equal(r.consumed,8);
});

test('rejects bad headers, truncation and impossible distances',()=>{
  assert.throws(()=>blast(Buffer.from('0204','hex')),/literal flag/);
  assert.throws(()=>blast(Buffer.from('0007','hex')),/dictionary size/);
  assert.throws(()=>blast(Buffer.from('00048224','hex')),/ends early/);
  assert.throws(()=>blast(Buffer.from('0004ff','hex')),/distance too far back|ends early|bad code/);
});

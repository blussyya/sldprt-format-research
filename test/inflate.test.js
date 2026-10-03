'use strict';
/* src/inflate.js (the browser decompressor) against Node's zlib: round-trip fuzz, plus every
 * modern DisplayLists stream in the corpus byte-for-byte when the corpus is present. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const I=require('../src/inflate'),modern=require('../src/container/modern');
const {walk}=require('./helpers/corpus');
const {iR,iZ,CORPUS,needsCorpus}=require('./helpers/common');

test('round-trip fuzz over stored, fixed and dynamic blocks',t=>{
  let n=0;const rt=buf=>{for(const level of [0,1,6,9]){
    assert(Buffer.from(I.inflateRaw(zlib.deflateRawSync(buf,{level}))).equals(buf));
    assert(Buffer.from(I.inflate(zlib.deflateSync(buf,{level}))).equals(buf));n++;}};
  rt(Buffer.alloc(0));rt(Buffer.from('a'));rt(Buffer.alloc(100000,7));rt(Buffer.from('the quick brown fox '.repeat(5000)));
  let seed=12345;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296; // deterministic
  for(let k=0;k<40;k++){const len=1+Math.floor(rnd()*60000),b=Buffer.alloc(len),mode=k%3;
    for(let i=0;i<len;i++)b[i]=mode===0?Math.floor(rnd()*256):mode===1?(i%17):(rnd()<0.5?0:255);rt(b);}
  t.diagnostic(`${n} round-trips`);
});

test('every modern DisplayLists stream decompresses identically',needsCorpus,t=>{
  let streams=0,bytes=0;
  for(const f of [...walk(path.join(CORPUS,'test files original')),...walk(path.join(CORPUS,'test files new/SW2022'))]){
    const b=fs.readFileSync(f);if(modern.isOLE2(b))continue;
    const a=modern.findDisplayLists(b,iR,iZ),c=modern.findDisplayLists(b,I.inflateRaw,I.inflate);
    assert(Buffer.from(a).equals(Buffer.from(c)),f);streams++;bytes+=a.length;
  }
  t.diagnostic(`${streams} streams, ${bytes} bytes, 0 differences`);
});

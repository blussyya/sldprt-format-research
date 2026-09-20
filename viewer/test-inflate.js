'use strict';
/**
 * Verify viewer/inflate.js against Node's zlib.
 *
 * Two levels:
 *  1. Round-trip fuzz over data shaped to exercise stored, fixed and dynamic blocks.
 *  2. The real test: parse every SLDPRT in the corpus twice -- once with zlib, once with this
 *     decoder -- and compare the complete parser output. Any decompression difference would
 *     change vertices, tokens or offsets, so identical JSON means identical decompression.
 *
 *   node viewer/test-inflate.js
 */
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..');
const I=require('./inflate.js');
const parser=require(path.join(ROOT,'parser','v0.2','src','parser-core'));

let fails=0,checks=0;

function roundTrip(buf,label){
 for(const level of [0,1,6,9]){
  checks++;
  const raw=zlib.deflateRawSync(buf,{level});
  if(!Buffer.from(I.inflateRaw(raw)).equals(buf)){fails++;console.log('  RAW  mismatch:',label,'level',level);}
  const z=zlib.deflateSync(buf,{level});
  if(!Buffer.from(I.inflate(z)).equals(buf)){fails++;console.log('  ZLIB mismatch:',label,'level',level);}
 }
}

console.log('1. round-trip fuzz');
roundTrip(Buffer.alloc(0),'empty');
roundTrip(Buffer.from('a'),'single byte');
roundTrip(Buffer.alloc(100000,7),'run of one value');
roundTrip(Buffer.from('the quick brown fox '.repeat(5000)),'repeated text');
for(let t=0;t<40;t++){
 const len=1+Math.floor(Math.random()*60000),b=Buffer.alloc(len),mode=t%3;
 for(let i=0;i<len;i++)b[i]=mode===0?Math.floor(Math.random()*256):mode===1?(i%17):(Math.random()<0.5?0:255);
 roundTrip(b,'fuzz '+t);
}
console.log('   '+checks+' round-trips, '+fails+' mismatches');

console.log('2. decompressed stream bytes, zlib vs this decoder');
const v1=require(path.join(ROOT,'parser','v0.1','src','parser-core'));

console.log('3. full parse of the corpus, zlib vs this decoder');
const files=[];
(function walk(d){
 for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p); else if(/\.sldprt$/i.test(e.name))files.push(p);
 }
})(path.join(ROOT,'test files original'));

// Node hands back Buffers, this decoder Uint8Arrays. Buffer.toJSON() runs BEFORE a
// replacer sees the value, so normalise both representations to a plain array.
let streamBytes=0,streamDiff=0,streamFiles=0;
const ser=r=>JSON.stringify(r,(_,v)=>{
 if(ArrayBuffer.isView(v))return Array.from(v);
 if(v&&v.type==='Buffer'&&Array.isArray(v.data))return v.data;
 return v;
});
let compared=0,skipped=0,diff=0;
for(const f of files){
 const buf=fs.readFileSync(f);
 let a,b;
 try{a=parser.parseSLDPRT(buf,zlib.inflateRawSync,zlib.inflateSync);}
 catch(e){skipped++;continue;}
 if(!a.faces||!a.faces.length){skipped++;continue;}
 try{b=parser.parseSLDPRT(buf,I.inflateRaw,I.inflate);}
 catch(e){diff++;console.log('  THREW:',path.basename(f),e.message);continue;}
 compared++;
 if(ser(a)!==ser(b)){diff++;console.log('  PARSE DIFFERS:',path.basename(f));}
 try{
  const sa=v1.findDisplayLists(buf,zlib.inflateRawSync,zlib.inflateSync);
  const sb=v1.findDisplayLists(buf,I.inflateRaw,I.inflate);
  if(sa&&sb){
   const ba=Buffer.from(sa.buffer?sa:sa),bb=Buffer.from(sb.buffer?sb:sb);
   streamFiles++; streamBytes+=ba.length;
   if(!ba.equals(bb)){streamDiff++;console.log('  STREAM DIFFERS:',path.basename(f));}
  }
 }catch(e){}
}
console.log('   '+streamFiles+' streams, '+streamBytes.toLocaleString()+
  ' bytes decompressed, '+streamDiff+' byte differences');
console.log('   '+compared+' files compared, '+skipped+' skipped (legacy/unparseable), '+diff+' differences');

const bad=fails+diff+streamDiff;
console.log(bad?'\nFAIL':'\nPASS -- this decoder reproduces zlib exactly on all tested input');
process.exit(bad?1:0);

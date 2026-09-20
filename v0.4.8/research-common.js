'use strict';
// Research-only decoder. Deliberately separate from parser/v0.1.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const legacy = require('../parser/v0.1/src/parser-core');
const ROOT = path.resolve(__dirname, '..');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function corpus(dir = path.join(ROOT, 'test files original')) {
  return fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e =>
    e.isDirectory() ? corpus(path.join(dir,e.name)) : /\.sldprt$/i.test(e.name) ? [path.join(dir,e.name)] : []);
}
function arrayAt(b, off) {
  if (off < 0 || off + 16 > b.length) return null;
  const h = Array.from({length:4}, (_,i)=>b.readUInt32LE(off+i*4));
  const end = off + 16 + h[0]*h[3];
  if (![1,4,12].includes(h[0]) || h[2] !== 2 || end > b.length) return null;
  return {off, h, end, body:b.subarray(off+16,end)};
}
const words = a => Array.from({length:a.h[3]}, (_,i)=>a.body.readUInt32LE(i*4));
const floats = a => Array.from({length:a.body.length/4}, (_,i)=>a.body.readFloatLE(i*4));
function scan(dl) {
  // Scan for the predecessor array, NOT a face accepted by INV-016/017/018.
  // No secCount, ONE-count, length-sum or edgeCount filter selects candidates.
  const sig = Buffer.from([4,0,0,0,8,0,0,0,2,0,0,0]);
  const faces = [], rejected = [];
  for (let off=dl.indexOf(sig);off>=0;off=dl.indexOf(sig,off+1)) {
    const pre=arrayAt(dl,off); if (!pre) continue;
    const pos=arrayAt(dl,pre.end);
    if (!pos || pos.h[0]!==12 || pos.h[1]!==100) continue;
    const norm=arrayAt(dl,pos.end);
    if (!norm || norm.h[0]!==12 || norm.h[1]!==100) {rejected.push({off,reason:'normal array'});continue;}
    const b1=arrayAt(dl,norm.end), b2=b1 && arrayAt(dl,b1.end);
    if (!b1 || !b2 || b1.h[0]!==4 || b2.h[0]!==4 || b1.h[1]!==8 || b2.h[1]!==8) {
      rejected.push({off,reason:'B1/B2 array'});continue;
    }
    const b3=arrayAt(dl,b2.end);
    faces.push({off, pre,pos,norm,b1,b2,b3, sizes:words(pre),vertices:floats(pos),normals:floats(norm),tokens:words(b1),lengths:words(b2)});
  }
  return {faces,rejected};
}
function read(file) {
  const b=fs.readFileSync(file);
  const base={file:path.relative(ROOT,file),sha256:sha256(b),bytes:b.length};
  if(legacy.isOLE2(b)) return {...base,unsupported:'legacy OLE2'};
  const dl0=legacy.findDisplayLists(b,zlib.inflateRawSync,zlib.inflateSync);
  if(!dl0) return {...base,unsupported:'no decoded DisplayLists'};
  const dl=Buffer.from(dl0), scanned=scan(dl);
  return {...base,dl,dlSha256:sha256(dl),...scanned};
}
const vertex=(f,i)=>f.vertices.slice(i*3,i*3+3);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.hypot(...a);
function triangles(f, mode='strip') {
  let start=0; const out=[];
  for(let s=0;s<f.sizes.length;s++) {
    const n=f.sizes[s];
    for(let i=2;i<n;i++) {
      const ids=mode==='fan' ? [start,start+i-1,start+i] : i%2===0 ? [start+i-2,start+i-1,start+i] : [start+i-1,start+i-2,start+i];
      out.push({s,ids,v:ids.map(j=>vertex(f,j))});
    }
    start+=n;
  }
  return out;
}
function edgeTokens(f) {
  let v=0,t=0;const out=[];
  f.sizes.forEach((n,s)=>{
    // One leading control word, then initial edge and two new edges per vertex.
    const control=f.tokens[t++];
    out.push({s,control,slot:t,ids:[v,v+1],token:f.tokens[t++]});
    for(let i=2;i<n;i++) for(const j of [i-2,i-1]) out.push({s,control,slot:t,ids:[v+j,v+i],token:f.tokens[t++]});
    v+=n;
  });
  return out;
}
function writeJSON(name,data) {fs.writeFileSync(path.join(__dirname,name),JSON.stringify(data,null,2)+'\n');}
module.exports={ROOT,corpus,sha256,read,scan,arrayAt,words,floats,vertex,sub,cross,dot,norm,triangles,edgeTokens,writeJSON};

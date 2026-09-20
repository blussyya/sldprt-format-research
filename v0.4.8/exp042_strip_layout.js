'use strict';
// EXP-042: forward typed-array grammar and strip triangulation vs original STL.
const fs=require('fs'),path=require('path');
const C=require('./research-common');
function stl(file) {
  const b=fs.readFileSync(file),n=b.readUInt32LE(80);
  if(b.length!==84+50*n) throw Error('Not an exact-length binary STL: '+file);
  return {sha256:C.sha256(b),tris:Array.from({length:n},(_,i)=>Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>b.readFloatLE(84+i*50+12+j*12+k*4))))};
}
const key=(v,scale)=>v.map(x=>Math.round(x*scale)).join(',');
const triKey=(v,scale)=>v.map(p=>key(p,scale)).sort().join('|');
function compare(tris,ref) {
  // STL is in mm; DisplayLists is in metres. 1e-5 mm bins, not triangle-index matching.
  const buckets=new Map();for(const v of ref) {const k=triKey(v,1e5);buckets.set(k,(buckets.get(k)||0)+1);}
  let matches=0;for(const t of tris) {const k=triKey(t.v,1e8);if(buckets.get(k)>0){matches++;buckets.set(k,buckets.get(k)-1);}}
  return {generated:tris.length,reference:ref.length,matches,unmatchedGenerated:tris.length-matches,unmatchedReference:ref.length-matches};
}
const models=[];
for(const file of C.corpus()) {
  const r=C.read(file);if(r.unsupported){models.push(r);continue;}
  const rows=r.faces.map((f,i)=>{
    let t=0;const controls=f.sizes.map(n=>{const a=f.tokens[t];t+=2*n-2;return a;});
    const tri=C.triangles(f);let negative=0,positive=0,degenerate=0,area=0;
    for(const x of tri){const n=C.cross(C.sub(x.v[1],x.v[0]),C.sub(x.v[2],x.v[0]));area+=C.norm(n)/2;
      const d=C.dot(n,x.ids.reduce((a,j)=>a.map((v,k)=>v+f.normals[j*3+k]),[0,0,0]));
      if(C.norm(n)<1e-20)degenerate++;else if(d>0)positive++;else negative++;
    }
    return {index:i,offset:f.off,positionOffset:f.pos.off,preHeader:f.pre.h,sizes:f.sizes,vertexCount:f.pos.h[3],
      b1Length:f.b1.h[3],b2:f.lengths,b3Header:f.b3?.h||null,
      checks:{positionsNormalsCount:f.pos.h[3]===f.norm.h[3],sizeSum:f.sizes.reduce((a,b)=>a+b,0)===f.pos.h[3],
        sectionCount:f.sizes.length===f.lengths.length,sectionLengths:f.sizes.every((n,j)=>f.lengths[j]===2*n-2),
        tokenTotal:t===f.tokens.length,controlsOne:controls.every(x=>x===1),
        b3Shape:!!f.b3&&f.b3.h[0]===1&&f.b3.h[1]===8&&f.b3.h[3]===f.tokens.length},
      b3Histogram:f.b3?Array.from(f.b3.body).reduce((a,b)=>(a[b]=(a[b]||0)+1,a),{}):null,
      stripGeometry:{triangles:tri.length,positive,negative,degenerate,areaM2:area}};
  });
  let refFile=path.join(path.dirname(file),'model.STL');
  if(!file.includes('/controlled/'))refFile=file.replace(/\.sldprt$/i,' ORIGINAL.STL');
  let comparison=null;
  if(fs.existsSync(refFile)) {const ref=stl(refFile);comparison={file:path.relative(C.ROOT,refFile),sha256:ref.sha256,
    strip:compare(r.faces.flatMap(f=>C.triangles(f)),ref.tris),fan:compare(r.faces.flatMap(f=>C.triangles(f,'fan')),ref.tris)};}
  models.push({file:r.file,sha256:r.sha256,bytes:r.bytes,dlSha256:r.dlSha256,dlBytes:r.dl.length,rejected:r.rejected,faces:rows,comparison});
}
const all=models.flatMap(x=>x.faces||[]),totals={models:models.length,decodedModels:models.filter(x=>x.faces).length,faces:all.length,
  failures:all.flatMap(f=>Object.entries(f.checks).filter(([,ok])=>!ok).map(([check])=>({offset:f.offset,check}))),
  triangles:all.reduce((n,f)=>n+f.stripGeometry.triangles,0),positive:all.reduce((n,f)=>n+f.stripGeometry.positive,0),
  negative:all.reduce((n,f)=>n+f.stripGeometry.negative,0),degenerate:all.reduce((n,f)=>n+f.stripGeometry.degenerate,0)};
C.writeJSON('EXP042_RESULTS.json',{experiment:'EXP-042',date:'2026-09-14',method:'Forward array scan; independent of B1/B2 invariants; original STL comparison at 1e-5 mm bins',totals,models});
console.log(JSON.stringify(totals));for(const m of models)if(m.comparison)console.log(m.file,JSON.stringify(m.comparison));

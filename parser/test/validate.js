'use strict';
// Corpus regression compares the production implementation with archived independent
// research observations. Mutation checks exercise malformed-input rejection.
const assert=require('assert/strict'),fs=require('fs'),zlib=require('zlib');
const C=require('../../../v0.4.8/research-common'),p=require('../src/parser-core');
const expected=require('../../../v0.4.8/EXP042_RESULTS.json'),meta=require('../../../v0.4.8/EXP045_RESULTS.json');
const boundaries=require('../../../v0.4.8/EXP046_RESULTS.json');
let faces=0,triangles=0,unsupported=0,metadata=0,warnings=0;const models=[];
for(const file of C.corpus()){
  const m=C.read(file),b=fs.readFileSync(file),r=p.parseSLDPRT(b,zlib.inflateRawSync,zlib.inflateSync);
  if(m.unsupported){assert(r.errors.length);unsupported++;continue;}
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.rejected,[]);
  const e=expected.models.find(x=>x.file===m.file),em=meta.models.find(x=>x.file===m.file);
  const eb=boundaries.models.find(x=>x.file===m.file);
  const expectedWarnings=em.faces.filter(f=>f.metadata.a8.header[3]!==0).map(f=>({offset:f.metadata.offset,message:'Unvalidated metadata auxiliary values retained raw'}));
  assert.deepEqual(r.warnings,expectedWarnings);warnings+=r.warnings.length;
  assert.equal(C.sha256(b),e.sha256);assert.equal(r.faces.length,e.faces.length);
  r.faces.forEach((f,i)=>{
    assert.equal(f.offset,e.faces[i].offset);assert.deepEqual(f.stripLengths,e.faces[i].sizes);
    assert.equal(f.triangleIndices.length/3,e.faces[i].stripGeometry.triangles);
    assert.deepEqual([...f.vertices],m.faces[i].vertices);assert.deepEqual([...f.normals],m.faces[i].normals);
    assert.deepEqual([...f.block1],m.faces[i].tokens);assert.deepEqual([...f.block2],m.faces[i].lengths);
    assert.deepEqual([...f.triangleIndices],C.triangles(m.faces[i]).flatMap(t=>t.ids));
    assert.deepEqual(f.edgeAnnotations.map(e=>[...e.vertices,e.id]),C.edgeTokens(m.faces[i]).map(e=>[...e.ids,e.token]));
    assert.equal(f.metadata.offset,em.faces[i].metadata.offset);assert.equal(f.metadata.typeTag,em.faces[i].metadata.tag);
    assert.deepEqual(f.metadata.edgeRecords,em.faces[i].metadata.pairs.map(e=>({id:e.id,typeTag:e.type})));
    assert.equal(f.boundaryError,null);
    assert.deepEqual(f.boundaryCycles.map(c=>c.vertices.length).sort((a,b)=>a-b),eb.faces[i].cycles.map(c=>c.vertices).sort((a,b)=>a-b));
    metadata++;faces++;triangles+=f.triangleIndices.length/3;
  });
  models.push({file:m.file,sha256:m.sha256,...r.stats,warnings:r.warnings});
}
const cube=C.read(C.corpus().find(x=>x.includes('C00_'))),f=cube.faces[0],cases=[];
function mutate(name,change){const b=Buffer.from(cube.dl);change(b);const r=p.extractDisplayLists(b);assert(!r.faces.some(x=>x.offset===f.off),name);cases.push(name);}
mutate('strip partition mismatch',b=>b.writeUInt32LE(5,f.pre.off+16));
mutate('Block2 section-length mismatch',b=>b.writeUInt32LE(8,f.b2.off+16));
mutate('nonfinite normal',b=>b.writeFloatLE(NaN,f.norm.off+16));
mutate('wrong strip control',b=>b.writeUInt32LE(7,f.b1.off+16));
mutate('Block3 count mismatch',b=>b.writeUInt32LE(f.b3.h[3]+1,f.b3.off+12));
const truncated=p.extractDisplayLists(cube.dl.subarray(0,f.b3.end-1));assert.equal(truncated.faces.length,0);cases.push('truncated Block3');
const badMeta=Buffer.from(cube.dl);badMeta.writeUInt32LE(999999,f.b3.end+300);
const mr=p.extractDisplayLists(badMeta);assert.equal(mr.faces[0].metadata,null);assert(mr.faces[0].metadataError);cases.push('metadata ID mismatch retains geometry but refuses interpretation');
const result={date:'2026-09-14',faces,triangles,metadata,unsupported,warnings,mutationCases:cases,models};
console.log(JSON.stringify(result,null,2));

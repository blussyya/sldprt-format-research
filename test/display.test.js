'use strict';
/* Display mesh over the whole research corpus (73 files). Skips without the corpus. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const display=require('../src/display'),modern=require('../src/container/modern'),browser=require('../src/inflate');
const {walk,buildLogFaceCounts,buildLog}=require('./helpers/corpus');
const {iR,iZ,sha256,canonical,CORPUS,needsCorpus}=require('./helpers/common');
const golden=require('./fixtures/display-golden.json');

test('every corpus file parses exactly as the golden record',needsCorpus,t=>{
  let faces=0;
  for(const g of golden.files){
    const b=fs.readFileSync(path.join(CORPUS,g.file));
    assert.equal(sha256(b),g.sha256,g.file+': corpus file changed');
    const r=display.parseSLDPRT(b,iR,iZ);
    assert.equal(sha256(canonical(r)),g.output,g.file+': parser output changed');
    faces+=r.faces.length;
  }
  t.diagnostic(`${golden.files.length} files, ${faces} faces, outputs identical to the golden record`);
});

test('SW2011 legacy: 25 files, 145 faces, face counts as SolidWorks reports',needsCorpus,t=>{
  const counts=buildLogFaceCounts(CORPUS);let n=0,faces=0;
  for(const f of walk(path.join(CORPUS,'test files new/SW2011'))){
    const r=display.parseSLDPRT(fs.readFileSync(f),iR,iZ),name=path.basename(path.dirname(f));
    assert.deepEqual(r.errors,[],name);assert.deepEqual(r.rejected,[],name);
    assert.equal(r.faces.length,counts[('sw2011/'+name).toLowerCase()],name);
    assert(r.faces.every(f=>f.bounds&&f.metadata===null),name);
    n++;faces+=r.faces.length;
  }
  assert.equal(n,25);assert.equal(faces,145);t.diagnostic(`${n} files, ${faces} faces`);
});

test('modern: 45 files, 1,414 faces, every one with a surface record',needsCorpus,t=>{
  const counts=buildLogFaceCounts(CORPUS);let n=0,faces=0,meta=0;
  for(const base of ['test files new/SW2022','test files original'])for(const f of walk(path.join(CORPUS,base))){
    const b=fs.readFileSync(f);if(modern.isOLE2(b))continue;
    const r=display.parseSLDPRT(b,iR,iZ),name=path.basename(path.dirname(f));
    assert.deepEqual(r.errors,[],f);assert.deepEqual(r.rejected,[],f);
    if(base.endsWith('SW2022'))assert.equal(r.faces.length,counts[('sw2022/'+name).toLowerCase()],name);
    n++;faces+=r.faces.length;meta+=r.stats.metadataFaces;
  }
  assert.equal(n,45);assert.equal(faces,1414);assert.equal(meta,1414);t.diagnostic(`${n} files, ${faces} faces, ${meta} surface records`);
});

test('the three oldest originals are refused explicitly',needsCorpus,()=>{
  for(const name of ['SW2000-s01.SLDPRT','chainwheel.sldprt','plate4.sldprt']){
    const r=display.parseSLDPRT(fs.readFileSync(path.join(CORPUS,'test files original',name)),iR,iZ);
    assert(r.errors.length,name);assert.equal(r.faces.length,0,name);
  }
});

test('browser inflater reproduces Node zlib on every file',needsCorpus,t=>{
  let n=0;
  for(const f of [...walk(path.join(CORPUS,'test files new')),...walk(path.join(CORPUS,'test files original'))]){
    const b=fs.readFileSync(f);
    assert.equal(canonical(display.parseSLDPRT(b,browser.inflateRaw,browser.inflate)),canonical(display.parseSLDPRT(b,iR,iZ)),f);n++;
  }
  t.diagnostic(`${n} files, identical parses`);
});

test('upgraded part: empty edge table keeps the surface tag; a wrong table is refused',needsCorpus,()=>{
  const read=m=>fs.readFileSync(path.join(CORPUS,'test files new/SW2022',m,'model.SLDPRT'));
  const r=display.parseSLDPRT(read('C23_cube_sw2011_to_2022'),iR,iZ);
  assert.deepEqual(r.errors,[]);assert.equal(r.faces.length,6);assert.equal(r.stats.metadataFaces,6);
  assert.equal(r.warnings.filter(w=>w.message.startsWith('Metadata edge table empty;')).length,6);
  for(const f of r.faces){assert.equal(f.metadata.typeTag,4001);assert.equal(f.metadata.edgeRecords.length,0);assert(f.edgeAnnotations.some(e=>e.id!==0));}
  const dl=modern.findDisplayLists(read('C00_cube_10mm'),iR,iZ),orig=display.extractDisplayLists(dl);
  const face=orig.faces.find(f=>f.metadata&&f.metadata.edgeRecords.length),bad=Buffer.from(dl);
  bad.writeUInt32LE(0xffffffff,face.metadata.offset+72);
  const changed=display.extractDisplayLists(bad).faces.find(f=>f.offset===face.offset);
  assert.equal(changed.metadata,null);assert.match(changed.metadataError,/edge labels disagree/);
});

test('container: CRC-32 verified on every named stream; inflated size and name length as recorded',needsCorpus,t=>{
  let streams=0,named=0;
  for(const base of ['test files new/SW2022','test files original'])for(const f of walk(path.join(CORPUS,base))){
    const b=fs.readFileSync(f);if(modern.isOLE2(b))continue;
    assert.equal(b[7],4,f+': name rotation key');
    const s=modern.decompressOpenSX(b,iR,iZ);   // throws on any CRC mismatch
    streams+=Object.keys(s).length;
    assert(modern.displayListsVersion(s)>=13000&&modern.displayListsVersion(s)<=17000,f);
    // Header fields beyond the ones the reader uses: +22 inflated size, +28 extra length 0
    const rol=(x,k)=>((x<<k)|(x>>>(8-k)))&255;
    for(let at=b.indexOf(Buffer.from([20,0,6,0,8,0]));at>=0;at=b.indexOf(Buffer.from([20,0,6,0,8,0]),at+1)){
      const h=at-4,nl=b.readUInt32LE(h+26),comp=b.readUInt32LE(h+18);
      if(h<0||nl>1024||comp>50e6||h+30+nl+comp>b.length||!(b.readUInt32LE(h+14)>=65536&&comp>0))continue;
      let name='';for(let i=0;i<nl;i++)name+=String.fromCharCode(rol(b[h+30+i],4));
      if(!/^[\x20-\x7e]+$/.test(name)||!s[name])continue;
      let data;try{data=iR(b.subarray(h+30+nl,h+30+nl+comp));}catch(_){continue;}
      assert.equal(b.readUInt32LE(h+22),data.length,f+' '+name);assert.equal(b.readUInt16LE(h+28),0,f+' '+name);named++;
    }
  }
  assert.equal(named,1730);
  t.diagnostic(`${streams} streams kept; ${named} printable-named stream headers: CRC, inflated size and extra length all as recorded`);
});

test('surface tags agree with the surface types SolidWorks reports (2022, natively authored)',needsCorpus,t=>{
  const TAG={4001:'plane',4002:'cylinder',4003:'cone',4004:'sphere',4005:'torus',4006:'B-surface/parametric'};
  const log=buildLog(CORPUS);let faces=0,models=0;
  for(const f of walk(path.join(CORPUS,'test files new/SW2022'))){
    const name=path.basename(path.dirname(f));if(name==='C23_cube_sw2011_to_2022')continue; // upgraded, see C23 test
    const r=display.parseSLDPRT(fs.readFileSync(f),iR,iZ);
    const got=r.faces.map(x=>TAG[x.metadata.typeTag]).sort(),want=[...log[('sw2022/'+name).toLowerCase()].types].sort();
    assert.deepEqual(got,want,name);faces+=got.length;models++;
  }
  assert.equal(models,23);t.diagnostic(`${models} models, ${faces} faces, tag multiset = SolidWorks' report`);
});

test('strip triangles agree with stored normals; Block1 marks exactly the boundary edges',needsCorpus,t=>{
  let tris=0,boundary=0,interior=0;
  for(const f of walk(path.join(CORPUS,'test files original'))){
    const b=fs.readFileSync(f);if(modern.isOLE2(b))continue;
    for(const face of display.parseSLDPRT(b,iR,iZ).faces){
      const V=i=>[0,1,2].map(k=>face.vertices[3*i+k]),N=i=>[0,1,2].map(k=>face.normals[3*i+k]);
      const ti=face.triangleIndices;
      for(let k=0;k<ti.length;k+=3){
        const a=V(ti[k]),bb=V(ti[k+1]),c=V(ti[k+2]),u=[0,1,2].map(j=>bb[j]-a[j]),w=[0,1,2].map(j=>c[j]-a[j]);
        const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
        const s=[0,1,2].map(j=>N(ti[k])[j]+N(ti[k+1])[j]+N(ti[k+2])[j]);
        assert(n[0]*s[0]+n[1]*s[1]+n[2]*s[2]>0,f+': triangle against stored normals');tris++;
      }
      // an edge of the face triangulation is a boundary edge iff one triangle of the face uses it
      const key=i=>V(i).join(),use=new Map();
      for(let k=0;k<ti.length;k+=3)for(let j=0;j<3;j++){const p=key(ti[k+j]),q=key(ti[k+(j+1)%3]),e=p<q?p+'|'+q:q+'|'+p;use.set(e,(use.get(e)||0)+1);}
      for(const e of face.edgeAnnotations){const p=key(e.vertices[0]),q=key(e.vertices[1]),onBoundary=use.get(p<q?p+'|'+q:q+'|'+p)===1;
        if(onBoundary){assert.notEqual(e.id,0,f);boundary++;}else{assert.equal(e.id,0,f);interior++;}}
    }
  }
  assert.equal(tris,50976);assert.equal(boundary,41010);assert.equal(interior,71037);
  t.diagnostic(`${tris} triangles agree with stored normals; ${boundary} boundary edges nonzero, ${interior} interior edges zero`);
});

test('legacy SW2011 mesh boxes equal the geometry-matched 2022 models',needsCorpus,t=>{
  const box=f=>{const lo=[1/0,1/0,1/0],hi=[-1/0,-1/0,-1/0];for(const x of display.parseSLDPRT(fs.readFileSync(f),iR,iZ).faces)for(let i=0;i<x.vertexCount;i++)for(let k=0;k<3;k++){const v=x.vertices[3*i+k];lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);}return [...lo,...hi];};
  let n=0;
  for(const m of fs.readdirSync(path.join(CORPUS,'test files new/SW2011'))){
    const a=path.join(CORPUS,'test files new/SW2011',m,'model.SLDPRT'),b=path.join(CORPUS,'test files new/SW2022',m,'model.SLDPRT');
    if(!fs.existsSync(a)||!fs.existsSync(b))continue;
    const x=box(a),y=box(b);assert(x.every((v,i)=>Math.abs(v-y[i])<=2e-5),m);n++;
  }
  assert.equal(n,22);t.diagnostic(`${n} geometry-matched models, boxes equal within 2e-5 m`);
});

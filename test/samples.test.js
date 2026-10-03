'use strict';
/* Runs from a fresh clone: no corpus needed. Uses the four parts under samples/. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os'),{spawnSync}=require('child_process');
const S=require('../src'),display=require('../src/display'),modern=require('../src/container/modern'),browser=require('../src/inflate');
const {parseSTEP}=require('./helpers/step-parse');
const {iR,iZ,canonical}=require('./helpers/common');

const SAMPLES=path.join(__dirname,'..','samples');
const file=rel=>path.join(SAMPLES,rel);
const EXPECT={ // faces SolidWorks reports for each model (corpus BUILD_LOG.md)
  'sw2022/C00_cube_10mm.SLDPRT':{faces:6,tags:{4001:6},census:{FACE:6,EDGE:12,VERTEX:8,PLANE:6}},
  'sw2022/C04_cube_hole_5mm.SLDPRT':{faces:7,tags:{4001:6,4002:1},census:{FACE:7,PLANE:6,CYLINDER:1}},
  'sw2022/C15_torus.SLDPRT':{faces:1,tags:{4005:1},census:{FACE:1,TORUS:1}},
  'sw2011/C10_cube_shell_1mm.SLDPRT':{faces:11,tags:{},census:{FACE:11,EDGE:24,VERTEX:16,PLANE:11}},
};

test('display mesh: face counts, surface tags, closed meshes',()=>{
  for(const [rel,e] of Object.entries(EXPECT)){
    const r=S.parse(file(rel));
    assert.deepEqual(r.errors,[],rel);assert.deepEqual(r.rejected,[],rel);
    assert.equal(r.faces.length,e.faces,rel);
    const tags={};for(const f of r.faces)if(f.metadata)tags[f.metadata.typeTag]=(tags[f.metadata.typeTag]||0)+1;
    assert.deepEqual(tags,e.tags,rel);
    for(const f of r.faces){
      assert(f.triangleIndices.every(i=>i<f.vertexCount),rel);
      assert(f.bounds,rel+': bounding record');
      for(let k=0;k<3;k++)assert(f.bounds.min[k]<=f.bounds.max[k]);
    }
    // every triangle edge is used an even number of times: the shell is closed
    const use=new Map();
    for(const f of r.faces)for(let t=0;t<f.triangleIndices.length;t+=3)for(let i=0;i<3;i++){
      const a=f.triangleIndices[t+i],b=f.triangleIndices[t+(i+1)%3];
      const ka=[0,1,2].map(k=>f.vertices[a*3+k]).join(),kb=[0,1,2].map(k=>f.vertices[b*3+k]).join();
      const key=ka<kb?ka+'|'+kb:kb+'|'+ka;use.set(key,(use.get(key)||0)+1);
    }
    assert([...use.values()].every(n=>n%2===0),rel+': open mesh');
  }
});

test('browser inflater gives the identical parse',()=>{
  for(const rel of Object.keys(EXPECT)){
    const b=fs.readFileSync(file(rel));
    assert.equal(canonical(display.parseSLDPRT(b,browser.inflateRaw,browser.inflate)),canonical(display.parseSLDPRT(b,iR,iZ)),rel);
  }
});

test('native B-rep: census and graph checks',()=>{
  for(const [rel,e] of Object.entries(EXPECT)){
    const r=S.readBrep(file(rel));
    assert.equal(r.parsed.error,null,rel);assert(r.parsed.terminated,rel);
    assert.deepEqual(r.graph.errors,[],rel);
    const c=S.parasolid.census(r.parsed);
    for(const [k,v] of Object.entries(e.census))assert.equal(c[k],v,`${rel} ${k}`);
  }
});

test('C00: decoded B-rep is the 10 mm cube at the origin',()=>{
  const r=S.readBrep(file('sw2022/C00_cube_10mm.SLDPRT')).parsed,m=new Map(r.nodes.map(n=>[n.index,n]));
  const pts=r.nodes.filter(n=>n.type===18).map(v=>m.get(v.values.point).values.pvec);
  for(const p of pts)for(const x of p)assert(x===0||Math.abs(x-0.01)<1e-15,'corner '+p);
  assert.equal(new Set(pts.map(p=>p.join())).size,8);
  for(const f of r.nodes.filter(n=>n.type===14)){const pl=m.get(f.values.surface);assert.equal(pl.name,'PLANE');
    assert.equal(pl.values.normal.filter(x=>Math.abs(x)===1).length,1);}
});

test('display face IDs and edge IDs are native Parasolid node IDs',()=>{
  for(const rel of ['sw2022/C00_cube_10mm.SLDPRT','sw2022/C04_cube_hole_5mm.SLDPRT','sw2022/C15_torus.SLDPRT']){
    const d=S.parse(file(rel)),b=S.readBrep(file(rel)).parsed,m=new Map(b.nodes.map(n=>[n.index,n]));
    const faces=new Map(b.nodes.filter(n=>n.type===14).map(n=>[n.values.node_id,n]));
    for(const f of d.faces){
      const nf=faces.get(f.metadata.rawId);assert(nf,rel+': rawId '+f.metadata.rawId);
      const edges=new Set();for(let l=nf.values.loop;l;l=m.get(l).values.next){const first=m.get(l).values.fin;let x=first;do{const fin=m.get(x);if(fin.values.edge)edges.add(m.get(fin.values.edge).values.node_id);x=fin.values.forward;}while(x!==first);}
      assert.deepEqual(new Set(f.metadata.edgeRecords.map(e=>e.id)),edges,rel);
    }
  }
});

test('STL and STEP export',()=>{
  for(const rel of Object.keys(EXPECT)){
    const stl=S.toSTL(file(rel));
    assert.equal(stl.length,84+50*stl.readUInt32LE(80),rel);
    const {text,report}=S.toSTEP(file(rel));
    const ents=parseSTEP(text),ids=new Set(Object.keys(ents).map(Number));
    for(const body of Object.values(ents))for(const m of body.matchAll(/#(\d+)/g))assert(ids.has(+m[1]),rel+': dangling #'+m[1]);
    assert.equal(report.body,'MANIFOLD_SOLID_BREP',rel);
  }
});

test('corruption is reported, not parsed',()=>{
  const cube=fs.readFileSync(file('sw2022/C00_cube_10mm.SLDPRT'));
  // flip one bit of the DisplayLists stream's stored CRC-32
  const key=cube[7],rol=(b,s)=>((b<<s)|(b>>>(8-s)))&255;let crcAt=-1;
  for(let at=cube.indexOf(Buffer.from([20,0,6,0,8,0]));at>=0;at=cube.indexOf(Buffer.from([20,0,6,0,8,0]),at+1)){
    const s=at-4,n=cube.readUInt32LE(s+26);if(s<0||n>1024)continue;let name='';for(let i=0;i<n;i++)name+=String.fromCharCode(rol(cube[s+30+i],key&7));
    if(name==='Contents/DisplayLists'&&cube.readUInt32LE(s+14)>=65536){crcAt=s+14;break;}}
  assert(crcAt>0);const bad=Buffer.from(cube);bad.writeUInt32LE((bad.readUInt32LE(crcAt)^1)>>>0,crcAt);
  assert.match(S.parse(bad).errors.join(),/CRC-32 mismatch in stream Contents\/DisplayLists/);
  const shell=fs.readFileSync(file('sw2011/C10_cube_shell_1mm.SLDPRT'));
  assert(S.parse(shell.subarray(0,100)).errors.length,'truncated OLE header');
  assert(S.parse(shell.subarray(0,shell.length-1024)).errors.length,'truncated OLE sectors');
  const z=zlib.deflateSync(Buffer.from('checksum control'));z[z.length-1]^=1;assert.throws(()=>browser.inflate(z),/Adler/);
});

test('CLI: every command runs on a sample',()=>{
  const bin=path.join(__dirname,'..','bin','sldprt.js'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sldprt-'));
  const run=(...a)=>{const r=spawnSync(process.execPath,[bin,...a],{encoding:'utf8'});assert.equal(r.status,0,a.join(' ')+'\n'+r.stderr);return r.stdout;};
  const c04=file('sw2022/C04_cube_hole_5mm.SLDPRT');
  assert.match(run('info',c04),/7 faces, 152 triangles/);
  assert.equal(JSON.parse(run('parse',c04)).faces.length,7);
  const out=JSON.parse(run('convert',c04,'--stl',path.join(tmp,'a.stl'),'--step',path.join(tmp,'a.step')));
  assert.equal(out.step.analyticPlanes,6);assert(fs.statSync(path.join(tmp,'a.stl')).size>84);
  assert.equal(JSON.parse(run('brep',c04,'--json')).census.FACE,7);
  run('render',c04,path.join(tmp,'a.png'));assert(fs.readFileSync(path.join(tmp,'a.png')).subarray(1,4).toString()==='PNG');
  assert(run('view',c04,'--still').length>1000);
  assert.match(run('help'),/usage: sldprt/);
  fs.rmSync(tmp,{recursive:true,force:true});
});

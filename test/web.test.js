'use strict';
/* Browser viewer plumbing, without a browser: the worker's import graph in an isolated context,
 * the page's inline script compiles, and the server serves every asset the page needs.
 * A real-browser interaction test is not part of this suite. */
const test=require('node:test'),assert=require('assert/strict'),vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),WEB=path.join(ROOT,'web');

test('worker parses modern and legacy samples in an isolated context',()=>{
  const html=fs.readFileSync(path.join(WEB,'index.html'),'utf8');
  for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  const worker=path.join(WEB,'parse-worker.js');
  for(const [rel,faces] of [['samples/sw2011/C10_cube_shell_1mm.SLDPRT',11],['samples/sw2022/C15_torus.SLDPRT',1]]){
    let output;const ctx=vm.createContext({postMessage:x=>output=x});ctx.self=ctx;
    ctx.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.resolve(path.dirname(worker),f),'utf8'),ctx,{filename:f});};
    vm.runInContext(fs.readFileSync(worker,'utf8'),ctx);
    const b=fs.readFileSync(path.join(ROOT,rel));ctx.onmessage({data:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});
    assert(output&&output.parsed,rel+': '+(output&&output.error));
    assert.equal(output.parsed.faces.length,faces,rel);assert(!output.parsed.faces[0].metadata);
  }
});

test('STEP worker writes exact STEP in an isolated context',()=>{
  const worker=path.join(WEB,'step-worker.js'),b=fs.readFileSync(path.join(ROOT,'samples/sw2022/C04_cube_hole_5mm.SLDPRT'));
  let output;const ctx=vm.createContext({postMessage:x=>output=x,TextDecoder,TextEncoder});ctx.self=ctx;
  ctx.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.resolve(path.dirname(worker),f),'utf8'),ctx,{filename:f});};
  vm.runInContext(fs.readFileSync(worker,'utf8'),ctx);
  ctx.onmessage({data:{bytes:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),name:'C04'}});
  assert(output&&output.text,output&&output.error);
  assert.equal(output.report.bodies,1);assert.deepEqual({...output.report.surfaces},{plane:6,cylinder:2});
});

test('server serves the page, worker, sources, previews and the legacy sample',async()=>{
  const {start}=require('../src/serve');
  const {server,url}=await start({port:19083});
  try{
    const origin=new URL(url).origin;
    const assets=['/web/index.html','/web/parse-worker.js','/web/mesh-data.js','/src/display.js','/src/container/modern.js','/src/container/ole.js','/src/inflate.js','/web/step-worker.js','/src/parasolid/partition.js','/src/step/export.js','/src/brep/fit.js','/samples/sw2011/C10_cube_shell_1mm.SLDPRT'];
    for(const a of assets){const r=await fetch(origin+a);assert.equal(r.status,200,a);assert((await r.arrayBuffer()).byteLength>0,a);}
    assert.equal((await fetch(origin+'/..%2f..%2fetc/passwd')).status>=400,true);
    const root=await fetch(origin+'/',{redirect:'manual'});assert.equal(root.status,302);
  }finally{server.close();}
});

test('port 0 binds a free port and reports it',async()=>{
  const {start}=require('../src/serve');
  const {server,url}=await start({port:0});
  try{
    const port=Number(new URL(url).port);
    assert(port>0,url);assert.equal(port,server.address().port);
    assert.equal((await fetch(url)).status,200);
  }finally{server.close();}
});

test('B-rep and exact STEP run without Node built-ins and match Node',()=>{
  const S=require('../src'),X=require('../src/step/export');
  const scripts=['src/inflate.js','src/container/modern.js','src/container/ole.js','src/parasolid/xt.js','src/parasolid/partition.js','src/parasolid/topology.js',
    'src/geom/eval.js','src/brep/native.js','src/brep/fit.js','src/brep/procedural.js','src/brep/split.js','src/step/write.js','src/step/export.js','src/convert.js'];
  // no require, module, Buffer or process: only what a browser worker has
  const ctx=vm.createContext({TextDecoder,TextEncoder,console});ctx.self=ctx;
  for(const f of scripts)vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
  for(const k of ['require','module','Buffer','process'])assert.equal(vm.runInContext('typeof '+k,ctx),'undefined',k);
  const opts={timestamp:'2000-01-01T00:00:00'};
  for(const rel of ['samples/sw2022/C04_cube_hole_5mm.SLDPRT','samples/sw2022/C15_torus.SLDPRT','samples/sw2011/C10_cube_shell_1mm.SLDPRT']){
    const b=fs.readFileSync(path.join(ROOT,rel));
    ctx.bytes=new Uint8Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));ctx.opts=opts;
    const web=vm.runInContext('SLDPRTStepExport.toSTEP(SLDPRTPartition.readBody(bytes).parsed,opts).text',ctx);
    const node=X.toSTEP(S.readBrep(path.join(ROOT,rel)).parsed,opts).text;
    assert.equal(web,node,rel);
    assert(/MANIFOLD_SOLID_BREP\(/.test(web),rel);
  }
});

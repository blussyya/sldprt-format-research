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

test('server serves the page, worker, sources, previews and the legacy sample',async()=>{
  const {start}=require('../src/serve');
  const {server,url}=await start({port:19083});
  try{
    const origin=new URL(url).origin;
    const assets=['/web/index.html','/web/parse-worker.js','/web/mesh-data.js','/src/display.js','/src/container/modern.js','/src/container/ole.js','/src/inflate.js','/samples/sw2011/C10_cube_shell_1mm.SLDPRT'];
    for(const a of assets){const r=await fetch(origin+a);assert.equal(r.status,200,a);assert((await r.arrayBuffer()).byteLength>0,a);}
    assert.equal((await fetch(origin+'/..%2f..%2fetc/passwd')).status>=400,true);
    const root=await fetch(origin+'/',{redirect:'manual'});assert.equal(root.status,302);
  }finally{server.close();}
});

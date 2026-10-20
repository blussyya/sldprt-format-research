'use strict';
/* Exact STEP export (src/step/export.js).
 *
 * Without extra tools: hand-built models for what the corpus lacks (a cavity, two bodies, a
 * surface of revolution, an offset surface) give the right STEP entities and no dangling
 * references.
 * With OpenCascade (tools/validate.js finds a Python with cadquery-ocp, or set
 * SLDPRT_OCP_PYTHON): the same models load as valid solids of the right volume, and every
 * corpus part passes tools/validate.js. Skipped, not passed, when OCP or the corpus is missing. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const X=require('../src/step/export'),Y=require('./helpers/synthetic'),V=require('../tools/validate');
const {parseSTEP}=require('./helpers/step-parse');
const {CORPUS}=require('./helpers/common');

const PY=V.findPython();
const needsOCP={skip:PY?false:'no Python with OCP (cadquery-ocp); set SLDPRT_OCP_PYTHON'};
const needsBoth={skip:!PY?needsOCP.skip:!CORPUS?'corpus not found: clone sldprt-research-dump next to this repo or set SLDPRT_CORPUS':false};
const CASES={cavity:'BREP_WITH_VOIDS',twoBodies:'MANIFOLD_SOLID_BREP',offsetTop:'OFFSET_SURFACE',halfCylinder:'SURFACE_OF_REVOLUTION'};

test('hand-built models: voids, two bodies, revolution, offset',()=>{
  for(const [k,entity] of Object.entries(CASES)){
    const m=Y[k](),{text,report}=X.fromNative(m.N,{name:k,timestamp:'2000-01-01T00:00:00'});
    const ents=parseSTEP(text),ids=new Set(Object.keys(ents).map(Number));
    for(const body of Object.values(ents))for(const r of body.matchAll(/#(\d+)/g))assert(ids.has(+r[1]),k+': dangling #'+r[1]);
    assert(Object.values(ents).some(e=>e.startsWith(entity+'(')),k+': no '+entity);
    assert.equal(report.bodies,m.solids,k);
  }
  const two=parseSTEP(X.fromNative(Y.twoBodies().N).text);
  assert.equal(Object.values(two).filter(e=>e.startsWith('MANIFOLD_SOLID_BREP(')).length,2);
});

function ocp(jobs){
  const r=spawnSync(PY,[path.join(__dirname,'..','tools','validate-step.py')],{input:jobs.map(j=>JSON.stringify(j)).join('\n')+'\n',encoding:'utf8',maxBuffer:1<<26});
  assert.equal(r.status,0,r.stderr);
  return r.stdout.split('\n').filter(Boolean).map(l=>JSON.parse(l));
}

test('OpenCascade: hand-built models are valid solids of the right volume',needsOCP,t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sldprt-step-')),want={},jobs=[];
  for(const k of Object.keys(CASES)){const m=Y[k](),f=path.join(tmp,k+'.step');fs.writeFileSync(f,X.fromNative(m.N,{name:k}).text);want[k]=m;jobs.push({id:k,step:f});}
  for(const r of ocp(jobs)){const m=want[r.id],o=r.ours;
    assert(r.loaded&&o,r.id+': '+(r.error||'not loaded'));
    assert(o.valid,r.id+': BRepCheck not valid');
    assert.equal(o.solids,m.solids,r.id);
    assert(Math.abs(o.volume-m.volume)<=1e-9*m.volume,`${r.id}: volume ${o.volume}, want ${m.volume}`);
    t.diagnostic(`${r.id}: ${o.solids} solid(s), ${o.faces} faces, volume ${o.volume.toFixed(6)} mm³`);}
  fs.rmSync(tmp,{recursive:true,force:true});
});

test('OpenCascade: every corpus part (tools/validate.js)',needsBoth,t=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'sldprt-validate-'));
  const {rows}=V.run({corpus:CORPUS,python:PY,out});
  const by={};for(const r of rows)(by[r.status]=by[r.status]||[]).push(r);
  const bad=[...(by.failed||[]),...(by['export failed']||[])];
  assert.equal(bad.length,0,bad.map(r=>r.part+': '+r.reason).join('\n'));
  // the three pre-2011 parts have no Parasolid partition we can find (docs/open-questions.md)
  assert.deepEqual((by.unreadable||[]).map(r=>path.basename(r.part)).sort(),['SW2000-s01.SLDPRT','chainwheel.sldprt','plate4.sldprt']);
  assert((by['matches SolidWorks']||[]).length>=64);
  t.diagnostic(Object.entries(by).map(([k,v])=>`${k} ${v.length}`).join(', '));
  fs.rmSync(out,{recursive:true,force:true});
});

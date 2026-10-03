'use strict';
/* Exact STEP from the native B-rep against SolidWorks' own STEP export (EXP-076).
 * Skips without the corpus. The OpenCascade checks of the same files (validity, boolean
 * difference, volumes) live in the dump's EXP-076 scripts, since they need Python. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const S=require('../src'),native=require('../src/brep/native'),{compare}=require('../src/brep/compare'),{volume}=require('../src/brep/volume');
const {walk}=require('./helpers/corpus');
const {CORPUS,needsCorpus}=require('./helpers/common');

const models=()=>{const out=[];for(const era of ['SW2011','SW2022'])for(const m of fs.readdirSync(path.join(CORPUS,'test files new',era)).sort()){
  const d=path.join(CORPUS,'test files new',era,m);if(fs.existsSync(path.join(d,'model.step')))out.push({name:era+'/'+m,sldprt:path.join(d,'model.SLDPRT'),step:path.join(d,'model.step')});}return out;};

test('49 controlled models: our STEP reads back as the native body, and holds the same volume as SolidWorks\' STEP',needsCorpus,t=>{
  let n=0,worst=0;const split={};
  for(const m of models()){
    const N=native.build(S.readBrep(m.sldprt).parsed),out=S.toSTEP(m.sldprt,{source:'brep',name:m.name});
    const back=S.step.read(out.text),r=compare(N,back);
    assert(r.pass,`${m.name}: `+r.problems.slice(0,5).join('; '));
    if(out.report.splitFaces)split[m.name]=out.report.splitFaces;
    const mine=volume(back).volume,sw=volume(S.step.read(fs.readFileSync(m.step,'utf8'))).volume;
    assert(Math.abs(mine-sw)<=1e-10*sw,`${m.name}: ${mine*1e9} mm³ vs SolidWorks ${sw*1e9} mm³`);
    worst=Math.max(worst,Math.abs(mine-sw)/sw);n++;
  }
  assert.equal(n,49);
  // whole spheres and tori are the only faces with no boundary
  assert.deepEqual(Object.keys(split).sort(),['SW2011/C14_sphere','SW2011/C15_torus','SW2022/C14_sphere','SW2022/C15_torus']);
  t.diagnostic(`${n} models round-trip; worst relative volume difference to SolidWorks' STEP ${worst.toExponential(1)}`);
});

test('exact volumes against closed-form values',needsCorpus,()=>{
  const r=5,cases={   // mm³; models built to these dimensions (BUILD_LOG.md)
    C00_cube_10mm:1000, C01_cube_20mm:8000, C10_cube_shell_1mm:424, C09_cube_chamfer_1mm:995,
    C04_cube_hole_5mm:1000-Math.PI*2.5*2.5*10, C05_cube_hole_3mm:1000-Math.PI*1.5*1.5*10,
    C13_cone:Math.PI*r*r*10/3, C14_sphere:4/3*Math.PI*r**3, C15_torus:2*Math.PI**2*5*2*2,
    C17_torus_quarter:2*Math.PI**2*5*2*2/4, C19_half_cylinder:Math.PI*r*r*10/2,
    C20_cylinders_crossed:2*Math.PI*r*r*20-16*r**3/3,     // two crossed cylinders (Steinmetz)
  };
  for(const era of ['SW2011','SW2022'])for(const [m,want] of Object.entries(cases)){
    const v=S.volume(path.join(CORPUS,'test files new',era,m,'model.SLDPRT')).volume*1e9;
    assert(Math.abs(v-want)<=1e-10*want,`${era}/${m}: ${v} mm³, closed form ${want}`);
  }
});

test('production parts: exact where every type is supported, mesh fallback otherwise',needsCorpus,t=>{
  const got={};
  for(const f of walk(path.join(CORPUS,'test files original'))){
    const name=path.relative(path.join(CORPUS,'test files original'),f);
    if(name.startsWith('controlled'))continue;   // copies of the controlled cubes, covered above
    let r;try{r=S.toSTEP(f).report;}catch(e){got[name]='none';continue;}
    got[name]=r.source;
    if(r.source==='mesh')assert.match(r.fallback,/INTERSECTION|has no curve/,name);
  }
  const count=k=>Object.values(got).filter(x=>x===k).length;
  assert.equal(got['PTC GE8080-8.SLDPRT'],'brep');
  assert.equal(got['Pocket Wheel.SLDPRT'],'mesh');
  assert.equal(got['cube.SLDPRT'],'brep');
  assert.equal(got['plate4.sldprt'],'brep');        // Parasolid 9 body, all planes
  assert.equal(got['chainwheel.sldprt'],'mesh');    // INTERSECTION curves; mesh from DisplayLists__Zip
  assert.equal(got['SW2000-s01.SLDPRT'],'none');    // no solid in the part
  assert.deepEqual([count('brep'),count('mesh'),count('none')],[3,7,1]);
  t.diagnostic(`exact B-rep STEP ${count('brep')}, mesh fallback ${count('mesh')}, nothing to export ${count('none')}`);
});

test('plate4 (Parasolid 9): exact STEP, volume equals its own display mesh',needsCorpus,()=>{
  const f=path.join(CORPUS,'test files original','plate4.sldprt');
  const out=S.toSTEP(f,{source:'brep'});assert.deepEqual(out.report.surfaces,{plane:14});
  assert(compare(native.build(S.readBrep(f).parsed),S.step.read(out.text)).pass);
  const v=S.volume(f).volume*1e9;assert(Math.abs(v-38400000)<1e-6,String(v));
});

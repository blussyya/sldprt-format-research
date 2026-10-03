'use strict';
/* The native Parasolid body against SolidWorks' own STEP export of the same part (EXP-075).
 * Correspondence modulo seam splitting, at Parasolid's linear resolution (1e-8 m), on all 49
 * controlled models; plus controls showing the comparison fails when it should. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const S=require('../src'),native=require('../src/brep/native'),step=require('../src/step/read'),{compare}=require('../src/brep/compare');
const {CORPUS,needsCorpus}=require('./helpers/common');

const dir=(era,m)=>path.join(CORPUS,'test files new',era,m);
const load=(era,m)=>({N:native.build(S.readBrep(path.join(dir(era,m),'model.SLDPRT')).parsed),T:step.readBrep(fs.readFileSync(path.join(dir(era,m),'model.step'),'utf8'))});

test('49 controlled models: native body = SolidWorks STEP export',needsCorpus,t=>{
  const worst={vertex:0,edge:0,surface:0,length:0};let n=0,faces=0,stepFaces=0,seams=0;
  for(const era of ['SW2011','SW2022'])for(const m of fs.readdirSync(path.join(CORPUS,'test files new',era)).sort()){
    if(!fs.existsSync(path.join(dir(era,m),'model.step')))continue;
    const {N,T}=load(era,m),r=compare(N,T);
    assert(r.pass,`${era}/${m}:\n  `+r.problems.slice(0,10).join('\n  '));
    for(const k in worst)worst[k]=Math.max(worst[k],r.deviation[k]);
    n++;faces+=r.stats.faces.native;stepFaces+=r.stats.faces.step;seams+=r.stats.edges.seams;
  }
  assert.equal(n,49);
  for(const k in worst)assert(worst[k]<1e-15,`${k} deviation ${worst[k]}`);
  t.diagnostic(`${n} models; ${faces} native faces = ${stepFaces} STEP faces after ${seams} seams; worst deviation m: vertex ${worst.vertex.toExponential(1)}, edge ${worst.edge.toExponential(1)}, surface ${worst.surface.toExponential(1)}, length ${worst.length.toExponential(1)}`);
});

test('controls: the comparison catches every mutation and every wrong model',needsCorpus,t=>{
  const first=(N,type)=>N.faces.find(f=>f.surface.type===type);
  const firstEdge=(N,type)=>[...N.edges.values()].find(e=>(e.curve.type==='trimmed'?e.curve.basis.type:e.curve.type)===type);
  const cases=[
    ['vertex moved 1e-7 m','C00_cube_10mm',N=>{const v=[...N.vertices.values()][0];v.p=[v.p[0]+1e-7,v.p[1],v.p[2]];}],
    ['plane offset 1e-7 m','C00_cube_10mm',N=>{const f=first(N,'plane');f.surface.p=f.surface.p.map((x,i)=>x+f.surface.n[i]*1e-7);}],
    ['plane tilted 1e-5 rad','C00_cube_10mm',N=>{const f=first(N,'plane'),n=f.surface.n,q=[n[1],n[2],n[0]];f.surface.n=n.map((x,i)=>x+q[i]*1e-5);}],
    ['face orientation flipped','C00_cube_10mm',N=>{N.faces[2].sameSense=!N.faces[2].sameSense;}],
    ['cylinder radius +1e-7 m','C04_cube_hole_5mm',N=>{first(N,'cylinder').surface.r+=1e-7;}],
    ['circle radius +1e-7 m','C04_cube_hole_5mm',N=>{firstEdge(N,'circle').curve.r+=1e-7;}],
    ['cone half-angle +1e-6 rad','C13_cone',N=>{first(N,'cone').surface.angle+=1e-6;}],
    ['sphere radius +1e-7 m','C14_sphere',N=>{first(N,'sphere').surface.r+=1e-7;}],
    ['torus minor radius +1e-7 m','C15_torus',N=>{first(N,'torus').surface.r+=1e-7;}],
    ['torus major radius +1e-7 m','C17_torus_quarter',N=>{first(N,'torus').surface.R+=1e-7;}],
    ['B-spline control point +1e-6 m','C16_loft_spline',N=>{const s=first(N,'bspline').surface;s.ctrl[4][1]=s.ctrl[4][1].map(x=>x+1e-6);}],
    ['B-spline knot moved','C16_loft_spline',N=>{const s=first(N,'bspline').surface;s.ku=s.ku.map((k,i)=>i===4?0.3:k);}],
    ['ellipse minor radius +1e-7 m','C20_cylinders_crossed',N=>{firstEdge(N,'ellipse').curve.r2+=1e-7;}],
    ['trimmed line shortened','C16_loft_spline',N=>{firstEdge(N,'line').curve.t1-=1e-6;}],
    ['face removed','C07_cube_two_holes',N=>{N.faces.pop();}],
    ['edge removed','C10_cube_shell_1mm',N=>{N.edges.delete([...N.edges.keys()][3]);}],
    ['C04 body vs C11 STEP','C04_cube_hole_5mm',()=>{},'C11_cube_hole_4mm'],
    ['C04 body vs C06 STEP','C04_cube_hole_5mm',()=>{},'C06_cube_hole_moved'],
    ['C03 body vs C12 STEP','C03_cube_fillet_1mm',()=>{},'C12_cube_fillet_1mm_edge2'],
    ['C00 body vs C18 (split line) STEP','C00_cube_10mm',()=>{},'C18_cube_split_line'],
  ];
  for(const [name,m,mutate,other] of cases){
    const {N}=load('SW2022',m),T=load('SW2022',other||m).T;mutate(N);
    assert(!compare(N,T).pass,'not caught: '+name);
  }
  t.diagnostic(`${cases.length}/${cases.length} controls caught`);
});

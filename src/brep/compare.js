'use strict';
/* Compare two neutral B-rep models of the same part (src/brep/native.js, src/step/read.js).
 *
 * STEP writers split periodic faces at seams and closed edges at their seam points, so the two
 * models are not expected to be isomorphic. The test is correspondence modulo subdivision:
 *
 *   vertices  every native vertex coincides with one STEP vertex
 *   edges     every STEP edge lies on exactly one native edge (on its curve, inside its extent),
 *             or is a seam: both its faces belong to the same native face, whose surface is closed
 *   faces     every STEP face lies on exactly one native face: same surface geometry, same
 *             outward side, and each of its non-seam edges is an edge of that face
 *   coverage  the STEP pieces of each native edge add up to its whole length, and every native
 *             face and edge receives at least one STEP piece
 *   adjacency a STEP edge's two faces map to its native edge's two faces
 *
 * Every distance is reported. `tol` defaults to 1e-8 m, Parasolid's own linear resolution
 * (BODY.res_linear): points closer than that are the same point to the kernel.
 */
const G=require('../geom/eval');

/* ---------- edges as parameter intervals ---------- */
function curveParam(c,p){return G.curveProject(c.type==='trimmed'?c.basis:c,p);}
function isPeriodic(c){return c.type==='circle'||c.type==='ellipse'||(c.type==='trimmed'&&isPeriodic(c.basis))||(c.type==='bspline'&&c.periodic);}
function baseCurve(c){return c.type==='trimmed'?c.basis:c;}
/* {c, t0, t1}: the edge as an increasing parameter interval of its (base) curve */
function interval(edge,V){
  const c=edge.curve,b=baseCurve(c),TAU=G.TAU;
  if(c.type==='trimmed')return {c:b,t0:Math.min(c.t0,c.t1),t1:Math.max(c.t0,c.t1),periodic:isPeriodic(b)};
  if(!edge.v){const [a,z]=G.curveRange(b);return {c:b,t0:a,t1:isPeriodic(b)?a+TAU:z,periodic:isPeriodic(b),ring:true};}
  const ps=V.get(edge.v[0]).p,pe=V.get(edge.v[1]).p;
  let ts=curveParam(b,ps).t,te=curveParam(b,pe).t;
  if(isPeriodic(b)&&b.type!=='bspline'){
    if(edge.v[0]===edge.v[1])return {c:b,t0:ts,t1:ts+TAU,periodic:true};
    let [t0,t1]=edge.sameSense?[ts,te]:[te,ts];while(t1<=t0)t1+=TAU;return {c:b,t0,t1,periodic:true};
  }
  if(b.type==='bspline'&&edge.v[0]===edge.v[1]){const [a,z]=G.curveRange(b);return {c:b,t0:a,t1:z,periodic:false};}
  return {c:b,t0:Math.min(ts,te),t1:Math.max(ts,te),periodic:false};
}
function inside(I,t,eps){
  if(I.ring)return true;
  if(I.periodic&&I.c.type!=='bspline'){const L=I.t1-I.t0;let d=((t-I.t0)%G.TAU+G.TAU)%G.TAU;if(d>G.TAU-eps)d-=G.TAU;return d>=-eps&&d<=L+eps;}
  return t>=I.t0-eps&&t<=I.t1+eps;
}
function samples(I,n){const out=[];for(let i=0;i<=n;i++)out.push(G.curvePoint(I.c,I.t0+(I.t1-I.t0)*i/n));return out;}
/* arc length by composite 10-point Gauss–Legendre */
const GL=[[-0.9739065285171717,0.0666713443086881],[-0.8650633666889845,0.1494513491505806],[-0.6794095682990244,0.2190863625159820],[-0.4333953941292472,0.2692667193099963],[-0.1488743389816312,0.2955242247147529],
          [0.1488743389816312,0.2955242247147529],[0.4333953941292472,0.2692667193099963],[0.6794095682990244,0.2190863625159820],[0.8650633666889845,0.1494513491505806],[0.9739065285171717,0.0666713443086881]];
function length(I,segments=64){let L=0;const h=(I.t1-I.t0)/segments;
  for(let s=0;s<segments;s++){const a=I.t0+s*h,m=a+h/2;for(const [x,w] of GL)L+=w*G.norm(G.curveTangent(I.c,m+x*h/2))*h/2;}return L;}

/* ---------- surfaces ---------- */
/* largest distance from STEP-surface points (sampled on the STEP face's boundary and on a grid
 * across the STEP surface near it) to the native surface, plus a parameter-level comparison */
function surfaceParams(a,b){
  const ang=(u,v)=>Math.acos(Math.min(1,Math.abs(G.dot(u,v))));
  const lineDist=(p,q,d)=>{const r=G.sub(q,p);return G.norm(G.sub(r,G.mul(d,G.dot(r,d))));};
  switch(a.type){
    case 'plane':return {angle:ang(a.n,b.n),offset:Math.abs(G.dot(G.sub(b.p,a.p),a.n))};
    case 'cylinder':return {angle:ang(a.a,b.a),axis:lineDist(a.p,b.p,a.a),radius:Math.abs(a.r-b.r)};
    case 'cone':{const apex=s=>G.sub(s.p,G.mul(s.a,s.r/Math.tan(s.angle)));return {angle:ang(a.a,b.a),halfAngle:Math.abs(Math.abs(a.angle)-Math.abs(b.angle)),apex:G.dist(apex(a),apex(b))};}
    case 'sphere':return {centre:G.dist(a.c,b.c),radius:Math.abs(a.r-b.r)};
    case 'torus':return {angle:ang(a.a,b.a),centre:G.dist(a.c,b.c),major:Math.abs(a.R-b.R),minor:Math.abs(a.r-b.r)};
    case 'bspline':return {};
  }
}
function surfaceGrid(s,points){
  if(s.type!=='bspline')return points;
  const out=[],nu=s.ctrl.length,nv=s.ctrl[0].length,[u0,u1]=[s.ku[s.du],s.ku[nu]],[v0,v1]=[s.kv[s.dv],s.kv[nv]];
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++)out.push(G.bsplineSurface(s,u0+(u1-u0)*i/8,v0+(v1-v0)*j/8).p);
  return out;
}

function compare(N,T,opts={}){
  const tol=opts.tol||1e-8,n=opts.samples||16;
  const problems=[],dev={vertex:0,edge:0,surface:0,length:0},stats={};
  const fail=msg=>{problems.push(msg);};

  // 1. vertices
  const vmap=new Map(),used=new Set();
  for(const v of N.vertices.values()){
    let best=null;for(const w of T.vertices.values()){const d=G.dist(v.p,w.p);if(!best||d<best.d)best={w,d};}
    if(!best){fail('vertex '+v.id+': no STEP vertex');continue;}
    dev.vertex=Math.max(dev.vertex,best.d);
    if(best.d>tol)fail(`vertex ${v.id}: nearest STEP vertex #${best.w.id} is ${best.d.toExponential(2)} m away`);
    if(used.has(best.w.id))fail(`vertex ${v.id}: STEP vertex #${best.w.id} already matched`);
    used.add(best.w.id);vmap.set(v.id,best.w.id);
  }
  stats.vertices={native:N.vertices.size,step:T.vertices.size,matched:vmap.size};

  // 2. edges: each STEP edge onto a native edge
  const NI=new Map([...N.edges.values()].map(e=>[e.id,interval(e,N.vertices)]));
  const nativeFacesOfEdge=new Map(),stepFacesOfEdge=new Map();
  for(const f of N.faces)for(const l of f.loops)for(const c of l.coedges)(nativeFacesOfEdge.get(c.edge)||nativeFacesOfEdge.set(c.edge,[]).get(c.edge)).push(f.id);
  for(const f of T.faces)for(const l of f.loops)for(const c of l.coedges)(stepFacesOfEdge.get(c.edge)||stepFacesOfEdge.set(c.edge,[]).get(c.edge)).push(f.id);
  const emap=new Map(),pieces=new Map(),seamCandidates=[];
  for(const e of T.edges.values()){
    const I=interval(e,T.vertices),pts=samples(I,n),cands=[];
    for(const ne of N.edges.values()){
      const J=NI.get(ne.id);let worst=0,ok=true;
      for(const p of pts){const r=G.curveProject(J.c,p);if(r.d>tol*100){ok=false;break;}
        worst=Math.max(worst,r.d);if(!inside(J,r.t,1e-9)){ok=false;break;}}
      if(ok)cands.push({ne,worst});
    }
    cands.sort((a,b)=>a.worst-b.worst);
    if(!cands.length){seamCandidates.push(e);continue;}
    if(cands.length>1&&cands[1].worst<=tol)fail(`STEP edge #${e.id}: lies on ${cands.length} native edges (${cands.map(c=>c.ne.id).join(', ')})`);
    const c=cands[0];dev.edge=Math.max(dev.edge,c.worst);
    if(c.worst>tol)fail(`STEP edge #${e.id}: ${c.worst.toExponential(2)} m from native edge ${c.ne.id}`);
    emap.set(e.id,c.ne.id);(pieces.get(c.ne.id)||pieces.set(c.ne.id,[]).get(c.ne.id)).push(e.id);
  }
  // coverage: every native edge, whole length
  for(const ne of N.edges.values()){
    const P=pieces.get(ne.id);if(!P){fail(`native edge ${ne.id} (${ne.curve.type}): no STEP edge on it`);continue;}
    const Ln=length(NI.get(ne.id)),Ls=P.reduce((s,id)=>s+length(interval(T.edges.get(id),T.vertices)),0);
    dev.length=Math.max(dev.length,Math.abs(Ln-Ls));
    if(Math.abs(Ln-Ls)>tol)fail(`native edge ${ne.id} (${ne.curve.type}): length ${Ln.toExponential(6)} m, STEP pieces ${Ls.toExponential(6)} m`);
  }

  // 3. faces
  const fmap=new Map(),fdev=[];
  for(const f of T.faces){
    const nonSeam=[];for(const l of f.loops)for(const c of l.coedges)if(emap.has(c.edge))nonSeam.push(emap.get(c.edge));
    let best=null;
    for(const nf of N.faces){
      if(nf.surface.type!==f.surface.type)continue;
      const own=new Set();for(const l of nf.loops)for(const c of l.coedges)own.add(c.edge);
      if(!nonSeam.every(id=>own.has(id)))continue;
      // geometry: STEP boundary samples and surface grid against the native surface
      const pts=[];for(const l of f.loops)for(const c of l.coedges){const I=interval(T.edges.get(c.edge),T.vertices);pts.push(...samples(I,4));}
      let worst=0;for(const p of surfaceGrid(f.surface,pts)){worst=Math.max(worst,Math.abs(G.surfaceDistance(nf.surface,p).d));if(worst>tol*1e3)break;}
      if(!best||worst<best.worst)best={nf,worst,pts};
    }
    if(!best){fail(`STEP face #${f.id} (${f.surface.type}): no native face with the same surface type and edges`);continue;}
    if(f.surface.type==='bspline'){ // and the other way: the native surface lies on the STEP one
      for(const p of surfaceGrid(best.nf.surface,[]))best.worst=Math.max(best.worst,Math.abs(G.surfaceDistance(f.surface,p).d));
    }
    fmap.set(f.id,best.nf.id);dev.surface=Math.max(dev.surface,best.worst);
    if(best.worst>tol)fail(`STEP face #${f.id}: ${best.worst.toExponential(2)} m from native face ${best.nf.id}`);
    const pd=surfaceParams(best.nf.surface,f.surface);fdev.push({step:f.id,native:best.nf.id,type:f.surface.type,...pd});
    // orientation: outward normals agree at a boundary sample
    const p=best.pts[Math.floor(best.pts.length/2)],a=G.surfaceDistance(best.nf.surface,p).n,b=G.surfaceDistance(f.surface,p).n;
    if(a&&b){const s=G.dot(a,b)*(best.nf.sameSense?1:-1)*(f.sameSense?1:-1);if(s<0.999)fail(`STEP face #${f.id}: outward normal disagrees with native face ${best.nf.id} (cos ${s.toFixed(6)})`);}
  }
  for(const nf of N.faces)if(![...fmap.values()].includes(nf.id))fail(`native face ${nf.id} (${nf.surface.type}): no STEP face on it`);

  // 4. seams and adjacency. Only a closed (periodic) surface can be split by a seam: a STEP edge
  // that cuts a plane, say, is a real edge the native body lacks (a split line).
  const nativeFace=new Map(N.faces.map(f=>[f.id,f]));
  const closedSurface=s=>s.type==='cylinder'||s.type==='cone'||s.type==='sphere'||s.type==='torus'||(s.type==='bspline'&&(s.uPeriodic||s.vPeriodic||s.uClosed||s.vClosed));
  const fragments=new Map();for(const [sf,nf] of fmap)fragments.set(nf,(fragments.get(nf)||0)+1);
  for(const [nf,k] of fragments)if(k>1&&!closedSurface(nativeFace.get(nf).surface))fail(`native face ${nf} (${nativeFace.get(nf).surface.type}): split into ${k} STEP faces, but its surface is not closed`);
  let seams=0;
  for(const e of seamCandidates){
    const fs=(stepFacesOfEdge.get(e.id)||[]).map(id=>fmap.get(id));
    if(fs.length===2&&fs[0]!==undefined&&fs[0]===fs[1]&&closedSurface(nativeFace.get(fs[0]).surface)){seams++;continue;}
    fail(`STEP edge #${e.id} (${e.curve.type}): on no native edge and not a seam (faces → native ${fs.join(', ')})`);
  }
  for(const [se,ne] of emap){
    const a=(stepFacesOfEdge.get(se)||[]).map(id=>fmap.get(id)).sort().join(),b=[...(nativeFacesOfEdge.get(ne)||[])].sort().join();
    if(a!==b)fail(`STEP edge #${se}: faces map to native [${a}], native edge ${ne} is between [${b}]`);
  }
  stats.edges={native:N.edges.size,step:T.edges.size,onNativeEdges:emap.size,seams};
  stats.faces={native:N.faces.length,step:T.faces.length,mapped:fmap.size};
  return {pass:problems.length===0,tol,problems,deviation:dev,stats,surfaceParameters:fdev,map:{vertices:vmap,edges:emap,faces:fmap}};
}

module.exports={compare,interval,length,inside,samples};

'use strict';
/* Exact enclosed volume of a neutral B-rep model (src/brep/native.js or src/step/read.js),
 * computed from the surfaces and edge curves themselves, without tessellating.
 *
 *   volume(model) -> {volume (m³), faces, unsupported:[...]}
 *
 * Divergence theorem: V = (1/3) ∬ S·(S_u × S_v) du dv over every face, in the surface's own
 * parameters (u,v), where S_u × S_v is the natural normal. Green's theorem turns each face
 * integral into a line integral round the face's loops, evaluated along the exact edge curves
 * with composite Gauss–Legendre:
 *
 *   K-form  ∬ g du dv =  ∮ K dv,  K(u,v) = ∫ from u_ref to u of g(s,v) ds
 *   H-form  ∬ g du dv = −∮ H du,  H(u,v) = ∫ from v_ref to v of g(u,t) dt
 *
 * A face whose loops wrap round the periodic u direction (a hole's cylinder, a cone's base
 * circle, a hemisphere's equator) uses the H-form, which needs no seam because H is periodic in
 * u. v_ref goes at the apex of a cone and at the pole inside a hemisphere, so those degenerate
 * boundary pieces contribute nothing. A face that does not wrap in u uses the K-form, where
 * degenerate pieces at a pole (dv = 0) drop out on their own.
 * Planes use offset × area, the area by the shoelace integral.
 *
 * Loops run counter-clockwise about the face's outward normal (STEP's convention, which
 * native.js reproduces), so face orientation is already in the loop direction.
 */
const G=require('../geom/eval');

const GL=[[-0.9739065285171717,0.0666713443086881],[-0.8650633666889845,0.1494513491505806],[-0.6794095682990244,0.2190863625159820],[-0.4333953941292472,0.2692667193099963],[-0.1488743389816312,0.2955242247147529],
          [0.1488743389816312,0.2955242247147529],[0.4333953941292472,0.2692667193099963],[0.6794095682990244,0.2190863625159820],[0.8650633666889845,0.1494513491505806],[0.9739065285171717,0.0666713443086881]];
const TAU=G.TAU;
function gauss(f,a,b,segments){const h=(b-a)/segments;let s=0;for(let k=0;k<segments;k++){const m=a+(k+0.5)*h;for(const [x,w] of GL)s+=w*f(m+x*h/2);}return s*h/2;}
/* the same, but split at the given breakpoints (B-spline knots, where the integrand loses
 * smoothness and plain Gauss–Legendre loses its accuracy) */
function gaussSplit(f,a,b,segments,breaks){
  if(!breaks||a===b)return gauss(f,a,b,segments);
  const lo=Math.min(a,b),hi=Math.max(a,b),pts=[lo,...breaks.filter(k=>k>lo&&k<hi),hi];let s=0;
  for(let i=0;i+1<pts.length;i++)s+=gauss(f,pts[i],pts[i+1],segments);
  return a<b?s:-s;
}

/* The parameter path an edge traverses from its start vertex to its end vertex. */
function edgePath(e,V){
  const c=e.curve.type==='trimmed'?e.curve.basis:e.curve;
  const periodic=c.type==='circle'||c.type==='ellipse';
  if(!e.v){const [a]=G.curveRange(c);return {c,t0:a,t1:a+(e.sameSense?TAU:-TAU)};}
  const ps=V.get(e.v[0]).p,pe=V.get(e.v[1]).p;
  let ts=G.curveProject(c,ps).t,te=G.curveProject(c,pe).t;
  if(periodic){
    if(e.v[0]===e.v[1])te=ts+(e.sameSense?TAU:-TAU);
    else if(e.sameSense){while(te<=ts)te+=TAU;}else{while(te>=ts)te-=TAU;}
  }
  return {c,t0:ts,t1:te};
}

/* Surface parametrisations: eval(u,v) -> {S, Su, Sv}; param(P) -> [u, v] with u an angle where
 * the surface is periodic in u. */
function frame(a,x){const z=G.unit(a),xx=G.unit(G.sub(x,G.mul(z,G.dot(x,z))));return {z,x:xx,y:G.cross(z,xx)};}
function parametrise(s){
  const ang=(F,q)=>Math.atan2(G.dot(q,F.y),G.dot(q,F.x));
  const rho=(F,u)=>G.add(G.mul(F.x,Math.cos(u)),G.mul(F.y,Math.sin(u))),drho=(F,u)=>G.add(G.mul(F.x,-Math.sin(u)),G.mul(F.y,Math.cos(u)));
  switch(s.type){
    case 'cylinder':{const F=frame(s.a,s.x);return {periodicU:true,vRef:0,
      eval:(u,v)=>({S:G.add(G.add(s.p,G.mul(F.z,v)),G.mul(rho(F,u),s.r)),Su:G.mul(drho(F,u),s.r),Sv:F.z}),
      param:P=>{const q=G.sub(P,s.p);return [ang(F,q),G.dot(q,F.z)];}};}
    case 'cone':{const F=frame(s.a,s.x),t=Math.tan(s.angle);return {periodicU:true,vRef:t?-s.r/t:0,     // v_ref at the apex
      eval:(u,v)=>{const R=s.r+v*t;return {S:G.add(G.add(s.p,G.mul(F.z,v)),G.mul(rho(F,u),R)),Su:G.mul(drho(F,u),R),Sv:G.add(F.z,G.mul(rho(F,u),t))};},
      param:P=>{const q=G.sub(P,s.p);return [ang(F,q),G.dot(q,F.z)];}};}
    case 'sphere':{const F=frame(s.a,s.x);return {periodicU:true,vRef:-Math.PI/2,
      eval:(u,v)=>{const cr=Math.cos(v),sr=Math.sin(v),R=rho(F,u);
        return {S:G.add(s.c,G.mul(G.add(G.mul(R,cr),G.mul(F.z,sr)),s.r)),Su:G.mul(drho(F,u),s.r*cr),Sv:G.mul(G.add(G.mul(R,-sr),G.mul(F.z,cr)),s.r)};},
      param:P=>{const q=G.sub(P,s.c),h=G.dot(q,F.z),rr=Math.hypot(G.dot(q,F.x),G.dot(q,F.y));return [ang(F,q),Math.atan2(h,rr)];}};}
    case 'torus':{const F=frame(s.a,s.x);return {periodicU:true,vRef:0,
      eval:(u,v)=>{const R=rho(F,u),cv=Math.cos(v),sv=Math.sin(v);
        return {S:G.add(s.c,G.add(G.mul(R,s.R+s.r*cv),G.mul(F.z,s.r*sv))),Su:G.mul(drho(F,u),s.R+s.r*cv),Sv:G.add(G.mul(R,-s.r*sv),G.mul(F.z,s.r*cv))};},
      param:P=>{const q=G.sub(P,s.c),h=G.dot(q,F.z),rr=Math.hypot(G.dot(q,F.x),G.dot(q,F.y));return [ang(F,q),Math.atan2(h,rr-s.R)];}};}
    case 'bspline':{let last=null;return {periodicU:false,vRef:s.kv[s.dv],uBreaks:[...new Set(s.ku)],vBreaks:[...new Set(s.kv)],
      eval:(u,v)=>{const e=G.bsplineSurface(s,u,v);return {S:e.p,Su:e.du,Sv:e.dv};},
      param:P=>{const r=G.bsplineProject(s,P,last);last=r;return [r.u,r.v];}};}
  }
  return null;
}

/* Per-point boundary samples for a face: parameters, their rates along the curve, Gauss weight. */
function boundarySamples(face,M,par,segments){
  const loops=[];
  for(const loop of face.loops){
    const pts=[];
    for(const co of loop.coedges){
      let p=edgePath(M.edges.get(co.edge),M.vertices);if(!co.sense)p={c:p.c,t0:p.t1,t1:p.t0};
      const h=(p.t1-p.t0)/segments;
      for(let k=0;k<segments;k++){const m=p.t0+(k+0.5)*h;for(const [x,w] of GL){
        const t=m+x*h/2,P=G.curvePoint(p.c,t),D=G.curveTangent(p.c,t),[u,v]=par.param(P),e=par.eval(u,v);
        // (du, dv)/dt from S_u du + S_v dv = P'(t), least squares
        const a=G.dot(e.Su,e.Su),b=G.dot(e.Su,e.Sv),c=G.dot(e.Sv,e.Sv),x1=G.dot(D,e.Su),y1=G.dot(D,e.Sv),det=a*c-b*b;
        pts.push({u,v,du:(c*x1-b*y1)/det,dv:(a*y1-b*x1)/det,w:w*h/2});}}
    }
    loops.push(pts);
  }
  return loops;
}
const wrapTo=(x,ref)=>x-TAU*Math.round((x-ref)/TAU);
/* Branch for an angle that does not wrap round the face. The cut has to fall outside the face,
 * so it goes in one of the widest gaps between boundary samples. When two gaps tie (a half sphere
 * or half torus, bounded by two opposite circles) the boundary alone cannot tell the sides apart;
 * the loop direction can: the face's (u,v) area, ∮ u dv or −∮ v du, comes out with the sign of its
 * orientation only when the cut is outside it. Returns the centre of the chosen branch. */
function chooseBranch(angles,signedArea,orientation){
  const a=angles.map(x=>((x%TAU)+TAU)%TAU).sort((p,q)=>p-q),gaps=[];
  for(let i=0;i<a.length;i++){const next=i+1<a.length?a[i+1]:a[0]+TAU;gaps.push({size:next-a[i],mid:a[i]+(next-a[i])/2});}
  const widest=Math.max(...gaps.map(g=>g.size)),cands=gaps.filter(g=>g.size>=widest*0.999).map(g=>g.mid+Math.PI);
  for(const c of cands)if(signedArea(c)*orientation>0)return c;
  return cands[0];
}
function faceIntegral(face,M,segments){
  const s=face.surface;
  if(s.type==='plane'){
    const F=frame(s.n,s.x),off=G.dot(s.p,F.z);let a=0;
    for(const loop of face.loops)for(const co of loop.coedges){
      let p=edgePath(M.edges.get(co.edge),M.vertices);if(!co.sense)p={c:p.c,t0:p.t1,t1:p.t0};
      a+=gauss(t=>G.dot(G.curvePoint(p.c,t),F.x)*G.dot(G.curveTangent(p.c,t),F.y),p.t0,p.t1,segments);
    }
    return off*a/3;
  }
  const par=parametrise(s);if(!par)return null;
  const g=(u,v)=>{const e=par.eval(u,v);return G.dot(e.S,G.cross(e.Su,e.Sv));};
  const loops=boundarySamples(face,M,par,segments);
  const wraps=par.periodicU&&loops.some(L=>Math.abs(L.reduce((sum,q)=>sum+q.du*q.w,0))>1);
  let total=0;
  if(wraps){            // H-form, H periodic in u
    let vref=par.vRef;
    if(s.type==='sphere'){   // a wrapping sphere face contains at most one pole: integrate from that one
      const all=loops.flat(),o=face.sameSense?1:-1,area=r=>-all.reduce((x,q)=>x+(q.v-r)*q.du*q.w,0);
      vref=area(-Math.PI/2)*o>0?-Math.PI/2:Math.PI/2;}
    if(s.type==='torus'){const all=loops.flat();vref=chooseBranch(all.map(q=>q.v),c=>-all.reduce((x,q)=>x+wrapTo(q.v,c)*q.du*q.w,0),face.sameSense?1:-1);for(const q of all)q.v=wrapTo(q.v,vref);}
    for(const L of loops)for(const q of L){
      const H=gaussSplit(t=>g(q.u,t),vref,q.v,8,par.vBreaks);total+=-H*q.du*q.w;}
  }else{                // K-form, one consistent branch of u across the face
    const all=loops.flat(),o=face.sameSense?1:-1;let uref=all[0].u;
    if(par.periodicU){
      const c=chooseBranch(all.map(q=>q.u),c=>all.reduce((x,q)=>x+wrapTo(q.u,c)*q.dv*q.w,0),o);
      for(const q of all)q.u=wrapTo(q.u,c);uref=c;}
    if(s.type==='torus'&&!loops.some(L=>Math.abs(L.reduce((x,q)=>x+q.dv*q.w,0))>1)){
      const c=chooseBranch(all.map(q=>q.v),c=>-all.reduce((x,q)=>x+wrapTo(q.v,c)*q.du*q.w,0),o);
      for(const q of all)q.v=wrapTo(q.v,c);}
    for(const q of all){const K=gaussSplit(x=>g(x,q.v),uref,q.u,8,par.uBreaks);total+=K*q.dv*q.w;}
  }
  return total/3;
}

/* Faces with no boundary (a whole sphere or torus) are measured through src/brep/seams.js,
 * which splits them into bounded pieces the same way the STEP writer does. */
function volume(model,opts={}){
  const segments=opts.segments||64;
  const M=model.faces.some(f=>!f.loops.length)?require('./seams').addSeams(model):model;
  let v=0;const unsupported=new Set();
  for(const f of M.faces){const x=faceIntegral(f,M,segments);if(x===null)unsupported.add(f.surface.type);else v+=x;}
  return {volume:unsupported.size?undefined:v,faces:M.faces.length,unsupported:[...unsupported]};
}

module.exports={volume,edgePath,parametrise};

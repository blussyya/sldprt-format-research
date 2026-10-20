/* Geometry evaluation shared by the B-rep readers, the comparison and the STEP writer.
 *
 * Neutral forms (all lengths in metres, directions unit length):
 *   curves   {type:'line', p, d}
 *            {type:'circle', c, n, x, r}            point(t) = c + r(cos t x + sin t y),  y = n × x
 *            {type:'ellipse', c, n, x, r1, r2}       r1 along x
 *            {type:'bspline', degree, ctrl, weights|null, knots, closed}
 *            {type:'trimmed', basis, t0, t1}        a parameter range of `basis`
 *            {type:'spcurve', surface, c2}          surface(c2(t)); c2 is a 2D bspline whose
 *                                                   control points are [u, v, 0]
 *   surfaces {type:'plane', p, n, x}                 (u, v) along x and n × x
 *            {type:'cylinder', p, a, x, r}           u angle from x about a, v along a
 *            {type:'cone', p, a, x, r, angle}        radius r at p, growing along +a by tan(angle);
 *                                                   u angle, v along the generator (as in STEP)
 *            {type:'sphere', c, a, x, r}             u longitude, v latitude
 *            {type:'torus', c, a, x, R, r}           u around a, v around the tube
 *            {type:'bspline', du, dv, ctrl[u][v], weights[u][v]|null, ku, kv}
 *            {type:'swept', curve, d}                curve(u) + v d               (linear extrusion)
 *            {type:'spun', curve, c, a}              curve(v) turned by u about the axis (c, a)
 *            {type:'offset', basis, d}               basis(u, v) + d · normal(u, v)
 * The surface's natural normal is the one STEP uses: ∂u × ∂v. That is n on a plane and outward on
 * cylinder, cone, sphere and torus.
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTGeom).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SLDPRTGeom=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>{const m=norm(a);return m?mul(a,1/m):[0,0,0];};
const dist=(a,b)=>norm(sub(a,b));
const TAU=2*Math.PI;

/* ---------------- B-splines ---------------- */
function span(knots,degree,nCtrl,t){
  const lo=knots[degree],hi=knots[nCtrl];
  if(t>=hi)t=hi; if(t<=lo)t=lo;
  if(t===hi){let k=nCtrl-1;while(k>degree&&knots[k]===knots[k+1])k--;return k;}
  let a=degree,b=nCtrl;while(b-a>1){const m=(a+b)>>1;if(t<knots[m])b=m;else a=m;}return a;
}
/* Nonzero basis functions of degree p on knot span k (The NURBS Book A2.2). */
function basisFuns(knots,p,k,t){
  const N=[1],left=[0],right=[0];
  for(let j=1;j<=p;j++){left[j]=t-knots[k+1-j];right[j]=knots[k+j]-t;let saved=0;
    for(let r=0;r<j;r++){const temp=N[r]/(right[r+1]+left[j-r]);N[r]=saved+right[r+1]*temp;saved=left[j-r]*temp;}
    N[j]=saved;}
  return N;
}
/* Basis values B and first derivatives D for functions k-p … k. */
function basis(knots,p,k,t){
  const B=basisFuns(knots,p,k,t),D=new Array(p+1).fill(0);
  if(p===0)return {B,D};
  const M=basisFuns(knots,p-1,k,t); // functions k-p+1 … k of degree p-1
  for(let j=0;j<=p;j++){const i=k-p+j;let d=0;
    if(j>=1){const den=knots[i+p]-knots[i];if(den)d+=M[j-1]/den;}
    if(j<=p-1){const den=knots[i+p+1]-knots[i+1];if(den)d-=M[j]/den;}
    D[j]=p*d;}
  return {B,D};
}
function bsplineCurve(c,t){
  const n=c.ctrl.length,k=span(c.knots,c.degree,n,t),{B,D}=basis(c.knots,c.degree,k,t);
  let P=[0,0,0],dP=[0,0,0],W=0,dW=0;
  for(let j=0;j<=c.degree;j++){const i=k-c.degree+j,w=c.weights?c.weights[i]:1;
    P=add(P,mul(c.ctrl[i],B[j]*w));dP=add(dP,mul(c.ctrl[i],D[j]*w));W+=B[j]*w;dW+=D[j]*w;}
  const p=mul(P,1/W);return {p,d:mul(sub(dP,mul(p,dW)),1/W)};
}
function bsplineSurface(s,u,v){
  const nu=s.ctrl.length,nv=s.ctrl[0].length,ku=span(s.ku,s.du,nu,u),kv=span(s.kv,s.dv,nv,v);
  const bu=basis(s.ku,s.du,ku,u),bv=basis(s.kv,s.dv,kv,v);
  let P=[0,0,0],Pu=[0,0,0],Pv=[0,0,0],W=0,Wu=0,Wv=0;
  for(let a=0;a<=s.du;a++)for(let b=0;b<=s.dv;b++){
    const i=ku-s.du+a,j=kv-s.dv+b,w=s.weights?s.weights[i][j]:1,q=s.ctrl[i][j];
    const f=bu.B[a]*bv.B[b]*w,fu=bu.D[a]*bv.B[b]*w,fv=bu.B[a]*bv.D[b]*w;
    P=add(P,mul(q,f));Pu=add(Pu,mul(q,fu));Pv=add(Pv,mul(q,fv));W+=f;Wu+=fu;Wv+=fv;}
  const p=mul(P,1/W);
  return {p,du:mul(sub(Pu,mul(p,Wu)),1/W),dv:mul(sub(Pv,mul(p,Wv)),1/W)};
}

/* ---------------- curves ---------------- */
function frame(n,x){const y=cross(n,x);return {x,y,n};}
function curvePoint(c,t){
  switch(c.type){
    case 'line':return add(c.p,mul(c.d,t));
    case 'circle':{const {x,y}=frame(c.n,c.x);return add(c.c,add(mul(x,c.r*Math.cos(t)),mul(y,c.r*Math.sin(t))));}
    case 'ellipse':{const {x,y}=frame(c.n,c.x);return add(c.c,add(mul(x,c.r1*Math.cos(t)),mul(y,c.r2*Math.sin(t))));}
    case 'bspline':return bsplineCurve(c,t).p;
    case 'trimmed':return curvePoint(c.basis,t);
    case 'spcurve':{const q=bsplineCurve(c.c2,t).p;return surfaceEval(c.surface,q[0],q[1]).p;}
  }
  throw Error('curvePoint: '+c.type);
}
function curveTangent(c,t){
  switch(c.type){
    case 'line':return c.d;
    case 'circle':{const {x,y}=frame(c.n,c.x);return add(mul(x,-c.r*Math.sin(t)),mul(y,c.r*Math.cos(t)));}
    case 'ellipse':{const {x,y}=frame(c.n,c.x);return add(mul(x,-c.r1*Math.sin(t)),mul(y,c.r2*Math.cos(t)));}
    case 'bspline':return bsplineCurve(c,t).d;
    case 'trimmed':return curveTangent(c.basis,t);
    case 'spcurve':{const q=bsplineCurve(c.c2,t),e=surfaceEval(c.surface,q.p[0],q.p[1]);return add(mul(e.du,q.d[0]),mul(e.dv,q.d[1]));}
  }
  throw Error('curveTangent: '+c.type);
}
const periodic=c=>c.type==='circle'||c.type==='ellipse'||(c.type==='trimmed'&&periodic(c.basis));
function curveRange(c){
  switch(c.type){
    case 'line':return [-Infinity,Infinity];
    case 'circle':case 'ellipse':return [0,TAU];
    case 'bspline':return [c.knots[c.degree],c.knots[c.ctrl.length]];
    case 'trimmed':return [c.t0,c.t1];
    case 'spcurve':return [c.c2.knots[c.c2.degree],c.c2.knots[c.c2.ctrl.length]];
  }
}
/* Parameter of the point on curve c closest to p, and the distance. For periodic curves the
 * parameter is in [0, 2π). Bounded curves are searched over their own range. */
function curveProject(c,p){
  if(c.type==='trimmed'){const r=curveProject(c.basis,p);return r;}
  if(c.type==='line'){const t=dot(sub(p,c.p),c.d);return {t,d:dist(p,curvePoint(c,t))};}
  if(c.type==='circle'){const {x,y}=frame(c.n,c.x),q=sub(p,c.c);let t=Math.atan2(dot(q,y),dot(q,x));if(t<0)t+=TAU;return {t,d:dist(p,curvePoint(c,t))};}
  // ellipse, B-spline and curves on surfaces: dense sampling, then Newton on (C(t)-p)·C'(t) = 0
  const [a,b]=curveRange(c),N=c.type==='bspline'?Math.max(64,c.ctrl.length*16):c.type==='spcurve'?Math.max(64,c.c2.ctrl.length*16):256;
  let best={t:a,d:Infinity};
  for(let i=0;i<=N;i++){const t=a+(b-a)*i/N,d=dist(p,curvePoint(c,t));if(d<best.d)best={t,d};}
  let t=best.t;
  for(let it=0;it<50;it++){
    const h=(b-a)*1e-7,C=curvePoint(c,t),D=curveTangent(c,t),D2=mul(sub(curveTangent(c,Math.min(b,t+h)),curveTangent(c,Math.max(a,t-h))),1/(Math.min(b,t+h)-Math.max(a,t-h)));
    const f=dot(sub(C,p),D),fp=dot(D,D)+dot(sub(C,p),D2);if(!fp)break;
    let nt=t-f/fp;if(c.type==='ellipse'){nt=((nt%TAU)+TAU)%TAU;}else nt=Math.min(b,Math.max(a,nt));
    if(Math.abs(nt-t)<1e-15*(1+Math.abs(t))){t=nt;break;}t=nt;
  }
  const d=dist(p,curvePoint(c,t));
  return d<=best.d?{t,d}:best;
}

/* ---------------- surfaces: evaluation ---------------- */
/* Point and first partial derivatives at (u, v). */
function surfaceEval(s,u,v){
  switch(s.type){
    case 'plane':{const y=cross(s.n,s.x);return {p:add(s.p,add(mul(s.x,u),mul(y,v))),du:s.x,dv:y};}
    case 'cylinder':{const y=cross(s.a,s.x),c=Math.cos(u),sn=Math.sin(u),r=add(mul(s.x,c),mul(y,sn));
      return {p:add(s.p,add(mul(r,s.r),mul(s.a,v))),du:mul(add(mul(s.x,-sn),mul(y,c)),s.r),dv:s.a};}
    case 'cone':{const y=cross(s.a,s.x),c=Math.cos(u),sn=Math.sin(u),r=add(mul(s.x,c),mul(y,sn)),sa=Math.sin(s.angle),ca=Math.cos(s.angle),rho=s.r+v*sa;
      return {p:add(s.p,add(mul(r,rho),mul(s.a,v*ca))),du:mul(add(mul(s.x,-sn),mul(y,c)),rho),dv:add(mul(r,sa),mul(s.a,ca))};}
    case 'sphere':{const y=cross(s.a,s.x),c=Math.cos(u),sn=Math.sin(u),r=add(mul(s.x,c),mul(y,sn)),cv=Math.cos(v),sv=Math.sin(v);
      return {p:add(s.c,add(mul(r,s.r*cv),mul(s.a,s.r*sv))),du:mul(add(mul(s.x,-sn),mul(y,c)),s.r*cv),dv:add(mul(r,-s.r*sv),mul(s.a,s.r*cv))};}
    case 'torus':{const y=cross(s.a,s.x),c=Math.cos(u),sn=Math.sin(u),r=add(mul(s.x,c),mul(y,sn)),cv=Math.cos(v),sv=Math.sin(v),rho=s.R+s.r*cv;
      return {p:add(s.c,add(mul(r,rho),mul(s.a,s.r*sv))),du:mul(add(mul(s.x,-sn),mul(y,c)),rho),dv:add(mul(r,-s.r*sv),mul(s.a,s.r*cv))};}
    case 'bspline':return bsplineSurface(s,u,v);
    case 'swept':{const e=s.curve.type==='bspline'?bsplineCurve(s.curve,u):{p:curvePoint(s.curve,u),d:curveTangent(s.curve,u)};
      return {p:add(e.p,mul(s.d,v)),du:e.d,dv:s.d};}
    case 'spun':{const q=sub(curvePoint(s.curve,v),s.c),dq=curveTangent(s.curve,v),p=add(s.c,rotate(q,s.a,u));
      return {p,du:cross(s.a,sub(p,s.c)),dv:rotate(dq,s.a,u)};}
    case 'offset':{const e=surfaceEval(s.basis,u,v),n=unit(cross(e.du,e.dv)),h=1e-6;
      const pu=k=>{const f=surfaceEval(s.basis,u+k,v);return add(f.p,mul(unit(cross(f.du,f.dv)),s.d));};
      const pv=k=>{const f=surfaceEval(s.basis,u,v+k);return add(f.p,mul(unit(cross(f.du,f.dv)),s.d));};
      return {p:add(e.p,mul(n,s.d)),du:mul(sub(pu(h),pu(-h)),1/(2*h)),dv:mul(sub(pv(h),pv(-h)),1/(2*h))};}
  }
  throw Error('surfaceEval: '+s.type);
}
/* Rodrigues rotation of q about unit axis a by angle t. */
function rotate(q,a,t){const c=Math.cos(t),s=Math.sin(t);return add(add(mul(q,c),mul(cross(a,q),s)),mul(a,dot(a,q)*(1-c)));}
function surfaceNormal(s,u,v){const e=surfaceEval(s,u,v);return unit(cross(e.du,e.dv));}
/* Parameters of the point on s nearest p. Closed form on the analytic surfaces (u in (-π, π]);
 * otherwise sampling followed by Gauss-Newton. `near` optionally seeds the search. */
function surfaceInverse(s,p,near){
  switch(s.type){
    case 'plane':{const q=sub(p,s.p);return {u:dot(q,s.x),v:dot(q,cross(s.n,s.x))};}
    case 'cylinder':{const q=sub(p,s.p),y=cross(s.a,s.x);return {u:Math.atan2(dot(q,y),dot(q,s.x)),v:dot(q,s.a)};}
    case 'cone':{const q=sub(p,s.p),y=cross(s.a,s.x),u=Math.atan2(dot(q,y),dot(q,s.x)),r=add(mul(s.x,Math.cos(u)),mul(y,Math.sin(u)));
      const g=add(mul(r,Math.sin(s.angle)),mul(s.a,Math.cos(s.angle)));   // generator direction
      return {u,v:dot(sub(q,mul(r,s.r)),g)};}
    case 'sphere':{const q=sub(p,s.c),y=cross(s.a,s.x),h=dot(q,s.a),rho=Math.hypot(dot(q,s.x),dot(q,y));return {u:Math.atan2(dot(q,y),dot(q,s.x)),v:Math.atan2(h,rho)};}
    case 'torus':{const q=sub(p,s.c),y=cross(s.a,s.x),u=Math.atan2(dot(q,y),dot(q,s.x)),r=add(mul(s.x,Math.cos(u)),mul(y,Math.sin(u))),w=sub(q,mul(r,s.R));
      return {u,v:Math.atan2(dot(w,s.a),dot(w,r))};}
    case 'bspline':{if(near){const r=bsplineNewton(s,p,near.u,near.v);if(r)return r;}const r=bsplineProject(s,p);return {u:r.u,v:r.v};}
  }
  return genericInverse(s,p,near);
}
function surfaceRange(s){
  if(s.type==='bspline')return [[s.ku[s.du],s.ku[s.ctrl.length]],[s.kv[s.dv],s.kv[s.ctrl[0].length]]];
  if(s.type==='swept')return [curveRange(s.curve),[-Infinity,Infinity]];
  if(s.type==='spun')return [[-Math.PI,Math.PI],curveRange(s.curve)];
  if(s.type==='offset')return surfaceRange(s.basis);
  return null;
}
function genericInverse(s,p,near){
  let u,v;
  if(near){u=near.u;v=near.v;}
  else if(s.type==='swept'){ // the section curve in the plane normal to d
    const flat=q=>sub(q,mul(s.d,dot(q,s.d)));const [a,b]=curveRange(s.curve),N=256;let best=Infinity;
    for(let i=0;i<=N;i++){const t=a+(b-a)*i/N,c=curvePoint(s.curve,t),d=norm(flat(sub(p,c)));if(d<best){best=d;u=t;v=dot(sub(p,c),s.d);}}
  }else if(s.type==='spun'){const q=sub(p,s.c);let best=Infinity;const [a,b]=curveRange(s.curve),N=256;
    const along=dot(q,s.a),rho=norm(sub(q,mul(s.a,along)));
    for(let i=0;i<=N;i++){const t=a+(b-a)*i/N,c=sub(curvePoint(s.curve,t),s.c),ca=dot(c,s.a),cr=norm(sub(c,mul(s.a,ca))),d=Math.hypot(ca-along,cr-rho);if(d<best){best=d;v=t;}}
    const c0=sub(curvePoint(s.curve,v),s.c),r0=unit(sub(c0,mul(s.a,dot(c0,s.a)))),r1=unit(sub(q,mul(s.a,along)));u=Math.atan2(dot(cross(r0,r1),s.a),dot(r0,r1));
  }else if(s.type==='offset'){const r=surfaceInverse(s.basis,p);u=r.u;v=r.v;}
  else throw Error('surfaceInverse: '+s.type);
  const R=surfaceRange(s);
  for(let it=0;it<60;it++){
    const e=surfaceEval(s,u,v),r=sub(p,e.p),a=dot(e.du,e.du),b=dot(e.du,e.dv),c=dot(e.dv,e.dv),det=a*c-b*b;if(!det)break;
    const x=dot(r,e.du),y=dot(r,e.dv);let nu=u+(c*x-b*y)/det,nv=v+(a*y-b*x)/det;
    if(R){nu=Math.min(R[0][1],Math.max(R[0][0],nu));nv=Math.min(R[1][1],Math.max(R[1][0],nv));}
    if(Math.abs(nu-u)<1e-15*(1+Math.abs(u))&&Math.abs(nv-v)<1e-15*(1+Math.abs(v))){u=nu;v=nv;break;}u=nu;v=nv;
  }
  return {u,v};
}

/* Signed distance along the natural normal (exact for the analytic types), and that normal. */
function surfaceDistance(s,p){
  switch(s.type){
    case 'plane':return {d:dot(sub(p,s.p),s.n),n:s.n};
    case 'cylinder':{const q=sub(p,s.p),h=dot(q,s.a),r=sub(q,mul(s.a,h)),rho=norm(r);return {d:rho-s.r,n:rho>0?mul(r,1/rho):null};}
    case 'cone':{const q=sub(p,s.p),h=dot(q,s.a),r=sub(q,mul(s.a,h)),rho=norm(r),t=Math.tan(s.angle);
      const n=rho>0?unit(sub(mul(r,1/rho),mul(s.a,t))):null;return {d:(rho-(s.r+h*t))*Math.cos(s.angle),n};}
    case 'sphere':{const q=sub(p,s.c),m=norm(q);return {d:m-s.r,n:m>0?mul(q,1/m):null};}
    case 'torus':{const q=sub(p,s.c),h=dot(q,s.a),r=sub(q,mul(s.a,h)),rho=norm(r);
      const k=rho>0?sub(q,mul(r,s.R/rho)):null;if(!k)return {d:Math.hypot(s.R,h)-s.r,n:null};const m=norm(k);return {d:m-s.r,n:m>0?mul(k,1/m):null};}
    case 'bspline':{const r=bsplineProject(s,p);return {d:r.signed,n:r.n,u:r.u,v:r.v};}
    case 'swept':case 'spun':case 'offset':{const r=surfaceInverse(s,p),e=surfaceEval(s,r.u,r.v),n=unit(cross(e.du,e.dv)),q=sub(p,e.p),d=norm(q);
      return {d:d===0?0:Math.sign(dot(q,n))*d,n,u:r.u,v:r.v};}
  }
  throw Error('surfaceDistance: '+s.type);
}
function bsplineProject(s,p){
  const nu=s.ctrl.length,nv=s.ctrl[0].length;
  const [u0,u1]=[s.ku[s.du],s.ku[nu]],[v0,v1]=[s.kv[s.dv],s.kv[nv]];
  const G=Math.max(24,nu*4),H=Math.max(24,nv*4);let best={u:u0,v:v0,d:Infinity};
  for(let i=0;i<=G;i++)for(let j=0;j<=H;j++){const u=u0+(u1-u0)*i/G,v=v0+(v1-v0)*j/H,d=dist(p,bsplineSurface(s,u,v).p);if(d<best.d)best={u,v,d};}
  let {u,v}=best;
  for(let it=0;it<60;it++){ // Gauss–Newton on the tangent plane
    const e=bsplineSurface(s,u,v),r=sub(p,e.p),a=dot(e.du,e.du),b=dot(e.du,e.dv),c=dot(e.dv,e.dv),det=a*c-b*b;if(!det)break;
    const x=dot(r,e.du),y=dot(r,e.dv),du=(c*x-b*y)/det,dv=(a*y-b*x)/det;
    const nu2=Math.min(u1,Math.max(u0,u+du)),nv2=Math.min(v1,Math.max(v0,v+dv));
    if(Math.abs(nu2-u)<1e-16&&Math.abs(nv2-v)<1e-16){u=nu2;v=nv2;break;}u=nu2;v=nv2;}
  const e=bsplineSurface(s,u,v),n=unit(cross(e.du,e.dv)),r=sub(p,e.p),d=norm(r);
  return {u,v,d,signed:d===0?0:Math.sign(dot(r,n))*d,n};
}
/* Gauss-Newton from (u, v); null when it does not settle. */
function bsplineNewton(s,p,u,v){
  const nu=s.ctrl.length,nv=s.ctrl[0].length,u0=s.ku[s.du],u1=s.ku[nu],v0=s.kv[s.dv],v1=s.kv[nv];
  for(let it=0;it<30;it++){
    const e=bsplineSurface(s,u,v),r=sub(p,e.p),a=dot(e.du,e.du),b=dot(e.du,e.dv),c=dot(e.dv,e.dv),det=a*c-b*b;if(!det)return null;
    const x=dot(r,e.du),y=dot(r,e.dv),nu2=Math.min(u1,Math.max(u0,u+(c*x-b*y)/det)),nv2=Math.min(v1,Math.max(v0,v+(a*y-b*x)/det));
    if(Math.abs(nu2-u)<1e-15*(1+Math.abs(u))&&Math.abs(nv2-v)<1e-15*(1+Math.abs(v)))return {u:nu2,v:nv2};
    u=nu2;v=nv2;
  }
  return {u,v};
}
/* Closest point on the surface and the natural normal there. */
function surfaceFoot(s,p,near){
  const r=surfaceInverse(s,p,near),e=surfaceEval(s,r.u,r.v);
  return {q:e.p,n:unit(cross(e.du,e.dv)),u:r.u,v:r.v};
}

return {add,sub,mul,dot,cross,norm,unit,dist,TAU,frame,span,basis,basisFuns,bsplineCurve,bsplineSurface,curvePoint,curveTangent,curveRange,curveProject,periodic,
  surfaceEval,surfaceNormal,surfaceInverse,surfaceRange,surfaceDistance,surfaceFoot,bsplineProject,rotate};
});

'use strict';
/* Geometry evaluation shared by the B-rep readers, the comparison and the STEP writer.
 *
 * Neutral forms (all lengths in metres, directions unit length):
 *   curves   {type:'line', p, d}
 *            {type:'circle', c, n, x, r}            point(t) = c + r(cos t x + sin t y),  y = n × x
 *            {type:'ellipse', c, n, x, r1, r2}       r1 along x
 *            {type:'bspline', degree, ctrl, weights|null, knots, closed}
 *            {type:'trimmed', basis, t0, t1}        a parameter range of `basis`
 *   surfaces {type:'plane', p, n, x}
 *            {type:'cylinder', p, a, x, r}
 *            {type:'cone', p, a, x, r, angle}         radius r at p, growing along +a by tan(angle)
 *            {type:'sphere', c, a, x, r}
 *            {type:'torus', c, a, x, R, r}
 *            {type:'bspline', du, dv, ctrl[u][v], weights[u][v]|null, ku, kv}
 * The surface's natural normal is the one STEP uses: plane n, outward on cylinder, cone, sphere
 * and torus, ∂u × ∂v on B-splines.
 */
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
  }
}
/* Parameter of the point on curve c closest to p, and the distance. For periodic curves the
 * parameter is in [0, 2π). Bounded curves are searched over their own range. */
function curveProject(c,p){
  if(c.type==='trimmed'){const r=curveProject(c.basis,p);return r;}
  if(c.type==='line'){const t=dot(sub(p,c.p),c.d);return {t,d:dist(p,curvePoint(c,t))};}
  if(c.type==='circle'){const {x,y}=frame(c.n,c.x),q=sub(p,c.c);let t=Math.atan2(dot(q,y),dot(q,x));if(t<0)t+=TAU;return {t,d:dist(p,curvePoint(c,t))};}
  // ellipse and B-spline: dense sampling, then Newton on (C(t)-p)·C'(t) = 0
  const [a,b]=curveRange(c),N=c.type==='bspline'?Math.max(64,c.ctrl.length*16):256;
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

/* ---------------- surfaces ---------------- */
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

module.exports={add,sub,mul,dot,cross,norm,unit,dist,TAU,frame,span,basis,basisFuns,bsplineCurve,bsplineSurface,curvePoint,curveTangent,curveRange,curveProject,periodic,surfaceDistance,bsplineProject};

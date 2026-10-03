'use strict';
/* ISO 10303-21 (STEP) reader for AP203/AP214 boundary representations.
 *
 *   parse(text)        -> Map<id, {type, args} | {complex:[{type,args}…]}>   every DATA entity
 *   readBrep(text)     -> neutral B-rep model (see src/brep/model.js), lengths in metres
 *
 * Covers what SolidWorks writes for parts: MANIFOLD_SOLID_BREP / CLOSED_SHELL / ADVANCED_FACE,
 * FACE_(OUTER_)BOUND, EDGE_LOOP, VERTEX_LOOP, ORIENTED_EDGE, EDGE_CURVE, VERTEX_POINT; PLANE, CYLINDRICAL_,
 * CONICAL_, SPHERICAL_, TOROIDAL_SURFACE, B_SPLINE_SURFACE_WITH_KNOTS (plain and rational);
 * LINE, CIRCLE, ELLIPSE, B_SPLINE_CURVE_WITH_KNOTS (plain and rational), SURFACE_CURVE /
 * SEAM_CURVE (their 3D curve). Anything else stops with an error naming the entity.
 */

/* ---------- Part 21 tokenizer and value parser ---------- */
function parse(text){
  const start=text.indexOf('DATA;');if(start<0)throw Error('STEP: no DATA section');
  const end=text.indexOf('ENDSEC;',start);
  const s=text.slice(start+5,end<0?text.length:end);
  const out=new Map();let i=0;const n=s.length;
  const ws=()=>{for(;;){while(i<n&&/\s/.test(s[i]))i++;if(s[i]==='/'&&s[i+1]==='*'){const e=s.indexOf('*/',i+2);i=e<0?n:e+2;continue;}break;}};
  function value(){
    ws();const c=s[i];
    if(c==='('){i++;const list=[];ws();if(s[i]===')'){i++;return list;}for(;;){list.push(value());ws();if(s[i]===','){i++;continue;}if(s[i]===')'){i++;return list;}throw Error('STEP: bad list at '+i);}}
    if(c==="'"){let out='';i++;for(;;){if(i>=n)throw Error('STEP: open string');if(s[i]==="'"){if(s[i+1]==="'"){out+="'";i+=2;continue;}i++;return {str:out};}out+=s[i++];}}
    if(c==='#'){i++;const m=/^\d+/.exec(s.slice(i,i+20));i+=m[0].length;return {ref:+m[0]};}
    if(c==='.'){const e=s.indexOf('.',i+1);const v=s.slice(i+1,e);i=e+1;return {enum:v};}
    if(c==='$'){i++;return null;}
    if(c==='*'){i++;return {derived:true};}
    const num=/^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(s.slice(i,i+64));
    if(num){i+=num[0].length;return Number(num[0]);}
    const kw=/^[A-Z_][A-Z0-9_]*/.exec(s.slice(i,i+128));
    if(kw){i+=kw[0].length;ws();if(s[i]==='('){const args=value();return {type:kw[0],args};}return {keyword:kw[0]};}
    throw Error('STEP: unexpected "'+s.slice(i,i+20)+'"');
  }
  for(;;){
    ws();if(i>=n)break;
    if(s[i]!=='#')throw Error('STEP: expected entity at '+i);
    i++;const m=/^\d+/.exec(s.slice(i,i+20));const id=+m[0];i+=m[0].length;ws();
    if(s[i]!=='=')throw Error('STEP: expected = after #'+id);i++;ws();
    let ent;
    if(s[i]==='('){i++;const parts=[];for(;;){ws();if(s[i]===')'){i++;break;}const v=value();if(!v||!v.type)throw Error('STEP: bad complex entity #'+id);parts.push(v);}ent={complex:parts};}
    else{const v=value();if(!v||!v.type)throw Error('STEP: bad entity #'+id);ent=v;}
    ws();if(s[i]!==';')throw Error('STEP: expected ; after #'+id);i++;
    out.set(id,ent);
  }
  return out;
}

/* ---------- B-rep extraction ---------- */
function readBrep(text){
  const E=parse(text);
  const get=r=>{if(!r||r.ref===undefined)throw Error('STEP: expected a reference');const e=E.get(r.ref);if(!e)throw Error('STEP: dangling #'+r.ref);return e;};
  const part=(e,type)=>e.complex?e.complex.find(p=>p.type===type):(e.type===type?e:null);
  const typeOf=e=>e.complex?e.complex.map(p=>p.type).join('+'):e.type;

  // length unit -> metres
  let unit=null;
  for(const e of E.values())if(e.complex&&part(e,'LENGTH_UNIT')){const si=part(e,'SI_UNIT');if(si){const pre=si.args[0]&&si.args[0].enum,name=si.args[1].enum;
    if(name!=='METRE')throw Error('STEP: length unit '+name);unit={null:1,MILLI:1e-3,CENTI:1e-2,MICRO:1e-6,KILO:1e3}[pre||'null'];}
    const conv=part(e,'CONVERSION_BASED_UNIT');if(conv&&!si)throw Error('STEP: conversion-based length unit not supported');}
  if(unit===null)throw Error('STEP: no length unit');
  const L=x=>x*unit;
  const pt=r=>{const e=get(r);if(e.type!=='CARTESIAN_POINT')throw Error('STEP: expected point, got '+typeOf(e));return e.args[1].map(L);};
  const dir=r=>{const e=get(r);if(e.type!=='DIRECTION')throw Error('STEP: expected direction');const v=e.args[1],m=Math.hypot(...v);return v.map(x=>x/m);};
  function placement(r){
    const e=get(r);if(e.type!=='AXIS2_PLACEMENT_3D')throw Error('STEP: expected AXIS2_PLACEMENT_3D');
    const c=pt(e.args[1]),z=e.args[2]?dir(e.args[2]):[0,0,1];
    let x=e.args[3]?dir(e.args[3]):(Math.abs(z[0])<0.9?[1,0,0]:[0,1,0]);
    const d=x[0]*z[0]+x[1]*z[1]+x[2]*z[2];x=x.map((v,k)=>v-d*z[k]);const m=Math.hypot(...x);x=x.map(v=>v/m);
    return {c,z,x};
  }
  function knotVector(mults,knots){const k=[];mults.forEach((m,i)=>{for(let j=0;j<m;j++)k.push(knots[i]);});return k;}
  function curve(r){
    const e=get(r),t=typeOf(e);
    if(e.type==='LINE'){const v=get(e.args[2]);return {type:'line',p:pt(e.args[1]),d:dir(v.args[1])};}
    if(e.type==='CIRCLE'){const a=placement(e.args[1]);return {type:'circle',c:a.c,n:a.z,x:a.x,r:L(e.args[2])};}
    if(e.type==='ELLIPSE'){const a=placement(e.args[1]);return {type:'ellipse',c:a.c,n:a.z,x:a.x,r1:L(e.args[2]),r2:L(e.args[3])};}
    if(e.type==='SURFACE_CURVE'||e.type==='SEAM_CURVE')return {...curve(e.args[1]),seam:e.type==='SEAM_CURVE'};
    const b=part(e,'B_SPLINE_CURVE'),k=part(e,'B_SPLINE_CURVE_WITH_KNOTS');
    if(e.type==='B_SPLINE_CURVE_WITH_KNOTS'||(b&&k)){
      const a=e.type?e.args:null;
      const degree=a?a[1]:b.args[0],ctrl=(a?a[2]:b.args[1]).map(pt),closed=(a?a[4]:b.args[3]).enum==='T';
      const mults=a?a[6]:k.args[0],knots=a?a[7]:k.args[1];
      const rat=part(e,'RATIONAL_B_SPLINE_CURVE');
      return {type:'bspline',degree,ctrl,weights:rat?rat.args[0]:null,knots:knotVector(mults,knots),closed};
    }
    throw Error('STEP: unsupported curve '+t);
  }
  function surface(r){
    const e=get(r),t=typeOf(e);
    if(e.type==='PLANE'){const a=placement(e.args[1]);return {type:'plane',p:a.c,n:a.z,x:a.x};}
    if(e.type==='CYLINDRICAL_SURFACE'){const a=placement(e.args[1]);return {type:'cylinder',p:a.c,a:a.z,x:a.x,r:L(e.args[2])};}
    if(e.type==='CONICAL_SURFACE'){const a=placement(e.args[1]);return {type:'cone',p:a.c,a:a.z,x:a.x,r:L(e.args[2]),angle:e.args[3]};}
    if(e.type==='SPHERICAL_SURFACE'){const a=placement(e.args[1]);return {type:'sphere',c:a.c,a:a.z,x:a.x,r:L(e.args[2])};}
    if(e.type==='TOROIDAL_SURFACE'){const a=placement(e.args[1]);return {type:'torus',c:a.c,a:a.z,x:a.x,R:L(e.args[2]),r:L(e.args[3])};}
    const b=part(e,'B_SPLINE_SURFACE'),k=part(e,'B_SPLINE_SURFACE_WITH_KNOTS');
    if(e.type==='B_SPLINE_SURFACE_WITH_KNOTS'||(b&&k)){
      const a=e.type?e.args:null;
      const du=a?a[1]:b.args[0],dv=a?a[2]:b.args[1],grid=(a?a[3]:b.args[2]).map(row=>row.map(pt));
      const uClosed=(a?a[5]:b.args[4]).enum==='T',vClosed=(a?a[6]:b.args[5]).enum==='T';
      const ka=a?a.slice(8,12):k.args.slice(0,4);
      const rat=part(e,'RATIONAL_B_SPLINE_SURFACE');
      return {type:'bspline',du,dv,ctrl:grid,weights:rat?rat.args[0]:null,ku:knotVector(ka[0],ka[2]),kv:knotVector(ka[1],ka[3]),uClosed,vClosed};
    }
    throw Error('STEP: unsupported surface '+t);
  }

  const vertices=new Map(),edges=new Map(),faces=[];
  const vertex=r=>{if(!vertices.has(r.ref)){const e=get(r);if(e.type!=='VERTEX_POINT')throw Error('STEP: expected VERTEX_POINT');vertices.set(r.ref,{id:r.ref,p:pt(e.args[1])});}return r.ref;};
  const edge=r=>{if(!edges.has(r.ref)){const e=get(r);if(e.type!=='EDGE_CURVE')throw Error('STEP: expected EDGE_CURVE, got '+typeOf(e));
    const v0=vertex(e.args[1]),v1=vertex(e.args[2]);edges.set(r.ref,{id:r.ref,v:[v0,v1],curve:curve(e.args[3]),sameSense:e.args[4].enum==='T'});}return r.ref;};

  const bodies=[...E.entries()].filter(([,e])=>e.type==='MANIFOLD_SOLID_BREP');
  if(bodies.length!==1)throw Error('STEP: expected one MANIFOLD_SOLID_BREP, found '+bodies.length);
  const shell=get(bodies[0][1].args[1]);if(shell.type!=='CLOSED_SHELL')throw Error('STEP: expected CLOSED_SHELL');
  for(const fr of shell.args[1]){
    const f=get(fr);if(f.type!=='ADVANCED_FACE'&&f.type!=='FACE_SURFACE')throw Error('STEP: unsupported face '+typeOf(f));
    const loops=[];
    for(const br of f.args[1]){
      const b=get(br),loop=get(b.args[1]);
      if(loop.type==='VERTEX_LOOP'){loops.push({outer:b.type==='FACE_OUTER_BOUND',coedges:[],vertex:vertex(loop.args[1])});continue;}
      if(loop.type!=='EDGE_LOOP')throw Error('STEP: unsupported loop '+typeOf(loop));
      const flip=b.args[2].enum==='F';
      const co=loop.args[1].map(or=>{const o=get(or);if(o.type!=='ORIENTED_EDGE')throw Error('STEP: expected ORIENTED_EDGE');
        return {edge:edge(o.args[3]),sense:o.args[4].enum==='T'};});
      loops.push({outer:b.type==='FACE_OUTER_BOUND',coedges:flip?co.reverse().map(c=>({edge:c.edge,sense:!c.sense})):co});
    }
    faces.push({id:fr.ref,surface:surface(f.args[2]),sameSense:f.args[3].enum==='T',loops});
  }
  return {source:'step',unit:'m',vertices,edges,faces};
}

module.exports={parse,readBrep};

'use strict';
/* Exact STEP (ISO 10303-21, AP214) from a neutral B-rep model (src/brep/native.js).
 *
 *   write(model, {name, scale = 1000 (mm) | 1 (m), timestamp}) -> {text, report}
 *
 * Surfaces and curves are written as what they are: planes, cylinders, cones, spheres, tori and
 * (rational) B-spline surfaces; lines, circles, ellipses and (rational) B-spline curves. Nothing
 * is faceted. Numbers use the shortest decimal that reads back to the same double.
 * Ring edges and boundary-less faces are made STEP-legal first by src/brep/seams.js.
 */
const G=require('../geom/eval');
const {addSeams}=require('../brep/seams');

function fmt(x){
  if(!Number.isFinite(x))throw Error('STEP: non-finite number');
  if(Object.is(x,-0)||x===0)return '0.';
  let s=String(x);
  if(/e/.test(s)){const [m,e]=s.split('e');s=(m.includes('.')?m:m+'.')+'E'+e.replace('+','');}
  else if(!s.includes('.'))s+='.';
  return s;
}
const str=s=>String(s).replace(/'/g,"''");   // STEP doubles an apostrophe inside a string

class Writer{
  constructor(scale){this.scale=scale;this.lines=[];this.id=0;this.cache=new Map();}
  emit(body,key){if(key!==undefined&&this.cache.has(key))return this.cache.get(key);const i=++this.id;this.lines.push(`#${i}=${body};`);if(key!==undefined)this.cache.set(key,i);return i;}
  len(x){return fmt(x*this.scale);}
  point(p){const s=`(${p.map(x=>this.len(x)).join(',')})`;return this.emit(`CARTESIAN_POINT('',${s})`,'P'+s);}
  dir(d){const u=G.unit(d),s=`(${u.map(fmt).join(',')})`;return this.emit(`DIRECTION('',${s})`,'D'+s);}
  axis(c,z,x){return this.emit(`AXIS2_PLACEMENT_3D('',#${this.point(c)},#${this.dir(z)},#${this.dir(x)})`);}
}

/* x made exactly perpendicular to z, as AXIS2_PLACEMENT_3D requires */
function ortho(z,x){const u=G.unit(z);let v=G.sub(x,G.mul(u,G.dot(x,u)));if(G.norm(v)<1e-12)v=Math.abs(u[0])<0.9?[1,0,0]:[0,1,0];return G.unit(G.sub(v,G.mul(u,G.dot(v,u))));}
function mults(knots){const k=[],m=[];for(const x of knots){if(k.length&&x===k[k.length-1])m[m.length-1]++;else{k.push(x);m.push(1);}}return {k,m};}

function curve(w,c){
  if(c.type==='trimmed')return curve(w,c.basis);   // the edge's vertices do the trimming
  switch(c.type){
    case 'line':return w.emit(`LINE('',#${w.point(c.p)},#${w.emit(`VECTOR('',#${w.dir(c.d)},1.)`)})`);
    case 'circle':return w.emit(`CIRCLE('',#${w.axis(c.c,c.n,ortho(c.n,c.x))},${w.len(c.r)})`);
    case 'ellipse':return w.emit(`ELLIPSE('',#${w.axis(c.c,c.n,ortho(c.n,c.x))},${w.len(c.r1)},${w.len(c.r2)})`);
    case 'bspline':{
      const {k,m}=mults(c.knots),pts=`(${c.ctrl.map(p=>'#'+w.point(p)).join(',')})`,cl=c.closed?'.T.':'.F.';
      if(!c.weights)return w.emit(`B_SPLINE_CURVE_WITH_KNOTS('',${c.degree},${pts},.UNSPECIFIED.,${cl},.F.,(${m.join(',')}),(${k.map(fmt).join(',')}),.UNSPECIFIED.)`);
      return w.emit(`(BOUNDED_CURVE() B_SPLINE_CURVE(${c.degree},${pts},.UNSPECIFIED.,${cl},.F.) B_SPLINE_CURVE_WITH_KNOTS((${m.join(',')}),(${k.map(fmt).join(',')}),.UNSPECIFIED.) CURVE() GEOMETRIC_REPRESENTATION_ITEM() RATIONAL_B_SPLINE_CURVE((${c.weights.map(fmt).join(',')})) REPRESENTATION_ITEM(''))`);
    }
  }
  throw Error('STEP writer: unsupported curve '+c.type);
}
function surface(w,s){
  switch(s.type){
    case 'plane':return w.emit(`PLANE('',#${w.axis(s.p,s.n,ortho(s.n,s.x))})`);
    case 'cylinder':return w.emit(`CYLINDRICAL_SURFACE('',#${w.axis(s.p,s.a,ortho(s.a,s.x))},${w.len(s.r)})`);
    case 'cone':{let a=s.a,ang=s.angle;if(ang<0){a=G.mul(a,-1);ang=-ang;}   // STEP wants 0 < semi-angle
      return w.emit(`CONICAL_SURFACE('',#${w.axis(s.p,a,ortho(a,s.x))},${w.len(s.r)},${fmt(ang)})`);}
    case 'sphere':return w.emit(`SPHERICAL_SURFACE('',#${w.axis(s.c,s.a,ortho(s.a,s.x))},${w.len(s.r)})`);
    case 'torus':return w.emit(`TOROIDAL_SURFACE('',#${w.axis(s.c,s.a,ortho(s.a,s.x))},${w.len(s.R)},${w.len(s.r)})`);
    case 'bspline':{
      const U=mults(s.ku),V=mults(s.kv),grid=`(${s.ctrl.map(row=>`(${row.map(p=>'#'+w.point(p)).join(',')})`).join(',')})`;
      const tail=`(${U.m.join(',')}),(${V.m.join(',')}),(${U.k.map(fmt).join(',')}),(${V.k.map(fmt).join(',')}),.UNSPECIFIED.`;
      if(!s.weights)return w.emit(`B_SPLINE_SURFACE_WITH_KNOTS('',${s.du},${s.dv},${grid},.UNSPECIFIED.,.F.,.F.,.F.,${tail})`);
      return w.emit(`(BOUNDED_SURFACE() B_SPLINE_SURFACE(${s.du},${s.dv},${grid},.UNSPECIFIED.,.F.,.F.,.F.) B_SPLINE_SURFACE_WITH_KNOTS(${tail}) GEOMETRIC_REPRESENTATION_ITEM() RATIONAL_B_SPLINE_SURFACE((${s.weights.map(r=>`(${r.map(fmt).join(',')})`).join(',')})) REPRESENTATION_ITEM('') SURFACE())`);
    }
  }
  throw Error('STEP writer: unsupported surface '+s.type);
}

/* signed area of a loop's vertices about n: positive = counter-clockwise = outer bound */
function loopArea(model,loop,n){
  if(!loop.coedges.length)return null;
  let acc=[0,0,0];const pts=[];
  for(const c of loop.coedges){const e=model.edges.get(c.edge);if(!e.v)return null;pts.push(model.vertices.get(c.sense?e.v[0]:e.v[1]).p);}
  for(let i=0;i<pts.length;i++)acc=G.add(acc,G.cross(pts[i],pts[(i+1)%pts.length]));
  return G.dot(acc,n)/2;
}

function write(model,opts={}){
  // lengths are metres internally; the file says millimetres unless the scale is exactly 1
  const scale=opts.scale===undefined?(opts.unit==='m'?1:1000):opts.scale,unit=scale===1?'m':'mm',name=str(opts.name||'part');
  const m=addSeams(model);
  const w=new Writer(scale),report={source:'brep',faces:0,edges:0,vertices:0,surfaces:{},curves:{},seams:m.seams,ringVertices:m.ringVertices,splitFaces:m.splitFaces};
  const V=new Map(),E=new Map();
  for(const v of m.vertices.values()){V.set(v.id,w.emit(`VERTEX_POINT('',#${w.point(v.p)})`));report.vertices++;}
  for(const e of m.edges.values()){
    const t=e.curve.type==='trimmed'?e.curve.basis.type:e.curve.type;report.curves[t]=(report.curves[t]||0)+1;
    E.set(e.id,w.emit(`EDGE_CURVE('',#${V.get(e.v[0])},#${V.get(e.v[1])},#${curve(w,e.curve)},${e.sameSense?'.T.':'.F.'})`));report.edges++;
  }
  const faces=[];
  for(const f of m.faces){
    report.surfaces[f.surface.type]=(report.surfaces[f.surface.type]||0)+1;
    const n=f.surface.type==='plane'?G.mul(f.surface.n,f.sameSense?1:-1):null;
    const bounds=f.loops.map(l=>{
      if(!l.coedges.length)return w.emit(`FACE_BOUND('',#${w.emit(`VERTEX_LOOP('',#${V.get(l.vertex)})`)},.T.)`);
      const oe=l.coedges.map(c=>`#${w.emit(`ORIENTED_EDGE('',*,*,#${E.get(c.edge)},${c.sense?'.T.':'.F.'})`)}`);
      const loop=w.emit(`EDGE_LOOP('',(${oe.join(',')}))`);
      const outer=f.loops.length===1||(n&&loopArea(m,l,n)>0);
      return w.emit(`${outer?'FACE_OUTER_BOUND':'FACE_BOUND'}('',#${loop},.T.)`);
    });
    if(!bounds.length)throw Error('STEP writer: face '+f.id+' has no boundary');
    faces.push(w.emit(`ADVANCED_FACE('',(${bounds.map(b=>'#'+b).join(',')}),#${surface(w,f.surface)},${f.sameSense?'.T.':'.F.'})`));report.faces++;
  }
  const shell=w.emit(`CLOSED_SHELL('',(${faces.map(x=>'#'+x).join(',')}))`);
  const body=w.emit(`MANIFOLD_SOLID_BREP('${name}',#${shell})`);
  return {text:assemble(w,body,name,unit,opts),report};
}

function assemble(w,body,name,unit,opts){
  const ctxApp=w.emit("APPLICATION_CONTEXT('automotive design')");
  w.emit(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${ctxApp})`);
  const pctx=w.emit(`PRODUCT_CONTEXT('',#${ctxApp},'mechanical')`);
  const prod=w.emit(`PRODUCT('${name}','${name}','',(#${pctx}))`);
  const pdf=w.emit(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
  const pdctx=w.emit(`PRODUCT_DEFINITION_CONTEXT('part definition',#${ctxApp},'design')`);
  const pd=w.emit(`PRODUCT_DEFINITION('design','',#${pdf},#${pdctx})`);
  const pds=w.emit(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  const lenU=w.emit(unit==='mm'?'(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))':'(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT($,.METRE.))');
  const angU=w.emit('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const solU=w.emit('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc=w.emit(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(${fmt(1e-8*w.scale)}),#${lenU},'distance_accuracy_value','')`);
  const geo=w.emit(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenU},#${angU},#${solU}))REPRESENTATION_CONTEXT('',''))`);
  const ax=w.axis([0,0,0],[0,0,1],[1,0,0]);
  const rep=w.emit(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(#${ax},#${body}),#${geo})`);
  w.emit(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
  const ts=(opts.timestamp||new Date().toISOString()).replace(/\.\d+Z$/,'');
  return ['ISO-10303-21;','HEADER;',
    "FILE_DESCRIPTION(('SLDPRT native B-rep, exact geometry'),'2;1');",
    `FILE_NAME('${name}','${ts}',(''),(''),'sldprt-format-research','sldprt','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",'ENDSEC;','DATA;',...w.lines,'ENDSEC;','END-ISO-10303-21;',''].join('\n');
}

module.exports={write,fmt};

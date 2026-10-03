'use strict';
/**
 * SLDPRT display geometry -> STL / STEP (formerly converter/v0.1, validated in EXP-053).
 *
 * Consumes the output of src/display.js. Exports two formats:
 *
 *   STL   Exact dump of the display mesh. Every triangle the parser emits, nothing welded,
 *         re-ordered or repaired. This is lossless with respect to the display mesh.
 *
 *   STEP  Boundary representation. Planar faces (tag 4001) are emitted as analytic PLANE
 *         surfaces trimmed by their INV-024 boundary cycles; every other face falls back to
 *         per-triangle facets. The result is a valid AP214 part, but see the scope note in
 *         README.md: a faceted region is an approximation of the original surface, not a
 *         recovery of it.
 *
 * Units: DisplayList coordinates are metres, STL and STEP here are millimetres (x1000).
 */
const SCALE = 1000;               // metres -> millimetres
const KEY = 1e9;                  // coordinate dedup precision (1e-9 m = 1 nm)

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm=a=>{const L=Math.hypot(a[0],a[1],a[2]);return L?[a[0]/L,a[1]/L,a[2]/L]:[0,0,0];};

/** Normalise parser output into a flat model the writers can walk. */
function loadModel(parsed){
 if(!parsed||!parsed.faces||!parsed.faces.length)throw new Error('no faces to convert');
 const faces=parsed.faces.map((f,idx)=>{
  const V=[];
  for(let i=0;i<f.vertexCount;i++)V.push([f.vertices[i*3],f.vertices[i*3+1],f.vertices[i*3+2]]);
  const tris=[];
  for(let t=0;t<f.triangleIndices.length;t+=3)
   tris.push([f.triangleIndices[t],f.triangleIndices[t+1],f.triangleIndices[t+2]]);
  const md=f.metadata||null;
  return {index:idx,vertices:V,triangles:tris,
    cycles:Array.isArray(f.boundaryCycles)?f.boundaryCycles:[],
    tag:md?md.typeTag:null,direction:md?md.direction:null,
    parameters:md?md.parameters:null};
 });
 return {faces,faceCount:faces.length,
   triangleCount:faces.reduce((a,f)=>a+f.triangles.length,0)};
}

/** Per-triangle geometric normal, in model (metre) space. */
function triNormal(a,b,c){return nrm(cross(sub(b,a),sub(c,a)));}

// ---------------------------------------------------------------- STL

function toSTLBinary(model,opts){
 opts=opts||{};const s=opts.scale===undefined?SCALE:opts.scale;
 const tris=[];
 for(const f of model.faces)for(const t of f.triangles){
  const a=f.vertices[t[0]],b=f.vertices[t[1]],c=f.vertices[t[2]];
  if(!a||!b||!c)continue;
  tris.push([a,b,c]);
 }
 const buf=Buffer.alloc(84+50*tris.length);
 buf.write('Converted from SLDPRT display mesh by converter/v0.1','ascii');
 buf.writeUInt32LE(tris.length,80);
 let o=84;
 for(const [a,b,c] of tris){
  const n=triNormal(a,b,c);
  buf.writeFloatLE(n[0],o);buf.writeFloatLE(n[1],o+4);buf.writeFloatLE(n[2],o+8);
  const pts=[a,b,c];
  for(let i=0;i<3;i++){
   buf.writeFloatLE(pts[i][0]*s,o+12+i*12);
   buf.writeFloatLE(pts[i][1]*s,o+16+i*12);
   buf.writeFloatLE(pts[i][2]*s,o+20+i*12);
  }
  buf.writeUInt16LE(0,o+48);
  o+=50;
 }
 return buf;
}

function toSTLAscii(model,opts){
 opts=opts||{};const s=opts.scale===undefined?SCALE:opts.scale;
 const name=opts.name||'sldprt';
 const L=['solid '+name];
 const fx=v=>v.toExponential(6);
 for(const f of model.faces)for(const t of f.triangles){
  const a=f.vertices[t[0]],b=f.vertices[t[1]],c=f.vertices[t[2]];
  if(!a||!b||!c)continue;
  const n=triNormal(a,b,c);
  L.push('  facet normal '+fx(n[0])+' '+fx(n[1])+' '+fx(n[2]));
  L.push('    outer loop');
  for(const p of [a,b,c])L.push('      vertex '+fx(p[0]*s)+' '+fx(p[1]*s)+' '+fx(p[2]*s));
  L.push('    endloop');L.push('  endfacet');
 }
 L.push('endsolid '+name);
 return L.join('\n')+'\n';
}

// ---------------------------------------------------------------- STEP

/** Signed area of a polygon projected onto the plane with normal n. */
function signedArea(pts,n){
 let acc=[0,0,0];
 for(let i=0;i<pts.length;i++){
  const p=pts[i],q=pts[(i+1)%pts.length];
  const c=cross(p,q);acc=[acc[0]+c[0],acc[1]+c[1],acc[2]+c[2]];
 }
 return dot(acc,n)/2;
}

class StepWriter {
 constructor(scale){this.scale=scale;this.lines=[];this.id=0;
  this.points=new Map();this.verts=new Map();this.edges=new Map();this.dirs=new Map();}
 next(){return ++this.id;}
 emit(body){const i=this.next();this.lines.push('#'+i+'='+body+';');return i;}
 num(v){
  const x=v*this.scale;
  if(!isFinite(x))throw new Error('non-finite coordinate');
  if(Object.is(x,-0))return '0.';
  let s=x.toPrecision(15).replace(/0+$/,'');
  if(/e/i.test(x.toPrecision(15))||Math.abs(x)>=1e15)s=x.toExponential(12).replace('e','E');
  if(!/[.E]/.test(s))s+='.';
  if(/\.$/.test(s)===false&&/\./.test(s)===false)s+='.';
  return s;
 }
 // Directions are unitless: emitted verbatim, not scaled.
 rawNum(v){
  if(Object.is(v,-0))v=0;
  let s=String(v);
  if(!/[.eE]/.test(s))s+='.';
  return s;
 }
 key(p){return Math.round(p[0]*KEY)+','+Math.round(p[1]*KEY)+','+Math.round(p[2]*KEY);}
 point(p){
  const k=this.key(p);
  if(this.points.has(k))return this.points.get(k);
  const i=this.emit("CARTESIAN_POINT('',("+this.num(p[0])+','+this.num(p[1])+','+this.num(p[2])+'))');
  this.points.set(k,i);return i;
 }
 dir(d){
  const k=d.map(x=>Math.round(x*1e12)).join(',');
  if(this.dirs.has(k))return this.dirs.get(k);
  const i=this.emit("DIRECTION('',("+this.rawNum(d[0])+','+this.rawNum(d[1])+','+this.rawNum(d[2])+'))');
  this.dirs.set(k,i);return i;
 }
 vertex(p){
  const k=this.key(p);
  if(this.verts.has(k))return this.verts.get(k);
  const i=this.emit("VERTEX_POINT('',#"+this.point(p)+')');
  this.verts.set(k,i);return i;
 }
 /** Undirected edge between two points, shared between the faces that meet there. */
 edge(pa,pb){
  const ka=this.key(pa),kb=this.key(pb);
  const k=ka<kb?ka+'|'+kb:kb+'|'+ka;
  if(this.edges.has(k))return this.edges.get(k);
  const forward=ka<kb;
  const p0=forward?pa:pb,p1=forward?pb:pa;
  const va=this.vertex(p0),vb=this.vertex(p1);
  const d=nrm(sub(p1,p0));
  const vec=this.emit("VECTOR('',#"+this.dir(d)+',1.)');
  const line=this.emit("LINE('',#"+this.point(p0)+',#'+vec+')');
  const ec=this.emit("EDGE_CURVE('',#"+va+',#'+vb+',#'+line+',.T.)');
  const rec={id:ec,forward};
  this.edges.set(k,rec);return rec;
 }
 /** Axis placement: location + axis(Z) + refDirection(X). */
 placement(loc,axis,ref){
  return this.emit("AXIS2_PLACEMENT_3D('',#"+this.point(loc)+',#'+this.dir(axis)+',#'+this.dir(ref)+')');
 }
 /** An oriented loop of points -> EDGE_LOOP. */
 loop(pts){
  const oriented=[];
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length];
   if(this.key(a)===this.key(b))continue;          // skip zero-length segments
   const e=this.edge(a,b);
   // Loop direction agrees with the stored edge only when we traverse it forwards.
   const sameDir=this.key(a)<this.key(b);
   oriented.push(this.emit("ORIENTED_EDGE('',*,*,#"+e.id+','+(sameDir===e.forward?'.T.':'.F.')+')'));
  }
  if(oriented.length<3)return null;
  return this.emit('EDGE_LOOP(\'\',('+oriented.map(i=>'#'+i).join(',')+'))');
 }
}

/** Pick an arbitrary unit vector perpendicular to n. */
function perp(n){
 const a=Math.abs(n[0])<0.9?[1,0,0]:[0,1,0];
 return nrm(cross(a,n));
}

function toSTEP(model,opts){
 opts=opts||{};
 const scale=opts.scale===undefined?SCALE:opts.scale;
 const name=opts.name||'sldprt';
 const mode=opts.mode||'auto';          // 'auto' = analytic planes where possible, else facets
 const w=new StepWriter(scale);
 const faceIds=[];
 const report={analyticPlanes:0,facetedFaces:0,facetTriangles:0,skippedLoops:0,byTag:{}};

 for(const f of model.faces){
  const tagKey=f.tag===null?'none':String(f.tag);
  report.byTag[tagKey]=report.byTag[tagKey]||{analytic:0,faceted:0};
  let done=false;
  if(mode!=='faceted'&&f.tag===4001&&f.direction&&f.cycles.length){
   done=emitPlanarFace(w,f,faceIds,report);
   if(done){report.analyticPlanes++;report.byTag[tagKey].analytic++;}
  }
  if(!done){
   emitFacetedFace(w,f,faceIds,report);
   report.facetedFaces++;report.byTag[tagKey].faceted++;
  }
 }
 if(!faceIds.length)throw new Error('no STEP faces produced');

 const closed=opts.closed!==undefined?opts.closed:isClosed(model,w);
 const shell=w.emit((closed?'CLOSED_SHELL':'OPEN_SHELL')+"('',("+faceIds.map(i=>'#'+i).join(',')+'))');
 const body=closed
  ? w.emit("MANIFOLD_SOLID_BREP('"+name+"',#"+shell+')')
  : w.emit("SHELL_BASED_SURFACE_MODEL('"+name+"',(#"+shell+'))');
 report.shell=closed?'CLOSED_SHELL':'OPEN_SHELL';
 report.body=closed?'MANIFOLD_SOLID_BREP':'SHELL_BASED_SURFACE_MODEL';

 return {text:assemble(w,body,name,closed),report};
}

function emitPlanarFace(w,f,faceIds,report){
 const n=nrm(f.direction);
 if(!n[0]&&!n[1]&&!n[2])return false;
 const rings=[];
 for(const c of f.cycles){
  if(!c||!Array.isArray(c.vertices)||c.vertices.length<3)continue;
  const pts=c.vertices.map(i=>f.vertices[i]).filter(Boolean);
  if(pts.length<3)continue;
  rings.push({pts,area:signedArea(pts,n)});
 }
 if(!rings.length)return false;
 rings.sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
 const outer=rings[0],inner=rings.slice(1);
 // Outer ring runs counter-clockwise about the face normal; inner rings run the other way.
 const outerPts=outer.area<0?outer.pts.slice().reverse():outer.pts;
 const ol=w.loop(outerPts);
 if(ol===null){report.skippedLoops++;return false;}
 const bounds=[w.emit("FACE_OUTER_BOUND('',#"+ol+',.T.)')];
 for(const r of inner){
  const pts=r.area>0?r.pts.slice().reverse():r.pts;
  const il=w.loop(pts);
  if(il===null){report.skippedLoops++;continue;}
  bounds.push(w.emit("FACE_BOUND('',#"+il+',.T.)'));
 }
 const plc=w.placement(outerPts[0],n,perp(n));
 const surf=w.emit("PLANE('',#"+plc+')');
 faceIds.push(w.emit("ADVANCED_FACE('',("+bounds.map(i=>'#'+i).join(',')+'),#'+surf+',.T.)'));
 return true;
}

function emitFacetedFace(w,f,faceIds,report){
 for(const t of f.triangles){
  const a=f.vertices[t[0]],b=f.vertices[t[1]],c=f.vertices[t[2]];
  if(!a||!b||!c)continue;
  const n=triNormal(a,b,c);
  if(!n[0]&&!n[1]&&!n[2])continue;           // degenerate triangle
  const l=w.loop([a,b,c]);
  if(l===null){report.skippedLoops++;continue;}
  const fb=w.emit("FACE_OUTER_BOUND('',#"+l+',.T.)');
  const plc=w.placement(a,n,perp(n));
  const surf=w.emit("PLANE('',#"+plc+')');
  faceIds.push(w.emit("ADVANCED_FACE('',(#"+fb+'),#'+surf+',.T.)'));
  report.facetTriangles++;
 }
}

/** A shell is closed when every undirected mesh edge is used an even number of times. */
function isClosed(model,w){
 const use=new Map();
 for(const f of model.faces)for(const t of f.triangles){
  const pts=[f.vertices[t[0]],f.vertices[t[1]],f.vertices[t[2]]];
  if(pts.some(p=>!p))continue;
  for(let i=0;i<3;i++){
   const a=w.key(pts[i]),b=w.key(pts[(i+1)%3]);
   const k=a<b?a+'|'+b:b+'|'+a;
   use.set(k,(use.get(k)||0)+1);
  }
 }
 for(const v of use.values())if(v%2!==0)return false;
 return true;
}

function assemble(w,bodyId,name,closed){
 // Product/context scaffolding is emitted after the geometry so ids stay stable while writing.
 const ctxApp=w.emit("APPLICATION_CONTEXT('automotive design')");
 w.emit("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#"+ctxApp+')');
 const pctx=w.emit("PRODUCT_CONTEXT('',#"+ctxApp+",'mechanical')");
 const prod=w.emit("PRODUCT('"+name+"','"+name+"','',(#"+pctx+'))');
 const pdf=w.emit("PRODUCT_DEFINITION_FORMATION('','',#"+prod+')');
 const pdctx=w.emit("PRODUCT_DEFINITION_CONTEXT('part definition',#"+ctxApp+",'design')");
 const pd=w.emit("PRODUCT_DEFINITION('design','',#"+pdf+',#'+pdctx+')');
 const pds=w.emit("PRODUCT_DEFINITION_SHAPE('','',#"+pd+')');
 const lenU=w.emit('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
 const angU=w.emit('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
 const solU=w.emit('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
 const unc=w.emit("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#"+lenU+",'distance_accuracy_value','')");
 const geoCtx=w.emit('(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#'+unc+
   '))GLOBAL_UNIT_ASSIGNED_CONTEXT((#'+lenU+',#'+angU+',#'+solU+"))REPRESENTATION_CONTEXT('',''))");
 const origin=w.point([0,0,0]);
 const ax=w.emit("AXIS2_PLACEMENT_3D('',#"+origin+',#'+w.dir([0,0,1])+',#'+w.dir([1,0,0])+')');
 const rep=w.emit("ADVANCED_BREP_SHAPE_REPRESENTATION('"+name+"',(#"+ax+',#'+bodyId+'),#'+geoCtx+')');
 w.emit('SHAPE_DEFINITION_REPRESENTATION(#'+pds+',#'+rep+')');

 const ts=new Date().toISOString().replace(/\.\d+Z$/,'Z');
 const head=[
  'ISO-10303-21;','HEADER;',
  "FILE_DESCRIPTION(('SLDPRT display geometry converted by converter/v0.1'),'2;1');",
  "FILE_NAME('"+name+"','"+ts+"',(''),(''),'sldprt-format-research converter/v0.1','',''); ",
  "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
  'ENDSEC;','DATA;'
 ];
 return head.join('\n')+'\n'+w.lines.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;\n';
}

module.exports={loadModel,toSTLBinary,toSTLAscii,toSTEP,SCALE};

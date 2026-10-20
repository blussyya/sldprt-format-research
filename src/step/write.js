/* ISO 10303-21 writer for the exact B-rep (AP214, AUTOMOTIVE_DESIGN).
 *
 *   write(M, opts) -> STEP text
 *
 * M is a split model (src/brep/split.js): every edge has a 3D curve of type line, circle,
 * ellipse or bspline, vertices [start, end] and sameSense; every face a surface, sameSense and
 * loops of {edge, sense}; bodies -> regions -> shells. Lengths in M are metres; the file is in
 * millimetres, angles in radians, as SolidWorks writes it.
 *
 * Surfaces: PLANE, CYLINDRICAL_, CONICAL_, SPHERICAL_, TOROIDAL_SURFACE,
 * B_SPLINE_SURFACE_WITH_KNOTS (rational as the usual complex entity),
 * SURFACE_OF_LINEAR_EXTRUSION, SURFACE_OF_REVOLUTION, OFFSET_SURFACE.
 * Curves: LINE, CIRCLE, ELLIPSE, B_SPLINE_CURVE_WITH_KNOTS (plain and rational). An edge that
 * carries exact curves in a face's parameter space (Parasolid SP_CURVE) is written as a
 * SURFACE_CURVE with those PCURVEs.
 * Each solid body is a MANIFOLD_SOLID_BREP, or a BREP_WITH_VOIDS when a region has inner shells.
 * Faces are named 'F<native face id>' so a reader can map them back to the SLDPRT.
 *
 * opts: name (product name), timestamp (ISO string; default now), uncertainty (mm; default
 * 1e-5 like SolidWorks, raised by the caller to the achieved fit error), description.
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTStepWrite).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../geom/eval'));
  else root.SLDPRTStepWrite=factory(root.SLDPRTGeom);
})(typeof self!=='undefined'?self:this,function(G){
'use strict';
const S=1000;   // metres -> millimetres

function real(x){
  if(!isFinite(x))throw Error('STEP: non-finite number');
  if(Object.is(x,-0))x=0;
  let s=String(x);
  const e=s.indexOf('e');
  if(e>=0){let m=s.slice(0,e);if(m.indexOf('.')<0)m+='.';return m+'E'+s.slice(e+1);}
  return s.indexOf('.')<0?s+'.':s;
}
function str(x){
  let out='';
  for(const ch of String(x)){const c=ch.codePointAt(0);
    if(ch==="'")out+="''";else if(ch==='\\')out+='\\\\';
    else if(c>=32&&c<127)out+=ch;
    else if(c<=0xffff)out+='\\X2\\'+c.toString(16).toUpperCase().padStart(4,'0')+'\\X0\\';
    else out+='\\X4\\'+c.toString(16).toUpperCase().padStart(8,'0')+'\\X0\\';}
  return "'"+out+"'";
}
function knotsOf(k){const ks=[],ms=[];for(const x of k){if(ks.length&&x===ks[ks.length-1])ms[ms.length-1]++;else{ks.push(x);ms.push(1);}}return {ks,ms};}

function write(M,opts){
  opts=opts||{};
  const lines=[];let n=0;
  const emit=s=>{lines.push('#'+(++n)+'='+s+';');return '#'+n;};
  const list=a=>'('+a.join(',')+')';
  const pt=p=>emit("CARTESIAN_POINT('',"+list(p.map(x=>real(x*S)))+')');
  const pt2=p=>emit("CARTESIAN_POINT('',"+list(p.map(real))+')');
  const dir=d=>{const u=G.unit(d);return emit("DIRECTION('',"+list(u.map(real))+')');};
  const ax2=(o,z,x)=>{const zz=G.unit(z),xx=G.unit(G.sub(x,G.mul(zz,G.dot(x,zz))));return emit("AXIS2_PLACEMENT_3D('',"+pt(o)+','+dir(zz)+','+dir(xx)+')');};

  function bsplineCurve(c,two){
    const {ks,ms}=knotsOf(c.knots);
    const ctrl=list(c.ctrl.map(p=>two?pt2([p[0]*(two.su||1),p[1]*(two.sv||1)]):pt(p)));
    const closed=c.closed?'.T.':'.F.';
    if(!c.weights)return emit("B_SPLINE_CURVE_WITH_KNOTS('',"+c.degree+','+ctrl+',.UNSPECIFIED.,'+closed+',.F.,'+list(ms)+','+list(ks.map(real))+',.UNSPECIFIED.)');
    return emit('(BOUNDED_CURVE()B_SPLINE_CURVE('+c.degree+','+ctrl+',.UNSPECIFIED.,'+closed+',.F.)B_SPLINE_CURVE_WITH_KNOTS('+list(ms)+','+list(ks.map(real))+
      ',.UNSPECIFIED.)CURVE()GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_CURVE('+list(c.weights.map(real))+")REPRESENTATION_ITEM(''))");
  }
  const curveMemo=new Map();
  function curve(c){
    if(curveMemo.has(c))return curveMemo.get(c);
    let id;
    switch(c.type){
      case 'line':id=emit("LINE('',"+pt(c.p)+','+emit("VECTOR('',"+dir(c.d)+',1.)')+')');break;
      case 'circle':id=emit("CIRCLE('',"+ax2(c.c,c.n,c.x)+','+real(c.r*S)+')');break;
      case 'ellipse':{let x=c.x,r1=c.r1,r2=c.r2;if(r1<r2){x=G.cross(c.n,c.x);r1=c.r2;r2=c.r1;}   // readers want the major axis first
        id=emit("ELLIPSE('',"+ax2(c.c,c.n,x)+','+real(r1*S)+','+real(r2*S)+')');break;}
      case 'bspline':id=bsplineCurve(c);break;
      default:throw Error('STEP write: curve type '+c.type);
    }
    curveMemo.set(c,id);return id;
  }
  const surfMemo=new Map();
  function surface(s){
    if(surfMemo.has(s))return surfMemo.get(s);
    let id;
    switch(s.type){
      case 'plane':id=emit("PLANE('',"+ax2(s.p,s.n,s.x)+')');break;
      case 'cylinder':id=emit("CYLINDRICAL_SURFACE('',"+ax2(s.p,s.a,s.x)+','+real(s.r*S)+')');break;
      case 'cone':if(!(s.angle>0&&s.angle<Math.PI/2)||s.r<0)throw Error('STEP write: cone with half angle '+s.angle);
        id=emit("CONICAL_SURFACE('',"+ax2(s.p,s.a,s.x)+','+real(s.r*S)+','+real(s.angle)+')');break;
      case 'sphere':id=emit("SPHERICAL_SURFACE('',"+ax2(s.c,s.a,s.x)+','+real(s.r*S)+')');break;
      case 'torus':id=emit("TOROIDAL_SURFACE('',"+ax2(s.c,s.a,s.x)+','+real(s.R*S)+','+real(s.r*S)+')');break;
      case 'bspline':{
        const u=knotsOf(s.ku),v=knotsOf(s.kv),grid=list(s.ctrl.map(row=>list(row.map(pt))));
        const flags=',.UNSPECIFIED.,'+(s.uClosed?'.T.':'.F.')+','+(s.vClosed?'.T.':'.F.')+',.F.';
        if(!s.weights)id=emit("B_SPLINE_SURFACE_WITH_KNOTS('',"+s.du+','+s.dv+','+grid+flags+','+list(u.ms)+','+list(v.ms)+','+list(u.ks.map(real))+','+list(v.ks.map(real))+',.UNSPECIFIED.)');
        else id=emit('(BOUNDED_SURFACE()B_SPLINE_SURFACE('+s.du+','+s.dv+','+grid+flags+')B_SPLINE_SURFACE_WITH_KNOTS('+list(u.ms)+','+list(v.ms)+','+list(u.ks.map(real))+','+list(v.ks.map(real))+
          ',.UNSPECIFIED.)GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_SURFACE('+list(s.weights.map(r=>list(r.map(real))))+")REPRESENTATION_ITEM('')SURFACE())");
        break;}
      case 'swept':id=emit("SURFACE_OF_LINEAR_EXTRUSION('',"+curve(s.curve)+','+emit("VECTOR('',"+dir(s.d)+',1.)')+')');break;
      case 'spun':id=emit("SURFACE_OF_REVOLUTION('',"+curve(s.curve)+','+emit("AXIS1_PLACEMENT('',"+pt(s.c)+','+dir(s.a)+')')+')');break;
      case 'offset':id=emit("OFFSET_SURFACE('',"+surface(s.basis)+','+real(s.d*S)+',.F.)');break;
      default:throw Error('STEP write: surface type '+s.type);
    }
    surfMemo.set(s,id);return id;
  }
  // parameter scale of a surface's (u, v) in the file: lengths become millimetres, angles stay
  const paramScale=s=>{switch(s.type){case 'plane':return {su:S,sv:S};case 'cylinder':return {su:1,sv:S};case 'torus':case 'sphere':case 'bspline':return {su:1,sv:1};
    case 'swept':return {su:s.curve.type==='line'?S:1,sv:S};}return null;};
  let ctx2d=null;
  function pcurve(pc){
    const sc=paramScale(pc.surface);if(!sc)return null;
    if(!ctx2d)ctx2d=emit("(GEOMETRIC_REPRESENTATION_CONTEXT(2)PARAMETRIC_REPRESENTATION_CONTEXT()REPRESENTATION_CONTEXT('2D SPACE',''))");
    const c2=bsplineCurve(pc.c2,sc);
    return emit("PCURVE('',"+surface(pc.surface)+','+emit("DEFINITIONAL_REPRESENTATION('',("+c2+'),'+ctx2d+')')+')');
  }

  const vmemo=new Map(),ememo=new Map();
  const vertex=id=>{if(!vmemo.has(id)){const v=M.vertices.get(id);if(!v)throw Error('STEP write: missing vertex '+id);vmemo.set(id,emit("VERTEX_POINT('',"+pt(v.p)+')'));}return vmemo.get(id);};
  function edge(id){
    if(ememo.has(id))return ememo.get(id);
    const e=M.edges.get(id);if(!e)throw Error('STEP write: missing edge '+id);
    let c=curve(e.curve);
    if(e.pcurves&&e.pcurves.length&&opts.pcurves!==false){
      const ps=e.pcurves.map(pcurve).filter(Boolean);
      if(ps.length)c=emit("SURFACE_CURVE('',"+c+','+list(ps)+',.PCURVE_S1.)');
    }
    const r=emit("EDGE_CURVE('',"+vertex(e.v[0])+','+vertex(e.v[1])+','+c+','+(e.sameSense?'.T.':'.F.')+')');
    ememo.set(id,r);return r;
  }
  const faceOf=new Map(M.faces.map(f=>[f.id,f]));
  function face(id,reversed){
    const f=faceOf.get(id);if(!f)throw Error('STEP write: missing face '+id);
    const bounds=f.loops.map((l,i)=>{
      if(!l.coedges.length)throw Error('STEP write: face '+f.source+' has a vertex loop');
      const loop=emit("EDGE_LOOP('',"+list(l.coedges.map(c=>emit("ORIENTED_EDGE('',*,*,"+edge(c.edge)+','+(c.sense?'.T.':'.F.')+')')))+')');
      return emit((i===0&&f.outerFirst?'FACE_OUTER_BOUND':'FACE_BOUND')+"('',"+loop+','+(reversed?'.F.':'.T.')+')');
    });
    const same=reversed?!f.sameSense:f.sameSense;
    return emit('ADVANCED_FACE('+str('F'+(f.source!==undefined?f.source:f.id))+','+list(bounds)+','+surface(f.surface)+','+(same?'.T.':'.F.')+')');
  }
  const shellFaces=(sh,flip)=>[...sh.faces.map(id=>face(id,flip)),...(sh.reversed||[]).map(id=>face(id,!flip))];

  const items=[];
  for(const b of M.bodies){
    if(b.type!=='solid')throw Error('STEP write: body '+b.id+' is a '+b.type+' body; only solids are written');
    for(const r of b.regions){if(r.type!=='solid')continue;
      if(!r.shells.length)continue;
      const shells=r.shells.map(sh=>({sh,box:box(M,sh)})).sort((a,b)=>b.box-a.box);
      const outer=emit("CLOSED_SHELL('',"+list(shellFaces(shells[0].sh,false))+')');
      if(shells.length===1){items.push(emit("MANIFOLD_SOLID_BREP("+str(opts.name||'')+','+outer+')'));continue;}
      // a void's closed shell faces away from the cavity; the oriented shell turns it round
      const voids=shells.slice(1).map(x=>emit("ORIENTED_CLOSED_SHELL('',*,"+emit("CLOSED_SHELL('',"+list(shellFaces(x.sh,true))+')')+',.F.)'));
      items.push(emit("BREP_WITH_VOIDS("+str(opts.name||'')+','+outer+','+list(voids)+')'));
    }
  }
  if(!items.length)throw Error('STEP write: no solid bodies');

  const name=opts.name||'part';
  const app=emit("APPLICATION_CONTEXT('automotive design')");
  emit("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,"+app+')');
  const pctx=emit("PRODUCT_CONTEXT('',"+app+",'mechanical')");
  const prod=emit('PRODUCT('+str(name)+','+str(name)+",'',("+pctx+'))');
  emit("PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,("+prod+'))');
  const pdf=emit("PRODUCT_DEFINITION_FORMATION('','',"+prod+')');
  const pdctx=emit("PRODUCT_DEFINITION_CONTEXT('part definition',"+app+",'design')");
  const pd=emit("PRODUCT_DEFINITION('design','',"+pdf+','+pdctx+')');
  const pds=emit("PRODUCT_DEFINITION_SHAPE('','',"+pd+')');
  const lenU=emit('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const angU=emit('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const solU=emit('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc=emit('UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE('+real(opts.uncertainty||1e-5)+'),'+lenU+",'distance_accuracy_value','maximum gap between the exact geometry and the file')");
  const ctx=emit('(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT(('+unc+'))GLOBAL_UNIT_ASSIGNED_CONTEXT(('+lenU+','+angU+','+solU+"))REPRESENTATION_CONTEXT('',''))");
  const origin=ax2([0,0,0],[0,0,1],[1,0,0]);
  const rep=emit('ADVANCED_BREP_SHAPE_REPRESENTATION('+str(name)+','+list([...items,origin])+','+ctx+')');
  emit('SHAPE_DEFINITION_REPRESENTATION('+pds+','+rep+')');

  const ts=opts.timestamp||new Date().toISOString().replace(/\.\d+Z$/,'');
  const head=['ISO-10303-21;','HEADER;',
    'FILE_DESCRIPTION(('+str(opts.description||'exact B-rep read from the SLDPRT Parasolid partition')+"),'2;1');",
    'FILE_NAME('+str(name)+','+str(ts)+",(''),(''),'sldprt','sldprt','');",
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",'ENDSEC;','DATA;'];
  return head.join('\n')+'\n'+lines.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;\n';
}
/* Size of a shell's vertex bounding box: the outer shell of a region is the largest. */
function box(M,sh){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],faceOf=new Map(M.faces.map(f=>[f.id,f]));
  for(const id of [...sh.faces,...(sh.reversed||[])]){const f=faceOf.get(id);
    for(const l of f.loops)for(const c of l.coedges){const e=M.edges.get(c.edge);for(const v of e.v){const p=M.vertices.get(v).p;for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}}}}
  return (hi[0]-lo[0])+(hi[1]-lo[1])+(hi[2]-lo[2]);
}

return {write,real,str};
});

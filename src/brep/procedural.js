/* Resolve a native B-rep (src/brep/native.js) into geometry a STEP file can hold.
 *
 *   resolve(N, opts) -> {vertices, edges, faces, bodies, report}
 *
 * Every edge gets a 3D curve of type line, circle, ellipse or bspline and the parameters
 * t0 -> t1 it runs over (t1 < t0 when it runs against the curve). Every face keeps its surface
 * unless the surface is procedural.
 *
 *   exact      line, circle, ellipse, B-curve, trimmed curves (the edge's vertices trim them);
 *              plane, cylinder, cone, sphere, torus, B-surface, swept (linear extrusion),
 *              spun (revolution), offset.
 *   pcurves    SP_CURVE: its 2D B-curve is exact in the surface's (u, v) and is kept as a PCURVE;
 *              the 3D curve STEP also needs is fitted (exact on a plane: a plane maps a 2D
 *              B-spline to a 3D one by an affine map).
 *   fitted     INTERSECTION curves and the contact curves of blends: cubic B-splines through
 *              exact points; rolling-ball blends: rational B-spline surfaces whose u-sections are
 *              the exact circular arcs. See src/brep/fit.js.
 * report.maxError is the largest distance found between a fitted curve or surface and the exact
 * geometry, in metres, measured at points between the interpolation points.
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTProcedural).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../geom/eval'),require('./fit'));
  else root.SLDPRTProcedural=factory(root.SLDPRTGeom,root.SLDPRTFit);
})(typeof self!=='undefined'?self:this,function(G,Fit){
'use strict';
const TAU=2*Math.PI;
const mod=(x,m)=>((x%m)+m)%m;

function resolve(N,opts){
  opts=opts||{};
  const tol=opts.tolerance||1e-8;
  const report={exactEdges:0,fittedCurves:0,pcurveEdges:0,fittedSurfaces:0,maxError:0,errors:{curve:0,surface:0},tolerantEdges:0,maxEdgeGap:0};
  const vertices=new Map();for(const v of N.vertices.values())vertices.set(v.id,{id:v.id,p:v.p});
  const P=id=>vertices.get(id).p;
  const faceOf=new Map(N.faces.map(f=>[f.id,f]));

  // surfaces first: blends become B-splines, and curves on them must see the B-spline
  const surfMemo=new Map();
  const faces=N.faces.map(f=>({id:f.id,surface:surface(f.surface,f),sameSense:f.sameSense,loops:f.loops}));
  function surface(s,f){
    if(surfMemo.has(s))return surfMemo.get(s);
    let out=s;
    if(s.type==='blend'){
      const r=Fit.blendSurface(s,f,N,{tolerance:tol});
      out=r.surface;report.fittedSurfaces++;report.errors.surface=Math.max(report.errors.surface,r.error);
    }else if(s.type==='blendBound')throw Error('resolve: face '+f.id+' lies on a blend boundary surface');
    surfMemo.set(s,out);return out;
  }

  const edges=new Map();
  for(const e of N.edges.values()){
    let c=e.curve;if(c.type==='trimmed')c=c.basis;
    const p0=e.v?P(e.v[0]):null,p1=e.v?P(e.v[1]):null;
    let out;
    if(c.type==='line'||c.type==='circle'||c.type==='ellipse'||(c.type==='bspline'&&c.dim!==2)){
      out={curve:c,...range(c,e.sameSense,p0,p1,e)};report.exactEdges++;
    }else if(c.type==='spcurve'||c.type==='intersection'){
      const r=Fit.edgeCurve(e,c,p0,p1,{tolerance:tol,faceOf});
      out={curve:r.curve,t0:r.t0,t1:r.t1,fit:r.error};report.fittedCurves++;report.errors.curve=Math.max(report.errors.curve,r.error);
    }else throw Error('resolve: edge '+e.id+' curve '+c.type);
    // exact curves in the faces' parameter spaces (SP_CURVE fins), on the resolved surfaces
    const pcurves=(e.pcurves||[]).map(pc=>{let k=pc.curve;if(k.type==='trimmed')k=k.basis;if(k.type!=='spcurve')return null;
      const f=faces.find(x=>x.id===pc.face);if(!f||f.surface!==k.surface)return null;return {face:pc.face,surface:f.surface,c2:k.c2};}).filter(Boolean);
    if(pcurves.length)report.pcurveEdges++;
    if(e.tolerant)report.tolerantEdges++;
    edges.set(e.id,{id:e.id,v:e.v,curve:out.curve,t0:out.t0,t1:out.t1,sameSense:out.t1>out.t0,pcurves,fit:out.fit,tolerance:e.tolerance});
  }
  // a fitted blend's parametrisation is ours, so its face sense is too: the blend meets its
  // supports tangentially, so take the neighbour whose normal is most nearly parallel and agree
  for(const f of faces){if(!f.surface.fitted)continue;
    let best=null,bd=-1;
    for(const l of f.loops)for(const co of l.coedges){const e=edges.get(co.edge);
      const X=G.curvePoint(e.curve,(e.t0+e.t1)/2);
      for(const g of faces){if(g===f||g.surface.fitted||!g.loops.some(m=>m.coedges.some(c=>c.edge===e.id)))continue;
        const ng=G.mul(G.surfaceFoot(g.surface,X).n,g.sameSense?1:-1),nf=G.surfaceFoot(f.surface,X).n,d=G.dot(ng,nf);
        if(Math.abs(d)>bd){bd=Math.abs(d);best=d;}}}
    if(best===null)throw Error('resolve: blend face '+f.id+' has no neighbour to orient it by');
    f.sameSense=best>0;
  }
  report.maxError=Math.max(report.errors.curve,report.errors.surface);
  return {source:N.source,unit:'m',vertices,edges,faces,bodies:N.bodies,report};
}

/* Parameters of an exact curve between the edge's vertices, in the edge's direction. */
function range(c,same,p0,p1,e){
  const proj=p=>G.curveProject(c,p);
  if(!p0){   // closed edge without a vertex
    if(c.type==='circle'||c.type==='ellipse')return same?{t0:0,t1:TAU}:{t0:TAU,t1:0};
    const [a,b]=G.curveRange(c);return same?{t0:a,t1:b}:{t0:b,t1:a};
  }
  const a=proj(p0),b=proj(p1);
  const gap=Math.max(a.d,b.d);
  if(gap>Math.max(1e-6,(e.tolerance||0)*2))throw Error('resolve: edge '+e.id+' vertices are '+gap.toExponential(2)+' m off its curve');
  let t0=a.t,t1=b.t;
  if(c.type==='circle'||c.type==='ellipse'){
    if(same){t1=t0+mod(t1-t0,TAU);if(t1-t0<1e-12)t1=t0+TAU;}
    else{t1=t0-mod(t0-t1,TAU);if(t0-t1<1e-12)t1=t0-TAU;}
  }else if(c.type==='bspline'&&c.closed&&e.v[0]===e.v[1]){const [x,y]=G.curveRange(c);t0=same?x:y;t1=same?y:x;}
  else if((t1>t0)!==same)throw Error('resolve: edge '+e.id+' runs against its sense ('+t0+' -> '+t1+')');
  return {t0,t1};
}

return {resolve,range};
});

/* Native Parasolid body (xt.parse result) -> neutral B-rep model, the same shape as
 * src/step/read.js produces:
 *
 *   {vertices: Map id -> {id, p, tolerance},
 *    edges:    Map id -> {id, v:[start, end] (null for a closed ring edge), curve, sameSense,
 *                         tolerance, pcurves:[{face, curve, sameSense}]},
 *    faces:    [{id, surface, sameSense, loops:[{coedges:[{edge, sense}], vertex?}]}],
 *    bodies:   [{id, type, regions:[{type:'solid'|'void', shells:[{faces:[faceId…], reversed:[faceId…]}]}]}]}
 *
 * Conventions established on the corpus (docs/format/parasolid.md):
 *   - EDGE.fin is the edge's positive fin. A fin runs along its edge when its sense is '+'.
 *   - FIN.vertex is the vertex at the END of the fin, so an edge runs from
 *     other(fin).vertex to fin.vertex (432 line edges and 24 trimmed curves agree).
 *   - The edge runs along its curve when the curve's sense is '+'.
 *   - A face's outward normal is the surface's natural normal, reversed once for a '-' surface
 *     sense and once for a '-' face sense.
 *   - An SP_CURVE's 2D B-curve is in the (u, v) of its surface with the parameterisations listed
 *     in src/geom/eval.js (checked on plane, cylinder, torus and B-surface: 0 to 1.2e-16 m).
 *   - An edge without a curve (a tolerant edge) has a curve on each of its fins.
 * Edge, vertex and face ids are Parasolid node_ids, which are also the display-mesh IDs.
 *
 * Procedural geometry is kept as its defining data and resolved by src/brep/procedural.js:
 *   curves   {type:'intersection', surfaces:[S1,S2], chart:[points], start, end, chordalError}
 *   surfaces {type:'blend', blendType, surfaces:[S1,S2], spine, range:[r1,r2], start, end}
 *            {type:'blendBound', boundary, blend}
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTNative).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../geom/eval'));
  else root.SLDPRTNative=factory(root.SLDPRTGeom);
})(typeof self!=='undefined'?self:this,function(G){
'use strict';

function build(parsed){
  if(parsed.error)throw Error('B-rep not fully read: '+parsed.error);
  const m=new Map(parsed.nodes.map(n=>[n.index,n])),node=i=>{const n=m.get(i);if(!n)throw Error('B-rep: missing node '+i);return n;};
  const sgn=c=>c==='-'?-1:1;
  const arr=(i,key)=>node(i).values[key];

  function nurbsCurve(nc){
    const v=nc.values,dim=v.vertex_dim,flat=arr(v.bspline_vertices,'vertices'),mult=arr(v.knot_mult,'mult'),kn=arr(v.knots,'knots');
    const space=v.rational?dim-1:dim;if(space!==2&&space!==3)throw Error('B-rep: B-curve with vertex_dim '+dim);
    const ctrl=[],weights=v.rational?[]:null;
    for(let i=0;i<v.n_vertices;i++){const q=flat.slice(i*dim,i*dim+dim),w=v.rational?q[dim-1]:1;
      if(v.rational)weights.push(w);
      ctrl.push([q[0]/w,q[1]/w,space===3?q[2]/w:0]);}
    const knots=[];mult.forEach((k,i)=>{for(let j=0;j<k;j++)knots.push(kn[i]);});
    return {type:'bspline',degree:v.degree,ctrl,weights,knots,closed:!!v.closed,periodic:!!v.periodic,dim:space};
  }
  function nurbsSurface(ns){
    const v=ns.values,dim=v.vertex_dim,flat=arr(v.bspline_vertices,'vertices');
    const knots=(mk,kk)=>{const mult=arr(mk,'mult'),kn=arr(kk,'knots'),out=[];mult.forEach((k,i)=>{for(let j=0;j<k;j++)out.push(kn[i]);});return out;};
    const ctrl=[],weights=v.rational?[]:null;
    for(let i=0;i<v.n_u_vertices;i++){ctrl.push([]);if(weights)weights.push([]);
      for(let j=0;j<v.n_v_vertices;j++){const o=(i*v.n_v_vertices+j)*dim,q=flat.slice(o,o+dim);   // v varies fastest
        if(v.rational){const w=q[dim-1];weights[i].push(w);ctrl[i].push([q[0]/w,q[1]/w,q[2]/w]);}else ctrl[i].push(q.slice(0,3));}}
    return {type:'bspline',du:v.u_degree,dv:v.v_degree,ctrl,weights,ku:knots(v.u_knot_mult,v.u_knots),kv:knots(v.v_knot_mult,v.v_knots),uPeriodic:!!v.u_periodic,vPeriodic:!!v.v_periodic,uClosed:!!v.u_closed,vClosed:!!v.v_closed};
  }
  function limit(i){if(!i)return null;const v=node(i).values;return {type:v.type,p:v.hvec[0],hvec:v.hvec};}
  // Curves and surfaces are memoised by node, so geometry shared in the file is shared here.
  const curves=new Map(),surfaces=new Map();
  function curve(i){
    if(curves.has(i))return curves.get(i);
    const c=node(i),v=c.values;let out;
    switch(c.name){
      case 'LINE':out={type:'line',p:v.pvec,d:G.unit(v.direction)};break;
      case 'CIRCLE':out={type:'circle',c:v.centre,n:G.unit(v.normal),x:G.unit(v.x_axis),r:v.radius};break;
      case 'ELLIPSE':out={type:'ellipse',c:v.centre,n:G.unit(v.normal),x:G.unit(v.x_axis),r1:v.major_radius,r2:v.minor_radius};break;
      case 'B_CURVE':out=nurbsCurve(node(v.nurbs));if(out.dim!==3)throw Error('B-rep: 2D B_CURVE used as a 3D curve (node '+i+')');break;
      case 'TRIMMED_CURVE':out={type:'trimmed',basis:curve(v.basis_curve),t0:v.parm_1,t1:v.parm_2,p0:v.point_1,p1:v.point_2};break;
      case 'SP_CURVE':{const c2=nurbsCurve(node(node(v.b_curve).values.nurbs));if(c2.dim!==2)throw Error('B-rep: SP_CURVE with a 3D B-curve (node '+i+')');
        out={type:'spcurve',surface:surface(v.surface),c2,tolerance:v.tolerance_to_original};break;}
      case 'INTERSECTION':{const ch=node(v.chart).values;
        out={type:'intersection',surfaces:v.surface.map(surface),chart:ch.hvec,chordalError:ch.chordal_error,start:limit(v.start),end:limit(v.end),node:v.node_id};break;}
    }
    if(!out)throw Error('B-rep: unsupported curve '+c.name+' (node '+i+')');
    out.node=v.node_id;curves.set(i,out);return out;
  }
  function surface(i){
    if(surfaces.has(i))return surfaces.get(i);
    const s=node(i),v=s.values;let out;
    switch(s.name){
      case 'PLANE':out={type:'plane',p:v.pvec,n:G.unit(v.normal),x:G.unit(v.x_axis)};break;
      case 'CYLINDER':out={type:'cylinder',p:v.pvec,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius};break;
      case 'CONE':out={type:'cone',p:v.pvec,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius,angle:Math.atan2(v.sin_half_angle,v.cos_half_angle)};break;
      case 'SPHERE':out={type:'sphere',c:v.centre,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius};break;
      case 'TORUS':out={type:'torus',c:v.centre,a:G.unit(v.axis),x:G.unit(v.x_axis),R:v.major_radius,r:v.minor_radius};break;
      case 'B_SURFACE':out=nurbsSurface(node(v.nurbs));break;
      case 'SWEPT_SURF':out={type:'swept',curve:curve(v.section),d:G.unit(v.sweep),scale:v.scale};break;
      case 'SPUN_SURF':out={type:'spun',curve:curve(v.profile),c:v.base,a:G.unit(v.axis),x:v.x_axis?G.unit(v.x_axis):null};break;
      case 'OFFSET_SURF':out={type:'offset',basis:surface(v.surface),d:v.offset};break;
      case 'BLENDED_EDGE':
        surfaces.set(i,out={type:'blend',blendType:v.blend_type,range:v.range,start:limit(v.start),end:limit(v.end)});   // set first: blends may refer to each other
        out.surfaces=v.surface.map(surface);out.senses=v.surface.map(k=>sgn(node(k).values.sense));out.spine=curve(v.spine);out.spineSense=sgn(node(v.spine).values.sense);break;
      case 'BLEND_BOUND':surfaces.set(i,out={type:'blendBound',boundary:v.boundary});out.blend=surface(v.blend);break;
    }
    if(!out)throw Error('B-rep: unsupported surface '+s.name+' (node '+i+')');
    out.node=v.node_id;out.sense=sgn(v.sense);surfaces.set(i,out);return out;
  }

  const vertices=new Map(),edges=new Map(),faces=[];
  const vertex=i=>{if(!i)return null;const n=node(i);if(!vertices.has(n.values.node_id))vertices.set(n.values.node_id,{id:n.values.node_id,p:node(n.values.point).values.pvec,tolerance:n.values.tolerance});return n.values.node_id;};
  const faceId=i=>node(i).values.node_id;
  for(const e of parsed.nodes.filter(n=>n.type===16)){
    const f=node(e.values.fin);if(f.values.sense!=='+')throw Error('B-rep: edge '+e.values.node_id+' positive fin has sense '+f.values.sense);
    const o=node(f.values.other);
    const start=vertex(o.values.vertex),end=vertex(f.values.vertex);
    const pcurves=[];
    for(const fin of [f,o])if(fin.values.curve&&fin.values.loop){
      const cn=node(fin.values.curve),k=node(fin.values.loop).values.face;
      // the fin's curve runs along the fin when its sense is '+'; the fin runs along the edge when its sense is '+'
      pcurves.push({face:faceId(k),curve:curve(fin.values.curve),sameSense:sgn(cn.values.sense)*sgn(fin.values.sense)>0});
    }
    let cn=e.values.curve?node(e.values.curve):null,c,same;
    if(cn){c=curve(e.values.curve);same=sgn(cn.values.sense)>0;}
    else if(pcurves.length){c=pcurves[0].curve;same=pcurves[0].sameSense;}   // tolerant edge: its geometry lives on the fins
    else throw Error('B-rep: edge '+e.values.node_id+' has no curve');
    edges.set(e.values.node_id,{id:e.values.node_id,v:start===null&&end===null?null:[start,end],curve:c,sameSense:same,tolerance:e.values.tolerance,pcurves,tolerant:!cn});
  }
  for(const f of parsed.nodes.filter(n=>n.type===14)){
    const sn=node(f.values.surface),loops=[];
    for(let l=f.values.loop;l;l=node(l).values.next){
      const first=node(l).values.fin,co=[];let x=first,guard=0,lone=null;
      do{const fin=node(x);if(fin.values.edge)co.push({edge:node(fin.values.edge).values.node_id,sense:fin.values.sense==='+'});else lone=vertex(fin.values.vertex);
        x=fin.values.forward;if(++guard>1e6)throw Error('B-rep: open fin ring');}while(x!==first);
      loops.push(co.length?{coedges:co}:{coedges:co,vertex:lone});
    }
    faces.push({id:f.values.node_id,surface:surface(f.values.surface),sameSense:sgn(sn.values.sense)*sgn(f.values.sense)>0,loops,shell:f.values.shell,frontShell:f.values.front_shell});
  }
  for(const v of parsed.nodes.filter(n=>n.type===18))vertex(v.index);

  // bodies -> regions -> shells. A face belongs to the shell behind it (FACE.shell) with its own
  // orientation, and to the shell in front of it (FACE.front_shell) reversed.
  const bodies=[];
  for(const b of parsed.nodes.filter(n=>n.type===12)){
    const regions=[];
    for(let r=b.values.region,guard=0;r&&guard<1e6;r=node(r).values.next,guard++){
      const rv=node(r).values,shells=[];
      for(let s=rv.shell,g2=0;s&&g2<1e6;s=node(s).values.next,g2++)shells.push({index:s,faces:faces.filter(f=>f.shell===s).map(f=>f.id),reversed:faces.filter(f=>f.frontShell===s&&f.shell!==s).map(f=>f.id)});
      regions.push({type:rv.type==='S'?'solid':rv.type==='V'?'void':rv.type,shells});
    }
    bodies.push({id:b.values.highest_node_id,type:{1:'solid',2:'wire',3:'sheet',6:'general'}[b.values.body_type]||String(b.values.body_type),bodyType:b.values.body_type,regions});
  }
  for(const f of faces){delete f.shell;delete f.frontShell;}
  return {source:'parasolid',unit:'m',vertices,edges,faces,bodies};
}

return {build};
});

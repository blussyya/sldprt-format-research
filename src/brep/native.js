'use strict';
/* Native Parasolid body (xt.parse result) -> neutral B-rep model, the same shape as
 * src/step/read.js produces:
 *
 *   {vertices: Map id -> {id, p},
 *    edges:    Map id -> {id, v:[start, end] (null for a closed ring edge), curve, sameSense},
 *    faces:    [{id, surface, sameSense, loops:[{coedges:[{edge, sense}]}]}]}
 *
 * Conventions established on the corpus (docs/format/parasolid.md):
 *   - EDGE.fin is the edge's positive fin. A fin runs along its edge when its sense is '+'.
 *   - FIN.vertex is the vertex at the END of the fin, so an edge runs from
 *     other(fin).vertex to fin.vertex (432 line edges and 24 trimmed curves agree).
 *   - The edge runs along its curve when the curve's sense is '+'.
 *   - A face's outward normal is the surface's natural normal, reversed once for a '-' surface
 *     sense and once for a '-' face sense.
 * Edge, vertex and face ids are Parasolid node_ids, which are also the display-mesh IDs.
 */
const G=require('../geom/eval');

function build(parsed){
  if(parsed.error)throw Error('B-rep not fully read: '+parsed.error);
  const m=new Map(parsed.nodes.map(n=>[n.index,n])),node=i=>{const n=m.get(i);if(!n)throw Error('B-rep: missing node '+i);return n;};
  const sgn=c=>c==='-'?-1:1;
  const arr=(i,key)=>node(i).values[key];

  function nurbsCurve(nc){
    const v=nc.values,dim=v.vertex_dim,flat=arr(v.bspline_vertices,'vertices'),mult=arr(v.knot_mult,'mult'),kn=arr(v.knots,'knots');
    const ctrl=[],weights=v.rational?[]:null;
    for(let i=0;i<v.n_vertices;i++){const q=flat.slice(i*dim,i*dim+dim);
      if(v.rational){const w=q[dim-1];weights.push(w);ctrl.push([q[0]/w,q[1]/w,q[2]/w]);}else ctrl.push(q.slice(0,3));}
    const knots=[];mult.forEach((k,i)=>{for(let j=0;j<k;j++)knots.push(kn[i]);});
    return {type:'bspline',degree:v.degree,ctrl,weights,knots,closed:!!v.closed,periodic:!!v.periodic};
  }
  function nurbsSurface(ns){
    const v=ns.values,dim=v.vertex_dim,flat=arr(v.bspline_vertices,'vertices');
    const knots=(mk,kk)=>{const mult=arr(mk,'mult'),kn=arr(kk,'knots'),out=[];mult.forEach((k,i)=>{for(let j=0;j<k;j++)out.push(kn[i]);});return out;};
    const ctrl=[],weights=v.rational?[]:null;
    for(let i=0;i<v.n_u_vertices;i++){ctrl.push([]);if(weights)weights.push([]);
      for(let j=0;j<v.n_v_vertices;j++){const o=(i*v.n_v_vertices+j)*dim,q=flat.slice(o,o+dim);   // v varies fastest
        if(v.rational){const w=q[dim-1];weights[i].push(w);ctrl[i].push([q[0]/w,q[1]/w,q[2]/w]);}else ctrl[i].push(q.slice(0,3));}}
    return {type:'bspline',du:v.u_degree,dv:v.v_degree,ctrl,weights,ku:knots(v.u_knot_mult,v.u_knots),kv:knots(v.v_knot_mult,v.v_knots),uPeriodic:!!v.u_periodic,vPeriodic:!!v.v_periodic};
  }
  function curve(i){
    const c=node(i),v=c.values;
    switch(c.name){
      case 'LINE':return {type:'line',p:v.pvec,d:G.unit(v.direction)};
      case 'CIRCLE':return {type:'circle',c:v.centre,n:G.unit(v.normal),x:G.unit(v.x_axis),r:v.radius};
      case 'ELLIPSE':return {type:'ellipse',c:v.centre,n:G.unit(v.normal),x:G.unit(v.x_axis),r1:v.major_radius,r2:v.minor_radius};
      case 'B_CURVE':return nurbsCurve(node(v.nurbs));
      case 'TRIMMED_CURVE':return {type:'trimmed',basis:curve(v.basis_curve),t0:v.parm_1,t1:v.parm_2,p0:v.point_1,p1:v.point_2};
    }
    throw Error('B-rep: unsupported curve '+c.name+' (node '+i+')');
  }
  function surface(i){
    const s=node(i),v=s.values;
    switch(s.name){
      case 'PLANE':return {type:'plane',p:v.pvec,n:G.unit(v.normal),x:G.unit(v.x_axis)};
      case 'CYLINDER':return {type:'cylinder',p:v.pvec,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius};
      case 'CONE':return {type:'cone',p:v.pvec,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius,angle:Math.atan2(v.sin_half_angle,v.cos_half_angle)};
      case 'SPHERE':return {type:'sphere',c:v.centre,a:G.unit(v.axis),x:G.unit(v.x_axis),r:v.radius};
      case 'TORUS':return {type:'torus',c:v.centre,a:G.unit(v.axis),x:G.unit(v.x_axis),R:v.major_radius,r:v.minor_radius};
      case 'B_SURFACE':return nurbsSurface(node(v.nurbs));
    }
    throw Error('B-rep: unsupported surface '+s.name+' (node '+i+')');
  }

  const vertices=new Map(),edges=new Map(),faces=[];
  const vertex=i=>{if(!i)return null;const n=node(i);if(!vertices.has(n.values.node_id))vertices.set(n.values.node_id,{id:n.values.node_id,p:node(n.values.point).values.pvec});return n.values.node_id;};
  for(const e of parsed.nodes.filter(n=>n.type===16)){
    const f=node(e.values.fin);if(f.values.sense!=='+')throw Error('B-rep: edge '+e.values.node_id+' positive fin has sense '+f.values.sense);
    const o=node(f.values.other),cn=e.values.curve?node(e.values.curve):null;
    if(!cn)throw Error('B-rep: edge '+e.values.node_id+' has no curve');
    const start=vertex(o.values.vertex),end=vertex(f.values.vertex);
    edges.set(e.values.node_id,{id:e.values.node_id,v:start===null&&end===null?null:[start,end],curve:curve(e.values.curve),sameSense:sgn(cn.values.sense)>0,tolerance:e.values.tolerance});
  }
  for(const f of parsed.nodes.filter(n=>n.type===14)){
    const sn=node(f.values.surface),loops=[];
    for(let l=f.values.loop;l;l=node(l).values.next){
      const first=node(l).values.fin,co=[];let x=first,guard=0;
      do{const fin=node(x);if(fin.values.edge)co.push({edge:node(fin.values.edge).values.node_id,sense:fin.values.sense==='+'});x=fin.values.forward;if(++guard>1e6)throw Error('B-rep: open fin ring');}while(x!==first);
      loops.push({coedges:co});
    }
    faces.push({id:f.values.node_id,surface:surface(f.values.surface),sameSense:sgn(sn.values.sense)*sgn(f.values.sense)>0,loops});
  }
  for(const v of parsed.nodes.filter(n=>n.type===18))vertex(v.index);
  return {source:'parasolid',unit:'m',vertices,edges,faces};
}

module.exports={build};

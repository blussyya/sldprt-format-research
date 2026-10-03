'use strict';
/* Make a neutral B-rep writable as STEP.
 *
 * Parasolid and STEP disagree about two things, and both show up in the controlled corpus:
 *
 *   1. A closed edge with no vertex. Parasolid allows a ring edge (the circle round a through
 *      hole); STEP's EDGE_CURVE needs a start and end vertex. The ring gets one vertex, at the
 *      start of its curve's parameter range, used as both ends.
 *   2. A face with no boundary at all. A whole sphere or a whole torus is one Parasolid face with
 *      zero loops. A STEP ADVANCED_FACE needs at least one bound, so the face is split the way
 *      SolidWorks' own export splits it: a sphere into two halves along two meridians, a torus
 *      into four quarters along two meridians and two parallels.
 *
 * Faces whose boundary just wraps around a closed surface (a hole's cylinder, with one circle
 * at each end) are left as Parasolid has them: two loops, no seam edge. STEP allows that, and
 * OpenCascade reads those faces as valid solids with exact volume (EXP-076).
 */
const G=require('../geom/eval');

function addSeams(model){
  const out={vertices:new Map(model.vertices),edges:new Map(),faces:[],ringVertices:0,seams:0,splitFaces:0};
  for(const e of model.edges.values()){
    if(e.v){out.edges.set(e.id,e);continue;}
    const t=G.curveRange(e.curve.type==='trimmed'?e.curve.basis:e.curve)[0],id='ring'+e.id;
    out.vertices.set(id,{id,p:G.curvePoint(e.curve,t)});out.edges.set(e.id,{...e,v:[id,id]});out.ringVertices++;
  }
  for(const f of model.faces){
    if(f.loops.length){out.faces.push(f);continue;}
    if(f.surface.type==='sphere')splitSphere(out,f);
    else if(f.surface.type==='torus')splitTorus(out,f);
    else throw Error('STEP: face '+f.id+' ('+f.surface.type+') has no boundary and no seam rule');
    out.splitFaces++;
  }
  return out;
}

/* A loop listed counter-clockwise in (u,v) bounds the face on the side of the natural normal.
 * Reverse it when the face's outward side is the other one. */
function orient(f,coedges){return f.sameSense?coedges:coedges.slice().reverse().map(c=>({edge:c.edge,sense:!c.sense}));}
function vtx(out,id,p){out.vertices.set(id,{id,p});return id;}
function edge(out,id,curve,v0,v1){out.edges.set(id,{id,curve,v:[v0,v1],sameSense:true});out.seams++;return id;}

/* sphere p(u,v) = c + r(cos v (cos u x + sin u y) + sin v z), outward = ∂u × ∂v */
function splitSphere(out,f){
  const s=f.surface,z=s.a,x=s.x,y=G.cross(z,x),k='s'+f.id+'_';
  const S=vtx(out,k+'S',G.sub(s.c,G.mul(z,s.r))),N=vtx(out,k+'N',G.add(s.c,G.mul(z,s.r)));
  const meridian=u=>{const d=G.add(G.mul(x,Math.cos(u)),G.mul(y,Math.sin(u)));       // pole to pole at angle u
    return {type:'trimmed',basis:{type:'circle',c:s.c,n:G.cross(d,z),x:d,r:s.r},t0:-Math.PI/2,t1:Math.PI/2};};
  const m0=edge(out,k+'m0',meridian(0),S,N),m1=edge(out,k+'m1',meridian(Math.PI),S,N);
  // half u∈[0,π]: up the u=π meridian, down the u=0 one
  out.faces.push({...f,id:f.id+'a',loops:[{coedges:orient(f,[{edge:m1,sense:true},{edge:m0,sense:false}])}]});
  out.faces.push({...f,id:f.id+'b',loops:[{coedges:orient(f,[{edge:m0,sense:true},{edge:m1,sense:false}])}]});
}

/* torus p(u,v) = c + (R + r cos v)(cos u x + sin u y) + r sin v z, outward = ∂u × ∂v */
function splitTorus(out,f){
  const s=f.surface,z=s.a,x=s.x,y=G.cross(z,x),k='t'+f.id+'_';
  const dir=u=>G.add(G.mul(x,Math.cos(u)),G.mul(y,Math.sin(u)));
  const P=(u,v)=>G.add(s.c,G.add(G.mul(dir(u),s.R+s.r*Math.cos(v)),G.mul(z,s.r*Math.sin(v))));
  const V={};for(const u of [0,1])for(const v of [0,1])V[u+''+v]=vtx(out,k+u+v,P(u*Math.PI,v*Math.PI));
  // meridian at u (the tube's cross-section circle), parameter v
  const mer=(u,v0,v1)=>({type:'trimmed',basis:{type:'circle',c:G.add(s.c,G.mul(dir(u),s.R)),n:G.cross(dir(u),z),x:dir(u),r:s.r},t0:v0,t1:v1});
  // parallel at v (a circle round the axis), parameter u
  const par=(v,u0,u1)=>({type:'trimmed',basis:{type:'circle',c:G.add(s.c,G.mul(z,s.r*Math.sin(v))),n:z,x,r:s.R+s.r*Math.cos(v)},t0:u0,t1:u1});
  const E={};
  for(const u of [0,1])for(const h of [0,1])E['m'+u+h]=edge(out,k+'m'+u+h,mer(u*Math.PI,h*Math.PI,(h+1)*Math.PI),V[u+''+h],V[u+''+((h+1)%2)]);
  for(const v of [0,1])for(const h of [0,1])E['p'+v+h]=edge(out,k+'p'+v+h,par(v*Math.PI,h*Math.PI,(h+1)*Math.PI),V[h+''+v],V[((h+1)%2)+''+v]);
  // quarter [hu·π,(hu+1)·π] × [hv·π,(hv+1)·π], counter-clockwise in (u,v)
  for(const hu of [0,1])for(const hv of [0,1]){
    const u1=(hu+1)%2;
    out.faces.push({...f,id:f.id+'q'+hu+hv,loops:[{coedges:orient(f,[
      {edge:E['p'+hv+hu],sense:true},{edge:E['m'+u1+hv],sense:true},{edge:E['p'+((hv+1)%2)+hu],sense:false},{edge:E['m'+hu+hv],sense:false}])}]});
  }
}

module.exports={addSeams};

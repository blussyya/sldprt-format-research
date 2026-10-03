'use strict';
/* Checks on parsed Parasolid bodies, moved verbatim from the EXP-071 audit.
 *   cubeGeometry(r)  C00: six planes, 12 edges, 8 vertices, Euler 2, outward loops, volume 1e-6 m3
 *   compare(t,b)     node-by-node equality of a text and a binary parse of the same body
 *   coverage(r)      every byte of a binary transmit falls in exactly one typed span
 */
const assert=require('assert/strict');
function cubeGeometry(r){
  const m=new Map(r.nodes.map(n=>[n.index,n])),faces=r.nodes.filter(n=>n.type===14),verts=r.nodes.filter(n=>n.type===18),edges=r.nodes.filter(n=>n.type===16);
  const points=verts.map(n=>m.get(n.values.point).values.pvec),bounds=[0,1,2].map(a=>[Math.min(...points.map(p=>p[a])),Math.max(...points.map(p=>p[a]))]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  let volume=0,maxPlaneResidual=0,minOrientation=Infinity;const loops=[];
  for(const face of faces){const plane=m.get(face.values.surface),loop=m.get(face.values.loop);assert.equal(plane.type,50);assert.equal(loop.values.next,0);let at=loop.values.fin;const start=at,vs=[];do{const fin=m.get(at);vs.push(m.get(m.get(fin.values.vertex).values.point).values.pvec);at=fin.values.forward;assert(vs.length<100);}while(at!==start);
    assert.equal(vs.length,4);loops.push({face:face.index,loop:loop.index,vertices:vs});const normal=plane.values.normal.map(x=>x*(face.values.sense===plane.values.sense?1:-1));let area=[0,0,0];
    for(let i=0;i<vs.length;i++){const c=cross(vs[i],vs[(i+1)%vs.length]);area=area.map((x,j)=>x+c[j]);maxPlaneResidual=Math.max(maxPlaneResidual,Math.abs(dot(vs[i].map((x,j)=>x-plane.values.pvec[j]),normal)));}
    minOrientation=Math.min(minOrientation,dot(area,normal));for(let i=1;i+1<vs.length;i++)volume+=dot(vs[0],cross(vs[i],vs[i+1]))/6;
  }
  assert.equal(faces.length,6);assert.equal(edges.length,12);assert.equal(verts.length,8);assert.equal(verts.length-edges.length+faces.length,2);assert(maxPlaneResidual<1e-12);assert(minOrientation>0);assert(Math.abs(volume-1e-6)<1e-15);assert.deepEqual(bounds,[[0,.01],[0,.01],[0,.01]]);
  return {faces:faces.length,edges:edges.length,vertices:verts.length,euler:2,volumeM3:volume,bounds,maxPlaneResidual,minOrientation,loops};
}
function compare(t,b){const tm=new Map(t.nodes.map(n=>[n.index,n])),differences=[];let maxFloatError=0;
  function eq(x,y,kind){if(['f','v','i','h','b'].includes(kind)){if(x===null&&Array.isArray(y)&&y.every(v=>v===null))return true;if(Array.isArray(x)&&Array.isArray(y))return x.length===y.length&&x.every((v,i)=>eq(v,y[i],kind));if(x===null||y===null)return x===y;maxFloatError=Math.max(maxFloatError,Math.abs(x-y));return Math.abs(x-y)<=3e-14*Math.max(1,Math.abs(x),Math.abs(y));}return JSON.stringify(x)===JSON.stringify(y);}
  for(const n of b.nodes){const a=tm.get(n.index);if(!a||a.type!==n.type){differences.push({index:n.index,kind:'node_type',text:a?.type,binary:n.type});continue;}for(const f of b.edits.find(e=>e.type===n.type).fields){if(!eq(a.values[f.name],n.values[f.name],f.kind))differences.push({index:n.index,type:n.name,field:f.name,text:a.values[f.name],binary:n.values[f.name]});}}
  return {differences,maxFloatError};
}
function coverage(r){const spans=r.spans;for(let i=1;i<spans.length;i++)assert.equal(spans[i-1].end,spans[i].start,'coverage gap/overlap');assert.equal(spans.at(-1).end,r.total);return {bannerBytes:spans[0].start,typedBytes:r.total-spans[0].start,totalBytes:r.total,ranges:spans.length};}
module.exports={cubeGeometry,compare,coverage};

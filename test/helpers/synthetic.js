'use strict';
/* Small B-rep models built by hand in the neutral form src/brep/native.js produces, for the
 * cases the corpus does not have: a cavity (void shell), two bodies, a surface of revolution and
 * an offset surface. Lengths in metres. */
const G=require('../../src/geom/eval');

function model(){
  let next=1;
  const vertices=new Map(),edges=new Map(),faces=[],bodies=[];
  const id=()=>next++;
  const vertex=p=>{const i=id();vertices.set(i,{id:i,p});return i;};
  const edge=(a,b,curve,sameSense=true)=>{const i=id();edges.set(i,{id:i,v:[a,b],curve,sameSense,tolerance:null,pcurves:[],tolerant:false});return i;};
  const line=(a,b)=>{const p=vertices.get(a).p,q=vertices.get(b).p;return edge(a,b,{type:'line',p,d:G.unit(G.sub(q,p))});};
  /* loop as [edge id, vertex the coedge starts at] */
  const face=(surface,loops,sameSense=true)=>{const i=id();
    faces.push({id:i,surface,sameSense,loops:loops.map(l=>({coedges:l.map(([e,from])=>({edge:e,sense:edges.get(e).v[0]===from}))}))});return i;};
  const body=shells=>bodies.push({id:id(),type:'solid',regions:[{type:'solid',shells:shells.map(f=>({faces:f,reversed:[]}))}]});
  /* Axis-aligned box. inward: normals point into the box (the walls of a cavity). top: replaces
   * the +z face's surface. */
  function box(lo,hi,{inward=false,top=null}={}){
    const c=[];for(let k=0;k<8;k++)c.push(vertex([k&1?hi[0]:lo[0],k&2?hi[1]:lo[1],k&4?hi[2]:lo[2]]));
    const E=new Map(),key=(a,b)=>Math.min(a,b)+'-'+Math.max(a,b);
    for(let a=0;a<8;a++)for(const bit of [1,2,4])if(!(a&bit))E.set(key(c[a],c[a|bit]),line(c[a],c[a|bit]));
    const ids=[];
    for(let k=0;k<3;k++)for(const side of [0,1]){
      const corners=[0,1,2,3,4,5,6,7].filter(i=>((i>>k)&1)===side).map(i=>c[i]);
      const n=[0,0,0];n[k]=(side?1:-1)*(inward?-1:1);
      const P=i=>vertices.get(i).p,ctr=G.mul(corners.reduce((s,i)=>G.add(s,P(i)),[0,0,0]),1/4),e1=G.sub(P(corners[0]),ctr);
      corners.sort((a,b)=>ang(a)-ang(b));
      function ang(i){const q=G.sub(P(i),ctr);return Math.atan2(G.dot(G.cross(e1,q),n),G.dot(e1,q));}
      const loop=corners.map((v,j)=>[E.get(key(v,corners[(j+1)%4])),v]);
      let surface={type:'plane',p:ctr,n,x:G.unit(e1)};
      if(top&&k===2&&side===1)surface=top(surface);
      ids.push(face(surface,[loop]));
    }
    return ids;
  }
  return {vertices,edges,faces,bodies,vertex,edge,line,face,body,box,N:()=>({source:'synthetic',unit:'m',vertices,edges,faces,bodies})};
}

/* 20 mm cube with a 10 mm cubic cavity: 7000 mm³. */
function cavity(){
  const m=model();
  m.body([m.box([0,0,0],[0.02,0.02,0.02]),m.box([0.005,0.005,0.005],[0.015,0.015,0.015],{inward:true})]);
  return {N:m.N(),volume:7000,solids:1};
}
/* Two separate bodies: a 10 mm cube and a 10 x 10 x 20 mm block: 3000 mm³. */
function twoBodies(){
  const m=model();
  m.body([m.box([0,0,0],[0.01,0.01,0.01])]);
  m.body([m.box([0.02,0,0],[0.03,0.01,0.02])]);
  return {N:m.N(),volume:3000,solids:2};
}
/* 10 mm cube whose top face lies on an offset of a plane 3 mm below it: 1000 mm³. */
function offsetTop(){
  const m=model();
  m.body([m.box([0,0,0],[0.01,0.01,0.01],{top:s=>({type:'offset',basis:{...s,p:G.sub(s.p,G.mul(s.n,0.003))},d:0.003})})]);
  return {N:m.N(),volume:1000,solids:1};
}
/* Half cylinder r = 5 mm, length 10 mm, whose curved face is a line spun half a turn about z:
 * π r² L / 2 mm³. */
function halfCylinder(){
  const m=model(),r=0.005,L=0.01;
  const A=m.vertex([r,0,0]),B=m.vertex([-r,0,0]),C=m.vertex([-r,0,L]),D=m.vertex([r,0,L]);
  const arc=(a,b,z)=>m.edge(a,b,{type:'circle',c:[0,0,z],n:[0,0,1],x:[1,0,0],r});
  const ab=arc(A,B,0),dc=arc(D,C,L),bc=m.line(B,C),da=m.line(D,A),bottom=m.line(A,B),topd=m.line(C,D);
  const spun={type:'spun',curve:{type:'line',p:[r,0,0],d:[0,0,1]},c:[0,0,0],a:[0,0,1],x:[1,0,0]};
  m.body([[
    m.face(spun,[[[ab,A],[bc,B],[dc,C],[da,D]]]),
    m.face({type:'plane',p:[0,0,0],n:[0,0,-1],x:[1,0,0]},[[[bottom,A],[ab,B]]]),
    m.face({type:'plane',p:[0,0,L],n:[0,0,1],x:[1,0,0]},[[[dc,D],[topd,C]]]),
    m.face({type:'plane',p:[0,0,L/2],n:[0,-1,0],x:[1,0,0]},[[[da,A],[topd,D],[bc,C],[bottom,B]]])
  ]]);
  return {N:m.N(),volume:Math.PI*25*10/2,solids:1};
}
module.exports={model,cavity,twoBodies,offsetTop,halfCylinder};

/* Split faces on periodic analytic surfaces the way SolidWorks' STEP export does.
 *
 * Parasolid faces on cylinders, cones, spheres and tori have no seam edge: a hole is one face
 * bounded by two circles. STEP readers want a seam, and SolidWorks' own STEP cuts such faces
 * along fixed parameter lines (checked on all 49 controlled models, docs/format/parasolid.md):
 *
 *   cylinder, cone, sphere   u = 0 and u = π   (u = 0 is the surface's x axis)
 *   torus                    u = 0, u = π, v = 0 and v = π
 *
 * and only where the face actually crosses one of those lines. Both u lines lie in the plane
 * through the axis that contains x; both torus v lines lie in the equatorial plane. So a face is
 * cut by one or two planes, and an edge of the face is split wherever it crosses them.
 *
 * Method: every edge of a periodic face is split at its plane crossings (an edge shared by two
 * such faces is split at the union of both sets). The face's parameter domain is cut into cells
 * of width π, each sub-edge falls in one cell, and each cell's region is rebuilt by walking the
 * sub-edges and, between them, the cell's boundary lines, which become new seam edges shared by
 * the neighbouring cells. Sides that collapse to a point (sphere poles, cone apex) give no edge.
 *
 * Input: a resolved model (src/brep/procedural.js): every edge has a 3D curve and the curve
 * parameters t0 -> t1 it runs over (t1 < t0 when it runs against the curve), v = [start, end]
 * or null for a closed edge without a vertex.
 * Output: the same shape of model with new edges, vertices and faces; every face gets
 * `source` (the native face id) and every edge `source` (the native edge id, or 'seam').
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTSplit).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../geom/eval'));
  else root.SLDPRTSplit=factory(root.SLDPRTGeom);
})(typeof self!=='undefined'?self:this,function(G){
'use strict';
const PI=Math.PI,TAU=2*PI;
const mod=(x,m)=>((x%m)+m)%m;
const PERIODIC={cylinder:1,cone:1,sphere:1,torus:1};

function edgePoint(e,f){return G.curvePoint(e.curve,e.t0+(e.t1-e.t0)*f);}
const closedCurve=c=>c.type==='circle'||c.type==='ellipse';

/* Planes whose crossings cut the surface. */
function cutPlanes(s){
  const y=G.cross(s.a,s.x);
  switch(s.type){
    case 'cylinder':case 'cone':return [{o:s.p,n:y}];
    case 'sphere':return [{o:s.c,n:y}];
    case 'torus':return [{o:s.c,n:y},{o:s.c,n:s.a}];
  }
  return [];
}
/* Fractions (0, 1) along edge e where it crosses plane P. An edge lying in the plane has none. */
function crossings(e,P){
  const c=e.curve,N=c.type==='bspline'?Math.max(64,c.ctrl.length*8):64;
  const f=k=>G.dot(G.sub(edgePoint(e,k),P.o),P.n),vals=[];
  for(let i=0;i<=N;i++)vals.push(f(i/N));
  if(Math.max(...vals.map(Math.abs))<1e-10)return [];
  const tol=1e-13,out=[];
  const bisect=(a,b)=>{let fa=f(a);for(let k=0;k<64;k++){const m=(a+b)/2,fm=f(m);if(fm===0)return m;if((fm<0)===(fa<0)){a=m;fa=fm;}else b=m;}return (a+b)/2;};
  for(let i=0;i<N;i++){
    const a=vals[i],b=vals[i+1];
    if((a>tol&&b<-tol)||(a<-tol&&b>tol))out.push(bisect(i/N,(i+1)/N));
    else if(i>0&&Math.abs(a)<=tol){const p=vals[i-1];if((p>tol&&b<-tol)||(p<-tol&&b>tol))out.push(bisect((i-1)/N,(i+1)/N));}
  }
  // a closed edge without a vertex can cross at its own start
  if(!e.v&&Math.abs(vals[0])<=1e-12){const a=vals[1],b=vals[N-1];if((a>tol&&b<-tol)||(a<-tol&&b>tol))out.push(0);}
  return out.filter(x=>x===0&&!e.v||x>1e-9&&x<1-1e-9);
}

/* Parameters on the analytic surface: u in [0, 2π), v (torus v in [0, 2π)). */
function uvOf(s,p){
  const r=G.surfaceInverse(s,p);
  return {u:mod(r.u,TAU),v:s.type==='torus'?mod(r.v,TAU):r.v};
}

function split(R,opts){
  opts=opts||{};
  let nextId=opts.firstId||1;
  for(const k of R.vertices.keys())nextId=Math.max(nextId,k+1);
  for(const k of R.edges.keys())nextId=Math.max(nextId,k+1);
  for(const f of R.faces)nextId=Math.max(nextId,f.id+1);
  const newId=()=>nextId++;
  const vertices=new Map(R.vertices),edges=new Map();
  const faceOf=new Map(R.faces.map(f=>[f.id,f]));

  // 1. split points per edge: union over the periodic faces that use it
  const cuts=new Map();
  for(const f of R.faces){if(!PERIODIC[f.surface.type])continue;
    const planes=cutPlanes(f.surface);
    for(const l of f.loops)for(const c of l.coedges){const e=R.edges.get(c.edge);
      const set=cuts.get(e.id)||[];for(const P of planes)for(const x of crossings(e,P))if(!set.some(y=>Math.abs(y-x)<1e-9))set.push(x);
      cuts.set(e.id,set);}}
  // 2. sub-edges
  const pieces=new Map();   // native edge id -> [sub-edge ids] in edge direction
  for(const e of R.edges.values()){
    // one crossing can be found twice: near both ends of a closed edge, or by two faces
    const xs=[];
    for(const x of (cuts.get(e.id)||[]).slice().sort((a,b)=>a-b)){const p=edgePoint(e,x);
      if(xs.some(y=>G.dist(edgePoint(e,y),p)<1e-9))continue;
      if(e.v&&(G.dist(p,vertices.get(e.v[0]).p)<1e-9||G.dist(p,vertices.get(e.v[1]).p)<1e-9))continue;
      if(!e.v&&!closedCurve(e.curve)&&G.dist(p,edgePoint(e,0))<1e-9)continue;   // the ring's own start
      xs.push(x);}
    const mk=(f0,f1,a,b)=>{const id=xs.length?newId():e.id;
      edges.set(id,{id,source:e.id,v:[a,b],curve:e.curve,t0:e.t0+(e.t1-e.t0)*f0,t1:e.t0+(e.t1-e.t0)*f1,sameSense:e.t1>e.t0,pcurves:e.pcurves,fit:e.fit});return id;};
    const vx=xs.map(x=>{const id=newId();vertices.set(id,{id,p:edgePoint(e,x),split:true});return id;});
    let ids;
    if(!e.v){
      if(xs.length&&closedCurve(e.curve)){ids=xs.map((x,i)=>i<xs.length-1?mk(x,xs[i+1],vx[i],vx[i+1]):mk(x,xs[0]+1,vx[i],vx[0]));}
      else{const id=newId();vertices.set(id,{id,p:edgePoint(e,0),ring:true});
        const all=[0,...xs,1],vs=[id,...vx,id];ids=[];for(let i=0;i<all.length-1;i++)ids.push(mk(all[i],all[i+1],vs[i],vs[i+1]));}
    }else{const all=[0,...xs,1],vs=[e.v[0],...vx,e.v[1]];ids=[];for(let i=0;i<all.length-1;i++)ids.push(mk(all[i],all[i+1],vs[i],vs[i+1]));}
    pieces.set(e.id,ids);
  }
  const expand=co=>{const ids=pieces.get(co.edge);return co.sense?ids.map(id=>({edge:id,sense:true})):ids.slice().reverse().map(id=>({edge:id,sense:false}));};

  // 3. faces
  const faces=[],seamKey=new Map(),stats={split:0,pieces:0,seams:0};
  for(const f of R.faces){
    const loops=f.loops.map(l=>l.coedges.length?{coedges:l.coedges.flatMap(expand)}:{coedges:[],vertex:l.vertex});
    if(!PERIODIC[f.surface.type]){faces.push({...f,source:f.id,loops});continue;}
    const parts=splitFace(f,loops);
    if(parts.length>1){stats.split++;stats.pieces+=parts.length;}
    parts.forEach((loops,i)=>faces.push({id:parts.length>1?newId():f.id,source:f.id,surface:f.surface,sameSense:f.sameSense,loops}));
  }
  // shells refer to native faces; map them to their pieces
  const bySource=new Map();for(const f of faces){if(!bySource.has(f.source))bySource.set(f.source,[]);bySource.get(f.source).push(f.id);}
  const bodies=(R.bodies||[]).map(b=>({...b,regions:b.regions.map(r=>({...r,shells:r.shells.map(s=>({...s,faces:s.faces.flatMap(id=>bySource.get(id)||[]),reversed:s.reversed.flatMap(id=>bySource.get(id)||[])}))}))}));
  stats.seams=[...edges.values()].filter(e=>e.source==='seam').length;
  return {...R,vertices,edges,faces,bodies,splitStats:stats};

  /* ---- one periodic face -> list of faces, each a list of loops ---- */
  function splitFace(f,loopsIn){
    const s=f.surface,torus=s.type==='torus';
    // walk with the material on the left of every coedge in (u, v)
    const rev=l=>({coedges:l.coedges.slice().reverse().map(c=>({edge:c.edge,sense:!c.sense})),vertex:l.vertex});
    let loops=f.sameSense?loopsIn:loopsIn.map(rev);
    const vloops=loops.filter(l=>!l.coedges.length);loops=loops.filter(l=>l.coedges.length);
    const coStart=c=>{const e=edges.get(c.edge);return c.sense?e.v[0]:e.v[1];},coEnd=c=>{const e=edges.get(c.edge);return c.sense?e.v[1]:e.v[0];};
    const coPoint=(c,k)=>{const e=edges.get(c.edge);return edgePoint(e,c.sense?k:1-k);};

    // v extent of the cells
    let vmin,vmax,degLo=false,degHi=false;
    if(s.type==='sphere'){vmin=-PI/2;vmax=PI/2;degLo=degHi=true;}
    else if(s.type==='cone'){
      const vA=-s.r/Math.sin(s.angle);let side=0;
      for(const l of loops)for(const c of l.coedges){side+=Math.sign(uvOf(s,coPoint(c,0.5)).v-vA);}
      if(!loops.length)throw Error('split: cone face '+f.id+' without edges');
      if(side>=0){vmin=vA;vmax=Infinity;degLo=true;}else{vmin=-Infinity;vmax=vA;degHi=true;}
    }else if(s.type==='cylinder'){vmin=-Infinity;vmax=Infinity;}
    const cells=[];
    for(let i=0;i<2;i++)for(let j=0;j<(torus?2:1);j++)cells.push(torus?{i,j,u0:i*PI,u1:(i+1)*PI,v0:j*PI,v1:(j+1)*PI}:{i,j,u0:i*PI,u1:(i+1)*PI,v0:vmin,v1:vmax});
    const cellIndex=(u,v)=>{const i=Math.min(1,Math.floor(mod(u,TAU)/PI));if(!torus)return i;return i*2+Math.min(1,Math.floor(mod(v,TAU)/PI));};
    const local=(C,uv)=>{let u=uv.u,v=uv.v;
      if(C.u0===PI&&u<PI/2)u+=TAU;if(C.u0===0&&u>1.5*PI)u-=TAU;
      if(torus){if(C.v0===PI&&v<PI/2)v+=TAU;if(C.v0===0&&v>1.5*PI)v-=TAU;}
      return [u,v];};
    const ANG=1e-9;
    const nearLine=x=>{const k=mod(x,PI);return Math.min(k,PI-k)<ANG;};

    // classify sub-coedges
    for(const l of loops)for(const c of l.coedges){
      const m=uvOf(s,coPoint(c,0.5));
      let u=m.u,v=m.v;
      if(nearLine(u)||(torus&&nearLine(v))){  // lies on a cut line: the cell on its material side
        const a=uvOf(s,coPoint(c,0.45)),b=uvOf(s,coPoint(c,0.55));
        let du=b.u-a.u,dv=b.v-a.v;if(du>PI)du-=TAU;if(du<-PI)du+=TAU;if(torus){if(dv>PI)dv-=TAU;if(dv<-PI)dv+=TAU;}
        const L=Math.hypot(du,dv)||1;
        if(nearLine(u))u+=(-dv/L)*1e-6*(Math.abs(dv)>0?1:0)||0;
        if(torus&&nearLine(v))v+=(du/L)*1e-6;
      }
      c.cell=cellIndex(u,v);
    }
    // cell boundary: s in [0,4) counter-clockwise, bottom, right, top, left
    const F=(C,v)=>isFinite(C.v0)&&isFinite(C.v1)?(v-C.v0)/(C.v1-C.v0):isFinite(C.v0)?Math.atan((v-C.v0)/1e-3)*2/PI:isFinite(C.v1)?1+Math.atan((v-C.v1)/1e-3)*2/PI:0.5+Math.atan(v/1e-3)/PI;
    const sideTol=(C,uv)=>{const [u,v]=local(C,uv);
      if(Math.abs(u-C.u0)<1e-7)return 3+(1-F(C,v));
      if(Math.abs(u-C.u1)<1e-7)return 1+F(C,v);
      if(isFinite(C.v0)&&Math.abs(v-C.v0)<1e-7)return (u-C.u0)/(C.u1-C.u0);
      if(isFinite(C.v1)&&Math.abs(v-C.v1)<1e-7)return 2+(C.u1-u)/(C.u1-C.u0);
      return null;};
    const degenerate=k=>(k===0&&degLo)||(k===2&&degHi);
    const infinite=(C,k)=>(k===0&&!isFinite(C.v0))||(k===2&&!isFinite(C.v1));
    const cornerUV=(C,k)=>[[C.u0,C.v0],[C.u1,C.v0],[C.u1,C.v1],[C.u0,C.v1]][mod(k,4)];
    const corners=[];   // vertices at cell corners, poles and apex; a vertex loop there is reused
    for(const l of vloops)if(l.vertex)corners.push(l.vertex);
    const cornerVertex=(C,k)=>{const [u,v]=cornerUV(C,k),p=G.surfaceEval(s,u,v).p;
      let id=corners.find(i=>G.dist(vertices.get(i).p,p)<1e-9);
      if(id===undefined){id=newId();vertices.set(id,{id,p,corner:true});corners.push(id);}return id;};

    // chains and closed loops per cell
    const per=cells.map(()=>({chains:[],closed:[]}));
    for(const l of loops){
      const co=l.coedges,n=co.length;
      if(co.every(c=>c.cell===co[0].cell)){per[co[0].cell].closed.push(co);continue;}
      let k0=co.findIndex((c,i)=>co[(i+n-1)%n].cell!==c.cell);
      let run=[];
      for(let k=0;k<n;k++){const c=co[(k0+k)%n];if(run.length&&run[0].cell!==c.cell){per[run[0].cell].chains.push(run);run=[];}run.push(c);}
      per[run[0].cell].chains.push(run);
    }
    const seamsUsed=[];
    const out=[];      // [{outer: coedges, uv: polygon, holes:[]}]
    const polyOf=(C,co)=>{const pts=[];for(const c of co){const e=edges.get(c.edge);const n=e.curve.type==='line'?1:12;for(let k=0;k<n;k++)pts.push(local(C,uvOf(s,coPoint(c,k/n))));}return pts;};
    const area=pts=>{let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
    const covered=new Array(cells.length).fill(false);
    // walk the boundary of cell C from position sa (vertex va) to sb (vertex vb)
    function travel(C,ci,sa,va,sb,vb,co,pts){
      let d=mod(sb-sa,4);if(d<1e-12&&va===vb)return;
      if(d<1e-12)d=0;
      let cur=sa,curV=va;const end=sa+d;
      while(cur<end-1e-12){
        const k=Math.floor(cur+1e-12),stop=Math.min(end,k+1),last=stop>=end-1e-12;
        if(infinite(C,mod(k,4)))throw Error('split: face '+f.id+' boundary runs through infinity');
        const nv=last?vb:cornerVertex(C,k+1);
        if(!degenerate(mod(k,4))&&nv!==undefined){
          const pa=posOnSide(C,mod(k,4),cur-k),pb=posOnSide(C,mod(k,4),stop-k);
          const c=seam(C,mod(k,4),pa,pb,curV,nv);co.push(c);pts.push(pa,pb);
          seamsUsed.push({side:mod(k,4),C,lo:Math.min(pa[0],pb[0]),hi:Math.max(pa[0],pb[0]),vlo:Math.min(pa[1],pb[1]),vhi:Math.max(pa[1],pb[1])});
        }else pts.push(posOnSide(C,mod(k,4),cur-k),posOnSide(C,mod(k,4),stop-k));
        cur=stop;curV=nv;
      }
    }
    function posOnSide(C,k,t){
      const Finv=x=>isFinite(C.v0)&&isFinite(C.v1)?C.v0+x*(C.v1-C.v0):isFinite(C.v0)?C.v0+1e-3*Math.tan(x*PI/2):isFinite(C.v1)?C.v1+1e-3*Math.tan((x-1)*PI/2):1e-3*Math.tan((x-0.5)*PI);
      switch(k){case 0:return [C.u0+t*(C.u1-C.u0),C.v0];case 1:return [C.u1,Finv(t)];case 2:return [C.u1-t*(C.u1-C.u0),C.v1];case 3:return [C.u0,Finv(1-t)];}
    }
    function walkCell(ci){
      const C=cells[ci],ch=per[ci].chains.map(co=>({co,vs:coStart(co[0]),ve:coEnd(co[co.length-1]),ss:null,se:null}));
      for(const c of ch){
        c.ss=sideTol(C,uvOf(s,vertices.get(c.vs).p));c.se=sideTol(C,uvOf(s,vertices.get(c.ve).p));
        if(c.ss===null||c.se===null)throw Error('split: face '+f.id+' chain does not end on a cut line');
      }
      const used=new Set(),cycles=[];
      for(const c0 of ch){if(used.has(c0))continue;
        const co=[],pts=[];let c=c0,guard=0;
        for(;;){used.add(c);co.push(...c.co);pts.push(...polyOf(C,c.co));
          let best=null,bd=Infinity;
          for(const x of ch){if(used.has(x)&&x!==c0)continue;const d=mod(x.ss-c.se,4);const dd=d>4-1e-12?0:d;if(dd<bd){bd=dd;best=x;}}
          if(!best)throw Error('split: face '+f.id+' open chain');
          travel(C,ci,c.se,c.ve,best.ss,best.vs,co,pts);
          if(best===c0)break;c=best;if(++guard>1e4)throw Error('split: runaway walk');
        }
        cycles.push({co,pts});
      }
      return cycles;
    }
    function fullCycle(ci){const C=cells[ci],co=[],pts=[],v0=cornerVertex(C,0);travel(C,ci,0,v0,4-1e-13,v0,co,pts);
      // travel stops just short of 4: close the last side
      return {co,pts};}
    function seam(C,k,pa,pb,va,vb){
      // k 1/3: u = const, parameter v; k 0/2: v = const (torus only), parameter u
      const alongV=k===1||k===3,fix=alongV?pa[0]:pa[1],ta=alongV?pa[1]:pa[0],tb=alongV?pb[1]:pb[0];
      const lo=Math.min(ta,tb),hi=Math.max(ta,tb),vLo=ta<tb?va:vb,vHi=ta<tb?vb:va;
      const line=s.type==='cylinder'||s.type==='cone';
      const key=f.surface.node+'|'+s.type+'|'+(alongV?'u':'v')+mod(fix,TAU).toFixed(6)+'|'+vLo+'|'+vHi+(line?'':'|'+mod((lo+hi)/2,TAU).toFixed(3));
      let id=seamKey.get(key);
      if(id===undefined){id=newId();seamKey.set(key,id);
        edges.set(id,{id,source:'seam',v:[vLo,vHi],curve:seamCurve(s,alongV,fix),t0:lo,t1:hi,sameSense:true});}
      return {edge:id,sense:ta<tb};
    }
    for(let ci=0;ci<cells.length;ci++){
      if(per[ci].chains.length){covered[ci]=true;for(const c of walkCell(ci))out.push({ci,co:c.co,pts:c.pts,holes:[]});}
    }
    // cells without chains: covered when a hole sits in them, when the face has no edges at all,
    // or when a neighbour's walk ran along one of their sides
    const sideOf=(C,k)=>{switch(k){case 0:return {v:C.v0,lo:C.u0,hi:C.u1};case 2:return {v:C.v1,lo:C.u0,hi:C.u1};case 1:return {u:C.u1,lo:C.v0,hi:C.v1};case 3:return {u:C.u0,lo:C.v0,hi:C.v1};}};
    const touches=ci=>{const C=cells[ci];return seamsUsed.some(sg=>{const along=sg.side===1||sg.side===3;
      for(let k=0;k<4;k++){const sd=sideOf(C,k);if(degenerate(k))continue;
        if(along&&sd.u!==undefined&&Math.abs(mod(sd.u-sg.lo,TAU))<1e-9){const m=(sg.vlo+sg.vhi)/2;if(torus?mod(m-sd.lo,TAU)<PI:m>sd.lo&&m<sd.hi)return true;}
        if(!along&&sd.v!==undefined&&Math.abs(mod(sd.v-sg.vlo,TAU))<1e-9){const m=(sg.lo+sg.hi)/2;if(mod(m-sd.lo,TAU)<PI)return true;}}
      return false;});};
    for(let changed=true;changed;){changed=false;
      for(let ci=0;ci<cells.length;ci++){if(covered[ci]||per[ci].chains.length)continue;
        const holes=per[ci].closed.some(co=>area(polyOf(cells[ci],co))<0);
        if(holes||!loops.length||touches(ci)){covered[ci]=true;changed=true;const c=fullCycle(ci);out.push({ci,co:c.co,pts:c.pts,holes:[]});}}}
    // closed loops: counter-clockwise ones are regions of their own, clockwise ones are holes
    const holes=[];
    for(let ci=0;ci<cells.length;ci++)for(const co of per[ci].closed){const pts=polyOf(cells[ci],co);
      if(area(pts)>0)out.push({ci,co,pts,holes:[]});else holes.push({ci,co,pts});}
    for(const h of holes){
      let best=null;
      for(const o of out)if(o.ci===h.ci&&inside(h.pts[0],o.pts)&&(!best||Math.abs(area(o.pts))<Math.abs(area(best.pts))))best=o;
      if(!best)throw Error('split: face '+f.id+' hole in no region');
      best.holes.push(h.co);
    }
    for(const l of vloops)if(l.vertex&&!corners.includes(l.vertex))throw Error('split: face '+f.id+' has a vertex loop off the poles');
    const res=out.map(o=>[{coedges:o.co},...o.holes.map(co=>({coedges:co}))]);
    return f.sameSense?res:res.map(ls=>ls.map(l=>rev(l)).map(l=>({coedges:l.coedges})));
  }
  function seamCurve(s,alongV,fix){
    const y=G.cross(s.a,s.x),dir=u=>G.add(G.mul(s.x,Math.cos(u)),G.mul(y,Math.sin(u)));
    if(alongV){const d=dir(fix);
      switch(s.type){
        case 'cylinder':return {type:'line',p:G.add(s.p,G.mul(d,s.r)),d:s.a};
        case 'cone':return {type:'line',p:G.add(s.p,G.mul(d,s.r)),d:G.add(G.mul(d,Math.sin(s.angle)),G.mul(s.a,Math.cos(s.angle)))};
        case 'sphere':return {type:'circle',c:s.c,n:G.cross(d,s.a),x:d,r:s.r};
        case 'torus':return {type:'circle',c:G.add(s.c,G.mul(d,s.R)),n:G.cross(d,s.a),x:d,r:s.r};
      }}
    return {type:'circle',c:G.add(s.c,G.mul(s.a,s.r*Math.sin(fix))),n:s.a,x:s.x,r:s.R+s.r*Math.cos(fix)};
  }
}
function inside(p,poly){let w=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])w=!w;}return w;}

return {split,crossings,cutPlanes};
});

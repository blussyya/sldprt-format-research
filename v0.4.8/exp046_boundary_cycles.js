'use strict';
// EXP-046: reconstruct actual display-mesh boundary cycles from nonzero B1 edges,
// and measure cross-face sampling gaps without modifying geometry.
const C=require('./research-common');
const key=p=>p.join(',');
function loops(f){
  const adj=new Map();
  function add(a,b,e){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({other:b,id:e.token});}
  for(const e of C.edgeTokens(f).filter(e=>e.token!==0)){
    const a=key(C.vertex(f,e.ids[0])),b=key(C.vertex(f,e.ids[1]));add(a,b,e);add(b,a,e);
  }
  const bad=[...adj].filter(([,v])=>v.length!==2).map(([p,v])=>({point:p,degree:v.length}));
  if(bad.length)return {bad,cycles:[]};
  const visited=new Set(),cycles=[];
  for(const start of adj.keys())if(!visited.has(start)){
    let prev=null,cur=start;const points=[],ids=[];
    do{
      if(visited.has(cur))throw Error('cycle meets an already visited vertex');visited.add(cur);points.push(cur);
      const next=adj.get(cur).find(e=>e.other!==prev);ids.push(next.id);prev=cur;cur=next.other;
    }while(cur!==start);
    cycles.push({vertices:points.length,edgeIds:ids,points});
  }
  return {bad,cycles};
}
function pointSegment(p,a,b){const v=C.sub(b,a),w=C.sub(p,a),n=C.dot(v,v),t=n?Math.max(0,Math.min(1,C.dot(w,v)/n)):0;return C.norm(w.map((x,i)=>x-t*v[i]));}
function directed(a,b){let max=0;for(const [v,w]of a)for(const p of [v,w]){let best=Infinity;for(const [x,y]of b)best=Math.min(best,pointSegment(p,x,y));max=Math.max(max,best);}return max;}
function run(){
  const models=[];
  for(const file of C.corpus()){
    const m=C.read(file);if(!m.faces){models.push(m);continue;}
    const faces=m.faces.map((f,index)=>({index,offset:f.off,strips:f.sizes.length,...loops(f)}));
    const groups=new Map();
    m.faces.forEach((f,fi)=>{for(const e of C.edgeTokens(f).filter(e=>e.token!==0)){
      if(!groups.has(e.token))groups.set(e.token,new Map());const g=groups.get(e.token);
      if(!g.has(fi))g.set(fi,[]);g.get(fi).push(e.ids.map(i=>C.vertex(f,i)));
    }});
    const pairs=[];for(const [id,g]of groups){const owners=[...g.keys()];
      if(owners.length!==2){pairs.push({id,owners,status:'not-two-face-owners'});continue;}
      const [a,b]=[...g.values()];
      const segKeys=s=>new Set(s.map(e=>e.map(key).sort().join('|'))),ka=segKeys(a),kb=segKeys(b);
      const exact=ka.size===kb.size&&[...ka].every(k=>kb.has(k));
      pairs.push({id,owners,segments:[a.length,b.length],status:exact?'exact':'different-sampling',
        maxEndpointToOtherPolylineM:exact?0:Math.max(directed(a,b),directed(b,a))});
    }
    models.push({file:m.file,sha256:m.sha256,dlSha256:m.dlSha256,faces,pairs});
  }
  const f=models.flatMap(m=>m.faces||[]),pairs=models.flatMap(m=>m.pairs||[]),totals={faces:f.length,ambiguousFaces:f.filter(f=>f.bad.length).length,
    cycles:f.reduce((s,f)=>s+f.cycles.length,0),cycleEdges:f.reduce((s,f)=>s+f.cycles.reduce((n,c)=>n+c.vertices,0),0),
    pairStatuses:pairs.reduce((s,p)=>(s[p.status]=(s[p.status]||0)+1,s),{}),maxEndpointToOtherPolylineM:Math.max(...pairs.map(p=>p.maxEndpointToOtherPolylineM||0))};
  C.writeJSON('EXP046_RESULTS.json',{experiment:'EXP-046',date:'2026-09-14',method:'Exact-coordinate graph walks on nonzero B1 edges; no angular sorting, proximity welding, or outer/hole classification; endpoint-to-polyline distances are not continuous Hausdorff distances',totals,models});
  console.log(JSON.stringify(totals));
}
if(require.main===module)run();
module.exports={loops};

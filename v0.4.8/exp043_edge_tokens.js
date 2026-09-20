'use strict';
// EXP-043: test edge annotations against triangle incidence, without using tokens to match geometry.
const C=require('./research-common');
const pointKey=p=>p.map(x=>Object.is(x,-0)?0:x).join(',');
const edgeKey=(a,b)=>[pointKey(a),pointKey(b)].sort().join('|');
function experiment(m, mode) {
  const edges=new Map(), faceRows=[];
  let volume=0,area=0;
  for(let fi=0;fi<m.faces.length;fi++) {
    const f=m.faces[fi], local=new Map();
    const put=(key,kind,obj)=>{if(!local.has(key))local.set(key,{tri:[],annotations:[]});local.get(key)[kind].push(obj);};
    for(const t of C.triangles(f,mode)){
      volume+=C.dot(t.v[0],C.cross(t.v[1],t.v[2]))/6;
      area+=C.norm(C.cross(C.sub(t.v[1],t.v[0]),C.sub(t.v[2],t.v[0])))/2;
      for(let k=0;k<3;k++){const a=t.v[k],b=t.v[(k+1)%3],key=edgeKey(a,b);put(key,'tri',{direction:pointKey(a)<pointKey(b)?1:-1});}
    }
    for(const e of C.edgeTokens(f)){
      const a=C.vertex(f,e.ids[0]),b=C.vertex(f,e.ids[1]);put(edgeKey(a,b),'annotations',{token:e.token,slot:e.slot,strip:e.s});
    }
    const counts={boundary:0,interior:0,other:0,nonzeroBoundary:0,zeroBoundary:0,nonzeroInterior:0,zeroInterior:0,annotationsWithoutTriangle:0};
    const violations=[];
    for(const [key,e] of local){
      const n=e.tri.length;counts[n===1?'boundary':n===2?'interior':'other']++;
      for(const a of e.annotations){
        if(n===0)counts.annotationsWithoutTriangle++;
        else if(n===1)counts[a.token===0?'zeroBoundary':'nonzeroBoundary']++;
        else if(n===2)counts[a.token===0?'zeroInterior':'nonzeroInterior']++;
        if(a.token!==0&&n!==1)violations.push({key,triIncidence:n,...a});
      }
      if(!edges.has(key))edges.set(key,{owners:[],tri:[],tokens:[]});
      const g=edges.get(key);g.owners.push(fi);g.tri.push(...e.tri);g.tokens.push(...e.annotations.map(a=>({...a,face:fi})));
    }
    faceRows.push({index:fi,offset:f.off,counts,violations});
  }
  const incidence={},edgeTokenTable={},mismatches=[],openExamples=[];let orientationErrors=0;
  for(const [key,e] of edges){
    incidence[e.tri.length]=(incidence[e.tri.length]||0)+1;
    if(e.tri.length===2&&e.tri[0].direction===e.tri[1].direction)orientationErrors++;
    if(e.tri.length!==2&&openExamples.length<20)openExamples.push({key,...e});
    const nonzero=e.tokens.filter(a=>a.token!==0), labels=[...new Set(nonzero.map(a=>a.token))];
    if(labels.length>1)mismatches.push({key,owners:e.owners,labels});
    for(const label of labels){
      if(!edgeTokenTable[label])edgeTokenTable[label]={segments:0,faces:[],examples:[]};
      const row=edgeTokenTable[label];row.segments++;row.faces.push(...e.owners);
      if(row.examples.length<2)row.examples.push(key);
    }
  }
  for(const row of Object.values(edgeTokenTable))row.faces=[...new Set(row.faces)].sort((a,b)=>a-b);
  return {mode,areaM2:area,signedVolumeM3:volume,edgeIncidence:incidence,orientationErrors,
    labelMismatches:mismatches,openExamples,edgeTokenTable,faces:faceRows};
}
const models=[];
for(const file of C.corpus()){
  const m=C.read(file);if(!m.faces){models.push(m);continue;}
  const strip=experiment(m,'strip');
  // Fan is a deliberately wrong control on the controlled corpus.
  const fan=m.file.includes('/controlled/')?experiment(m,'fan'):null;
  models.push({file:m.file,sha256:m.sha256,dlSha256:m.dlSha256,strip,fan});
}
const totals={models:models.filter(m=>m.strip).length,faces:0,counts:{},labelMismatches:0,edgeIncidence:{},orientationErrors:0};
for(const m of models.filter(x=>x.strip)){
  const s=m.strip;totals.faces+=s.faces.length;totals.labelMismatches+=s.labelMismatches.length;totals.orientationErrors+=s.orientationErrors;
  for(const [k,v]of Object.entries(s.edgeIncidence))totals.edgeIncidence[k]=(totals.edgeIncidence[k]||0)+v;
  for(const f of s.faces)for(const [k,v]of Object.entries(f.counts))totals.counts[k]=(totals.counts[k]||0)+v;
}
C.writeJSON('EXP043_RESULTS.json',{experiment:'EXP-043',date:'2026-09-14',method:'Exact Float32-coordinate edge matching; no token-based geometry matching or tolerance welding',totals,models});
console.log(JSON.stringify(totals));for(const m of models.filter(x=>x.strip))console.log(m.file,JSON.stringify({edges:m.strip.edgeIncidence,labelMismatches:m.strip.labelMismatches.length,orientationErrors:m.strip.orientationErrors,tokenIDs:Object.keys(m.strip.edgeTokenTable).length,volume:m.strip.signedVolumeM3,fanEdges:m.fan?.edgeIncidence}));

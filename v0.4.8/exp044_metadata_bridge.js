'use strict';
// EXP-044: locate downstream surface/edge records independently of Block1 IDs.
const C=require('./research-common');
function candidates(dl,start,end) {
  const found=[];
  for(let off=start+28;off+72<=end;off++){
    const tag=dl.readUInt32LE(off);if(tag<4001||tag>4010)continue;
    const count=dl.readUInt32LE(off+68);
    if(count>10000||off+72+8*count>end)continue;
    const pairs=[];let ok=true;
    for(let i=0;i<count;i++){
      const id=dl.readUInt32LE(off+72+8*i),type=dl.readUInt32LE(off+76+8*i);
      // Broad observed type families, not label equality or expected edge count.
      if(!((type>=3000&&type<3100)||(type>=48000&&type<49600))){ok=false;break;}
      pairs.push({id,type});
    }
    if(!ok)continue;
    found.push({offset:off,relativeToB3End:off-start,tag,id:dl.readUInt32LE(off-28),
      direction:Array.from({length:3},(_,i)=>dl.readDoubleLE(off-24+8*i)),
      parameters:Array.from({length:8},(_,i)=>dl.readDoubleLE(off+4+8*i)),pairs,end:off+72+8*count});
  }
  return found;
}
const models=[];
for(const file of C.corpus()){
  const m=C.read(file);if(!m.faces){models.push(m);continue;}
  const rows=m.faces.map((f,i)=>{
    const end=m.faces[i+1]?.off||m.dl.length,c=candidates(m.dl,f.b3.end,end);
    const labels=[...new Set(C.edgeTokens(f).map(e=>e.token).filter(Boolean))].sort((a,b)=>a-b);
    for(const a of c){
      const ids=[...new Set(a.pairs.map(p=>p.id))].sort((a,b)=>a-b);
      a.idsEqualNonzeroTokens=JSON.stringify(ids)===JSON.stringify(labels);
      a.missing=labels.filter(x=>!ids.includes(x));a.extra=ids.filter(x=>!labels.includes(x));
    }
    return {index:i,offset:f.off,b3End:f.b3.end,boundaryLabels:labels,candidates:c};
  });
  models.push({file:m.file,sha256:m.sha256,dlSha256:m.dlSha256,faces:rows});
}
const rows=models.flatMap(m=>m.faces||[]),totals={faces:rows.length,uniqueCandidates:0,noCandidates:0,ambiguousCandidates:0,exactLabelSets:0,surfaceTags:{},edgeTypes:{},surfaceOffsetHistogram:{}};
for(const r of rows){if(!r.candidates.length)totals.noCandidates++;else if(r.candidates.length!==1)totals.ambiguousCandidates++;else{
  totals.uniqueCandidates++;const a=r.candidates[0];if(a.idsEqualNonzeroTokens)totals.exactLabelSets++;
  totals.surfaceTags[a.tag]=(totals.surfaceTags[a.tag]||0)+1;
  totals.surfaceOffsetHistogram[a.relativeToB3End]=(totals.surfaceOffsetHistogram[a.relativeToB3End]||0)+1;
  for(const p of a.pairs)totals.edgeTypes[p.type]=(totals.edgeTypes[p.type]||0)+1;
}}
C.writeJSON('EXP044_RESULTS.json',{experiment:'EXP-044',date:'2026-09-14',method:'Bounded byte scan for raw surface-tag and counted edge-pair schema; candidate selection never uses Block1 IDs; not a full metadata grammar',totals,models});
console.log(JSON.stringify(totals));for(const m of models.filter(m=>m.faces))console.log(m.file,JSON.stringify({faces:m.faces.length,unique:m.faces.filter(f=>f.candidates.length===1).length,matched:m.faces.filter(f=>f.candidates.length===1&&f.candidates[0].idsEqualNonzeroTokens).length}));
module.exports={candidates};

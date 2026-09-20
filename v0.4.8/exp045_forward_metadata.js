'use strict';
// EXP-045: replace EXP-044's signature scan with a forward metadata parse;
// independently compare controlled-corpus plane/cylinder records with STEP.
const fs=require('fs'),path=require('path'),C=require('./research-common');
const {parseSTEP,getRefs,getType,buildLookup,evalA2P3D}=require('../step-tools/step-parse');
function typed(dl,off,stride){
  if(off+16>dl.length)throw Error('truncated array header');
  const h=Array.from({length:4},(_,i)=>dl.readUInt32LE(off+i*4)),end=off+16+h[0]*h[3];
  if(h[0]!==stride||h[1]!==100||h[2]!==2||end>dl.length)throw Error('unexpected typed array '+off+' '+h);
  return {offset:off,header:h,end};
}
function forward(m,f){
  const b=m.dl,start=f.b3.end;
  // Prefix left opaque; only its observed length is used, no field meanings invented.
  const a8=typed(b,start+132,8),flag=b.readUInt32LE(a8.end),positions=typed(b,a8.end+4,12),normals=typed(b,positions.end,12);
  let off=normals.end;const scalarFlag=b.readUInt32LE(off);off+=4;
  const scalarArrays=[];
  if(scalarFlag===1){for(let i=0;i<2;i++){const a=typed(b,off,4);scalarArrays.push(a);off=a.end;}}
  else if(scalarFlag!==0)throw Error('unknown scalar flag');
  const unknownWords=Array.from({length:3},(_,i)=>b.readUInt32LE(off+i*4));off+=12;
  const id=b.readUInt32LE(off),direction=Array.from({length:3},(_,i)=>b.readDoubleLE(off+4+i*8));off+=28;
  const tag=b.readUInt32LE(off),parameters=Array.from({length:8},(_,i)=>b.readDoubleLE(off+4+i*8));
  const count=b.readUInt32LE(off+68);if(off+72+count*8>b.length)throw Error('edge table overflow');
  const pairs=Array.from({length:count},(_,i)=>({id:b.readUInt32LE(off+72+i*8),type:b.readUInt32LE(off+76+i*8)}));
  return {offset:off,end:off+72+count*8,relativeToB3End:off-start,tag,id,direction,parameters,pairs,
    a8,flag,positions,normals,scalarFlag,scalarArrays,unknownWords};
}
function stepSurfaces(file){
  const b=fs.readFileSync(file),text=b.toString('utf8');
  if(!/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\./.test(text))throw Error('Expected explicit mm STEP units');
  const ents=parseSTEP(text),lookup=buildLookup(ents),surfaces=[];
  for(const [id,entity]of Object.entries(ents)){
    const type=getType(entity);if(!['PLANE','CYLINDRICAL_SURFACE'].includes(type))continue;
    const ap=evalA2P3D(getRefs(entity)[0],lookup);if(!ap)throw Error('Missing STEP placement');
    // Parse trailing radius specifically, not the old getNumsAfterRefs heuristic.
    const radius=type==='CYLINDRICAL_SURFACE'?Number(entity.match(/,\s*([-+\d.Ee]+)\s*\)\s*$/)[1])*0.001:null;
    surfaces.push({id:Number(id),type,center:ap.center.map(x=>x*.001),axis:ap.normal,radius});
  }
  return {sha256:C.sha256(b),surfaces,faceCount:lookup.faces.length};
}
const radial=(v,c,a)=>{const d=C.sub(v,c),t=C.dot(d,a);return C.norm(d.map((x,i)=>x-t*a[i]));};
function compareSTEP(f,meta,step){
  const candidates=[];
  for(const s of step.surfaces){
    if((meta.tag===4001&&s.type!=='PLANE')||(meta.tag===4002&&s.type!=='CYLINDRICAL_SURFACE'))continue;
    if(![4001,4002].includes(meta.tag))continue;
    const axisError=1-Math.abs(C.dot(meta.direction,s.axis));
    let maxVertexResidual=0;
    for(let i=0;i<f.pos.h[3];i++){
      const v=C.vertex(f,i),d=meta.tag===4001?Math.abs(C.dot(C.sub(v,s.center),s.axis)):Math.abs(radial(v,s.center,s.axis)-s.radius);
      maxVertexResidual=Math.max(maxVertexResidual,d);
    }
    const radiusError=meta.tag===4002?Math.abs(meta.parameters[6]-s.radius):null;
    const axisLocationError=meta.tag===4002?radial(meta.parameters.slice(0,3),s.center,s.axis):null;
    if(axisError<1e-10&&maxVertexResidual<1e-7&&(radiusError===null||radiusError<1e-10)&&(axisLocationError===null||axisLocationError<1e-10))
      candidates.push({stepSurface:s.id,type:s.type,maxVertexResidual,axisError,radiusError,axisLocationError});
  }
  return candidates;
}
function run(){
  const models=[];
  for(const file of C.corpus()){
    const m=C.read(file);if(!m.faces){models.push(m);continue;}
    const sp=path.join(path.dirname(file),'model.step'),step=m.file.includes('/controlled/')?stepSurfaces(sp):null;
    const faces=m.faces.map((f,i)=>{
      let meta;try{meta=forward(m,f);}catch(e){return{index:i,offset:f.off,error:e.message};}
      const labels=[...new Set(C.edgeTokens(f).map(e=>e.token).filter(Boolean))].sort((a,b)=>a-b);
      const ids=[...new Set(meta.pairs.map(p=>p.id))].sort((a,b)=>a-b);
      return {index:i,offset:f.off,metadata:meta,checks:{withinFaceInterval:meta.end<=(m.faces[i+1]?.off||m.dl.length),
        idsEqualNonzeroTokens:JSON.stringify(labels)===JSON.stringify(ids),scalarCounts:meta.scalarArrays.every(a=>a.header[3]===f.pos.h[3])},
        stepMatches:step?compareSTEP(f,meta,step):null};
    });
    models.push({file:m.file,sha256:m.sha256,dlSha256:m.dlSha256,step:step?{file:path.relative(C.ROOT,sp),sha256:step.sha256,faceCount:step.faceCount}:null,faces});
  }
  const faces=models.flatMap(m=>m.faces||[]),totals={faces:faces.length,parseErrors:faces.filter(f=>f.error).length,
    checkFailures:faces.flatMap(f=>Object.entries(f.checks||{}).filter(([,v])=>!v).map(([check])=>({offset:f.offset,check}))),
    scalarFlagHistogram:{},surfaceTags:{},unknownWordTuples:{},stepFacesTested:0,stepFacesMatched:0};
  for(const f of faces.filter(x=>x.metadata)){const m=f.metadata;totals.scalarFlagHistogram[m.scalarFlag]=(totals.scalarFlagHistogram[m.scalarFlag]||0)+1;
    totals.surfaceTags[m.tag]=(totals.surfaceTags[m.tag]||0)+1;const k=m.unknownWords.join(',');totals.unknownWordTuples[k]=(totals.unknownWordTuples[k]||0)+1;
    if(f.stepMatches!==null){totals.stepFacesTested++;if(f.stepMatches.length)totals.stepFacesMatched++;}}
  C.writeJSON('EXP045_RESULTS.json',{experiment:'EXP-045',date:'2026-09-14',method:'Forward metadata parse, not signature search; exact parameter checks against independently exported STEP; bounds/flags and scalar-array meanings remain partially unknown',totals,models});
  console.log(JSON.stringify(totals));
}
if(require.main===module)run();
module.exports={forward};

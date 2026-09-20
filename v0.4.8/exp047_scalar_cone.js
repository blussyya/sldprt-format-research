'use strict';
// EXP-047: test scalar-coordinate hypotheses against serialized geometry.
// Internal geometric corroboration only; no independent STEP/CAD validation.
const fs=require('fs'),path=require('path'),C=require('./research-common');
const {forward}=require('./exp045_forward_metadata');
const TOL=1e-7;
function analyze(m,f,meta){
  const a=meta.direction,len=C.norm(a),axis=a.map(x=>x/len),o=meta.parameters.slice(0,3);
  const radius=meta.parameters[6],angle=meta.parameters[7];
  const h=[],rho=[],rad=[];
  for(let i=0;i<f.pos.h[3];i++){
    const d=C.sub(C.vertex(f,i),o),z=C.dot(d,axis),r=d.map((v,k)=>v-z*axis[k]);
    h.push(z);rho.push(C.norm(r));rad.push(r);
  }
  const error=fn=>Math.max(...rho.map((r,i)=>Math.abs(r-fn(h[i]))));
  const out={axisNorm:len,vertices:h.length,radius,angle,
    coneMinus:error(z=>Math.abs(radius-z*Math.tan(angle))),
    conePlus:error(z=>Math.abs(radius+z*Math.tan(angle))),
    cylinder:error(()=>radius),
    apexDistance:C.norm(C.sub(meta.parameters.slice(3,6),o)),scalar:null};
  if(meta.scalarFlag){
    const values=meta.scalarArrays.map(ar=>Array.from({length:ar.header[3]},(_,i)=>m.dl.readFloatLE(ar.offset+16+4*i)));
    const angular=(u)=>{
      // Learn only phase/orientation from first two non-apex samples; test all others.
      const ids=rho.flatMap((r,i)=>r>1e-7?[i]:[]);if(ids.length<3)return null;
      const i0=ids[0],e=rad[i0].map(x=>x/rho[i0]),b=C.cross(axis,e);
      return [1,-1].map(sign=>{
        const residuals=ids.map(i=>{
          const theta=sign*(u[i]-u[i0]);
          return C.norm(rad[i].map((x,k)=>x-rho[i]*(Math.cos(theta)*e[k]+Math.sin(theta)*b[k])));
        });
        return {sign,tested:ids.length-1,maxResidual:Math.max(...residuals.slice(1))};
      });
    };
    out.scalar={finite:values.every(v=>v.every(Number.isFinite)),ranges:values.map(v=>[Math.min(...v),Math.max(...v)]),
      secondEqualsNegativeAxial:Math.max(...h.map((z,i)=>Math.abs(values[1][i]+z))),
      secondEqualsPositiveAxial:Math.max(...h.map((z,i)=>Math.abs(values[1][i]-z))),
      reversedSecondEqualsNegativeAxial:Math.max(...h.map((z,i)=>Math.abs(values[1][h.length-1-i]+z))),
      firstEqualsNegativeAxial:Math.max(...h.map((z,i)=>Math.abs(values[0][i]+z))),
      firstAngular:angular(values[0]),secondAngular:angular(values[1]),
      reversedFirstAngular:angular([...values[0]].reverse())};
  }
  return out;
}
function run(){
  const models=[],tags={};
  for(const file of C.corpus()){
    const m=C.read(file),row={file:m.file,sha256:m.sha256,dlSha256:m.dlSha256};
    if(!m.faces){models.push({...row,unsupported:m.unsupported});continue;}
    row.faces=[];
    m.faces.forEach((f,index)=>{
      const meta=forward(m,f),t=tags[meta.tag]??={faces:0,scalarFaces:0};t.faces++;t.scalarFaces+=meta.scalarFlag;
      if(meta.tag===4003)row.faces.push({index,offset:f.off,metadataOffset:meta.offset,scalarFlag:meta.scalarFlag,parameters:meta.parameters,direction:meta.direction,...analyze(m,f,meta)});
    });models.push(row);
  }
  const faces=models.flatMap(m=>m.faces||[]),scalar=faces.filter(f=>f.scalar),pass=(a)=>a.filter(x=>x<=TOL).length;
  const totals={tags,coneFaces:faces.length,scalarConeFaces:scalar.length,toleranceMetres:TOL,
    coneMinusPass:pass(faces.map(f=>f.coneMinus)),conePlusPass:pass(faces.map(f=>f.conePlus)),cylinderPass:pass(faces.map(f=>f.cylinder)),
    negativeAxialPass:pass(scalar.map(f=>f.scalar.secondEqualsNegativeAxial)),positiveAxialPass:pass(scalar.map(f=>f.scalar.secondEqualsPositiveAxial)),
    angularPass:pass(scalar.map(f=>Math.min(...f.scalar.firstAngular.map(x=>x.maxResidual)))),
    swappedAngularPass:pass(scalar.map(f=>Math.min(...f.scalar.secondAngular.map(x=>x.maxResidual)))),
    reversedAngularPass:pass(scalar.map(f=>Math.min(...f.scalar.reversedFirstAngular.map(x=>x.maxResidual))))};
  const out={experiment:'EXP-047',date:'2026-09-15',method:'Geometric cone residual and scalar angular/axial mapping with swapped/sign/reversed controls; shared decoder, internal evidence only',scriptSha256:C.sha256(fs.readFileSync(__filename)),dependencies:['research-common.js','exp045_forward_metadata.js'].map(p=>({path:p,sha256:C.sha256(fs.readFileSync(path.join(__dirname,p)))})),totals,models};
  C.writeJSON('EXP047_RESULTS.json',out);console.log(JSON.stringify(totals,null,2));
}
if(require.main===module)run();
module.exports={analyze};

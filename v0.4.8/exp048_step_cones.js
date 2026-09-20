'use strict';
// EXP-048: independently exported STEP cone parameters versus SLDPRT tag 4003.
const fs=require('fs'),path=require('path'),C=require('./research-common');
const {forward}=require('./exp045_forward_metadata');
const {parseSTEP,getType,getRefs,buildLookup,evalA2P3D}=require('../step-tools/step-parse');
const relative='test files original/usb hub case (ultimate test)/USB hub case BOTTOM';
function run(){
  const m=C.read(path.join(C.ROOT,relative+'.SLDPRT'));
  const stepFile=relative+' ORIGINAL.STEP',raw=fs.readFileSync(path.join(C.ROOT,stepFile)),txt=raw.toString('utf8');
  if(!/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\./.test(txt)||!/SI_UNIT\s*\(\s*\$\s*,\s*\.RADIAN\./.test(txt))throw Error('Expected explicit millimetres/radians');
  const ents=parseSTEP(txt),lookup=buildLookup(ents),cones=[];
  for(const [id,s]of Object.entries(ents))if(getType(s)==='CONICAL_SURFACE'){
    const tail=s.match(/#\d+\s*,\s*([-+\d.Ee]+)\s*,\s*([-+\d.Ee]+)\s*\)$/);if(!tail)throw Error('Cone parameters '+id);
    const p=evalA2P3D(getRefs(s)[0],lookup);if(!p)throw Error('Cone placement '+id);
    const origin=p.center.map(v=>v*.001),axis=p.normal.map(v=>v/C.norm(p.normal)),radius=Number(tail[1])*.001,angle=Number(tail[2]);
    if(!Number.isFinite(radius)||!Number.isFinite(angle))throw Error('Nonfinite parameters');
    cones.push({id:Number(id),origin,axis,radius,angle,apex:origin.map((v,i)=>v-axis[i]*radius/Math.tan(angle))});
  }
  const rows=[];
  m.faces.forEach((f,index)=>{
    const meta=forward(m,f);if(meta.tag!==4003)return;
    const axis=meta.direction.map(v=>v/C.norm(meta.direction)),origin=meta.parameters.slice(0,3),apex=meta.parameters.slice(3,6),radius=meta.parameters[6],angle=meta.parameters[7];
    const candidates=cones.map(s=>{
      let residual=0;
      for(let i=0;i<f.pos.h[3];i++){
        const d=C.sub(C.vertex(f,i),s.origin),h=C.dot(d,s.axis),rho=C.norm(d.map((v,k)=>v-h*s.axis[k]));
        residual=Math.max(residual,Math.abs(rho-Math.abs(s.radius+h*Math.tan(s.angle))));
      }
      const errors={vertexResidual:residual,axis:1-Math.abs(C.dot(axis,s.axis)),angle:Math.abs(angle-s.angle),apex:C.norm(C.sub(apex,s.apex))};
      return {stepSurface:s.id,...errors,pass:residual<1e-7&&errors.axis<1e-10&&errors.angle<1e-10&&errors.apex<1e-10};
    });
    rows.push({index,offset:f.off,metadataOffset:meta.offset,vertices:f.pos.h[3],origin,axis,radius,angle,apex,
      apexEquationError:C.norm(C.sub(apex,origin.map((v,i)=>v+axis[i]*radius/Math.tan(angle)))),candidates});
  });
  const totals={facesTested:rows.length,stepCones:cones.length,facesMatched:rows.filter(r=>r.candidates.some(c=>c.pass)).length,
    unambiguousFaces:rows.filter(r=>r.candidates.filter(c=>c.pass).length===1).length,
    metadataMatchedFaces:rows.filter(r=>r.candidates.some(c=>c.axis<1e-10&&c.angle<1e-10&&c.apex<1e-10)).length,
    maxMatchedVertexResidual:Math.max(...rows.flatMap(r=>r.candidates.filter(c=>c.pass).map(c=>c.vertexResidual))),
    maxMatchedApexError:Math.max(...rows.flatMap(r=>r.candidates.filter(c=>c.pass).map(c=>c.apex))),
    maxApexEquationError:Math.max(...rows.map(r=>r.apexEquationError))};
  const output={experiment:'EXP-048',date:'2026-09-15',method:'All candidate STEP CONICAL_SURFACE entities compared using analytic cone residual, axis, angle and apex; no token or face-index correspondence',
    scope:'One independently exported USB-hub model; geometry of both cone nappes via absolute radius, not trim topology or oriented B-rep validation',
    scriptSha256:C.sha256(fs.readFileSync(__filename)),dependencies:['research-common.js','exp045_forward_metadata.js','../step-tools/step-parse.js'].map(p=>({path:p,sha256:C.sha256(fs.readFileSync(path.join(__dirname,p)))})),
    source:{file:m.file,sha256:m.sha256,dlSha256:m.dlSha256},step:{file:stepFile,sha256:C.sha256(raw),units:'mm/radian',cones},totals,rows};
  C.writeJSON('EXP048_RESULTS.json',output);console.log(JSON.stringify(totals,null,2));
}
if(require.main===module)run();

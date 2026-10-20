/* Exact STEP from a parsed Parasolid body: native -> resolve -> split -> write.
 *
 *   toSTEP(parsed, opts) -> {text, report}
 *
 * parsed is src/parasolid/xt.js output (readBrep(...).parsed). opts as src/step/write.js, plus
 * tolerance (m, default 1e-8) for fitted geometry. The file's uncertainty is 1e-5 mm, or the
 * largest fit error when that is bigger.
 *
 * Isomorphic: loads in Node and as a plain browser script (global SLDPRTStepExport).
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../brep/native'),require('../brep/procedural'),require('../brep/split'),require('./write'));
  else root.SLDPRTStepExport=factory(root.SLDPRTNative,root.SLDPRTProcedural,root.SLDPRTSplit,root.SLDPRTStepWrite);
})(typeof self!=='undefined'?self:this,function(Native,Procedural,Split,Write){
'use strict';
function toSTEP(parsed,opts){
  opts=opts||{};
  const N=Native.build(parsed),R=Procedural.resolve(N,opts),M=Split.split(R);
  const fitMM=R.report.maxError*1000;
  const uncertainty=Math.max(opts.uncertainty||1e-5,niceUp(fitMM));
  const text=Write.write(M,{...opts,uncertainty});
  const st={};for(const f of M.faces)st[f.surface.type]=(st[f.surface.type]||0)+1;
  return {text,report:{...R.report,uncertaintyMM:uncertainty,nativeFaces:N.faces.length,faces:M.faces.length,surfaces:st,edges:M.edges.size,vertices:M.vertices.size,bodies:M.bodies.length,split:M.splitStats}};
}
/* 1, 2 or 5 times a power of ten, at or above x */
function niceUp(x){if(!(x>0))return 0;const e=Math.pow(10,Math.floor(Math.log10(x)));for(const m of [1,2,5,10])if(m*e>=x*(1-1e-12))return m*e;return 10*e;}
return {toSTEP,niceUp};
});

/* Exact STEP from a local .SLDPRT, away from the UI thread. Same code as the CLI's convert. */
importScripts('../src/inflate.js','../src/container/modern.js','../src/container/ole.js','../src/parasolid/xt.js',
  '../src/parasolid/partition.js','../src/geom/eval.js','../src/brep/native.js','../src/brep/fit.js',
  '../src/brep/procedural.js','../src/brep/split.js','../src/step/write.js','../src/step/export.js');
onmessage=function(event){
  try{
    const d=event.data,parsed=SLDPRTPartition.readBody(new Uint8Array(d.bytes)).parsed;
    const r=SLDPRTStepExport.toSTEP(parsed,{name:d.name});
    postMessage({text:r.text,report:r.report});
  }catch(error){postMessage({error:error.message});}
};

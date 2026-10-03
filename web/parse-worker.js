/* Parse untrusted local files away from the UI thread. Parent can terminate us. */
importScripts('../src/container/modern.js','../src/container/ole.js','../src/display.js','../src/inflate.js');
onmessage=function(event){
  try{
    const parsed=SLDPRTDisplay.parseSLDPRT(new Uint8Array(event.data),SLDPRTInflate.inflateRaw,SLDPRTInflate.inflate);
    if((parsed.stats?.triangles||0)>300000)throw Error('Model exceeds the browser limit of 300,000 triangles; use the CLI');
    // Viewer needs geometry and diagnostic summaries, not copies of every opaque field.
    for(const f of parsed.faces){delete f.legacyTail;delete f.block1;delete f.block2;delete f.block3;delete f.boundaryCycles;delete f.metadata;if(f.bounds)delete f.bounds.raw;}
    postMessage({parsed});
  }catch(error){postMessage({error:error.message});}
};

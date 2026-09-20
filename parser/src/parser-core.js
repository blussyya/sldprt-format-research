/* Read-only modern DisplayLists parser, based on EXP-042 through EXP-045.
 * Container extraction is reused unchanged from v0.1; it is NOT newly validated.
 * Geometry uses serialized strip lengths and edge annotations, never fan/loop guesses.
 * Unknown fields remain raw. No B-rep reconstruction, welding, healing, or writer.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../../v0.1/src/parser-core'));
  else root.SLDPRTParserV2=factory(root.SLDPRTParser);
})(typeof self!=='undefined'?self:this,function(container){
  'use strict';
  function reader(input){
    const b=input instanceof Uint8Array?input:new Uint8Array(input),d=new DataView(b.buffer,b.byteOffset,b.byteLength);
    function bound(o,n){if(!Number.isSafeInteger(o)||!Number.isSafeInteger(n)||o<0||n<0||o+n>b.length)throw Error('Out of bounds at '+o);}
    const u=o=>(bound(o,4),d.getUint32(o,true));
    const f64=o=>(bound(o,8),d.getFloat64(o,true));
    function arr(o,stride,kind){
      bound(o,16);const h=[u(o),u(o+4),u(o+8),u(o+12)];
      if(h[0]!==stride||h[1]!==kind||h[2]!==2)throw Error('Unexpected array header at '+o);
      const bytes=stride*h[3];bound(o+16,bytes);return {offset:o,header:h,end:o+16+bytes};
    }
    const words=a=>Array.from({length:a.header[3]},(_,i)=>u(a.offset+16+4*i));
    function floats(a){
      const n=a.header[0]*a.header[3]/4,out=new Float32Array(n);
      for(let i=0;i<n;i++){out[i]=d.getFloat32(a.offset+16+4*i,true);if(!Number.isFinite(out[i]))throw Error('Nonfinite float at '+(a.offset+16+4*i));}
      return out;
    }
    return {b,d,bound,u,f64,arr,words,floats};
  }
  function metadata(r,start,limit){
    const a8=r.arr(start+132,8,100),flag=r.u(a8.end),positions=r.arr(a8.end+4,12,100),normals=r.arr(positions.end,12,100);
    let o=normals.end,scalarFlag=r.u(o);o+=4;const scalarArrays=[];
    if(scalarFlag===1)for(let i=0;i<2;i++){const a=r.arr(o,4,100);scalarArrays.push({offset:o,values:r.floats(a)});o=a.end;}
    else if(scalarFlag!==0)throw Error('Unknown optional-scalar flag at '+(o-4));
    const reserved=[r.u(o),r.u(o+4),r.u(o+8)];o+=12;
    const rawId=r.u(o),direction=[r.f64(o+4),r.f64(o+12),r.f64(o+20)];o+=28;
    const typeTag=r.u(o),parameters=Array.from({length:8},(_,i)=>r.f64(o+4+i*8)),count=r.u(o+68);
    r.bound(o+72,count*8);const end=o+72+count*8;if(end>limit)throw Error('Metadata overlaps next geometry record');
    const edgeRecords=Array.from({length:count},(_,i)=>({id:r.u(o+72+i*8),typeTag:r.u(o+76+i*8)}));
    return {offset:o,end,rawId,typeTag,direction,parameters,edgeRecords,
      opaquePrefixRange:[start,start+132],auxiliaryArrays:[a8,positions,normals].map(a=>({...a,raw:r.b.slice(a.offset+16,a.end)})),auxiliaryFlag:flag,scalarFlag,scalarArrays,reserved};
  }
  function extractDisplayLists(input){
    const r=reader(input),faces=[],rejected=[],warnings=[];
    const sig=new Uint8Array([4,0,0,0,8,0,0,0,2,0,0,0]);
    for(const off of container.findAll(r.b,sig)){
      let pre,pos;
      try{pre=r.arr(off,4,8);pos=r.arr(pre.end,12,100);}catch(e){continue;}
      try{
        const normals=r.arr(pos.end,12,100),b1=r.arr(normals.end,4,8),b2=r.arr(b1.end,4,8),b3=r.arr(b2.end,1,8);
        const stripLengths=r.words(pre),tokens=r.words(b1),lengths=r.words(b2),vc=pos.header[3];
        if(!stripLengths.length||stripLengths.some(n=>n<3)||stripLengths.reduce((a,b)=>a+b,0)!==vc)throw Error('Invalid strip-length partition');
        if(normals.header[3]!==vc||lengths.length!==stripLengths.length)throw Error('Array count mismatch');
        if(stripLengths.some((n,i)=>lengths[i]!==2*n-2)||lengths.reduce((a,b)=>a+b,0)!==tokens.length)throw Error('Invalid Block1/Block2 lengths');
        if(b3.header[3]!==tokens.length)throw Error('Block3 count mismatch');
        const vertices=r.floats(pos),ns=r.floats(normals);
        for(let i=0;i<ns.length;i+=3)if(Math.abs(Math.hypot(ns[i],ns[i+1],ns[i+2])-1)>0.001)throw Error('Invalid normal');
        const indices=[],edgeAnnotations=[],controls=[];let v=0,t=0;
        stripLengths.forEach((n,s)=>{
          const control=tokens[t++];if(control!==1)throw Error('Unsupported strip control');controls.push(control);
          const add=(a,b)=>edgeAnnotations.push({strip:s,vertices:[a,b],tokenOffset:b1.offset+16+4*t,id:tokens[t++]});
          add(v,v+1);
          for(let i=2;i<n;i++){
            indices.push(...(i%2===0?[v+i-2,v+i-1,v+i]:[v+i-1,v+i-2,v+i]));
            add(v+i-2,v+i);add(v+i-1,v+i);
          }
          v+=n;
        });
        const bytes=r.b.slice(b3.offset+16,b3.end);
        if(bytes.some(x=>x!==0))warnings.push({offset:b3.offset,message:'Block3 contains nonzero bytes; semantics unvalidated'});
        faces.push({offset:off,geometryEnd:b3.end,offsets:{stripLengths:pre.offset,positions:pos.offset,normals:normals.offset,block1:b1.offset,block2:b2.offset,block3:b3.offset},
          vertexCount:vc,stripLengths,vertices,normals:ns,triangleIndices:new Uint32Array(indices),stripControls:controls,
          edgeAnnotations,block1:new Uint32Array(tokens),block2:new Uint32Array(lengths),block3:bytes,
          boundaryCycles:null,boundaryError:null,metadata:null,metadataError:null});
      }catch(e){rejected.push({offset:off,reason:e.message});}
    }
    for(let i=0;i<faces.length;i++){
      const f=faces[i];
      try{f.boundaryCycles=boundaryCycles(f);}catch(e){f.boundaryError=e.message;warnings.push({offset:f.offset,message:e.message});}
      try{
        const meta=metadata(r,f.geometryEnd,faces[i+1]?.offset||r.b.length);
        const labels=[...new Set(f.edgeAnnotations.map(e=>e.id).filter(x=>x!==0))].sort((a,b)=>a-b);
        const ids=[...new Set(meta.edgeRecords.map(e=>e.id))].sort((a,b)=>a-b);
        if(JSON.stringify(labels)!==JSON.stringify(ids))throw Error('Metadata edge labels disagree with Block1');
        if(meta.scalarArrays.some(a=>a.values.length!==f.vertexCount))throw Error('Optional scalar count mismatch');
        f.metadata=meta;
        if(meta.reserved.some(x=>x!==0)||meta.auxiliaryFlag!==1||meta.auxiliaryArrays.some(a=>a.header[3]!==0))
          warnings.push({offset:meta.offset,message:'Unvalidated metadata auxiliary values retained raw'});
      }catch(e){f.metadataError=e.message;warnings.push({offset:f.geometryEnd,message:e.message});}
    }
    return {faces,rejected,warnings,stats:{faces:faces.length,triangles:faces.reduce((s,f)=>s+f.triangleIndices.length/3,0),metadataFaces:faces.filter(f=>f.metadata).length}};
  }
  function boundaryCycles(f){
    // These are display-mesh boundary cycles, with arbitrary traversal direction.
    // Coincidence uses exact stored coordinates; no B-rep seam or outer/hole claims.
    const adj=new Map();
    function node(i){const k=[f.vertices[i*3],f.vertices[i*3+1],f.vertices[i*3+2]].join(',');if(!adj.has(k))adj.set(k,{vertex:i,edges:[]});return k;}
    for(const e of f.edgeAnnotations)if(e.id!==0){const a=node(e.vertices[0]),b=node(e.vertices[1]);adj.get(a).edges.push({to:b,id:e.id});adj.get(b).edges.push({to:a,id:e.id});}
    if([...adj.values()].some(n=>n.edges.length!==2))throw Error('Ambiguous boundary graph; cycles not inferred');
    const seen=new Set(),cycles=[];
    for(const start of adj.keys())if(!seen.has(start)){
      let prev=null,cur=start;const vertices=[],edgeIds=[];
      do{if(seen.has(cur))throw Error('Boundary traversal intersects an existing cycle');seen.add(cur);
        const n=adj.get(cur),e=n.edges.find(e=>e.to!==prev);vertices.push(n.vertex);edgeIds.push(e.id);prev=cur;cur=e.to;
      }while(cur!==start);
      cycles.push({vertices,edgeIds});
    }
    return cycles;
  }
  function parseSLDPRT(input,inflateRaw,inflateZlib){
    if(container.isOLE2(input))return {format:'OLE2',faces:[],errors:['Legacy OLE2 is not supported'],warnings:[],rejected:[]};
    try{
      const dl=container.findDisplayLists(input,inflateRaw,inflateZlib);
      if(!dl)throw Error('No readable modern DisplayLists stream');
      return {format:'modern DisplayLists',displayListsLength:dl.length,errors:[],...extractDisplayLists(dl)};
    }catch(e){return {format:'unknown',faces:[],errors:[e.message],warnings:[],rejected:[]};}
  }
  return {parseSLDPRT,extractDisplayLists};
});

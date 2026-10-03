/* Bounded, read-only CFB/OLE2 stream extraction (legacy SLDPRT). No external dependencies.
 * Moved verbatim from parser/v0.3/src/ole-reader.js. See docs/format/container.md. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SLDPRTOLE=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const END=0xfffffffe,FREE=0xffffffff,MAX=128*1024*1024;
  function read(input){
    const b=input instanceof Uint8Array?input:new Uint8Array(input),d=new DataView(b.buffer,b.byteOffset,b.byteLength);
    function check(o,n){if(!Number.isSafeInteger(o)||!Number.isSafeInteger(n)||o<0||n<0||o+n>b.length)throw Error('Truncated OLE structure');}
    const u=o=>(check(o,4),d.getUint32(o,true)),h=o=>(check(o,2),d.getUint16(o,true));
    check(0,512);if(![208,207,17,224,161,177,26,225].every((x,i)=>b[i]===x))throw Error('Invalid OLE signature');
    const version=h(26),shift=h(30);if(h(28)!==0xfffe||!((version===3&&shift===9)||(version===4&&shift===12))||h(32)!==6||u(56)!==4096)throw Error('Unsupported OLE header');
    const ss=2**shift,sectors=Math.floor(b.length/ss)-1;
    function sector(i){if(!Number.isInteger(i)||i<0||i>=sectors)throw Error('Invalid OLE sector');return b.subarray((i+1)*ss,(i+2)*ss);}
    function words(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return Array.from({length:bytes.length/4},(_,i)=>v.getUint32(i*4,true));}
    let ids=Array.from({length:109},(_,i)=>u(76+i*4)).filter(i=>i!==FREE),next=u(68);const seen=new Set();
    if(u(44)>sectors||u(72)>sectors)throw Error('Invalid OLE allocation counts');
    for(let i=0;i<u(72);i++){if(seen.has(next))throw Error('Cyclic DIFAT');seen.add(next);const w=words(sector(next));ids.push(...w.slice(0,-1).filter(x=>x!==FREE));next=w[w.length-1];}
    if(u(72)&&next!==END)throw Error('Invalid DIFAT terminator');
    if(ids.length!==u(44)||new Set(ids).size!==ids.length)throw Error('Invalid FAT sector list');
    const fat=[];for(const id of ids)fat.push(...words(sector(id)));
    function chain(start,table,get,unit,size){
      if(size!==undefined&&(!Number.isSafeInteger(size)||size<0||size>MAX))throw Error('OLE stream exceeds 128 MiB limit');
      if(size===0)return new Uint8Array();
      let i=start,total=0;const parts=[],visited=new Set();
      while(i!==END){if(!Number.isInteger(i)||i<0||i>=table.length||visited.has(i))throw Error('Invalid or cyclic OLE chain');visited.add(i);const p=get(i);if(p.length!==unit)throw Error('Truncated OLE sector');parts.push(p);total+=unit;if(total>MAX)throw Error('OLE chain exceeds limit');i=table[i];}
      if(size!==undefined&&(total<size||total-size>=unit))throw Error('OLE stream chain/size mismatch');
      const out=new Uint8Array(size===undefined?total:size);let at=0;for(const p of parts){const n=Math.min(p.length,out.length-at);out.set(p.subarray(0,n),at);at+=n;}return out;
    }
    const directory=chain(u(48),fat,sector,ss),entries=[];
    for(let o=0;o+128<=directory.length;o+=128){const v=new DataView(directory.buffer,directory.byteOffset+o,128),type=v.getUint8(66);if(type===0)continue;const len=v.getUint16(64,true);if(len<2||len>64||len%2)throw Error('Invalid OLE directory name');let name='';for(let k=0;k<len-2;k+=2)name+=String.fromCharCode(v.getUint16(k,true));const lo=v.getUint32(120,true),hi=version===4?v.getUint32(124,true):0;entries.push({name,type,start:v.getUint32(116,true),size:hi*4294967296+lo});}
    const roots=entries.filter(e=>e.type===5);if(roots.length!==1)throw Error('Invalid OLE root');const root=roots[0];
    let mini=null,mfat=null;
    function stream(e){
      if(e.type!==2)throw Error('Not an OLE stream');
      if(e.size===0)return new Uint8Array();
      if(e.size>=4096)return chain(e.start,fat,sector,ss,e.size);
      if(!mini){mini=chain(root.start,fat,sector,ss,root.size);mfat=words(chain(u(60),fat,sector,ss,u(64)*ss));}
      return chain(e.start,mfat,i=>mini.subarray(i*64,(i+1)*64),64,e.size);
    }
    return {entries,stream};
  }
  function displayLists(input,inflate){
    const ole=read(input),entries=ole.entries.filter(e=>e.type===2&&/^DisplayLists(?:__ZLB|__Zip)?$/.test(e.name));
    if(entries.length!==1)throw Error(entries.length?'Multiple legacy DisplayLists streams are unsupported':'No legacy DisplayLists stream');
    const e=entries[0],raw=ole.stream(e);
    if(e.name==='DisplayLists')return {bytes:raw,stream:e.name,compressed:false};
    // Pre-2011: PKWARE DCL implode, no frame (EXP-077)
    if(e.name==='DisplayLists__Zip'){
      const B=typeof SLDPRTBlast!=='undefined'?SLDPRTBlast:typeof require==='function'?require('./blast'):null;
      if(!B)throw Error('DisplayLists__Zip needs src/container/blast.js loaded');
      const z=B.blast(raw,{maxOutput:MAX});if(z.consumed!==raw.length)throw Error('DisplayLists__Zip: trailing bytes after the compressed stream');
      return {bytes:new Uint8Array(z.data.buffer,z.data.byteOffset,z.data.length),stream:e.name,compressed:true};
    }
    const magic=[35,29,213,113,218,129,72,162,168,88,152,178,27,137,239,153];
    if(raw.length<30||!magic.every((x,i)=>raw[i]===x))throw Error('Unsupported legacy DisplayLists wrapper');
    const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),size=d.getUint32(16,true),packed=d.getUint32(20,true);
    if(size>MAX||packed!==raw.length-32||raw.subarray(raw.length-8).some(x=>x!==0))throw Error('Invalid legacy compression lengths');
    const bytes=new Uint8Array(inflate(raw.subarray(24,24+packed)));
    if(bytes.length!==size)throw Error('Legacy decompressed length mismatch');
    return {bytes,stream:e.name,compressed:true};
  }
  return {read,displayLists,MAX_BYTES:MAX};
});

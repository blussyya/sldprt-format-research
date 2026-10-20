/* Parasolid partition streams inside a SLDPRT: section framing and body selection.
 *
 * Section frame (EXP-074; 242/242 sections, 70/70 Partition and 65/65 GhostPartition streams
 * chain exactly to their end):
 *
 *   u32le size | GUID 231dd571-da81-48a2-a858-98b21b89ef99 | u32le inflated | u32le compressed
 *   | zlib[compressed] | 8 zero bytes            with size = compressed + 32
 *
 * Config-N-Partition      = "(partition)" section, then a "(deltas)" section
 * Config-N-GhostPartition = one "(partition)" section
 * Config-0-FeatureBodies/LocalBodies (imported bodies) and Config-N-ResolvedFeatures carry the
 * same frame after a stream-specific prefix.
 *
 * Body selection: the first section of Config-0-Partition, unless it holds no FACE, in which case
 * the first section holding faces in any other GUID-bearing stream (PTC GE8080-8: LocalBodies).
 * That rule is what the corpus supports; it is not a general configuration/rollback model.
 *
 * Isomorphic: takes a Uint8Array (a Node Buffer is one) and loads in Node and as a plain browser
 * script (global SLDPRTPartition, after src/inflate.js, src/container/*.js and xt.js). Node
 * decompresses with zlib, the browser with src/inflate.js; pass {inflateRaw, inflate} as the
 * last argument to use another. Logic moved from the EXP-072 extractor and EXP-074 section walker.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports){
    const zlib=require('zlib'),MAX=128*1024*1024;
    module.exports=factory(require('../container/modern'),require('../container/ole'),require('./xt'),
      {inflateRaw:b=>zlib.inflateRawSync(b,{maxOutputLength:MAX}),inflate:b=>zlib.inflateSync(b,{maxOutputLength:MAX})});
  }else root.SLDPRTPartition=factory(root.SLDPRTModern,root.SLDPRTOLE,root.SLDPRTXT,root.SLDPRTInflate);
})(typeof self!=='undefined'?self:this,function(modern,OLE,xt,defaultCodec){
'use strict';
const {parse}=xt;
const GUID=new Uint8Array([0x23,0x1d,0xd5,0x71,0xda,0x81,0x48,0xa2,0xa8,0x58,0x98,0xb2,0x1b,0x89,0xef,0x99]);
const GUID_HEX='231dd571da8148a2a85898b21b89ef99';
const u8=b=>b instanceof Uint8Array?b:new Uint8Array(b);
const u32=(b,at)=>(b[at]|b[at+1]<<8|b[at+2]<<16|b[at+3]<<24)>>>0;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const latin1=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,Math.min(b.length,i+8192)));return s;};
/* first index of `pat` in b at or after `from`, or -1 */
function find(b,pat,from){
  for(let i=b.indexOf(pat[0],from||0);i>=0&&i+pat.length<=b.length;i=b.indexOf(pat[0],i+1)){
    let k=1;while(k<pat.length&&b[i+k]===pat[k])k++;if(k===pat.length)return i;}
  return -1;
}
const isGuid=(b,at)=>at>=0&&at+16<=b.length&&find(b.subarray(at,at+16),GUID,0)===0;

/* Every named stream as {name: Uint8Array}, for either container. */
function streams(raw,codec){
  raw=u8(raw);codec=codec||defaultCodec;
  if(modern.isOLE2(raw)){
    const o=OLE.read(raw),out={};
    for(const e of o.entries)try{out[e.name]=u8(o.stream(e));}catch(_){/* storage entries */}
    return out;
  }
  const s=modern.decompressOpenSX(raw,codec.inflateRaw,codec.inflate),out={};
  for(const k of Object.keys(s))out[k]=u8(s[k]);
  return out;
}

/* Walk a chain of sections starting at `pos`. Stops with `error` at the first frame that does not
 * validate; the sections read so far are returned. */
function sections(b,pos,codec){
  b=u8(b);codec=codec||defaultCodec;
  const out=[];
  while(pos<b.length){
    if(pos+28>b.length)return {out,error:`leftover ${b.length-pos}`};
    const size=u32(b,pos),inflated=u32(b,pos+20),compressed=u32(b,pos+24);
    if(!isGuid(b,pos+4))return {out,error:'guid'};
    if(size!==compressed+32)return {out,error:'size != compressed+32'};
    if(pos+28+compressed>b.length)return {out,error:'zlib'};
    let body;try{body=u8(codec.inflate(b.subarray(pos+28,pos+28+compressed)));}catch(_){return {out,error:'zlib'};}
    if(body.length!==inflated)return {out,error:'inflated length'};
    const head=latin1(body.subarray(0,64));
    const kind=(head.match(/TRANSMIT FILE(?: \((\w+)\))?/)||[])[1]||(/TRANSMIT FILE/.test(head)?'plain':'?');
    out.push({start:pos,kind,body,tail:hex(b.subarray(pos+28+compressed,pos+36+compressed))});
    pos+=4+size;
  }
  return {out,error:null};
}

/* The first payload of Config-0-Partition, exactly as the EXP-072 extractor reads it. */
function extractPrimary(raw,all,codec){
  raw=u8(raw);codec=codec||defaultCodec;let stream,name;
  if(modern.isOLE2(raw)){
    const o=OLE.read(raw),es=o.entries.filter(e=>e.name==='Config-0-Partition');
    if(es.length!==1)throw Error(`Expected one Config-0-Partition stream; found ${es.length}`);
    name=es[0].name;stream=u8(o.stream(es[0]));
  }else{
    const s=all||streams(raw,codec),keys=Object.keys(s).filter(k=>/Config-0-Partition$/.test(k));
    if(keys.length!==1)throw Error(`Expected one Config-0-Partition stream; found ${keys.length}`);
    name=keys[0];stream=s[name];
  }
  if(hex(stream.subarray(4,20))!==GUID_HEX)throw Error('Config-0-Partition does not start with the section GUID');
  // the frame gives the compressed length; the zlib stream ends exactly there (checked in
  // sections() on every Partition stream of the corpus)
  const compressed=u32(stream,24);
  return {name,stream,inner:u8(codec.inflate(stream.subarray(28,28+compressed))),compressedBytes:compressed};
}

/* Summary of every partition-bearing stream: section kinds, chain status. For `sldprt info`. */
function survey(raw,all,codec){
  all=all||streams(raw,codec);const rows=[];
  for(const [k,b] of Object.entries(all)){
    const g=find(b,GUID,0);if(g<4)continue;
    if(/Partition$/.test(k)){const w=sections(b,g-4,codec);rows.push({stream:k,bytes:b.length,prefix:g-4,sections:w.out.map(x=>({offset:x.start,kind:x.kind,bytes:x.body.length})),chain:w.error?'broken: '+w.error:'complete'});}
    else{
      const found=[];
      for(let h=g;h>=4;h=find(b,GUID,h+1)){
        const w=sections(b.subarray(0,h-4+4+u32(b,h-4)),h-4,codec);
        if(w.error||w.out.length!==1)continue;
        found.push({offset:w.out[0].start,kind:w.out[0].kind,bytes:w.out[0].body.length});
      }
      rows.push({stream:k,bytes:b.length,prefix:g-4,sections:found,chain:'embedded'});
    }
  }
  return rows;
}

/* The saved solid body, parsed. Returns {source, kind, parsed}; throws if no partition exists. */
function readBody(raw,options={},codec){
  raw=u8(raw);codec=codec||options.codec||defaultCodec;
  const all=streams(raw,codec);
  const primary=extractPrimary(raw,modern.isOLE2(raw)?null:all,codec);
  let parsed=parse(primary.inner,true,options),source=primary.name,kind='partition';
  if(!parsed.error&&!parsed.nodes.some(n=>n.type===14)){
    for(const [k,b] of Object.entries(all)){
      const g=find(b,GUID,0);if(g<4||/Partition$/.test(k))continue;
      for(const x of sections(b,g-4,codec).out){
        const q=parse(x.body,true,options);
        if(!q.error&&q.nodes.some(n=>n.type===14)){parsed=q;source=k;kind=x.kind;break;}
      }
      if(source!==primary.name)break;
    }
  }
  return {source,kind,parsed};
}

return {GUID,streams,sections,extractPrimary,survey,readBody};
});

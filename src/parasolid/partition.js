'use strict';
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
 * Node.js only. Logic moved from the EXP-072 extractor and EXP-074 section walker.
 */
const zlib=require('zlib');
const modern=require('../container/modern'),OLE=require('../container/ole');
const {parse}=require('./xt');

const GUID=Buffer.from('231dd571da8148a2a85898b21b89ef99','hex');
const MAX=128*1024*1024;
const asBuffer=b=>Buffer.isBuffer(b)?b:Buffer.from(b instanceof ArrayBuffer?new Uint8Array(b):b);
const inflateRaw=b=>zlib.inflateRawSync(b,{maxOutputLength:MAX}),inflateZlib=b=>zlib.inflateSync(b,{maxOutputLength:MAX});

/* Every named stream as {name: Buffer}, for either container. */
function streams(raw){
  raw=asBuffer(raw);
  if(modern.isOLE2(raw)){
    const o=OLE.read(raw),out={};
    for(const e of o.entries)try{out[e.name]=Buffer.from(o.stream(e));}catch(_){/* storage entries */}
    return out;
  }
  const s=modern.decompressOpenSX(raw,inflateRaw,inflateZlib),out={};
  for(const k of Object.keys(s))out[k]=Buffer.from(s[k]);
  return out;
}

/* Walk a chain of sections starting at `pos`. Stops with `error` at the first frame that does not
 * validate; the sections read so far are returned. */
function sections(b,pos){
  const out=[];
  while(pos<b.length){
    if(pos+28>b.length)return {out,error:`leftover ${b.length-pos}`};
    const size=b.readUInt32LE(pos),guid=b.subarray(pos+4,pos+20),inflated=b.readUInt32LE(pos+20),compressed=b.readUInt32LE(pos+24);
    if(!guid.equals(GUID))return {out,error:'guid'};
    if(size!==compressed+32)return {out,error:'size != compressed+32'};
    let body;try{body=zlib.inflateSync(b.subarray(pos+28,pos+28+compressed),{maxOutputLength:MAX});}catch(_){return {out,error:'zlib'};}
    if(body.length!==inflated)return {out,error:'inflated length'};
    const head=body.subarray(0,64).toString('latin1');
    const kind=(head.match(/TRANSMIT FILE(?: \((\w+)\))?/)||[])[1]||(/TRANSMIT FILE/.test(head)?'plain':'?');
    out.push({start:pos,kind,body,tail:b.subarray(pos+28+compressed,pos+36+compressed).toString('hex')});
    pos+=4+size;
  }
  return {out,error:null};
}

/* The first payload of Config-0-Partition, exactly as the EXP-072 extractor reads it. */
function extractPrimary(raw,all){
  raw=asBuffer(raw);let stream,name;
  if(modern.isOLE2(raw)){
    const o=OLE.read(raw),es=o.entries.filter(e=>e.name==='Config-0-Partition');
    if(es.length!==1)throw Error(`Expected one Config-0-Partition stream; found ${es.length}`);
    name=es[0].name;stream=Buffer.from(o.stream(es[0]));
  }else{
    const s=all||streams(raw),keys=Object.keys(s).filter(k=>/Config-0-Partition$/.test(k));
    if(keys.length!==1)throw Error(`Expected one Config-0-Partition stream; found ${keys.length}`);
    name=keys[0];stream=s[name];
  }
  if(stream.subarray(4,20).toString('hex')!==GUID.toString('hex'))throw Error('Config-0-Partition does not start with the section GUID');
  const inf=zlib.inflateSync(stream.subarray(28),{info:true,maxOutputLength:MAX});
  return {name,stream,inner:inf.buffer,compressedBytes:inf.engine.bytesWritten};
}

/* Summary of every partition-bearing stream: section kinds, chain status. For `sldprt info`. */
function survey(raw,all){
  all=all||streams(asBuffer(raw));const rows=[];
  for(const [k,b] of Object.entries(all)){
    const g=b.indexOf(GUID);if(g<4)continue;
    if(/Partition$/.test(k)){const w=sections(b,g-4);rows.push({stream:k,bytes:b.length,prefix:g-4,sections:w.out.map(x=>({offset:x.start,kind:x.kind,bytes:x.body.length})),chain:w.error?'broken: '+w.error:'complete'});}
    else{
      const found=[];
      for(let h=g;h>=4;h=b.indexOf(GUID,h+1)){
        const w=sections(b.subarray(0,h-4+4+b.readUInt32LE(h-4)),h-4);
        if(w.error||w.out.length!==1)continue;
        found.push({offset:w.out[0].start,kind:w.out[0].kind,bytes:w.out[0].body.length});
      }
      rows.push({stream:k,bytes:b.length,prefix:g-4,sections:found,chain:'embedded'});
    }
  }
  return rows;
}

/* The saved solid body, parsed. Returns {source, kind, parsed}; throws if no partition exists. */
function readBody(raw,options={}){
  raw=asBuffer(raw);
  const all=streams(raw);
  const primary=extractPrimary(raw,modern.isOLE2(raw)?null:all);
  let parsed=parse(primary.inner,true,options),source=primary.name,kind='partition';
  if(!parsed.error&&!parsed.nodes.some(n=>n.type===14)){
    for(const [k,b] of Object.entries(all)){
      const g=b.indexOf(GUID);if(g<4||/Partition$/.test(k))continue;
      for(const x of sections(b,g-4).out){
        const q=parse(x.body,true,options);
        if(!q.error&&q.nodes.some(n=>n.type===14)){parsed=q;source=k;kind=x.kind;break;}
      }
      if(source!==primary.name)break;
    }
  }
  return {source,kind,parsed};
}

module.exports={GUID,streams,sections,extractPrimary,survey,readBody};

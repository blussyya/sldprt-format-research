'use strict';
/**
 * sldprt — read SolidWorks .SLDPRT part files without SolidWorks.
 *
 * Node.js API. Every function accepts a file path, a Buffer, a Uint8Array or an ArrayBuffer.
 * The browser builds on the isomorphic pieces directly (src/display.js, src/container/*,
 * src/inflate.js); see web/.
 *
 *   parse(file)          saved display mesh, per face: strips, triangles, normals, edge IDs,
 *                        surface record, bounding record            (docs/format/displaylists.md)
 *   info(file)           container, streams, versions, counts, partition sections
 *   toSTL(file, opts)    Buffer, binary STL (or {ascii:true} -> string)
 *   toSTEP(file, opts)   {text, report}: AP214 with exact geometry from the native B-rep,
 *                        or from the display mesh when the B-rep can't be used (see below)
 *   readBrep(file, opts) the native Parasolid body: typed nodes + graph checks
 *   volume(file)         exact enclosed volume of the native body, m³
 *                                                                    (docs/format/parasolid.md)
 */
const fs=require('fs'),zlib=require('zlib');
const modern=require('./container/modern'),ole=require('./container/ole');
const display=require('./display'),convert=require('./convert');
const xt=require('./parasolid/xt'),partition=require('./parasolid/partition'),graph=require('./parasolid/topology');
const nativeModel=require('./brep/native'),brepVolume=require('./brep/volume'),stepWriter=require('./step/write'),stepReader=require('./step/read');

const MAX=128*1024*1024;
const inflateRaw=b=>zlib.inflateRawSync(b,{maxOutputLength:MAX});
const inflateZlib=b=>zlib.inflateSync(b,{maxOutputLength:MAX});

function bytes(input){
  if(typeof input==='string')return fs.readFileSync(input);
  if(Buffer.isBuffer(input))return input;
  if(input instanceof ArrayBuffer)return Buffer.from(new Uint8Array(input));
  if(ArrayBuffer.isView(input))return Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  throw TypeError('expected a path, Buffer, Uint8Array or ArrayBuffer');
}

/* Display mesh. Same result object as parser/v0.3's parseSLDPRT. */
function parse(input){return display.parseSLDPRT(bytes(input),inflateRaw,inflateZlib);}

/* What is in the file, cheaply: no geometry arrays in the result. */
function info(input){
  const b=bytes(input),legacy=modern.isOLE2(b),out={container:legacy?'OLE2 compound document (legacy)':'modern (SolidWorks 2015+)',bytes:b.length};
  try{
    if(legacy){const o=ole.read(b);out.streams=o.entries.filter(e=>e.type===2).map(e=>({name:e.name,bytes:e.size}));}
    else{const s=modern.decompressOpenSX(b,inflateRaw,inflateZlib);out.streams=Object.keys(s).map(k=>({name:k,bytes:s[k].length}));out.displayListsVersion=modern.displayListsVersion(s);}
  }catch(e){out.containerError=e.message;}
  const d=display.parseSLDPRT(b,inflateRaw,inflateZlib);
  const tags={};for(const f of d.faces)if(f.metadata)tags[f.metadata.typeTag]=(tags[f.metadata.typeTag]||0)+1;
  out.display={format:d.format,faces:d.faces.length,triangles:d.stats?d.stats.triangles:0,surfaceTags:tags,rejected:(d.rejected||[]).length,warnings:(d.warnings||[]).length,errors:d.errors};
  try{out.partitions=partition.survey(b).map(r=>({stream:r.stream,chain:r.chain,sections:r.sections.map(s=>s.kind)}));}catch(e){out.partitionError=e.message;}
  try{const r=readBrep(b);out.brep={source:r.source,schema:r.parsed.header&&r.parsed.header.schema,nodes:r.parsed.nodes.length,census:graph.census(r.parsed),graphChecks:r.graph.checks,graphErrors:r.graph.errors.length,error:r.parsed.error};}
  catch(e){out.brepError=e.message;}
  return out;
}

function model(input){
  const parsed=parse(input);
  if(!parsed.faces||!parsed.faces.length)throw Error('cannot convert: '+(parsed.errors&&parsed.errors.length?parsed.errors.join('; '):'no faces'));
  return convert.loadModel(parsed);
}
function toSTL(input,opts){opts=opts||{};const m=model(input);return opts.ascii?convert.toSTLAscii(m,opts):convert.toSTLBinary(m,opts);}
/* STEP. source 'auto' (default): exact geometry from the native B-rep when it can be read and
 * every surface and curve in it is supported, otherwise the display mesh (planes exact, other
 * faces as facets) with the reason in report.fallback. 'brep' throws instead of falling back;
 * 'mesh' (or the old mode:'faceted') always uses the mesh. report.source says which was used. */
function toSTEP(input,opts){
  opts=opts||{};const source=opts.source||(opts.mode==='faceted'?'mesh':'auto');let fallback=null;
  if(source!=='mesh'){
    try{
      const r=readBrep(input);
      if(r.graph.errors.length)throw Error('B-rep failed '+r.graph.errors.length+' graph checks');
      const out=stepWriter.write(nativeModel.build(r.parsed),opts);
      out.report.brepSource=r.source;return out;
    }catch(e){if(source==='brep')throw e;fallback=e.message;}
  }
  const out=convert.toSTEP(model(input),opts);
  out.report.source='mesh';if(fallback)out.report.fallback=fallback;
  return out;
}

/* Exact enclosed volume (m³) of the native B-rep, from its surfaces and curves. */
function volume(input){return brepVolume.volume(nativeModel.build(readBrep(input).parsed));}

/* Native B-rep: {source stream, section kind, parsed: xt.parse result, graph: topology checks}. */
function readBrep(input,opts){
  const r=partition.readBody(bytes(input),opts||{});
  return {...r,graph:graph.topology(r.parsed)};
}

module.exports={parse,info,toSTL,toSTEP,readBrep,volume,inflateRaw,inflateZlib,
  brep:{model:nativeModel.build,volume:brepVolume.volume},step:{read:stepReader.readBrep,write:stepWriter.write},
  display,convert,container:{modern,ole},parasolid:{xt,partition,topology:graph.topology,census:graph.census}};

#!/usr/bin/env node
'use strict';
/**
 * sldprt — command line for the SLDPRT readers. No dependencies; Node 18+.
 *
 *   sldprt info    <model.SLDPRT>                      what is in the file
 *   sldprt parse   <model.SLDPRT>                      display mesh as JSON (stdout)
 *   sldprt convert <model.SLDPRT> [--stl F] [--step F] [--ascii] [--faceted] [--scale N]
 *   sldprt brep    <model.SLDPRT> [--json|--nodes]     native Parasolid body
 *   sldprt render  <model.SLDPRT> [out.png]            six-view PNG contact sheet
 *   sldprt view    <model.SLDPRT> [--still] [--dark]   interactive terminal viewer
 *   sldprt serve   [--port N] [--host H] [--open]      browser viewer
 */
const fs=require('fs'),path=require('path');

const USAGE=`usage: sldprt <command> [options]

  info    <model.SLDPRT>                    container, streams, versions, counts, B-rep census
  parse   <model.SLDPRT>                    display mesh as JSON on stdout
  convert <model.SLDPRT> [--stl out.stl] [--step out.step] [--ascii] [--faceted] [--scale N]
                                            STL and/or STEP; with neither flag both are written
                                            next to the input
  brep    <model.SLDPRT> [--json | --nodes] native Parasolid B-rep: node census and graph checks
                                            (--json: summary as JSON, --nodes: every typed node)
  render  <model.SLDPRT> [out.png]          six-view contact sheet of the display mesh
  view    <model.SLDPRT> [--still] [--dark] [--edges|--no-edges]
                                            interactive terminal viewer (truecolor terminal)
  serve   [--port 8080] [--host 127.0.0.1] [--open]
                                            browser viewer at /web/index.html

Formats: modern SLDPRT (SolidWorks 2015+) and SolidWorks 2011 OLE2 parts. See README.md.`;

const json=v=>JSON.stringify(v,(_,x)=>ArrayBuffer.isView(x)?Array.from(x):x);
const opt=(a,name,def)=>{const i=a.indexOf(name);return i>=0&&a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:def;};
const has=(a,name)=>a.indexOf(name)>=0;
function need(a,cmd){if(!a[0]||a[0].startsWith('--')){console.error(`usage: sldprt ${cmd} <model.SLDPRT>`);process.exit(2);}if(!fs.existsSync(a[0])){console.error('no such file: '+a[0]);process.exit(2);}return a[0];}

const commands={
 info(a){
  const S=require('../src');const r=S.info(need(a,'info'));
  if(has(a,'--json')){console.log(JSON.stringify(r,null,2));return 0;}
  const L=[];
  L.push(`container   ${r.container}, ${r.bytes} bytes${r.containerError?' — '+r.containerError:''}`);
  if(r.displayListsVersion)L.push(`DisplayLists version ${r.displayListsVersion}`);
  if(r.streams)L.push(`streams     ${r.streams.length}`);
  const d=r.display;
  L.push(`display     ${d.errors.length?'not read: '+d.errors.join('; '):`${d.faces} faces, ${d.triangles} triangles (${d.format})`}`);
  if(Object.keys(d.surfaceTags).length)L.push(`surface tags ${Object.entries(d.surfaceTags).map(([k,v])=>`${k}×${v}`).join('  ')}`);
  if(d.rejected)L.push(`            ${d.rejected} candidate face records rejected — output is PARTIAL`);
  if(r.partitions)for(const p of r.partitions)L.push(`partition   ${p.stream}: ${p.sections.join(' + ')||'none'} (${p.chain})`);
  if(r.brep){const c=r.brep.census,pick=['BODY','SHELL','FACE','LOOP','EDGE','VERTEX'].filter(k=>c[k]).map(k=>`${c[k]} ${k.toLowerCase()}`);
   const surf=Object.entries(c).filter(([k])=>/^(PLANE|CYLINDER|CONE|SPHERE|TORUS|B_SURFACE|SWEPT_SURF|BLENDED_EDGE|OFFSET_SURF|SPUN_SURF)$/.test(k)).map(([k,v])=>`${k.toLowerCase()}×${v}`);
   L.push(`B-rep       ${r.brep.error?'not read: '+r.brep.error:`${r.brep.nodes} nodes from ${r.brep.source}: ${pick.join(', ')}`}`);
   if(surf.length)L.push(`surfaces    ${surf.join('  ')}`);
   L.push(`graph checks ${r.brep.graphChecks} run, ${r.brep.graphErrors} failed`);}
  else if(r.brepError)L.push(`B-rep       not read: ${r.brepError}`);
  console.log(L.join('\n'));return 0;
 },
 parse(a){
  const S=require('../src');const r=S.parse(need(a,'parse'));
  process.stdout.write(json(r)+'\n');
  return r.errors.length||r.rejected.length?1:0;
 },
 convert(a){
  const file=need(a,'convert'),C=require('../src/convert'),S=require('../src');
  const base=file.replace(/\.[^.\/\\]*$/,''),name=path.basename(base);
  const wantStl=has(a,'--stl')||!has(a,'--step'),wantStep=has(a,'--step')||!has(a,'--stl');
  const scale=Number(opt(a,'--scale',String(C.SCALE)));
  if(!Number.isFinite(scale)||scale<=0){console.error('--scale must be a positive number, got '+JSON.stringify(opt(a,'--scale','')));return 2;}
  const parsed=S.parse(file);
  if(!parsed.faces||!parsed.faces.length){console.error('cannot convert: '+(parsed.errors.length?parsed.errors.join('; '):'no faces'));return 1;}
  const m=C.loadModel(parsed),out={input:file,faces:m.faceCount,triangles:m.triangleCount};
  if(wantStl){const f=opt(a,'--stl',base+'.converted.stl');
   const buf=has(a,'--ascii')?Buffer.from(C.toSTLAscii(m,{scale,name}),'ascii'):C.toSTLBinary(m,{scale});
   fs.writeFileSync(f,buf);out.stl={file:f,bytes:buf.length,format:has(a,'--ascii')?'ascii':'binary'};}
  if(wantStep){const f=opt(a,'--step',base+'.converted.step');
   const {text,report}=C.toSTEP(m,{scale,name,mode:has(a,'--faceted')?'faceted':'auto'});
   fs.writeFileSync(f,text);out.step={file:f,bytes:text.length,...report};}
  console.log(JSON.stringify(out,null,2));return 0;
 },
 brep(a){
  const S=require('../src');const r=S.readBrep(need(a,'brep'));
  if(has(a,'--nodes')){process.stdout.write(json({source:r.source,kind:r.kind,header:r.parsed.header,error:r.parsed.error,nodes:r.parsed.nodes.map(n=>({type:n.type,name:n.name,index:n.index,values:n.values}))})+'\n');return r.parsed.error?1:0;}
  const sum={source:r.source,kind:r.kind,schema:r.parsed.header&&r.parsed.header.schema,error:r.parsed.error,terminated:r.parsed.terminated,
   nodes:r.parsed.nodes.length,census:S.parasolid.census(r.parsed),graphChecks:r.graph.checks,graphErrors:r.graph.errors,unresolvedPointers:r.parsed.unresolved.length};
  if(has(a,'--json')){console.log(JSON.stringify(sum,null,2));return sum.error||sum.graphErrors.length?1:0;}
  console.log(`source   ${sum.source} (${sum.kind})\nschema   ${sum.schema}\nnodes    ${sum.nodes}${sum.error?'  — stopped: '+sum.error:''}`);
  console.log('census   '+Object.entries(sum.census).map(([k,v])=>`${k}×${v}`).join('  '));
  console.log(`graph    ${sum.graphChecks} checks, ${sum.graphErrors.length} failed${sum.graphErrors.length?':\n  '+sum.graphErrors.slice(0,20).join('\n  '):''}`);
  return sum.error||sum.graphErrors.length?1:0;
 },
 render(a){
  const file=need(a,'render'),R=require('../src/render');
  const out=a[1]&&!a[1].startsWith('--')?a[1]:file.replace(/\.[^.\/\\]*$/,'')+'.sheet.png';
  const s=R.renderSheet(file,out,{});console.log(out);console.log(JSON.stringify(s));return 0;
 },
 view(a){return require('../src/terminal-viewer').main(['node','sldprt view',...a]);},
 serve(a){
  require('../src/serve').start({port:opt(a,'--port','8080'),host:opt(a,'--host','127.0.0.1'),open:has(a,'--open')})
   .then(({url})=>console.log(`\n  SLDPRT viewer  ${url}\n  stop          Ctrl-C\n`))
   .catch(e=>{console.error('cannot listen: '+e.message);process.exit(1);});
  process.on('SIGINT',()=>process.exit(0));
  return null;
 },
};

const [cmd,...rest]=process.argv.slice(2);
if(!cmd||cmd==='-h'||cmd==='--help'||cmd==='help'){console.log(USAGE);process.exit(0);}
if(!commands[cmd]){console.error(`unknown command: ${cmd}\n\n${USAGE}`);process.exit(2);}
let code;
try{code=commands[cmd](rest);}catch(e){console.error(e.message);code=1;}
if(typeof code==='number')process.exitCode=code;

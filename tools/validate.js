#!/usr/bin/env node
'use strict';
/* Exact STEP export, checked by OpenCascade on every part of the research corpus.
 *
 *   node tools/validate.js [--corpus DIR] [--python PATH] [--out DIR] [--json FILE] [filter]
 *
 * For each readable SLDPRT: write our STEP, load it with OCP (tools/validate-step.py) and check
 *   - it loads, BRepCheck_Analyzer says valid, one solid per body;
 *   - with a SolidWorks STEP of the same part: same solid count, same face count, same count of
 *     each surface type, volume and area within 1e-6 relative (1e-5 when SolidWorks' own edges
 *     are more than 1e-4 mm off its surfaces, see judge());
 *   - without one: our volume against the display mesh's, and the largest distance from the
 *     display mesh's interior vertices to the surfaces of the faces they belong to.
 * Dev tooling only. The Python side needs cadquery-ocp in a venv; the default interpreter is
 * ../kz-build/venv-sldprt/bin/python, or set SLDPRT_OCP_PYTHON.
 */
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const S=require('../src'),X=require('../src/step/export');

const REL=1e-6,REL_LOOSE=1e-5;
function args(){
  const a=process.argv.slice(2),o={filter:null};
  for(let i=0;i<a.length;i++){
    if(a[i]==='--corpus')o.corpus=a[++i];else if(a[i]==='--python')o.python=a[++i];
    else if(a[i]==='--out')o.out=a[++i];else if(a[i]==='--json')o.json=a[++i];else o.filter=new RegExp(a[i],'i');
  }
  return o;
}
function findPython(explicit){
  const c=[explicit,process.env.SLDPRT_OCP_PYTHON,path.join(__dirname,'..','..','kz-build','venv-sldprt','bin','python')].filter(Boolean);
  for(const p of c)if(fs.existsSync(p)){const r=spawnSync(p,['-c','import OCP'],{encoding:'utf8'});if(r.status===0)return p;}
  return null;
}
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,o);else if(/\.sldprt$/i.test(e.name))o.push(p);}return o;}
/* SolidWorks' own STEP of the part, when the corpus has one. */
function reference(f){
  const d=path.dirname(f),base=path.basename(f).replace(/\.sldprt$/i,'');
  for(const n of ['model.step',base+' ORIGINAL.STEP',base+'.STEP',base+'.step'])if(fs.existsSync(path.join(d,n))&&(n!=='model.step'||base==='model'))return path.join(d,n);
  return null;
}
/* Interior display-mesh vertices per native face (mm), and the mesh's signed volume (mm³). */
function meshPoints(f,max){
  const d=S.parse(f),faces={};let vol=0,n=0;
  // a vertex at the same place in two faces' meshes is on an edge, annotated or not; SolidWorks'
  // edge vertices can sit up to ~0.1 mm off the faces, so only interior vertices are compared
  const key=(df,i)=>[0,1,2].map(j=>Math.round(df.vertices[3*i+j]*1e7)).join(','),seen=new Map();
  for(const df of d.faces)for(let i=0;i<df.vertexCount;i++){const k=key(df,i);seen.set(k,seen.has(k)&&seen.get(k)!==df?null:df);}
  for(const df of d.faces){
    const V=i=>[df.vertices[3*i]*1000,df.vertices[3*i+1]*1000,df.vertices[3*i+2]*1000];
    const t=df.triangleIndices;
    for(let k=0;k<t.length;k+=3){const a=V(t[k]),b=V(t[k+1]),c=V(t[k+2]);
      vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
    if(!df.metadata)continue;
    const bnd=new Set();for(const e of df.edgeAnnotations||[])if(e.id)for(const v of e.vertices)bnd.add(v);
    const pts=[];for(let i=0;i<df.vertexCount;i++)if(!bnd.has(i)&&seen.get(key(df,i))===df)pts.push(V(i));
    if(pts.length){(faces['F'+df.metadata.rawId]=faces['F'+df.metadata.rawId]||[]).push(...pts);n+=pts.length;}
  }
  const keep=Math.min(1,max/Math.max(1,n));
  for(const k in faces){const a=faces[k],step=Math.max(1,Math.round(1/keep));faces[k]=a.filter((_,i)=>i%step===0);}
  return {faces,volume:Math.abs(vol)};
}

function run(o){
  const corpus=o.corpus||path.join(__dirname,'..','..','sldprt-research-dump');
  if(!fs.existsSync(corpus))throw Error('no corpus at '+corpus);
  const python=findPython(o.python);if(!python)throw Error('no Python with OCP (set SLDPRT_OCP_PYTHON)');
  const out=o.out||fs.mkdtempSync(path.join(os.tmpdir(),'sldprt-validate-'));fs.mkdirSync(out,{recursive:true});
  const rows=[],jobs=[];
  for(const f of walk(corpus).sort()){
    const rel=path.relative(corpus,f);if(o.filter&&!o.filter.test(rel))continue;
    const row={part:rel};rows.push(row);
    let brep;
    try{brep=S.readBrep(f);}catch(e){row.status='unreadable';row.reason=e.message;continue;}
    let r;
    try{r=X.toSTEP(brep.parsed,{name:path.basename(f).replace(/\.sldprt$/i,''),timestamp:'2000-01-01T00:00:00'});}
    catch(e){row.status='export failed';row.reason=e.message;continue;}
    row.report=r.report;
    const file=path.join(out,rel.replace(/[\\/ ]/g,'_').replace(/\.sldprt$/i,'.step'));fs.writeFileSync(file,r.text);row.step=file;
    const job={id:rows.length-1,step:file},ref=reference(f);
    if(ref){job.ref=ref;row.ref=path.relative(corpus,ref);}
    else{const m=meshPoints(f,6000),mf=file.replace(/\.step$/,'.mesh.json');fs.writeFileSync(mf,JSON.stringify(m));job.mesh=mf;row.meshVolume=m.volume;}
    jobs.push(job);
  }
  const p=spawnSync('nice',['-n','10',python,path.join(__dirname,'validate-step.py')],{input:jobs.map(j=>JSON.stringify(j)).join('\n')+'\n',encoding:'utf8',maxBuffer:1<<28});
  if(p.status!==0)throw Error('validator failed: '+p.stderr);
  for(const line of p.stdout.split('\n').filter(Boolean)){const r=JSON.parse(line),row=rows[r.id];judge(row,r);}
  return {rows,out};
}
function judge(row,r){
  const fails=[];row.ocp=r;
  if(r.error)fails.push(r.error);
  if(!r.loaded)fails.push('does not load');
  const o=r.ours;
  if(o){
    if(!o.valid)fails.push('BRepCheck: not valid');
    if(o.solids!==row.report.bodies)fails.push(`${o.solids} solids for ${row.report.bodies} bodies`);
    if(r.ref){const f=r.ref;
      if(o.solids!==f.solids)fails.push(`solids ${o.solids} vs SolidWorks ${f.solids}`);
      if(o.faces!==f.faces)fails.push(`faces ${o.faces} vs SolidWorks ${f.faces}`);
      if(JSON.stringify(sorted(o.surfaces))!==JSON.stringify(sorted(f.surfaces)))fails.push(`surface types ${JSON.stringify(sorted(o.surfaces))} vs ${JSON.stringify(sorted(f.surfaces))}`);
      row.dVolume=Math.abs(o.volume-f.volume)/f.volume;row.dArea=Math.abs(o.area-f.area)/f.area;
      // SolidWorks writes some intersection edges as B-splines that sit up to ~1e-3 mm off the
      // faces they bound. Its faces are then trimmed only that well, and volume and area cannot be
      // compared to 1e-6. When its edges are more than 1e-4 mm off (ten times the uncertainty it
      // states) and ours are within the uncertainty our file states, allow 1e-5 and say so.
      const loose=f.edgeDeviationMM>1e-4&&o.edgeDeviationMM<=row.report.uncertaintyMM;
      const lim=loose?REL_LOOSE:REL;
      if(loose&&(row.dVolume>REL||row.dArea>REL))row.note=`SolidWorks' edges are up to ${f.edgeDeviationMM.toExponential(1)} mm off its surfaces (ours ${o.edgeDeviationMM.toExponential(1)} mm); volume and area checked to ${lim}`;
      if(!(row.dVolume<=lim))fails.push('volume differs by '+row.dVolume.toExponential(2));
      if(!(row.dArea<=lim))fails.push('area differs by '+row.dArea.toExponential(2));
    }else if(r.mesh){
      row.dVolume=Math.abs(o.volume-row.meshVolume)/o.volume;row.meshDeviationMM=r.mesh.maxDeviationMM;
      row.meshP999MM=r.mesh.p999DeviationMM;row.meshPoints=r.mesh.points;row.meshOver1um=r.mesh.over1um;
      if(r.mesh.nMissing)fails.push(r.mesh.nMissing+' mesh faces without a STEP face');
    }
  }
  row.status=fails.length?'failed':r.ref?'matches SolidWorks':'valid';
  if(fails.length)row.reason=fails.join('; ');
}
const sorted=o=>Object.fromEntries(Object.entries(o).sort());

function table(rows){
  const lines=[];
  for(const r of rows){
    const rp=r.report;
    const extra=r.ref?`dV ${fmt(r.dVolume)} dA ${fmt(r.dArea)}`:r.meshDeviationMM!==undefined?`mesh dV ${fmt(r.dVolume)} dev max ${fmt(r.meshDeviationMM)} p99.9 ${fmt(r.meshP999MM)} mm (${r.meshOver1um}/${r.meshPoints} > 1e-3)`:'';
    lines.push(`${r.status.padEnd(18)} ${r.part.padEnd(70)} ${rp?String(rp.nativeFaces).padStart(4)+' -> '+String(rp.faces).padEnd(4):''.padEnd(12)} ${extra} ${rp&&rp.maxError?'fit '+fmt(rp.maxError*1000)+' mm':''}${rp&&rp.uncertaintyMM>1e-5?' uncertainty '+fmt(rp.uncertaintyMM)+' mm':''} ${r.reason?'| '+r.reason:''}${r.note?'| '+r.note:''}`);
  }
  return lines.join('\n');
}
const fmt=x=>x===undefined||x===null?'-':x===0?'0':x.toExponential(1);

if(require.main===module){
  const o=args(),res=run(o);
  console.log(table(res.rows));
  const c={};for(const r of res.rows)c[r.status]=(c[r.status]||0)+1;
  console.log('\n'+JSON.stringify(c)+'  STEP files in '+res.out);
  if(o.json)fs.writeFileSync(o.json,JSON.stringify(res.rows.map(r=>({...r,ocp:undefined})),null,1));
  process.exitCode=res.rows.some(r=>r.status==='failed'||r.status==='export failed')?1:0;
}
module.exports={run,findPython,table};

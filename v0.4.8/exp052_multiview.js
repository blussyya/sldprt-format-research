'use strict';
// Reproducible orthographic comparisons; no welding or healing.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const parser=require('../parser/v0.2/src/parser-core');
const {render,writePNG}=require('./exp052_renderer');
const ROOT=path.join(__dirname,'..'),OUT=path.join(__dirname,'EXP052_renders');
fs.mkdirSync(OUT,{recursive:true});
const W=360,H=360;
const views=[['iso',Math.PI/4,.61548],['reverse_iso',5*Math.PI/4,-.61548],['+X',0,0],['-X',Math.PI,0],['+Y',Math.PI/2,0],['-Y',-Math.PI/2,0],['+Z',0,Math.PI/2],['-Z',0,-Math.PI/2]];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function loadModel(file){const b=fs.readFileSync(path.join(ROOT,file)),r=parser.parseSLDPRT(b,zlib.inflateRawSync,zlib.inflateSync),tris=[];
 for(const f of r.faces)for(let k=0;k<f.triangleIndices.length;k+=3)tris.push({v:Array.from(f.triangleIndices.slice(k,k+3),i=>Array.from(f.vertices.slice(i*3,i*3+3)))});
 return {tris,source:file,sha256:hash(b),faces:r.faces.length,errors:r.errors,rejected:r.rejected,warnings:r.warnings};}
function loadSTL(file){const b=fs.readFileSync(path.join(ROOT,file)),tris=[];
 if(b.length>=84&&84+50*b.readUInt32LE(80)===b.length){for(let p=84;p<b.length;p+=50){const v=[];for(let j=0;j<3;j++)v.push([0,1,2].map(k=>b.readFloatLE(p+12+j*12+k*4)*.001));tris.push({v});}}
 else {const v=Array.from(b.toString().matchAll(/vertex\s+([\deE+.\-]+)\s+([\deE+.\-]+)\s+([\deE+.\-]+)/g),m=>m.slice(1).map(x=>Number(x)*.001));if(!v.length||v.length%3)throw Error('Invalid STL '+file);for(let i=0;i<v.length;i+=3)tris.push({v:v.slice(i,i+3)});}
 return {tris,source:file,sha256:hash(b),scaleToMetres:.001};}
function bounds(tris){const lo=[Infinity,Infinity,Infinity],hi=lo.map(x=>-x);for(const t of tris)for(const v of t.v)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}return [lo,hi];}
const jobs=fs.readdirSync(path.join(ROOT,'test files original/controlled')).filter(x=>/^C\d\d_/.test(x)).sort().map(x=>({name:x.slice(0,3),sld:`test files original/controlled/${x}/model.SLDPRT`,stl:`test files original/controlled/${x}/model.STL`}));
for(const side of ['TOP','BOTTOM'])jobs.push({name:'USB_'+side,sld:`test files original/usb hub case (ultimate test)/USB hub case ${side}.SLDPRT`,stl:`test files original/usb hub case (ultimate test)/USB hub case ${side} ORIGINAL.STL`});
for(const [name,file] of [['Pocket','Pocket Wheel'],['Dekor','Dekor']])jobs.push({name,sld:`test files original/${file}.SLDPRT`});
const results=[];
for(const j of jobs){const a=loadModel(j.sld),b=j.stl?loadSTL(j.stl):null;
 // USB original STL uses positive-octant export coordinates. Fixed translation
 // established from matching extents; retain original bounds and transform.
 if(b){b.originalBounds=bounds(b.tris);b.translationMetres=j.name.startsWith('USB_')?[-.0335,0,-.0205]:[0,0,0];for(const t of b.tris)for(const v of t.v)for(let k=0;k<3;k++)v[k]+=b.translationMetres[k];}
 const bb=bounds(a.tris.concat(b?b.tris:[]));
 const rec={name:j.name,parser:{...a,tris:undefined,triangles:a.tris.length,bounds:bounds(a.tris)},reference:b?{...b,tris:undefined,triangles:b.tris.length,bounds:bounds(b.tris)}:null,views:[]};
 for(const [name,az,el] of views){const opts={W,H,az,el,bounds:bb},prefix=path.join(OUT,j.name+'_'+name),ra=render(a.tris,prefix+'_parser.png',opts);
  if(!b){rec.views.push({name});continue;}
  const rb=render(b.tris,prefix+'_reference.png',opts),rgb=Buffer.alloc(W*H*3,246);let union=0,intersection=0,onlyA=0,onlyB=0,max=0,sum=0,above=0;const ds=[];
  for(let i=0;i<W*H;i++){const pa=Number.isFinite(ra.depth[i]),pb=Number.isFinite(rb.depth[i]);if(!pa&&!pb)continue;union++;let col;
   if(pa&&pb){intersection++;const d=Math.abs(ra.depth[i]-rb.depth[i]);ds.push(d);sum+=d;max=Math.max(max,d);if(d>1e-5)above++;col=d>1e-5?[255,155,20]:[200,207,213];}
   else if(pa){onlyA++;col=[210,40,135];}else{onlyB++;col=[0,170,200];}
   for(let k=0;k<3;k++)rgb[i*3+k]=col[k];}
  ds.sort((x,y)=>x-y);writePNG(prefix+'_difference.png',W,H,rgb);
  rec.views.push({name,silhouetteIoU:intersection/union,parserOnlyPixels:onlyA,referenceOnlyPixels:onlyB,commonPixels:intersection,depthMeanMm:1000*sum/intersection,depthP95Mm:1000*ds[Math.floor(ds.length*.95)],depthMaxMm:1000*max,commonDepthOver10umPixels:above});
 }
 results.push(rec);console.log(j.name,JSON.stringify(rec.views.map(x=>({view:x.name,IoU:x.silhouetteIoU,maxMm:x.depthMaxMm}))));
}
fs.writeFileSync(path.join(__dirname,'EXP052_RESULTS.json'),JSON.stringify({commit:'b529ade6e97e0bf14a1d473c29f2171719cce4d7',width:W,height:H,units:'metres internally; reported depths mm',depthFlagMm:.01,method:'Shared union bounds, identical orthographic camera/material, STL mm to m; USB-only fixed translation recorded per reference (no rotation or scale fitting). Eight views; double sided, no boundary overlays. Pixel metrics are resolution-dependent and not a Hausdorff or watertightness test.',results},null,2)+'\n');

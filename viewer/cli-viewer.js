#!/usr/bin/env node
'use strict';
/**
 * Interactive terminal viewer for parser/v0.2 output.
 *
 * Renders into the terminal itself using ANSI truecolor and the half-block character U+2580:
 * each cell carries a foreground (upper pixel) and a background (lower pixel), so one character
 * row is two pixels tall and the effective resolution is columns x (rows*2).
 *
 * Same rasteriser model as EXP-051 -- orthographic projection, z-buffer, flat shading from the
 * geometric face normal, one hue per face index, and the INV-021 boundary edges overlaid --
 * so what the terminal shows matches the committed PNG contact sheets.
 *
 *   node viewer/cli-viewer.js <model.SLDPRT>
 *   node viewer/cli-viewer.js <model.SLDPRT> --still        one frame, no input, then exit
 *
 * Keys: arrows / hjkl orbit, +- zoom, e edges, c colour, r reset, q or Ctrl-C quit.
 * Requires a truecolor terminal (Windows Terminal, iTerm2, most Linux terminals).
 */
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const parser=require(path.join(__dirname,'..','parser','v0.2','src','parser-core'));

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm=a=>{const L=Math.hypot(a[0],a[1],a[2]);return L?[a[0]/L,a[1]/L,a[2]/L]:[0,0,0];};
function hsv(h,s,v){
 const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
 return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6].map(x=>x*255);
}

function loadMesh(file){
 const r=parser.parseSLDPRT(fs.readFileSync(file),zlib.inflateRawSync,zlib.inflateSync);
 if(!r.faces||!r.faces.length)
  throw new Error((r.errors&&r.errors.length?r.errors.join('; '):'no faces')+' -- '+file);
 const tris=[],edges=[];
 r.faces.forEach((f,fi)=>{
  const V=[];
  for(let i=0;i<f.vertexCount;i++)V.push([f.vertices[i*3],f.vertices[i*3+1],f.vertices[i*3+2]]);
  for(let t=0;t<f.triangleIndices.length;t+=3){
   const a=V[f.triangleIndices[t]],b=V[f.triangleIndices[t+1]],c=V[f.triangleIndices[t+2]];
   if(a&&b&&c)tris.push({v:[a,b,c],face:fi});
  }
  if(f.edgeAnnotations)for(const e of f.edgeAnnotations)
   if(e&&e.id!==0&&Array.isArray(e.vertices)){
    const a=V[e.vertices[0]],b=V[e.vertices[1]];
    if(a&&b)edges.push([a,b]);
   }
 });
 const lo=[1e30,1e30,1e30],hi=[-1e30,-1e30,-1e30];
 for(const t of tris)for(const p of t.v)for(let k=0;k<3;k++){
  if(p[k]<lo[k])lo[k]=p[k];if(p[k]>hi[k])hi[k]=p[k];}
 return {tris,edges,faceCount:r.faces.length,
   ctr:[0,1,2].map(k=>(lo[k]+hi[k])/2),
   extent:Math.max(...[0,1,2].map(k=>hi[k]-lo[k]))||1,
   sizeMm:[0,1,2].map(k=>(hi[k]-lo[k])*1000)};
}

/** Rasterise into an RGB pixel buffer W x H. */
function rasterise(mesh,W,H,az,el,zoom,opts){
 const rgb=new Uint8Array(W*H*3);
 const bgv=opts.dark?18:238;
 for(let i=0;i<W*H;i++){rgb[i*3]=bgv;rgb[i*3+1]=bgv;rgb[i*3+2]=bgv+(opts.dark?4:2);}
 const zb=new Float64Array(W*H).fill(-Infinity);
 const fwd=nrm([Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),Math.sin(el)]);
 let up=[0,0,1]; if(Math.abs(dot(fwd,up))>0.99)up=[0,1,0];
 const right=nrm(cross(up,fwd)), realUp=cross(fwd,right);
 // Characters are about twice as tall as wide; the half-block already halves that, so
 // pixels are close to square and a single scale works for both axes.
 const S=(Math.min(W,H)*0.46*zoom)/(mesh.extent*0.5*1.35);
 const proj=p=>{const d=sub(p,mesh.ctr);
  return [W/2+dot(d,right)*S, H/2-dot(d,realUp)*S, dot(d,fwd)];};
 const light=nrm([0.4,0.5,0.85]);
 for(const t of mesh.tris){
  const P=t.v.map(proj);
  const n=nrm(cross(sub(t.v[1],t.v[0]),sub(t.v[2],t.v[0])));
  const lam=0.28+0.72*Math.abs(dot(n,light));
  const base=opts.color?hsv((t.face*0.61803398875)%1,0.42,0.97):[205,210,216];
  const col=base.map(c=>Math.max(0,Math.min(255,c*lam)));
  const minx=Math.max(0,Math.floor(Math.min(P[0][0],P[1][0],P[2][0]))),
        maxx=Math.min(W-1,Math.ceil(Math.max(P[0][0],P[1][0],P[2][0]))),
        miny=Math.max(0,Math.floor(Math.min(P[0][1],P[1][1],P[2][1]))),
        maxy=Math.min(H-1,Math.ceil(Math.max(P[0][1],P[1][1],P[2][1])));
  const d=(P[1][0]-P[0][0])*(P[2][1]-P[0][1])-(P[2][0]-P[0][0])*(P[1][1]-P[0][1]);
  if(Math.abs(d)<1e-12)continue;
  for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
   const px=x+0.5,py=y+0.5;
   const w0=((P[1][0]-px)*(P[2][1]-py)-(P[2][0]-px)*(P[1][1]-py))/d;
   const w1=((P[2][0]-px)*(P[0][1]-py)-(P[0][0]-px)*(P[2][1]-py))/d;
   const w2=1-w0-w1;
   if(w0<-1e-9||w1<-1e-9||w2<-1e-9)continue;
   const z=w0*P[0][2]+w1*P[1][2]+w2*P[2][2], idx=y*W+x;
   if(z>zb[idx]){zb[idx]=z;rgb[idx*3]=col[0];rgb[idx*3+1]=col[1];rgb[idx*3+2]=col[2];}
  }
 }
 if(opts.edges){
  const ec=opts.dark?[6,8,12]:[20,24,32];
  for(const [A,B] of mesh.edges){
   const p=proj(A),q=proj(B);
   const steps=Math.max(2,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])));
   for(let s=0;s<=steps;s++){
    const u=s/steps;
    const x=Math.round(p[0]+(q[0]-p[0])*u), y=Math.round(p[1]+(q[1]-p[1])*u);
    const z=p[2]+(q[2]-p[2])*u;
    if(x<0||y<0||x>=W||y>=H)continue;
    const idx=y*W+x;
    if(z>=zb[idx]-1e-6*mesh.extent){zb[idx]=z;rgb[idx*3]=ec[0];rgb[idx*3+1]=ec[1];rgb[idx*3+2]=ec[2];}
   }
  }
 }
 return rgb;
}

/** Pack an RGB buffer into half-block rows: fg = upper pixel, bg = lower pixel. */
function toHalfBlocks(rgb,W,H){
 const out=[];
 for(let y=0;y<H;y+=2){
  let line='',pf=null,pb=null;
  for(let x=0;x<W;x++){
   const t=(y*W+x)*3, b=((y+1<H?y+1:y)*W+x)*3;
   const fg=rgb[t]+','+rgb[t+1]+','+rgb[t+2];
   const bg=rgb[b]+','+rgb[b+1]+','+rgb[b+2];
   if(fg!==pf){line+='\x1b[38;2;'+rgb[t]+';'+rgb[t+1]+';'+rgb[t+2]+'m';pf=fg;}
   if(bg!==pb){line+='\x1b[48;2;'+rgb[b]+';'+rgb[b+1]+';'+rgb[b+2]+'m';pb=bg;}
   line+='▀';
  }
  out.push(line+'\x1b[0m');
 }
 return out;
}

function main(argv){
 const a=argv.slice(2);
 if(!a.length||a[0]==='-h'||a[0]==='--help'){
  console.log('usage: node viewer/cli-viewer.js <model.SLDPRT> [--still] [--dark] [--edges|--no-edges]');
  console.log('keys : arrows/hjkl orbit, +/- zoom, e edges, c colour, r reset, q quit');
  return 0;
 }
 const file=a[0], still=a.indexOf('--still')>=0;
 let mesh;
 try{mesh=loadMesh(file);}catch(e){console.error('cannot open: '+e.message);return 1;}

 // A terminal row is two pixels tall, so a modest window gives a very small raster and a
 // 1-pixel edge overlay covers a large fraction of each face. Default the overlay on only
 // where there are enough pixels to resolve it; 'e' overrides either way, and the status bar
 // always shows the current state. --edges / --no-edges force it explicitly.
 const startRows=(process.stdout.rows||+process.env.LINES||30)-2;
 const opts={edges:startRows*2>=110,color:true,dark:a.indexOf('--dark')>=0};
 if(a.indexOf('--edges')>=0)opts.edges=true;
 if(a.indexOf('--no-edges')>=0)opts.edges=false;
 let az=0.85,el=0.60,zoom=1;
 const HOME={az:0.85,el:0.60,zoom:1};

 function frame(){
  // process.stdout.columns is undefined when piped; fall back to the env, then a default.
  const cols=Math.max(20,(process.stdout.columns||+process.env.COLUMNS||100));
  const rows=Math.max(10,(process.stdout.rows||+process.env.LINES||30)-2);
  const W=cols, H=rows*2;
  const rgb=rasterise(mesh,W,H,az,el,zoom,opts);
  const lines=toHalfBlocks(rgb,W,H);
  // Build the bar from segments and drop the least important ones until it fits,
  // rather than slicing a word in half.
  const segs=[
   path.basename(file),
   mesh.faceCount+' faces  '+mesh.tris.length+' tris',
   mesh.edges.length+' edges',
   mesh.sizeMm.map(v=>v.toFixed(1)).join('×')+' mm',
   'az'+(az*180/Math.PI).toFixed(0)+' el'+(el*180/Math.PI).toFixed(0)+' z'+zoom.toFixed(2),
  ];
  let bar=' '+segs[0].slice(0,cols-1);
  for(let n=segs.length;n>0;n--){
   const cand=' '+segs.slice(0,n).join('  │  ');
   if(cand.length<=cols){bar=cand;break;}
  }
  const hsegs=['arrows orbit','+/- zoom','e edges['+(opts.edges?'on':'off')+']',
   'c colour['+(opts.color?'on':'off')+']','r reset','q quit'];
  let help='';
  for(let n=hsegs.length;n>0;n--){
   const cand=' '+hsegs.slice(0,n).join('  ');
   if(cand.length<=cols){help=cand;break;}
  }
  return '\x1b[H'+lines.join('\n')+'\n\x1b[1m'+bar+'\x1b[0m\x1b[K\n'+
         '\x1b[2m'+help+'\x1b[0m\x1b[K';
 }

 if(still){ process.stdout.write(frame().replace('\x1b[H','')+'\n'); return 0; }

 if(!process.stdin.isTTY){
  console.error('not a TTY -- use --still for a single frame, or run in a terminal.');
  return 1;
 }
 process.stdout.write('\x1b[?25l\x1b[2J');            // hide cursor, clear
 const restore=()=>{process.stdout.write('\x1b[0m\x1b[?25h\x1b[2J\x1b[H');};
 const redraw=()=>process.stdout.write(frame());
 process.stdin.setRawMode(true); process.stdin.resume();
 process.stdin.on('data',buf=>{
  const s=buf.toString();
  if(s==='\u0003'||s==='q'){restore();process.exit(0);}
  else if(s==='\x1b[D'||s==='h')az-=0.12;
  else if(s==='\x1b[C'||s==='l')az+=0.12;
  else if(s==='\x1b[A'||s==='k')el=Math.min(1.5,el+0.10);
  else if(s==='\x1b[B'||s==='j')el=Math.max(-1.5,el-0.10);
  else if(s==='+'||s==='=')zoom=Math.min(6,zoom*1.15);
  else if(s==='-'||s==='_')zoom=Math.max(0.25,zoom/1.15);
  else if(s==='e')opts.edges=!opts.edges;
  else if(s==='c')opts.color=!opts.color;
  else if(s==='r'){az=HOME.az;el=HOME.el;zoom=HOME.zoom;}
  else return;
  redraw();
 });
 process.stdout.on('resize',redraw);
 redraw();
 return 0;
}

if(require.main===module){const c=main(process.argv);if(c)process.exit(c);}
module.exports={loadMesh,rasterise,toHalfBlocks};

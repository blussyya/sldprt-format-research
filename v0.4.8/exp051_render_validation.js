'use strict';
/**
 * EXP-051: Visual validation of parser/v0.2 output.
 *
 * Every check through EXP-050 is numerical. A mesh can satisfy correct triangle counts, correct
 * per-triangle normals, correct residual thresholds and every invariant while still rendering as
 * webbing, spikes or an inside-out shell -- a triangulation that connects the right vertices in
 * the wrong order passes all of them. This renders the parser's actual output and looks at it.
 *
 * Self-contained software rasteriser: no three.js, no CDN, no external dependency of any kind.
 * Orthographic projection, z-buffer, flat shading from the geometric face normal, one hue per
 * face index so face segmentation is visible, plus an overlay drawing every edge whose Block1
 * annotation is NONZERO (INV-021's boundary edges) directly onto the mesh.
 *
 * Input is parser/v0.2's own `triangleIndices` and `edgeAnnotations`, consumed verbatim. Nothing
 * is re-derived, welded, re-ordered or repaired. What the image shows is what the parser emits.
 *
 * Six viewpoints per model (2026-09-20): a single viewpoint cannot see a defect hidden behind
 * self-occlusion, which was recorded as a limitation of the original one-view pass. The back,
 * underside and bottom views exist specifically to expose interior/hidden geometry.
 *
 * Usage:
 *   node v0.4.8/exp051_render_validation.js --all              regenerate every committed sheet
 *   node v0.4.8/exp051_render_validation.js --sheet <model.SLDPRT> [out.png]
 *                                                              six-view sheet for one model;
 *                                                              defaults out.png to EXP051_renders/<name>.png
 *   node v0.4.8/exp051_render_validation.js <model.SLDPRT> <out.png>   single default view
 */
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const parser=require(path.join(__dirname,'..','parser','v0.2','src','parser-core'));

// ---------- PNG ----------
let CRCT=null;
function crcTable(){if(CRCT)return CRCT;CRCT=new Int32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;CRCT[n]=c;}return CRCT;}
function crc32(buf){const t=crcTable();let c=0xffffffff;
 for(let i=0;i<buf.length;i++)c=t[(c^buf[i])&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));
 return Buffer.concat([len,td,c]);}
function writePNG(file,W,H,rgb){
 const raw=Buffer.alloc((W*3+1)*H);
 for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;rgb.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);
 ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
 fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}
// ---------- vector ----------
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm=a=>{const L=Math.hypot(...a);return L?[a[0]/L,a[1]/L,a[2]/L]:[0,0,0];};
function hsv(h,s,v){const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
 const m=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return m.map(x=>x*255);}

// 3x5 bitmap font, just enough to label each panel.
const GLYPH={'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100','R':'110101110101101','S':'011100010001110','T':'111010010010010','U':'101101101101011','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111','-':'000000111000000','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010','9':'010101011001110',' ':'000000000000000','/':'001001010100100','.':'000000000000010'};
function drawText(rgb,W,H,x0,y0,text,scale,col){
 let cx=x0;
 for(const ch of text.toUpperCase()){
  const g=GLYPH[ch]; if(g===undefined){cx+=4*scale;continue;}
  for(let r=0;r<5;r++)for(let c=0;c<3;c++){
   if(g[r*3+c]!=='1')continue;
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
    const x=cx+c*scale+dx,y=y0+r*scale+dy;
    if(x<0||y<0||x>=W||y>=H)continue;
    const i=(y*W+x)*3;rgb[i]=col[0];rgb[i+1]=col[1];rgb[i+2]=col[2];}}
  cx+=4*scale;
 }
}

// Load parser output once per model.
function loadMesh(model){
 const r=parser.parseSLDPRT(fs.readFileSync(model),zlib.inflateRawSync,zlib.inflateSync);
 if(!r.faces||!r.faces.length)throw new Error('no faces in '+model);
 const tris=[],bedges=[];
 r.faces.forEach((f,fi)=>{
  const V=[];for(let i=0;i<f.vertexCount;i++)V.push([f.vertices[i*3],f.vertices[i*3+1],f.vertices[i*3+2]]);
  for(let t=0;t<f.triangleIndices.length;t+=3)
   tris.push({v:[V[f.triangleIndices[t]],V[f.triangleIndices[t+1]],V[f.triangleIndices[t+2]]],face:fi});
  if(f.edgeAnnotations)for(const e of f.edgeAnnotations)
   if(e&&e.id!==0&&Array.isArray(e.vertices))bedges.push([V[e.vertices[0]],V[e.vertices[1]]]);
 });
 return {tris,bedges,stats:r.stats,faceCount:r.faces.length};
}

// Rasterise one view into an RGB buffer.
function renderView(mesh,W,H,az,el,label){
 const {tris,bedges}=mesh;
 let lo=[1e30,1e30,1e30],hi=[-1e30,-1e30,-1e30];
 for(const t of tris)for(const p of t.v)for(let k=0;k<3;k++){if(p[k]<lo[k])lo[k]=p[k];if(p[k]>hi[k])hi[k]=p[k];}
 const ctr=[0,1,2].map(k=>(lo[k]+hi[k])/2), ext=Math.max(...[0,1,2].map(k=>hi[k]-lo[k]))||1;
 const fwd=nrm([Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),Math.sin(el)]);
 let up=[0,0,1]; if(Math.abs(dot(fwd,up))>0.99)up=[0,1,0];
 const right=nrm(cross(up,fwd)), realUp=cross(fwd,right);
 const S=(Math.min(W,H)*0.40)/(ext*0.5*1.35);
 const proj=p=>{const d=sub(p,ctr);return [W/2+dot(d,right)*S,H/2-dot(d,realUp)*S,dot(d,fwd)];};
 const rgb=Buffer.alloc(W*H*3);
 for(let i=0;i<W*H;i++){const g=246;rgb[i*3]=g;rgb[i*3+1]=g;rgb[i*3+2]=g+3;}
 const zb=new Float64Array(W*H).fill(-Infinity);
 const light=nrm([0.4,0.5,0.85]);
 for(const t of tris){
  const P=t.v.map(proj);
  const n=nrm(cross(sub(t.v[1],t.v[0]),sub(t.v[2],t.v[0])));
  let lam=Math.abs(dot(n,light));lam=0.28+0.72*lam;
  const base=hsv((t.face*0.61803398875)%1,0.42,0.97);
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
   const z=w0*P[0][2]+w1*P[1][2]+w2*P[2][2];
   const idx=y*W+x;
   if(z>zb[idx]){zb[idx]=z;rgb[idx*3]=col[0];rgb[idx*3+1]=col[1];rgb[idx*3+2]=col[2];}
  }
 }
 for(const [A,B] of bedges){
  const p=proj(A),q=proj(B);
  const steps=Math.max(2,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])));
  for(let s=0;s<=steps;s++){
   const u=s/steps,x=Math.round(p[0]+(q[0]-p[0])*u),y=Math.round(p[1]+(q[1]-p[1])*u);
   const z=p[2]+(q[2]-p[2])*u;
   for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;
    const idx=yy*W+xx;
    if(z>=zb[idx]-ext*0.01){rgb[idx*3]=25;rgb[idx*3+1]=28;rgb[idx*3+2]=36;}
   }}
 }
 if(label)drawText(rgb,W,H,10,10,label,2,[60,64,76]);
 return rgb;
}

const D=Math.PI/180;
const VIEWS=[
 {name:'ISO FRONT', az: 45*D, el: 35.264*D},
 {name:'ISO BACK',  az:225*D, el: 35.264*D},
 {name:'ISO LEFT',  az:135*D, el: 35.264*D},
 {name:'ISO UNDER', az: 45*D, el:-35.264*D},
 {name:'TOP',       az: 45*D, el: 89.9*D},
 {name:'BOTTOM',    az: 45*D, el:-89.9*D},
];

// Six views tiled 3x2 into one sheet.
function renderSheet(model,outFile,opts){
 opts=opts||{};
 const P=opts.panel||520, cols=3, rows=2, gap=6;
 const mesh=loadMesh(model);
 const W=cols*P+(cols+1)*gap, H=rows*P+(rows+1)*gap;
 const sheet=Buffer.alloc(W*H*3);
 for(let i=0;i<W*H;i++){sheet[i*3]=214;sheet[i*3+1]=216;sheet[i*3+2]=222;}
 VIEWS.forEach((v,i)=>{
  const rgb=renderView(mesh,P,P,v.az,v.el,v.name);
  const ox=gap+(i%cols)*(P+gap), oy=gap+Math.floor(i/cols)*(P+gap);
  for(let y=0;y<P;y++)rgb.copy(sheet,((oy+y)*W+ox)*3,y*P*3,(y+1)*P*3);
 });
 writePNG(outFile,W,H,sheet);
 return {faces:mesh.faceCount,triangles:mesh.tris.length,boundaryEdges:mesh.bedges.length,
   views:VIEWS.length,stats:mesh.stats};
}

// Single default view (kept for ad-hoc use).
function render(model,outFile,opts){
 opts=opts||{};
 const W=opts.W||760,H=opts.H||760;
 const mesh=loadMesh(model);
 writePNG(outFile,W,H,renderView(mesh,W,H,opts.az??45*D,opts.el??35.264*D,opts.label||null));
 return {faces:mesh.faceCount,triangles:mesh.tris.length,boundaryEdges:mesh.bedges.length,stats:mesh.stats};
}

const TARGETS=[
 ['test files original/controlled/C03_cube_fillet_1mm/model.SLDPRT','C03.png'],
 ['test files original/controlled/C04_cube_hole_5mm/model.SLDPRT','C04.png'],
 ['test files original/controlled/C07_cube_two_holes/model.SLDPRT','C07.png'],
 ['test files original/controlled/C10_cube_shell_1mm/model.SLDPRT','C10.png'],
 ['test files original/usb hub case (ultimate test)/USB hub case TOP.SLDPRT','usbtop.png'],
 ['test files original/usb hub case (ultimate test)/USB hub case BOTTOM.SLDPRT','usbbottom.png'],
 ['test files original/Pocket Wheel.SLDPRT','pocket.png'],
 ['test files original/Dekor.SLDPRT','dekor.png'],
 ['test files original/Helical Bevel Gear.SLDPRT','gear.png'],
 ['test files original/distributor main boss rev a.SLDPRT','distributor.png'],
 ['test files original/PTC GE8080-8.SLDPRT','ptc.png'],
];

module.exports={render,renderSheet,loadMesh,VIEWS};

if(require.main===module){
 const a=process.argv.slice(2);
 if(a[0]==='--all'){
  const ROOT=path.join(__dirname,'..'),OUT=path.join(__dirname,'EXP051_renders');
  fs.mkdirSync(OUT,{recursive:true});
  const summary=[];
  for(const [src,out] of TARGETS){
   const s=renderSheet(path.join(ROOT,src),path.join(OUT,out),{});
   summary.push({model:src,sheet:'EXP051_renders/'+out,...s});
   console.log(out.padEnd(16),JSON.stringify(s));
  }
  fs.writeFileSync(path.join(__dirname,'EXP051_RENDER_INDEX.json'),
   JSON.stringify({experiment:'EXP-051',date:'2026-09-20',
    views:VIEWS.map(v=>({name:v.name,azimuthDeg:+(v.az/D).toFixed(3),elevationDeg:+(v.el/D).toFixed(3)})),
    panelPx:520,layout:'3x2',sheets:summary},null,2)+'\n');
  console.log('\nWrote EXP051_RENDER_INDEX.json');
 } else if(a[0]==='--sheet'){
  if(!a[1]){console.error('usage: node exp051_render_validation.js --sheet <model.SLDPRT> [out.png]');process.exit(1);}
  const out=a[2]||path.join(__dirname,'EXP051_renders',path.basename(a[1]).replace(/\.[^.]*$/,'')+'.png');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const s=renderSheet(a[1],out,{});
  console.log(out);
  console.log(JSON.stringify(s,null,2));
 } else if(a[0]){
  console.log(JSON.stringify(render(a[0],a[1],{})));
 }
}

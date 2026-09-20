'use strict';
/**
 * Export parser/v0.2 output as a compact payload for the interactive viewers.
 *
 * Per model: vertices (float32), triangle indices, a face index per triangle (for the
 * per-face colouring EXP-051 uses), and the INV-021 boundary edges as index pairs.
 * Indices are uint16 where the model fits, uint32 otherwise.
 *
 *   node viewer/export-mesh-data.js > viewer/mesh-data.json
 */
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..');
const parser=require(path.join(ROOT,'parser','v0.2','src','parser-core'));

const TARGETS=[
 ['C10','C10 shell 1 mm','test files original/controlled/C10_cube_shell_1mm/model.SLDPRT',
  'The controlled model that pins the strip triangulation: a 1 mm wall shell. A fan triangulation or a mis-ordered strip would close or web across the opening.'],
 ['C04','C04 hole 5 mm','test files original/controlled/C04_cube_hole_5mm/model.SLDPRT',
  'A 5 mm through-hole in a 10 mm cube. The cylinder wall shows the facet banding of the stored display tessellation.'],
 ['C07','C07 two holes','test files original/controlled/C07_cube_two_holes/model.SLDPRT',
  'Two separate through-holes, the smallest model with more than one cylindrical face.'],
 ['usbtop','USB hub case TOP','test files original/usb hub case (ultimate test)/USB hub case TOP.SLDPRT',
  'Enclosure walls, cutout, screw bosses, counterbored holes and a lip. Fully closed: 0 open edges.'],
 ['gear','Helical bevel gear','test files original/Helical Bevel Gear.SLDPRT',
  'Helical tooth twist, splined shaft and hollow bore. The gaps between teeth are genuine geometry, not missing faces (EXP-051).'],
 ['ptc','PTC GE8080-8','test files original/PTC GE8080-8.SLDPRT',
  'Mostly planar: 114 of its 126 faces export as analytic STEP planes in converter/v0.1.'],
 ['pocket','Pocket wheel','test files original/Pocket Wheel.SLDPRT',
  'Sprocket with pocketed teeth, raised hub and a central bore with a resolved keyway notch.'],
];

const b64=buf=>Buffer.from(buf.buffer,buf.byteOffset,buf.byteLength).toString('base64');

function build(file){
 const r=parser.parseSLDPRT(fs.readFileSync(file),zlib.inflateRawSync,zlib.inflateSync);
 if(!r.faces||!r.faces.length)throw new Error('no faces in '+file);
 const verts=[],tris=[],faceOfTri=[],edges=[];
 let base=0;
 r.faces.forEach((f,fi)=>{
  for(let i=0;i<f.vertexCount;i++)
   verts.push(f.vertices[i*3],f.vertices[i*3+1],f.vertices[i*3+2]);
  for(let t=0;t<f.triangleIndices.length;t+=3){
   tris.push(base+f.triangleIndices[t],base+f.triangleIndices[t+1],base+f.triangleIndices[t+2]);
   faceOfTri.push(fi);
  }
  if(f.edgeAnnotations)for(const e of f.edgeAnnotations)
   if(e&&e.id!==0&&Array.isArray(e.vertices))edges.push(base+e.vertices[0],base+e.vertices[1]);
  base+=f.vertexCount;
 });
 const n=verts.length/3;
 const IdxArray=n<65536?Uint16Array:Uint32Array;
 // Centre and scale so every model arrives in the viewer at a comparable size.
 const lo=[1e30,1e30,1e30],hi=[-1e30,-1e30,-1e30];
 for(let i=0;i<n;i++)for(let k=0;k<3;k++){
  const v=verts[i*3+k];if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v;}
 const ctr=[0,1,2].map(k=>(lo[k]+hi[k])/2);
 const extent=Math.max(...[0,1,2].map(k=>hi[k]-lo[k]))||1;
 const pos=new Float32Array(n*3);
 for(let i=0;i<n;i++)for(let k=0;k<3;k++)pos[i*3+k]=(verts[i*3+k]-ctr[k])/extent;
 return {
  vertexCount:n,faceCount:r.faces.length,triangleCount:tris.length/3,edgeCount:edges.length/2,
  indexBits:n<65536?16:32,
  sizeMm:[0,1,2].map(k=>+((hi[k]-lo[k])*1000).toFixed(3)),
  pos:b64(pos),idx:b64(new IdxArray(tris)),face:b64(new Uint16Array(faceOfTri)),
  edge:b64(new IdxArray(edges)),
 };
}

const models=[];
for(const [id,label,rel,note] of TARGETS){
 const file=path.join(ROOT,rel);
 if(!fs.existsSync(file)){process.stderr.write('skip (missing): '+rel+'\n');continue;}
 const m=build(file);
 models.push({id,label,note,source:rel,...m});
 process.stderr.write(id.padEnd(8)+m.faceCount+' faces  '+m.triangleCount+' tris  '+m.edgeCount+' edges\n');
}
process.stdout.write(JSON.stringify({
 generated:'viewer/export-mesh-data.js',parser:'parser/v0.2',
 note:'Positions are centred and divided by the largest bounding-box extent. sizeMm carries the real dimensions.',
 models},null,1));

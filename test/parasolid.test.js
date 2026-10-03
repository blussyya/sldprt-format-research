'use strict';
/* Native Parasolid B-rep: exports, embedded partitions, and the join to the display layer.
 * Formerly the EXP-071 audit, EXP-072/073 extractors and EXP-074 join. Skips without the corpus. */
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {parse,Reader}=require('../src/parasolid/xt'),{topology}=require('../src/parasolid/topology'),P=require('../src/parasolid/partition');
const display=require('../src/display'),modern=require('../src/container/modern');
const {cubeGeometry,compare,coverage}=require('./helpers/xt-checks');
const {walk,buildLogFaceCounts}=require('./helpers/corpus');
const {iR,iZ,CORPUS,needsCorpus}=require('./helpers/common');

const models=era=>fs.readdirSync(path.join(CORPUS,'test files new',era)).filter(m=>fs.existsSync(path.join(CORPUS,'test files new',era,m,'model.SLDPRT'))).sort();

test('98 SolidWorks X_T/X_B exports: typed parse to terminator, graph checks, text = binary',needsCorpus,t=>{
  const counts=buildLogFaceCounts(CORPUS);let pairs=0,nodes=0,checks=0,cube=null;const allowed={};
  for(const era of ['SW2011','SW2022'])for(const m of models(era)){
    const d=path.join(CORPUS,'test files new',era,m);if(!fs.existsSync(path.join(d,'model.x_t')))continue;
    const tb=fs.readFileSync(path.join(d,'model.x_t')),bb=fs.readFileSync(path.join(d,'model.x_b'));
    const tx=parse(tb,false),bx=parse(bb,true);
    assert.equal(tx.error,null,`${era}/${m} text`);assert.equal(bx.error,null,`${era}/${m} binary`);
    for(const r of [tx,bx]){
      const g=topology(r);assert.deepEqual(g.errors,[],`${era}/${m}`);checks+=g.checks;
      const ids=r.nodes.map(n=>n.values.node_id).filter(v=>v>0);
      assert.equal(new Set(ids).size,ids.length,'duplicate node_id');
      assert(Math.max(...ids)<=r.nodes[0].values.highest_node_id,'node_id above BODY.highest_node_id');
      assert.equal(r.nodes.filter(n=>n.type===14).length,counts[`${era}/${m}`.toLowerCase()],`${era}/${m} faces`);
    }
    // The text and binary files are two separate exports; EXP-071 found they differ only in
    // BODY.highest_node_id and ATTRIBUTE node IDs. Anything else is a reader error.
    for(const d of compare(tx,bx).differences){
      const k=d.type+'.'+d.field;assert(k==='BODY.highest_node_id'||k==='ATTRIBUTE.node_id',`${era}/${m} text vs binary: ${JSON.stringify(d)}`);
      allowed[k]=(allowed[k]||0)+1;}
    coverage(bx);
    if(m==='C00_cube_10mm'){cubeGeometry(tx);cubeGeometry(bx);if(era==='SW2022')cube={tb,bb,bx};}
    pairs++;nodes+=bx.nodes.length;
  }
  assert.equal(pairs,49);
  assert.deepEqual(allowed,{'BODY.highest_node_id':24,'ATTRIBUTE.node_id':308});
  // controls: a corrupted fin pointer is caught by the graph checks; truncation, trailing bytes,
  // malformed numbers and the node limit all stop the reader
  const bad=Buffer.from(cube.bb),span=cube.bx.spans.find(s=>s.label==='FIN.forward');bad.writeUInt16BE(2,span.start);
  const mutated=parse(bad,true);assert.equal(mutated.error,null);assert(topology(mutated).errors.length>0);
  assert(parse(cube.bb.subarray(0,-1),true).error);assert(parse(Buffer.concat([cube.bb,Buffer.from([0])]),true).error);
  assert(parse(Buffer.from(cube.tb.toString('latin1').replace('1e3','1.2.3')),false).error);
  const limit=parse(cube.bb,true,{maxNodes:10});assert.equal(limit.nodes.length,10);assert(limit.error);
  for(const n of [0,1,32766,32767,65530,65534,65535,1000000]){const raw=Buffer.alloc(n<32767?2:4);if(n<32767)raw.writeInt16BE(n+1);else{raw.writeInt16BE(-(n%32767+1));raw.writeInt16BE(Math.floor(n/32767),2);}assert.equal(new Reader(raw,true).ptr(),n);}
  t.diagnostic(`${pairs} pairs, ${pairs*2} exports, ${nodes} binary nodes, ${checks} graph checks`);
});

test('49 controlled SLDPRT: the embedded partition parses and matches the export face count',needsCorpus,t=>{
  let files=0,nodes=0,faces=0,checks=0;
  for(const era of ['SW2011','SW2022'])for(const m of models(era)){
    const d=path.join(CORPUS,'test files new',era,m),raw=fs.readFileSync(path.join(d,'model.SLDPRT'));
    const x=P.extractPrimary(raw),r=parse(x.inner,true);
    assert.equal(r.error,null,`${era}/${m}`);assert.equal(r.nodes[0].type,101,'WORLD root');
    assert.equal(r.nodes.filter(n=>n.type===12).length,1,'one BODY');
    const g=topology(r);assert.deepEqual(g.errors,[],`${era}/${m}`);
    const f=r.nodes.filter(n=>n.type===14).length,exported=parse(fs.readFileSync(path.join(d,'model.x_b')),true);
    assert.equal(f,exported.nodes.filter(n=>n.type===14).length,`${era}/${m}`);
    if(m==='C00_cube_10mm')cubeGeometry(r);
    // every Partition / GhostPartition stream is an exact chain of sections
    for(const s of P.survey(raw).filter(s=>/Partition$/.test(s.stream))){
      assert.equal(s.chain,'complete',`${era}/${m} ${s.stream}`);
      assert.deepEqual(s.sections.map(x=>x.kind),/Ghost/.test(s.stream)?['partition']:['partition','deltas'],`${era}/${m} ${s.stream}`);
    }
    files++;nodes+=r.nodes.length;faces+=f;checks+=g.checks;
  }
  assert.equal(files,49);assert.equal(faces,287);
  t.diagnostic(`${files} files, ${nodes} nodes, ${faces} faces, ${checks} graph checks`);
});

test('21 modern originals: the body parses; PTC GE8080-8 is found in LocalBodies',needsCorpus,t=>{
  let files=0,faces=0,nodes=0;
  for(const f of walk(path.join(CORPUS,'test files original'))){
    const raw=fs.readFileSync(f);
    if(['SW2000-s01.SLDPRT','chainwheel.sldprt','plate4.sldprt'].includes(path.basename(f))){assert.throws(()=>P.readBody(raw),/Config-0-Partition/);continue;}
    const b=P.readBody(raw),r=b.parsed;
    assert.equal(r.error,null,f);assert.deepEqual(topology(r).errors,[],f);
    const d=display.parseSLDPRT(raw,iR,iZ),nf=r.nodes.filter(n=>n.type===14).length;
    assert.equal(nf,d.faces.length,f+': native faces = display faces');
    if(/PTC GE8080-8/.test(f)){assert.match(b.source,/Config-0-FeatureBodies\/LocalBodies$/);assert.equal(nf,126);}
    else assert.match(b.source,/Config-0-Partition$/);
    files++;faces+=nf;nodes+=r.nodes.length;
  }
  assert.equal(files,21);assert.equal(faces,1272);t.diagnostic(`${files} files, ${nodes} nodes, ${faces} faces`);
});

test('display layer joins the native body: IDs, surface types, and the mesh lies on the surfaces',needsCorpus,t=>{
  const TYPE={4001:'PLANE',4002:'CYLINDER',4003:'CONE',4004:'SPHERE',4005:'TORUS',4006:'B_SURFACE',4007:'BLENDED_EDGE',4009:'SWEPT_SURF'};
  const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>Math.hypot(...a),scale=(a,k)=>a.map(x=>x*k);
  function residual(s,p){const v=s.values;
    switch(s.type){
      case 50:return dot(sub(p,v.pvec),v.normal);
      case 51:{const d=sub(p,v.pvec),h=dot(d,v.axis);return norm(sub(d,scale(v.axis,h)))-v.radius;}
      case 52:{const d=sub(p,v.pvec),h=dot(d,v.axis),rho=norm(sub(d,scale(v.axis,h)));return (rho-(v.radius+h*v.sin_half_angle/v.cos_half_angle))*v.cos_half_angle;}
      case 53:return norm(sub(p,v.centre))-v.radius;
      case 54:{const d=sub(p,v.centre),h=dot(d,v.axis),rad=sub(d,scale(v.axis,h)),rho=norm(rad);return norm(sub(d,scale(rad,v.major_radius/rho)))-v.minor_radius;}
    }return null;}
  let faces=0,ids=0,edges=0,empty=0,typed=0,evaluated=0,onSurface=0;
  for(const f of [...walk(path.join(CORPUS,'test files new/SW2022')),...walk(path.join(CORPUS,'test files original'))]){
    const raw=fs.readFileSync(f);if(modern.isOLE2(raw))continue;
    const r=P.readBody(raw).parsed,m=new Map(r.nodes.map(n=>[n.index,n])),byId=new Map(r.nodes.filter(n=>n.type===14).map(n=>[n.values.node_id,n]));
    for(const df of display.parseSLDPRT(raw,iR,iZ).faces){
      faces++;const nf=byId.get(df.metadata.rawId);assert(nf,f+': rawId');ids++;
      const want=new Set();for(let l=nf.values.loop;l;l=m.get(l).values.next){const first=m.get(l).values.fin;let x=first;do{const fin=m.get(x);if(fin.values.edge)want.add(m.get(fin.values.edge).values.node_id);x=fin.values.forward;}while(x!==first);}
      const got=new Set(df.metadata.edgeRecords.map(e=>e.id)),b1=new Set(df.edgeAnnotations.map(e=>e.id).filter(Boolean));
      if(got.size||!want.size){assert.deepEqual(got,want,f);edges++;}else empty++;
      assert.deepEqual(b1,want,f+': Block1 edge IDs');
      const s=m.get(nf.values.surface);assert.equal(s.name,TYPE[df.metadata.typeTag],f+': tag '+df.metadata.typeTag);typed++;
      if(residual(s,[0,0,0])===null)continue;
      evaluated++;let max=0;for(let i=0;i<df.vertexCount;i++)max=Math.max(max,Math.abs(residual(s,[df.vertices[3*i],df.vertices[3*i+1],df.vertices[3*i+2]])));
      if(max<=1e-6)onSurface++;
    }
  }
  assert.equal(faces,1414);assert.equal(ids,1414);assert.equal(typed,1414);assert.equal(edges+empty,1414);assert.equal(empty,6);
  // EXP-074: 796 of 1,024 analytic faces carry every display vertex within 1e-6 m; the rest are
  // boundary chord points (docs/format/parasolid.md). Guard the count against regression.
  assert.equal(evaluated,1024);assert.equal(onSurface,796);
  t.diagnostic(`${faces} faces joined by ID, ${edges} edge tables equal (+${empty} empty, C23), ${typed} tags = native type, ${onSurface}/${evaluated} analytic faces fully on-surface`);
});

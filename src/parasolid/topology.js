'use strict';
/* Graph checks over a parsed Parasolid body (output of xt.parse).
 *
 * Checks face/loop ownership, loop fin rings, reciprocal forward/backward fins, two-fin edge
 * rings with opposite senses, vertex -> point references, and B-spline control/knot array sizes
 * and knot order. Returns {checks, errors, rings}; an empty `errors` means every check passed.
 *
 * Moved verbatim from the EXP-071 audit (function `topology`).
 */
function topology(r){
  const m=new Map(r.nodes.map(n=>[n.index,n])),errors=[],rings=[];let checks=0;
  const test=(ok,msg)=>{checks++;if(!ok)errors.push(msg);};
  const target=(n,key,types,required=false)=>{const p=n.values[key];if(!p){test(!required,`${n.index}.${key}: missing`);return null;}const v=m.get(p);test(!!v&&types.includes(v.type),`${n.index}.${key} -> ${p}: type`);return v;};
  for(const n of r.nodes){const v=n.values;
    if(n.type===14){target(n,'surface',[50,51,52,53,54,56,59,67,124],true);target(n,'shell',[13],true);target(n,'front_shell',[13],true);
      let i=v.loop,seen=new Set();while(i){if(seen.has(i)){errors.push(`face ${n.index}: loop chain cycle`);break;}seen.add(i);const l=m.get(i);test(l?.type===15&&l.values.face===n.index,`face ${n.index}: loop ownership ${i}`);if(!l)break;i=l.values.next;}}
    if(n.type===15){target(n,'face',[14],true);const first=v.fin;let i=first,seen=new Set();do{const f=m.get(i);test(f?.type===17&&f.values.loop===n.index,`loop ${n.index}: fin ${i}`);if(!f||seen.has(i))break;seen.add(i);i=f.values.forward;}while(i!==first&&seen.size<=r.nodes.length);test(i===first&&seen.size>0,`loop ${n.index}: open fin ring`);rings.push({loop:n.index,fins:[...seen]});}
    if(n.type===17){target(n,'edge',[16]);target(n,'vertex',[18]);if(v.loop){const f=target(n,'forward',[17],true),b=target(n,'backward',[17],true);test(f?.values.backward===n.index,`fin ${n.index}: forward/backward`);test(b?.values.forward===n.index,`fin ${n.index}: backward/forward`);}
      if(v.edge){const o=target(n,'other',[17],true);test(o?.values.edge===v.edge,`fin ${n.index}: other edge`);}}
    if(n.type===16){const f=target(n,'fin',[17],true);test(f?.values.edge===n.index,`edge ${n.index}: fin owner`);if(f){const other=m.get(f.values.other);test(other?.values.other===f.index,`edge ${n.index}: two-fin ring`);test(other?.values.sense!==f.values.sense,`edge ${n.index}: opposite senses`);}}
    if(n.type===18)target(n,'point',[29],true);
    if(n.type===136||n.type===126){const surf=n.type===126,cv=target(n,'bspline_vertices',[45],true),expected=(surf?v.n_u_vertices*v.n_v_vertices:v.n_vertices)*v.vertex_dim;test(cv?.length===expected,`NURBS ${n.index}: control size`);
      for(const axis of surf?['u_','v_']:['']){const mult=target(n,axis+'knot_mult',[127],true),knots=target(n,axis+'knots',[128],true);const nk=v[surf?'n_'+axis+'knots':'n_knots'];test(mult?.length===nk&&knots?.length===nk,`NURBS ${n.index}: knot sizes`);if(knots)test(knots.values.knots.every((x,i,a)=>i===0||x>a[i-1]),`NURBS ${n.index}: knot order`);}}
  }
  return {checks,errors,rings};
}

/* Counts by node name, e.g. {BODY:1, FACE:6, EDGE:12, ...}. */
function census(r){return r.nodes.reduce((a,n)=>(a[n.name]=(a[n.name]||0)+1,a),{});}

module.exports={topology,census};

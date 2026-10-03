'use strict';
/* Parasolid XT transmit reader: text (.x_t) and neutral binary (.x_b / inflated partition).
 *
 * Reads the header, the schema-edit scripts against base schema 13006, and every typed node up
 * to the terminator. Unknown schema => stop there with an error; it never scans forward to a
 * convenient marker. Field layouts follow the public Parasolid XT Format Reference (October
 * 2006); deviations found on our corpus are listed in docs/format/parasolid.md.
 *
 *   parse(bytes, binary[, {maxNodes}]) -> {header, nodes, edits, spans, terminated, error, unresolved}
 *
 * Node.js only (uses Buffer). Moved verbatim from the EXP-071 research reader.
 */
const fs=require('fs');
const spec=s=>s.split(' ').map(x=>{const [name,kind,n]=x.split(':');return {name,kind,count:n==='*'?'*':Number(n||1)};});
const geometry='node_id:d attributes_groups:p owner:p next:p previous:p geometric_owner:p sense:c';
const bases={
  12:spec('highest_node_id:d attributes_groups:p attribute_chains:p surface:p curve:p point:p key:p res_size:f res_linear:f ref_instance:p next:p previous:p state:u owner:p body_type:u nom_geom_state:u shell:p boundary_surface:p boundary_curve:p boundary_point:p region:p edge:p vertex:p'),
  13:spec('node_id:d attributes_groups:p body:p next:p face:p edge:p vertex:p region:p front_face:p'),
  14:spec('node_id:d attributes_groups:p tolerance:f next:p previous:p loop:p shell:p surface:p sense:c next_on_surface:p previous_on_surface:p next_front:p previous_front:p front_shell:p'),
  15:spec('node_id:d attributes_groups:p fin:p face:p next:p'),
  16:spec('node_id:d attributes_groups:p tolerance:f fin:p previous:p next:p curve:p next_on_curve:p previous_on_curve:p owner:p'),
  17:spec('attributes_groups:p loop:p forward:p backward:p vertex:p other:p edge:p curve:p next_at_vx:p sense:c'),
  18:spec('node_id:d attributes_groups:p fin:p previous:p next:p point:p tolerance:f owner:p'),
  19:spec('node_id:d attributes_groups:p body:p next:p previous:p shell:p type:c'),
  29:spec('node_id:d attributes_groups:p owner:p next:p previous:p pvec:v'),
  30:spec(geometry+' pvec:v direction:v'),
  31:spec(geometry+' centre:v normal:v x_axis:v radius:f'),
  32:spec(geometry+' centre:v normal:v x_axis:v major_radius:f minor_radius:f'),
  38:spec(geometry+' surface:p:2 chart:p start:p end:p'),
  40:spec('base_parameter:f base_scale:f chart_count:d chordal_error:f angular_error:f parameter_error:f:2 hvec:h:*'),
  41:spec('type:c hvec:h:*'),
  45:spec('vertices:f:*'),
  50:spec(geometry+' pvec:v normal:v x_axis:v'),
  51:spec(geometry+' pvec:v axis:v radius:f x_axis:v'),
  52:spec(geometry+' pvec:v axis:v radius:f sin_half_angle:f cos_half_angle:f x_axis:v'),
  53:spec(geometry+' centre:v radius:f axis:v x_axis:v'),
  54:spec(geometry+' centre:v axis:v major_radius:f minor_radius:f x_axis:v'),
  56:spec(geometry+' blend_type:c surface:p:2 spine:p range:f:2 thumb_weight:f:2 boundary:p:2 start:p end:p'),
  59:spec(geometry+' boundary:n blend:p'),
  67:spec(geometry+' section:p sweep:v scale:f'),
  // Candidate base-effective LIST fields: the edit script consumes nine, not
  // the twelve shown in the later reference struct. Verified through traversal.
  70:spec('node_id:d owner:p next:p previous:p list_type:d list_length:d block_length:d size_of_entry:d list_block:p'),
  74:spec('n_entries:d next_block:p entries:p:*'),
  79:spec('string:c:*'),
  80:spec('next:p identifier:p type_id:d actions:u:8 field_names:p legal_owners:l:14 fields:u:*'),
  81:spec('node_id:d definition:p owner:p next:p previous:p next_of_type:p previous_of_type:p fields:p:*'),
  82:spec('values:d:*'),83:spec('values:f:*'),84:spec('values:c:*'),
  98:spec('values:w:*'),
  101:spec('assembly:p attribute:p body:p transform:p surface:p curve:p point:p alive:l attrib_def:p highest_id:d current_id:d'),
  124:spec(geometry+' nurbs:p data:p'),134:spec(geometry+' nurbs:p data:p'),
  125:spec('original_uint:i original_vint:i extended_uint:i extended_vint:i self_int:u original_u_start:c original_u_end:c original_v_start:c original_v_end:c extended_u_start:c extended_u_end:c extended_v_start:c extended_v_end:c analytic_form_type:c swept_form_type:c spun_form_type:c blend_form_type:c analytic_form:p swept_form:p spun_form:p blend_form:p'),
  126:spec('u_periodic:l v_periodic:l u_degree:n v_degree:n n_u_vertices:d n_v_vertices:d u_knot_type:u v_knot_type:u n_u_knots:d n_v_knots:d rational:l u_closed:l v_closed:l surface_form:u vertex_dim:n bspline_vertices:p u_knot_mult:p v_knot_mult:p u_knots:p v_knots:p'),
  127:spec('mult:n:*'),128:spec('knots:f:*'),
  133:spec(geometry+' basis_curve:p point_1:v point_2:v parm_1:f parm_2:f'),
  135:spec('self_int:u analytic_form:p'),
  136:spec('degree:n n_vertices:d vertex_dim:n n_knots:d knot_type:u periodic:l closed:l rational:l curve_form:u bspline_vertices:p knot_mult:p knots:p'),
  137:spec(geometry+' surface:p b_curve:p original:p tolerance_to_original:f'),
  141:spec('owner:p next:p previous:p shared_geometry:p')
};
const names={12:'BODY',13:'SHELL',14:'FACE',15:'LOOP',16:'EDGE',17:'FIN',18:'VERTEX',19:'REGION',29:'POINT',30:'LINE',50:'PLANE',70:'LIST',74:'POINTER_LIS_BLOCK',79:'ATT_DEF_ID',80:'ATTRIB_DEF',81:'ATTRIBUTE',82:'INT_VALUES',83:'REAL_VALUES',84:'CHAR_VALUES'};
Object.assign(names,{31:'CIRCLE',32:'ELLIPSE',51:'CYLINDER',52:'CONE',53:'SPHERE',54:'TORUS',124:'B_SURFACE',134:'B_CURVE',137:'SP_CURVE'});
Object.assign(names,{45:'BSPLINE_VERTICES',125:'SURFACE_DATA',126:'NURBS_SURF',127:'KNOT_MULT',128:'KNOT_SET',133:'TRIMMED_CURVE',135:'CURVE_DATA',136:'NURBS_CURVE'});
names[141]='GEOMETRIC_OWNER';
names[101]='WORLD';
Object.assign(names,{38:'INTERSECTION',40:'CHART',41:'LIMIT',67:'SWEPT_SURF'});
Object.assign(names,{56:'BLENDED_EDGE',59:'BLEND_BOUND',98:'UNICODE_VALUES'});
class Reader {
  constructor(raw,binary){this.raw=raw;this.binary=binary;this.s=raw.toString('latin1').replace(/[\r\n]/g,'');this.p=0;this.spans=[];}
  need(n){if(this.p+n>(this.binary?this.raw.length:this.s.length))throw Error('truncated at '+this.p);}
  byte(){this.need(1);return this.binary?this.raw[this.p++]:this.s.charCodeAt(this.p++);}
  chr(){return String.fromCharCode(this.byte());}
  num(kind){
    if(!this.binary){
      if(this.s[this.p]==='?'){this.p++;return null;}
      const m=/^[^ ]+/.exec(this.s.slice(this.p));if(!m)throw Error('number at '+this.p);
      const re=kind==='f'?/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/:/^[+-]?\d+$/;
      if(!re.test(m[0]))throw Error('invalid '+kind+' token at '+this.p+': '+m[0].slice(0,30));
      this.p+=m[0].length;if(this.p<this.s.length){if(this.s[this.p++]!==' ')throw Error('number separator');}
      const v=Number(m[0]);if(!Number.isFinite(v)||(kind!=='f'&&!Number.isSafeInteger(v)))throw Error('numeric range');return v;
    }
    const n={u:1,l:1,n:2,w:2,d:4,f:8}[kind];if(!n)throw Error('unknown numeric type '+kind);this.need(n);
    let v=kind==='f'?this.raw.readDoubleBE(this.p):n===1?this.raw[this.p]:n===2?this.raw.readInt16BE(this.p):this.raw.readInt32BE(this.p);this.p+=n;
    return v===(kind==='f'?-3.14158e13:-32764)?null:v;
  }
  ptr(){if(!this.binary)return this.num('d');this.need(2);const r=this.raw.readInt16BE(this.p);this.p+=2;if(r===0)throw Error('invalid pointer code');if(r>0)return r-1;this.need(2);const q=this.raw.readInt16BE(this.p);this.p+=2;if(q<=0)throw Error('invalid long pointer');return q*32767-r-1;}
  str(n){if(!Number.isInteger(n)||n<0||n>1000000)throw Error('string length');let out='';while(out.length<n){let c=this.chr();if(!this.binary&&c==='\\'){c=this.chr();const escapes={'0':'\0','n':'\r','r':'\n','\\':'\\','9':'         '};if(!(c in escapes))throw Error('unknown escape');out+=escapes[c];}else out+=c;}if(out.length!==n)throw Error('escape crosses string boundary');return out;}
  shortstr(){return this.str(this.num(this.binary?'u':'d'));}
  value(kind){if(kind==='p')return this.ptr();if(kind==='c')return this.chr();if(kind==='l'){const v=this.binary?this.num('u'):this.chr();if(![0,1,'F','T'].includes(v))throw Error('logical value');return v===1||v==='T';}
    if('vihb'.includes(kind)){if(!this.binary&&this.s[this.p]==='?'){this.p++;return null;}const n={v:3,h:3,i:2,b:6}[kind];return Array.from({length:n},()=>this.num('f'));}return this.num(kind);}
  mark(start,label,value,extra={}){this.spans.push({start,end:this.p,label,value,...extra});}
  scalar(kind,label){const start=this.p,v=this.value(kind);this.mark(start,label,v);return v;}
  header(){
    const marker='**END_OF_HEADER',at=this.raw.indexOf(marker);if(at<0&&!(this.binary&&this.raw.subarray(0,4).equals(Buffer.from([80,83,0,0]))))throw Error('missing banner');
    if(this.binary){this.p=at<0?0:this.raw.indexOf(10,at)+1;if(at>=0&&!this.p)throw Error('unterminated banner');const start=this.p;if(this.str(4)!=='PS\0\0')throw Error('neutral binary magic');this.mark(start,'neutral_binary_magic','PS0000');}
    else {this.p=this.s.indexOf(marker)+marker.length;while(this.s[this.p]==='*')this.p++;if(this.chr()!=='T')throw Error('text magic');}
    const dl=this.scalar(this.binary?'n':'d','description_length');let start=this.p;const description=this.str(dl);this.mark(start,'description',description);
    const sl=this.scalar('d','schema_name_length');start=this.p;const schema=this.str(sl);this.mark(start,'schema_name',schema);
    if(!/^SCH_\d+_\d+_13006$/.test(schema))throw Error('unsupported schema base '+schema);
    const maxTypes=this.scalar('n','max_node_types'),userfields=this.scalar('d','userfield_size');if(userfields!==0)throw Error('nonzero userfield size unsupported');
    return {schema,description,maxTypes,userfields};
  }
  field(){const name=this.shortstr(),ptrClass=this.num('n'),n=this.ptr();if(!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name)||!Number.isInteger(n)||n<0)throw Error('invalid field descriptor');let kind='p';if(!ptrClass)kind=this.shortstr();if(!'uc lnwdpfivbh'.replaceAll(' ','').includes(kind)||kind.length!==1)throw Error('field kind '+kind);let transmit=true;if(n===1)transmit=this.value('l');return {name,kind,count:n===0?1:n===1?'*':n,ptrClass,transmit};}
}
function parse(raw,binary,options={}){
  const r=new Reader(raw,binary),nodes=[],indices=new Set(),schemas={},edits=[];let header=null,terminated=false,error=null;
  try {header=r.header();while(nodes.length<(options.maxNodes||200000)){
    const start=r.p,type=r.scalar('n','node_type');
    if(type===1){const index=r.scalar('p','terminator_index');if(index!==0)throw Error('nonzero terminator');terminated=true;break;}
    if(!schemas[type]){
      const ss=r.p,declared=r.num('u'),base=bases[type];let fields=[],cursor=0,ops='',description=null;
      if(!base){if(declared===255)throw Error('missing base schema for node type '+type+' at '+start);const name=r.shortstr();description=r.shortstr();if(!/^[A-Z][A-Z_0-9]*$/.test(name)||!/^[\x20-\x7e]+$/.test(description))throw Error('unsupported base or malformed new-type declaration '+type+' at '+start);names[type]=name;ops='NEW';for(let i=0;i<declared;i++)fields.push(r.field());}
      else if(declared===255)fields=base.map(x=>({...x}));else{while(true){const op=r.chr();ops+=op;if(op==='Z')break;if(op==='C'||op==='D'){if(cursor>=base.length)throw Error('base exhausted type '+type);if(op==='C')fields.push({...base[cursor]});cursor++;}else if(op==='I'||op==='A')fields.push(r.field());else throw Error('unknown edit '+op+' type '+type);}
        if(cursor!==base.length||fields.length!==declared)throw Error('schema count type '+type+': base '+cursor+'/'+base.length+' output '+fields.length+'/'+declared);}
      schemas[type]=fields;edits.push({type,name:names[type],description,start:ss,end:r.p,declared,ops,fields});r.mark(ss,'schema_edit',{type,declared,ops});
    }
    const fields=schemas[type];let length=null;if(fields.some(f=>f.count==='*')){length=r.scalar('d','variable_length');if(!Number.isInteger(length)||length<0||length>1000000)throw Error('variable length');}
    const index=r.scalar('p','node_index');if(!Number.isInteger(index)||index<=0||indices.has(index))throw Error('invalid/duplicate index '+index);indices.add(index);
    const values={},pointers=[];for(const f of fields){const at=r.p,n=f.count==='*'?length:f.count;let value;
      if(f.count==='*'&&f.transmit===false){value=null;}else if(f.kind==='c'&&f.count==='*')value=r.str(n);else if(f.count==='*'||f.count!==1)value=Array.from({length:n},()=>r.value(f.kind));else value=r.value(f.kind);
      values[f.name]=value;if(f.kind==='p')for(const target of Array.isArray(value)?value:[value])if(target)pointers.push({field:f.name,target});r.mark(at,`${names[type]}.${f.name}`,value,{kind:f.kind,node:index});}
    nodes.push({type,name:names[type],index,start,end:r.p,length,values,pointers});
  }
  if(!terminated)throw Error('node limit reached before terminator');
  if(r.p!==(binary?raw.length:r.s.length))throw Error('trailing content at '+r.p);
  }catch(e){error=e.message;}
  const byIndex=new Map(nodes.map(n=>[n.index,n]));const unresolved=nodes.flatMap(n=>n.pointers.filter(p=>!byIndex.has(p.target)).map(p=>({from:n.index,...p})));
  return {header,binary,nodes,edits,spans:r.spans,consumed:r.p,total:binary?raw.length:r.s.length,terminated,error,unresolved};
}
if(require.main===module){const file=process.argv[2];const r=parse(fs.readFileSync(file),file.endsWith('.x_b'));console.log(JSON.stringify({header:r.header,nodes:r.nodes.length,counts:r.nodes.reduce((a,n)=>(a[n.name]=(a[n.name]||0)+1,a),{}),consumed:r.consumed,total:r.total,terminated:r.terminated,error:r.error,unresolved:r.unresolved.slice(0,10),last:r.nodes.at(-1)},null,2));}
module.exports={parse,Reader,bases,names};

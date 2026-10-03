/* PKWARE Data Compression Library "implode" decompressor (the format zlib's contrib/blast
 * reads). Pre-2011 SolidWorks files use it for `DisplayLists__Zip` and `Config-0-Body`.
 *
 * Stream: one byte 0/1 (literals raw / Huffman coded), one byte 4–6 (dictionary 1, 2 or 4 KB),
 * then bits, least significant first. Huffman codes are stored inverted. A length of 519 ends
 * the stream. The fixed code tables below are the ones in the PKWARE format, written as
 * run-length pairs: low nibble = code length, high nibble + 1 = how many symbols have it.
 *
 *   blast(bytes) -> {data: Buffer (Uint8Array in a browser), consumed: input bytes used}
 * Loads as a plain script too, defining SLDPRTBlast.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SLDPRTBlast=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';
const LIT=[11,124,8,7,28,7,188,13,76,4,10,8,12,10,12,10,8,23,8,9,7,6,7,8,7,6,55,8,23,24,12,11,7,9,11,12,6,7,22,5,7,24,6,11,9,6,7,22,7,11,38,7,9,8,25,11,8,11,9,12,8,12,5,38,5,38,5,11,7,5,6,21,6,10,53,8,7,24,10,27,44,253,253,253,252,252,252,13,12,45,12,45,12,61,12,45,44,173];
const LEN=[2,35,36,53,38,23],DIST=[2,20,53,230,247,151,248];
const BASE=[3,2,4,5,6,7,8,9,10,12,16,24,40,72,136,264],EXTRA=[0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8];
const MAXBITS=13;

function huffman(rep){
  const lengths=[];for(const b of rep){let n=(b>>4)+1;while(n--)lengths.push(b&15);}
  const count=new Array(MAXBITS+1).fill(0);for(const l of lengths)count[l]++;
  const offs=[0,0];for(let l=1;l<MAXBITS;l++)offs[l+1]=offs[l]+count[l];
  const symbol=[];lengths.forEach((l,s)=>{if(l)symbol[offs[l]++]=s;});
  return {count,symbol};
}
const LITCODE=huffman(LIT),LENCODE=huffman(LEN),DISTCODE=huffman(DIST);

function blast(input,options={}){
  const src=input instanceof Uint8Array?input:new Uint8Array(input);const limit=options.maxOutput||(256<<20);
  let pos=0,bitbuf=0,bitcnt=0;
  const bit=()=>{if(!bitcnt){if(pos>=src.length)throw Error('blast: input ends early');bitbuf=src[pos++];bitcnt=8;}const b=bitbuf&1;bitbuf>>=1;bitcnt--;return b;};
  const bits=n=>{let v=0;for(let i=0;i<n;i++)v|=bit()<<i;return v;};
  const decode=h=>{let code=0,first=0,index=0;
    for(let len=1;len<=MAXBITS;len++){code|=bit()^1;const c=h.count[len];
      if(code-first<c)return h.symbol[index+code-first];index+=c;first=(first+c)<<1;code<<=1;}
    throw Error('blast: bad code');};
  const lit=bits(8);if(lit>1)throw Error('blast: literal flag '+lit);
  const dict=bits(8);if(dict<4||dict>6)throw Error('blast: dictionary size '+dict);
  let out=new Uint8Array(Math.min(limit,Math.max(1024,src.length*8))),n=0;
  const put=b=>{if(n===out.length){if(n>=limit)throw Error('blast: output limit');const o=new Uint8Array(Math.min(limit,n*2));o.set(out);out=o;}out[n++]=b;};
  for(;;){
    if(bit()){
      const s=decode(LENCODE),len=BASE[s]+bits(EXTRA[s]);if(len===519)break;
      const sh=len===2?2:dict,dist=(decode(DISTCODE)<<sh)+bits(sh)+1;
      if(dist>n)throw Error('blast: distance too far back');
      for(let i=0;i<len;i++)put(out[n-dist]);
    }else put(lit?decode(LITCODE):bits(8));
  }
  return {data:typeof Buffer!=='undefined'?Buffer.from(out.buffer,out.byteOffset,n):out.subarray(0,n),consumed:pos};
}

return {blast};
});

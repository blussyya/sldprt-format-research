/* Synchronous DEFLATE decoder (RFC 1951) + zlib wrapper (RFC 1950).
 *
 * parser/v0.1 takes its decompressors by injection so it stays isomorphic: Node hands it
 * zlib.inflateRawSync / zlib.inflateSync. The browser has no synchronous equivalent --
 * DecompressionStream is async -- so this supplies one, keeping the viewers dependency-free
 * like the rest of the project.
 *
 * Decoding follows the canonical "puff" method: walk code lengths one bit at a time against
 * per-length counts, which needs no lookup tables and is easy to verify.
 *
 * Verified byte-for-byte against Node's zlib over every openswx stream in the corpus plus
 * randomised fuzz -- see viewer/test-inflate.js.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SLDPRTInflate=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  var LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEXTRA=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,
             4097,6145,8193,12289,16385,24577];
  var DEXTRA=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function Out(){ this.buf=new Uint8Array(1<<16); this.len=0; }
  Out.prototype.need=function(n){
    if(this.len+n<=this.buf.length)return;
    var cap=this.buf.length;
    while(cap<this.len+n)cap*=2;
    var nb=new Uint8Array(cap); nb.set(this.buf.subarray(0,this.len)); this.buf=nb;
  };
  Out.prototype.push=function(b){ this.need(1); this.buf[this.len++]=b; };
  Out.prototype.done=function(){ return this.buf.slice(0,this.len); };

  function build(lengths,n){
    var counts=new Int32Array(16),i;
    for(i=0;i<n;i++)counts[lengths[i]]++;
    counts[0]=0;
    var offs=new Int32Array(16);
    for(i=1;i<16;i++)offs[i]=offs[i-1]+counts[i-1];
    var symbols=new Int32Array(n);
    for(i=0;i<n;i++)if(lengths[i])symbols[offs[lengths[i]]++]=i;
    return {counts:counts,symbols:symbols};
  }

  function inflateRaw(input){
    var src=input instanceof Uint8Array?input:new Uint8Array(input);
    var pos=0,bitbuf=0,bitcnt=0,out=new Out();

    function bits(need){
      var val=bitbuf;
      while(bitcnt<need){
        if(pos>=src.length)throw new Error('inflate: out of input');
        val|=src[pos++]<<bitcnt; bitcnt+=8;
      }
      bitbuf=val>>>need; bitcnt-=need;
      return val&((1<<need)-1);
    }
    function decode(h){
      var code=0,first=0,index=0,len,count;
      for(len=1;len<=15;len++){
        code|=bits(1);
        count=h.counts[len];
        if(code-first<count)return h.symbols[index+(code-first)];
        index+=count; first+=count; first<<=1; code<<=1;
      }
      throw new Error('inflate: invalid code');
    }
    function block(lit,dist){
      for(;;){
        var sym=decode(lit);
        if(sym<256){ out.push(sym); continue; }
        if(sym===256)return;
        sym-=257;
        if(sym>=29)throw new Error('inflate: invalid length symbol');
        var len=LBASE[sym]+bits(LEXTRA[sym]);
        var dsym=decode(dist);
        if(dsym>=30)throw new Error('inflate: invalid distance symbol');
        var d=DBASE[dsym]+bits(DEXTRA[dsym]);
        if(d>out.len)throw new Error('inflate: distance before start');
        out.need(len);
        var from=out.len-d;
        for(var i=0;i<len;i++)out.buf[out.len++]=out.buf[from+i];
      }
    }

    var fixedLit=null,fixedDist=null;
    function fixed(){
      if(!fixedLit){
        var l=new Int32Array(288),i;
        for(i=0;i<144;i++)l[i]=8;
        for(;i<256;i++)l[i]=9;
        for(;i<280;i++)l[i]=7;
        for(;i<288;i++)l[i]=8;
        fixedLit=build(l,288);
        var d=new Int32Array(30);
        for(i=0;i<30;i++)d[i]=5;
        fixedDist=build(d,30);
      }
      block(fixedLit,fixedDist);
    }
    function dynamic(){
      var nlen=bits(5)+257,ndist=bits(5)+1,ncode=bits(4)+4,i;
      if(nlen>286||ndist>30)throw new Error('inflate: bad counts');
      var cl=new Int32Array(19);
      for(i=0;i<ncode;i++)cl[CLORDER[i]]=bits(3);
      var clh=build(cl,19);
      var lengths=new Int32Array(nlen+ndist);
      i=0;
      while(i<nlen+ndist){
        var sym=decode(clh),n,v;
        if(sym<16){ lengths[i++]=sym; continue; }
        if(sym===16){
          if(i===0)throw new Error('inflate: no previous length');
          v=lengths[i-1]; n=3+bits(2);
        } else if(sym===17){ v=0; n=3+bits(3); }
        else { v=0; n=11+bits(7); }
        if(i+n>nlen+ndist)throw new Error('inflate: too many lengths');
        while(n--)lengths[i++]=v;
      }
      block(build(lengths.subarray(0,nlen),nlen),
            build(lengths.subarray(nlen),ndist));
    }

    var last;
    do{
      last=bits(1);
      var type=bits(2);
      if(type===0){
        bitbuf=0; bitcnt=0;                       // stored blocks are byte-aligned
        if(pos+4>src.length)throw new Error('inflate: truncated stored block');
        var l=src[pos]|(src[pos+1]<<8), nl=src[pos+2]|(src[pos+3]<<8);
        pos+=4;
        if((l^0xffff)!==nl)throw new Error('inflate: stored length mismatch');
        if(pos+l>src.length)throw new Error('inflate: truncated stored data');
        out.need(l);
        out.buf.set(src.subarray(pos,pos+l),out.len);
        out.len+=l; pos+=l;
      }
      else if(type===1)fixed();
      else if(type===2)dynamic();
      else throw new Error('inflate: reserved block type');
    }while(!last);
    return out.done();
  }

  function inflate(input){
    var src=input instanceof Uint8Array?input:new Uint8Array(input);
    if(src.length<2)throw new Error('inflate: too short for a zlib header');
    var cmf=src[0],flg=src[1];
    if((cmf&0x0f)!==8)throw new Error('inflate: not deflate');
    if(((cmf<<8)|flg)%31!==0)throw new Error('inflate: bad zlib header check');
    if(flg&0x20)throw new Error('inflate: preset dictionary unsupported');
    return inflateRaw(src.subarray(2));           // trailing adler32 is ignored
  }

  return {inflateRaw:inflateRaw,inflate:inflate};
});

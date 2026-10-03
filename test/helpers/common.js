'use strict';
/* Shared pieces for the tests. */
const zlib=require('zlib'),crypto=require('crypto');
const {findCorpus}=require('./corpus');
const MAX=128*1024*1024;
const iR=b=>zlib.inflateRawSync(b,{maxOutputLength:MAX}),iZ=b=>zlib.inflateSync(b,{maxOutputLength:MAX});
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
/* JSON with typed arrays and Buffers flattened, so Node-zlib and browser-inflate results compare. */
const canonical=r=>JSON.stringify(r,(_,v)=>{if(ArrayBuffer.isView(v))return Array.from(v);if(v&&v.type==='Buffer'&&Array.isArray(v.data))return v.data;return v;});
const CORPUS=findCorpus();
/* node:test option object: skip the whole test with a reason when the corpus is absent. */
const needsCorpus={skip:CORPUS?false:'corpus not found: clone sldprt-research-dump next to this repo or set SLDPRT_CORPUS'};
module.exports={iR,iZ,sha256,canonical,CORPUS,needsCorpus};

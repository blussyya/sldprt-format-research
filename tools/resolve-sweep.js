#!/usr/bin/env node
'use strict';
/* Resolve the exact B-rep of every part given and print one line each: ok with the largest curve
 * and surface fit error, or the error that stopped it. With --baseline <file> (an earlier run's
 * output) it also lists every part that got worse: one that stopped resolving, or whose fit error
 * grew by more than half. Each part runs in its own process with --timeout seconds (default 300).
 *
 *   node tools/resolve-sweep.js [--converter <path>] [--baseline <file>] [--timeout N] <parts…>
 *
 * The converter defaults to ../solidworks-converters next to this repo. */
const path=require('path'),fs=require('fs'),{spawnSync}=require('child_process');
const a=process.argv.slice(2),opt=(n,d)=>{const i=a.indexOf(n);if(i<0)return d;const v=a[i+1];a.splice(i,2);return v;};
const conv=path.resolve(opt('--converter',path.join(__dirname,'../../solidworks-converters'))),base=opt('--baseline',null),timeout=+opt('--timeout',300);
const one=`const I=require(${JSON.stringify(conv+'/src')}),N=require(${JSON.stringify(conv+'/src/brep/native')}),P=require(${JSON.stringify(conv+'/src/brep/procedural')});
try{const R=P.resolve(N.build(I.readBrep(require('fs').readFileSync(process.argv[1])).parsed));console.log('ok',R.report.errors.curve,R.report.errors.surface);}catch(e){console.log('ERR',e.message);}`;
const key=f=>path.basename(f).slice(0,32);
const was=new Map();
if(base)for(const l of fs.readFileSync(base,'utf8').split('\n')){const m=/^(.{32}) (ok curve (\S+) surface (\S+)|ERR)/.exec(l);if(m)was.set(m[1].trimEnd(),m[3]?{c:+m[3],s:+m[4]}:null);}
const worse=[];
for(const f of a){const t=Date.now(),r=spawnSync(process.execPath,['-e',one,f],{encoding:'utf8',timeout:timeout*1000});
  const out=(r.stdout||'').trim().split('\n').pop()||'',k=key(f),name=k.padEnd(32);
  if(r.error||!out){console.log(name,'ERR timed out after',timeout,'s');if(was.get(k))worse.push(k+' timed out');continue;}
  const m=/^ok (\S+) (\S+)/.exec(out);
  if(m){const c=+m[1],s=+m[2];console.log(name,'ok curve',c.toExponential(2),'surface',s.toExponential(2),(Date.now()-t)+'ms');
    const b=was.get(k);if(b&&((c>b.c*1.5&&c>1e-9)||(s>b.s*1.5&&s>1e-9)))worse.push(k+' fit error grew');}
  else{console.log(name,out);if(was.get(k))worse.push(k+' stopped resolving');}}
if(base){console.log(worse.length?'\nworse than the baseline:\n'+worse.join('\n'):'\nnothing worse than the baseline');process.exitCode=worse.length?1:0;}

'use strict';
/* Locate the research corpus (the .SLDPRT test files and their STEP/STL/X_T exports).
 *
 * The corpus lives in the dump repository, not here:
 *   git clone https://github.com/blussyya/sldprt-research-dump ../sldprt-research-dump
 *
 * Search order: explicit argument, $SLDPRT_CORPUS, ../sldprt-research-dump next to this repo.
 * A directory qualifies when it contains "test files new" and "test files original".
 */
const fs=require('fs'),path=require('path');

function ok(dir){return !!dir&&fs.existsSync(path.join(dir,'test files new'))&&fs.existsSync(path.join(dir,'test files original'));}

function findCorpus(explicit){
  const repo=path.resolve(__dirname,'..','..');
  for(const c of [explicit,process.env.SLDPRT_CORPUS,path.join(repo,'..','sldprt-research-dump')])
    if(c&&ok(path.resolve(c)))return path.resolve(c);
  return null;
}

/* Every .sldprt under a directory, sorted for stable output. */
function walk(dir){
  const out=[];
  (function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/\.sldprt$/i.test(e.name))out.push(p);}})(dir);
  return out;
}

/* Per-model face counts SolidWorks reported, from a corpus BUILD_LOG.md. Keys like "sw2011/c00_cube_10mm". */
function buildLogFaceCounts(root){
  const log=fs.readFileSync(path.join(root,'test files new/SW2022/BUILD_LOG.md'),'utf8'),counts={};
  for(const s of log.split(/^## /m).slice(1)){const n=/Total face count:\s*`(\d+)`/.exec(s);if(n)counts[s.split('\n')[0].trim().toLowerCase()]=+n[1];}
  return counts;
}

/* Full build-log record per model: {faces, types:[...], volumeMm3}. Keys like "sw2022/c13_cone". */
function buildLog(root){
  const log=fs.readFileSync(path.join(root,'test files new/SW2022/BUILD_LOG.md'),'utf8'),out={};
  for(const s of log.split(/^## /m).slice(1)){
    const key=s.split('\n')[0].trim().toLowerCase(),n=/Total face count:\s*`(\d+)`/.exec(s);if(!n)continue;
    const v=/Measured volume:\s*`([\d.]+)`/.exec(s),types=[];
    const block=/Individual face surface types:\n((?:\s+\d+\. .*\n?)+)/.exec(s);
    if(block)for(const line of block[1].split('\n'))if(line.trim())types.push(line.replace(/^\s*\d+\.\s*/,'').trim());
    out[key]={faces:+n[1],types,volumeMm3:v?+v[1]:null};
  }
  return out;
}

module.exports={findCorpus,walk,buildLogFaceCounts,buildLog};

#!/usr/bin/env node
'use strict';
/* Runs every test/*.test.js with Node's built-in test runner. No dependencies.
 *
 *   npm test                          everything; corpus tests skip if the corpus is absent
 *   SLDPRT_CORPUS=/path npm test      point at the corpus explicitly (see test/README.md)
 */
const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const only=process.argv.slice(2);
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')&&(!only.length||only.some(o=>f.includes(o)))).sort().map(f=>path.join(__dirname,f));
const r=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exit(r.status===null?1:r.status);

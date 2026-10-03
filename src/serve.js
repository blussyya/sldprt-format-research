'use strict';
/**
 * Static server for the browser viewer (web/index.html).
 *
 * Serves the repository root so the page loads the real src/ files rather than copies.
 * Node's built-in http and fs only. Listens on 127.0.0.1 unless told otherwise; requests that
 * resolve outside the repository are refused.
 */
const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');
const {spawn}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const ENTRY='/web/index.html';

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
 '.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8',
 '.md':'text/plain; charset=utf-8','.wasm':'application/wasm','.map':'application/json',
 '.stl':'application/octet-stream','.step':'text/plain; charset=utf-8',
 '.sldprt':'application/octet-stream'};

function send(res,code,body,type,extra){
 res.writeHead(code,Object.assign({'Content-Type':type||'text/plain; charset=utf-8',
   'Cache-Control':'no-store'},extra||{}));
 res.end(body);
}

function handler(req,res){
 let pathname;
 try{ pathname=decodeURIComponent(url.parse(req.url).pathname||'/'); }
 catch(e){ return send(res,400,'Bad request'); }
 if(pathname==='/'||pathname==='/index.html')return send(res,302,'',null,{Location:ENTRY});
 if(pathname==='/favicon.ico')return send(res,204,'');
 const target=path.resolve(ROOT,'.'+path.posix.normalize(pathname));
 if(target!==ROOT&&!target.startsWith(ROOT+path.sep))return send(res,403,'Forbidden');
 fs.stat(target,function(err,st){
  if(err||!st.isFile())return send(res,404,'Not found: '+pathname+'\n');
  const type=TYPES[path.extname(target).toLowerCase()]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Content-Length':st.size,'Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
 });
}

function openBrowser(target){
 const child=process.platform==='win32'
  ? spawn('cmd',['/c','start','',target],{detached:true,stdio:'ignore'})
  : spawn(process.platform==='darwin'?'open':'xdg-open',[target],{detached:true,stdio:'ignore'});
 child.on('error',function(){ /* no browser here; the URL is printed anyway */ });
 child.unref();
}

/* start({port=8080, host='127.0.0.1', open=false}) -> Promise<{server, url}>.
 * If the port is busy it tries the next eleven. Port 0 binds any free port. */
function start(opts){
 opts=opts||{};
 const host=opts.host||'127.0.0.1';
 const server=http.createServer(handler);
 return new Promise(function(resolve,reject){
  function listen(port,attempt){
   server.once('error',function(e){
    if(e.code==='EADDRINUSE'&&port!==0&&attempt<12)return listen(port+1,attempt+1);
    reject(e);
   });
   server.listen(port,host,function(){
    // port 0 asks the OS for a free port: report the one actually bound
    const link='http://'+(host==='0.0.0.0'?'localhost':host)+':'+server.address().port+ENTRY;
    if(opts.open)openBrowser(link);
    resolve({server,url:link});
   });
  }
  const port=opts.port===undefined||opts.port===null||opts.port===''?8080:Number(opts.port);
  if(!Number.isInteger(port)||port<0||port>65535)return Promise.reject(Error('invalid port '+opts.port));
  listen(port,0);
 });
}

module.exports={start,ROOT,ENTRY};

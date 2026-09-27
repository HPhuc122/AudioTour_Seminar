const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/native/api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function client(fetchImpl){
 const exported={};let calls=0;const pending=new Set();
 vm.runInNewContext(source,{
  exports:exported,process:{env:{EXPO_PUBLIC_API_BASE_URL:'http://test.local'}},AbortController,Error,
  fetch:(...args)=>{calls++;return fetchImpl(...args)},
  setTimeout:(fn)=>{const timer=setTimeout(()=>{pending.delete(timer);fn()},15);pending.add(timer);return timer},
  clearTimeout:timer=>{pending.delete(timer);clearTimeout(timer)},
 });
 return {...exported,calls:()=>calls,pending};
}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
(async()=>{
 let c=client(async()=>response({success:true,data:[{code:'vi'}]}));
 assert.deepEqual(await c.audioTourApi.getLanguages(),[{code:'vi'}]);assert.equal(c.pending.size,0);
 c=client(async()=>{throw new TypeError('Network request failed')});
 await assert.rejects(c.audioTourApi.getLanguages(),/Không kết nối được máy chủ/);assert.equal(c.calls(),1);assert.equal(c.pending.size,0);
 c=client(async()=>response({detail:'Access denied'},403));
 await assert.rejects(c.audioTourApi.getLanguages(),e=>e instanceof c.ApiError&&e.status===403&&e.message==='Access denied');
 c=client(async()=>({ok:false,status:502,json:async()=>{throw new SyntaxError('html')}}));
 await assert.rejects(c.audioTourApi.getLanguages(),/Máy chủ trả dữ liệu không hợp lệ/);
 c=client(async()=>response(null));await assert.rejects(c.audioTourApi.getLanguages(),/Máy chủ trả dữ liệu không hợp lệ/);
 const hanging=async(url,init)=>new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})});
 c=client(hanging);await assert.rejects(c.audioTourApi.getLanguages(),/Kết nối quá lâu/);assert.equal(c.pending.size,0);
 c=client(hanging);await assert.rejects(c.audioTourApi.getTourRoute(1,'walking'),/Tìm đường quá lâu/);assert.equal(c.pending.size,0);
 c=client(async()=>{throw new TypeError('offline')});await assert.rejects(c.audioTourApi.startTargetAccess('poi',1));assert.equal(c.calls(),1,'No automatic retry of POST');
 console.log('API success, offline, HTTP errors, invalid JSON, timeout, route abort, timer cleanup, no POST retry: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});

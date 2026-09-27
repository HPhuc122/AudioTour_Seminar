const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src/native');
const cache = new Map();
const element = ({children, title, placeholder, accessibilityLabel}) => React.createElement('div', null, title, placeholder, accessibilityLabel, children);
const native = new Proxy({
  StyleSheet: { create: x => x, absoluteFill: {} },
  AppState: { currentState: 'active' },
  useWindowDimensions: () => ({width: 390, height: 800}),
  Modal: ({visible, children}) => visible ? React.createElement('div',null,children) : null,
}, { get: (target, key) => target[key] ?? element });
function load(name) {
  const file = path.resolve(root, name);
  if(cache.has(file)) return cache.get(file);
  const mod = {exports:{}}; cache.set(file,mod.exports);
  const filename = ['','.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  if(!filename) throw Error('Missing '+name);
  if(filename.endsWith('.json')) {const value=JSON.parse(fs.readFileSync(filename,'utf8'));cache.set(file,value);return value;}
  const source = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const req = id => {
    if(id==='react-native') return native;
    if(id==='react-native-safe-area-context') return {SafeAreaView:element};
    if(id==='react-native-webview') return {WebView:element};
    if(id==='expo-camera') return {CameraView:element,useCameraPermissions:()=>[{granted:false,canAskAgain:true},()=>{}]};
    if(id==='expo-location'||id==='expo-audio') return {};
    if(id==='@react-native-community/slider') return element;
    if(id==='./api') return {audioTourApi:{getImageUrl:()=>''}};
    if(id==='./paidAccessStore') return {};
    if(id.startsWith('.')) return load(id);
    return require(id);
  };
  vm.runInNewContext(source,{exports:mod.exports,require:req,module:mod,setTimeout,clearTimeout,console});
  return mod.exports;
}
const {UiLanguageContext,createTranslator}=load('i18n');
const noop=()=>{};
const cases=[
 ['DashboardScreen','DashboardScreen',{paidAccessRemainingSeconds:null,poiTotal:5,tourTotal:3,languageCode:'en',onMenu:noop},['No pass','Total tours','Total POIs','Paid audio','Language:']],
 ['MapPanel','MapPanel',{pois:[],languageCode:'en',target:null,onScan:noop,onDetail:noop},['Walking','Driving','My location','Choose start','Choose destination','Directions']],
 ['Sidebar','Sidebar',{visible:true,languageLabel:'English',onClose:noop,onNavigate:noop,onOpenQr:noop,onOpenLanguage:noop},['Guest','Scan QR','Language']],
 ['CatalogListScreen','CatalogListScreen',{kind:'poi',languageCode:'en',pois:[],tours:[],isLoading:false,onMenu:noop,onSelect:noop},['Search POIs by name','No public content available.']],
 ['CatalogDetailScreen','CatalogDetailScreen',{kind:'tour',languageCode:'en',detail:{id:1,name:'Example',code:'T1',pois:[]},onScan:noop,onMap:noop,onBack:noop},['Back to list','View map','Itinerary','Estimated duration:','No audio is available']],
 ['QrScanner','QrScanner',{onClose:noop,onCodeScanned:noop},['Enter QR code','Allow camera access','Confirm code','Close']],
 ['PoiImages','PoiImages',{name:'Example',images:[]},['No image']],
];
for(const [file,component,props,expected] of cases){
 const tree=React.createElement(UiLanguageContext.Provider,{value:'en'},React.createElement(load(file)[component],props));
 const markup=renderToStaticMarkup(tree);
 expected.forEach(label=>assert.ok(markup.includes(label),file+': missing '+label));
 assert.ok(!/[À-ỹ]/u.test(markup.replace(/<[^>]*>/g,'')),file+': untranslated Vietnamese text');
 console.log(file+': English render PASS');
}
const en=createTranslator('en-US'),vi=createTranslator('vi');
assert.equal(en('Chưa có vé'),'No pass');
assert.equal(vi('Chưa có vé'),'Chưa có vé');
assert.equal(en('Ngôn ngữ: '),'Language: ');
assert.equal(en('{0} giờ {1} phút',2,5),'2 hr 5 min');
assert.equal(en('Không tìm thấy {0} có tên chứa “{1}”.','POI','{0}'),'No POI names contain “{0}”.');
assert.equal(en('Example POI name'),'Example POI name');
console.log('Vietnamese / locale / interpolation / unknown content: PASS');

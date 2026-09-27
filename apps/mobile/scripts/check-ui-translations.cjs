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
  FlatList: ({data,renderItem,ListEmptyComponent,ListFooterComponent}) => React.createElement('div',null,data.length ? data.map((item,index)=>React.createElement(React.Fragment,{key:item.id??index},renderItem({item,index}))) : ListEmptyComponent,ListFooterComponent),
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
 ['CatalogListScreen','CatalogListScreen',{kind:'poi',languageCode:'en',pois:[],tours:[],poiTotal:0,hasMorePois:false,loadingMorePois:false,morePoisError:null,onLoadMorePois:noop,isLoading:false,onMenu:noop,onSelect:noop},['Search POIs by name','No public content available.']],
 ['CatalogDetailScreen','CatalogDetailScreen',{kind:'tour',languageCode:'en',detail:{id:1,name:'Example',code:'T1',pois:[]},onScan:noop,onMap:noop,onBack:noop},['Back to list','View map','Itinerary','Estimated duration:','No audio is available']],
 ['QrScanner','QrScanner',{onClose:noop,onCodeScanned:noop},['Enter QR code','Allow camera access','Confirm code','Close']],
 ['PoiImages','PoiImages',{name:'Example',images:[]},['No image']],
];
const { uiDictionaries } = load('i18n');
const labels = {
 DashboardScreen: ['Chưa có vé','Tổng Tour','Tổng POI','Audio trả phí','Ngôn ngữ:'],
 MapPanel: ['Đi bộ','Ô tô','Vị trí tôi','Chọn điểm đi','Chọn điểm đến','Tìm đường'],
 Sidebar: ['Khách vãng lai','Quét QR','Ngôn ngữ','Dashboard','Tour'],
 CatalogListScreen: ['Tìm POI theo tên…','Chưa có nội dung công khai.'],
 CatalogDetailScreen: ['Quay lại danh sách','Xem bản đồ','Hành trình','Thời lượng dự kiến:','Chưa có audio khả dụng cho ngôn ngữ này.'],
 QrScanner: ['Nhập mã QR','Cho phép dùng camera','Xác nhận mã','Đóng'],
 PoiImages: ['Chưa có ảnh'],
};
const plain = markup => markup.replace(/<[^>]*>/g,'').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const english = uiDictionaries.en;
const variables = text => [...text.matchAll(/\{(\d+)\}/g)].map(match=>match[1]).sort();
for (const [locale, dictionary] of Object.entries(uiDictionaries)) {
 assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(english).sort(),locale+': missing keys');
 for(const [key,value] of Object.entries(dictionary)) {
  assert.ok(value.trim() && !value.includes('\uFFFD'),locale+': empty or corrupt '+key);
  assert.deepEqual(variables(value),variables(key),locale+': interpolation '+key);
 }
}
for (const locale of ['vi','en','zh','ko','ja','fr']) {
 const t = createTranslator(locale);
 for(const [file,component,props] of cases) {
  const tree = React.createElement(UiLanguageContext.Provider,{value:locale},React.createElement(load(file)[component],{...props,languageCode:locale}));
  const rendered = plain(renderToStaticMarkup(tree));
  labels[file].forEach(key=>assert.ok(rendered.includes(t(key)),locale+'/'+file+': missing '+key));
  if(locale!=='vi') assert.ok(!/[ĂăĐđĨĩŨũƠơƯưẠ-ỹ]/u.test(rendered),locale+'/'+file+': Vietnamese fallback');
 }
 const list = load('CatalogListScreen').CatalogListScreen;
 const paging = React.createElement(list,{kind:'poi',languageCode:locale,pois:[{id:1,name:'Example',code:'P1'}],tours:[],poiTotal:150,hasMorePois:true,loadingMorePois:false,morePoisError:null,onLoadMorePois:noop,isLoading:false,onMenu:noop,onSelect:noop});
 const pagingText = plain(renderToStaticMarkup(React.createElement(UiLanguageContext.Provider,{value:locale},paging)));
 assert.ok(pagingText.includes(t('Tải thêm POI')));
 assert.ok(pagingText.includes(t('Đã tải {0}/{1} POI',1,150)));
 console.log(locale+': 7 screens and pagination footer PASS');
}
for (const [locale,expected] of [['zh-CN','步行'],['ko-KR','도보'],['ja-JP','徒歩'],['fr-FR','À pied']]) {
 assert.equal(createTranslator(locale)('Đi bộ'),expected);
}
// UI source keys must exist in every dictionary; dynamic content is not translated.
for (const name of [...cases.map(item=>item[0]),'DetailAudio']) {
 const text=fs.readFileSync(path.join(root,name+'.tsx'),'utf8');
 const source=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function check(node) {
  if(ts.isCallExpression(node)&&node.expression.getText(source)==='t'&&ts.isStringLiteral(node.arguments[0])) {
   assert.ok(Object.hasOwn(english,node.arguments[0].text.trim()),name+': unknown translation key');
  }
  ts.forEachChild(node,check);
 }
 check(source);
}
console.log('All dictionaries: key coverage, placeholders and regional locales PASS');
const en=createTranslator('en-US'),vi=createTranslator('vi');
assert.equal(en('Chưa có vé'),'No pass');
assert.equal(vi('Chưa có vé'),'Chưa có vé');
assert.equal(en('Ngôn ngữ: '),'Language: ');
assert.equal(en('{0} giờ {1} phút',2,5),'2 hr 5 min');
assert.equal(en('Không tìm thấy {0} có tên chứa “{1}”.','POI','{0}'),'No POI names contain “{0}”.');
assert.equal(en('Example POI name'),'Example POI name');
console.log('Vietnamese / locale / interpolation / unknown content: PASS');

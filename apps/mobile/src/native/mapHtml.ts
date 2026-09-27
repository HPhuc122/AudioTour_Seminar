// Leaflet is pinned; content received from the API is inserted with textContent.
export const MAP_HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;margin:0;background:#e8f0e9} .leaflet-control-attribution{font-size:9px} .label{font:600 12px sans-serif} .endpoint{background:white;border:2px solid #173b2a;border-radius:50%;width:24px!important;height:24px!important;text-align:center;line-height:24px;font:bold 15px sans-serif}</style>
</head><body><div id="map"></div>
<script>function send(v){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(v))}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="send({type:'error',message:'Không tải được bản đồ. Kiểm tra Internet và thử lại.'})"></script>
<script>
if(window.L){
const map=L.map('map',{zoomControl:false}).setView([16,106],5);
L.control.zoom({position:'bottomright'}).addTo(map);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
let tileWarning=false;
tiles.on('tileerror',()=>{if(!tileWarning){tileWarning=true;send({type:'tileError'})}});
tiles.on('tileload',()=>{tileWarning=false;send({type:'tileLoaded'})});
const pois=L.layerGroup().addTo(map), endpoints=L.layerGroup().addTo(map);
let route=null,position=null,accuracy=null,lastFit=null;
function ll(p){return [p.latitude,p.longitude]}
window.updateMap=function(data){
 pois.clearLayers();
 (data.pois||[]).forEach(p=>{const text=document.createElement('span');text.textContent=p.name;const m=L.circleMarker(ll(p),{radius:p.id===data.selectedId?11:8,color:'white',weight:2,fillColor:p.id===data.selectedId?'#e87924':'#15803d',fillOpacity:1,bubblingMouseEvents:false}).addTo(pois).bindTooltip(text);m.on('click',()=>send({type:'poi',id:p.id}))});
 endpoints.clearLayers();
 [data.from,data.to].forEach((p,i)=>{if(p)L.marker(ll(p),{interactive:false,icon:L.divIcon({className:'endpoint',html:i?'B':'A',iconAnchor:[12,12]})}).addTo(endpoints)});
 if(route){map.removeLayer(route);route=null}
 if(data.route&&data.route.length)route=L.polyline(data.route.map(ll),{color:'#2563eb',weight:5}).addTo(map);
 if(position)map.removeLayer(position);if(accuracy)map.removeLayer(accuracy);
 if(data.location){position=L.circleMarker(ll(data.location),{radius:7,color:'white',weight:2,fillColor:'#2563eb',fillOpacity:1}).addTo(map);accuracy=L.circle(ll(data.location),{radius:data.location.accuracy||0,stroke:false,fillColor:'#2563eb',fillOpacity:0.1}).addTo(map)}
 if(data.fitKey!==lastFit){lastFit=data.fitKey;const points=data.focus&&data.focus.length?data.focus:(data.route&&data.route.length?data.route:data.pois);if(points&&points.length){if(points.length===1)map.setView(ll(points[0]),16);else map.fitBounds(points.map(ll),{padding:[32,32],maxZoom:17})}}
};
map.on('click',e=>{const p=e.latlng.wrap();send({type:'pin',latitude:p.lat,longitude:p.lng})});
new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('map'));
send({type:'ready'});
}
</script></body></html>`;

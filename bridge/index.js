import express from 'express';
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const SECRET = process.env.BRIDGE_SECRET || '';
let queue = [], lastPoll = 0, state = {};
const auth = (req, res, next) => {
  const s = req.query.secret || req.headers['x-bridge-secret'] || '';
  (!SECRET || s === SECRET) ? next() : res.status(401).json({error:'unauthorized'});
};
app.post('/command', auth, (req, res) => {
  const {speed, pattern, level, stop, sec} = req.body;
  let cmd;
  if (stop) cmd = {type:'stop'};
  else if (speed !== undefined) cmd = {type:'speed', speed, sec};
  else if (pattern !== undefined) cmd = {type:'pattern', pattern, level: level||0.5};
  if (cmd) { queue.push(cmd); state = cmd; }
  res.json({ok:true, cmd});
});
app.get('/toy-next', (req, res) => {
  lastPoll = Date.now();
  res.json(queue.length ? queue.shift() : null);
});
app.get('/status', (req, res) => {
  res.json({online: Date.now()-lastPoll < 5000, state, lastPoll});
});
app.get('/', (req, res) => res.json({status:'ok'}));
app.get('/toy.html', (req, res) => {
  res.setHeader('Content-Type','text/html');
  res.send(HTML);
});
const HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SVAKOM Relay</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#1a1a2e;color:#eee;padding:20px}
.c{max-width:400px;margin:0 auto}h1{text-align:center;margin-bottom:16px}
.s{padding:12px;border-radius:10px;background:#16213e;margin-bottom:12px;text-align:center;border:2px solid #555}
button{width:100%;padding:12px;border:none;border-radius:8px;font-size:1em;cursor:pointer;margin-bottom:8px;background:#0f3460;color:#fff}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#16213e;color:#eee;margin-bottom:8px}
.log{background:#0f0f23;border-radius:8px;padding:10px;height:180px;overflow-y:auto;font-family:monospace;font-size:.8em;line-height:1.5}</style></head>
<body><div class="c"><h1>SVAKOM Relay</h1>
<div class="s" id="st">未连接</div>
<input id="url" placeholder="https://xxx.up.railway.app"/>
<button onclick="go()">连接玩具</button>
<button onclick="dc()" style="background:#c0392b">断开</button>
<div class="log" id="lg"></div></div>
<script>
let dev,chr,pt,kt,lc,wl;
const SVC='0000ffe0-0000-1000-8000-00805f9b34fb',CHR='0000ffe1-0000-1000-8000-00805f9b34fb';
const l=m=>{const e=document.getElementById('lg'),t=new Date().toLocaleTimeString();e.innerHTML+=t+' '+m+'\\n';e.scrollTop=e.scrollHeight};
const ss=(t,c)=>{const e=document.getElementById('st');e.textContent=t;e.style.borderColor=c};
async function go(){try{l('扫描中...');dev=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'SX'}],optionalServices:[SVC]});
l('连接 '+dev.name+'...');const s=await dev.gatt.connect(),svc=await s.getPrimaryService(SVC);chr=await svc.getCharacteristic(CHR);
l('✅ 已连接');ss('✅ '+dev.name,'#0f0');try{wl=await navigator.wakeLock.request('screen')}catch(e){}
dev.addEventListener('gattserverdisconnected',()=>{l('断开');ss('已断开','#f00');sp()});sp();poll()}catch(e){l('❌ '+e.message)}}
function dc(){sp();if(dev&&dev.gatt.connected)dev.gatt.disconnect();dev=chr=null;ss('未连接','#555');l('已断开')}
const wr=async d=>{if(chr)try{await chr.writeValueWithoutResponse(d)}catch(e){l('写入失败')}};
const cmd=c=>{if(!c||!c.type)return;let d;
if(c.type==='stop'){d=new Uint8Array([0x55,4,0,0,0,0,0xAA]);lc=null;sk();l('⏹停止')}
else if(c.type==='speed'){const i=Math.round(c.speed*255);d=new Uint8Array([0x55,4,0,0,1,i,0xAA]);lc=d;ka();l('▶'+Math.round(c.speed*100)+'%');
if(c.sec)setTimeout(()=>{wr(new Uint8Array([0x55,4,0,0,0,0,0xAA]));lc=null;sk();l('⏹自动停止')},c.sec*1000)}
else if(c.type==='pattern'){const v=Math.max(1,Math.round(c.level*5));d=new Uint8Array([0x55,3,0,0,c.pattern,v,0]);lc=d;ka();l('🔄花样'+c.pattern)}
if(d)wr(d)};
const ka=()=>{sk();kt=setInterval(()=>{if(lc)wr(lc)},1500)};
const sk=()=>{if(kt){clearInterval(kt);kt=null}};
function poll(){const u=document.getElementById('url').value.replace(/\\/+$/,'');if(!u){l('填写地址');return}
ss('轮询中...','#fa0');l('轮询 '+u);pt=setInterval(async()=>{try{const r=await fetch(u+'/toy-next'),j=await r.json();if(j&&j.type)cmd(j)}catch(e){}},300)}
const sp=()=>{if(pt){clearInterval(pt);pt=null}sk()};
</script></body></html>`;
app.listen(PORT, () => console.log('Bridge on port ' + PORT));

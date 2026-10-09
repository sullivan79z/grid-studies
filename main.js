(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('drawing'), ctx = canvas.getContext('2d');
  const state = { cell:40, cellY:40, rectangular:false, color:'#c6c9ca', actualMeters:null, actualHeightMeters:null, unit:'m', cols:null, rows:null, filled:new Set(), history:[], future:[], mode:'fill', image:null, imageRect:null, imageEdit:false, opacity:.4, gesture:null, pointers:new Map(), pinch:null, width:0, height:0, originX:0, originY:0, raf:0 };
  const key = (x,y) => `${x},${y}`;
  const fromKey = s => s.split(',').map(Number);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const units = {m:1,cm:.01,mm:.001};
  function screen(name){ for(const id of ['welcome','setup','workspace']) $(id).classList.toggle('hidden',id!==name); if(name==='workspace') { requestAnimationFrame(resize); } }
  function setupFields(){
    const m = document.querySelector('input[name=method]:checked').value;
    $('setup-fields').innerHTML = m==='length' ? '<label>单格边长<input id="setup-length" type="number" min="0.000001" step="any" value="3"></label><label>单位<select id="setup-unit"><option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option></select></label>' : m==='area' ? '<label>单格面积<input id="setup-area" type="number" min="0.000001" step="any" value="9"></label><label>单位<select id="setup-unit"><option value="m">m²</option><option value="cm">cm²</option><option value="mm">mm²</option></select></label>' : '<label>横向列数<input id="setup-cols" type="number" min="1" max="500" step="1" value="24"></label><label>纵向行数<input id="setup-rows" type="number" min="1" max="500" step="1" value="16"></label>';
    $('setup-error').textContent='';
  }
  function enter(skip){
    state.actualMeters=null; state.actualHeightMeters=null; state.cols=null; state.rows=null;
    if(!skip){
      const m=document.querySelector('input[name=method]:checked').value;
      if(m==='count'){
        const c=Number($('setup-cols').value), r=Number($('setup-rows').value);
        if(!Number.isInteger(c)||!Number.isInteger(r)||c<1||r<1||c>500||r>500) return error('请输入 1 至 500 的整数行列数。');
        state.cols=c;state.rows=r;
      }else{
        const n=Number($(m==='area'?'setup-area':'setup-length').value), u=$('setup-unit').value;
        if(!Number.isFinite(n)||n<=0) return error('请输入大于 0 的有效数值。');
        state.actualMeters=(m==='area'?Math.sqrt(n):n)*units[u];state.unit=u;
      }
    }
    $('actual-controls').classList.toggle('hidden',state.actualMeters===null);
    if(state.actualMeters!==null){state.actualHeightMeters=state.actualMeters;$('actual-unit').value=state.unit;$('actual-number').value=+(state.actualMeters/units[state.unit]).toPrecision(8);$('actual-height').value=$('actual-number').value;}
    screen('workspace'); updateScale();
  }
  function error(message){$('setup-error').textContent=message;}
  function sizeForCount(){if(state.cols&&state.rows){state.cell=Math.min(state.width/state.cols,state.height/state.rows);state.cellY=state.cell;syncSize();}}
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;state.width=r.width;state.height=r.height;const d=Math.min(window.devicePixelRatio||1,3);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);sizeForCount();setOrigin();updateImageFrame();schedule();}
  function setOrigin(){state.originX=state.cols?Math.max(0,(state.width-state.cols*state.cell)/2):0;state.originY=state.rows?Math.max(0,(state.height-state.rows*state.cellY)/2):0;}
  function syncSize(){$('size-range').value=clamp(state.cell,12,100);$('size-number').value=+state.cell.toFixed(1);$('height-number').value=+state.cellY.toFixed(1);$('size-value').textContent=`${state.cell.toFixed(state.cell%1?1:0)} px`;}
  function schedule(){if(!state.raf)state.raf=requestAnimationFrame(draw);}
  function draw(){state.raf=0;const {width:w,height:h,cell:s,cellY:sy,originX:ox,originY:oy}=state;ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    if(state.image&&state.imageRect){ctx.globalAlpha=state.opacity;const r=state.imageRect;ctx.drawImage(state.image,r.x,r.y,r.w,r.h);ctx.globalAlpha=1;}
    const minX=state.cols?0:Math.floor(-ox/s),maxX=state.cols?state.cols-1:Math.ceil((w-ox)/s),minY=state.rows?0:Math.floor(-oy/sy),maxY=state.rows?state.rows-1:Math.ceil((h-oy)/sy);
    const visible=(x,y)=>x>=minX&&x<=maxX&&y>=minY&&y<=maxY;
    ctx.fillStyle='#575e5e';for(const item of state.filled){const [x,y]=fromKey(item);if(visible(x,y))ctx.fillRect(ox+x*s,oy+y*sy,s,sy);}
    if(state.gesture){ctx.fillStyle=state.mode==='fill'?'rgba(53,60,60,.58)':'rgba(255,255,255,.75)';for(const item of state.gesture.preview){const [x,y]=fromKey(item);if(visible(x,y))ctx.fillRect(ox+x*s,oy+y*sy,s,sy);}}
    ctx.beginPath();const x0=state.cols?ox:ox+Math.ceil(-ox/s)*s, y0=state.rows?oy:oy+Math.ceil(-oy/sy)*sy;
    const xEnd=state.cols?ox+state.cols*s:w,yEnd=state.rows?oy+state.rows*sy:h;
    for(let x=x0;x<=xEnd+.001;x+=s){const xx=Math.round(x)+.5;ctx.moveTo(xx,Math.max(0,y0));ctx.lineTo(xx,Math.min(h,yEnd));}
    for(let y=y0;y<=yEnd+.001;y+=sy){const yy=Math.round(y)+.5;ctx.moveTo(Math.max(0,x0),yy);ctx.lineTo(Math.min(w,xEnd),yy);}
    ctx.strokeStyle=state.color;ctx.lineWidth=1;ctx.stroke();
  }
  function point(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function cellAt(p){const x=Math.floor((p.x-state.originX)/state.cell),y=Math.floor((p.y-state.originY)/state.cellY);if(state.cols&&(x<0||x>=state.cols||y<0||y>=state.rows))return null;return {x,y};}
  function lineCells(a,b){const out=[];const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(Math.abs(dx),Math.abs(dy))*4+1;for(let i=0;i<=steps;i++){const x=Math.round(a.x+dx*i/steps),y=Math.round(a.y+dy*i/steps);if(!out.length||out[out.length-1].x!==x||out[out.length-1].y!==y)out.push({x,y});}return out;}
  function addPath(g,a,b){for(const p of lineCells(a,b))g.path.add(key(p.x,p.y));g.preview=new Set(g.path);}
  function straight(g){const pts=[...g.path].map(fromKey);if(pts.length<2)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);if(x0!==x1&&y0!==y1)return null;const expected=Math.max(x1-x0,y1-y0)+1;if(expected!==g.path.size)return null;return {x0,x1,y0,y1,horizontal:y0===y1};}
  function rectanglePreview(g,c){const base=g.base, out=new Set();const x0=base.horizontal?base.x0:Math.min(base.x0,c.x),x1=base.horizontal?base.x1:Math.max(base.x1,c.x),y0=base.horizontal?Math.min(base.y0,c.y):base.y0,y1=base.horizontal?Math.max(base.y1,c.y):base.y1;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)out.add(key(x,y));g.preview=out;g.rect={cols:x1-x0+1,rows:y1-y0+1};}
  function startHold(g){clearTimeout(g.timer);g.timer=setTimeout(()=>{if(state.gesture!==g||g.expanding)return;const base=straight(g);if(base){g.base=base;g.ready=true;showMeasure(g);}},2000);}
  function pointerDown(e){if(state.imageEdit)return;const p=point(e);if(e.pointerType==='touch'){canvas.setPointerCapture(e.pointerId);state.pointers.set(e.pointerId,p);if(state.pointers.size===2){if(state.gesture){clearTimeout(state.gesture.timer);state.gesture=null;$('measure').classList.add('hidden');schedule();}const [a,b]=[...state.pointers.values()];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};state.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),cell:state.cell,cellY:state.cellY,gridX:(mid.x-state.originX)/state.cell,gridY:(mid.y-state.originY)/state.cellY,mid,imageRect:state.imageRect?{...state.imageRect}:null};e.preventDefault();return;}if(state.pointers.size>2)return;}if(state.gesture||state.pinch)return;const c=cellAt(p);if(!c)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const g={id:e.pointerId,path:new Set([key(c.x,c.y)]),preview:new Set([key(c.x,c.y)]),last:c,lastPoint:p,ready:false,expanding:false,base:null,rect:null,timer:null};state.gesture=g;startHold(g);showMeasure(g);schedule();}
  function pointerMove(e){const p=point(e);if(state.pointers.has(e.pointerId))state.pointers.set(e.pointerId,p);if(state.pinch){if(state.pointers.size>=2){const [a,b]=[...state.pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},ratio=Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,state.pinch.distance);state.cell=clamp(state.pinch.cell*ratio,8,200);state.cellY=clamp(state.pinch.cellY*ratio,8,200);const actualRatio=state.cell/state.pinch.cell;state.originX=mid.x-state.pinch.gridX*state.cell;state.originY=mid.y-state.pinch.gridY*state.cellY;if(state.pinch.imageRect){const r=state.pinch.imageRect,m=state.pinch.mid;state.imageRect={x:mid.x+(r.x-m.x)*actualRatio,y:mid.y+(r.y-m.y)*actualRatio,w:r.w*actualRatio,h:r.h*actualRatio};updateImageFrame();}state.cols=null;state.rows=null;syncSize();updateScale();schedule();}e.preventDefault();return;}const g=state.gesture;if(!g||e.pointerId!==g.id)return;e.preventDefault();const c=cellAt(p);g.lastPoint=p;if(!c){showMeasure(g);return;}if(c.x!==g.last.x||c.y!==g.last.y){if(g.ready&&g.base){const perpendicular=g.base.horizontal?c.y!==g.base.y0:c.x!==g.base.x0;if(perpendicular)g.expanding=true;}
      if(g.expanding)rectanglePreview(g,c);else{addPath(g,g.last,c);g.rect=null;g.ready=false;startHold(g);}g.last=c;schedule();}showMeasure(g);}
  function pointerEnd(e){state.pointers.delete(e.pointerId);if(state.pinch){if(state.pointers.size===0)state.pinch=null;return;}const g=state.gesture;if(!g||e.pointerId!==g.id)return;clearTimeout(g.timer);const p=point(e),c=cellAt(p);if(c&&(c.x!==g.last.x||c.y!==g.last.y)){if(g.expanding)rectanglePreview(g,c);else addPath(g,g.last,c);}
    const changes=[];for(const item of g.preview){const had=state.filled.has(item),want=state.mode==='fill';if(had!==want){changes.push({item,had});if(want)state.filled.add(item);else state.filled.delete(item);}}
    if(changes.length){state.history.push(changes);state.future.length=0;}state.gesture=null;$('measure').classList.add('hidden');updateUndo();schedule();}
  function fmt(n){return Number(n.toFixed(n<1?3:n<10?2:1)).toString();}
  function dimension(cells,axis='x'){if(state.actualMeters===null)return `${cells} 格`;const meters=cells*(axis==='y'?state.actualHeightMeters:state.actualMeters), factor=units[state.unit];return `${fmt(meters/factor)} ${state.unit}`;}
  function area(cells){if(state.actualMeters===null)return `${cells} 平方格`;const val=cells*state.actualMeters*state.actualHeightMeters/(units[state.unit]**2);return `${fmt(val)} ${state.unit}²`;}
  function showMeasure(g){const el=$('measure'),n=g.preview.size;if(!n)return;let html=`<strong>${n} 格</strong><br>面积 ${area(n)}`;if(g.expanding&&g.rect){html=`<strong>${g.rect.cols} × ${g.rect.rows} 格</strong><br>横向 ${dimension(g.rect.cols)}<br>纵向 ${dimension(g.rect.rows,'y')}<br>面积 ${area(n)}<br>${n} 格`;}else{const s=straight(g);if(s)html=`<strong>${n} 格</strong><br>长度 ${dimension(n,s.horizontal?'x':'y')}<br>面积 ${area(n)}`;}
    el.innerHTML=html;el.classList.remove('hidden');const x=clamp(g.lastPoint.x+18,8,state.width-el.offsetWidth-8),y=clamp(g.lastPoint.y-77,8,state.height-el.offsetHeight-8);el.style.left=`${x}px`;el.style.top=`${y}px`;}
  function updateUndo(){$('undo').disabled=!state.history.length;$('redo').disabled=!state.future.length;}
  function updateScale(){$('scale-indicator').textContent=state.actualMeters===null?`1 格 · ${fmt(state.cell)} × ${fmt(state.cellY)} px`:`1 格 · ${fmt(state.actualMeters/units[state.unit])} × ${fmt(state.actualHeightMeters/units[state.unit])} ${state.unit}`;}
  $('welcome-next').onclick=()=>screen('setup');$('skip').onclick=()=>enter(true);$('enter').onclick=()=>enter(false);document.querySelectorAll('input[name=method]').forEach(el=>el.onchange=setupFields);setupFields();
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  for(const mode of ['fill','erase'])$(`tool-${mode}`).onclick=()=>{state.mode=mode;for(const m of ['fill','erase']){$(`tool-${m}`).classList.toggle('active',m===mode);$(`tool-${m}`).setAttribute('aria-pressed',m===mode?'true':'false');}};
  $('undo').onclick=()=>{const changes=state.history.pop();if(!changes)return;for(const {item,had} of changes){if(had)state.filled.add(item);else state.filled.delete(item);}state.future.push(changes);updateUndo();schedule();};$('redo').onclick=()=>{const changes=state.future.pop();if(!changes)return;for(const {item,had} of changes){if(had)state.filled.delete(item);else state.filled.add(item);}state.history.push(changes);updateUndo();schedule();};updateUndo();
  const toggleSettings=show=>{$('settings').classList.toggle('hidden',!show);$('settings-toggle').setAttribute('aria-expanded',String(show));if(!show)setImageEdit(false);};$('settings-toggle').onclick=()=>toggleSettings($('settings').classList.contains('hidden'));$('settings-close').onclick=()=>toggleSettings(false);
  function changeSize(value){const n=Number(value);if(!Number.isFinite(n)||n<8||n>200)return;state.cell=n;if(!state.rectangular)state.cellY=n;state.cols=null;state.rows=null;syncSize();updateScale();schedule();}
  $('size-range').oninput=e=>changeSize(e.target.value);$('size-number').onchange=e=>changeSize(e.target.value);
  $('rect-toggle').onchange=e=>{state.rectangular=e.target.checked;$('rect-controls').classList.toggle('hidden',!state.rectangular);$('actual-height-controls').classList.toggle('hidden',!state.rectangular);if(!state.rectangular){state.cellY=state.cell;if(state.actualMeters!==null)state.actualHeightMeters=state.actualMeters;}syncSize();updateScale();schedule();};
  $('height-number').onchange=e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<8||n>200)return;state.cellY=n;state.cols=null;state.rows=null;syncSize();updateScale();schedule();};
  $('actual-number').oninput=e=>{const n=Number(e.target.value);if(n>0&&Number.isFinite(n)){state.actualMeters=n*units[$('actual-unit').value];if(!state.rectangular){state.actualHeightMeters=state.actualMeters;$('actual-height').value=n;}state.unit=$('actual-unit').value;updateScale();if(state.gesture)showMeasure(state.gesture);}};
  $('actual-height').oninput=e=>{const n=Number(e.target.value);if(n>0&&Number.isFinite(n)){state.actualHeightMeters=n*units[state.unit];updateScale();if(state.gesture)showMeasure(state.gesture);}};
  $('actual-unit').onchange=e=>{state.unit=e.target.value;$('actual-number').value=+(state.actualMeters/units[state.unit]).toPrecision(8);$('actual-height').value=+(state.actualHeightMeters/units[state.unit]).toPrecision(8);$('actual-height-unit').textContent=state.unit;updateScale();if(state.gesture)showMeasure(state.gesture);};
  $('grid-color').oninput=e=>{state.color=e.target.value;$('color-label').textContent=state.color.toUpperCase();schedule();};
  $('image-input').onchange=e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png'].includes(file.type)){alert('请选择 JPG 或 PNG 图片。');return;}const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{state.image=im;const scale=Math.min(state.width/im.width,state.height/im.height);state.imageRect={x:(state.width-im.width*scale)/2,y:(state.height-im.height*scale)/2,w:im.width*scale,h:im.height*scale};URL.revokeObjectURL(url);$('image-options').classList.remove('hidden');setImageEdit(true);schedule();};im.onerror=()=>{URL.revokeObjectURL(url);alert('图片无法读取。');};im.src=url;};
  $('image-opacity').oninput=e=>{state.opacity=Number(e.target.value)/100;$('opacity-value').textContent=`${e.target.value}%`;schedule();};$('image-adjust').onclick=()=>setImageEdit(!state.imageEdit);$('image-remove').onclick=()=>{state.image=null;state.imageRect=null;setImageEdit(false);$('image-input').value='';$('image-options').classList.add('hidden');schedule();};
  function updateImageFrame(){const f=$('image-frame'),r=state.imageRect;if(!r)return;Object.assign(f.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});}
  function setImageEdit(on){state.imageEdit=!!on&&!!state.image&&!$('settings').classList.contains('hidden');$('image-frame').classList.toggle('hidden',!state.imageEdit);$('image-adjust').setAttribute('aria-pressed',String(state.imageEdit));if(state.imageEdit)updateImageFrame();}
  let imageDrag=null;$('image-frame').addEventListener('pointerdown',e=>{if(!state.imageEdit)return;e.preventDefault();e.stopPropagation();const r=state.imageRect;imageDrag={id:e.pointerId,handle:e.target.dataset.handle||'move',x:e.clientX,y:e.clientY,start:{...r}};$('image-frame').setPointerCapture(e.pointerId);});
  $('image-frame').addEventListener('pointermove',e=>{if(!imageDrag||e.pointerId!==imageDrag.id)return;e.preventDefault();const dx=e.clientX-imageDrag.x,dy=e.clientY-imageDrag.y,s=imageDrag.start,h=imageDrag.handle;let left=s.x,top=s.y,right=s.x+s.w,bottom=s.y+s.h;if(h==='move'){left+=dx;right+=dx;top+=dy;bottom+=dy;}else{if(h.includes('w'))left=Math.min(right-24,left+dx);if(h.includes('e'))right=Math.max(left+24,right+dx);if(h.includes('n'))top=Math.min(bottom-24,top+dy);if(h.includes('s'))bottom=Math.max(top+24,bottom+dy);}state.imageRect={x:left,y:top,w:right-left,h:bottom-top};updateImageFrame();schedule();});
  for(const event of ['pointerup','pointercancel'])$('image-frame').addEventListener(event,e=>{if(imageDrag&&e.pointerId===imageDrag.id)imageDrag=null;});
  $('clear').onclick=()=>{$('confirm').classList.remove('hidden');};$('cancel-clear').onclick=()=>$('confirm').classList.add('hidden');$('confirm-clear').onclick=()=>{if(state.filled.size){state.history.push([...state.filled].map(item=>({item,had:true})));state.future.length=0;state.filled.clear();updateUndo();schedule();}$('confirm').classList.add('hidden');toggleSettings(false);};
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,100));
})();

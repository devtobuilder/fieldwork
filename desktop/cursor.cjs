async function showCursor(view,x,y,label='Click',pressed=false){
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid interaction point');
 await view.webContents.executeJavaScript(`(()=>{
 let host=document.getElementById('__fieldwork_cursor');
 if(!host){host=document.createElement('div');host.id='__fieldwork_cursor';host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;contain:layout style;';const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{pointer-events:none}.pointer{filter:drop-shadow(0 1px 2px #0008);width:25px;height:30px}.label{position:absolute;left:20px;top:25px;font:12px system-ui;color:#fff;background:#174e39;padding:4px 8px;border-radius:6px;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}.ring{position:absolute;width:30px;height:30px;left:-15px;top:-15px;border:3px solid #38bb85;border-radius:50%;box-sizing:border-box;background:#38bb8533;opacity:0}</style><div class="ring"></div><svg class="pointer" viewBox="0 0 25 30"><path d="M2 2 L2 25 L8 19 L13 29 L18 26 L13 17 L23 17 Z" fill="#174e39" stroke="white" stroke-width="2"/></svg><div class="label"></div>';document.documentElement.appendChild(host);}
 if(!window.__fieldworkCursorMove){window.__fieldworkCursorMove=true;document.addEventListener('mousemove',e=>{const cursor=document.getElementById('__fieldwork_cursor');if(cursor)cursor.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';},{passive:true});}
 host.style.transform='translate('+${Number(x)}+'px,'+${Number(y)}+'px)';host.shadowRoot.querySelector('.label').textContent=${JSON.stringify(String(label).slice(0,120))};host.shadowRoot.querySelector('.ring').style.opacity=${pressed?'1':'0'};host.dataset.x=${JSON.stringify(String(x))};host.dataset.y=${JSON.stringify(String(y))};host.dataset.action=${JSON.stringify(label)};
 })()`);
}
async function fieldPoint(view,id){
 return view.webContents.executeJavaScript(`(()=>{const e=document.querySelector('[data-fieldwork-id='+CSS.escape(${JSON.stringify(id)})+']');if(!e)return null;const t=e.closest('[class*="select__control"]')||e;t.scrollIntoView({block:'center',behavior:'instant'});e.focus({preventScroll:true});const r=t.getBoundingClientRect();return {x:Math.max(1,Math.min(innerWidth-1,r.x+r.width/2)),y:Math.max(1,Math.min(innerHeight-1,r.y+r.height/2))}})()`);
}
module.exports={showCursor,fieldPoint};

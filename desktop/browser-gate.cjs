// Runs before site scripts. Normal authentication, CAPTCHA, uploads and lookups
// use Chrome's own networking. Only committing UI actions require confirmation.
function installGate({secret}){
 let expires=0;const clean=t=>String(t||'').replace(/\s+/g,' ').trim().toLowerCase();
 const visible=e=>!!(e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')&&!e.closest('[aria-hidden=true],[inert]');
 const fields=(root=document)=>[...root.querySelectorAll('input,textarea,select,[role=combobox]')].some(e=>{
  if(e.disabled||e.readOnly||['hidden','submit','button','reset','search'].includes(e.type)||e.closest('header,[role=search]')||/search|job.?alert|newsletter/i.test((e.form?.id||'')+' '+(e.form?.getAttribute('role')||'')))return false;
  return visible(e)||e.type==='file'&&visible(e.parentElement)||e.type==='checkbox'&&[...e.labels||[]].some(visible);
 });
 const final=e=>{const text=clean(e?.innerText||e?.value||e?.getAttribute?.('aria-label'));if(!e)return false;if(/^(?:next|continue|save and continue|back|previous)(?:\s|$)/.test(text))return false;if(/^apply(?: now)?$/.test(text)){if(!fields())return false;if(e.type==='submit'&&e.form)return true;if(e.type!=='submit'&&[...document.querySelectorAll('button,input[type=submit]')].some(n=>/^submit(?: application)?$/.test(clean(n.innerText||n.value))))return false;return true;}return /^(?:submit(?: (?:your )?application)?|send application|complete application|finish(?: application)?)$/.test(text);};
 const allowed=()=>Date.now()<expires;
 const block=event=>{event?.preventDefault();event?.stopImmediatePropagation();document.dispatchEvent(new CustomEvent('fieldwork:approval-required'));};
 Object.defineProperty(window,'__fieldworkGate',{value:Object.freeze({authorize(token,until){if(token!==secret)throw Error('Invalid approval capability');expires=until;}}),configurable:false,writable:false});
 for(const type of ['click','mousedown'])document.addEventListener(type,e=>{const target=e.target?.closest?.('button,input[type=submit],[role=button],a');if(final(target)&&!allowed())block(e);},true);
 document.addEventListener('submit',e=>{const target=e.submitter||[...e.target.querySelectorAll('button,input[type=submit]')].find(final);if((!target&&fields(e.target)||final(target))&&!allowed())block(e);},true);
 const originalSubmit=HTMLFormElement.prototype.submit;
 HTMLFormElement.prototype.submit=function(){const buttons=[...this.querySelectorAll('button,input[type=submit]')];if(!allowed()&&(buttons.some(final)||!buttons.length&&fields(this))){block();return;}return originalSubmit.call(this);};
}
function isKnownFinalRequest(url,method,body=''){
 if(!['POST','PUT','PATCH','DELETE'].includes(method))return false;const u=new URL(url);
 if(/^(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io$/.test(u.hostname)&&/^\/[^/]+\/jobs\/\d+\/?$/.test(u.pathname))return true;
 return /(?:submit[-_/]?application|applications?\/submit|complete[-_/]?application)/i.test(u.pathname)||/"(?:operationName|action)"\s*:\s*"(?:submitApplication|submit_application|completeApplication)"/i.test(body);
}
module.exports={installGate,isKnownFinalRequest};


const {navigationInterrupted,retryNavigationRead}=require('./navigation-read.cjs');
const {observe}=require('./page-observation.cjs');
const {setTimeout:delay}=require('node:timers/promises');
// A small DOM transition observer replaces repeated full-page rescans. It never
// treats a URL-only change, a transient disabled button, or a footer as a step.
function navigationObservation({waitForChange=false,before='',timeout=18000}={}){
 const shown=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[aria-hidden=true],[inert],header,[role=search]');
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const state=()=>({dashboard:[...document.querySelectorAll('h1,h2,[role=heading]')].some(e=>shown(e)&&/^(?:(?:welcome to )?(?:candidate home|candidate dashboard|applicant dashboard)|my applications)$/i.test(clean(e.innerText))),fields:[...document.querySelectorAll('input,textarea,select,[role=combobox],[role=radio]')].filter(e=>shown(e)&&(!['hidden','button','submit','reset'].includes(e.type)||e.matches('[role=radio],[role=combobox]'))).map(e=>[e.id,e.name,e.getAttribute('role')||e.type,e.getAttribute('aria-label'),[...e.labels||[]].map(l=>clean(l.textContent))]),actions:[...document.querySelectorAll('button,a,[role=button]')].filter(shown).map(e=>clean(e.innerText||e.getAttribute('aria-label'))).filter(s=>/^(?:apply(?: now)?|apply manually|enter (?:my |your )?information manually|continue without (?:a )?resume|next|continue|save and continue|verify(?: code)?|submit(?: application)?|register|sign in|log in|create account)$/i.test(s))});
 const signature=()=>JSON.stringify(state());
 if(!waitForChange)return signature();
 return new Promise((resolve,reject)=>{let settle,timer;const finish=(error)=>{observer.disconnect();clearTimeout(settle);clearTimeout(timer);error?reject(Error(error)):resolve(signature());};const check=()=>{const current=state(),previous=JSON.parse(before);if(document.readyState==='loading'||[...document.querySelectorAll('[aria-busy=true],[role=progressbar]:not([aria-valuenow])')].some(shown))return;if(current.dashboard&&!previous.dashboard||current.fields.length&&JSON.stringify(current.fields)!==JSON.stringify(previous.fields)||current.actions.length&&JSON.stringify(current.actions)!==JSON.stringify(previous.actions))finish();};const observer=new MutationObserver(()=>{clearTimeout(settle);settle=setTimeout(check,100);});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,characterData:true});timer=setTimeout(()=>finish('The application did not expose a new rendered step; check its validation or access requirement'),timeout);check();});
}
async function navigateEvidence({view,action,page,signal,verificationRequest=false,beforeClick}){
 if(/submit|send application|complete application|finish application/i.test(action.text))throw Error('Final submission is prohibited during preparation');
 const locate=id=>view.frame.locator('[data-fieldwork-nav='+JSON.stringify(id)+']');
 const sameAction=c=>!c.disabled&&['text','type','href','formAction','link','target'].every(key=>c[key]===action[key]);
 const equivalentLinks=action.link&&/^https?:\/\//i.test(action.href);
 const bind=async()=>{
  for(let attempt=0;attempt<4;attempt++){
   signal?.throwIfAborted();
   const current=await retryNavigationRead(()=>view.frame.evaluate(observe),signal);
   if(current.url!==page.url)throw Object.assign(Error('The page changed before navigation. Resume on the new step.'),{code:'STEP_NOT_READY'});
   const matches=current.navigation.filter(sameAction);
   if(matches.length>1&&!equivalentLinks)throw Error('More than one matching navigation control is visible without a shared link destination');
   const preferred=matches.findIndex(c=>c.id===action.id);
   if(preferred>0)matches.unshift(...matches.splice(preferred,1));
   for(const match of matches.slice(0,4)){
    const target=locate(match.id);
    try{await target.click({trial:true,timeout:450});return target;}
    catch(error){if(error.name!=='TimeoutError'&&!navigationInterrupted(error))throw error;}
   }
   await delay(125,undefined,{signal});
  }
  throw Object.assign(Error('The navigation control is still changing. Resume once it is visible.'),{code:'STEP_NOT_READY'});
 };
 await bind();
 const before=await view.frame.evaluate(navigationObservation),screenshot=await view.page.screenshot({scale:'css',timeout:3000});
 const locator=await bind();
 signal?.throwIfAborted();if(before!==await view.frame.evaluate(navigationObservation))throw Error('The page changed before navigation');
 const transition=verificationRequest?null:view.frame.evaluate(navigationObservation,{waitForChange:true,before}).catch(e=>({error:e.message}));
 const popup=!verificationRequest&&action.link&&action.target.toLowerCase()==='_blank'&&view.setPage
  ?view.page.waitForEvent('popup',{timeout:10000}).then(page=>({popup:page}),()=>transition)
  :null;
 signal?.throwIfAborted();beforeClick?.();
 try{await locator.click({timeout:3000});}catch(error){if(!navigationInterrupted(error))throw error;}
 (view.__fieldworkEvidenceTrace ||= []).push({action:'navigate',intent:action.text,at:Date.now(),screenshotHash:require('node:crypto').createHash('sha256').update(screenshot).digest('hex')});
 const inspect=()=>retryNavigationRead(()=>require('./page-actions.cjs').inspect(view),signal);
 if(verificationRequest)return {requestIssued:true,page:await inspect()};
 const outcome=await (popup?Promise.race([transition,popup]):transition);
 if(outcome?.popup){view.setPage(outcome.popup);await outcome.popup.waitForLoadState('domcontentloaded',{timeout:10000});}
 if(outcome?.error&&!navigationInterrupted(outcome.error))throw Object.assign(Error(outcome.error),{code:'STEP_NOT_READY'});
 await retryNavigationRead(()=>require('./evidence-browser.cjs').waitForEvidenceReady(view,signal),signal);
 signal?.throwIfAborted();const after=await inspect();
 if(require('./page-state.cjs').pageState(after).kind==='loading'&&!(await require('./evidence-browser.cjs').collectEvidence(view,{capture:false})).length)throw Error('The next application step is still loading');
 return {page:after};
}
module.exports={navigateEvidence,navigationObservation};

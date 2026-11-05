const {pageState}=require('./page-state.cjs');
const {finalAction}=require('./submission.cjs');

function expandVerificationDomains(urls=[]){
 const tldts=require('tldts');
 const extraMap={
  'greenhouse.io':['greenhouse-mail.io','us.greenhouse-mail.io'],
  'myworkdayjobs.com':['myworkday.com','workday.com'],
  'workday.com':['myworkday.com','myworkdayjobs.com'],
  'lever.co':['hire.lever.co'],
  'ashbyhq.com':['jobs.ashbyhq.com'],
  'smartrecruiters.com':[' notifications.smartrecruiters.com'.trim()],
  'icims.com':['talent.icims.com']
 };
 const out=new Set();
 for(const raw of urls){
  if(!raw)continue;
  try{
   const h=new URL(raw).hostname;
   const d=tldts.getDomain(h);
   if(h)out.add(h);
   if(d){
    out.add(d);
    for(const mapped of extraMap[d]||[])out.add(mapped);
   }
  }catch{}
 }
 return [...out];
}

function findUnfilledCodeFields(page){
 const fields=page?.fields||[];
 const codeFields=fields.filter(f=>
  /verification code|security code|one time|one-time|confirmation code|passcode|^code$/i.test(f.label)||
  f.autocomplete==='one-time-code'||
  (f.maxLength===1&&/digit|code|security|pin|verify/i.test(f.label+' '+f.id+' '+(f.context||'')))
 );
 if(!codeFields.length){
  const singleCharGroup=fields.filter(f=>f.maxLength===1&&!f.disabled);
  if(singleCharGroup.length>=4&&singleCharGroup.length<=8&&/verification code|security code|enter the \d+-character code|one-time code/i.test(page?.text||'')){
   return singleCharGroup.every(f=>f.hasValue||String(f.value||'').trim().length>0)?[]:singleCharGroup;
  }
  return [];
 }
 const allFilled=codeFields.every(f=>f.hasValue||String(f.value||'').trim().length>0);
 return allFilled?[]:codeFields;
}

async function dismissObstructions(view){
 if(!view?.webContents)return false;
 try{
  return await view.webContents.executeJavaScript(`(()=>{
   const shown=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none');
   const banners=[...document.querySelectorAll('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="onetrust" i],[class*="onetrust" i],[id*="truste" i],[aria-label*="cookie" i]')].filter(shown).filter(b=>!b.querySelector('input[type="file"],textarea,select,[role="combobox"]'));
   for(const b of banners){
    const btn=[...b.querySelectorAll('button,[role="button"],a')].find(a=>shown(a)&&/^(?:accept(?: all| cookies)?|allow(?: all)?|agree|got it|ok|close|dismiss|continue|i understand)$/i.test((a.innerText||a.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim()));
    if(btn){btn.click();return true;}
   }
   return false;
  })()`);
 }catch{
  return false;
 }
}

async function resolveVerificationSurprise({view,page,gmail,email,urls=[],startedAt,signal,progress=()=>{}}){
 const codeFields=findUnfilledCodeFields(page);
 if(!codeFields.length)return {detected:false};
 if(!gmail?.status?.()?.connected||!view?.external){
  return {
   detected:true,
   resolved:false,
   reason:'Employer requested an email security/verification code. Enter the code in Chrome (or connect Gmail in Settings), then re-scan and submit.'
  };
 }
 if(!email){
  return {
   detected:true,
   resolved:false,
   reason:'Employer requested an email verification code, but no candidate email is configured in the profile.'
  };
 }
 const domains=expandVerificationDomains([...urls,page?.url]);
 const effectiveStart=Number.isSafeInteger(startedAt)&&startedAt>0?startedAt-5000:Date.now()-10*60000;
 progress('Verification code requested by employer. Checking Gmail automatically…');
 const code=await gmail.code({
  recipient:email,
  startedAt:effectiveStart,
  progress,
  signal,
  domains
 });
 if(!code){
  return {
   detected:true,
   resolved:false,
   reason:'No verification code email arrived in Gmail yet. Enter the security code in Chrome (or wait for the email and re-scan).'
  };
 }
 const split=codeFields.length===code.length;
 for(let k=0;k<codeFields.length;k++){
  signal?.throwIfAborted();
  const field=codeFields[k];
  const val=split?code[k]:code;
  await view.frame.locator('[data-fieldwork-id="'+field.id+'"]').fill(val);
 }
 const state=pageState(page);
 const verifyBtn=(page.navigation||[]).find(a=>!a.disabled&&!a.href&&/^(?:verify(?: (?:code|email))?|confirm code|submit code)$/i.test(String(a.text||'').trim()));
 return {
  detected:true,
  resolved:true,
  code,
  verifyAction:verifyBtn||(!state.inlineForm?state.action:null)
 };
}

function findSecondaryConfirmAction(page,primaryActionId){
 const candidates=(page?.navigation||[]).filter(a=>!a.disabled&&!a.href&&a.id!==primaryActionId&&/^(?:confirm(?: and submit| submission)?|yes,?\s*submit|submit(?: application)?|continue and submit)$/i.test(String(a.text||'').trim()));
 return candidates.length===1?candidates[0]:null;
}

module.exports={
 expandVerificationDomains,
 findUnfilledCodeFields,
 dismissObstructions,
 resolveVerificationSurprise,
 findSecondaryConfirmAction
};

const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const auxiliary=f=>f.auxiliary||/search jobs|search by|search keywords|job alerts?|newsletter/i.test(f.label)||f.type==='search';
function pageState(page){
 const visible=String(page.heading||'')+' '+String(page.text||'');if(/too many (?:attempts|requests)|maximum number of attempts|temporarily locked|rate limit exceeded/i.test(visible)){const minutes=visible.match(/(?:again|retry)\s+in\s+(\d+)\s+minutes?/i);return {kind:'rate_limited',retryAfterMs:(minutes?Number(minutes[1]):30)*60000,reason:'The provider has temporarily limited verification attempts.'};}
 const fields=(page.fields||[]).filter(f=>!auxiliary(f));
 const actions=(page.navigation||[]).filter(a=>!a.disabled);
 const password=fields.some(f=>f.secret||f.type==='password');
 const codeFields=fields.filter(f=>/verification code|security code|one time|one-time|confirmation code|passcode|^code$/i.test(f.label)||f.autocomplete==='one-time-code'||f.maxLength===1);
 const verification=fields.some(f=>/verification code|security code|one time|one-time|confirmation code|passcode|^code$/i.test(f.label)||f.autocomplete==='one-time-code')||actions.some(a=>/^verify(?: code)?$/i.test(text(a.text)))&&fields.some(f=>f.maxLength===1);
 const create=actions.find(a=>/^(?:create (?:an? )?account|register|sign up)$/i.test(text(a.text)));
 const login=actions.find(a=>/^(?:sign in|log in|login)$/i.test(text(a.text)));
 const next=actions.find(a=>/^(?:next|continue|verify(?: (?:email|code))?|send (?:verification )?code)$/i.test(text(a.text)));
 const resend=actions.find(a=>/^(?:(?:send|request)(?: a)? new|resend|send another)(?: verification)? code$/i.test(text(a.text)));
 const application=fields.some(f=>f.type==='file'||/first name|last name|full name|resume|school|degree|education|experience|work authori/i.test(f.label));
 const inlineVerificationFilled=verification&&application&&!next&&codeFields.length>0&&codeFields.every(f=>f.hasValue||String(f.value||'').trim().length>0);
 if(verification&&!inlineVerificationFilled)return {kind:'verification',fields,action:next,resend,inlineForm:application&&!next};
 if(password||!application&&(create||login)){const registration=!!create&&(!login||/create|register|sign up/i.test(page.heading||'')||fields.some(f=>/confirm.*password|new password/i.test(f.label)));return {kind:registration?'registration':'account',fields,action:registration?create:login||next||create,create,login};}
 if(!application&&fields.some(f=>f.type==='email'||/email address/i.test(f.label))&&next&&fields.every(f=>f.type==='email'||f.type==='checkbox'||/email|user ?name/i.test(f.label)))return {kind:'identity',fields,action:next};
 if(!application&&(page.applicationChooser||[page.heading,...String(page.text||'').split('\n')].some(line=>/^(?:start (?:your |an? )?application|choose (?:how|a way) to apply|application method)$/i.test(text(line))))){
  const manual=actions.filter(a=>/^(?:apply manually|enter (?:my |your )?information manually|continue without (?:a )?resume)$/i.test(text(a.text)));
  if(manual.length===1)return {kind:'landing',fields:[],action:manual[0]};
  if(manual.length>1)return {kind:'ambiguous',reason:'Multiple manual application actions are visible'};
 }
 const apply=actions.filter(a=>/^(?:apply(?: now| for (?:this )?(?:job|position))?|begin application|start application|get started)$/i.test(text(a.text)));
 if(!application&&apply.length){const unique=[...new Map(apply.map(a=>[a.href||text(a.text).toLowerCase(),a])).values()];return unique.length===1?{kind:'landing',fields:[],action:unique[0]}:{kind:'ambiguous',reason:'Multiple different application destinations are available'};}
 const dashboardHeading=/^(?:(?:welcome to )?(?:candidate home|candidate dashboard|applicant dashboard)|my applications)$/i;
 if(!fields.length&&!next&&!actions.some(a=>/^save and continue$/i.test(text(a.text)))&&dashboardHeading.test(text(page.heading)))return {kind:'account_home',fields:[]};
 if(fields.length)return {kind:'form',fields};
 if(next)return {kind:'introduction',fields:[],action:next};
 return {kind:'loading',fields:[]};
}
module.exports={pageState,auxiliary};

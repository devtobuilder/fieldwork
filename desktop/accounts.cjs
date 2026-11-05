const {resolve}=require('./canonical.cjs');
const {pageState}=require('./page-state.cjs');
class AccountFlow{
 constructor({profile,getCredential,hasCredential,apply,fillSecret,navigate,verification,startedAt,onVerificationRequested,progress=()=>{}}){Object.assign(this,{profile,getCredential,hasCredential,apply,fillSecret,navigate,verification,onVerificationRequested,progress});this.startedAt=Number.isSafeInteger(startedAt)&&startedAt>0?startedAt:null;this.attempts=new Map();}
 recordVerificationRequest(){this.startedAt=Date.now();this.onVerificationRequested?.(this.startedAt);}
 async step(page){const state=pageState(page);if(!['identity','account','registration','verification'].includes(state.kind))return null;
  const key=page.url+'|'+state.kind+'|'+state.fields.map(f=>f.label).join('|');const attempts=this.attempts.get(key)||0;if(attempts>=2)return {handled:true,blocked:true,message:'The account step did not advance. Check Chrome for a rejected login, verification, or account requirement.'};this.attempts.set(key,attempts+1);
  const email=this.profile.resume?.contact?.email;if(!email)return {handled:true,blocked:true,message:'An email address is needed for the employer account.'};
  this.progress(state.kind==='verification'?'Checking the expected account verification message':'Preparing employer sign-in or registration automatically');
  if(!state.action&&!state.inlineForm)return {handled:true,blocked:true,message:'No unambiguous account Continue, Register, or Sign in action is available.'};
  if(state.kind==='account'&&state.create&&this.hasCredential&&!await this.hasCredential(page.url,email)){await this.navigate(state.create,page,{account:true});return {handled:true};}
  if(state.create&&!state.fields.some(f=>f.secret||f.type==='password')&&!state.fields.some(f=>f.type==='email')){await this.navigate(state.create,page,{account:true});return {handled:true};}
  let credential,verificationCode;const codeFields=state.fields.filter(f=>/code|passcode/i.test(f.label)||f.autocomplete==='one-time-code'||state.kind==='verification'&&f.maxLength===1);
  const targetFields=state.inlineForm?codeFields:state.fields;
  for(const field of targetFields){
   if(field.type==='password'||field.secret&&state.kind!=='verification'){credential ||= await this.getCredential(page.url,email,state.kind==='registration'||/register|sign.?up|create|new.password/i.test(page.url+' '+field.label));await this.fillSecret(field,credential.password);continue;}
   if(state.kind==='verification'&&codeFields.includes(field)){if(!this.verification)return {handled:true,blocked:true,message:'Account verification is required. Connect Gmail or enter the code in Chrome and re-scan.'};const effectiveStart=this.startedAt||(state.inlineForm?Date.now()-10*60000:null);if(effectiveStart)verificationCode ||= await this.verification({page,recipient:email,startedAt:effectiveStart,progress:this.progress});if(!verificationCode){if(state.resend&&!this.resent){this.resent=true;await this.navigate(state.resend,page,{account:true,verificationRequest:true,beforeClick:()=>this.recordVerificationRequest()});this.attempts.set(key,attempts);return {handled:true,recovered:true};}return {handled:true,blocked:true,message:'No authenticated verification email dated after the recorded request was found. Enter the security code in Chrome and re-scan, or submit again.'};}const split=codeFields.length===verificationCode.length&&codeFields.every(f=>f.maxLength===1||/digit\s*\d|pin.?code/i.test(f.label+' '+f.id));await this.fillSecret(field,split?verificationCode[codeFields.indexOf(field)]:verificationCode);continue;}
   const answer=field.type==='email'||/^(?:email|email address|username|user name)$/i.test(field.label)?{kind:'answer',value:email}:resolve(field,this.profile,{posting:page.text});
   if(answer?.kind==='answer'){this.progress('Account step · '+field.label);await this.apply(field,answer.value);}
   else if(field.required&&!field.value)return {handled:true,blocked:true,message:'The employer account requires information not available in your profile: '+field.label};
  }
  if(state.inlineForm&&!state.action)return {handled:true};
  const beforeClick=state.kind==='verification'?undefined:()=>this.recordVerificationRequest();
  const transition=await this.navigate(state.action,page,{account:true,beforeClick});if(transition?.recovered)this.attempts.set(key,attempts);return {handled:true};
 }
}
module.exports={AccountFlow};

const {resolve,norm:normalizeLabel}=require('./canonical.cjs');
const {candidateContact}=require('./candidate-contact.cjs');
const declineOptions=choices=>choices.filter(o=>/^(?:(?:i )?(?:decline(?: to)?|prefer not to|choose not to|do not (?:wish|want) to)(?: (?:say|answer|respond|disclose(?: (?:my )?(?:gender|veteran status))?|self identify|provide (?:this|the) information))?|not disclosed|do not disclose)$/.test(normalizeLabel(o.label)));
const genericAnswer=(choices,discovery)=>{
 const generic=[/^(?:other|other source)$/,/^(?:no preference|not specified|prefer not to say)$/];
 if(discovery)generic.push(/^(?:online|internet|job board|online job board|company website|careers website|careers site)$/);
 for(const name of generic){
  const matching=choices.filter(o=>name.test(normalizeLabel(o.label)));
  if(matching.length===1)return matching[0];
 }
};
function candidateProposals(bundle,profile,context={}){
 const out={};
 const contact=candidateContact(profile);
 bundle.candidateContact=contact;
 bundle.candidateProfile=profile;
 bundle.candidateEvidence={resumeHash:require('./evidence-domain.cjs').hash(profile.resume||{}),profileHash:require('./evidence-domain.cjs').hash(profile.additional||'')};
 for(const c of bundle.controls){
  if((/verification code|security code|one[- ]time|confirmation code|passcode/i.test(c.label+' '+(bundle.label||''))||(c.dom.maxLength===1&&/security|verification|code|digit/i.test(c.label+' '+(bundle.label||'')+' '+c.dom.identity)))&&c.rawValue){out[c.id]={kind:'answer',value:c.rawValue,evidence:'Verification security code entered in form',source:bundle.candidateEvidence};continue;}
  const field={id:c.id,label:c.label,type:c.type,tag:c.dom.tag,required:c.dom.required,options:[],context:bundle.label};
  // Reuse the fact resolver, but never its old generated option mapping or
  // retention/default logic. The domain layer owns all finite-choice mapping.
  let p=resolve(field,profile,context);
  const label=normalizeLabel(c.label);
  const discovery=/^how (?:did|do) you (?:first )?(?:hear|learn|find out) about |^where did you (?:hear about|find|see) (?:this|the) (?:job|position|role)/.test(label)&&!/(?:referral|employee|referred)/.test(label);
  const preference=/^(?:preferred (?:contact method|communication method|pronouns|salutation)|(?:any )?additional (?:comments|information)|anything else (?:you would like to share|we should know))$/.test(label);
  const allowGeneric=/^Use a generic answer for low-stakes application questions when no specific answer is saved, or leave them blank if optional\.$/im.test(profile.additional||'');
  if(allowGeneric&&(discovery||preference)&&(!p||p.kind!=='answer'||p.assumption)){
   const offered=genericAnswer(c.choices,discovery);
   if(c.domain==='single'&&offered)p={kind:'answer',value:offered.value,evidence:'Candidate authorized a generic answer for low-stakes questions'};
   else if(!c.dom.required&&!c.rawValue&&c.domain==='text')p={kind:'answer',value:'',evidence:'Optional low-stakes question left blank by candidate preference'};
   else if(!c.dom.required&&!c.rawValue&&c.domain==='single'&&c.expanded!=='true')p={kind:'leave-empty',value:[],evidence:'Optional low-stakes question left blank by candidate preference'};
   else if(discovery&&c.type==='combobox'&&!c.choices.length)p={kind:'answer',value:'Other',discoverGeneric:true,evidence:'Candidate authorized a generic answer for low-stakes questions'};
   else if(discovery&&c.domain==='text'&&!c.dom.readOnly)p={kind:'answer',value:'Other',evidence:'Candidate authorized a generic answer for low-stakes questions'};
   else p={kind:'unknown',reason:'The site did not offer an unambiguous generic answer'};
  }
  if(!p&&c.domain==='single'&&/^(?:please select your education|education)$/.test(normalizeLabel(c.label))&&/\bi am (?:currently )?attending college\b/i.test(profile.additional||'')){
   const beyond=c.choices.filter(o=>/^beyond high school$/i.test(o.label.trim()));
   if(beyond.length===1)p={kind:'answer',value:beyond[0].value,evidence:'Candidate explicitly states current college enrollment'};
  }
  const explicit=(profile.questionFacts||[]).filter(f=>f.jobId===context.jobId&&f.label===c.label&&f.domain===c.domain&&f.questionLabel===bundle.label&&(!f.controlIdentity||f.controlIdentity===c.dom.identity)&&(!f.questionId||f.questionId===bundle.questionId));
  if(!c.dom.required&&c.domain==='single'&&/^(?:title|salutation|suffix)$/i.test(c.label)&&!c.committed.value?.length&&!c.rawValue)p={kind:'leave-empty',value:[],evidence:'Optional honorific left unanswered; no personal title was supplied'};
  if(!c.dom.required&&['text','file'].includes(c.domain)&&/cover[_\s-]?letter/i.test(c.label)){
   const extra=String(profile.additional||'');
   if(/write.*cover letter|include.*cover letter|generate.*cover letter/i.test(extra)){
    const {generateNarrativeAnswerSync}=require('./narrative-engine.cjs');
    const text=generateNarrativeAnswerSync(c,profile,{...context,applicationUrl:bundle.observation?.url});
    if(text)p={kind:'answer',value:text,evidence:'Auto-generated response grounded in candidate resume and role',assumption:true,draftAuthorized:true};
   }else if(!p||p.kind==='skip'||p.kind==='unknown'){
    p={kind:'answer',value:'',evidence:'Optional cover letter omitted per candidate preference'};
   }
  }
  if(p?.kind==='skip'&&!c.dom.required&&['text','file'].includes(c.domain))p={kind:'answer',value:'',evidence:'Optional control left empty after reassessment: '+p.reason};
  if(!c.dom.required&&c.domain==='boolean'&&/marketing|new job|job opportunities|sms|text messages|talent community/i.test(c.label))p={kind:'answer',value:false,evidence:'Optional communication consent is not authorized by preparing an application'};
  if(c.domain==='boolean'&&/use email address for communication/i.test(c.label)&&profile.resume?.contact?.email)p={kind:'answer',value:true,evidence:'Use the supplied candidate email for this application’s account communication'};
  if(!p&&(require('./canonical.cjs').isNarrative({label:c.label,type:c.type,tag:c.dom.tag})||c.dom.tag==='textarea'||c.dom.maxLength>200||/why|describe|explain|tell us|statement|share|cover letter/i.test(c.label))){
   const {generateNarrativeAnswerSync}=require('./narrative-engine.cjs');
   const text=generateNarrativeAnswerSync(c,profile,{...context,applicationUrl:bundle.observation?.url});
   if(text){
    p={kind:'answer',value:text,evidence:'Auto-generated response grounded in candidate resume and role',assumption:true,draftAuthorized:true};
   }
  }
  if(p?.kind==='answer'&&c.domain==='single'){
   const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
   const parts=o=>o.label.split(',').map(norm);
   let geographic=[];
   if(/^(?:zip|postal)(?: code)?\s*\*?$/i.test(c.label)&&contact.postal_code){
    geographic=c.choices.filter(o=>parts(o)[0]===norm(contact.postal_code));
    if(geographic.length>1&&contact.city)geographic=geographic.filter(o=>parts(o).includes(norm(contact.city)));
    if(geographic.length>1&&contact.county)geographic=geographic.filter(o=>parts(o).some(p=>p.replace(/ county$/,'')===norm(contact.county).replace(/ county$/,'')));
   }else if(/^(?:city|location|location city|location \(city\)|current location|current city)\s*\*?$/i.test(c.label)&&contact.city){geographic=c.choices.filter(o=>parts(o)[0]===norm(contact.city));if(geographic.length>1&&contact.state){const state=require('./geography.cjs').stateCode(contact.state);geographic=geographic.filter(o=>parts(o).some(p=>[norm(state),norm(contact.state)].includes(p)));}}
   else if(/^(?:state|province|state or province)\s*\*?$/i.test(c.label)&&contact.state){const code=require('./geography.cjs').stateCode(contact.state);geographic=c.choices.filter(o=>[norm(contact.state),norm(code)].includes(norm(o.label))||[norm(contact.state),norm(code)].includes(norm(o.value)));}
   else if(/^county\s*\*?$/i.test(c.label)&&contact.county){geographic=c.choices.filter(o=>parts(o)[0].replace(/ county$/,'')===norm(contact.county).replace(/ county$/,''));if(geographic.length>1&&contact.state){const state=require('./geography.cjs').stateCode(contact.state);geographic=geographic.filter(o=>parts(o).some(p=>[norm(state),norm(contact.state)].includes(p)));}}
   if(geographic.length===1)p={...p,value:geographic[0].value,evidence:p.evidence+'; exact candidate address component(s) matched the offered option'};
   if((/^(?:country|country of residence|phone country|country code)$/i.test(c.label)||(bundle.label&&/phone/i.test(bundle.label)&&/country/i.test(c.label))||p.evidence==='resume.contact.country')&&contact.country&&c.choices.length){
    const isUS=/^(?:us|usa|united states(?: of america)?)$/i.test(contact.country);
    let options=[];
    if(isUS){
     options=c.choices.filter(o=>{
      const clean=o.label.replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/[’']/g,'').replace(/[^a-z0-9+]+/gi,' ').trim();
      return /^(?:\+?1\s+)?(?:united states(?: of america)?|usa|us)(?:\s+\+?1)?$/i.test(clean)||
             /^(?:\+?1\s*\(\s*(?:united states(?: of america)?|usa|us)\s*\)|\((?:united states(?: of america)?|usa|us)\)\s*\+?1)$/i.test(clean)||
             /^(?:united states(?: of america)?|usa|us)$/i.test(norm(o.label))||
             /^(?:united states(?: of america)?|usa|us)$/i.test(norm(o.value));
     });
    }else{
     const cNorm=norm(contact.country);
     options=c.choices.filter(o=>{
      const clean=o.label.replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/[’']/g,'').replace(/[^a-z0-9+]+/gi,' ').trim();
      const labelWithoutCode=clean.toLowerCase().replace(/\s*\+\d+.*$/,'').replace(/^\+\d+\s*/,'').trim();
      return labelWithoutCode===cNorm||norm(o.label)===cNorm||norm(o.value)===cNorm;
     });
    }
    if(options.length===1)p={...p,value:options[0].value,evidence:'Candidate country '+contact.country+'; website country option '+options[0].label};
   }
   if(p.value==='decline'){
    const options=declineOptions(c.choices);
    if(options.length===1)p={...p,value:options[0].value};
    else if(!options.length&&c.choices.length&&!c.dom.required&&c.expanded!=='true'){
     if(!c.rawValue&&!c.committed.proven)p={kind:'leave-empty',value:[],evidence:'Voluntary disclosure left blank because the offered choices contain no opt-out'};
     else if(c.type==='combobox')p={kind:'leave-empty',value:[],clearVoluntary:true,evidence:'Clear the optional disclosure because the offered choices contain no opt-out'};
    }
   }
   if(c.choices.length){
    const {findBestChoice,pickEducatedChoice}=require('./resemblance.cjs');
    const best=findBestChoice(c.choices,p.value,c,{bundle,profile,contact});
    if(best){
     p={...p,value:best.value,evidence:p.evidence+'; website choice matched candidate fact ('+best.label+')'};
    }else if(profile?.autonomousDraft||context?.autonomous){
     const educated=pickEducatedChoice(c.choices,c,profile,{bundle,contact,...context});
     if(educated){
      p={kind:'answer',value:educated.value,evidence:'Educated choice based on candidate context ('+educated.label+'); flagged for final review',assumption:true,draftAuthorized:true};
     }
    }
   }
  }
  if(p?.kind==='answer'&&c.domain==='multi'&&Array.isArray(p.value)&&c.choices.length){
   const {findBestChoice}=require('./resemblance.cjs');
   const mapped=p.value.map(val=>{
    const best=findBestChoice(c.choices,val,c,{bundle,profile,contact});
    return best?best.value:val;
   });
   p={...p,value:mapped};
  }
  if((!p||p.kind==='unknown'||(p.kind==='skip'&&c.dom.required))&&(profile?.autonomousDraft||context?.autonomous)){
   const {pickEducatedChoice,guessInitialProposalValue}=require('./resemblance.cjs');
   const {generateNarrativeAnswerSync}=require('./narrative-engine.cjs');
   if(!c.dom.required){
    if(['single','multi'].includes(c.domain)&&c.expanded!=='true')p={kind:'leave-empty',value:[],evidence:'Optional question left blank'};
    else if(c.domain==='boolean')p={kind:'answer',value:false,evidence:'Optional checkbox left unchecked'};
    else if(['text','file'].includes(c.domain))p={kind:'answer',value:'',evidence:'Optional field left blank'};
   }else{
    if(c.domain==='single'){
     if(c.choices.length){
      const educated=pickEducatedChoice(c.choices,c,profile,{bundle,contact,...context});
      if(educated)p={kind:'answer',value:educated.value,evidence:'Educated choice based on candidate context ('+educated.label+'); flagged for final review',assumption:true,draftAuthorized:true};
     }else{
      const initVal=guessInitialProposalValue(c,profile,{bundle,contact,...context});
      p={kind:'answer',value:initVal,discoverOnly:true,evidence:'Provisional educated choice prior to option discovery; flagged for final review',assumption:true,draftAuthorized:true};
     }
    }else if(c.domain==='multi'&&c.choices.length){
     const educated=pickEducatedChoice(c.choices,c,profile,{bundle,contact,...context});
     if(educated)p={kind:'answer',value:[educated.value],evidence:'Educated choice based on candidate context ('+educated.label+'); flagged for final review',assumption:true,draftAuthorized:true};
    }else if(c.domain==='boolean'){
     const boolVal=!/conflict|restrict|convict|felony|relative|former employee/i.test(c.label);
     p={kind:'answer',value:boolVal,evidence:'Educated choice for required checkbox; flagged for final review',assumption:true,draftAuthorized:true};
    }else if(c.domain==='text'){
     const text=generateNarrativeAnswerSync(c,profile,{...context,applicationUrl:bundle.observation?.url});
     if(text)p={kind:'answer',value:text,evidence:'Educated response generated from candidate profile and resume; flagged for final review',assumption:true,draftAuthorized:true};
    }
   }
  }
  if(explicit.length===1)p={kind:'answer',value:explicit[0].value,evidence:'Candidate explicitly supplied this answer for this application question',source:{factId:explicit[0].id,at:explicit[0].at}};
  out[c.id]=p?{...p,source:{...bundle.candidateEvidence,...p.source}}:p;
 }
 return out;
}
module.exports={candidateProposals,declineOptions};

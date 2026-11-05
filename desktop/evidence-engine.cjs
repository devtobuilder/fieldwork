const {runQuestions,hash}=require('./evidence-domain.cjs');
const {candidateProposals}=require('./evidence-candidate.cjs');
const {pageState}=require('./page-state.cjs');
const {entryAction,nextAction}=require('./navigation.cjs');
async function prepareEvidence({collectEvidence,executeEvidence,discoverEvidence,assessEvidence,prepareExperience,profile,jobId,company,inspect,accountStep,returnToApplication,navigate,waitReady,compile,signal,checkpoint=()=>{},progress=()=>{},referralSource,maxPages=12}){
 if(!collectEvidence||!executeEvidence||!assessEvidence)return {pages:[],ready:false,message:'Evidence collector, visual assessor or executor is unavailable. Superseded detection is disabled.'};
 const pages=[],seen=new Set();let pdf,returnedFromAccountHome=false;
 const done=(ready,message,extra={})=>({pages,pdf,ready,message,...extra});
 for(let index=0;index<maxPages;index++){
  signal?.throwIfAborted();await waitReady?.();let metadata=inspect?await inspect():null;
  if(metadata){
   const state=pageState(metadata);
   if(state.kind==='rate_limited')return done(false,state.reason,{retryAt:Date.now()+state.retryAfterMs});
   if(state.kind==='account_home'){
    const dashboard=await inspect();
    if(dashboard.url!==metadata.url||pageState(dashboard).kind!=='account_home')continue;
    if(returnedFromAccountHome||!returnToApplication)return done(false,'The employer returned to the account dashboard. Open the original job to continue.');
    returnedFromAccountHome=true;
    progress('Returning to the original job from the account dashboard');
    await returnToApplication();continue;
   }
   if(accountStep&&['identity','account','registration','verification'].includes(state.kind)){
    const account=await accountStep(metadata);if(account?.blocked)return done(false,account.message);
    if(account?.handled){checkpoint({pages,pdf});continue;}
   }
   const entry=entryAction(metadata);if(entry){if(entry.kind==='blocked'||!navigate)return done(false,entry.reason||'Application entry needs review');await navigate(entry.action,metadata);continue;}
  }
  const experienceIssue=await prepareExperience?.(profile,{collect:collectEvidence,discover:discoverEvidence,assess:assessEvidence,execute:executeEvidence,signal,progress});
  const initial=await collectEvidence();
  if(experienceIssue){pages.push({url:initial[0]?.observation.url||metadata?.url,answers:[],missing:[{label:'Work experience',reason:experienceIssue}],transactions:[]});checkpoint({pages,pdf});return done(false,'Work experience: '+experienceIssue);}
  if(!initial.length)return done(false,'No questions with semantic control evidence were found. Check the visible account, access or application step.');
  const fingerprint=hash(initial.map(q=>[q.questionId,q.controls.map(c=>[c.id,c.label,c.domain])]));
  if(seen.has(fingerprint))return done(false,'Navigation returned to an already assessed application page');seen.add(fingerprint);
  const page={url:initial[0].observation.url,fingerprint,answers:[],missing:[],transactions:[]};pages.push(page);
  checkpoint({pages,pdf});
  const isAutonomous=!!(profile?.autonomousDraft||discoverEvidence);
  const proposalCache=new Map();
  const result=await runQuestions({collect:collectEvidence,discover:discoverEvidence,assessVisual:assessEvidence,signal,continueOnError:isAutonomous,
   progress:(b,c)=>progress('Page '+(index+1)+' · question '+(b.order+1)+' · '+(c?.label||'Assessing grouped controls')),
   propose:async b=>{
    const ctx={jobId,referralSource,company:company||metadata?.structuredCompany,posting:metadata?.text,role:metadata?.structuredRole||metadata?.heading,applicationUrl:page.url,autonomous:isAutonomous};
    const proposals=candidateProposals(b,profile,ctx);
    for(const c of b.controls){
     if(proposals[c.id]?.kind==='resume'){
      if(!compile){proposals[c.id]={kind:'unknown',reason:'The authoritative resume compiler is unavailable'};continue;}
      pdf ||= await compile();proposals[c.id]={kind:'answer',value:require('node:path').basename(pdf.pdf),artifact:pdf.pdf,evidence:'Compiled authoritative resume',source:{sourceHash:pdf.sourceHash,pdfHash:pdf.pdfHash}};
     }
     const cacheKey=c.id+'|'+hash((c.choices||[]).map(o=>[o.value,o.label]));
     if(proposalCache.has(cacheKey)){
      proposals[c.id]=proposalCache.get(cacheKey);
      continue;
     }
     if((!proposals[c.id]||proposals[c.id]?.assumption)&&c.domain==='text'&&(isAutonomous||require('./canonical.cjs').isNarrative({label:c.label,type:c.type,tag:c.dom.tag})||c.dom.tag==='textarea'||/why|describe|explain|tell us|statement|share|cover letter/i.test(c.label))){
      if(!c.dom.required&&!proposals[c.id]?.value)continue;
      const {generateNarrativeAnswer}=require('./narrative-engine.cjs');
      const text=await generateNarrativeAnswer(c,profile,ctx);
      if(text){
       proposals[c.id]={kind:'answer',value:text,evidence:'Auto-generated response grounded in candidate background and role; flagged for final review',assumption:true,draftAuthorized:true,source:proposals[c.id]?.source};
       proposalCache.set(cacheKey,proposals[c.id]);
      }
     }
     if(isAutonomous&&proposals[c.id]?.assumption&&c.domain==='single'&&c.choices.length>1){
      const {selectChoiceWithLLM}=require('./narrative-engine.cjs');
      const picked=await selectChoiceWithLLM(c,c.choices,profile,{...ctx,bundle:b});
      if(picked){
       proposals[c.id]={...proposals[c.id],value:picked.value,evidence:'Educated choice based on candidate context ('+picked.label+'); flagged for final review',assumption:true,draftAuthorized:true};
       proposalCache.set(cacheKey,proposals[c.id]);
      }
     }
    }
    return proposals;
   },execute:executeEvidence,
   trace:t=>{page.transactions.push(t);if(t.verified)for(const a of t.decision.answers){const c=initial.flatMap(q=>q.controls).find(c=>c.id===a.controlId);const idx=page.answers.findIndex(x=>x.id===a.controlId);const entry={id:a.controlId,label:c?.label||a.label||t.label,required:c?.dom.required??a.required,value:a.displayValue??String(a.value),domain:a.domain,choices:a.choices,choiceValues:a.choiceValues,expected:a.optionIds||a.value,optionIds:a.optionIds,empty:a.empty,evidence:a.evidence,assumption:a.assumption,state:'verified',retained:a.retain,questionId:t.questionId};if(idx>=0)page.answers[idx]=entry;else page.answers.push(entry);}checkpoint({pages,pdf});}});
  if(!result.ready){
   const unresolvedList=result.unresolvedQuestions||[{questionId:result.questionId,question:result.question,reason:result.reason}];
   page.missing=unresolvedList.map(u=>({label:u.question,reason:u.reason}));
   const latestInventory=await collectEvidence();
   for(const u of unresolvedList){
    const unresolved=latestInventory.find(q=>u.questionId?q.questionId===u.questionId:q.label===u.question);
    for(const c of unresolved?.controls||[])if(!page.answers.some(a=>a.id===c.id))page.answers.push({id:c.id,label:c.label,type:c.type,domain:c.domain,questionId:unresolved.questionId,required:c.dom.required,value:c.domain==='boolean'?String(c.committed.value):c.domain==='single'?c.choices.find(o=>c.committed.value?.includes(o.id))?.value||'':c.rawValue||'',state:'needs_input',reason:u.reason,choices:c.choices.map(o=>({value:o.value,label:o.label}))});
   }
   checkpoint({pages,pdf});const prefix=result.question?result.question+': ':'';
   return done(false,result.reason?.startsWith(prefix)?result.reason:prefix+result.reason);
  }
  if(!inspect)return done(false,'All questions on this page were reassessed and verified. Page navigation and final review remain.');
  await waitReady?.();metadata=await inspect();
  if(accountStep&&pageState(metadata).kind==='verification'){
   const account=await accountStep(metadata);if(account?.blocked)return done(false,account.message);
   if(account?.handled){seen.delete(fingerprint);pages.pop();checkpoint({pages,pdf});continue;}
  }
  const postInventory=await collectEvidence();
  if(postInventory.some(q=>!page.answers.some(a=>a.questionId===q.questionId||q.controls.some(c=>c.id===a.id)))){
   seen.delete(fingerprint);pages.pop();continue;
  }
  const next=nextAction(metadata);
  if(next.kind==='review'){
   try{require('./submission.cjs').finalAction(metadata);}catch(e){return done(false,e.message);}
   const flaggedCount=pages.flatMap(p=>p.answers).filter(a=>a.assumption).length;
   const reviewMsg=flaggedCount>0
    ?`All application questions were filled and verified (${flaggedCount} educated choice${flaggedCount===1?'':'s'} flagged for your review). Review the answers before explicitly approving final submission.`
    :'All application questions were reassessed and verified. Review the answers before explicitly approving final submission.';
   return done(true,reviewMsg);
  }
  if(next.kind==='blocked'||!navigate)return done(false,next.reason||'Next-step navigation is unavailable');
  await navigate(next.action,metadata);
 }
 return done(false,'The bounded application page limit was reached; no submission was attempted');
}
module.exports={prepareEvidence};

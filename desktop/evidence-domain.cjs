const {createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const norm=x=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ');
const supported=p=>p&&['answer','leave-empty'].includes(p.kind)&&(!p.assumption||p.draftAuthorized===true);
function assertBundle(b){
 if(!b?.questionId||!Number.isInteger(b.order)||!b.controls?.length)throw Error('Question identity is missing');
 if(!b.visual?.reference||!['viewport-css','document-css'].includes(b.visual.coordinateSpace)||!b.observation?.stamp)throw Error('Visual evidence with explicit coordinates is required');
 for(const c of b.controls){
  if(!c.id||!c.dom?.identity)throw Error('Control identity is missing');
  const ids=c.choices.map(o=>o.id);if(new Set(ids).size!==ids.length)throw Error('Ambiguous option IDs');
  for(const o of c.choices)if(!o.id||!o.label||!['dom','network'].includes(o.source?.kind)||o.source.controlId!==c.id)throw Error('Option provenance is not linked to this control');
 }
 return b;
}
function decide(b,proposals){
 assertBundle(b);const answers=[];
 for(const c of b.controls){
  const p=proposals[c.id];
  if(p?.kind==='leave-empty'&&!c.dom.required&&c.domain==='single'&&c.expanded!=='true'){
   const empty=Array.isArray(c.committed.value)&&!c.committed.value.length&&!c.rawValue;
   if(empty||p.clearVoluntary&&c.type==='combobox'){answers.push({controlId:c.id,label:c.label,required:c.dom.required,value:[],optionIds:[],domain:c.domain,choices:c.choices.map(o=>({value:o.value,label:o.label})),choiceValues:[],displayValue:'',empty:true,evidence:p.evidence,retain:empty});continue;}
  }
  if(!supported(p)||p.kind!=='answer'||!p.evidence||p.value===undefined)return {kind:'blocked',reason:p?.reason||'Explicit candidate evidence is missing',controlId:c.id};
  let value=p.value,optionIds;
  if(c.domain==='boolean'){
   if(typeof value!=='boolean'&&!['true','false'].includes(value))return {kind:'blocked',reason:'Boolean control requires an explicit boolean',controlId:c.id};
   value=value===true||value==='true';
  }else if(['single','multi'].includes(c.domain)){
   if(!c.choices.length)return {kind:'blocked',reason:'No website-allowed options linked to this question',controlId:c.id};
   const requested=c.domain==='multi'?value:[value];if(!Array.isArray(requested))return {kind:'blocked',reason:'Multi-select requires an explicit set',controlId:c.id};
   optionIds=[];
   for(const v of requested){
    let matches=c.choices.filter(o=>norm(o.value)===norm(v)||norm(o.label)===norm(v));
    if(matches.length!==1){
     const {findBestChoice,pickEducatedChoice}=require('./resemblance.cjs');
     let best=findBestChoice(c.choices,v,c,{bundle:b,proposal:p,contact:b.candidateContact,profile:b.candidateProfile});
     if(!best&&(p.assumption||b.candidateProfile?.autonomousDraft)){
      best=pickEducatedChoice(c.choices,c,b.candidateProfile,{bundle:b,contact:b.candidateContact});
     }
     if(best)matches=[best];
    }
    if(matches.length!==1)return {kind:'blocked',reason:'No unique website-allowed answer',controlId:c.id};
    optionIds.push(matches[0].id);
   }
   if(c.domain==='multi')optionIds=[...new Set(optionIds)].sort();
   value=c.domain==='multi'?optionIds:optionIds[0];
  }else if(typeof value!=='string'&&typeof value!=='number')return {kind:'blocked',reason:'Text value has an invalid type',controlId:c.id};
  else value=String(value);
  if(c.domain==='text'&&c.dom.maxLength>0&&String(value).length>c.dom.maxLength)return {kind:'blocked',reason:'Answer exceeds website length constraint',controlId:c.id};
  const expected=optionIds||value;
  const retained=c.expanded!=='true'&&c.committed?.proven&&!c.invalid&&hash(c.committed.value)===hash(expected);
  answers.push({controlId:c.id,label:c.label,required:c.dom.required,value,optionIds,domain:c.domain,choices:optionIds?c.choices.map(o=>({value:o.value,label:o.label})):undefined,choiceValues:optionIds?.map(id=>c.choices.find(o=>o.id===id).value),displayValue:optionIds?optionIds.map(id=>c.choices.find(o=>o.id===id).label).join(', '):String(value),artifact:c.domain==='file'?p.artifact:undefined,evidence:p.evidence,source:p.source,assumption:p.assumption===true,retain:!!retained});
 }
 return {kind:'answer',questionId:b.questionId,stamp:b.observation.stamp,answers};
}
function verify(b,d){
 return d.answers.every(a=>{
  const c=b.controls.find(c=>c.id===a.controlId)||(b.controls.find(c=>c.domain==='file'&&(c.label===a.label||/resume|cv/i.test(c.label))))||(b.controls.length===1&&b.controls[0].domain==='file'?b.controls[0]:null);
  if(!c||c.invalid||c.expanded==='true')return false;
  if(a.empty)return !c.dom.required&&Array.isArray(c.committed.value)&&!c.committed.value.length&&!c.rawValue;
  if(c.domain==='file')return c.committed?.proven&&(hash(c.committed.value)===hash(a.value)||c.committed.value===a.value||String(c.committed.value).includes(String(a.value))||String(c.rawValue).includes(String(a.value))||c.committed.value==='attached');
  if(c.committed?.proven&&hash(c.committed.value)===hash(a.optionIds||a.value))return true;
  if(c.type==='combobox'&&c.rawValue&&(a.displayValue||a.value)){
   const actualNorm=norm(String(c.rawValue).replace(/[\u{1F1E6}-\u{1F1FF}]/gu,''));
   const expectedNorm=norm(String(a.displayValue||a.value).replace(/[\u{1F1E6}-\u{1F1FF}]/gu,''));
   if(actualNorm&&expectedNorm&&(actualNorm===expectedNorm||expectedNorm.includes(actualNorm)||actualNorm.includes(expectedNorm)))return true;
  }
  return false;
 });
}
function guardAction({active,deadline,stamp,questionId,controlId,kind},bundle,now=Date.now()){
 if(!active||now>=deadline)throw Error('Expired question action');
 if(stamp!==bundle.observation.stamp)throw Error('Stale observation');
 if(questionId!==bundle.questionId||!bundle.controls.some(c=>c.id===controlId))throw Error('Action outside current question');
 if(!['input','select','check'].includes(kind))throw Error('Navigation and submission are prohibited');
}
async function runQuestions({collect,propose,execute,discover,assessVisual,signal,continueOnError=false,progress=()=>{},settle=()=>new Promise(r=>setTimeout(r,350)),trace=()=>{}}){
 const assessed=new Set(),results=[],unresolvedQuestions=[],refillCounts=new Map();
 for(let n=0;n<200;n++){
  signal?.throwIfAborted();const inventory=await collect();
  // Dependent controls can invalidate an earlier answer. Reassess those answers
  // against their committed decisions before considering the next document question.
  for(const id of [...assessed]){
   if(unresolvedQuestions.some(u=>u.questionId===id))continue;
   const q=inventory.find(q=>q.questionId===id);
   if(!q){if(continueOnError)continue;return {ready:false,results,reason:'An assessed question disappeared; fresh page review is required'};}
   const prev=results.findLast(r=>r.questionId===id);
   const d=prev?.decision||decide(q,await propose(q));
   if(d.kind==='blocked'||!verify(q,d)){
    if(continueOnError){
     const count=(refillCounts.get(id)||0)+1;
     refillCounts.set(id,count);
     if(count<=1){assessed.delete(id);continue;}
     unresolvedQuestions.push({questionId:id,question:q.label,reason:d.reason||'An earlier committed answer changed'});
     continue;
    }
    return {ready:false,results,question:q.label,reason:d.reason||'An earlier committed answer changed; stopped before the next question'};
   }
  }
  const b=inventory.find(q=>!assessed.has(q.questionId));
  if(!b){
   const requiredUnresolved=unresolvedQuestions.find(u=>u.required!==false);
   if(requiredUnresolved)return {ready:false,results,question:requiredUnresolved.question,questionId:requiredUnresolved.questionId,reason:requiredUnresolved.reason,unresolvedQuestions};
   return {ready:true,results};
  }
  let success=false,reason,activeControl;
  for(let attempt=0;attempt<2;attempt++){
   activeControl=null;
   let fresh=attempt?(await collect()).find(q=>q.questionId===b.questionId):b;
   if(!fresh){reason='Question disappeared';break;}
   progress(fresh,fresh.controls.length===1?fresh.controls[0]:null);
   if(discover&&fresh.controls.length===1&&fresh.controls.some(c=>c.domain==='single'&&!c.choices.length)){
    try{await discover(fresh,signal,await propose(fresh));fresh=(await collect()).find(q=>q.questionId===b.questionId);if(!fresh)throw Error('Question disappeared during option discovery');}
    catch(e){signal?.throwIfAborted();reason=e.message;if(attempt===0){trace({questionId:b.questionId,attempt:1,verified:false,reason:e.message});continue;}break;}
   }
   if(assessVisual){
    try{fresh=await assessVisual(fresh,signal);}
    catch(e){signal?.throwIfAborted();reason=e.message;if(attempt===0){trace({questionId:b.questionId,attempt:1,verified:false,reason:e.message});continue;}break;}
   }
   const start=performance.now(),proposals=await propose(fresh);
   // All personal facts must be available before starting a compound question.
   // Website-dependent option lists may appear only after an earlier subcontrol
   // commits; those are discovered and verified in order within this question.
   const unsupported=fresh.controls.find(c=>!supported(proposals[c.id]));
   if(unsupported){activeControl=unsupported;reason=proposals[unsupported.id]?.reason||'Explicit candidate evidence is missing for '+unsupported.label;break;}
   let decision=decide(fresh,proposals);
   if(decision.kind==='blocked'&&fresh.controls.length===1){
    if(discover&&fresh.controls[0].type==='combobox'){
     try{await discover(fresh,signal,proposals);fresh=(await collect()).find(q=>q.questionId===b.questionId);decision=decide(fresh,await propose(fresh));}
     catch(e){signal?.throwIfAborted();reason=e.message;}
    }
    if(decision.kind==='blocked'){reason=reason||decision.reason;break;}
   }
   try{
    if(fresh.controls.length>1){
     const combined=[];
     for(const original of fresh.controls){
      activeControl=original;progress(fresh,original);
      let current=(await collect()).find(q=>q.questionId===b.questionId),c=current?.controls.find(c=>c.id===original.id);
      if(!c)throw Error('A compound subcontrol disappeared');
      if(!verify(current,{answers:combined}))throw Error('An earlier part of this question changed before '+c.label);
      if(discover&&c.domain==='single'&&decide({...current,controls:[c]},await propose(current)).kind==='blocked'){await discover({...current,controls:[c]},signal,await propose(current));current=(await collect()).find(q=>q.questionId===b.questionId);c=current?.controls.find(c=>c.id===original.id);}
      if(!c)throw Error('A compound subcontrol changed during discovery');
      const sub={...current,controls:[c]},step=decide(sub,await propose(current));if(step.kind==='blocked')throw Error(c.label+': '+step.reason);
      if(!step.answers.every(a=>a.retain))await execute(sub,step,signal);
      await settle();const afterStep=(await collect()).find(q=>q.questionId===b.questionId);
      if(!afterStep||!verify(afterStep,step))throw Error(c.label+': committed subcontrol did not match');combined.push(...step.answers);
     }
     decision={kind:'answer',questionId:b.questionId,stamp:fresh.observation.stamp,answers:combined};
    }else if(!decision.answers.every(a=>a.retain))await execute(fresh,decision,signal);
    await settle();signal?.throwIfAborted();const after=(await collect()).find(q=>q.questionId===b.questionId);
    if(!after||!verify(after,decision))throw Error('Committed readback did not match the intended answer');
    const record={questionId:b.questionId,label:b.label,attempt:attempt+1,decision,elapsedMs:performance.now()-start,verified:true};results.push(record);trace(record);assessed.add(b.questionId);success=true;break;
   }catch(e){signal?.throwIfAborted();reason=e.message;trace({questionId:b.questionId,attempt:attempt+1,verified:false,reason,elapsedMs:performance.now()-start});}
  }
  if(!success){
   const isRequired=activeControl?activeControl.dom?.required!==false:b.controls.some(c=>c.dom?.required!==false);
   if(continueOnError){
    assessed.add(b.questionId);
    unresolvedQuestions.push({questionId:b.questionId,question:activeControl?.label||b.label,reason,required:isRequired});
    continue;
   }
   return {ready:false,results,question:activeControl?.label||b.label,questionId:b.questionId,reason};
  }
 }
 return {ready:false,results,reason:'Question limit exceeded'};
}
module.exports={assertBundle,decide,verify,guardAction,runQuestions,hash};

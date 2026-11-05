const {test}=require('node:test'),assert=require('node:assert/strict');
const {preparePages}=require('../desktop/page-engine.cjs'),{runQuestions,decide}=require('../desktop/evidence-domain.cjs'),{candidateProposals}=require('../desktop/evidence-candidate.cjs');
function q(id,label,value='',domain='text',choices=[]){return {questionId:id,order:0,label,visual:{reference:'synthetic-controller-only',coordinateSpace:'viewport-css'},observation:{stamp:'s',url:'https://example.test'},controls:[{id,label,type:domain==='boolean'?'checkbox':domain==='single'?'combobox':'text',domain,dom:{identity:id,tag:'input',required:true},choices:choices.map(([value,label])=>({id:id+'::'+value,value,label,source:{kind:'dom',controlId:id}})),committed:{proven:domain!=='single',value},rawValue:value}]};}
const profile={resume:{name:'Fixture Candidate',contact:{email:'fixture@example.test',state:'Massachusetts'}},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'};
const deps=inventory=>({profile,collectEvidence:async()=>structuredClone(inventory),assessEvidence:async b=>b,executeEvidence:async(b,d)=>{for(const a of d.answers)inventory.find(q=>q.questionId===b.questionId).controls.find(c=>c.id===a.controlId).committed={proven:true,value:a.optionIds||a.value};}});
test('production entry refuses the superseded inspect/apply interface',async()=>{let called=false;const r=await preparePages({inspect:()=>called=true,apply:()=>called=true});assert.equal(r.ready,false);assert.equal(called,false);assert.match(r.message,/disabled/);});
test('reassesses committed answers against candidate facts and retains correct values',async()=>{const inventory=[q('name','Full name','Fixture Candidate')];let writes=0;const r=await preparePages({...deps(inventory),executeEvidence:async()=>writes++});assert.equal(writes,0);assert.equal(r.pages[0].answers[0].retained,true);assert.equal(r.ready,false);assert.match(r.message,/navigation/);});
test('conflicting committed text is corrected using candidate facts',async()=>{const inventory=[q('name','Full name','Different Person')];const r=await preparePages(deps(inventory));assert.equal(r.pages[0].answers[0].value,'Fixture Candidate');assert.equal(inventory[0].controls[0].committed.value,'Fixture Candidate');});
test('unknown referral source cannot be approved from an existing website value',async()=>{const inventory=[q('source','How did you hear about this job?','University')];let writes=0;const r=await preparePages({...deps(inventory),executeEvidence:async()=>writes++});assert.match(r.message,/source|hear/i);assert.equal(writes,0);assert.ok(r.pages[0].answers.every(a=>a.state==='needs_input'));});
test('terms consent uses a boolean while preserving the rest of the domain',async()=>{const inventory=[q('terms','I agree',false,'boolean')];const r=await preparePages(deps(inventory));assert.equal(inventory[0].controls[0].committed.value,true);assert.equal(r.pages[0].answers[0].state,'verified');});
test('an unknown legal fact stops before a later known field',async()=>{const inventory=[q('legal','Have you ever been convicted?'),q('email','Email')];const r=await preparePages(deps(inventory));assert.ok(r.pages[0].answers.every(a=>a.state==='needs_input'));assert.equal(inventory[1].controls[0].committed.value,'');});
test('one transient action failure gets exactly one fresh recovery',async()=>{const inventory=[q('name','Full name')],d=deps(inventory);let attempts=0;const r=await preparePages({...d,executeEvidence:async(...args)=>{if(++attempts===1)throw Error('detached');await d.executeEvidence(...args);}});assert.equal(attempts,2);assert.equal(r.pages[0].transactions.filter(t=>!t.verified).length,1);});
test('persistent failure stops after two attempts without filling the next question',async()=>{const inventory=[q('name','Full name'),q('email','Email')];let attempts=0;const r=await preparePages({...deps(inventory),executeEvidence:async()=>{attempts++;throw Error('uncommitted');}});assert.equal(attempts,2);assert.match(r.message,/uncommitted/);assert.equal(inventory[1].controls[0].committed.value,'');});
test('dependent rerender invalidation stops before a third unrelated question',async()=>{const inventory=[q('name','Full name','Fixture Candidate'),q('email','Email'),q('later','Other question')];const d=deps(inventory);const r=await preparePages({...d,executeEvidence:async(...args)=>{await d.executeEvidence(...args);inventory[0].controls[0].committed.value='';}});assert.match(r.message,/earlier committed answer/);assert.equal(r.pages[0].answers.length,2);});
test('explicit non-disclosure leaves identity boxes unchecked',()=>{const b=q('identity','White',true,'boolean'),p=candidateProposals(b,{resume:{},additional:'I prefer not to disclose voluntary EEO information.'});const d=decide(b,p);assert.equal(d.answers[0].value,false);});
test('finite option identity is selected from labels, never generated text',()=>{const b=q('state','State','', 'single',[['MA','Massachusetts'],['NJ','New Jersey']]),d=decide(b,candidateProposals(b,profile));assert.equal(d.answers[0].value,'state::MA');});
test('country combobox with calling codes maps candidate country to exact website choice',()=>{const usProfile={resume:{name:'Fixture Candidate',contact:{country:'United States'}},additional:''};const b=q('country','Country','','single',[['United States +1','United States +1'],['American Samoa +1','American Samoa +1'],['Canada +1','Canada +1']]);const d=decide(b,candidateProposals(b,usProfile));assert.equal(d.kind,'answer');assert.equal(d.answers[0].value,'country::United States +1');});
test('assumptions without explicit draft authorization cannot pass through the evidence boundary',()=>{const b=q('term','Summer (May - September 2027)',false,'boolean');assert.equal(decide(b,{term:{kind:'answer',value:true,evidence:'Unconfirmed estimate',assumption:true}}).kind,'blocked');});
test('aborted controller cannot continue to another question',async()=>{const abort=new AbortController();abort.abort();await assert.rejects(runQuestions({signal:abort.signal,collect:async()=>{throw Error('must not collect');}}),/abort/i);});
test('Location (City) question liberally matches candidate city and state option',()=>{
 const candidateProfile={resume:{name:'Alex Rivera',contact:{city:'Springfield',state:'Illinois',country:'United States'}},additional:''};
 const b=q('loc','Location (City)','','single',[
  ['Springfield, Illinois, United States','Springfield, Illinois, United States'],
  ['Town of Springfield, Illinois, United States','Town of Springfield, Illinois, United States'],
  ['Springfield Center, Illinois, United States','Springfield Center, Illinois, United States'],
  ['Springfield Earl, England, United Kingdom','Springfield Earl, England, United Kingdom'],
  ['Springfield Outpatient Clinic, Maine, United States','Springfield Outpatient Clinic, Maine, United States']
 ]);
 const d=decide(b,candidateProposals(b,candidateProfile));
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'loc::Springfield, Illinois, United States');
});
test('Location option with postal code liberally matches candidate zip code',()=>{
 const candidateProfile={resume:{name:'Alex Rivera',contact:{city:'Springfield',state:'IL',postal_code:'62701',country:'United States'}},additional:''};
 const b=q('loc','Location','','single',[
  ['Springfield, IL, US, 62701','Springfield, IL, US, 62701'],
  ['Springfield, IL, US, 62702','Springfield, IL, US, 62702'],
  ['Chicago, IL, US, 60601','Chicago, IL, US, 60601']
 ]);
 const d=decide(b,candidateProposals(b,candidateProfile));
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'loc::Springfield, IL, US, 62701');
});
test('Degree question liberally matches Associate Degree from candidate Associate fact',()=>{
 const eduProfile={resume:{name:'Fixture Candidate',education:[{degree:'Associate',actively_pursuing:true}]},additional:''};
 const b=q('degree','Degree','','single',[
  ['High School','High School'],
  ['Associate Degree','Associate Degree'],
  ['Bachelor Degree','Bachelor Degree'],
  ['Master Degree','Master Degree']
 ]);
 const d=decide(b,candidateProposals(b,eduProfile));
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'degree::Associate Degree');
});
test('Work authorization question liberally matches verbose affirmative option',()=>{
 const authProfile={resume:{name:'Fixture Candidate',contact:{country:'United States'}},additional:'I am a U.S. citizen.'};
 const b=q('work_auth','Are you legally authorized to work in the United States?','','single',[
  ['Yes, I am authorized to work in the US for any employer','Yes, I am authorized to work in the US for any employer'],
  ['No, I am not authorized to work in the United States','No, I am not authorized to work in the United States']
 ]);
 const d=decide(b,candidateProposals(b,authProfile));
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'work_auth::Yes, I am authorized to work in the US for any employer');
});
test('Visa sponsorship question liberally matches verbose negative option',()=>{
 const authProfile={resume:{name:'Fixture Candidate',contact:{country:'United States'}},additional:'I am a U.S. citizen.'};
 const b=q('sponsor','Will you now or in the future require visa sponsorship?','','single',[
  ['Yes, I will require sponsorship','Yes, I will require sponsorship'],
  ['No, I will not require sponsorship now or in the future','No, I will not require sponsorship now or in the future']
 ]);
 const d=decide(b,candidateProposals(b,authProfile));
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'sponsor::No, I will not require sponsorship now or in the future');
});
test('open-ended motivation question auto-generates human response without em dashes',()=>{
 const rockstarProfile={resume:{name:'Alex Rivera',experience:[{company:'Example Studio',title:'Founder'}]},additional:''};
 const b={questionId:'why_rockstar',order:0,label:'Why do you want to work for Rockstar Games?',visual:{reference:'synthetic-controller-only',coordinateSpace:'viewport-css'},observation:{stamp:'s',url:'https://job-boards.greenhouse.io/rockstargames/jobs/8014479003'},controls:[{id:'why_rockstar',label:'Why do you want to work for Rockstar Games?',type:'textarea',domain:'text',dom:{identity:'why_rockstar',tag:'textarea',required:true},choices:[],committed:{proven:false,value:''},rawValue:''}]};
 const p=candidateProposals(b,rockstarProfile);
 assert.equal(p.why_rockstar?.kind,'answer');
 assert.ok(p.why_rockstar?.value?.length>20);
 assert.ok(!/[—–]/.test(p.why_rockstar?.value));
 assert.ok(!/--/.test(p.why_rockstar?.value));
 assert.match(p.why_rockstar?.value,/Rockstar|Example Studio|team/i);
 const d=decide(b,p);
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,p.why_rockstar.value);
});
test('Rockstar Games Data Privacy Consent dropdown selects Acknowledge/Confirm without typing Yes',()=>{
 const rockstarProfile={resume:{name:'Alex Rivera'},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.',autonomousDraft:true};
 const b=q('privacy','Rockstar Games Application/Data Privacy Consent *','','single',[
  ['Acknowledge','I Acknowledge']
 ]);
 const p=candidateProposals(b,rockstarProfile);
 const d=decide(b,p);
 assert.equal(d.kind,'answer');
 assert.equal(d.answers[0].value,'privacy::Acknowledge');
});
test('autonomous mode answers unseen arbitrary questions like Do you like bananas and flags them as assumptions for final review',async()=>{
 const autonomousProfile={resume:{name:'Alex Rivera',contact:{email:'alex@example.test'},experience:[{company:'Example Studio',title:'Founder'}]},additional:'I am a U.S. citizen.',autonomousDraft:true};
 const inventory=[
  q('bananas_select','Do you like bananas? *','','single',[['yes_opt','Yes, definitely'],['no_opt','No']]),
  q('bananas_text','What is your favorite fruit and why? *','','text'),
  q('email','Email *','')
 ];
 const r=await preparePages({
  ...deps(inventory),
  profile:autonomousProfile,
  inspect:async()=>({url:'https://example.test',fields:[{label:'Email *',type:'email'}],navigation:[{id:'submit',text:'Submit Application'}]})
 });
 assert.equal(r.ready,true);
 assert.equal(r.pages[0].answers.length,3);
 assert.equal(r.pages[0].answers[0].value,'Yes, definitely');
 assert.equal(r.pages[0].answers[0].assumption,true);
 assert.equal(r.pages[0].answers[1].assumption,true);
 assert.ok(r.pages[0].answers[1].value.length>0);
 assert.equal(r.pages[0].answers[2].value,'alex@example.test');
 assert.match(r.message,/flagged for your review/i);
});
test('NetworkContext matches dropdown options by question label and question_ prefix before interaction',()=>{
 const {NetworkContext}=require('../desktop/network-context.cjs');
 const nc=new NetworkContext();
 nc.begin('https://job-boards.greenhouse.io/rockstargames/jobs/8014479003');
 nc.ingestHtml('<script>window.__DATA__ = {"questions":[{"label":"Rockstar Games Application/Data Privacy Consent","fields":[{"name":"question_991122","type":"multi_value_single_select","values":[{"label":"Acknowledge/Confirm","value":556677}]}]}]};</script>','https://job-boards.greenhouse.io/rockstargames/jobs/8014479003');
 const matchedByLabel=nc.matchControl({id:'ev-react-select-5-input',label:'Rockstar Games Application/Data Privacy Consent *',dom:{stable:'react-select-5-input',name:''}},'https://job-boards.greenhouse.io');
 assert.ok(matchedByLabel);
 assert.equal(matchedByLabel.options[0].label,'Acknowledge/Confirm');
 const matchedById=nc.matchControl({id:'ev-991122',label:'Unknown',dom:{stable:'991122',name:''}},'https://job-boards.greenhouse.io');
 assert.ok(matchedById);
 assert.equal(matchedById.options[0].value,'556677');
});

test('Rockstar Games multi-combobox form reaches ready to submit without losing earlier combobox commitments',async()=>{
 const rockstarProfile={resume:{name:'Alex Rivera',contact:{email:'alex@example.test',phone:'(555) 010-2030',city:'Springfield',state:'Illinois',country:'United States'},experience:[{company:'Example Interactive',title:'Developer'}]},additional:'I am a U.S. citizen.',autonomousDraft:true};
 const inventory=[
  q('worked_rockstar','Have you or a relative ever worked for Rockstar, T2, Zynga, 2K or any of their affiliates or subsidiary companies before? *','','single',[['No','No'],['Yes','Yes']]),
  q('privacy_consent','Rockstar Games Application/Data Privacy Consent *','','single',[['I Have Read','I Have Read']]),
  q('us_auth','Are you legally authorized to work in the United States? *','','single',[['Yes','Yes'],['No','No']])
 ];
 const r=await preparePages({
  profile:rockstarProfile,
  collectEvidence:async()=>structuredClone(inventory),
  assessEvidence:async b=>b,
  executeEvidence:async(b,d)=>{
   for(const a of d.answers){
    const ctrl=inventory.find(x=>x.questionId===b.questionId).controls.find(c=>c.id===a.controlId);
    ctrl.committed={proven:true,value:a.optionIds||a.value};
    ctrl.rawValue=a.displayValue;
   }
  },
  inspect:async()=>({url:'https://job-boards.greenhouse.io/rockstargames/jobs/8014479003',fields:[{label:'First Name *',type:'text'}],navigation:[{id:'submit',text:'Submit application'}]})
 });
 assert.equal(r.ready,true);
 assert.equal(r.pages[0].answers.length,3);
 assert.equal(r.pages[0].answers[0].value,'No');
 assert.equal(r.pages[0].answers[0].state,'verified');
 assert.equal(r.pages[0].answers[0].assumption,true);
 assert.equal(r.pages[0].answers[1].value,'I Have Read');
 assert.equal(r.pages[0].answers[1].state,'verified');
 assert.equal(r.pages[0].answers[2].value,'Yes');
 assert.equal(r.pages[0].answers[2].state,'verified');
});

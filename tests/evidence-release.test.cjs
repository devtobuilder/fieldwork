const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepareEvidence}=require('../desktop/evidence-engine.cjs'),{runQuestions,decide}=require('../desktop/evidence-domain.cjs'),{candidateProposals}=require('../desktop/evidence-candidate.cjs'),{validateAnswers}=require('../desktop/evidence-review.cjs');
const q=(id,label='Full name',domain='text')=>({questionId:id,order:0,label,visual:{reference:'synthetic',coordinateSpace:'viewport-css'},observation:{stamp:id,url:'https://example.test/apply'},controls:[{id,label,type:domain==='file'?'file':'text',domain,dom:{identity:id,tag:'input',required:true},choices:[],rawValue:'',committed:{proven:true,value:''}}]});
const profile={resume:{name:'Fixture Candidate'}};
function harness(steps){let index=0;const nav=[];return {get index(){return index;},nav,deps:{profile,collectEvidence:async()=>structuredClone(steps[index]),assessEvidence:async b=>b,executeEvidence:async(b,d)=>{for(const a of d.answers)steps[index].flatMap(q=>q.controls).find(c=>c.id===a.controlId).committed={proven:true,value:a.optionIds||a.value};},inspect:async()=>({url:'https://example.test/apply',fields:[{label:'Full name',type:'text'}],navigation:index<steps.length-1?[{id:'next',text:'Next'}]:[{id:'submit',text:'Submit application'}]}),navigate:async a=>{assert.equal(a.text,'Next');nav.push(a.id);index++;}}};}
test('two-page preparation verifies every page and stops for final approval',async()=>{const h=harness([[q('first')],[q('second')]]),r=await prepareEvidence(h.deps);assert.equal(r.ready,true);assert.equal(r.pages.length,2);assert.deepEqual(h.nav,['next']);assert.match(r.message,/explicitly approving/);validateAnswers([q('second')].map(b=>({...b,controls:b.controls.map(c=>({...c,committed:{proven:true,value:'Fixture Candidate'}}))})),r.pages[1].answers);});
test('resume artifact is compiled once and its exact filename is verified',async()=>{const h=harness([[q('file','Resume/CV','file')]]);let compiles=0,artifact;const exec=h.deps.executeEvidence;const r=await prepareEvidence({...h.deps,compile:async()=>{compiles++;return {pdf:'C:/private/artifacts/Resume.pdf',pdfHash:'hash',sourceHash:'source'};},executeEvidence:async(b,d)=>{artifact=d.answers[0].artifact;await exec(b,d);}});assert.equal(compiles,1);assert.equal(artifact,'C:/private/artifacts/Resume.pdf');assert.equal(r.ready,true);assert.equal(r.pages[0].answers[0].value,'Resume.pdf');});
test('known account step runs before the application evidence controller',async()=>{const h=harness([[q('name')]]);let account=true,handled=0;const base=h.deps.inspect;const r=await prepareEvidence({...h.deps,inspect:async()=>account?{url:'https://example.test/login',fields:[{type:'email',label:'Email Address'}],navigation:[{id:'continue',text:'Continue'}]}:base(),accountStep:async()=>{account=false;handled++;return {handled:true};}});assert.equal(handled,1);assert.equal(r.ready,true);});
test('provider lockout stops before collection, navigation or account retries',async()=>{const r=await prepareEvidence({collectEvidence:async()=>{throw Error('must not collect');},executeEvidence:async()=>{},assessEvidence:async()=>{},inspect:async()=>({heading:'Too many attempts. Retry in 30 minutes.',fields:[],navigation:[]})});assert.equal(r.ready,false);assert.ok(r.retryAt>Date.now()+29*60000);});
test('compound dependent domain is discovered after its preceding subcontrol commits',async()=>{const b=q('compound','Address'),second={...q('city','City','single').controls[0],type:'combobox'};b.controls.push(second);let discoveries=0;const r=await runQuestions({collect:async()=>[structuredClone(b)],propose:async()=>({compound:{kind:'answer',value:'candidate postal',evidence:'explicit postal'},city:{kind:'answer',value:'offered',evidence:'explicit city'}}),discover:async()=>{discoveries++;assert.equal(b.controls[0].committed.value,'candidate postal');second.choices=[{id:'city::allowed',label:'Offered city',value:'offered',source:{kind:'dom',controlId:'city'}}];},execute:async(_,d)=>{for(const a of d.answers)b.controls.find(c=>c.id===a.controlId).committed={proven:true,value:a.optionIds||a.value};},settle:async()=>{}});assert.equal(r.ready,true);assert.equal(discoveries,1);assert.equal(r.results.length,1);assert.equal(r.results[0].decision.answers.length,2);});
test('unknown legal history is never inferred; explicit fact is scoped to this job',()=>{const b=q('legal','Have you ever been convicted?'),p={resume:{},questionFacts:[{id:'fact',jobId:'this-job',label:b.label,domain:'text',questionLabel:b.label,value:'No',at:'recorded'}]};assert.notEqual(candidateProposals(b,p,{jobId:'another-job'}).legal?.kind,'answer');assert.equal(candidateProposals(b,p,{jobId:'this-job'}).legal.value,'No');});
test('final review rejects unknown, changed and invalid committed values',()=>{const b=q('name');assert.throws(()=>validateAnswers([b],[]),/Unassessed/);const a=[{id:'name',state:'verified',expected:'Fixture Candidate'}];assert.throws(()=>validateAnswers([b],a),/changed/);b.controls[0].committed.value='Fixture Candidate';assert.equal(validateAnswers([b],a),true);b.controls[0].invalid=true;assert.throws(()=>validateAnswers([b],a),/invalid/);
 const unmountedResume=q('ev-upload-label-resume::file','Resume/CV*','file');
 unmountedResume.questionId='div.file-upload';
 unmountedResume.controls[0].committed={proven:true,value:'Resume.pdf'};
 assert.equal(validateAnswers([unmountedResume],[{id:'ev-#resume',questionId:'div.file-upload',label:'Resume/CV *',domain:'file',state:'verified',value:'Resume.pdf',expected:'Resume.pdf'}]),true);
});
test('optional title can remain blank without inventing an honorific',()=>{const b=q('title','Title','single');b.controls[0].dom.required=false;b.controls[0].committed={proven:false,value:[]};assert.equal(candidateProposals(b,profile).title.kind,'leave-empty');});

test('failed ZIP subcontrol reports ZIP instead of the address group title',async()=>{
 const address=q('address','Country *'),zip=q('zip','ZIP Code *').controls[0];
 address.controls.push(zip);
 const seen=[];
 const result=await runQuestions({
  collect:async()=>[structuredClone(address)],
  propose:async()=>({address:{kind:'answer',value:'United States',evidence:'profile'},zip:{kind:'answer',value:'01234',evidence:'profile'}}),
  execute:async(_,decision)=>{const answer=decision.answers[0];if(answer.controlId==='address')address.controls[0].committed={proven:true,value:answer.value};},
  progress:(_,control)=>{if(control)seen.push(control.label);}
 });
 assert.equal(result.ready,false);
 assert.equal(result.question,'ZIP Code *');
 assert.equal(result.questionId,'address');
 assert.equal(seen.at(-1),'ZIP Code *');
});

test('profile citizenship answers U.S. eligibility and scoped sponsorship questions',()=>{
 const candidate={resume:{},additional:'I am a U.S. citizen. I am attending college.'};
 const proposal=(label,context)=>candidateProposals(q('field',label,'single'),candidate,context).field;
 assert.equal(proposal('Are you legally eligible to work in the United States?').value,'Yes');
 assert.equal(proposal('Will you now or in the future require visa sponsorship for employment at Staples?',{posting:'Austin, TX'}).value,'No');
 assert.notEqual(proposal('Are you legally eligible to work in Canada?')?.kind,'answer');
 assert.notEqual(proposal('Are you over 18?')?.kind,'answer');
 const education=q('education','Please select your education:','single');
 education.controls[0].choices=[{label:'Beyond High School',value:'higher-education'}];
 assert.equal(candidateProposals(education,candidate).education.value,'higher-education');
});

test('explicit draft availability survives preparation and is surfaced for final approval',async()=>{
 const item=q('hours','Are you available to work 40 hours per week during the internship?','single');
 item.controls[0].choices=['Yes','No'].map(value=>({id:'hours::'+value,label:value,value,source:{kind:'dom',controlId:'hours'}}));
 const h=harness([[item]]);
 const r=await prepareEvidence({...h.deps,profile:{resume:{},additional:'For application drafts, automatically propose availability based on my education.'}});
 assert.equal(r.ready,true);
 assert.equal(r.pages[0].answers[0].value,'Yes');
 assert.equal(r.pages[0].answers[0].assumption,true);
});

test('no conflicting agreements does not imply no previously signed confidentiality agreement',()=>{
 const candidate={resume:{},additional:'I consent to all application agreements and authorize the assistant to accept them on my behalf. I do not have any agreements with other employers that would conflict with this employment.'};
 const proposal=label=>candidateProposals(q('field',label,'single'),candidate).field;
 assert.equal(proposal('Do you have any agreements that would conflict with this employment?').value,'No');
 assert.notEqual(proposal('Have you signed an Agreement with a current/previous employer containing confidentiality or non solicitation terms?').kind,'answer');
});

test('reusable history answers employer questions without treating an incomplete history as No',()=>{
 const candidate={resume:{experience:[{company:'Example Labs, Inc.'}]}};
 const ask=(label,company)=>candidateProposals(q('field',label,'single'),candidate,{company}).field;
 assert.equal(ask('Have you worked with this company?','Example Labs').value,'Yes');
 assert.notEqual(ask('Have you worked with this company?','Different Labs')?.kind,'answer');
 candidate.additional='My saved work history lists every employer I have worked for.\nMy saved work history lists all companies I have worked with through temp agencies or contractor assignments.\nI have no relatives employed by companies I apply to.\nI have signed an employer agreement containing confidentiality, noncompete, or nonsolicitation terms.\nI am over 18 years old.';
 assert.equal(ask('Have you ever been employed by Different Labs?').value,'No');
 assert.equal(ask('Have you worked with this company?','Different Labs').value,'No');
 assert.notEqual(ask('Have you worked with this company?')?.kind,'answer');
 assert.notEqual(ask('Have you ever worked with children?')?.kind,'answer');
 assert.equal(ask('Have you ever been employed by a temp agency working on Different Labs business either in a facility or a remote location?').value,'No');
 assert.equal(ask('Do you have any relatives employed at Different Labs?').value,'No');
 assert.equal(ask('Have you signed an Agreement with a current/previous employer containing confidentiality, non competition, or non solicitation?').value,'Yes');
 assert.equal(ask('Are you over 18?').value,'Yes');
});

test('account dashboard resumes the queued job once and bounds redirect loops',async()=>{
 const h=harness([[q('name')]]);
 const home={url:'https://example.test/account',heading:'Welcome to Candidate Home',fields:[],navigation:[]};
 let onHome=true,returns=0;
 const r=await prepareEvidence({...h.deps,inspect:()=>onHome?home:h.deps.inspect(),returnToApplication:async()=>{returns++;onHome=false;}});
 assert.equal(r.ready,true);
 assert.equal(returns,1);
 const loop=await prepareEvidence({...h.deps,inspect:()=>home,returnToApplication:async()=>{returns++;}});
 assert.equal(loop.ready,false);
 assert.match(loop.message,/account dashboard/);
 assert.equal(returns,2);
});

test('redirect recovery retries interrupted reads and propagates unrelated errors',async()=>{
 const {retryNavigationRead}=require('../desktop/navigation-read.cjs');
 let reads=0;
 assert.equal(await retryNavigationRead(()=>{if(++reads===1)throw Error('Execution context was destroyed, most likely because of a navigation');return 'new document';}),'new document');
 assert.equal(reads,2);
 await assert.rejects(retryNavigationRead(()=>{throw Error('Invalid locator');}),/Invalid locator/);
});

test('low-stakes defaults choose offered generic answers without inventing candidate facts',()=>{
 const profile={resume:{},additional:'Use a generic answer for low-stakes application questions when no specific answer is saved, or leave them blank if optional.'};
 const field=q('source','How Did You Hear About Us?*','single');
 field.controls[0].choices=['Other','Employee Referral'].map(value=>({id:'source::'+value,label:value,value,source:{kind:'dom',controlId:'source'}}));
 assert.equal(decide(field,candidateProposals(field,profile)).answers[0].displayValue,'Other');
 assert.equal(candidateProposals(field,profile,{referralSource:'Employee Referral'}).source.value,'Employee Referral');
 const optional=q('notes','Additional comments');
 optional.controls[0].dom.required=false;
 assert.equal(candidateProposals(optional,profile).notes.value,'');
 assert.notEqual(candidateProposals(q('ref','Were you referred by an employee?','single'),profile).ref?.kind,'answer');
 assert.notEqual(candidateProposals(q('age','Are you over 18?','single'),profile).age?.kind,'answer');
});

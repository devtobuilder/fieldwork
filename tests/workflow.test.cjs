const test=require('node:test'),assert=require('node:assert/strict');
const {pageState}=require('../desktop/page-state.cjs');const {AccountFlow}=require('../desktop/accounts.cjs');const {preparePages}=require('../desktop/page-engine.cjs');const {readiness}=require('../desktop/navigation.cjs');
const profile={resume:{name:'Fixture Candidate',contact:{email:'candidate@example.test'}},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'};
test('landing search widgets and duplicate Apply links do not become an application form',()=>{
 const page={fields:[{label:'Search Jobs by Keyword',type:'text',required:true},{label:'Location',type:'combobox'}],navigation:[{id:'a',text:'Apply',href:'https://ats.example/apply'},{id:'b',text:'APPLY',href:'https://ats.example/apply'}]};assert.equal(pageState(page).kind,'landing');assert.equal(pageState(page).action.href,'https://ats.example/apply');
});
test('email gateway and registration are distinguished from application questions',()=>{
 assert.equal(pageState({fields:[{label:'Email Address',type:'email'},{label:'I agree with the terms and conditions',type:'checkbox'}],navigation:[{text:'NEXT'}]}).kind,'identity');
 assert.equal(pageState({fields:[{label:'Password',type:'password',secret:true}],navigation:[{text:'Create account'}]}).kind,'registration');
});
test('registration saves/reuses one credential for password and confirmation, without draft answers',async()=>{
 const page={url:'https://ats.example/register',fields:[{id:'email',label:'Email Address',type:'email',required:true},{id:'password',label:'Password',type:'password',secret:true},{id:'confirm',label:'Confirm Password',type:'password',secret:true},{id:'terms',label:'I agree',type:'checkbox',required:true}],navigation:[{id:'register',text:'Create account'}]};let generated=0;const secretFields=[];let navigated=false;
 const flow=new AccountFlow({profile,getCredential:async()=>{generated++;return {password:'synthetic-password'}},fillSecret:async(f,value)=>secretFields.push([f.id,value]),apply:async(f,value)=>{assert.equal(value,f.id==='email'?'candidate@example.test':'true')},navigate:async(action,_page,options)=>{assert.equal(action.id,'register');assert.equal(options.account,true);navigated=true;}});
 assert.deepEqual(await flow.step(page),{handled:true});assert.equal(generated,1);assert.equal(secretFields.length,2);assert.equal(navigated,true);
});
test('unknown existing login follows registration instead of inventing a login password',async()=>{
 let selected;const flow=new AccountFlow({profile,hasCredential:async()=>false,navigate:async a=>selected=a.text,getCredential:async()=>{throw Error('must not generate login password')}});await flow.step({url:'https://ats.example/login',fields:[{label:'Password',type:'password',secret:true}],navigation:[{id:'login',text:'Sign in'},{id:'create',text:'Create account'}]});assert.equal(selected,'Create account');
});
test('site validation errors block readiness even with nonempty optional answers',()=>{assert.equal(readiness([{id:'email',label:'Email',value:'bad',invalid:true}],[{id:'email',value:'bad',state:'verified'}]).ready,false);});

test('employer portal receipt requires the matching applied requisition and portal',()=>{
 const {portalReceipt}=require('../desktop/submission.cjs');
 const base='https://jobs.example.test/candidate/sites/example';
 const text='My Applications\nActive Job Applications\nFixture engineer\nStatus: Under Consideration\nExample Inc. • 77076 • Applied on 11/05/2026';
 const page={url:base+'/my-profile',text};
 assert.equal(portalReceipt(page,base+'/job/77076/apply/section/1').requisitionId,'77076');
 assert.equal(portalReceipt(page,base+'/job/77077/apply/section/1'),null);
 assert.equal(portalReceipt({...page,url:'https://other.example.test/candidate/sites/example/my-profile'},base+'/job/77076/apply'),null);
 assert.equal(portalReceipt({...page,text:text.replace('Applied on','Saved on')},base+'/job/77076/apply'),null);
});

test('account navigation text and a partial form do not trigger dashboard recovery',()=>{
 const {pageState}=require('../desktop/page-state.cjs');
 const page={heading:'Fixture Job',text:'Candidate Home\nMy Information',fields:[{label:'Country',type:'combobox'}],navigation:[{text:'Save and Continue'}]};
 assert.equal(pageState(page).kind,'form');
 assert.notEqual(pageState({...page,fields:[]}).kind,'account_home');
 assert.equal(pageState({heading:'Welcome to Candidate Home',fields:[],navigation:[{text:'Search for Jobs'}]}).kind,'account_home');
});

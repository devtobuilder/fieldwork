const test=require('node:test'),assert=require('node:assert/strict');
const {entryAction,nextAction}=require('../desktop/navigation.cjs');
const {isKnownFinalRequest}=require('../desktop/browser-gate.cjs');
test('landing Apply and empty-step Next are navigation without form fields',()=>{
 for(const text of ['Apply now','Next','Continue'])assert.equal(entryAction({fields:[],navigation:[{text}]}).kind,'entry');
 assert.equal(entryAction({fields:[{label:'Resume',type:'file'}],navigation:[{text:'Apply now'}]}),null);
 assert.equal(nextAction({navigation:[{text:'Next',href:'/step2'},{text:'Next',href:'/step2'}]}).kind,'next');
});
test('final request detection covers cross-origin Greenhouse without blocking ordinary site POSTs',()=>{
 for(const host of ['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io'])assert.equal(isKnownFinalRequest(`https://${host}/employer/jobs/123`,'POST'),true);
 assert.equal(isKnownFinalRequest('https://ats.example/submit-application','POST'),true);
 for(const pathname of ['/oauth/token','/upload','/next','/search','/captcha'])assert.equal(isKnownFinalRequest('https://ats.example'+pathname,'POST'),false);
 assert.equal(isKnownFinalRequest('https://boards.greenhouse.io/employer/jobs/123','GET'),false);
});

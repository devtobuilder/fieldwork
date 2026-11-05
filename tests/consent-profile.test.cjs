const test=require('node:test'),assert=require('node:assert/strict');const {resolve}=require('../desktop/canonical.cjs');
test('explicit applicant terms authorization checks privacy acknowledgment',()=>{const result=resolve({label:'Acknowledge/Confirm',type:'checkbox',context:'Please review and acknowledge Candidate Privacy Policy'},{resume:{},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'});assert.equal(result.value,'true');});
test('terms consent does not fabricate factual accuracy certifications',()=>{const result=resolve({label:'I certify all answers are accurate',type:'checkbox',context:'Terms'},{resume:{},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'});assert.equal(result.kind,'unknown');});
test('common agreement labels follow authorization without opting into marketing',()=>{
 const profile={resume:{},additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'};
 for(const label of ['I agree','Accept agreements','I accept the terms','Application agreement'])assert.equal(resolve({label,type:'checkbox'},profile).value,'true');
 assert.notEqual(resolve({label:'I agree to receive promotional marketing',type:'checkbox'},profile)?.value,'true');
});

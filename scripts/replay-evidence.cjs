// Reads PRIVATE captured failures in place. Never generates a public fixture from personal data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {decide,verify,hash}=require('../desktop/evidence-domain.cjs');
const start=performance.now(),root=path.resolve(__dirname,'../.runtime');
const phone=JSON.parse(fs.readFileSync(path.join(root,'phone-structure.json'))),failure=JSON.parse(fs.readFileSync(path.join(root,'sequential-live-result.json')));
const group=phone.ancestors.find(a=>a.role==='group'&&a.inputs.length===2);
assert.ok(group,'Real compound phone control group is missing');
assert.ok(group.inputs.some(i=>i.type==='tel'));
assert.ok(phone.phoneFields.some(f=>f.invalid),'Recording must preserve the actual failed phone state');
const b={questionId:'recorded-phone',order:0,label:'Phone Number',visual:{reference:path.join(root,'sequential-live-final.png'),coordinateSpace:'document-css'},observation:{stamp:'recorded-not-actionable'},controls:group.inputs.map(i=>({id:i.field,domain:i.role==='combobox'?'single':'text',dom:{identity:i.id||i.field},choices:[],invalid:phone.phoneFields.find(f=>f.id===i.field)?.invalid,committed:{proven:false}}))};
assert.ok(fs.existsSync(b.visual.reference));
const proposals=Object.fromEntries(b.controls.map(c=>[c.id,{kind:'answer',value:'untrusted proposal',evidence:'boundary test only'}]));
assert.equal(decide(b,proposals).kind,'blocked','Missing recorded options must never be fabricated');
assert.equal(failure.ready,false);assert.ok(failure.transactions.some(t=>t.question==='ZIP Code'&&t.stage==='failed'));
const retained=JSON.parse(fs.readFileSync(path.join(root,'evidence-staples-before.json'))),after=JSON.parse(fs.readFileSync(path.join(root,'evidence-staples-after.json')));
assert.ok(retained.bundle.visual.assessment.confirmed);assert.ok(retained.bundle.candidateEvidence.resumeHash);assert.ok(retained.bundle.candidateEvidence.profileHash);
const replayed=decide(retained.bundle,retained.proposals),projection=d=>({kind:d.kind,questionId:d.questionId,stamp:d.stamp,answers:d.answers.map(({controlId,value,optionIds,evidence,source,retain})=>({controlId,value,optionIds,evidence,source,retain}))});assert.equal(hash(projection(replayed)),hash(projection(retained.decision)),'Recorded semantic decision differs');assert.ok(replayed.answers.every(a=>a.retain));assert.ok(verify(after,replayed));
const report={kind:'captured-real-failure-and-retention-replay',elapsedMs:performance.now()-start,assertions:13,recordings:['phone-structure.json','sequential-live-result.json','sequential-live-final.png','evidence-staples-before.json','evidence-staples-after.json'],limitations:['Original capture contains no linked option schema or authoritative candidate decision for phone. Phone replay proves refusal, grouping and recorded failure only.','Retained text decision is from the bounded real Staples capture, tied to authoritative resume/profile hashes and a visual assessment.','Screenshot references are recordings, not fresh action observations. No replay-based model or live website reliability claim.']};
fs.writeFileSync(path.join(root,'evidence-replay-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

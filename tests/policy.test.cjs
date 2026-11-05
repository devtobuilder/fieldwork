const test=require('node:test'),assert=require('node:assert/strict');
const {safeUrl,arbitrate,ticket,consume,password}=require('../desktop/policy.cjs');
test('rejects local and credential-bearing queue URLs',()=>{for(const u of ['http://example.com','https://127.0.0.1','https://u:p@example.com','https://192.168.1.1'])assert.throws(()=>safeUrl(u));assert.equal(safeUrl('https://example.com/job#top'),'https://example.com/job');});
test('disagreement pauses instead of averaging confidence',()=>{assert.equal(arbitrate({value:'yes'},{value:'no'}).mode,'pause');assert.equal(arbitrate({value:'yes'},null).mode,'visual');});
test('approval binds to current snapshot and expires',()=>{const j={id:'one'},s={answers:['A']},a=ticket(j,s);assert.ok(consume(a,j,s));assert.throws(()=>consume(a,j,{answers:['B']}));assert.throws(()=>consume({...a,expires:0},j,s));});
test('passwords differ and satisfy common character classes',()=>{const p=password();assert.notEqual(p,password());assert.match(p,/[A-Z]/);assert.match(p,/[a-z]/);assert.match(p,/\d/);assert.match(p,/!/);});

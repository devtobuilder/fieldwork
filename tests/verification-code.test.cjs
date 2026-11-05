const test=require('node:test'),assert=require('node:assert/strict');const {matchedCode}=require('../desktop/verification-code.cjs');
const options={recipient:'candidate@example.test',domains:['employer.test'],startedAt:Date.now()-10000};
const message=()=>({internalDate:String(Date.now()),payload:{headers:[{name:'Date',value:new Date().toISOString()},{name:'To',value:'candidate@example.test'},{name:'From',value:'Accounts <accounts@employer.test>'},{name:'Authentication-Results',value:'mx.google.com; dkim=pass header.d=employer.test; spf=pass'}],body:{data:Buffer.from('Your verification code is 123456').toString('base64url')}}});
test('an older email that arrives after the current request is rejected',()=>{
 const m=message(),startedAt=Date.now()-1000;
 m.payload.headers[0].value=new Date(startedAt-1).toISOString();
 assert.equal(matchedCode(m,{...options,startedAt}),null);
 m.payload.headers[0].value=new Date(startedAt).toISOString();
 assert.equal(matchedCode(m,{...options,startedAt}),'123456');
 m.internalDate='invalid';assert.equal(matchedCode(m,{...options,startedAt}),null);
});
test('automatic Gmail lookup requires a known request timestamp',async()=>{
 const {Gmail}=require('../desktop/gmail.cjs');
 const gmail={status:()=>({connected:true}),api:async()=>assert.fail('An unknown request must not search Gmail')};
 assert.equal(await Gmail.prototype.code.call(gmail,{...options,startedAt:undefined}),null);
});
test('same-second mail Date uses the exact Gmail receipt cutoff',()=>{
 const m=message(),startedAt=Math.floor((Date.now()-1000)/1000)*1000+400;
 m.payload.headers[0].value=new Date(startedAt).toUTCString();
 m.internalDate=String(startedAt-1);assert.equal(matchedCode(m,{...options,startedAt}),null);
 m.internalDate=String(startedAt);assert.equal(matchedCode(m,{...options,startedAt}),'123456');
 m.payload.headers[0].value=new Date(startedAt-1000).toUTCString();
 assert.equal(matchedCode(m,{...options,startedAt}),null);
});
test('Gmail refresh finds a code arriving after the former polling window',async(t)=>{
 const {Gmail}=require('../desktop/gmail.cjs'),now=Date.now();
 t.mock.timers.enable({apis:['Date','setTimeout'],now});
 let searches=0;
 const gmail={status:()=>({connected:true}),api:async suffix=>{
  if(suffix.startsWith('/messages?')){searches++;return {messages:Date.now()-now>=18000?[{id:'delayed'}]:[]};}
  return {...message(),id:'delayed'};
 }};
 const pending=Gmail.prototype.code.call(gmail,{...options,startedAt:now});
 for(let i=0;i<6;i++){await new Promise(setImmediate);t.mock.timers.tick(3000);}
 assert.equal(await pending,'123456');assert.equal(searches,7);
});
test('only recent recipient-matched aligned employer verification codes are returned',()=>{assert.equal(matchedCode(message(),options),'123456');const wrong=message();wrong.payload.headers.find(h=>h.name==='From').value='accounts@different.test';assert.equal(matchedCode(wrong,options),null);const old=message();old.internalDate='1';assert.equal(matchedCode(old,options),null);const unauth=message();unauth.payload.headers.pop();assert.equal(matchedCode(unauth,options),null);const ambiguous=message();ambiguous.payload.body.data=Buffer.from('Verification code: 123456. Security code: 654321').toString('base64url');assert.equal(matchedCode(ambiguous,options),null);});
test('HTML nonbreaking spaces are decoded and sender-stated code expiry is honored',()=>{const m=message();m.payload.body.data=Buffer.from('Confirm your identity using this one-time code:&nbsp;<b>123456</b> This code will expire in 10 minutes.').toString('base64url');assert.equal(matchedCode(m,options),'123456');m.internalDate=String(Date.now()-11*60000);assert.equal(matchedCode(m,{...options,startedAt:Date.now()-15*60000}),null);});
test('newer authenticated code supersedes older codes from the same verification window',async()=>{const {Gmail}=require('../desktop/gmail.cjs');const old=message(),recent=message();old.internalDate=String(Date.now()-2000);recent.internalDate=String(Date.now()-500);recent.payload.body.data=Buffer.from('Verification code: 654321').toString('base64url');const fake={status:()=>({connected:true}),api:async suffix=>suffix.startsWith('/messages?')?{messages:[{id:'old'},{id:'new'}]}:suffix.includes('/old')?old:recent};const result=await Gmail.prototype.code.call(fake,{recipient:options.recipient,domains:options.domains,startedAt:Date.now()-5000});assert.equal(result,'654321');});
test('thread replies are expanded and quoted older codes do not win selection',async()=>{const {Gmail}=require('../desktop/gmail.cjs');const old=message(),reply=message();old.id='root';reply.id='reply';old.internalDate=String(Date.now()-3000);reply.internalDate=String(Date.now()-500);reply.payload.body.data=Buffer.from('Verification code:&nbsp;654321<blockquote>Verification code: 123456</blockquote>').toString('base64url');const fake={status:()=>({connected:true}),api:async suffix=>suffix.startsWith('/messages?')?{messages:[{id:'root',threadId:'conversation'}]}:{messages:[old,reply]}};assert.equal(await Gmail.prototype.code.call(fake,{recipient:options.recipient,domains:options.domains,startedAt:Date.now()-5000}),'654321');});

const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes,createHash}=require('node:crypto');const {shell}=require('electron');
const timers=require('node:timers/promises');
class Gmail{
 constructor({store,safeStorage,win}){Object.assign(this,{store,safeStorage,win});this.server=null;}
 config(){const file=fs.readdirSync(path.join(os.homedir(),'Downloads')).find(f=>/^client_secret.*\.json$/.test(f));if(!file)throw Error('Desktop Google client file not found in Downloads');const c=JSON.parse(fs.readFileSync(path.join(os.homedir(),'Downloads',file),'utf8')).installed;if(!c?.client_id||!c.client_secret)throw Error('Google client must be desktop/installed type');return c;}
 tokens(){const r=this.store.get('vault','gmail');return r?JSON.parse(this.safeStorage.decryptString(Buffer.from(r.encrypted,'base64'))):null;}
 save(t){if(!this.safeStorage.isEncryptionAvailable())throw Error('Windows token protection unavailable');this.store.put('vault','gmail',{encrypted:this.safeStorage.encryptString(JSON.stringify(t)).toString('base64')});}
 status(){return {connected:!!this.store.get('vault','gmail'),connecting:!!this.server};}
 async connect(){if(this.server)return this.status();const c=this.config(),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');let redirect;
 this.server=http.createServer(async(req,res)=>{const u=new URL(req.url,redirect);if(req.method!=='GET'||u.pathname!=='/oauth/callback'||req.headers.host!==new URL(redirect).host||u.searchParams.get('state')!==state){res.writeHead(400);return res.end('Invalid authorization response');}try{if(u.searchParams.has('error'))throw Error('Authorization declined');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,code:u.searchParams.get('code')||'',code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Token exchange failed');const t=await r.json();this.save({...t,expiresAt:Date.now()+t.expires_in*1000});res.setHeader('Content-Type','text/plain');res.end('Gmail connected. Return to Fieldwork.');this.win.webContents.send('fieldwork:change');}catch{res.writeHead(400);res.end('Gmail connection failed. Return to Fieldwork and reconnect.');}finally{this.close();}});
 await new Promise(resolve=>this.server.listen(0,'127.0.0.1',resolve));redirect='http://127.0.0.1:'+this.server.address().port+'/oauth/callback';this.timer=setTimeout(()=>this.close(),180000);const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:c.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.readonly',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();await shell.openExternal(u.href);return this.status();}
 close(){clearTimeout(this.timer);this.server?.close();this.server=null;}
 async disconnect(){this.close();const tokens=this.tokens();if(tokens){try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',body:new URLSearchParams({token:tokens.refresh_token||tokens.access_token}),signal:AbortSignal.timeout(10000)});}finally{this.store.remove('vault','gmail');}}return this.status();}
 async access(){const t=this.tokens();if(!t)throw Error('Connect Gmail first');if(t.expiresAt>Date.now()+60000)return t.access_token;if(!t.refresh_token)throw Error('Reconnect Gmail');const c=this.config();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:t.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Reconnect Gmail');const next=await r.json();this.save({...t,...next,expiresAt:Date.now()+next.expires_in*1000});return next.access_token;}
 async api(suffix,signal){const token=await this.access();const timeout=AbortSignal.timeout(10000);const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+suffix,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});if(!r.ok)throw Error('Gmail request failed');return r.json();}
 async code({recipient,domains,startedAt,signal,progress=()=>{}}){
  if(!Number.isSafeInteger(startedAt)||startedAt<=0)return null;
  if(!this.status().connected)throw Error('Connect Gmail in Settings to retrieve the account verification code automatically.');
  const {matchedCode}=require('./verification-code.cjs');
  const allowed=[...new Set(domains.filter(d=>/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(d)))];
  if(!allowed.length)return null;
  startedAt=Math.max(Date.now()-15*60000,startedAt);
  const searchStartedAt=Date.now(),deadline=searchStartedAt+90000;
  const timeout=AbortSignal.timeout(90000),lookupSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  // Search rounds to seconds. The matcher enforces the exact receipt cutoff.
  const q=`to:${recipient} after:${Math.floor(startedAt/1000)-1} {${allowed.map(d=>'from:('+d+')').join(' ')}}`;
  try{
   while(Date.now()<deadline){
    lookupSignal.throwIfAborted();
    progress(`Checking Gmail for a new verification email · ${Math.floor((Date.now()-searchStartedAt)/1000)}s elapsed`);
    const result=await this.api('/messages?'+new URLSearchParams({q,maxResults:'12'}),lookupSignal);
    const messages=new Map(),threads=new Set();
    for(const item of result.messages||[]){
     lookupSignal.throwIfAborted();
     if(item.threadId){
      if(threads.has(item.threadId))continue;
      threads.add(item.threadId);
      const thread=await this.api('/threads/'+item.threadId+'?format=full',lookupSignal);
      for(const message of thread.messages||[])messages.set(message.id,message);
     }else{
      const message=await this.api('/messages/'+item.id+'?format=full',lookupSignal);
      messages.set(item.id,message);
     }
    }
    lookupSignal.throwIfAborted();
    const candidates=[];
    for(const message of messages.values()){
     const code=matchedCode(message,{recipient,domains:allowed,startedAt});
     if(code)candidates.push({code,at:Number(message.internalDate)});
    }
    candidates.sort((a,b)=>b.at-a.at);
    if(candidates.length&&(!candidates[1]||candidates[0].at!==candidates[1].at||candidates[0].code===candidates[1].code))return candidates[0].code;
    await timers.setTimeout(Math.min(3000,Math.max(0,deadline-Date.now())),undefined,{signal:lookupSignal});
   }
  }catch(error){signal?.throwIfAborted();if(!timeout.aborted)throw error;}
  return null;
 }
 async find({recipient,domain,startedAt}){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain))throw Error('Enter expected recipient and sender domain');const since=Math.max(Date.now()-15*60000,Number(startedAt)||Date.now()-5*60000);const q=`to:${recipient} from:(${domain}) after:${Math.floor(since/1000)} {subject:verification subject:verify subject:code subject:confirm}`;const result=await this.api('/messages?'+new URLSearchParams({q,maxResults:'5'}));const matches=[];for(const item of result.messages||[]){const m=await this.api('/messages/'+item.id+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Authentication-Results');const h=Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));if(Number(m.internalDate)<since||!h.to?.toLowerCase().includes(recipient.toLowerCase())||!new RegExp('@'+domain.replaceAll('.','\\.')+'(?:[>\\s]|$)','i').test(h.from||''))continue;matches.push({id:m.id,subject:h.subject||'Verification message',sender:h.from,authenticated:/(dkim|spf)=pass/i.test(h['authentication-results']||'')});}return {messages:matches,message:'Matching metadata only. Automatic code use remains disabled until identity matching tests pass.'};}
}
module.exports={Gmail};

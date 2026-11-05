const {app,BrowserWindow,WebContentsView,ipcMain,session,safeStorage,dialog,shell,screen,powerMonitor}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
require('electron').protocol.registerSchemesAsPrivileged([{scheme:'fieldwork-fixture',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const {randomUUID,createHash}=require('node:crypto');
const {execFile}=require('node:child_process');
const {Store}=require('./store.cjs');
const {safeUrl,digest,ticket,consume,password}=require('./policy.cjs');
const {observe,applyAnswer}=require('./page-observation.cjs');
const {propose}=require('./models.cjs');
const {createVisual,capture,selectVisual,startFrames}=require('./visual.cjs');
const accountEntrySmoke=process.argv.includes('--account-entry-smoke');const externalFixture=process.argv.includes('--external-fixture-smoke')||accountEntrySmoke;const smoke=process.argv.includes('--fixture-smoke')||externalFixture;
if(smoke)app.setPath('userData',accountEntrySmoke?path.join(os.tmpdir(),'fieldwork-account-entry-'+(app.isPackaged?'packaged':'source')):app.isPackaged?path.join(os.tmpdir(),'fieldwork-packaged-smoke'):path.join(__dirname,externalFixture?'../.runtime/external-shell':'../.runtime/smoke'));
else app.setPath('userData',require('./data-directory.cjs').migrateDataDirectory(os.homedir(),app.getPath('appData')));
if(process.argv.includes('--release-check')){require('./release-check.cjs').run({app,safeStorage});return;}
if(!smoke){const lock=app.requestSingleInstanceLock();if(!lock){app.quit();return;}app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});}
process.env.MIDSCENE_RUN_DIR=path.join(app.getPath('userData'),'diagnostics');
let startupStateLogged=false;
function startupLog(event,details={}){try{const dir=path.join(app.getPath('userData'),'diagnostics');fs.mkdirSync(dir,{recursive:true});fs.appendFileSync(path.join(dir,'startup.jsonl'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,event,...details})+'\n');}catch{}}
startupLog('launch',{exe:process.execPath,cwd:process.cwd(),userData:app.getPath('userData'),appData:app.getPath('appData'),packaged:app.isPackaged,smoke});

let win,store,active=null,bounds=null,running=null,gmail,queuePaused=true,queueActive=false,modalJob=null,browsers=null;
const tabs=new Map(),approvals=new Map(),leases=new Map(),uploadCapabilities=new Map();
const home=os.homedir(),portfolioDir=()=>process.env.FIELDWORK_PORTFOLIO_DIR||path.dirname(path.dirname(settings().resumeSource));
const defaults={visionModel:'qwen3-vl:4b-instruct',domModel:'qwen3:8b',resumeSource:path.join(home,'Documents/Fieldwork/portfolio/content/resume.yaml'),compiler:path.join(home,'Downloads/files/build_resume.py'),additional:'I am a U.S. citizen. I prefer to decline voluntary EEO questions wherever offered. I authorize the assistant to accept application terms and privacy acknowledgments automatically. My saved work history lists every employer I have worked for. I have no relatives employed by companies I apply to. I am over 18 years old. Use a generic answer for low-stakes application questions when no specific answer is saved, or leave them blank if optional.',registration:false};
const settings=()=>({...defaults,...store.get('settings','main')});
function emit(){if(win&&!win.isDestroyed())win.webContents.send('fieldwork:change');}
function save(job){const current=store.get('job',job.id);if(current?.networkEvents||job.networkEvents)job.networkEvents=[...new Map([...(current?.networkEvents||[]),...(job.networkEvents||[])].map(e=>[e.id,e])).values()].slice(-100);job.updatedAt=new Date().toISOString();store.put('job',job.id,job);emit();return job;}
function jobFor(id){const j=store.get('job',id);if(!j)throw Error('Application unavailable');return j;}
function viewFor(id){const v=tabs.get(id);if(!v||v.webContents.isDestroyed())throw Error('Open this application first');return v;}
function invalidate(id,preserveReview=false){if(!preserveReview)approvals.delete(id);if(running?.id!==id||running.kind!=='submission')leases.delete(id);const j=store.get('job',id);if(j?.status==='approved'){j.status='ready_for_review';save(j);}}
function layout(){for(const [id,v]of tabs){if(v.external)continue;v.setVisible(id===active&&!!bounds&&!modalJob);if(id===active&&bounds)v.setBounds(bounds);}}
function changeBounds(b){if(b===null){bounds=null;layout();return;}if(!b||![b.x,b.y,b.width,b.height].every(Number.isFinite))throw Error('Invalid browser bounds');const size=win.getContentBounds();bounds={x:Math.max(0,Math.round(b.x)),y:Math.max(0,Math.round(b.y)),width:Math.max(1,Math.min(size.width,Math.round(b.width))),height:Math.max(1,Math.min(size.height,Math.round(b.height)))};for(const id of tabs.keys())invalidate(id,true);layout();}
async function snapshot(id,job=jobFor(id)){const v=viewFor(id),ob=await v.webContents.executeJavaScript('('+observe.toString()+')()');return {evidenceVersion:2,sessionId:(v.__fieldworkSessionId||=randomUUID()),url:ob.url,fields:v.external?require('./evidence-review.cjs').reviewFields(await require('./evidence-browser.cjs').collectEvidence(v,{capture:false})):ob.fields.map(f=>({id:f.id,label:f.label,value:f.value,type:f.type})),experience:v.external?(await v.frame.evaluate(require('./evidence-experience.cjs').inspectExperience))?.text||'':'',submitAction:(()=>{try{return require('./submission.cjs').finalAction(ob)}catch{return null}})(),pdfHash:job.pdfHash||'',profileHash:digest(settings().additional),candidateFactsHash:digest(store.all('candidate-question-fact').filter(f=>f.jobId===id)),answersHash:digest(job.answers||[]),sourceHash:fs.existsSync(settings().resumeSource)?createHash('sha256').update(fs.readFileSync(settings().resumeSource)).digest('hex'):''};}
async function open(id){const j=jobFor(id);active=id;if(tabs.get(id)?.webContents.isDestroyed())tabs.delete(id);if(!tabs.has(id)){
 let v;if(browsers)v=await browsers.open(id,j.url.startsWith('fieldwork-fixture:')?j.url:j.currentUrl||j.review?.url||j.url);else{
 const ses=session.fromPartition('persist:fieldwork-applications');ses.setPermissionRequestHandler((_,__,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
 v=new WebContentsView({webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});win.contentView.addChildView(v);
 v.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 for(const name of ['will-navigate','will-redirect'])v.webContents.on(name,(event,url)=>{try{safeUrl(url,smoke);}catch{event.preventDefault();}});
 }
 tabs.set(id,v);v.webContents.on('did-navigate',()=>{v.__fieldworkSessionId=randomUUID();invalidate(id);emit();});v.webContents.on('did-finish-load',()=>{v.__fieldworkSessionId=randomUUID();invalidate(id);emit();});
 v.webContents.on('render-process-gone',()=>{const job=jobFor(id);if(closingBrowsers||['confirmed','denied','canceled'].includes(job.status))return;job.status=job.status==='submitting'?'outcome_uncertain':'needs_input';job.message='Application browser closed. Open the browser to continue from the saved draft.';save(job);});
 if(!v.external){layout();await v.webContents.loadURL(j.url);}
 }if(tabs.get(id).external)await tabs.get(id).focus();layout();emit();return true;}

function installRequestGuard(){const ses=session.fromPartition('persist:fieldwork-applications');ses.webRequest.onBeforeRequest((details,cb)=>{
 if(['GET','HEAD','OPTIONS'].includes(details.method))return cb({});
 const pair=[...tabs].find(([,v])=>v.webContents.id===details.webContentsId);const id=pair?.[0];
 const lease=id&&leases.get(id);if(lease?.expires>Date.now()&&lease.origins.includes(new URL(details.url).origin)){lease.requests.push({requestId:details.id,method:details.method});return cb({});}
 if(id&&require('./request-policy.cjs').uploadAllowed(details,uploadCapabilities.get(id)))return cb({});
 if(pair){const v=pair[1];v.__fieldworkBlockedRequests=[...(v.__fieldworkBlockedRequests||[]),require('./request-policy.cjs').requestSummary(details)].slice(-30);}
 if(id){const j=jobFor(id);j.blockedRequests=pair[1].__fieldworkBlockedRequests;if((!running||running.id!==id)&&details.resourceType==='mainFrame'){j.message='An unapproved request was blocked: '+details.method+' '+new URL(details.url).hostname+new URL(details.url).pathname;j.status='needs_input';}save(j);}cb({cancel:true});
 });ses.webRequest.onCompleted((details)=>{const pair=[...tabs].find(([,v])=>v.webContents.id===details.webContentsId);const lease=pair&&leases.get(pair[0]);const request=lease?.requests.find(r=>r.requestId===details.id);if(request)request.status=details.statusCode;});}
async function readProfile(){const YAML=await import('yaml');const file=settings().resumeSource;return {resume:YAML.parse(fs.readFileSync(file,'utf8')),additional:settings().additional,questionFacts:store.all('candidate-question-fact'),autonomousDraft:true};}
async function marker(id,x,y){const v=viewFor(id);await v.webContents.executeJavaScript(`(()=>{let m=document.getElementById('__fieldwork_cursor');if(!m){m=document.createElement('div');m.id='__fieldwork_cursor';document.documentElement.appendChild(m)}m.style.cssText='pointer-events:none;position:fixed;z-index:2147483647;border:3px solid #96f0ba;border-radius:50%;width:18px;height:18px;box-shadow:0 0 0 5px #183d3055;left:${Number(x)-9}px;top:${Number(y)-9}px';setTimeout(()=>m.remove(),450)})()`);}
async function prepare(id){if(jobFor(id).retryAt>Date.now())throw Error('The employer has limited attempts. Preparation can resume after '+new Date(jobFor(id).retryAt).toLocaleTimeString()+'.');if(['confirmed','submitting','outcome_uncertain'].includes(jobFor(id).status))throw Error('This application was already sent or needs receipt reconciliation; it cannot be prepared for resubmission');if(running)throw Error('Another application is running');await open(id);const j=jobFor(id),v=viewFor(id);const abort=new AbortController();running={id,abort};v.__fieldworkActionTrace=[];v.__fieldworkEvidenceTrace=[];v.__fieldworkFailureStep=null;j.preparationStep='Opening application';j.preparationStartedAt=Date.now();j.status='preparing';j.message='Comparing visual and DOM evidence locally';save(j);
 try{
 const actions=require('./page-actions.cjs');const {preparePages}=require('./page-engine.cjs');const {pageImages}=require('./page-images.cjs');const {planPage}=require('./models.cjs');
 const awaitedProfile=await readProfile();
 const navigate=async(action,page,{account=false,verificationRequest=false,beforeClick}={})=>{
  const {classify,entryAction}=require('./navigation.cjs');const state=require('./page-state.cjs').pageState(page);const isEntry=entryAction(page)?.action?.id===action.id;const accountAction=account&&['identity','account','registration','verification'].includes(state.kind)&&[state.action,state.create,state.login,state.resend].some(a=>a?.id===action.id);
  if(!isEntry&&!accountAction&&classify(action)!=='next')throw Error('This action is not an application entry, account step, or Next step');
  if(action.href)safeUrl(action.href,smoke);
  return require('./navigation-step.cjs').navigateStep({view:v,action,page,settings:settings(),signal:abort.signal,verificationRequest:verificationRequest&&action.id===state.resend?.id,fixture:smoke&&!accountEntrySmoke,beforeClick,progress:message=>{j.preparationStep=message;j.message=message;save(j);}});
 };
 const {AccountFlow}=require('./accounts.cjs');const accountFlow=new AccountFlow({profile:awaitedProfile,navigate,startedAt:j.verificationRequestStartedAt,onVerificationRequested:at=>{j.verificationRequestStartedAt=at;save(j);},progress:message=>{j.preparationStep=message;j.message=message;save(j);},apply:(field,value)=>require('./evidence-browser.cjs').executeAccountValue(v,field,value,settings(),abort.signal),
  hasCredential:async(url,username)=>store.all('account').some(a=>a.origin===new URL(url).origin&&a.username.toLowerCase()===username.toLowerCase()),
  verification:({page,recipient,startedAt,progress})=>gmail.code({recipient,startedAt,progress,signal:abort.signal,domains:[...new Set([new URL(page.url).hostname,new URL(j.url).hostname].flatMap(h=>{const d=require('tldts').getDomain(h);return [h,d,d==='greenhouse.io'?'greenhouse-mail.io':null,d==='myworkdayjobs.com'?'myworkday.com':null];}).filter(Boolean).concat(store.all('verification-sender').filter(s=>s.origin===new URL(page.url).origin).map(s=>s.domain)))]}),
  getCredential:async(url,username,create)=>{const origin=new URL(url).origin;const existing=store.all('account').find(a=>a.origin===origin&&a.username.toLowerCase()===username.toLowerCase());if(existing)return {username,password:safeStorage.decryptString(Buffer.from(existing.encrypted,'base64'))};if(!create)throw Error('No saved account exists for this sign-in. Use the Create account link in Chrome, then re-scan.');if(!safeStorage.isEncryptionAvailable())throw Error('Windows credential protection unavailable');const value=password(),id=randomUUID();store.put('account',id,{id,origin,username,encrypted:safeStorage.encryptString(value).toString('base64'),status:'generated',createdAt:new Date().toISOString()});emit();return {username,password:value};},
  fillSecret:async(field,value)=>{abort.signal.throwIfAborted();if(!v.external)throw Error('Automatic account steps require separate Chrome');await v.frame.locator('[data-fieldwork-id="'+field.id+'"]').fill(value);},
 });
 if(!store.get('pre-evidence-reset',id))store.put('pre-evidence-reset',id,{at:new Date().toISOString(),pages:j.pages||[],answers:j.answers||[]});
 const result=await preparePages({profile:awaitedProfile,jobId:id,company:j.company,accountStep:page=>accountFlow.step(page),signal:abort.signal,referralSource:j.referralSource,priorAnswers:j.answers||[],preserveVerified:!!j.review?.sessionId&&j.review.sessionId===v.__fieldworkSessionId&&j.review?.profileHash===digest(settings().additional)&&j.review?.sourceHash===createHash('sha256').update(fs.readFileSync(settings().resumeSource)).digest('hex'),
 collectEvidence:()=>require('./evidence-browser.cjs').collectEvidence(v),
 prepareExperience:(profile,deps)=>require('./evidence-experience.cjs').prepareExperience(v,profile,deps),
 discoverEvidence:(bundle,signal,proposals)=>require('./evidence-browser.cjs').discoverEvidence(v,bundle,signal,{proposals}),
 assessEvidence:(bundle,signal)=>require('./evidence-browser.cjs').assessEvidence(v,bundle,settings(),signal),
 executeEvidence:(bundle,decision,signal)=>require('./evidence-browser.cjs').executeEvidence(v,bundle,decision,settings(),signal),
 waitReady:()=>require('./navigation-read.cjs').retryNavigationRead(()=>require('./evidence-browser.cjs').waitForEvidenceReady(v,abort.signal),abort.signal),
 inspect:()=>require('./navigation-read.cjs').retryNavigationRead(()=>actions.inspect(v),abort.signal),
 returnToApplication:async()=>{abort.signal.throwIfAborted();await v.webContents.loadURL(safeUrl(j.url,smoke));},
 images:page=>pageImages(v,page,abort.signal),
 apply:(field,value)=>require('./evidence-browser.cjs').executeAccountValue(v,field,value,settings(),abort.signal),
 compile:()=>require('./resume.cjs').compile({settings:settings(),dir:path.join(app.getPath('userData'),'artifacts',id),tailor:false,signal:abort.signal}),
 upload:async(field,file)=>{uploadCapabilities.set(id,{file,expires:Date.now()+15000});try{return await actions.upload(v,field,file);}finally{setTimeout(()=>uploadCapabilities.delete(id),15000);}},
 plan:(page,images)=>planPage(settings(),page,awaitedProfile,images,abort.signal),
 progress:message=>{j.preparationStep=message;j.message=message;save(j);},
 checkpoint:state=>{if(state.pages.at(-1)?.url)j.currentUrl=state.pages.at(-1).url;j.pages=structuredClone(state.pages);j.answers=j.pages.flatMap(p=>p.answers);if(state.pdf)Object.assign(j,state.pdf);save(j);},
 navigate});
 if(result.pdf)Object.assign(j,result.pdf);j.pages=result.pages;j.answers=result.pages.flatMap(p=>p.answers);
 j.status=result.ready?'ready_for_review':'needs_input';j.message=result.message;j.retryAt=result.retryAt||null;try{require('./submission.cjs').finalAction(await actions.inspect(v));j.submitReady=result.ready;}catch(error){j.submitReady=false;if(result.ready)j.message=error.message;}j.blockedRequests=v.__fieldworkBlockedRequests||[];j.review=await snapshot(id,j);save(j);

 }catch(e){j.status=running?.terminalStatus||(abort.signal.aborted||e.code==='STEP_NOT_READY'?'paused':'needs_input');j.message=running?.terminalStatus?'Application moved to '+running.terminalStatus+'. Saved answers are preserved.':abort.signal.aborted?'Paused. Saved answers are preserved.':e.message;save(j);}finally{j.actionTrace=[...(v.__fieldworkActionTrace||[]),...(v.__fieldworkEvidenceTrace||[])];j.preparationMs=Date.now()-j.preparationStartedAt;if(['needs_input','paused'].includes(j.status))v.__fieldworkFailureStep=await require('./copy-diagnostics.cjs').captureStep(v).catch(()=>null);save(j);running=null;emit();}return true;}
async function buildPdf(input){const {id,tailor=false}=typeof input==='string'?{id:input}:input;const j=jobFor(id),s=settings(),dir=path.join(app.getPath('userData'),'artifacts',id);const posting=tabs.has(id)?(await viewFor(id).webContents.executeJavaScript('document.body.innerText')).slice(0,12000):'';const result=await require('./resume.cjs').compile({settings:s,dir,posting,tailor});invalidate(id);Object.assign(j,result);j.message=tailor?'Tailored PDF ready. Review summary changes and all facts before approval.':'Source resume PDF ready.';save(j);return {pdfReady:true,changes:result.resumeChanges};}
async function validateSubmission(id){
 if(running)throw Error('Wait for the current operation to finish');const job=jobFor(id);
 if(job.status!=='ready_for_review'||!job.review||job.answers.some(a=>a.state!=='verified'&&a.required!==false))throw Error('Prepare and resolve the draft before submitting');
 const actions=require('./page-actions.cjs'),page=await actions.inspect(viewFor(id));require('./submission.cjs').finalAction(page);
 if(viewFor(id).external)require('./evidence-review.cjs').validateAnswers(await require('./evidence-browser.cjs').collectEvidence(viewFor(id),{capture:false}),job.answers);else if(!require('./navigation.cjs').readiness(page.fields,job.answers).ready)throw Error('Required form answers remain');
 const invalid=await viewFor(id).webContents.executeJavaScript("[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getClientRects().length&&e.validity&&!e.validity.valid&&!(e.type==='checkbox'&&e.name?.endsWith('[]')&&[...(e.closest('fieldset')||e.form||document).querySelectorAll('input[type=checkbox]')].some(n=>n.name===e.name&&n.checked))).length");if(invalid)throw Error('Required or invalid form fields remain');
 const now=await snapshot(id);if(digest(now)!==digest(job.review))throw Error('Form or profile changed. Re-scan draft before submitting.');return {job,now,page};
}
async function syncJob(job){
 if(job.status!=='confirmed')throw Error('Only a confirmed application can update the tracker');const copy=structuredClone(job);if(job.statusUpdate?.pending)job.statusUpdate.attempted=true;job.trackerAttempted=true;job.syncAttempts=(job.syncAttempts||0)+1;job.syncStatus='syncing';job.message='Application received. Updating the portfolio tracker…';save(job);
 try{const fixture=smoke||job.url.startsWith('fieldwork-fixture:');const portfolio=portfolioDir();const result=fixture?{synced:process.env.FIELDWORK_TEST_SYNC_FAIL_ONCE!=='1'||job.syncAttempts>1,trackerId:'app_fixture_'+job.id}:copy.statusUpdate?.pending?await require('./portfolio.cjs').updateStatus(portfolio,copy):await require('./portfolio.cjs').sync(portfolio,copy);job.trackerId=result.trackerId||job.trackerId;job.syncStatus=result.synced?'synced':'failed';if(result.synced&&job.statusUpdate)job.statusUpdate.pending=false;job.message=fixture?'Sample completed. No employer or public portfolio was updated.':result.synced?'Application submitted and portfolio updated.':'Application submitted. Portfolio update is pending; retry sync only.';save(job);return {synced:result.synced,trackerId:job.trackerId};}catch(error){job.syncStatus='failed';job.message='Application submitted. Portfolio update failed; retry sync without resubmitting.';save(job);return {synced:false};}
}
async function completeSubmission(job,before,abort){
 const actions=require('./page-actions.cjs'),{finalAction,receipt,portalReceipt}=require('./submission.cjs'),monitor=require('./surprise-monitor.cjs'),view=viewFor(job.id),action=finalAction(before);
 const origins=[new URL(before.url).origin];if(!view.external&&action.formAction){const u=new URL(safeUrl(action.formAction,smoke));if(!origins.includes(u.origin))origins.push(u.origin);}
 let lease=view.external?await view.authorize(Date.now()+45000):{expires:Date.now()+45000,origins,requests:[]};leases.set(job.id,lease);
 const submitStartedAt=Date.now();job.verificationRequestStartedAt=submitStartedAt;save(job);
 const clickSubmit=async act=>{
  await monitor.dismissObstructions(view);
  const pt=await view.webContents.executeJavaScript(`(()=>{const e=document.querySelector('[data-fieldwork-nav="${act.id}"]');if(!e||e.disabled)throw Error('Submit control changed');e.scrollIntoView({block:'center',behavior:'instant'});let r=e.getBoundingClientRect();let hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!hit||!e.contains(hit)){e.scrollIntoView({block:'nearest',behavior:'instant'});r=e.getBoundingClientRect();hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);}if(!hit||!e.contains(hit))throw Error('Submit control is obscured');return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await actions.click(view,pt.x,pt.y,'Submit application');
 };
 await clickSubmit(action);
 let verificationAttempts=0,dynamicQuestionAttempts=0,secondaryConfirmClicked=false;
 for(let i=0;i<180;i++){
  abort.signal.throwIfAborted();await new Promise(r=>setTimeout(r,250));let page;try{page=await actions.inspect(view)}catch{continue;}
  const found=receipt(page,before.text)||portalReceipt(page,before.url);const accepted=lease.requests.some(r=>['POST','PUT','PATCH'].includes(r.method)&&r.status>=200&&r.status<400);
  if(accepted&&!job.submissionAttempt.requestAccepted){job.submissionAttempt.requestAccepted=true;save(job);}
  if(found&&(accepted||job.url.startsWith('fieldwork-fixture:'))){leases.delete(job.id);job.currentUrl=page.url;job.status='confirmed';job.confirmedAt=new Date().toISOString();job.receipt={...found,automaticallyConfirmed:true};job.employerApplicationId=found.employerApplicationId;save(job);await syncJob(job);return;}
  if(!secondaryConfirmClicked&&i>=2){
   const confirmAct=monitor.findSecondaryConfirmAction(page,action.id);
   if(confirmAct){secondaryConfirmClicked=true;await clickSubmit(confirmAct);continue;}
  }
  const rejected=lease.requests.find(r=>r.final&&r.status>=400);
  const hasUnfilledCode=monitor.findUnfilledCodeFields(page).length>0;
  if((hasUnfilledCode||rejected?.status===428||rejected?.providerCode==='captcha-failed'||require('./page-state.cjs').pageState(page).kind==='verification')&&verificationAttempts<2){
   if(!hasUnfilledCode){
    for(let w=0;w<8;w++){await new Promise(r=>setTimeout(r,250));try{page=await actions.inspect(view);if(monitor.findUnfilledCodeFields(page).length>0)break;}catch{}}
   }
   const email=(await readProfile()).resume?.contact?.email;
   const vRes=await monitor.resolveVerificationSurprise({view,page,gmail,email,urls:[page.url,job.url],startedAt:submitStartedAt,signal:abort.signal,progress:msg=>{job.message=msg;save(job);}});
   if(vRes.detected){
    verificationAttempts++;
    if(vRes.resolved){
     lease=view.external?await view.authorize(Date.now()+45000):{expires:Date.now()+45000,origins,requests:[]};leases.set(job.id,lease);
     const refreshed=await actions.inspect(view);
     await clickSubmit(vRes.verifyAction||finalAction(refreshed));
     continue;
    }
    const err=Error(vRes.reason);err.definitive=true;throw err;
   }
  }
  if(rejected&&dynamicQuestionAttempts<1&&view.external){
   dynamicQuestionAttempts++;
   const api=require('./evidence-browser.cjs'),domain=require('./evidence-domain.cjs');
   const inv=await api.collectEvidence(view,{capture:false}).catch(()=>[]);
   const unverified=inv.filter(q=>!job.answers.some(a=>a.questionId===q.questionId||q.controls.some(c=>c.id===a.id)));
   if(unverified.length){
    job.message='Additional question appeared during submission. Answering automatically…';save(job);
    const prof=await readProfile();
    const {prepareEvidence}=require('./evidence-engine.cjs');
    const rec=await prepareEvidence({profile:prof,jobId:job.id,company:job.company,signal:abort.signal,collectEvidence:()=>api.collectEvidence(view),discoverEvidence:(b,sig,p)=>api.discoverEvidence(view,b,sig,{proposals:p}),assessEvidence:(b,sig)=>api.assessEvidence(view,b,settings(),sig),executeEvidence:(b,d,sig)=>api.executeEvidence(view,b,d,settings(),sig),inspect:()=>actions.inspect(view)});
    if(rec.ready){
     const newAnswers=rec.pages.flatMap(p=>p.answers);
     const hadNewAssumptions=newAnswers.some(a=>a.assumption&&!job.answers.some(old=>old.id===a.id));
     job.pages=rec.pages;job.answers=newAnswers;job.review=await snapshot(job.id,job);
     if(!hadNewAssumptions){
      lease=await view.authorize(Date.now()+45000);leases.set(job.id,lease);
      const refreshed=await actions.inspect(view);
      await clickSubmit(finalAction(refreshed));
      continue;
     }
     job.status='ready_for_review';job.submitReady=true;save(job);
     const err=Error('A new question appeared on submit and was answered with an educated choice. Review the flagged choice and click Submit.');err.definitive=true;throw err;
    }
   }
  }
  if(rejected){const error=Error('Application server rejected the request (HTTP '+rejected.status+(rejected.providerCode?', '+rejected.providerCode:'')+'). Check the highlighted fields or verification in Chrome, then re-scan.');error.definitive=true;throw error;}
 }
 throw Error('No confirmed receipt was received. Check the embedded page for verification or errors; the app will not submit again automatically.');
}
function handle(name,fn){ipcMain.handle('fieldwork:'+name,async(event,data)=>{if(!win||win.isDestroyed()||event.sender!==win.webContents)throw Error('Untrusted or closed caller');try{return {ok:true,data:await fn(data)};}catch(e){return {ok:false,error:e.message};}});}
app.whenReady().then(async()=>{
 powerMonitor.on('lock-screen',()=>{leases.clear();approvals.clear();});store=new Store(app.getPath('userData'),smoke?'fieldwork.db':'fieldwork-v2.db');startupLog('database-opened',{files:store.db.prepare('PRAGMA database_list').all(),total:store.db.prepare('SELECT count(*) AS count FROM records').get().count,jobs:store.db.prepare("SELECT count(*) AS count FROM records WHERE kind='job'").get().count,boundJobs:store.all('job').length});if(!smoke||externalFixture){const {ExternalBrowser}=require('./external-browser.cjs');browsers=new ExternalBrowser({contextStore:{get:id=>store.get('form-context',id),set:(id,state)=>store.put('form-context',id,state)},stateStore:{get:async id=>{const record=store.get('browser-state',id);return record?JSON.parse(safeStorage.decryptString(Buffer.from(record.encrypted,'base64'))):null;},set:async(id,value)=>{if(!safeStorage.isEncryptionAvailable())throw Error('Windows browser-state protection unavailable');store.put('browser-state',id,{encrypted:safeStorage.encryptString(JSON.stringify(value)).toString('base64')});}},directory:path.join(app.getPath('userData'),'browser-profiles'),fixture:externalFixture,headless:externalFixture&&process.env.FIELDWORK_HEADED!=='1',onEvent:(id,event)=>{const job=store.get('job',id);if(job){job.networkEvents=[...(job.networkEvents||[]),event].slice(-100);save(job);}}});}for(const j of store.all('job')){if(j.status==='approved'){j.status='ready_for_review';j.submitReady=false;j.review=null;j.message='Prepare draft to review with the new Submit workflow.';save(j);}if(j.status==='confirmed'&&j.syncStatus==='syncing'){j.syncStatus='failed';j.message='Application submitted. Retry the interrupted portfolio update.';save(j);}if(j.status==='ready_for_review'&&(!j.review?.submitAction||j.review?.evidenceVersion!==2)){j.status='needs_input';j.submitReady=false;j.message='Re-scan to verify every question with the evidence workflow.';save(j);}if(['preparing','submitting'].includes(j.status)){j.status=j.status==='submitting'?'outcome_uncertain':'needs_input';j.message='Interrupted session. Reconcile before continuing.';save(j);}}
 const saved=store.get('settings','window');win=new BrowserWindow({width:saved?.width||1280,height:saved?.height||850,minWidth:900,minHeight:640,backgroundColor:'#f5f5f1',title:'Fieldwork',show:!smoke,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.on('resize',()=>{for(const id of tabs.keys())invalidate(id,true);});win.on('close',()=>{if(running)running.abort.abort();const b=win.getNormalBounds();store.put('settings','window',{width:b.width,height:b.height,maximized:win.isMaximized()});});
 if(saved?.maximized)win.maximize();if(smoke)installRequestGuard();
 handle('state',()=>{try{const jobs=store.all('job');if(!startupStateLogged){startupLog('state-loaded',{count:jobs.length});startupStateLogged=true;}return {jobs,settings:settings(),active,running:running?.id||null,version:app.getVersion(),browserMode:browsers?'external':'embedded'};}catch(error){startupLog('state-failed',{error:error.message});throw error;}});
 handle('add',urls=>{if(typeof urls!=='string'||urls.length>50000)throw Error('Paste up to 100 URLs');const results=[];for(const raw of urls.split(/\s+/).filter(Boolean).slice(0,100)){const url=safeUrl(raw,smoke);if(store.all('job').some(j=>j.url===url))continue;results.push(save({id:randomUUID(),url,title:new URL(url).hostname,status:'queued',createdAt:new Date().toISOString(),answers:[]}));}return results;});
 handle('showDiagnosticImage',()=>require('./copy-diagnostics.cjs').showDiagnosticImage());
 handle('copyDiagnostics',async({id,error}={})=>{
  const job=id?jobFor(id):null,view=id?tabs.get(id):null;
  const diagnostics=require('./copy-diagnostics.cjs');
  const step=(!error&&view?.__fieldworkFailureStep)||await diagnostics.captureStep(view).catch(()=>null);
  return diagnostics.copyDiagnostics({job,error:typeof error==='string'?error.slice(0,2000):'',step,version:app.getVersion()});
 });
 handle('browserFocus',async id=>{const view=viewFor(id);if(view.external)await view.focus();return true;});handle('browserFrame',async id=>{const view=viewFor(id);if(!view.external)return null;return {image:await view.screenshot(),url:view.webContents.getURL()};});
 handle('open',open);handle('bounds',changeBounds);handle('prepare',prepare);handle('pause',()=>{queuePaused=true;running?.abort.abort();return true;});
 handle('runQueue',async()=>{if(queueActive||running)throw Error('Queue already running');queueActive=true;queuePaused=false;try{for(const j of store.all('job').reverse().filter(j=>j.status==='queued')){if(queuePaused)break;await prepare(j.id);}}finally{queueActive=false;emit();}return true;});
 handle('saveProfile',text=>{const result=require('./profile.cjs').saveProfile(store,text,defaults);for(const id of tabs.keys())invalidate(id);emit();return result;});
 handle('saveSettings',data=>{const prior=settings();for(const k of ['visionModel','domModel','resumeSource','compiler'])if(typeof data?.[k]==='string')prior[k]=data[k].slice(0,2000);store.put('settings','main',prior);for(const id of tabs.keys())invalidate(id);emit();return true;});
 handle('models',async()=>{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Ollama unavailable');return (await r.json()).models.map(m=>m.name);});
 handle('inspect',async id=>{await open(id);return viewFor(id).webContents.executeJavaScript('('+observe.toString()+')()');});
 handle('edit',async({id,fieldId,value})=>{if(running)throw Error('Pause before editing');invalidate(id);if(String(fieldId).startsWith('ev-')){const j=jobFor(id),v=viewFor(id),api=require('./evidence-browser.cjs'),domain=require('./evidence-domain.cjs'),inventory=await api.collectEvidence(v);let b=inventory.find(q=>q.controls.some(c=>c.id===fieldId));if(!b)throw Error('Open the question’s page before editing');const c=b.controls.find(c=>c.id===fieldId),supplied=c.domain==='multi'?JSON.parse(String(value)):String(value);b=await api.assessEvidence(v,b,settings());const proposal={kind:'answer',value:supplied,evidence:'Candidate explicitly supplied this application answer'};const sub={...b,controls:[b.controls.find(c=>c.id===fieldId)]},d=domain.decide(sub,{[fieldId]:proposal});if(d.kind!=='answer')throw Error(d.reason);if(!d.answers.every(a=>a.retain))await api.executeEvidence(v,sub,d,settings());const after=(await api.collectEvidence(v)).find(q=>q.questionId===b.questionId);if(!after||!domain.verify(after,d))throw Error('Edited answer was not committed');const factId=digest({jobId:id,label:c.label,domain:c.domain,questionLabel:b.label,controlIdentity:c.dom.identity,questionId:b.questionId});store.put('candidate-question-fact',factId,{id:factId,jobId:id,label:c.label,domain:c.domain,questionLabel:b.label,controlIdentity:c.dom.identity,questionId:b.questionId,value:supplied,at:new Date().toISOString()});const updateAns=a=>{a.value=d.answers[0].displayValue;a.expected=d.answers[0].optionIds||d.answers[0].value;a.optionIds=d.answers[0].optionIds;a.choiceValues=d.answers[0].choiceValues;a.state='verified';delete a.assumption;a.evidence=proposal.evidence;a.reviewedByUser=true;};const a=j.answers.findLast(a=>a.id===fieldId);if(a)updateAns(a);for(const p of j.pages||[])for(const pa of p.answers||[])if(pa.id===fieldId)updateAns(pa);const allVerified=j.answers?.length>0&&!j.answers.some(ans=>ans.state!=='verified'&&ans.required!==false);let canSubmit=false;if(allVerified){try{require('./submission.cjs').finalAction(await require('./page-actions.cjs').inspect(v));canSubmit=true;}catch{}}if(canSubmit){j.status='ready_for_review';j.submitReady=true;j.review=await snapshot(id,j);j.message='Answer updated and verified. Ready to submit.';}else{j.status='needs_input';j.submitReady=false;j.review=null;j.message='Answer saved and verified. Re-scan to reassess every question before final review.';}save(j);return true;}if(String(fieldId).startsWith('visual-')||jobFor(id).answers.find(a=>a.id===fieldId)?.visual){const j=jobFor(id),a=j.answers.find(a=>a.id===fieldId);if(!a)throw Error('Field changed');const result=await dialog.showMessageBox(win,{buttons:['Cancel','Mark reviewed'],defaultId:0,cancelId:0,message:'Confirm the actual form value for '+a.label,detail:'Check the browser tab first. This records your review; it does not fill the browser field.'});if(result.response!==1)return false;a.value=String(value);a.state='verified';a.reviewedByUser=true;save(j);j.review=await snapshot(id,j);save(j);return true;}const v=viewFor(id);await v.webContents.executeJavaScript('('+observe.toString()+')()');const actions=require('./page-actions.cjs');const field=(await actions.inspect(v)).fields.find(f=>f.id===fieldId);if(!field)throw Error('This field is on another page or has changed. Open that page before editing.');const result={value:await actions.apply(v,field,String(value),settings())};const j=jobFor(id);const answer=j.answers.find(a=>a.id===fieldId);if(answer){delete answer.assumption;answer.evidence='Applicant edited this answer';answer.value=String(value);answer.state=result.value===String(value)?'verified':'needs_input';}j.review=await snapshot(id,j);save(j);return true;});
 const stopJob=(id,status)=>{const job=jobFor(id);if(['submitting','outcome_uncertain','confirmed'].includes(job.status))throw Error('A sent application must be tracked through its outcome, not canceled as a draft');if(running?.id===id){running.terminalStatus=status;running.abort.abort();}invalidate(id);job.status=status;job.submitReady=false;job.message=status==='denied'?'Application denied. Saved in Denied.':'Application canceled. Saved in Canceled.';save(job);if(active===id){active=null;layout();}return true;};
 handle('deny',id=>stopJob(id,'denied'));handle('cancel',id=>stopJob(id,'canceled'));
 handle('requeue',id=>{const job=jobFor(id);if(!['denied','canceled'].includes(job.status))throw Error('Only denied or canceled drafts can be restored');job.status='queued';job.message='Restored to the queue';job.review=null;job.submitReady=false;save(job);return true;});
 handle('setApplicationStatus',async({id,status})=>{const allowed=['followed-up','interview','offered','accepted','rejected','auto-rejected','no-response','withdrawn'];if(!allowed.includes(status))throw Error('Unsupported application status');const job=jobFor(id);if(job.status!=='confirmed')throw Error('Only submitted applications have outcome statuses');if(running||job.syncStatus==='syncing')throw Error('Wait for the current submission or tracker update to finish');if(job.applicationStatus===status)return true;job.applicationStatus=status;job.statusUpdate={id:randomUUID(),stage:status,pending:true};save(job);return syncJob(job);});
 handle('reviewApproval',async({id,preview=false})=>{
  const {job,now,page}=await validateSubmission(id);const action=require('./submission.cjs').finalAction(page);const a=ticket(job,now);approvals.set(id,a);
  const image=preview?await capture(viewFor(id)):undefined;modalJob=id;layout();const inferred=require('./submission.cjs').metadata(page);
  return {id,token:a.id,image,expires:a.expires,metadata:{company:job.company||inferred.company,publicTitle:job.publicTitle||inferred.publicTitle,industry:job.industry||inferred.industry},assumptions:job.answers.filter(a=>a.assumption),answerCount:job.answers.length,action:action.text};
 });
 handle('cancelApproval',({id})=>{approvals.delete(id);if(modalJob===id){modalJob=null;layout();}return true;});
 handle('submit',async({id,token,metadata})=>{
  const a=approvals.get(id);if(!a||a.id!==token)throw Error('Review this application before submitting');
  const {job,now,page}=await validateSubmission(id);if(running||approvals.get(id)?.id!==token)throw Error('This confirmation has already been used');consume(a,job,now);
  for(const key of ['company','publicTitle','industry'])if(typeof metadata?.[key]!=='string'||!metadata[key].trim()||metadata[key].length>200)throw Error('Complete the portfolio summary before submitting');
  Object.assign(job,{company:metadata.company.trim(),publicTitle:metadata.publicTitle.trim(),industry:metadata.industry.trim()});
  approvals.delete(id);modalJob=null;layout();const abort=new AbortController();running={id,abort,kind:'submission'};
  job.status='submitting';job.submitReady=false;job.applicationUrl=page.url;job.submissionAttempt={applicationUrl:page.url,id:randomUUID(),startedAt:new Date().toISOString(),priorReceiptText:require('./submission.cjs').receipt(page)?.text||''};job.message='Submitting your approved application…';save(job);
  void completeSubmission(job,page,abort).catch(error=>{job.status=error.definitive?'needs_input':'outcome_uncertain';job.message=error.message;save(job);}).finally(async()=>{leases.delete(id);const view=tabs.get(id);if(view?.external&&!view.closed)await view.revoke().catch(()=>{});running=null;emit();});return {started:true};
 });
 handle('reconcile',async id=>{const job=jobFor(id);if(job.status!=='outcome_uncertain')throw Error('No uncertain submission to reconcile');const page=await require('./page-actions.cjs').inspect(viewFor(id));const {receipt,portalReceipt}=require('./submission.cjs');const found=receipt(page,job.submissionAttempt?.priorReceiptText||'')||portalReceipt(page,job.submissionAttempt?.applicationUrl);if(!found||(!job.submissionAttempt?.requestAccepted&&!job.url.startsWith('fieldwork-fixture:')))throw Error('No submission receipt is visible yet. The form will not be submitted again.');job.status='confirmed';job.confirmedAt=new Date().toISOString();job.receipt={...found,userReconciled:true};job.currentUrl=page.url;job.employerApplicationId=found.employerApplicationId;save(job);return syncJob(job);});
 handle('resumePdf',buildPdf);handle('openPdf',id=>{const j=jobFor(id);if(!j.pdf||!fs.existsSync(j.pdf))throw Error('Generate the PDF first');return shell.openPath(j.pdf);});
 handle('metadata',({id,company,publicTitle,industry})=>{const j=jobFor(id);Object.assign(j,{company:String(company||'').slice(0,200),publicTitle:String(publicTitle||'').slice(0,200),industry:String(industry||'').slice(0,100)});save(j);return true;});
 handle('confirmReceipt',async id=>{const j=jobFor(id);if(!['approved','outcome_uncertain','submitting'].includes(j.status))throw Error('No approved submission to confirm');const v=viewFor(id);const text=await v.webContents.executeJavaScript('document.body.innerText');const receipt=text.match(/(?:thank you for (?:applying|your application)|application (?:has been |was |successfully )?(?:received|submitted)|we have received your application)/i);if(!receipt)throw Error('No recognizable employer receipt. Leave the result uncertain.');const response=await dialog.showMessageBox(win,{buttons:['Cancel','Confirm received'],defaultId:0,cancelId:0,message:'Does this page confirm your application was received?',detail:'Review the employer page before recording this outcome. A verification code alone is not a receipt.'});if(response.response!==1)return false;j.status='confirmed';j.confirmedAt=new Date().toISOString();j.receipt={url:v.webContents.getURL(),text:receipt[0],userConfirmed:true};j.message='Submission receipt confirmed. Public summary can now be synced.';save(j);return true;});
 handle('visualLocate',async({id,description})=>{if(running)throw Error('Pause first');const v=viewFor(id);const stamp=digest(v.getBounds())+v.webContents.getURL();const agent=await createVisual(v,settings());try{const point=await agent.aiLocate(String(description).slice(0,500));if(stamp!==digest(v.getBounds())+v.webContents.getURL())throw Error('Viewport changed; locate again');await marker(id,...point.center);return point;}finally{await agent.destroy();}});
 handle('accounts',()=>store.all('account').map(({encrypted,...a})=>a));
 handle('newAccount',async({origin,username})=>{if(!safeStorage.isEncryptionAvailable())throw Error('Windows encryption unavailable');const u=new URL(safeUrl(origin));const value=password(),id=randomUUID();store.put('account',id,{id,origin:u.origin,username:String(username).slice(0,200),encrypted:safeStorage.encryptString(value).toString('base64'),status:'pending'});emit();return {id};});
 handle('revealAccount',async id=>{const a=store.get('account',id);if(!a)throw Error('Account unavailable');const result=await dialog.showMessageBox(win,{buttons:['Cancel','Reveal'],defaultId:0,cancelId:0,message:'Reveal saved credential for '+a.origin+'?'});return result.response===1?{username:a.username,password:safeStorage.decryptString(Buffer.from(a.encrypted,'base64'))}:null;});
 const {Gmail}=require('./gmail.cjs');gmail=new Gmail({store,safeStorage,win});handle('gmailConnect',()=>gmail.connect());handle('gmailStatus',()=>gmail.status());handle('gmailDisconnect',()=>gmail.disconnect());handle('verification',d=>gmail.find(d));
 handle('sync',async id=>{if(running)throw Error('Wait for the current operation to finish');return syncJob(jobFor(id));});
 handle('fixture',async()=>{const id=randomUUID(),url='fieldwork-fixture://local/application';save({id,url,title:'Dynamic form · local fixture',status:'queued',answers:[],createdAt:new Date().toISOString()});await open(id);return id;});
 win.webContents.on('preload-error',(_event,_file,error)=>startupLog('preload-failed',{error:error.message}));
 win.webContents.on('render-process-gone',(_event,details)=>startupLog('renderer-exited',{reason:details.reason}));
 await win.loadFile(path.join(__dirname,'../dist/index.html'));startupLog('interface-loaded');
 if(smoke){await require(accountEntrySmoke?'./account-entry-smoke.cjs':'./smoke.cjs').run({win,store,open,viewFor,snapshot,settings,createVisual,prepare,save,app,browsers});}
});
app.on('window-all-closed',()=>app.quit());let closingBrowsers=false;app.on('before-quit',event=>{if(browsers&&!closingBrowsers){event.preventDefault();closingBrowsers=true;void browsers.close().finally(()=>app.quit());}});app.on('before-quit',()=>{running?.abort.abort();gmail?.close();});
// The local fixture has its own scheme; live HTTPS traffic is not proxied.
app.on('ready',()=>{const ses=session.fromPartition('persist:fieldwork-applications');ses.protocol.handle('fieldwork-fixture',()=>new Response(fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8'),{headers:{'Content-Type':'text/html'}}));});

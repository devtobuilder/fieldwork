// Electron supplies Windows safeStorage. No accounts, navigation, or submission.
const {app,safeStorage}=require('electron'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),dir=path.join(os.homedir(),'Documents/FieldworkDesktop');
// safeStorage keys are scoped to this directory. Preserve the AppData fix.
app.setPath('userData',dir);
app.whenReady().then(async()=>{
 const start=performance.now(),report={kind:'bounded-live-Staples',finalSubmissionAllowed:false,maximumQuestions:1},abort=new AbortController();let browser,view,db;
 const watchdog=setTimeout(()=>{abort.abort();report.timeout=true;fs.writeFileSync(path.join(root,'.runtime/evidence-staples-report.json'),JSON.stringify(report,null,2));app.exit(2);},55000);
 try{
  db=new DatabaseSync(path.join(dir,'fieldwork-v2.db'),{readOnly:true});
  const get=(kind,id)=>{const r=db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind,id);return r?JSON.parse(r.payload):null;};
  const settings=get('settings','main'),profile={resume:require('yaml').parse(fs.readFileSync(settings.resumeSource,'utf8')),additional:settings.additional};
  const jobs=db.prepare('SELECT payload FROM records WHERE kind=?').all('job').map(r=>JSON.parse(r.payload)),job=jobs.find(j=>/staples|oraclecloud/i.test(j.url)&&j.status!=='submitted');if(!job)throw Error('No saved unsubmitted Staples draft');
  browser=new(require('../desktop/external-browser.cjs').ExternalBrowser)({directory:path.join(dir,'browser-profiles'),contextStore:{get:id=>get('form-context',id)},stateStore:{get:async id=>{const r=get('browser-state',id);return r?JSON.parse(safeStorage.decryptString(Buffer.from(r.encrypted,'base64'))):null;},set:async()=>{}}});
  view=await browser.open(job.id,job.currentUrl||job.url);
  await view.page.waitForLoadState('domcontentloaded',{timeout:8000});
  // One bounded readiness wait: DOMContentLoaded precedes Oracle's SPA form.
  await view.page.waitForSelector('input:not([type=hidden]),select,textarea,[role=combobox]',{state:'visible',timeout:12000}).catch(()=>{});
  const {collectEvidence,executeEvidence,assessEvidence}=require('../desktop/evidence-browser.cjs'),{decide,verify}=require('../desktop/evidence-domain.cjs'),{candidateProposals}=require('../desktop/evidence-candidate.cjs');
  const inventory=await collectEvidence(view);report.questionCount=inventory.length;report.controlCount=inventory.reduce((n,q)=>n+q.controls.length,0);report.linkedNetworkControls=inventory.flatMap(q=>q.controls).filter(c=>c.network).length;
  if(!inventory.length){report.stopped='No application question is currently exposed; smoke does not enter account or application flows';return;}
  const b=await assessEvidence(view,inventory[0],settings,abort.signal);report.visualAssessment=b.visual.assessment;report.question=b.label;report.controlTypes=b.controls.map(c=>c.type);
  const proposals=candidateProposals(b,profile),d=decide(b,proposals);report.decision=d.kind;
  fs.writeFileSync(path.join(root,'.runtime/evidence-staples-before.json'),JSON.stringify({bundle:b,proposals,decision:d},null,2));
  if(d.kind==='blocked'){report.stopped=d.reason;return;}
  report.retained=d.answers.every(a=>a.retain);
  if(!report.retained)await executeEvidence(view,b,d,settings,abort.signal,{deadlineMs:20000});
  await new Promise(r=>setTimeout(r,350));const after=(await collectEvidence(view)).find(q=>q.questionId===b.questionId);report.verified=!!after&&verify(after,d);
  fs.writeFileSync(path.join(root,'.runtime/evidence-staples-after.json'),JSON.stringify(after,null,2));
 }catch(e){report.error=e.message.slice(0,350);}finally{
  report.elapsedMs=performance.now()-start;if(view){report.actions=view.__fieldworkEvidenceTrace||[];await view.page.screenshot({path:path.join(root,'.runtime/evidence-staples.png'),scale:'css',timeout:3000}).catch(()=>{});}
  fs.writeFileSync(path.join(root,'.runtime/evidence-staples-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser?.close();db?.close();clearTimeout(watchdog);app.exit(report.error?1:0);
 }
});

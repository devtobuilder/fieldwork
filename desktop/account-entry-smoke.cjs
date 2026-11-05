const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run({win,store,open,viewFor,settings,save,app,browsers}){
 const start=performance.now(),report={packaged:app.isPackaged,version:app.getVersion(),syntheticAccount:true,clickedPrepareButton:false,legacyCalls:0,identityRequests:0,finalSubmissions:0};
 const output=process.env.FIELDWORK_ACCOUNT_REPORT||path.join(app.getPath('userData'),'account-entry-result.json');
 let server;const actions=require('./page-actions.cjs'),legacy=actions.apply;
 let identityReceivedAt;
 const persist=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));};
 const watchdog=setTimeout(()=>{report.ok=false;report.error='Account entry smoke timed out';persist();app.exit(1);},75000);
 try{
  // Trap the obsolete call even in a fixture browser. This reproduces the
  // released wiring failure instead of allowing the fixture bypass to hide it.
  actions.apply=async()=>{report.legacyCalls++;throw Error('The actual Prepare Draft entry invoked the retired fill route');};
  const resume=path.join(app.getPath('userData'),'synthetic-entry-resume.yaml');fs.writeFileSync(resume,'name: Synthetic Candidate\ncontact:\n  email: candidate@example.test\n');
  store.put('settings','main',{...settings(),resumeSource:resume,additional:'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'});
  server=http.createServer((req,res)=>{
   res.setHeader('Content-Type','text/html');
   if(req.url==='/identity')return res.end('<title>Account entry regression</title><h1>Enter email</h1><form method="post" action="/continue"><fieldset><legend>Account details</legend><label>Email Address<input type="email" name="email" required></label><label style="display:block;width:300px">I agree to the <a href="/privacy">privacy policy</a><input style="position:absolute;width:0;height:0;opacity:0" type="checkbox" name="privacy" required></label></fieldset><button>Continue</button></form>');
   if(req.url==='/privacy'){report.privacyLinkOpened=true;return res.end('Privacy policy');}
   if(req.url==='/continue'){identityReceivedAt=Date.now();let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{report.identityRequests++;const data=new URLSearchParams(body);report.correctSyntheticEmail=data.get('email')==='candidate@example.test';report.authorizedPrivacyChecked=data.get('privacy')==='on';res.writeHead(303,{Location:'/application'});res.end();});return;}
   if(req.url==='/application')return res.end('<title>Account entry regression</title><h1>Application</h1><label>Full name<input id="candidate-name" value="Synthetic Candidate" readonly required></label><button type="button" onclick="fetch(\'/submit-application\',{method:\'POST\'})">Submit application</button>');
   if(req.url==='/submit-application')report.finalSubmissions++;
   res.end('Test endpoint');
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const id='account-entry-button',url='http://127.0.0.1:'+server.address().port+'/identity';
  save({id,url,title:'Account entry regression',status:'queued',answers:[],createdAt:new Date().toISOString()});await open(id);
  // Select the actual job card and click the React button, not prepare() or a
  // replacement controller harness. The normal preload/IPC handler owns it.
  await wait(300);await win.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('.job')].find(e=>e.textContent.includes('Account entry regression'));if(!b)throw Error('Regression job card missing');b.click();})()");
  for(let n=0;n<50;n++){const clicked=await win.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('.workspace-actions button')].find(e=>e.textContent==='Prepare draft');if(!b||b.disabled)return false;b.click();return true;})()");if(clicked){report.clickedPrepareButton=true;break;}await wait(100);}
  assert.ok(report.clickedPrepareButton,'Actual Prepare draft button was not clicked');
  let result;for(let n=0;n<600;n++){result=store.get('job',id);if(!['queued','preparing'].includes(result.status))break;await wait(100);}
  report.status=result.status;report.message=result.message;report.preparedAnswers=result.answers?.length||0;
  report.reviewEvidenceVersion=result.review?.evidenceVersion;
  assert.equal(report.legacyCalls,0);assert.equal(report.identityRequests,1);assert.equal(report.correctSyntheticEmail,true);assert.equal(report.authorizedPrivacyChecked,true);assert.equal(report.finalSubmissions,0);assert.equal(result.status,'ready_for_review',result.message);assert.equal(result.submitReady,true);assert.equal(result.review.evidenceVersion,2);
  assert.equal(report.privacyLinkOpened,undefined);
  assert.ok(result.verificationRequestStartedAt>=result.preparationStartedAt&&result.verificationRequestStartedAt<=identityReceivedAt);
  report.verificationRequestTimestampRecorded=true;
  const ui=code=>win.webContents.executeJavaScript(code);
  await ui("document.querySelector('.workspace-actions .primary').click();void 0");
  for(let n=0;n<40&&!(await ui("!!document.querySelector('.approval-dialog')"));n++)await wait(100);
  report.portfolioEditing=await ui(`(()=>{
   const details=document.querySelector('.approval-summary'),[company,title,industry]=details.querySelectorAll('input');
   const setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   const change=(input,value)=>{setValue.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
   return (async()=>{
    if(!details.open){details.querySelector('summary').click();await new Promise(r=>setTimeout(r,50));}
    change(company,'');change(title,'Fixture engineer');change(industry,'Technology');
    await new Promise(r=>setTimeout(r,50));
    company.focus();change(company,'F');
    await new Promise(r=>setTimeout(r,50));
    const stayedOpen=details.open&&document.activeElement===company;
    const enterCanceled=!company.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    return {stayedOpen,enterCanceled};
   })();
  })()`);
  assert.deepEqual(report.portfolioEditing,{stayedOpen:true,enterCanceled:true});
  assert.equal(report.finalSubmissions,0);
  await ui("document.querySelector('.dialog-close').click();void 0");
  for(let n=0;n<40&&(await ui("!!document.querySelector('.approval-dialog')"));n++)await wait(100);
  assert.equal(await ui("!!document.querySelector('.approval-dialog')"),false);
  const {clipboard,ClipboardItem,nativeImage}=require('electron'),originalWrite=clipboard.write,originalRead=clipboard.read;
  const {readClipboardImage}=require('./copy-diagnostics.cjs');
  const realClipboard=process.env.FIELDWORK_TEST_REAL_CLIPBOARD==='1';
  const entries=realClipboard?await clipboard.read():[];
  const previous=await Promise.all(entries.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
  let copied=[];
  if(!realClipboard){clipboard.write=async items=>{copied=items;};clipboard.read=async()=>copied;}
  try{
   save({...result,status:'needs_input',message:'Synthetic copy regression \x1b[2m waiting for locator \x1b[22m',preparationStep:'Application review'});
   for(let n=0;n<40;n++){
    const clicked=await win.webContents.executeJavaScript("(()=>{const icon=document.querySelector('.workspace-meta .diagnostic-icon');if(!icon)return false;icon.click();return true;})()");
    if(clicked)break;
    await wait(100);
   }
   for(let n=0;n<20;n++){
    report.copyIconConfirmed=await win.webContents.executeJavaScript("document.querySelector('.workspace-meta .diagnostic-icon')?.getAttribute('aria-label')==='Copied diagnostic image'");
    if(report.copyIconConfirmed)break;
    await wait(50);
   }
   assert.equal(report.copyIconConfirmed,true);
   const image=nativeImage.createFromPath(path.join(app.getPath('userData'),'diagnostics','latest-report.png'));
   assert.ok(!image.isEmpty());assert.ok((await readClipboardImage()).toBitmap().equals(image.toBitmap()));
   report.nativeClipboardVerified=realClipboard;
  }finally{
   clipboard.write=originalWrite;clipboard.read=originalRead;
   if(realClipboard){
    const image=nativeImage.createFromPath(path.join(app.getPath('userData'),'diagnostics','latest-report.png'));
    if(!image.isEmpty()&&(await readClipboardImage()).toBitmap().equals(image.toBitmap())){
     if(previous.length)await clipboard.write(previous);else await clipboard.clear();
    }
   }
  }
  await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(path.dirname(output),'account-entry-ui.png'),img.toPNG()));
  report.ok=true;
 }catch(e){report.ok=false;report.error=e.message;}finally{
  actions.apply=legacy;report.elapsedMs=performance.now()-start;persist();clearTimeout(watchdog);await browsers?.close();await new Promise(r=>server?server.close(r):r());console.log(JSON.stringify(report));app.exit(report.ok?0:1);
 }
}
module.exports={run};

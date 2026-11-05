const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const {collectEvidence,executeEvidence,assessEvidence,discoverEvidence}=require('../desktop/evidence-browser.cjs'),{decide,verify}=require('../desktop/evidence-domain.cjs');
(async()=>{
 const start=performance.now(),root=path.resolve(__dirname,'../.runtime'),recording=JSON.parse(fs.readFileSync(path.join(root,'phone-structure.json'))),group=recording.ancestors.find(a=>a.role==='group'&&a.inputs.length===2);
 assert.ok(group);const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:1});
  // Real captured grouping/types/IDs; synthetic options and event implementation.
  // This cannot reproduce Oracle's original JavaScript.
  await page.setContent('<div role="group"><label for="'+group.inputs[0].id+'">Country code</label><input id="'+group.inputs[0].id+'" role="combobox" aria-controls="phone-options" aria-expanded="false"><div id="phone-options"><div id="us" role="option" aria-selected="false">+1 (United States)</div></div><label for="number">Phone Number</label><input id="number" type="tel"></div><ul><li>Structural list must not become an option</li></ul><button type="submit">Submit</button>');
  await page.evaluate(()=>{document.querySelector('[role=option]').onclick=e=>{e.target.setAttribute('aria-selected','true');e.target.parentElement.hidden=true;const c=document.querySelector('[role=combobox]');c.value=e.target.textContent;c.setAttribute('aria-expanded','false');};document.querySelector('[role=combobox]').onclick=e=>{e.target.setAttribute('aria-expanded','true');document.querySelector('[role=option]').parentElement.hidden=false;};});
  const view={external:true,page,frame:page.mainFrame(),networkContext:{settle:async()=>{},snapshot:()=>({fields:[]})}};
  const before=(await collectEvidence(view))[0];assert.equal(before.controls.length,2);assert.equal(before.controls[0].choices.length,1);
  const proposals=Object.fromEntries(before.controls.map(c=>[c.id,{kind:'answer',value:c.domain==='single'?c.choices[0].value:'5550101234',evidence:'Synthetic contract candidate'}]));
  const d=decide(before,proposals);assert.equal(d.kind,'answer');assert.equal(verify(before,d),false);
  const createAgent=async(_,options)=>({
   aiTap:async prompt=>{const l=prompt.startsWith('The visible option')?page.locator('[role=option]'):page.locator('[role=combobox]');const r=await l.boundingBox();await options.beforeInvokeAction('Tap',{locate:{center:[r.x+r.width/2,r.y+r.height/2]}});await l.click();},
   aiInput:async(_,opts)=>{const l=page.locator('[type=tel]'),r=await l.boundingBox();await options.beforeInvokeAction('Input',{value:opts.value,locate:{center:[r.x+r.width/2,r.y+r.height/2]}});await l.fill(opts.value);},destroy:async()=>{}});
  await executeEvidence(view,before,d,{visionModel:'unused'},undefined,{createAgent});
  const after=(await collectEvidence(view))[0];assert.equal(verify(after,d),true);assert.ok(decide(after,proposals).answers.every(a=>a.retain));
  await page.evaluate(()=>{window.optionClicks=0;window.enterKeys=0;document.querySelector('[role=option]').addEventListener('click',()=>window.optionClicks++);document.addEventListener('keydown',e=>{if(e.key==='Enter')window.enterKeys++;});});
  await page.locator('[role=combobox]').click();const openSelected=(await collectEvidence(view))[0];assert.equal(verify(openSelected,d),false,'An open dropdown cannot carry the previous selection into the next question');const openDecision=decide(openSelected,proposals);assert.equal(openDecision.answers[0].retain,false);await executeEvidence(view,openSelected,openDecision,{visionModel:'unused'});assert.ok(verify((await collectEvidence(view))[0],openDecision));assert.deepEqual(await page.evaluate(()=>[window.optionClicks,window.enterKeys]),[1,0]);
  await page.screenshot({path:path.join(root,'evidence-contract.png')});
  let recordedGrid=false;
  if(fs.existsSync(path.join(root,'release-popup.json'))){
   const actual=JSON.parse(fs.readFileSync(path.join(root,'release-popup.json')));
   await page.setContent(actual.parents[1]);
   let recorded=(await collectEvidence(view))[0],c=recorded.controls[0];
   assert.ok(c.choices.some(o=>o.label==='+1 (United States)'));assert.ok(c.committed.proven);
   await page.locator('[role=grid]').evaluate(e=>e.remove());
   recorded=(await collectEvidence(view))[0];assert.ok(recorded.controls[0].committed.proven,'Retained selected DOM evidence survives popup closure');
   await page.locator('[role=combobox]').dispatchEvent('input');
   recorded=(await collectEvidence(view))[0];assert.equal(recorded.controls[0].committed.proven,false,'Identical typed text invalidates selection evidence');
   recordedGrid=true;
  }
  view.__fieldworkEvidenceDomains=new Map();
  await page.setContent('<fieldset><legend>Choose an offered answer</legend><div role="radiogroup" aria-label="Choose an offered answer"><button type="button" role="radio" aria-checked="false">Yes</button><button type="button" role="radio" aria-checked="false">No</button></div></fieldset>');
  await page.evaluate(()=>{for(const b of document.querySelectorAll('[role=radio]'))b.onclick=()=>{for(const other of document.querySelectorAll('[role=radio]'))other.setAttribute('aria-checked',String(other===b));};});
  const radio=(await collectEvidence(view))[0];assert.equal(radio.controls.length,1);assert.equal(radio.controls[0].choices.length,2);
  const rd=decide(radio,{[radio.controls[0].id]:{kind:'answer',value:'No',evidence:'Explicit synthetic fact'}});
  await executeEvidence(view,radio,rd,{visionModel:'unused'});assert.ok(verify((await collectEvidence(view))[0],rd));
  await page.setContent('<style>ul{display:flex;gap:12px;list-style:none;padding:0;margin:8px 0}</style><div style="height:1300px"></div><label>Were you referred by a current Staples employee? *</label><div><ul role="radiogroup" aria-label="Were you referred by a current Staples employee?"><li><button type="button" role="radio" aria-checked="false">Yes</button></li><li><button type="button" role="radio" aria-checked="true">No</button></li></ul></div><div style="height:1000px"></div>');
  const referral=(await collectEvidence(view))[0];
  const rejectingModel=async()=>({aiBoolean:async()=>false,destroy:async()=>{}});
  const confirmed=await assessEvidence(view,referral,{visionModel:'fixture'},undefined,{createAgent:rejectingModel});
  assert.equal(confirmed.visual.assessment.source,'rendered-radio-group-hit-test');
  const referralDecision=decide(confirmed,{[confirmed.controls[0].id]:{kind:'answer',value:'No',evidence:'Explicit synthetic fact'}});
  assert.equal(referralDecision.answers[0].retain,true);
  await page.locator('label').evaluate(label=>label.style.visibility='hidden');
  await assert.rejects(assessEvidence(view,referral,{visionModel:'fixture'},undefined,{createAgent:rejectingModel}),/Visual evidence did not confirm/);
  const resume=path.join(root,'release-resume/Resume.pdf');let upload=false;
  if(fs.existsSync(resume)){
   await page.setContent('<label>Resume/CV<input type="file" required accept=".pdf"></label>');
   const file=(await collectEvidence(view))[0],fd=decide(file,{[file.controls[0].id]:{kind:'answer',value:'Resume.pdf',artifact:resume,evidence:'Compiled authoritative resume'}});
   await executeEvidence(view,file,fd,{visionModel:'unused'});assert.ok(verify((await collectEvidence(view))[0],fd));upload=true;
  }
  await page.setContent('<div style="height:1100px"></div><label>Motion contract name<input id="motion-name"></label><label>Unrelated field<input id="unrelated"></label><div style="height:1800px"></div>');
  await page.evaluate(()=>scrollTo(0,900));await page.waitForTimeout(50);
  await page.evaluate(()=>{window.motionCount=0;window.addEventListener('scroll',()=>window.motionCount++);});
  for(let n=0;n<4;n++)await collectEvidence(view);
  const motion=(await collectEvidence(view))[0];
  for(let n=0;n<2;n++)await assessEvidence(view,motion,{visionModel:'fake'},undefined,{createAgent:async()=>({aiBoolean:async()=>true,destroy:async()=>{}})});
  await assessEvidence(view,motion,{visionModel:'fake'},undefined,{createAgent:async()=>({aiBoolean:async()=>{await page.locator('#unrelated').evaluate(e=>{e.value='asynchronous update';});return true;},destroy:async()=>{}})});
  await assert.rejects(assessEvidence(view,motion,{visionModel:'fake'},undefined,{createAgent:async()=>({aiBoolean:async()=>{await page.locator('#motion-name').evaluate(e=>{e.style.marginLeft='20px';});return true;},destroy:async()=>{}})}),/Question moved during visual assessment/);
  const movement=await page.evaluate(()=>({scrollY,count:window.motionCount}));assert.equal(movement.scrollY,900);assert.equal(movement.count,0,'Readback and an already visible question must not scroll');
  await page.setContent('<label>ZIP Code<input id="postal" role="combobox" aria-controls="postal-options" aria-expanded="false"></label><div id="postal-options" role="grid" style="display:none"></div>');
  await page.evaluate(()=>{const e=document.getElementById('postal'),root=document.getElementById('postal-options'),initial=()=>root.innerHTML='<div role="gridcell" aria-selected="false">00000, Other Place, Other County, CA</div>';initial();e.onclick=()=>{root.style.display='block';initial();e.setAttribute('aria-expanded','true');};e.oninput=()=>{if(e.value==='94000')setTimeout(()=>{root.innerHTML='<div role="gridcell" aria-selected="false">94000, Fiction City, Test County, CA</div>';root.firstElementChild.onclick=()=>setTimeout(()=>{e.value='94000';e.setAttribute('aria-expanded','false');root.style.display='none';initial();},850);},20);};e.onkeydown=event=>{if(event.key==='Escape'){e.setAttribute('aria-expanded','false');root.style.display='none';initial();}};});
  const zip=(await collectEvidence(view))[0],zc=zip.controls[0];
  const refreshedZip=await assessEvidence(view,zip,{visionModel:'fake'},undefined,{createAgent:async()=>({aiBoolean:async()=>{await page.locator('#postal-options').evaluate(root=>{root.innerHTML='<div role="gridcell">11111, Updated Results, CA</div>';});return true;},destroy:async()=>{}})});
  assert.ok(refreshedZip.controls[0].choices.some(option=>option.label.startsWith('11111,')),'Assessment uses the refreshed option domain');
  await discoverEvidence(view,zip,undefined,{keepOpen:false,proposals:{[zc.id]:{kind:'answer',value:'94000',evidence:'Synthetic postal fact'}}});
  const discovered=(await collectEvidence(view))[0],offered=discovered.controls[0].choices.find(o=>o.label.startsWith('94000,'));assert.ok(offered);assert.equal(offered.visible,false);
  const zd=decide(discovered,{[zc.id]:{kind:'answer',value:offered.value,evidence:'Synthetic postal fact plus offered address option'}});
  await executeEvidence(view,discovered,zd,{visionModel:'unused'});
  assert.ok(verify((await collectEvidence(view))[0],zd),'Retained option schema must be freshly rendered and clicked before claiming selection');
  await page.setContent('<label>City *<input id="city" role="combobox" aria-controls="city-options" aria-expanded="false"></label><div id="city-options" role="grid" hidden><div role="gridcell">Fiction City, CA</div></div>');
  await page.evaluate(()=>{
   const city=document.getElementById('city'),popup=document.getElementById('city-options');
   city.onclick=()=>{popup.hidden=false;city.setAttribute('aria-expanded','true');};
   popup.firstElementChild.onclick=()=>{
    popup.hidden=true;city.setAttribute('aria-expanded','false');city.setAttribute('aria-invalid','true');
    setTimeout(()=>{city.value='Fiction City';city.setAttribute('aria-invalid','false');},750);
   };
  });
  const city=(await collectEvidence(view))[0],cityControl=city.controls[0];
  const cityDecision=decide(city,{[cityControl.id]:{kind:'answer',value:'Fiction City, CA',evidence:'Synthetic city and state'}});
  await executeEvidence(view,city,cityDecision,{visionModel:'unused'});
  assert.ok(verify((await collectEvidence(view))[0],cityDecision),'City must verify after asynchronous validation and shortened display');
  await page.setContent('<label>City *<input id="city" role="combobox" aria-controls="city-options" aria-expanded="true" value="Fiction City"></label><div id="city-options" role="grid"><div role="gridcell">Fiction City, CA</div></div>');
  await page.evaluate(()=>{
   const city=document.getElementById('city'),popup=document.getElementById('city-options');
   const open=value=>{popup.hidden=!value;city.setAttribute('aria-expanded',String(value));};
   popup.firstElementChild.onclick=()=>{
    window.cityClicks=(window.cityClicks||0)+1;
    open(false);
    setTimeout(()=>open(true),250);
    setTimeout(()=>{open(false);popup.replaceChildren();city.dispatchEvent(new Event('change'));},650);
   };
  });
  const cascadingCity=(await collectEvidence(view))[0],cascadingControl=cascadingCity.controls[0];
  const cascadingDecision=decide(cascadingCity,{[cascadingControl.id]:{kind:'answer',value:'Fiction City, CA',evidence:'Synthetic city and state'}});
  await executeEvidence(view,cascadingCity,cascadingDecision,{visionModel:'unused'});
  await new Promise(r=>setTimeout(r,350));
  assert.ok(verify((await collectEvidence(view))[0],cascadingDecision),'City click must survive a popup reopening and dependent change event');
  assert.equal(await page.evaluate(()=>window.cityClicks),1);
  await page.setContent('<h1>Application</h1><label>Full name<input id="name"></label><button type="button" data-fieldwork-nav="next">Next</button>');
  await page.evaluate(()=>{window.finalClicks=0;document.querySelector('button').onclick=()=>{document.body.innerHTML='<h1>Next step</h1><div role="progressbar">Loading</div>';setTimeout(()=>{document.body.innerHTML='<h1>Application</h1><label>Email<input id="email" type="email"></label><button type="button">Submit application</button>';document.querySelector('button').onclick=()=>window.finalClicks++;},400);};});
  view.observe=fn=>view.frame.evaluate(fn);
  const {navigateEvidence,navigationObservation}=require('../desktop/evidence-navigation.cjs');
  const {observe}=require('../desktop/page-observation.cjs');
  const beforeNext=await page.evaluate(observe);
  const transition=await navigateEvidence({view,action:beforeNext.navigation.find(a=>a.text==='Next'),page:beforeNext});assert.ok(transition.page.fields.some(f=>f.type==='email'));assert.equal(await page.evaluate(()=>window.finalClicks),0);
  const navBefore=await page.evaluate(navigationObservation),urlOnly=page.evaluate(navigationObservation,{waitForChange:true,before:navBefore,timeout:200}).then(()=>false,()=>true);await page.evaluate(()=>history.replaceState({},'',location.href+'#url-only'));assert.equal(await urlOnly,true);
  await page.setContent('<p><label>ZIP Code <input id="zip" value="01234"></label></p><p><label>Verification code <input id="otp" value="654321"></label></p>');
  const sharp=require('sharp'),{captureStep}=require('../desktop/copy-diagnostics.cjs');
  const original=await page.screenshot({scale:'css'}),captured=(await captureStep(view)).png;
  for(const [id,visible] of [['zip',true],['otp',false]]){
   const {x,y,width,height}=await page.locator('#'+id).boundingBox();
   const pixels=png=>sharp(png).extract({left:Math.ceil(x),top:Math.ceil(y),width:Math.floor(width)-1,height:Math.floor(height)-1}).raw().toBuffer();
   assert.equal((await pixels(original)).equals(await pixels(captured)),visible,id+' screenshot visibility');
  }
  await page.setContent('<form><section><h2>Work Experience</h2><button type="button" id="add">Add Work Experience</button><div id="entries"></div><div id="editor"></div></section><button type="submit">Submit application</button></form>');
  await page.evaluate(()=>{
   window.submits=0;
   document.querySelector('form').onsubmit=e=>{e.preventDefault();window.submits++;};
   document.querySelector('#add').onclick=()=>{
    const editor=document.querySelector('#editor');
    editor.innerHTML='<label>Employer<input id="employer" required></label><label>Job Title<input id="position" required></label><button type="button">Save</button>';
    editor.querySelector('button').onclick=()=>{
     document.querySelector('#entries').textContent=editor.querySelector('#employer').value+' · '+editor.querySelector('#position').value;
     editor.replaceChildren();
    };
   };
  });
  const {prepareExperience}=require('../desktop/evidence-experience.cjs');
  const experienceAgent=async(_,options)=>({
   aiInput:async(prompt,{value})=>{
    const input=page.getByLabel(JSON.parse(prompt.slice('The input labeled '.length)),{exact:true}),r=await input.boundingBox();
    await options.beforeInvokeAction('Input',{value,locate:{center:[r.x+r.width/2,r.y+r.height/2]}});
    await input.fill(value);
   },destroy:async()=>{}
  });
  const experienceProfile={resume:{experience:[{company:'Fixture Works',title:'Fixture Engineer',start:'2024-05'}]}};
  const experienceDeps={collect:()=>collectEvidence(view),execute:(b,d,s)=>executeEvidence(view,b,d,{visionModel:'fixture'},s,{createAgent:experienceAgent}),progress:()=>{}};
  assert.equal(await prepareExperience(view,experienceProfile,experienceDeps),undefined);
  assert.equal(await prepareExperience(view,experienceProfile,experienceDeps),undefined);
  assert.equal(await page.locator('#entries').innerText(),'Fixture Works · Fixture Engineer');
  assert.equal(await page.locator('#editor input').count(),0);
  assert.equal(await page.evaluate(()=>window.submits),0);
  await page.setContent('<button type="button" aria-label="Gender" aria-haspopup="listbox" aria-controls="gender-choices" aria-expanded="true">Choose</button><div role="listbox" id="gender-choices"><div role="option">I choose not to answer</div></div><label for="veteran">Veteran Status</label><div><input id="veteran" role="combobox" aria-controls="veteran-choices" aria-expanded="false" value="Not a Protected Veteran"><button type="button" aria-label="Remove value for the Veteran Status field.">×</button><div role="listbox" id="veteran-choices" hidden><div role="option" aria-selected="true">Not a Protected Veteran</div></div></div>');
  await page.evaluate(()=>document.querySelector('[aria-label^="Remove value"]').onclick=()=>{document.querySelector('#veteran').value='';document.querySelector('#veteran-choices [role=option]').setAttribute('aria-selected','false');});
  const {candidateProposals}=require('../desktop/evidence-candidate.cjs'),privacy={resume:{},additional:'I prefer to decline voluntary EEO questions wherever offered.'};
  const [gender,veteran]=(await collectEvidence(view));
  assert.equal(gender.controls[0].type,'combobox');
  assert.equal(decide(gender,candidateProposals(gender,privacy)).answers[0].displayValue,'I choose not to answer');
  const clearDecision=decide(veteran,candidateProposals(veteran,privacy));
  assert.equal(clearDecision.answers[0].retain,false);
  await executeEvidence(view,veteran,clearDecision,{visionModel:'fixture'});
  assert.ok(verify((await collectEvidence(view))[1],clearDecision));
  await page.setContent('<button id="apply">Apply</button><button id="sign-in">Sign In</button><div id="overlay" role="dialog" aria-modal="true" hidden><label>Email Address<input type="email"></label><label>Password<input type="password"></label><button>Sign In</button><button id="create">Create Account</button></div>');
  const listing=await page.evaluate(observe),background=listing.navigation.find(a=>a.text==='Sign In');
  await page.evaluate(id=>{
   document.querySelector('#overlay').hidden=false;
   document.querySelector('#sign-in').setAttribute('aria-hidden','true');
   document.querySelector('#create').setAttribute('data-fieldwork-nav',id);
   document.querySelector('#create').onclick=()=>{document.querySelector('#overlay').innerHTML='<h2>Create Account</h2><label>Email Address<input type="email"></label><label>New password<input type="password"></label><button>Register</button>';};
  },background.id);
  const modal=await page.evaluate(observe),create=modal.navigation.find(a=>a.text==='Create Account');
  assert.deepEqual(modal.navigation.map(a=>a.text),['Sign In','Create Account']);
  assert.notEqual(create.id,background.id);
  assert.equal(await page.locator('[data-fieldwork-nav='+JSON.stringify(create.id)+']').count(),1);
  assert.equal(await page.locator('#sign-in').getAttribute('data-fieldwork-nav'),null);
  assert.equal((await page.evaluate(observe)).navigation.find(a=>a.text==='Create Account').id,create.id);
  assert.ok((await navigateEvidence({view,action:create,page:modal})).page.fields.some(f=>f.label==='New password'));
  let signInRequests=0;
  await page.context().route('https://account.example.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/sign-in')return route.fulfill({contentType:'text/html',body:'<h1>Sign In</h1><button onclick="location.href=\'/redirect\'">Sign In</button>'});
   if(url.pathname==='/redirect'){signInRequests++;return route.fulfill({status:302,headers:{location:'/dashboard'}});}
   return route.fulfill({contentType:'text/html',body:'<h1>Welcome to Candidate Home</h1><h2>My Applications</h2>'});
  });
  await page.goto('https://account.example.test/sign-in');
  const signIn=await page.evaluate(observe);
  const landing=await navigateEvidence({view,action:signIn.navigation[0],page:signIn});
  assert.equal(require('../desktop/page-state.cjs').pageState(landing.page).kind,'account_home');
  assert.equal(signInRequests,1);
  await page.setContent('<h1>Fixture job</h1><button type="button">Apply</button>');
  await page.evaluate(()=>{
   window.applyClicks=0;
   document.addEventListener('click',e=>{
    if(e.target.textContent==='Apply'){window.applyClicks++;document.body.innerHTML='<h1>Application</h1><label>Email Address<input type="email"></label>';}
   });
  });
  const jobPage=await page.evaluate(observe),screenshot=page.screenshot.bind(page);
  view.page={screenshot:async options=>{
   const result=await screenshot(options);
   await page.locator('button').evaluate(e=>{const replacement=e.cloneNode(true);replacement.removeAttribute('data-fieldwork-nav');e.replaceWith(replacement);});
   return result;
  }};
  try{
   const opened=await navigateEvidence({view,action:jobPage.navigation[0],page:jobPage});
   assert.ok(opened.page.fields.some(f=>f.type==='email'));
   assert.equal(await page.evaluate(()=>window.applyClicks),1);
  }finally{view.page=page;}
  let duplicateRequests=0;
  await page.context().route('https://account.example.test/duplicate-apply',route=>{
   duplicateRequests++;
   return route.fulfill({contentType:'text/html',body:'<h1>Application</h1><label>Email Address<input type="email"></label>'});
  });
  await page.setContent('<h1>Job opening</h1><a href="/duplicate-apply">Apply</a><footer><a href="/duplicate-apply">Apply</a></footer>');
  const duplicateLinks=await page.evaluate(observe);
  assert.equal(duplicateLinks.navigation.length,2);
  assert.ok((await navigateEvidence({view,action:duplicateLinks.navigation[0],page:duplicateLinks})).page.fields.some(f=>f.type==='email'));
  assert.equal(duplicateRequests,1);
  await page.setContent('<button type="button">Continue</button><button type="button">Continue</button>');
  const ambiguousButtons=await page.evaluate(observe);
  await assert.rejects(navigateEvidence({view,action:ambiguousButtons.navigation[0],page:ambiguousButtons}),/without a shared link destination/);
  await page.setContent('<a href="/duplicate-apply" target="_blank">Apply</a><a href="/duplicate-apply" target="_blank">Apply</a>');
  const popupLinks=await page.evaluate(observe);
  view.setPage=target=>{view.page=target;view.frame=target.mainFrame();};
  try{
   assert.ok((await navigateEvidence({view,action:popupLinks.navigation[0],page:popupLinks})).page.fields.some(f=>f.type==='email'));
   assert.equal(duplicateRequests,2);
  }finally{if(view.page!==page)await view.page.close();view.setPage(page);delete view.setPage;}
  await page.setContent('<h1>Job opening</h1><button type="button" id="entry">Apply</button>');
  await page.evaluate(()=>{
   window.methodClicks=[];
   document.querySelector('#entry').onclick=()=>{
    document.body.insertAdjacentHTML('beforeend','<div role="dialog"><h2>Start Your Application</h2><button>Autofill with Resume</button><button>Apply Manually</button><button>Use My Last Application</button><button>Apply With LinkedIn</button></div>');
    for(const button of document.querySelectorAll('[role=dialog] button'))button.onclick=()=>{
     window.methodClicks.push(button.textContent);
     if(button.textContent==='Apply Manually')document.body.innerHTML='<h1>My Information</h1><label>First Name<input required></label><button type="button">Next</button>';
    };
   };
  });
  const {entryAction}=require('../desktop/navigation.cjs'),posting=await page.evaluate(observe);
  const chooser=await navigateEvidence({view,action:entryAction(posting).action,page:posting});
  assert.ok(chooser.page.applicationChooser);
  assert.equal(chooser.page.navigation.some(a=>a.text==='Apply'),false);
  const method=entryAction(chooser.page);
  assert.equal(method.action.text,'Apply Manually');
  const form=await navigateEvidence({view,action:method.action,page:chooser.page});
  assert.ok(form.page.fields.some(f=>f.label==='First Name'));
  assert.deepEqual(await page.evaluate(()=>window.methodClicks),['Apply Manually']);
  await page.setContent('<header><a>Candidate Home</a></header><h1>Fixture Engineer</h1><h2>My Information</h2><div class="skeleton">Loading</div><button type="button">Save and Continue</button>');
  const shell=await page.evaluate(observe);
  assert.notEqual(require('../desktop/page-state.cjs').pageState(shell).kind,'account_home');
  await page.evaluate(()=>setTimeout(()=>{
   document.querySelector('.skeleton').outerHTML='<label>First Name<input id="late-name" required></label>';
  },700));
  await require('../desktop/evidence-browser.cjs').waitForEvidenceReady(view);
  assert.equal((await page.evaluate(observe)).fields[0].label,'First Name');
  const report={kind:'recorded-structure-synthetic-events-executor-contract',elapsedMs:performance.now()-start,passed:true,actions:view.__fieldworkEvidenceTrace.length,recordedOwnedGrid:recordedGrid,buttonRadio:true,compiledResumeUpload:upload,filteredPostalSelection:true,eventDrivenNavigation:true,readbackScrollEvents:movement.count,limitations:['Captured phone grouping and Oracle owned grid; synthetic option-event implementation for executor tests.','SDK inference is faked only for boundary tests. DOM radio/upload/filter/navigation tests use public browser APIs. No original Oracle upload-event or model reliability claim.']};fs.writeFileSync(path.join(root,'evidence-contract-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

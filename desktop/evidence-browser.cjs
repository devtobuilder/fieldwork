const {hash,guardAction}=require('./evidence-domain.cjs');
// Semantic ownership only: options belong to a select, radio group, or explicit
// aria-controls/aria-owns relation. Structural lists are never option domains.
function snapshot(){
 const revisions=window.__fieldworkEvidenceRevisions ||= new WeakMap();
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>(e?.textContent||'').replace(/\s+/g,' ').trim();
 const label=e=>e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>text(document.getElementById(id))).join(' ').trim()||[...e.labels||[]].map(text).join(' ')||e.name||'';
 const path=e=>{const parts=[];for(let n=e;n&&n!==document.body;n=n.parentElement){parts.unshift(n.tagName.toLowerCase()+':nth-child('+([...n.parentElement.children].indexOf(n)+1)+')');if(n.id){parts[0]='#'+CSS.escape(n.id);break;}}return parts.join(' > ');};
 const popupTrigger='[aria-haspopup=listbox][aria-controls],[aria-haspopup=grid][aria-controls]';
 const all=[...document.querySelectorAll('input,textarea,select,[role=combobox],[role=checkbox],[role=radio],'+popupTrigger)].filter(e=>!e.closest('[inert],[aria-hidden=true],header,[role=search]')&&(!['hidden','submit','button','reset'].includes(e.type)||e.matches('[role=radio],[role=checkbox],[role=combobox],'+popupTrigger))&&(visible(e)||e.type==='file'&&(visible(e.parentElement)||!!e.closest('.file-upload, [role=group], .field, .field-wrapper, fieldset, form'))||['checkbox','radio'].includes(e.type)&&[...e.labels||[]].some(visible)));
 const controls=[],groups=new Map();
 for(const e of all){
  if(e.parentElement.closest('[role=combobox],'+popupTrigger))continue;
  if(!revisions.has(e)){const state={version:0,node:window.__fieldworkEvidenceNodeSequence=(window.__fieldworkEvidenceNodeSequence||0)+1};revisions.set(e,state);for(const event of ['input','change'])e.addEventListener(event,()=>state.version++);}
  const identity=path(e),id='ev-'+identity;e.setAttribute('data-fieldwork-evidence-control',id);
  const type=e.matches('input[list],input[aria-autocomplete=list],input[aria-autocomplete=both],'+popupTrigger)?'combobox':e.getAttribute('role')||e.type||e.tagName.toLowerCase(),domain=type==='file'?'file':e.tagName==='SELECT'&&e.multiple?'multi':e.tagName==='SELECT'||type==='combobox'||type==='radio'?'single':type==='checkbox'?'boolean':'text';
  const owner=e.closest('[role=radiogroup],fieldset,[role=group],.file-upload');
  const group=owner&&(owner.matches('fieldset,[role=radiogroup],.file-upload')||owner.querySelectorAll('input:not([type=hidden]),select,textarea,[role=combobox]').length<=4)?path(owner):type==='radio'&&e.name?'radio:'+e.name:identity;
  const radioKey=group+'::radio:'+(e.name||'');
  const radioLabel=label(e)||text(e),radioValue=e.value||radioLabel;
  if(type==='radio'&&groups.has(radioKey)){const c=groups.get(radioKey),oid=c.id+'::'+encodeURIComponent(radioValue);e.setAttribute('data-fieldwork-evidence-option',oid);c.choices.push({id:oid,label:radioLabel,value:radioValue,visible:visible(e),source:{kind:'dom',controlId:c.id}});if(e.checked||e.getAttribute('aria-checked')==='true'){c.committed={proven:true,value:[oid]};}continue;}
  let options=[];
  if(e.tagName==='SELECT')options=[...e.options].filter(o=>!o.disabled).map(o=>({node:o,label:o.label,value:o.value,selected:o.selected}));
  else if(type==='radio')options=[{node:e,label:radioLabel,value:radioValue,selected:e.checked||e.getAttribute('aria-checked')==='true'}];
  else if(type==='combobox'){
   const controlAttr=e.getAttribute('aria-controls')||e.getAttribute('aria-owns')||e.closest('[aria-controls],[aria-owns]')?.getAttribute('aria-controls')||e.closest('[aria-controls],[aria-owns]')?.getAttribute('aria-owns')||'';
   let roots=controlAttr.split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean);
   if(!roots.length&&(e.getAttribute('aria-expanded')==='true'||e===document.activeElement)){
    const localContainer=e.closest('fieldset,[role=group]')||e.parentElement?.parentElement?.parentElement;
    const localBoxes=localContainer?[...localContainer.querySelectorAll('[role=listbox]')].filter(visible):[];
    if(localBoxes.length)roots=localBoxes;
    else{
     const claimed=new Set([...document.querySelectorAll('[aria-controls],[aria-owns]')].flatMap(n=>(n.getAttribute('aria-controls')||n.getAttribute('aria-owns')||'').split(/\s+/)).filter(Boolean));
     roots=[...document.querySelectorAll('[role=listbox]')].filter(b=>visible(b)&&(!b.id||!claimed.has(b.id)));
    }
   }
   options=roots.flatMap(root=>[...root.querySelectorAll(root.getAttribute('role')==='grid'?'[role=gridcell]':'[role=option]')]).filter(o=>o.getAttribute('aria-disabled')!=='true'&&!/^no options$/i.test(text(o))).map(o=>({node:o,label:text(o),value:o.getAttribute('data-value')||text(o),selected:o.getAttribute('aria-selected')==='true'}));
  }
  const choices=options.map(o=>{const oid=id+'::'+encodeURIComponent(o.value);o.node.setAttribute('data-fieldwork-evidence-option',oid);return {id:oid,label:o.label,value:o.value,visible:visible(o.node),source:{kind:'dom',controlId:id}};});
  const selected=options.map((o,i)=>o.selected?choices[i].id:null).filter(Boolean),r=e.getBoundingClientRect();if(domain==='multi')selected.sort();
  const committed=['single','multi'].includes(domain)?{proven:domain==='multi'||selected.length===1,value:selected}:domain==='boolean'?{proven:true,value:e.checked??e.getAttribute('aria-checked')==='true'}:domain==='file'?{proven:true,value:[...e.files||[]].map(f=>f.name).join(', ')}:{proven:true,value:type==='password'?'':e.value||''};
  let comboboxDisplay='';if(type==='combobox'){comboboxDisplay=e.getAttribute('aria-valuetext')||'';if(!comboboxDisplay)for(let n=e.parentElement;n&&n!==document.body;n=n.parentElement){const found=n.querySelector('[class*="single-value"],[class*="singleValue"],[data-selected-value]');if(found){comboboxDisplay=text(found);break;}if(n.matches('.select,fieldset,[role=group],[role=radiogroup]'))break;}}
  const c={id,label:label(e),type,domain,dom:{identity,stable:e.id||e.name,name:e.name||'',tag:e.tagName.toLowerCase(),required:e.required||e.getAttribute('aria-required')==='true',disabled:!!e.disabled,readOnly:!!e.readOnly,maxLength:e.maxLength||0,min:e.min||'',max:e.max||'',pattern:e.pattern||'',controls:e.getAttribute('aria-controls')||e.getAttribute('aria-owns')||''},choices,committed,rawValue:type==='password'?'':(e.value||comboboxDisplay||''),invalid:e.getAttribute('aria-invalid')==='true'||!!(e.willValidate&&!e.validity.valid),rect:{x:r.x,y:r.y,width:r.width,height:r.height},group};
  controls.push(c);if(type==='radio')groups.set(radioKey,c);
  c.visibleLabel=[...e.labels||[]].filter(visible).map(text).join(' ')||radioLabel;
  const ownedPopupVisible=type==='combobox'&&c.dom.controls.split(/\s+/).some(id=>{const popup=document.getElementById(id);return popup&&visible(popup)&&popup.querySelector('[role=option],[role=gridcell]');});
  c.expanded=ownedPopupVisible?'true':e.getAttribute('aria-expanded');c.revision=revisions.get(e).node+':'+revisions.get(e).version;c.dom.accept=e.accept||'';
  if(type==='radio')c.label=owner?.getAttribute('aria-label')||text(owner?.querySelector('legend'))||c.label;
  if(!c.label&&c.dom.maxLength===1){const secOwner=e.closest('fieldset,[role=group],[id*=security],[class*=security],[class*=verification]')||owner;if(secOwner)c.label=text(secOwner.querySelector('label,legend,[class*=label]'))||secOwner.getAttribute('aria-label')||'Security code';}
  if(type==='file'){
   const uploadOwner=e.closest('.file-upload, [role=group], .field-wrapper, .field, fieldset');
   const ownerLabel=uploadOwner?(text(uploadOwner.querySelector('.upload-label, [id*="upload-label"], label:not(.visually-hidden), legend, [class*="label"]:not(.visually-hidden)'))||(uploadOwner.getAttribute('aria-labelledby')&&text(document.getElementById(uploadOwner.getAttribute('aria-labelledby'))))||uploadOwner.getAttribute('aria-label')):'';
   const idHint=/resume|cv/i.test((e.id||'')+' '+(e.name||''))?'Resume/CV':/cover[_\s-]?letter/i.test((e.id||'')+' '+(e.name||''))?'Cover Letter':'';
   const rawLabel=label(e);
   const generic=/^(?:attach|upload|browse|choose file|select file|file attachment)$/i.test(rawLabel.trim());
   c.label=(!generic&&rawLabel)||ownerLabel||idHint||rawLabel||e.getAttribute('title')||'File attachment';
   if(uploadOwner){
    uploadOwner.setAttribute('data-fieldwork-file-control-id',c.id);
    uploadOwner.setAttribute('data-fieldwork-file-identity',c.dom.identity);
    uploadOwner.setAttribute('data-fieldwork-file-label',c.label);
    if(uploadOwner.getAttribute('aria-required')==='true'||uploadOwner.querySelector('.required, [class*="required"], [aria-required=true]')||/\*/.test(c.label)||/\*/.test(ownerLabel)){
     c.dom.required=true;
    }
   }
   if(!c.committed.value){
    const container=uploadOwner||e.parentElement;
    if(container){
     const fileTextMatch=text(container).match(/\b([^\s/\\:]+\.(?:pdf|docx?|txt|rtf))\b/i);
     const removeBtn=container.querySelector('button[aria-label*="Remove" i],button[aria-label*="Delete" i],[class*="remove" i],[class*="delete" i]');
     const hasAttachBtn=!!container.querySelector('button[aria-label*="Attach" i],[class*="attach" i],button[aria-label*="Browse" i]');
     const attachedName=fileTextMatch?fileTextMatch[1]:(removeBtn&&!hasAttachBtn?'attached':'');
     if(attachedName){
      c.committed={proven:true,value:attachedName};
      c.rawValue=attachedName;
     }
    }
   }
  }
 }
  for(const card of document.querySelectorAll('[data-fieldwork-file-control-id],.file-upload,[role=group][aria-labelledby*="resume"],[role=group][aria-labelledby*="cover"],[role=group][aria-labelledby*="upload"]')){
   const cardPath=path(card);
   const savedControlId=card.getAttribute('data-fieldwork-file-control-id');
   const existing=controls.find(c=>(savedControlId&&c.id===savedControlId)||c.group===cardPath||(c.type==='file'&&(c.group===cardPath||card.contains(document.querySelector('[data-fieldwork-evidence-control="'+c.id+'"]')))));
   const fileTextMatch=text(card).match(/\b([^\s/\\:]+\.(?:pdf|docx?|txt|rtf))\b/i);
   const removeBtn=card.querySelector('button[aria-label*="Remove" i],button[aria-label*="Delete" i],[class*="remove" i],[class*="delete" i]');
   const hasAttachBtn=!!card.querySelector('button[aria-label*="Attach" i],[class*="attach" i],button[aria-label*="Browse" i]');
   const attachedName=fileTextMatch?fileTextMatch[1]:(removeBtn&&!hasAttachBtn?'attached':'');
   if(attachedName){
    if(existing){
     existing.committed={proven:true,value:attachedName};
     existing.rawValue=attachedName;
    }else{
     const ownerLabel=text(card.querySelector('.upload-label,[id*="upload-label"],label:not(.visually-hidden),legend,[class*="label"]:not(.visually-hidden)'))||(card.getAttribute('aria-labelledby')&&text(document.getElementById(card.getAttribute('aria-labelledby'))))||card.getAttribute('aria-label')||'';
     const idHint=/resume|cv/i.test(card.getAttribute('aria-labelledby')||card.id||ownerLabel)?'Resume/CV':/cover[_\s-]?letter/i.test(card.getAttribute('aria-labelledby')||card.id||ownerLabel)?'Cover Letter':'';
     const fileLabel=card.getAttribute('data-fieldwork-file-label')||ownerLabel||idHint||'File attachment';
     const stableFileId=card.getAttribute('data-fieldwork-file-identity')||card.getAttribute('aria-labelledby')||card.id||cardPath;
     const fileId=savedControlId||('ev-'+stableFileId+'::file');
     card.setAttribute('data-fieldwork-evidence-control',fileId);
     const r=card.getBoundingClientRect();
     controls.push({
      id:fileId,label:fileLabel,type:'file',domain:'file',
      dom:{identity:stableFileId,stable:stableFileId,name:idHint,tag:'input',required:card.getAttribute('aria-required')==='true'||/\*/.test(fileLabel),disabled:false,readOnly:false,maxLength:0,min:'',max:'',pattern:'',controls:''},
      choices:[],committed:{proven:true,value:attachedName},rawValue:attachedName,invalid:false,
      rect:{x:r.x,y:r.y,width:r.width,height:r.height},group:cardPath,visibleLabel:fileLabel,expanded:'false',revision:'file-committed:1'
     });
    }
   }
  }
  for(const entry of Object.values(window.__fieldworkUploadedFiles||{})){
   const existing=controls.find(c=>c.id===entry.id||(c.domain==='file'&&(c.group===entry.group||c.label===entry.label)));
   const pageHasFile=(document.body?.innerText||'').includes(entry.fileName);
   if(existing){
    if(!existing.committed?.value&&pageHasFile){
     existing.committed={proven:true,value:entry.fileName};
     existing.rawValue=entry.fileName;
    }
   }else if(pageHasFile){
    let host=null;try{if(entry.group)host=document.querySelector(entry.group);}catch{}
    if(host)host.setAttribute('data-fieldwork-evidence-control',entry.id);
    const r=host?host.getBoundingClientRect():{x:0,y:0,width:100,height:32};
    controls.push({
     id:entry.id,label:entry.label,type:'file',domain:'file',
     dom:{identity:entry.identity,stable:entry.stable||entry.identity,name:entry.name||'',tag:'input',required:!!entry.required,disabled:false,readOnly:false,maxLength:0,min:'',max:'',pattern:'',controls:''},
     choices:[],committed:{proven:true,value:entry.fileName},rawValue:entry.fileName,invalid:false,
     rect:{x:r.x,y:r.y,width:r.width,height:r.height},group:entry.group,visibleLabel:entry.label,expanded:'false',revision:'file-committed:1'
    });
   }
  }
  const questions=[];
 for(const c of controls){let q=questions.find(q=>q.questionId===c.group);if(!q){let groupLabel=c.label;try{const owner=c.group&&document.querySelector(c.group);if(owner)groupLabel=text(owner.querySelector('legend,.upload-label,[id*="upload-label"]'))||owner.getAttribute('aria-label')||c.label;}catch{}q={questionId:c.group,order:questions.length,label:groupLabel,controls:[]};questions.push(q);}q.controls.push(c);}
 return {url:location.href,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,dpr:devicePixelRatio},questions};
}
async function collectEvidence(view,{capture='auto'}={}){
 if(!view.external)throw Error('Evidence reset requires the supported external browser');
 await view.networkContext.settle();await view.frame.evaluate(()=>document.getElementById('__fieldwork_cursor')?.remove());
 let raw,stamp,reference,stable=false;
 for(let attempt=0;attempt<2;attempt++){
  await view.frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  raw=await view.frame.evaluate(snapshot);stamp=hash(raw);
  const mapKey=hash({url:raw.url,session:view.__fieldworkSessionId,questions:raw.questions.map(q=>q.controls.map(c=>[c.id,c.label,c.domain,c.dom]))});
  if(capture===true||capture==='viewport'||capture==='document'||capture!==false&&view.__fieldworkEvidenceMap?.key!==mapKey){
   reference='data:image/png;base64,'+(await view.page.screenshot({fullPage:capture==='document',scale:'css',animations:'disabled',timeout:5000})).toString('base64');
   view.__fieldworkEvidenceMap={key:mapKey,reference,viewport:raw.viewport,capturedAt:Date.now(),coordinateSpace:capture==='document'?'document-css':'viewport-css'};
  }else{reference=view.__fieldworkEvidenceMap?.reference||'dom-only-review';stable=true;break;}
  if(stamp===hash(await view.frame.evaluate(snapshot))){stable=true;break;}
 }
 if(!stable)throw Error('Layout changed during both bounded evidence captures');
 if(view.networkContext?.ingestHtml&&!view.networkContext.ingestedUrls?.has(raw.url.split('?')[0])){
  const inlineScripts=await view.frame.evaluate(()=>[...document.scripts].map(s=>s.textContent||'').filter(t=>t.length>30&&/fields|options|choices|values|oneOf|answer_options/.test(t)).map(t=>'<script>'+t+'</script>').join('\n')).catch(()=>'');
  if(inlineScripts)view.networkContext.ingestHtml(inlineScripts,raw.url);
 }
 const network=view.networkContext.snapshot(),origin=new URL(raw.url).origin,domains=view.__fieldworkEvidenceDomains ||= new Map();
 for(const q of raw.questions){
  q.observation={stamp,url:raw.url,viewport:raw.viewport,capturedAt:Date.now()};q.visual={reference,coordinateSpace:view.__fieldworkEvidenceMap?.coordinateSpace||'viewport-css',viewport:view.__fieldworkEvidenceMap?.viewport,mapCapturedAt:view.__fieldworkEvidenceMap?.capturedAt};
  for(const c of q.controls){
   const {controls:_ignoredControls,...stableDom}=c.dom;
   const key=raw.url+'|'+c.id,prior=domains.get(key),signature=hash(stableDom);
   if(c.domain==='single'&&c.type==='combobox'){
    if(c.choices.length){
     const observed=c.choices;
     if(prior?.signature===signature)c.choices=[...new Map([...prior.choices.map(o=>({...o,visible:false})),...observed].map(o=>[o.id,o])).values()].slice(-5000);
     if(!c.committed.proven&&prior?.signature===signature&&prior.committed.proven&&((c.rawValue&&prior.rawValue===c.rawValue)||(!c.rawValue&&prior.revision===c.revision)))c.committed={...prior.committed,source:'observed-selected-option'};
     domains.set(key,{signature,choices:c.choices.map(o=>({...o,visible:false})),committed:c.committed,rawValue:c.rawValue,revision:c.revision,capturedAt:Date.now()});
    }
    else if(prior?.signature===signature){
     c.choices=prior.choices;c.retainedDomain={capturedAt:prior.capturedAt,url:raw.url,controlId:c.id};
     if(prior.committed.proven&&((c.rawValue&&prior.rawValue===c.rawValue)||(!c.rawValue&&prior.revision===c.revision)))c.committed={...prior.committed,source:'observed-selected-option'};
    }
   }
   const matchedField=view.networkContext?.matchControl?view.networkContext.matchControl(c,origin):(()=>{const m=network.fields.filter(f=>f.frameOrigin===origin&&[c.dom.stable,c.dom.name].filter(Boolean).includes(f.fieldId));return m.length===1?m[0]:null;})();
   if(matchedField){const f=matchedField;c.network={fieldId:f.fieldId,sourceUrl:f.sourceUrl,capturedAt:f.capturedAt,options:f.options};
    if(!c.choices.length)c.choices=f.options.map(o=>({id:c.id+'::'+encodeURIComponent(o.value),value:o.value,label:o.label,source:{kind:'network',controlId:c.id,fieldId:f.fieldId,sourceUrl:f.sourceUrl,capturedAt:f.capturedAt}}));
   }
  }
 }
 return raw.questions;
}
async function executeEvidence(view,b,d,settings,signal,{deadlineMs=20000,createAgent}={}){
 let active=true,timer,agent;const deadline=Date.now()+deadlineMs;
 const trace=view.__fieldworkEvidenceTrace ||= [];
 try{
  for(const a of d.answers){
   if(a.retain)continue;signal?.throwIfAborted();
   const control=b.controls.find(c=>c.id===a.controlId),selector='[data-fieldwork-evidence-control='+JSON.stringify(control.id)+']',locator=view.frame.locator(selector);
   if(control.dom.disabled||control.dom.readOnly&&control.domain==='text')throw Error('Control is disabled or read only');
   const before=await view.frame.evaluate(snapshot),liveControl=before.questions.flatMap(q=>q.controls).find(c=>c.id===control.id);
   if(!liveControl||hash(liveControl.dom)!==hash(control.dom)||liveControl.label!==control.label||liveControl.domain!==control.domain)throw Error('Control constraints changed since answer selection');
   trace.push({questionId:b.questionId,controlId:control.id,action:'prepare-control',label:control.label,at:Date.now()});
   if(a.empty&&control.type==='combobox'&&!control.dom.required){
    const clear=await locator.evaluate((e,{id,label})=>{
     const name=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
     for(let root=e.parentElement,i=0;root&&i<3;root=root.parentElement,i++){
      if([...root.querySelectorAll('input:not([type=hidden]),select,textarea')].some(input=>input!==e))break;
      const buttons=[...root.querySelectorAll('button,[role=button]')].filter(button=>{
       const text=name(button.getAttribute('aria-label')||button.title||button.innerText||'');
       return button.checkVisibility({visibilityProperty:true})&&(button.type!=='submit'||!button.form)&&(/^(?:clear|remove) (?:value|selection)$/.test(text)||text==='remove value for the '+name(label)+' field'||text==='clear '+name(label));
      });
      if(buttons.length!==1)continue;
      buttons[0].setAttribute('data-fieldwork-clear-choice',id);return true;
     }
     return false;
    },{id:control.id,label:control.label});
    if(!clear)throw Error('Use the field’s clear control to leave this voluntary disclosure blank');
    signal?.throwIfAborted();
    await view.frame.locator('[data-fieldwork-clear-choice='+JSON.stringify(control.id)+']').click({timeout:3000});
    trace.push({questionId:b.questionId,controlId:control.id,action:'clear-voluntary-choice',label:control.label,at:Date.now()});
    continue;
   }
   if(!createAgent&&control.domain==='boolean'&&await locator.evaluate(e=>e.matches('input[type=checkbox]'))){
    const direct=await locator.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).pointerEvents!=='none'&&(r.bottom<=0||r.top>=innerHeight||document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e);});
    if(direct){
     signal?.throwIfAborted();await locator.setChecked(a.value,{timeout:3000});
    }else{
     const labelSelector='[data-fieldwork-check-target='+JSON.stringify(control.id)+']';
     const associated=await locator.evaluate((e,id)=>{const label=[...e.labels].find(l=>l.getClientRects().length);if(!label)return false;label.setAttribute('data-fieldwork-check-target',id);return true;},control.id);
     if(!associated)throw Error('No visible label is associated with '+control.label);
     const label=view.frame.locator(labelSelector);
     await label.scrollIntoViewIfNeeded({timeout:3000});
     const position=await label.evaluate(e=>{
      const r=e.getBoundingClientRect();
      for(const fraction of [.05,.15,.3,.5,.8]){
       const x=r.width*fraction,y=r.height/2,hit=document.elementFromPoint(r.left+x,r.top+y);
       if(hit?.closest('label')===e&&!hit.closest('a,button,[role=link],[role=button]'))return {x,y};
      }
      return null;
     });
     if(!position)throw Error('The checkbox label has no unobstructed non-link target');
     signal?.throwIfAborted();await label.click({position,timeout:3000});
     if(await locator.isChecked()!==a.value)throw Error('The checkbox did not commit '+control.label);
    }
    trace.push({questionId:b.questionId,controlId:control.id,action:'set-checkbox',label:control.label,at:Date.now()});continue;
   }
   if(control.domain==='file'){
    await locator.evaluate(e=>{const t=e.closest('.file-upload,[role=group],fieldset')||e.parentElement||e;t?.scrollIntoView?.({block:'center',behavior:'instant'});}).catch(()=>null);
   }else{
    await locator.scrollIntoViewIfNeeded({timeout:3000}).catch(()=>null);
   }
   if(!createAgent&&['single','multi','file'].includes(control.domain)){
    // Exact semantic targets use public Playwright controls. Visual assessment
    // establishes the question context; a fresh screenshot records each action.
    if(Date.now()>=deadline)throw Error('Question executor deadline exceeded');
    if(control.domain==='file'){
     if(!a.value&&!a.artifact){
      trace.push({questionId:b.questionId,controlId:control.id,action:'skip-optional-file',label:control.label,at:Date.now()});
      continue;
     }
     if(a.value&&!a.artifact){
      // Manually type text for file control if an Enter manually button or textarea is available
      const manuallyBtn=locator.locator('xpath=ancestor::*[contains(@class,"file-upload") or @role="group"][1]//button[contains(translate(.,"ENTER MANUALLY","enter manually"),"enter manually")]');
      if(await manuallyBtn.count()){
       await manuallyBtn.first().click({timeout:3000}).catch(()=>null);
       await new Promise(r=>setTimeout(r,300));
      }
      const textarea=locator.locator('xpath=ancestor::*[contains(@class,"file-upload") or @role="group"][1]//textarea');
      if(await textarea.count()){
       await textarea.first().fill(String(a.value),{timeout:3000});
       trace.push({questionId:b.questionId,controlId:control.id,action:'type-cover-letter',label:control.label,at:Date.now()});
       continue;
      }
      trace.push({questionId:b.questionId,controlId:control.id,action:'skip-optional-file',label:control.label,at:Date.now()});
      continue;
     }
     if(!a.artifact)throw Error('No compiled resume artifact was authorized');
     const fn=require('node:path').basename(a.artifact);
     await view.frame.evaluate(entry=>{
      window.__fieldworkUploadedFiles ||= {};
      window.__fieldworkUploadedFiles[entry.id]=entry;
     },{id:control.id,identity:control.dom.identity,stable:control.dom.stable,name:control.dom.name,label:control.label,group:control.group,required:control.dom.required,fileName:fn}).catch(()=>null);
     await locator.setInputFiles(a.artifact,{timeout:10000});
     const waitDeadline=Date.now()+5000;
     while(Date.now()<waitDeadline){
      signal?.throwIfAborted();
      const state=await view.frame.evaluate(({id,group,name})=>{
       const e=document.querySelector('[data-fieldwork-evidence-control='+JSON.stringify(id)+']');
       let container=e?.closest('.file-upload,[role=group],fieldset,.field-wrapper,.field')||e?.parentElement;
       if(!container&&group){try{container=document.querySelector(group);}catch{}}
       if(!container)return {busy:false,attached:true};
       const isElVisible=el=>el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
       const busy=[...container.querySelectorAll('[aria-busy="true"],.uploading,.spinner')].some(isElVisible);
       const files=[...(e?.files||[])].map(f=>f.name);
       const txt=container.innerText||container.textContent||'';
       const hasRemove=!!container.querySelector('button[aria-label*="Remove" i],button[aria-label*="Delete" i],[class*="remove" i],[class*="delete" i]');
       return {busy,attached:files.some(f=>f.includes(name))||txt.includes(name)||(hasRemove&&!busy)};
      },{id:control.id,group:control.group,name:fn}).catch(()=>null);
      if(state&&!state.busy&&state.attached)break;
      await new Promise(r=>setTimeout(r,120));
     }
     trace.push({questionId:b.questionId,controlId:control.id,action:'setInputFiles',at:Date.now()});continue;
    }
    if(control.dom.tag==='select'){
     await locator.selectOption(a.optionIds.map(id=>control.choices.find(o=>o.id===id).value),{timeout:3000});
     trace.push({questionId:b.questionId,controlId:control.id,action:'selectOption',optionId:a.value,at:Date.now()});continue;
    }
    if(control.type==='combobox'&&await locator.getAttribute('aria-expanded')!=='true'){await locator.click({timeout:3000});await new Promise(r=>setTimeout(r,250));}
    const opened=(await collectEvidence(view)).find(q=>q.questionId===b.questionId),fresh=opened?.controls.find(c=>c.id===control.id),desired=control.choices.find(o=>o.id===a.value);
    let matches=fresh?.choices.filter(o=>o.id===a.value&&o.label===desired?.label)||[];
    if(matches.length!==1&&desired&&fresh?.choices?.length){
     const visibleChoices=fresh.choices.filter(o=>o.visible);
     const pool=visibleChoices.length?visibleChoices:fresh.choices;
     const byLabel=pool.filter(o=>o.label.trim().toLowerCase()===desired.label.trim().toLowerCase());
     if(byLabel.length===1)matches=byLabel;
     else{
      const {findBestChoice}=require('./resemblance.cjs');
      const best=findBestChoice(pool,desired.label||desired.value,control,{bundle:b});
      if(best)matches=[best];
     }
    }
    if(matches.length!==1)throw Error('The intended option is not uniquely visible in this question');
    let option=view.frame.locator('[data-fieldwork-evidence-option='+JSON.stringify(matches[0].id)+']');
    if(await option.count()!==1&&control.type==='combobox'){
     await discoverEvidence(view,{...b,controls:[control]},signal,{keepOpen:true,proposals:{[control.id]:{kind:'answer',value:desired.value,evidence:a.evidence}}});
     if(await locator.getAttribute('aria-expanded')!=='true')await locator.click({timeout:3000});
     await collectEvidence(view);option=view.frame.locator('[data-fieldwork-evidence-option='+JSON.stringify(matches[0].id)+']');
    }
    await option.scrollIntoViewIfNeeded({timeout:3000});
    const screenshot=await view.page.screenshot({scale:'css',timeout:3000});signal?.throwIfAborted();
    if(Date.now()>=deadline)throw Error('Question executor deadline exceeded');
    const actualOptionText=(await option.innerText()).replace(/\s+/g,' ').trim();
    if(actualOptionText!==desired.label&&actualOptionText!==matches[0].label)throw Error('The offered option changed before selection');
    await option.click({timeout:3000});
    trace.push({questionId:b.questionId,controlId:control.id,action:'click-option',label:control.label,optionId:matches[0].id,at:Date.now(),screenshotHash:require('node:crypto').createHash('sha256').update(screenshot).digest('hex')});
    const expectedDisplay=[desired.label,desired.value,matches[0].label,matches[0].value];if(/^(?:zip|postal)(?: code)?\s*\*?$/i.test(control.label))expectedDisplay.push(desired.label.split(',')[0].trim());
    if(/\bcountry(?: code)?\b/i.test(control.label)||desired.label.includes('+')){
     const prefix=desired.label.match(/\+\s*(\d+)/);
     if(prefix)expectedDisplay.push('+'+prefix[1],prefix[1]);
     expectedDisplay.push(desired.label.replace(/\s*\+\s*\d+.*$/,'').replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').trim());
    }
    if(/^(?:city|location|location city|location \(city\)|current location|current city|county|state|province)\s*\*?$/i.test(control.label)||/location|city|address|residence/i.test(control.label))expectedDisplay.push(desired.label.split(',')[0].trim());
    const waitUntil=Math.min(deadline,Date.now()+3000);
    let afterRaw,actual,committed=false,dismissed=false,stableSince=0,lastReadback;
    do{
     await new Promise(r=>setTimeout(r,150));signal?.throwIfAborted();
     afterRaw=await view.frame.evaluate(snapshot);
     actual=afterRaw.questions.flatMap(q=>q.controls).find(c=>c.id===control.id);
     const selected=actual?.committed.proven&&(actual.committed.value?.includes(matches[0].id)||actual.committed.value?.includes(a.value));
     const normVal=s=>String(s||'').replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/\s+/g,' ').trim();
     const displayMatches=control.type==='combobox'&&!actual?.committed.proven&&expectedDisplay.some(exp=>{const a=normVal(actual?.rawValue),b=normVal(exp);return a===b||actual?.rawValue===exp||(a&&b&&(a.includes(b)||b.includes(a)));});
     const valid=!!actual&&!actual.invalid&&actual.expanded!=='true'&&(selected||displayMatches);
     const readback=valid?hash([actual.dom,actual.revision,actual.rawValue]):null;
     if(readback!==lastReadback){lastReadback=readback;stableSince=Date.now();}
     // An address lookup can briefly close and reopen the popup while dependent
     // fields update. Only persist the option once the closed readback settles.
     committed=valid&&(control.type!=='combobox'||Date.now()-stableSince>=450);
     if(committed)break;
     if(!dismissed&&actual?.expanded==='true'&&selected&&!actual.invalid&&Date.now()+1600>=waitUntil){
      // The site confirmed this exact option. Blur the control if its popup lingers.
      await locator.blur({timeout:500});dismissed=true;
     }
    }while(Date.now()<waitUntil);
    if(!committed){
     const reason=!actual?'the control disappeared':actual.expanded==='true'?'the option menu stayed open':actual.invalid?'the website still marks the value invalid':lastReadback?'the selection was still changing':'the selected value could not be verified';
     trace.push({questionId:b.questionId,controlId:control.id,action:'option-unverified',label:control.label,reason,at:Date.now()});
     throw Error(control.label+': '+reason+' after clicking the option');
    }
    if(control.type==='combobox'){
     const {controls:_ignoredControls,...stableActualDom}=actual.dom;
     view.__fieldworkEvidenceDomains.set(afterRaw.url+'|'+control.id,{signature:hash(stableActualDom),choices:fresh.choices.map(o=>({...o,visible:false})),committed:{proven:true,value:[a.value],source:'observed-option-click'},rawValue:actual.rawValue,revision:actual.revision,capturedAt:Date.now()});
     trace.push({questionId:b.questionId,controlId:control.id,action:'option-committed',label:control.label,at:Date.now()});
    }
    continue;
   }
   let observed=await view.frame.evaluate(snapshot),stamp=hash(observed),allowedTarget={controlId:control.id,optionId:null};
   let invocationActive=true;
   const options={generateReport:false,persistExecutionDump:false,autoPrintReportMsg:false,replanningCycleLimit:1,waitAfterAction:350,screenshotShrinkFactor:observed.viewport.dpr,
    modelConfig:{MIDSCENE_MODEL_NAME:createAgent?settings.visionModel:await require('./local-visual-model.cjs').prepareVisualModel(settings.visionModel),MIDSCENE_MODEL_BASE_URL:'http://127.0.0.1:11434/v1',MIDSCENE_MODEL_API_KEY:'local',MIDSCENE_MODEL_FAMILY:'qwen3-vl',MIDSCENE_MODEL_TIMEOUT:10000,MIDSCENE_MODEL_RETRY_COUNT:0},
    beforeInvokeAction:async(name,param)=>{
     signal?.throwIfAborted();const current=await view.frame.evaluate(snapshot);
     guardAction({active:active&&invocationActive,deadline,stamp,questionId:b.questionId,controlId:control.id,kind:name==='Tap'?'select':name==='Input'?'input':'forbidden'},{...b,observation:{stamp:hash(current)}});
     if(name==='Input'&&(control.domain!=='text'||String(param.value)!==String(a.value)))throw Error('Input differs from authorized text');
     const point=param.locate?.center;if(!point)throw Error('No visible action target');
     if(view.frame!==view.page.mainFrame())throw Error('Frame coordinate conversion is not validated');
     const hit=await view.frame.evaluate(({point,target})=>{const e=document.elementFromPoint(...point);if(!e||e.closest('[type=submit],button,a,[role=button]'))return false;const labelControl=e.closest('label')?.control;return target.optionId?(e.closest('[data-fieldwork-evidence-option]')||labelControl)?.getAttribute('data-fieldwork-evidence-option')===target.optionId:(e.closest('[data-fieldwork-evidence-control]')||labelControl)?.getAttribute('data-fieldwork-evidence-control')===target.controlId;},{point,target:allowedTarget});
     if(!hit)throw Error('Action target is outside the authorized control or option');
     trace.push({questionId:b.questionId,controlId:control.id,action:name,optionId:allowedTarget.optionId,at:Date.now(),coordinateSpace:'viewport-css',stamp});
    }};
   agent=createAgent?await createAgent(view.page,options):new(require('@midscene/web/playwright/agent').PlaywrightAgent)(view.page,options);
   const action=async()=>{
    if(control.domain==='text')await agent.aiInput('The input labeled '+JSON.stringify(control.label),{value:String(a.value),mode:'replace'});
    else if(control.domain==='boolean'){
     if(control.committed.value!==a.value)await agent.aiTap('The checkbox labeled '+JSON.stringify(control.label));
    }else{
     if(control.dom.tag==='select'){
      // Public Playwright API preserves the site's select/change event semantics.
      guardAction({active,deadline,stamp,questionId:b.questionId,controlId:control.id,kind:'select'},{...b,observation:{stamp:hash(await view.frame.evaluate(snapshot))}});
      await locator.selectOption(a.optionIds.map(id=>control.choices.find(o=>o.id===id).value));
      trace.push({questionId:b.questionId,controlId:control.id,action:'selectOption',optionId:a.value,at:Date.now()});
     }else{
      if(control.type!=='radio')await agent.aiTap('The dropdown input labeled '+JSON.stringify(control.label));
      observed=await view.frame.evaluate(snapshot);stamp=hash(observed);
      const fresh=observed.questions.flatMap(q=>q.controls).find(c=>c.id===control.id),desired=control.choices.find(o=>o.id===a.value);
      const matches=fresh?.choices.filter(o=>o.visible&&o.label===desired?.label)||[];
      if(matches.length!==1)throw Error('The intended option is not uniquely visible in the owned popup');
      allowedTarget.optionId=matches[0].id;
      await agent.aiTap('The visible '+(control.type==='radio'?'radio option':'option in the open dropdown')+' with exact label '+JSON.stringify(matches[0].label)+' for '+JSON.stringify(control.label));
     }
    }
   };
   await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;reject(Error('Question executor deadline exceeded'));},Math.max(1,deadline-Date.now()));})]);
   invocationActive=false;clearTimeout(timer);await agent.destroy();agent=null;
  }
 }finally{active=false;clearTimeout(timer);await agent?.destroy();}
}
async function discoverEvidence(view,b,signal,{proposals={},keepOpen=true}={}){
 // Opening the current question is discovery, never an answer. Do not search,
 // type, press Enter or click an option while constructing its domain.
 for(const c of b.controls.filter(c=>c.domain==='single')){
  signal?.throwIfAborted();if(c.type!=='combobox')throw Error('No option domain is exposed for this finite control');
  const l=view.frame.locator('[data-fieldwork-evidence-control='+JSON.stringify(c.id)+']');
  await l.scrollIntoViewIfNeeded();const raw=await view.frame.evaluate(snapshot),current=raw.questions.flatMap(q=>q.controls).find(x=>x.id===c.id);
  if(!current||current.dom.disabled||hash(current.dom)!==hash(c.dom))throw Error('Question changed before option discovery');
  const screenshot=await view.page.screenshot({scale:'css',timeout:3000});
  if(hash(raw)!==hash(await view.frame.evaluate(snapshot)))throw Error('Question moved during discovery capture');
  signal?.throwIfAborted();if(await l.getAttribute('aria-expanded')!=='true')await l.click({timeout:3000});await new Promise(r=>setTimeout(r,350));
  let opened=(await collectEvidence(view)).find(q=>q.questionId===b.questionId)?.controls.find(x=>x.id===c.id);
  const proposal=proposals[c.id],offered=opened?.choices.filter(o=>o.visible)||[];
  const voluntary=proposal?.value==='decline'&&proposal.evidence==='Explicit preference to decline voluntary EEO disclosure';
  const matchOption=(o,v)=>{
   if(!v)return false;
   if([o.value,o.label].includes(v))return true;
   if(typeof v==='string'&&/^(?:us|usa|united states(?: of america)?)$/i.test(v)){
    const clean=o.label.replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/[’']/g,'').replace(/[^a-z0-9+]+/gi,' ').trim();
    return /^(?:\+?1\s+)?(?:united states(?: of america)?|usa|us)(?:\s+\+?1)?$/i.test(clean);
   }
   return false;
  };
  const {findBestChoice}=require('./resemblance.cjs');
  const bestOffered=findBestChoice(offered,proposal?.value,c,{bundle:b,proposal});
  const matches=!!bestOffered||offered.some(o=>matchOption(o,proposal?.value));
  const isTypeaheadField=/^(?:city|location|location city|location \(city\)|current location|current city|zip|postal|postal code|zip code|school|university|college|institution|county)\b/i.test(c.label)||/location|city|postal|zip|school|university|college/i.test(c.label);
  const shouldTypeSearch=(!offered.length||isTypeaheadField)&&!matches&&!voluntary&&!proposal?.discoverGeneric&&!proposal?.discoverOnly&&proposal?.kind==='answer'&&(!proposal.assumption||proposal.draftAuthorized===true)&&typeof proposal.value==='string'&&proposal.value.trim().length>0;
  if(shouldTypeSearch){
   // Filtering is only used when opening the dropdown exposed no options (async typeahead)
   // or for a location/postal/school search field. Never blindly type into a finite dropdown
   // that already exposed its options on open.
   const query=/^(?:zip|postal)(?: code)?\s*\*?$/i.test(c.label)?proposal.value.split(',')[0].trim():proposal.value;
   if(/[\r\n]/.test(query))throw Error('Dropdown search requires a single line');
   await l.fill('',{timeout:3000});await l.pressSequentially(query,{delay:25,timeout:3000});
   const foundAfterType=await view.frame.waitForFunction(({id,query})=>{const e=document.querySelector('[data-fieldwork-evidence-control='+JSON.stringify(id)+']'),root=document.getElementById(e?.getAttribute('aria-controls'));return [...root?.querySelectorAll('[role=option],[role=gridcell]')||[]].some(o=>!/^no options$/i.test(o.textContent.trim())&&o.textContent.toLowerCase().includes(query.toLowerCase()));},{id:c.id,query},{timeout:3500}).then(()=>true).catch(()=>false);
   if(!foundAfterType){
    // Restore the unfiltered option list rather than leaving "No options" in the combobox
    await l.fill('',{timeout:3000}).catch(()=>null);
    if(await l.getAttribute('aria-expanded')!=='true')await l.click({timeout:3000}).catch(()=>null);
    await new Promise(r=>setTimeout(r,300));
    const restored=(await collectEvidence(view)).find(q=>q.questionId===b.questionId)?.controls.find(x=>x.id===c.id);
    if(!restored?.choices?.length)throw Error('The website did not expose a matching option after candidate filtering');
   }else{
    await collectEvidence(view);
    (view.__fieldworkEvidenceTrace ||= []).push({questionId:b.questionId,controlId:c.id,action:'filter-for-evidence',at:Date.now(),candidateEvidence:proposals[c.id].evidence});
   }
  }
  if(!keepOpen||voluntary&&!c.dom.required&&offered.length&&!require('./evidence-candidate.cjs').declineOptions(offered).length)await l.press('Escape',{timeout:3000});
  (view.__fieldworkEvidenceTrace ||= []).push({questionId:b.questionId,controlId:c.id,action:'open-for-evidence',at:Date.now(),screenshotHash:require('node:crypto').createHash('sha256').update(screenshot).digest('hex')});
 }
}
async function assessEvidence(view,b,settings,signal,{deadlineMs=12000,createAgent}={}){
 if(!settings.visionModel)throw Error('A local visual model is required for question assessment');
 if(view.frame!==view.page.mainFrame())throw Error('Visual frame coordinates have not been validated');
 let agent,timer;const started=performance.now();
 try{
  signal?.throwIfAborted();const anchor=b.controls.length>1?view.frame.locator(b.questionId):view.frame.locator('[data-fieldwork-evidence-control='+JSON.stringify(b.controls[0].id)+']');
  await anchor.evaluate(e=>{const target=e.closest('[role=radiogroup],.file-upload,[role=combobox],fieldset,[role=group]')||(e.getClientRects().length&&e.getBoundingClientRect().width>2?e:[...e.labels||[]].find(l=>l.getClientRects().length&&l.getBoundingClientRect().width>2))||e.parentElement,r=target?.getBoundingClientRect();if(r&&(r.top<80||r.bottom>innerHeight-40))target.scrollIntoView({block:r.height>innerHeight-100?'start':'center',behavior:'instant'});}).catch(()=>null);
  const groupDetail=b.controls.length>1?await anchor.screenshot({animations:'disabled',timeout:3000}):null;
  const observed=(await collectEvidence(view)).find(q=>q.questionId===b.questionId);if(!observed)throw Error('Question changed before visual assessment');
  const requested=new Set(b.controls.map(c=>c.id)),fresh={...observed,label:b.label,controls:observed.controls.filter(c=>requested.has(c.id))};
  if(fresh.controls.length!==requested.size)throw Error('A scoped control changed before visual assessment');
  // The model is confirming this question's placement. Other fields and
  // asynchronous option results can change while that assessment is running.
  const layoutStamp=raw=>{
   const controls=raw.questions.find(q=>q.questionId===b.questionId)?.controls.filter(c=>requested.has(c.id));
   return hash({url:raw.url,viewport:raw.viewport,controls:controls?.map(c=>({id:c.id,label:c.label,visibleLabel:c.visibleLabel,dom:c.dom,rect:Object.values(c.rect).map(Math.round)}))});
  };
  const rawStamp=layoutStamp(await view.frame.evaluate(snapshot));
  const refreshConfirmedQuestion=async()=>{
   signal?.throwIfAborted();
   const latest=(await collectEvidence(view,{capture:false})).find(q=>q.questionId===b.questionId);
   if(!latest||rawStamp!==layoutStamp(await view.frame.evaluate(snapshot)))throw Error('Question moved during visual assessment');
   fresh.controls=latest.controls.filter(c=>requested.has(c.id));
   fresh.observation=latest.observation;
  };
  if(fresh.controls.length===1&&fresh.controls[0].type==='radio'){
   const renderedGroup=()=>anchor.evaluate((first,{name,options})=>{
    const group=first.closest('[role=radiogroup]');
    if(!group||group.getAttribute('aria-label')!==name)return null;
    const normalize=text=>text.replace(/\s+/g,' ').replace(/\s*\*$/,'').trim();
    const hitRect=element=>{
     const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return r.width&&r.height&&r.top>=0&&r.bottom<=innerHeight&&element.contains(hit)?[r.x,r.y,r.width,r.height]:null;
    };
    const rect=group.getBoundingClientRect();
    const labels=[...document.querySelectorAll('label,legend')].filter(label=>{
     const r=label.getBoundingClientRect();
     return r.bottom<=rect.top&&rect.top-r.bottom<=80&&r.left<rect.right&&r.right>rect.left&&normalize(label.innerText)===normalize(name)&&hitRect(label);
    });
    if(labels.length!==1)return null;
    const radios=[...group.querySelectorAll('[role=radio]')].filter(e=>e.closest('[role=radiogroup]')===group);
    if(radios.length!==options.length)return null;
    const hits=options.map(({id,label})=>{
     const radio=radios.find(e=>e.getAttribute('data-fieldwork-evidence-option')===id);
     return radio&&normalize(radio.innerText)===normalize(label)?hitRect(radio):null;
    });
    return hits.every(Boolean)?[hitRect(labels[0]),...hits]:null;
   },{name:fresh.label,options:fresh.controls[0].choices});
   const rendered=await renderedGroup();
   if(rendered){
    const viewport=await view.page.screenshot({scale:'css',timeout:3000});
    await refreshConfirmedQuestion();
    if(hash(rendered)===hash(await renderedGroup())){
     fresh.visual.reference='data:image/png;base64,'+viewport.toString('base64');fresh.visual.coordinateSpace='viewport-css';fresh.visual.viewport=fresh.observation.viewport;
     fresh.visual.assessment={confirmed:true,source:'rendered-radio-group-hit-test',screenshotHash:require('node:crypto').createHash('sha256').update(viewport).digest('hex'),elapsedMs:performance.now()-started};
     (view.__fieldworkEvidenceTrace ||= []).push({questionId:b.questionId,action:'visual-assessment',...fresh.visual.assessment});
     return fresh;
    }
   }
  }
  const viewport=await view.page.screenshot({scale:'css',timeout:3000});
  if(!createAgent&&fresh.controls.length>=1){
   const hitConfirmed=await view.frame.evaluate(ids=>{
    const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    return ids.every(id=>{
     const e=document.querySelector('[data-fieldwork-evidence-control='+JSON.stringify(id)+']');
     if(!e)return false;
     const targets=[e,...(e.labels||[]),e.closest('[role=combobox],.file-upload,[role=group],fieldset'),e.parentElement].filter(Boolean);
     return targets.some(t=>{
      if(!visible(t))return false;
      const r=t.getBoundingClientRect();
      if(r.bottom<=0||r.top>=innerHeight)return false;
      return [.15,.35,.5,.7].some(fx=>{
       const x=Math.min(innerWidth-1,Math.max(1,r.left+r.width*fx));
       const y=Math.min(innerHeight-1,Math.max(1,r.top+r.height/2));
       const hit=document.elementFromPoint(x,y);
       return hit&&(t.contains(hit)||hit.contains(t)||hit.closest('label')?.control===e);
      });
     });
    });
   },fresh.controls.map(c=>c.id)).catch(()=>false);
   if(hitConfirmed){
    await refreshConfirmedQuestion();
    fresh.visual.reference='data:image/png;base64,'+viewport.toString('base64');fresh.visual.coordinateSpace='viewport-css';fresh.visual.viewport=fresh.observation.viewport;
    fresh.visual.assessment={confirmed:true,source:fresh.controls.length===1&&fresh.controls[0].domain==='boolean'?'rendered-checkbox-hit-test':'rendered-control-hit-test',screenshotHash:require('node:crypto').createHash('sha256').update(viewport).digest('hex'),elapsedMs:performance.now()-started};
    (view.__fieldworkEvidenceTrace ||= []).push({questionId:b.questionId,action:'visual-assessment',...fresh.visual.assessment});
    return fresh;
   }
  }
  const options={generateReport:false,persistExecutionDump:false,autoPrintReportMsg:false,screenshotShrinkFactor:fresh.observation.viewport.dpr,
   beforeInvokeAction:async()=>{throw Error('Visual assessment is read only');},
   modelConfig:{MIDSCENE_MODEL_NAME:createAgent?settings.visionModel:await require('./local-visual-model.cjs').prepareVisualModel(settings.visionModel),MIDSCENE_MODEL_BASE_URL:'http://127.0.0.1:11434/v1',MIDSCENE_MODEL_API_KEY:'local',MIDSCENE_MODEL_FAMILY:'qwen3-vl',MIDSCENE_MODEL_TIMEOUT:10000,MIDSCENE_MODEL_RETRY_COUNT:0}};
  agent=createAgent?await createAgent(view.page,options):new(require('@midscene/web/playwright/agent').PlaywrightAgent)(view.page,options);
  const box=await view.frame.locator('[data-fieldwork-evidence-control='+JSON.stringify(b.controls[0].id)+']').evaluate(e=>{const t=e.getBoundingClientRect().width?e:[...e.labels||[]].find(l=>l.getClientRects().length),r=t?.getBoundingClientRect();return r?{x:Math.max(0,r.x-30),y:Math.max(0,r.y-110),width:Math.min(innerWidth-Math.max(0,r.x-30),Math.max(650,r.width+60)),height:Math.min(innerHeight-Math.max(0,r.y-110),Math.max(220,r.height+170))}:null;});
  // Crop the captured viewport itself so scroll offsets cannot shift the detail.
  let detail=groupDetail||viewport;
  if(!groupDetail&&box){const left=Math.floor(box.x),top=Math.floor(box.y),width=Math.floor(box.width),height=Math.floor(box.height);if(width>0&&height>0)detail=await require('sharp')(viewport).extract({left,top,width,height}).png().toBuffer();}
  const prompt='Does the screenshot or attached question detail visibly show this form field or preference and its controls? Accessible question name: '+JSON.stringify(fresh.label)+'. Controls: '+JSON.stringify(fresh.controls.map(c=>({accessibleName:c.label,visibleLabel:c.visibleLabel,type:c.type})))+'. Accessible names may be longer than the printed labels. Match the visible labels and surrounding field context, including greyed out preferences. Answer true only if they are visibly present and unambiguous. Ignore mouse position; do not infer candidate facts or perform actions.';
  const confirmed=await Promise.race([agent.aiBoolean({prompt,images:[{name:'Question detail',url:'data:image/png;base64,'+detail.toString('base64')}]}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Visual question assessment deadline exceeded')),deadlineMs);})]);
  await refreshConfirmedQuestion();
  if(confirmed!==true)throw Error('Visual evidence did not confirm the question/control relationship');
  fresh.visual.reference='data:image/png;base64,'+viewport.toString('base64');fresh.visual.coordinateSpace='viewport-css';fresh.visual.viewport=fresh.observation.viewport;
  fresh.visual.assessment={confirmed:true,model:options.modelConfig.MIDSCENE_MODEL_NAME,screenshotHash:require('node:crypto').createHash('sha256').update(viewport).digest('hex'),elapsedMs:performance.now()-started};
  (view.__fieldworkEvidenceTrace ||= []).push({questionId:b.questionId,action:'visual-assessment',...fresh.visual.assessment});
  return fresh;
 }finally{clearTimeout(timer);await agent?.destroy();}
}
async function executeAccountValue(view,field,value,settings,signal){
 const inventory=await collectEvidence(view),id=await view.frame.locator('[data-fieldwork-id='+JSON.stringify(field.id)+']').first().getAttribute('data-fieldwork-evidence-control');
 let b=inventory.find(q=>q.controls.some(c=>c.id===id));if(!b)throw Error('Account control has no question evidence');
 const target=b.controls.find(c=>c.id===id);b={...b,label:target.label,controls:[target]};
 b=await assessEvidence(view,b,settings,signal);
 const proposals=require('./evidence-candidate.cjs').candidateProposals(b,{resume:{},additional:''});
 proposals[id]={kind:'answer',value,evidence:'Authorized account workflow value'};
 const d=require('./evidence-domain.cjs').decide(b,proposals);if(d.kind!=='answer')throw Error(d.reason);
 if(!d.answers.every(a=>a.retain))await executeEvidence(view,b,d,settings,signal);
 const after=(await collectEvidence(view)).find(q=>q.questionId===b.questionId);
 if(!after||!require('./evidence-domain.cjs').verify(after,d))throw Error('The account answer was not committed');
 return value;
}
async function waitForEvidenceReady(view,signal){
 signal?.throwIfAborted();
 const ready=await view.frame.evaluate(()=>new Promise(resolve=>{
  const shown=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[aria-hidden=true],[inert]');
  const field='input:not([type=hidden],[type=button],[type=submit]),select,textarea,[role=combobox],[role=radio],[aria-haspopup=listbox][aria-controls]';
  const signature=()=>{
   if(/too many (?:attempts|requests)|maximum number of attempts|temporarily locked|rate limit exceeded/i.test(document.body?.innerText||''))return 'rate-limited';
   if([...document.querySelectorAll('[aria-busy=true],[role=progressbar]:not([aria-valuenow]),[data-automation-id*=skeleton i],[data-testid*=skeleton i],.skeleton')].some(shown))return '';
   const headings=[...document.querySelectorAll('h1,h2,[role=heading]')].filter(shown).map(e=>e.innerText.trim()).filter(Boolean);
   const fields=[...document.querySelectorAll(field)].filter(e=>shown(e)&&!e.closest('header,[role=search]'));
   const actions=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>shown(e)&&!e.closest('header,[role=search]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true').map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim()).filter(label=>/^(?:apply(?: now)?|apply manually|enter (?:my |your )?information manually|continue without (?:a )?resume|next|continue|save and continue|create (?:an? )?account|register|sign in|log in|verify(?: code)?|submit(?: application)?)$/i.test(label));
   const dashboard=/^(?:(?:welcome to )?(?:candidate home|candidate dashboard|applicant dashboard)|my applications)$/i.test(headings[0]||'');
   const formShell=headings.some(h=>/^(?:my information|my experience|application questions(?: \d+ of \d+)?|voluntary disclosures)$/i.test(h));
   if(!fields.length&&(formShell||!dashboard&&!actions.length))return '';
   return JSON.stringify([location.href,headings,fields.map(e=>[e.id,e.name,e.getAttribute('aria-label'),e.type]),actions]);
  };
  let previous='',since=0;
  const check=()=>{
   const next=signature(),now=performance.now();
   if(next!==previous){previous=next;since=now;}
   if(next&&now-since>=450){clearInterval(poll);clearTimeout(timeout);resolve(true);}
  };
  const poll=setInterval(check,100),timeout=setTimeout(()=>{clearInterval(poll);resolve(false);},15000);
  check();
 }));signal?.throwIfAborted();if(!ready)throw Object.assign(Error('The application step has not finished loading. Resume when it is visible.'),{code:'STEP_NOT_READY'});
}
module.exports={snapshot,collectEvidence,executeEvidence,discoverEvidence,assessEvidence,executeAccountValue,waitForEvidenceReady};

const {norm}=require('./canonical.cjs'),{relatedOptions}=require('./option-meaning.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function trace(view,field,stage,data={}){view.__fieldworkActionTrace=[...(view.__fieldworkActionTrace||[]),{at:new Date().toISOString(),field:field.label,stage,...data}].slice(-150);}
function matchOptions(field,options,value){let found=options.filter(o=>norm(o.label)===norm(value)||norm(o.value)===norm(value));if(found.length)return found;found=relatedOptions(field,options,value);if(found.length)return found;if(norm(value)==='united states')return options.filter(o=>/^(?:1 )?(?:united states(?: of america)?|usa|us)(?: 1)?$/.test(norm(o.label)));const {findBestChoice}=require('./resemblance.cjs');const best=findBestChoice(options,value,field,{contact:field.contactHint});if(best)return [best];return [];}
async function optionsFor(view,id){return view.frame.evaluate(id=>{
 document.querySelectorAll('[data-fieldwork-choice]').forEach(n=>n.removeAttribute('data-fieldwork-choice'));const e=document.querySelector('[data-fieldwork-id="'+id+'"]'),visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&n.getAttribute('aria-disabled')!=='true';
 const control=e?.matches('input')?e:e?.querySelector('input')||e;const owner=control?.closest('[role=combobox]')||control;const owned=[...(control?.getAttribute('aria-controls')||control?.getAttribute('aria-owns')||owner?.getAttribute('aria-controls')||owner?.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)).filter(Boolean)];
 const roots=owned.length?owned:[...document.querySelectorAll('[role=listbox],[role=tree],[role=menu],ul,ol,[class*=dropdown],[class*=listbox],[class*=suggestion],[class*=autocomplete-results],[class*=select__options]')].filter(visible).filter(root=>{const r=root.getBoundingClientRect(),f=e?.getBoundingClientRect();if(!f)return false;const overlap=Math.min(r.right,f.right)-Math.max(r.left,f.left),gap=Math.max(0,r.top-f.bottom,f.top-r.bottom);return overlap>0&&gap<120;});
 let nodes=roots.flatMap(root=>[...root.querySelectorAll('[role=option],li,[class*=__option],[class*=-option],[class*=result-label]')]);
 if(!nodes.length)nodes=[...document.querySelectorAll('[role=option],li,[class*=__option],[class*=-option],[class*=result-label]')].filter(n=>{const r=n.getBoundingClientRect(),f=e?.getBoundingClientRect();return f&&r.right>f.left&&r.left<f.right&&Math.max(0,r.top-f.bottom,f.top-r.bottom)<600;});
 nodes=nodes.map(n=>n.closest('[role=option],li')||n);
 nodes=[...new Set(nodes)].filter(n=>visible(n)&&!n.querySelector('[role=option],li,input,textarea,select')&&!n.closest('[role=radiogroup]')).slice(0,500);
 return nodes.map((n,i)=>{const token='fw-choice-'+i;n.setAttribute('data-fieldwork-choice',token);return {id:token,label:(n.innerText||n.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim(),value:n.getAttribute('data-value')||''};}).filter(o=>o.label);
 },id);}
async function selectDropdown(view,field,value,settings,signal){const schemaOption=field.options?.find(o=>String(o.value)===String(value));if(schemaOption)value=schemaOption.label;
 field={...field,contactHint:require('./candidate-contact.cjs').candidateContact({additional:settings.additional})};const input=view.frame.locator('[data-fieldwork-id="'+field.id+'"]').first();
 await view.frame.locator('[data-fieldwork-id][aria-expanded=true]').evaluateAll((nodes,id)=>nodes.filter(n=>n.getAttribute('data-fieldwork-id')!==id).forEach(n=>n.blur()),field.id);
 await view.page.keyboard.press('Escape');await input.scrollIntoViewIfNeeded({timeout:4000});await input.click({timeout:4000});
 trace(view,field,'opened',{networkOptions:field.networkOptions?.length||0,networkLinked:!!field.optionSource});
 let choices=[];for(let i=0;i<8;i++){signal?.throwIfAborted();choices=await optionsFor(view,field.id);if(choices.length)break;await delay(100);}
 let matches=matchOptions(field,choices,value);
 const editable=input.locator('input').first();const filterInput=await input.evaluate(e=>e.tagName==='INPUT')?input:await editable.count()?editable:null;
 trace(view,field,'options-observed',{count:choices.length,matches:matches.length});
 if(matches.length!==1&&filterInput&&await filterInput.evaluate(e=>!e.readOnly)){
  await input.evaluate(e=>{e.removeAttribute('data-fieldwork-committed');e.removeAttribute('data-fieldwork-input-value');});await filterInput.fill(String(value));await delay(350);if(!await optionsFor(view,field.id).then(rows=>rows.length))await filterInput.click({timeout:4000});
  trace(view,field,'filtered',{networkOptions:field.networkOptions?.length||0});
  for(let i=0;i<10;i++){signal?.throwIfAborted();choices=await optionsFor(view,field.id);matches=matchOptions(field,choices,value);if(matches.length===1)break;await delay(120);}
 }
 if(matches.length!==1&&require('./field-meaning.cjs').schoolQuestion(field.label)&&filterInput&&await filterInput.evaluate(e=>!e.readOnly)){
  for(const query of ['Other','Not listed']){await filterInput.fill(query);await delay(250);choices=await optionsFor(view,field.id);matches=matchOptions(field,choices,value);if(matches.length===1)break;}
 }
 let selected,point,selectedLocator;
 if(matches.length===1){selected=matches[0];const option=view.frame.locator('[data-fieldwork-choice="'+selected.id+'"]').first();selectedLocator=option;await option.scrollIntoViewIfNeeded({timeout:4000});const nav='choice-'+Date.now();await option.evaluate((e,id)=>e.setAttribute('data-fieldwork-nav',id),nav);if(settings.visionModel){try{point=await require('./visual.cjs').navigationPoint(view,{id:nav,text:selected.label},settings,signal);}catch(error){signal?.throwIfAborted();if(!/timed out/.test(error.message))throw error;point=await option.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!r.width||!r.height||!e.contains(hit))throw Error('The dropdown option moved or is obscured');return {x:r.x+r.width/2,y:r.y+r.height/2};});}}else point=await option.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 }else{
  if(choices.length)throw Error(matches.length?'Several location options match; add a state/county to distinguish them':'No available dropdown option matches '+value);
  if(!settings.visionModel)throw Error('Dropdown options have no recognizable semantics');
  const {createVisual,locateCurrent}=require('./visual.cjs'),agent=await createVisual(view,settings);try{const located=await locateCurrent(agent,view,'The visible option in the OPEN dropdown matching '+JSON.stringify(value)+'. For a city, extra county and state text is allowed; require state '+JSON.stringify(field.contactHint.state||'')+'. Do not choose the search input.',signal);point={x:located.center[0],y:located.center[1]};selected=await view.frame.evaluate(({x,y})=>{const hit=document.elementFromPoint(x,y),e=hit?.closest('[role=option],li,[class*=option],[class*=result]')||hit;if(e)e.setAttribute('data-fieldwork-choice','fw-visual-choice');return e?{label:(e.innerText||'').replace(/\s+/g,' ').trim(),value:''}:null;},point);if(!selected||matchOptions(field,[selected],value).length!==1)throw Error('Visible dropdown option does not match the requested answer');}finally{await agent.destroy();}
 }
 signal?.throwIfAborted();trace(view,field,'click-option',{option:selected.label});
 selectedLocator ||= view.frame.locator('[data-fieldwork-choice="fw-visual-choice"]').first();
 const currentLabel=await selectedLocator.innerText({timeout:2000});if(matchOptions(field,[{label:currentLabel,value:selected.value||''}],value).length!==1)throw Error('The dropdown option changed before clicking');
 const box=await selectedLocator.boundingBox();if(!box)throw Error('The dropdown option disappeared');await require('./cursor.cjs').showCursor(view,box.x+box.width/2,box.y+box.height/2,'Select '+selected.label,true);
 await selectedLocator.click({timeout:4000});await delay(150);
 for(let i=0;i<15;i++){signal?.throwIfAborted();const state=await input.evaluate(e=>({value:e.value||'',text:e.getAttribute('aria-valuetext')||e.textContent||'',expanded:e.getAttribute('aria-expanded'),invalid:e.getAttribute('aria-invalid')==='true'})).catch(()=>null);if(state&&!state.invalid&&state.expanded!=='true'){
  const observed=(await view.observe(require('./page-observation.cjs').observe)).fields.find(f=>f.id===field.id||f.label===field.label&&f.name===field.name);const actual=observed?.value||state.value||state.text;const phoneDisplay=/^\+\d{1,4}$/.test(actual.trim())&&selected.label.match(/\+\s*(\d{1,4})\b/)?.[1]===actual.replace(/\D/g,'');if(actual&&(matchOptions(field,[{label:actual,value:actual}],value).length===1||norm(actual)===norm(selected.label)||phoneDisplay)){await input.evaluate((e,selection)=>{e.setAttribute('data-fieldwork-committed',selection);e.setAttribute('data-fieldwork-input-value',e.value||'');e.addEventListener('input',()=>{e.removeAttribute('data-fieldwork-committed');e.removeAttribute('data-fieldwork-input-value');},{once:true});},actual);trace(view,field,'committed',{option:selected.label});return actual;}
 }await delay(100);}
 throw Error('The dropdown option was clicked but its selected value was not retained');
}
module.exports={selectDropdown,matchOptions,optionsFor};

const {runQuestions}=require('./evidence-domain.cjs');

function inspectExperience(){
 const clean=s=>(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true});
 const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible);
 const add=buttons.filter(e=>/^(?:add|new) (?:work |employment |professional )?(?:experience|employment|job|position|work history)(?: entry)?$/i.test(clean(e.innerText||e.getAttribute('aria-label'))));
 if(!add.length)return null;
 if(add.length!==1)return {ambiguous:true};
 let scope=add[0].parentElement;
 for(let i=0,node=scope;node&&i<7&&node!==document.body;node=node.parentElement,i++){
  if([...node.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,label,[role=heading],span')].some(e=>visible(e)&&/^(?:work |employment |professional )?(?:experience|employment|work history)\s*\*?$/i.test(clean(e.innerText)))){scope=node;break;}
 }
 document.querySelector('[data-fieldwork-experience-add]')?.removeAttribute('data-fieldwork-experience-add');
 if(add[0].type!=='submit'||!add[0].form)add[0].setAttribute('data-fieldwork-experience-add','');
 return {safeAdd:add[0].hasAttribute('data-fieldwork-experience-add'),text:clean(scope.innerText),hasEntry:buttons.some(e=>scope.contains(e)&&/^(?:edit|remove|delete) (?:work )?(?:experience|employment|job|position)\b/i.test(clean(e.getAttribute('aria-label')||e.innerText)))};
}

function experienceProposals(bundle,entry){
 const out={},current=/^(?:present|current|ongoing)$/i.test(entry.end||'');
 for(const c of bundle.controls){
  const label=c.label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let value;
  if(/^(?:company|employer|organization|organisation)(?: name)?$/.test(label))value=entry.company;
  if(/^(?:job title|position(?: title)?|title|role)$/.test(label))value=entry.title;
  if(/^(?:job |work |company )?location$/.test(label))value=entry.location;
  if(/^(?:description|job description|responsibilities|duties)$/.test(label)&&Array.isArray(entry.bullets))value=entry.bullets.join('\n');
  if(c.domain==='boolean'&&/^(?:i )?(?:currently work here|current job|current position|current employer)$/.test(label)&&entry.end)value=current;
  const date=/^(start|end|from|to)(?: date)?(?: (month|year))?$/.exec(label);
  if(date){
   const raw=String(/^(start|from)$/.test(date[1])?entry.start||'':entry.end||'');
   if(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(raw)){
    if(date[2]==='year')value=raw.slice(0,4);
    else if(date[2]==='month'&&raw.length>=7){
     const month=Number(raw.slice(5,7));
     if(month>=1&&month<=12){
      const name=new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(Date.UTC(2000,month-1,1));
      value=c.domain==='single'?c.choices.find(o=>[name,name.slice(0,3),String(month),raw.slice(5,7)].includes(o.label))?.value||name:raw.slice(5,7);
     }
    }else if(c.type==='month'&&raw.length>=7)value=raw.slice(0,7);
    else if(c.type!=='date'||raw.length===10)value=raw;
   }
  }
  if(value!==undefined&&value!=='')out[c.id]={kind:'answer',value,evidence:'Most recent entry in the candidate’s saved work history'};
  else if(!c.dom.required&&c.domain==='text'&&!c.rawValue)out[c.id]={kind:'answer',value:'',evidence:'Optional experience detail absent from work history'};
 }
 return out;
}

async function prepareExperience(view,profile,{collect,discover,assess,execute,signal,progress}){
 const section=await view.frame.evaluate(inspectExperience);
 if(!section||section.hasEntry)return;
 if(section.ambiguous||!section.safeAdd)return 'The experience editor could not be safely identified';
 const entry=(profile.resume?.experience||[]).filter(item=>item.company&&item.title).sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')))[0];
 if(!entry)return 'Add your most recent work experience before continuing';
 const includesEntry=text=>[entry.company,entry.title].every(value=>text.toLowerCase().includes(value.toLowerCase()));
 if(includesEntry(section.text))return;
 const before=new Set((await collect()).flatMap(q=>q.controls.map(c=>c.id)));
 signal?.throwIfAborted();
 await view.frame.locator('[data-fieldwork-experience-add]').click({timeout:3000});
 const editorQuestions=async()=>(await collect()).flatMap(q=>{
  const controls=q.controls.filter(c=>!before.has(c.id));
  return controls.length?[{...q,controls}]:[];
 });
 let opened;
 for(let i=0;i<15&&!opened?.length;i++){
  signal?.throwIfAborted();opened=await editorQuestions();
  if(!opened.length)await new Promise(r=>setTimeout(r,150));
 }
 if(!opened?.length)return 'Add Experience opened, but no editable fields were detected';
 const labels=opened.flatMap(q=>q.controls).map(c=>c.label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim());
 if(!labels.some(label=>/^(?:company|employer|organization|organisation)(?: name)?$/.test(label))||!labels.some(label=>/^(?:job title|position(?: title)?|title|role)$/.test(label)))return 'The opened experience editor did not identify both employer and job title';
 const result=await runQuestions({collect:editorQuestions,propose:b=>experienceProposals(b,entry),discover,assessVisual:assess,execute,signal,progress:(_,c)=>progress('Experience · '+(c?.label||'checking fields'))});
 if(!result.ready)return (result.question?result.question+': ':'')+result.reason;
 const ids=(await editorQuestions()).flatMap(q=>q.controls.map(c=>c.id));
 const safeSave=await view.frame.evaluate(({ids,prior})=>{
  const controls=ids.map(id=>document.querySelector('[data-fieldwork-evidence-control='+JSON.stringify(id)+']')).filter(Boolean);
  const existing=prior.map(id=>document.querySelector('[data-fieldwork-evidence-control='+JSON.stringify(id)+']')).filter(Boolean);
  for(let root=controls[0]?.parentElement;root&&root!==document.body;root=root.parentElement){
   if(!controls.every(e=>root.contains(e)))continue;
   if(existing.some(e=>root.contains(e)))break;
   const buttons=[...root.querySelectorAll('button,[role=button]')].filter(e=>e.checkVisibility({visibilityProperty:true})&&/^(?:save(?: (?:work )?(?:experience|employment|job|position))?|add (?:work )?experience)$/i.test((e.innerText||'').trim())&&!e.hasAttribute('data-fieldwork-experience-add')&&(e.type!=='submit'||!e.form));
   if(buttons.length!==1)continue;
   buttons[0].setAttribute('data-fieldwork-experience-save','');
   return true;
  }
  return false;
 },{ids,prior:[...before]});
 if(!safeSave)return 'Experience details were filled; use the editor’s Save control and re-scan';
 signal?.throwIfAborted();
 await view.frame.locator('[data-fieldwork-experience-save]').click({timeout:3000});
 for(let i=0;i<15;i++){
  signal?.throwIfAborted();
  const updated=await view.frame.evaluate(inspectExperience);
  if(updated?.text&&includesEntry(updated.text)&&!(await editorQuestions()).length)return;
  await new Promise(r=>setTimeout(r,150));
 }
 return 'The saved experience could not be verified; review the experience section';
}
module.exports={inspectExperience,prepareExperience,experienceProposals};

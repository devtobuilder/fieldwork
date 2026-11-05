const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),{observe}=require('../desktop/page-observation.cjs'),{selectDropdown}=require('../desktop/dropdown.cjs');
test('wrapped searchable dropdown clicks an actual option and does not treat filter text as selection',async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true});
 try{const page=await context.newPage();await page.setContent(`<label for="country">Country</label><div role="combobox" id="country" aria-label="Country" aria-controls="country-list" aria-expanded="false"><input aria-label="Search country"><span class="single-value"></span></div><ul id="country-list" role="listbox" hidden></ul><script>
 const box=document.querySelector('[role=combobox]'),input=box.querySelector('input'),list=document.querySelector('ul');window.optionClicks=0;window.enters=0;
 input.addEventListener('keydown',e=>{if(e.key==='Enter')window.enters++});
 box.addEventListener('click',()=>{box.setAttribute('aria-expanded','true');list.hidden=false;render()});
 input.addEventListener('input',render);
 function render(){list.innerHTML='';if(input.value.length<2||!'united states'.includes(input.value.toLowerCase()))return;const row=document.createElement('li');row.setAttribute('role','option');row.textContent='United States';row.onclick=e=>{e.stopPropagation();window.optionClicks++;box.querySelector('span').textContent=row.textContent;input.value='';list.hidden=true;box.setAttribute('aria-expanded','false')};list.appendChild(row)};
 </script>`);
 const view={external:true,page,frame:page,webContents:{executeJavaScript:code=>page.evaluate(code)},observe:async fn=>page.evaluate(fn),clickPoint:(x,y)=>page.mouse.click(x,y)};
 await page.evaluate(()=>{const input=document.createElement('input');input.readOnly=true;input.setAttribute('role','combobox');input.setAttribute('aria-label','Country code');document.body.appendChild(input)});
 assert((await page.evaluate(observe)).fields.some(f=>f.label==='Country code'),'readonly selection controls must remain actionable');
 const field=(await page.evaluate(observe)).fields.find(f=>f.label==='Country');assert(field);assert.equal(field.value,'');
 const visual=require('../desktop/visual.cjs'),originalLocate=visual.navigationPoint;let actual;try{visual.navigationPoint=async()=>{await page.evaluate(()=>document.body.style.paddingTop='200px');return {x:1,y:1};};actual=await selectDropdown(view,{...field,options:[{value:'US',label:'United States'}],networkOptions:[{value:'US',label:'United States'}],optionSource:{kind:'network'}},'US',{visionModel:'test-local'});}finally{visual.navigationPoint=originalLocate;}
 assert.equal(actual,'United States');assert.equal(await page.evaluate(()=>window.optionClicks),1);assert.equal(await page.evaluate(()=>window.enters),0);assert(view.__fieldworkActionTrace.some(e=>e.stage==='committed'));
 }finally{await context.close();}
});

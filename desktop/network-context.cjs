const {createHash}=require('node:crypto');
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const safeSource=url=>{try{const u=new URL(url);return u.origin+u.pathname;}catch{return '';}};
function sameApplication(a,b){try{const x=new URL(a),y=new URL(b);const id=u=>u.pathname.match(/\/(?:jobs?|positions?|requisitions?)\/(\d+)(?:\/|$)/i)?.[1];return x.origin===y.origin&&(!id(x)||!id(y)||id(x)===id(y));}catch{return false;}}
// Parse data literals only. Never execute response scripts or treat their text as instructions.
function jsonLiterals(text,limit=80){const values=[];let attempts=0;for(let start=0;start<text.length&&values.length<limit&&attempts<512;start++){
 const first=text[start];if(first!=='{'&&first!=='['&&first!=='"')continue;let end=start,quoted=false,escaped=false,depth=0;
 attempts++;
 if(first==='"'){for(end=start+1;end<text.length;end++){if(escaped){escaped=false;continue;}if(text[end]==='\\'){escaped=true;continue;}if(text[end]==='"')break;}}
 else{for(;end<text.length;end++){const c=text[end];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){if(--depth===0)break;}}}
 if(end>=text.length)continue;try{const value=JSON.parse(text.slice(start,end+1));if(value&&typeof value==='object'||typeof value==='string'&&/[{\[]/.test(value)){values.push(value);start=end;}}catch{}
 }return values;}
function extractFields(body,{sourceUrl='',capturedAt=Date.now()}={}){
 if(typeof body!=='string'||Buffer.byteLength(body)>2*1024*1024)return [];
 const records=new Map();let visits=0,optionBudget=30000;const parsed=new Set();
 const walk=(node,parentLabel='',depth=0)=>{if(++visits>60000||depth>25||!node)return;
  if(typeof node==='string'){if(node.length>30&&node.length<2*1024*1024&&!parsed.has(node)&&/(?:"fields"|"options"|"choices"|"values"|\\"fields\\")/.test(node)){parsed.add(node);for(const v of jsonLiterals(node,25))walk(v,parentLabel,depth+1);}return;}
  if(typeof node!=='object')return;if(Array.isArray(node)){for(const item of node)walk(item,parentLabel,depth+1);return;}
  const label=clean(node.label||node.title||node.question?.label||parentLabel).slice(0,500);
  const id=node.name??node.fieldId??node.field_id??node.questionId??node.question_id??node.id??node.key;
  const raw=node.options||node.choices||node.values||node.enum||node.oneOf||node.answer_options;
  if(id!==undefined&&Array.isArray(raw)&&raw.length&&optionBudget>0&&(/select|choice|enum|dropdown|radio|checkbox/i.test(node.type||'')||node.options||node.choices||node.enum||node.oneOf||node.answer_options||raw.some(o=>o&&typeof o==='object'&&(o.label!==undefined||o.text!==undefined)&&o.value!==undefined))){
   const fieldId=String(id);if(/^[\w.\[\]-]{1,180}$/.test(fieldId)){
    const options=[];for(const item of raw.slice(0,Math.min(5000,optionBudget))){const value=item&&typeof item==='object'?(item.value??item.id??item.const??item.key):item;const title=item&&typeof item==='object'?(item.label??item.title??item.name??item.text??value):item;if(!['string','number','boolean'].includes(typeof value)||!['string','number'].includes(typeof title))continue;const text=clean(title);if(!text||text.length>500||String(value).length>300)continue;options.push({label:text,value:String(value)});}
    if(options.length){optionBudget-=options.length;records.set(fieldId,{fieldId,label,options,sourceUrl:safeSource(sourceUrl),capturedAt});}
   }
  }
  for(const [key,value]of Object.entries(node))if(key!=='options'&&key!=='choices'&&key!=='values'&&key!=='enum'&&key!=='answer_options')walk(value,label,depth+1);
 };
 let roots;try{roots=[JSON.parse(body)];}catch{const scripts=[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);roots=scripts.length?scripts.flatMap(s=>jsonLiterals(s)):jsonLiterals(body);}
 for(const value of roots)walk(value);return [...records.values()].slice(0,200);
}
const normLabel=v=>String(v??'').toLowerCase().replace(/\s*\*+\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
class NetworkContext{
 constructor({onSave}={}){this.fields=new Map();this.epoch=0;this.documentUrl='';this.onSave=onSave;this.pending=new Set();this.bytes=0;this.ingestedUrls=new Set();}
 begin(url){this.epoch++;if(!sameApplication(this.documentUrl,url)){this.fields.clear();this.ingestedUrls.clear();}this.documentUrl=safeSource(url);this.bytes=0;}
 restore(state,url){if(state?.version!==1||Date.now()-state.capturedAt>24*3600000||!sameApplication(state.documentUrl,url))return;this.documentUrl=state.documentUrl;for(const field of state.fields||[])if(field.fieldId&&Array.isArray(field.options))this.fields.set((field.frameOrigin||new URL(state.documentUrl).origin)+'|'+field.fieldId,{...field,cached:true});}
 ingestHtml(html,url){
  if(!html||typeof html!=='string')return;
  const safe=safeSource(url||this.documentUrl);
  if(!safe||this.ingestedUrls.has(safe))return;
  this.ingestedUrls.add(safe);
  let frameOrigin;try{frameOrigin=new URL(url||this.documentUrl).origin;}catch{return;}
  const records=extractFields(html,{sourceUrl:url||this.documentUrl});
  for(const field of records){
   const key=frameOrigin+'|'+field.fieldId;
   if(!this.fields.has(key))this.fields.set(key,{...field,frameOrigin});
  }
  if(records.length)this.onSave?.(this.snapshot());
 }
 matchControl(control,origin){
  const rawKeys=[control?.dom?.stable,control?.dom?.name,control?.id?.replace(/^ev-/,'')].filter(Boolean);
  const candidateIds=new Set();
  for(const k of rawKeys){
   const s=String(k);
   candidateIds.add(s);
   if(/^\d+$/.test(s))candidateIds.add('question_'+s);
   const stripped=s.replace(/^question_/,'').replace(/[-_](?:input|select|control)$/i,'');
   if(stripped){candidateIds.add(stripped);if(/^\d+$/.test(stripped))candidateIds.add('question_'+stripped);}
  }
  const byId=[...candidateIds].map(id=>this.fields.get(origin+'|'+id)).filter(Boolean);
  const uniqueById=[...new Map(byId.map(f=>[f.fieldId,f])).values()];
  if(uniqueById.length===1)return uniqueById[0];
  const cLabel=normLabel(control?.label);
  if(cLabel&&cLabel.length>=3){
   const byLabel=[...this.fields.values()].filter(f=>(!f.frameOrigin||f.frameOrigin===origin)&&normLabel(f.label)===cLabel);
   const uniqueByLabel=[...new Map(byLabel.map(f=>[JSON.stringify(f.options),f])).values()];
   if(uniqueByLabel.length===1)return uniqueByLabel[0];
  }
  return null;
 }
 async capture(response,epoch=this.epoch){
  if(epoch!==this.epoch||response.status()<200||response.status()>=300||response.request().method()!=='GET')return;
  const type=response.headers()['content-type']||'',resource=response.request().resourceType();if(!/json|html|javascript/.test(type)&&!['document','script'].includes(resource))return;
  const length=Number(response.headers()['content-length']||0);if(length>2*1024*1024||this.bytes>8*1024*1024)return;
  let timer;try{const bytes=await Promise.race([response.body(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Response context deadline')),2000);})]);if(epoch!==this.epoch||bytes.length>2*1024*1024)return;this.bytes+=bytes.length;const text=bytes.toString('utf8');if(!/fields|options|choices|values|oneOf|answer_options/.test(text))return;const records=extractFields(text,{sourceUrl:response.url()});if(epoch!==this.epoch)return;let frameOrigin;try{frameOrigin=new URL(resource==='document'?response.url():response.frame().url()).origin;}catch{frameOrigin=new URL(this.documentUrl).origin;}for(const field of records)this.fields.set(frameOrigin+'|'+field.fieldId,{...field,frameOrigin});if(records.length)this.onSave?.(this.snapshot());}catch{}finally{clearTimeout(timer);}
 }
 enqueue(response,epoch){const task=this.capture(response,epoch);this.pending.add(task);void task.finally(()=>this.pending.delete(task));}
 async settle(){if(!this.pending.size)return;let timer;try{await Promise.race([Promise.allSettled([...this.pending]),new Promise(r=>{timer=setTimeout(r,2200);})]);}finally{clearTimeout(timer);}}
 enrich(page){const origin=new URL(page.url).origin;return {...page,fields:page.fields.map(field=>{const keys=[field.stable,field.name].filter(Boolean),matches=[...new Set(keys.flatMap(key=>[this.fields.get(origin+'|'+String(key)),/^\d+$/.test(key)?this.fields.get(origin+'|question_'+key):null]).filter(Boolean))];if(matches.length!==1)return field;const data=matches[0];return {...field,options:field.options?.length?field.options:data.options,networkOptions:data.options,optionSource:{kind:'network',fieldId:data.fieldId,sourceUrl:data.sourceUrl,capturedAt:data.capturedAt,cached:!!data.cached,version:createHash('sha256').update(JSON.stringify(data.options)).digest('hex').slice(0,16)}};})};}
 snapshot(){return {version:1,documentUrl:this.documentUrl,capturedAt:Date.now(),fields:[...this.fields.values()]};}
}
module.exports={extractFields,jsonLiterals,NetworkContext,sameApplication};

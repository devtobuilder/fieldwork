// Keep packets bounded and valid JSON instead of sending the entire portfolio/page.
const text=(v,n)=>String(v??'').slice(0,n);
function packet(profile,fields,posting,maxBytes=14000){
 const r=profile.resume||{},extra=text(profile.additional,2000);
 const facts={name:r.name,contact:r.contact,summary:text(r.summary,600),work_authorization:r.work_authorization,application_preferences:r.application_preferences,education:(r.education||[]).slice(0,8).map(({school,credential,degree,start,end,expected_graduation,graduated,actively_pursuing})=>({school,credential,degree,start,end,expected_graduation,graduated,actively_pursuing})),projects:(r.projects||[]).slice(0,3).map(p=>({name:text(p.name||p.title,100),description:text(p.detail||p.description,350),url:text(p.url||p.link,180)})),experience:(r.experience||[]).slice(0,10).map(({company,title,start,end,bullets})=>({company,title,start,end,bullets:(bullets||[]).slice(0,2).map(b=>text(b,200))})),skills:r.skills};
 const factText=JSON.stringify({facts,extra}).toLowerCase();
 const compact=fields.map(f=>{const all=f.options||[],ranked=all.filter(o=>{const s=String(o.label||'').trim().toLowerCase();return s.length>1&&(factText.includes(s)||/united states|decline|prefer not|not disclose/.test(s));});const chosen=[...new Map([...ranked,...all].map(o=>[o.value,o])).values()].slice(0,16);return {id:f.id,label:text(f.label,160),type:f.type,tag:f.tag,required:f.required,value:text(f.value,120),optionSource:f.optionSource?{kind:f.optionSource.kind,fieldId:f.optionSource.fieldId,sourceUrl:f.optionSource.sourceUrl,version:f.optionSource.version}:undefined,options:chosen.map(o=>({label:text(o.label,90),value:text(o.value,90)})),omittedOptions:Math.max(0,all.length-chosen.length)};});
 const data={profile:{resume:facts,additional:extra},fields:compact,posting:text(posting,1200),contextNotice:'Only relevant bounded profile sections and a field batch are included. Omitted or unknown facts/options must not be invented.'};
 const size=()=>Buffer.byteLength(JSON.stringify(data),'utf8');
 if(size()>maxBytes){data.posting='';facts.experience=facts.experience.map(({bullets,...rest})=>rest);facts.summary=text(facts.summary,240);}
 if(size()>maxBytes)facts.skills=undefined;
 if(size()>maxBytes){for(const f of data.fields){f.omittedOptions+=Math.max(0,f.options.length-6);f.options=f.options.slice(0,6);}}
 if(size()>maxBytes)throw Error('This field batch is too large for local context. Narrow the page section or resolve it manually.');
 return JSON.stringify(data);
}
function batches(fields,size=6){const out=[];for(let i=0;i<fields.length;i+=size)out.push(fields.slice(i,i+size));return out;}
module.exports={packet,batches};

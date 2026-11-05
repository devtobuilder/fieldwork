const clean=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function relatedOptions(field,options,value){
 const q=clean(field.label),v=clean(value);
 if(v==='decline'){const generic=options.filter(o=>/^(?:i )?(?:decline|declines|choose not|prefer not|do not wish)(?: to)? (?:self identify|answer|disclose|specify|respond|provide.*|identify.*)$/.test(clean(o.label)));if(generic.length)return [generic[0]];const optOut=options.filter(o=>/decline|prefer not|do not wish|choose not|not disclose|not specified/.test(clean(o.label)));if(optOut.length===1)return optOut;return [];}
 const geographic=require('./geography.cjs').geographicOptions(field,options,value);if(geographic.length)return geographic;
 if(require('./field-meaning.cjs').schoolQuestion(field.label)){const exact=options.filter(o=>clean(String(o.label).replace(/\([^)]*\)/g,'').split(',')[0])===v);if(exact.length)return exact;return options.filter(o=>/^(?:other(?: school| college| university| institution)?|not (?:listed|found)|school not listed|my school is not listed|other not listed|none of the above)$/.test(clean(o.label)));}
 if(/how (?:did|do).*hear|where.*(?:hear|find).*(?:job|role|position)/.test(q)){
  if(v==='other')return options.filter(o=>/^other(?: none of the above)?$/.test(clean(o.label)));
  if(/greenhouse|lever|ashby|job board|career (?:page|site)|company website/.test(v)){
   const direct=options.filter(o=>/job board|company (?:career|website)|employer website/.test(clean(o.label))&&!/college|university/.test(clean(o.label)));
   if(direct.length===1)return direct;
   return options.filter(o=>/^other(?: none of the above)?$/.test(clean(o.label)));
  }
 }
 if(/available.*start|start date|full time.*offer/.test(q)){
  if(/graduat/.test(v))return options.filter(o=>/graduat/.test(clean(o.label)));
  if(/immediat|asap|as soon as possible/.test(v))return options.filter(o=>/immediat|asap|as soon as possible/.test(clean(o.label)));
 }
 if(/graduat|expect.*complet/.test(q)){const desired=require('./option-date.cjs').optionDate(value);if(Number.isFinite(desired)){const ranked=options.map(o=>({o,d:require('./option-date.cjs').optionDate(o.label)})).filter(v=>Number.isFinite(v.d)).sort((a,b)=>Math.abs(a.d-desired)-Math.abs(b.d-desired));if(ranked.length&&(!ranked[1]||Math.abs(ranked[0].d-desired)<Math.abs(ranked[1].d-desired)))return [ranked[0].o];}}
 const {findBestChoice}=require('./resemblance.cjs');
 const best=findBestChoice(options,value,field);
 if(best)return [best];
 return [];
}
module.exports={relatedOptions};

const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const states=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(p=>p.split(':')).map(([code,name])=>[norm(name),code.toLowerCase()]));
const stateCode=v=>states[norm(v)]||norm(v);
function geographicOptions(field,options,value){const q=norm(field.label),v=norm(value),hint=field.contactHint||{};
 if(/^(?:state|province|state province|state or province)$/.test(q))return options.filter(o=>stateCode(o.label)===stateCode(value)||stateCode(o.value)===stateCode(value));
 if(/^(?:zip|postal)(?: code)?$/.test(q))return options.filter(o=>String(o.label).trim().match(/^[a-z0-9 -]+?(?=,|$)/i)?.[0].trim()===String(value).trim()||String(o.label).trim().startsWith(String(value).trim()+',')||new RegExp('^'+String(value).trim().replace(/[^a-z0-9]/gi,'')+'(?:\\b|-)','i').test(String(o.label).trim()));
 if(/^(?:city|location|location city|location \(city\)|current city|current location|county)$/.test(q)||/location|city|address/i.test(q)){
  const candidates=options.filter(o=>norm(String(o.label).split(',')[0]).replace(/ county$/,'')===v.replace(/ county$/,''));
  if(candidates.length===1)return candidates;
  const state=stateCode(hint.state);
  if(candidates.length>1&&state){
   const stateFiltered=candidates.filter(o=>String(o.label).split(',').some(p=>stateCode(p)===state));
   if(stateFiltered.length===1)return stateFiltered;
  }
  const {findBestChoice}=require('./resemblance.cjs');
  const best=findBestChoice(options,value,field,{contact:hint});
  if(best)return [best];
  return candidates;
 }
 return [];
}
module.exports={geographicOptions,stateCode};

function finalAction(page){
 const candidates=(page.navigation||[]).filter(a=>!a.disabled&&!a.href&&/^(?:submit(?: (?:your )?application)?|send application|apply(?: now)?|complete application|finish application)$/i.test(a.text.trim()));
 const preferred=candidates.filter(a=>/^submit|^send application/i.test(a.text));const chosen=preferred.length?preferred:candidates;
 if(chosen.length!==1)throw Error(chosen.length?'More than one final submission control is available. Review the form.':'No enabled final submission control was found. Finish the application first.');
 return chosen[0];
}
const receiptPattern=/(?:thank you for (?:applying|your application)|application (?:has been |was |successfully )?(?:received|submitted)|we have received your application)/i;
function receipt(page,before=''){
 const match=String(page.text||'').match(receiptPattern);if(!match||receiptPattern.test(before))return null;
 const reference=String(page.text).match(/(?:application|confirmation|receipt)\s*(?:reference|id|number|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,63})/i);
 return {url:page.url,text:match[0],...(reference?{employerApplicationId:reference[1]}:{})};
}
function portalReceipt(page,applicationUrl){
 let submitted,current;
 try{submitted=new URL(applicationUrl);current=new URL(page.url);}catch{return null;}
 if(current.origin!==submitted.origin)return null;
 const job=submitted.pathname.match(/^(.*)\/job\/(\d+)\/apply(?:\/|$)/i);
 if(!job||!current.pathname.startsWith(job[1]+'/'))return null;
 const text=String(page.text||'');
 if(!/\b(?:my|active job) applications\b/i.test(text))return null;
 const status=new RegExp('\\bStatus:\\s*(Under Consideration|Application Received|Submitted|In Progress|In Review)\\b(?:(?!\\bStatus:)[\\s\\S]){0,220}?\\b'+job[2]+'\\b[^\\n]{0,45}\\bApplied on\\s+\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}\\b','i').exec(text);
 return status?{url:page.url,text:'Application portal status: '+status[1],requisitionId:job[2]}:null;
}
function metadata(page){
 const match=String(page.title||'').match(/^(?:Job Application for\s+)?(.+?)\s+at\s+(.+?)(?:\s*[|–]\s*.+)?$/i);
 const role=page.structuredRole||match?.[1]||page.heading||'';
 return {company:page.structuredCompany||match?.[2]||'',publicTitle:role.replace(/\s*\([^)]*(?:20\d\d|summer|winter|spring|fall)[^)]*\)/gi,'').trim(),industry:/software|developer|engineer|technology|data|IT\b/i.test(role)?'Technology':'Other'};
}
module.exports={finalAction,receipt,portalReceipt,metadata};

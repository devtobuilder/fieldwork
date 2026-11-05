function matchedCode(message,{recipient,domains,startedAt}){
 const receivedAt=Number(message.internalDate),now=Date.now();
 if(!Number.isSafeInteger(startedAt)||startedAt<=0||!Number.isSafeInteger(receivedAt)||receivedAt<startedAt||receivedAt>now+60000)return null;
 const h=Object.fromEntries((message.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
 // Delivery can be delayed. The sender's Date also has to be within this request.
 const sentAt=Date.parse(h.date);
 // Mail Date headers usually omit milliseconds. A same-second Date still
 // requires Gmail's millisecond receipt time to be at or after the request.
 const sentCutoff=/:\d{2}\.\d+/.test(h.date)?startedAt:Math.floor(startedAt/1000)*1000;
 if(!Number.isFinite(sentAt)||sentAt<sentCutoff||sentAt>now+60000)return null;
 const addresses=s=>[...String(s||'').toLowerCase().matchAll(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9.-]+)/g)].map(m=>m[0]);
 if(!addresses(h.to).includes(recipient.toLowerCase()))return null;
 const from=addresses(h.from);if(from.length!==1)return null;const domain=from[0].split('@')[1];if(!domains.some(d=>domain===d||domain.endsWith('.'+d)))return null;
 // Require aligned DKIM rather than trusting the visible From address alone.
 const auth=String(h['authentication-results']||'').toLowerCase();const aligned=[...auth.matchAll(/dkim=pass[^;]*header\.(?:d|i)=@?([a-z0-9.-]+)/g)].some(m=>domain===m[1]||domain.endsWith('.'+m[1]));if(!aligned)return null;
 const decode=p=>{let value='';if(p.body?.data)value=Buffer.from(p.body.data,'base64url').toString('utf8');const plain=(p.parts||[]).find(p=>p.mimeType==='text/plain');for(const part of plain?[plain]:p.parts||[])value+='\n'+decode(part);return value;};
 const html=decode(message.payload||{}).replace(/<blockquote\b[\s\S]*$/i,'').replace(/<div\b[^>]*class=["'][^"']*\bgmail_quote[^"']*["'][\s\S]*$/i,'').replace(/\n(?:On .{0,200}wrote:|-----Original Message)[\s\S]*$/i,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|&#x0*a0;/gi,' ').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/&#x([a-f0-9]+);/gi,(_,n)=>parseInt(n,16)<=0x10ffff?String.fromCodePoint(parseInt(n,16)):'').replace(/&colon;/gi,':').replace(/&amp;/gi,'&');
 const expiry=html.match(/(?:expire[sd]?\s+(?:in|after)|valid for)\s*(\d{1,3})\s*minutes?/i);if(expiry&&Math.min(receivedAt,sentAt)+Number(expiry[1])*60000<now)return null;
 const body=(h.subject||'')+'\n'+html;const numeric=[...body.matchAll(/(?:verification|security|confirmation|one.time|sign.in|access|login)?\s*(?:code|passcode)\s*(?:is|:|-)?\s*(\d{4,8})\b/gi)].map(m=>m[1]);const alpha=[...body.matchAll(/(?:paste this code into the (?:security|verification) code field(?: on your application)?|(?:verification|security|confirmation|one[- ]time) (?:code|passcode))\s*(?:is|:)\s*([A-Za-z0-9]{6,8})\b/gi)].map(m=>m[1]).filter(t=>/\d/.test(t)||/[A-Z]/.test(t)&&/[a-z]/.test(t));const codes=numeric.length?numeric:alpha;const unique=[...new Set(codes)];return unique.length===1?unique[0]:null;
}
module.exports={matchedCode};

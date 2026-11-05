const {createHash,randomBytes}=require('node:crypto');
function safeUrl(value,fixture=false){const u=new URL(value);if(fixture&&u.protocol==='fieldwork-fixture:'&&u.hostname==='local')return u.href;if(u.username||u.password||!(u.protocol==='https:'||(fixture&&u.protocol==='http:'&&u.hostname==='127.0.0.1')))throw Error('Use HTTPS application URLs');if(/^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(u.hostname)&&!fixture)throw Error('Local network URLs are not supported');u.hash='';return u.href;}
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function arbitrate(visual,dom){if(!visual&&!dom)return {mode:'pause',reason:'No supported answer or target'};if(visual&&dom&&visual.value!==dom.value)return {mode:'pause',reason:'Visual and DOM specialists disagree'};return {mode:dom?'dom':'visual',proposal:dom||visual};}
function password(){return randomBytes(24).toString('base64url')+'!aA7';}
function ticket(job,snapshot){return {id:randomBytes(24).toString('hex'),jobId:job.id,hash:digest(snapshot),expires:Date.now()+120000};}
function consume(approval,job,snapshot){if(!approval||approval.jobId!==job.id||approval.expires<Date.now()||approval.hash!==digest(snapshot))throw Error('Application changed or approval expired. Review again.');return true;}
module.exports={safeUrl,digest,arbitrate,password,ticket,consume};

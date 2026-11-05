const path=require('node:path');
function uploadAllowed(request,capability,now=Date.now()){
 if(!capability||capability.expires<now||!['POST','PUT'].includes(request.method))return false;
 const url=new URL(request.url);
 const data=request.uploadData||[];
 const body=Buffer.concat(data.filter(p=>p.bytes).map(p=>Buffer.from(p.bytes)));
 const signedStorage=/(?:^|\.)s3[.-][a-z0-9.-]*amazonaws\.com$|(?:^|\.)s3\.amazonaws\.com$/i.test(url.hostname)&&/name="(?:policy|x-amz-signature)"/i.test(body.toString('latin1'))&&/name="key"/i.test(body.toString('latin1'));
 if(!signedStorage&&!/\/[^?]*(?:uploads?|attachments?|files?)(?:[\/._-]|$)/i.test(url.pathname)||/submit|application\/create|apply\/complete/i.test(url.pathname))return false;
 return data.some(part=>part.file&&path.resolve(part.file)===path.resolve(capability.file)||part.bytes&&Buffer.from(part.bytes).includes(Buffer.from(path.basename(capability.file))));
}
function requestSummary(request){const u=new URL(request.url);return {method:request.method,host:u.hostname,path:u.pathname,resourceType:request.resourceType,time:new Date().toISOString()};}
module.exports={uploadAllowed,requestSummary};


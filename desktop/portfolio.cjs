const {spawn}=require('node:child_process');const path=require('node:path'),fs=require('node:fs');
function parseOutput(output){try{return JSON.parse(output.trim());}catch{return {};}}
function invoke(project,command,input){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(project,'scripts/jobs.mjs'),command],{cwd:project,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.on('data',b=>{out+=b;if(out.length>100000)p.kill();});p.stderr.resume();p.on('error',()=>reject(Error('Portfolio command could not start')));p.on('close',code=>{const parsed=parseOutput(out);if(code&&!parsed.id){const error=Error('Portfolio update failed. Retry sync, not submission.');error.output=out;reject(error);}else resolve(out);});p.stdin.end(input?JSON.stringify(input):'');});}
function findRecord(project,job){const file=process.env.JOBS_PRIVATE_FILE||path.resolve(project,'../../work/application-tracker/applications.json');try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return data.applications.find(a=>String(a.notes||'').includes('Fieldwork job: '+job.id));}catch{return null;}}
async function sync(project,job,run=invoke){
 if(job.status!=='confirmed')throw Error('Only confirmed submissions may enter the tracker');if(!job.publicTitle?.trim()||!job.industry?.trim()||!job.company?.trim())throw Error('Add company, public title, and industry before publishing');
 if(job.trackerAttempted){const record=job.trackerId?{id:job.trackerId}:findRecord(project,job);if(!record)throw Error('Reconcile the private tracker record before adding again');const output=await run(project,'sync');return {synced:/Live site confirmed|"synced"\s*:\s*true/.test(output),trackerId:record.id};}
 const appliedOn=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(job.confirmedAt));const output=await run(project,'add',{company:job.company,publicTitle:job.publicTitle,industry:job.industry,role:job.role||job.title,url:job.applicationUrl||job.currentUrl||job.url,appliedOn,notes:'Recorded after confirmed employer receipt. Fieldwork job: '+job.id});const result=parseOutput(output);return {synced:result.synced===true,trackerId:result.id};
}
async function updateStatus(project,job,run=invoke,find=findRecord){
 const change=job.statusUpdate;if(job.status!=='confirmed'||!change?.id||!['followed-up','interview','offered','accepted','rejected','auto-rejected','no-response','withdrawn'].includes(change.stage))throw Error('Invalid tracker status update');
 const record=find(project,job),id=job.trackerId||record?.id;if(!id)throw Error('The submitted application needs its tracker ID before updating status');
 if(change.attempted&&!record)throw Error('Reconcile the private tracker before retrying this status update');const marker='Fieldwork status: '+change.id;
 if(record?.events?.some(event=>String(event.notes||'').includes(marker))){const output=await run(project,'sync');return {synced:/Live site confirmed|"synced"\s*:\s*true/.test(output),trackerId:id};}
 const output=await run(project,'update',{id,stage:change.stage,notes:marker});const result=parseOutput(output);return {synced:result.synced===true,trackerId:result.id||id};
}
module.exports={sync,parseOutput,updateStatus};

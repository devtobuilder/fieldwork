// Uses Git Credential Manager in memory. Never prints or stores credentials.
const {execFileSync,spawnSync}=require('node:child_process');
const fs=require('node:fs');
async function main(){
 const env={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'};
 const result=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env,windowsHide:true});
 if(result.status!==0)throw Error('GitHub credentials unavailable through Git Credential Manager');
 const credential=Object.fromEntries(result.stdout.trim().split('\n').map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
 if(!credential.password)throw Error('GitHub credential unavailable');
 const headers={Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function request(endpoint,options={}){const r=await fetch('https://api.github.com'+endpoint,{...options,headers:{...headers,'Content-Type':'application/json'}});if(!r.ok){const e=Error('GitHub request failed: '+r.status);e.status=r.status;throw e;}return r.json();}
 const user=await request('/user');console.log('Authenticated GitHub account: '+user.login);
 const repoName='fieldwork-desktop';let repo;
 try{repo=await request('/repos/'+user.login+'/'+repoName);}catch(e){if(e.status!==404)throw e;repo=await request('/user/repos',{method:'POST',body:JSON.stringify({name:repoName,private:true,description:'Local desktop application assistant with embedded browser, local AI, and human review.'})});}
 if(!repo.private)throw Error('Refusing to publish private project details into a public repository');
 if(!fs.existsSync('.git'))execFileSync('git',['init','-b','main'],{stdio:'pipe'});
 const remote=spawnSync('git',['remote','get-url','origin'],{encoding:'utf8'});if(remote.status!==0)execFileSync('git',['remote','add','origin',repo.clone_url]);else if(remote.stdout.trim()!==repo.clone_url)throw Error('Existing origin differs; not changing it automatically');
 console.log('Private repository: '+repo.html_url);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

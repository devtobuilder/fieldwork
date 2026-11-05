import {existsSync,mkdirSync,realpathSync,renameSync,rmdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {extractFile} from '@electron/asar';

function isInside(root,target){
 const relative=path.relative(root,target);
 return relative!==''&&relative!=='..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative);
}

function packageVersion(directory){
 if(!existsSync(path.join(directory,'Fieldwork.exe')))throw Error(`Fieldwork.exe is missing from ${directory}`);
 const manifest=JSON.parse(extractFile(path.join(directory,'resources','app.asar'),'package.json'));
 if(manifest.name!=='fieldwork-desktop'||!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version))throw Error('Invalid Fieldwork package manifest');
 return manifest.version;
}

const input=process.argv[2];
if(!input)throw Error('Pass the tested package folder to npm run release -- "<package folder>"');
const root=realpathSync('release');
const incoming=realpathSync(input);
const current=path.join(root,'current');
if(!isInside(root,incoming)||incoming===current||isInside(current,incoming)||isInside(incoming,current))throw Error('Choose a package under release, outside the current folder');
const incomingVersion=packageVersion(incoming);
const lock=path.join(root,'.promotion-lock');
mkdirSync(lock);
try{
 if(existsSync(current)&&realpathSync(current)!==current)throw Error('Current release must be a real folder inside release');
 const running=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-Process | Where-Object ProcessName -eq 'Fieldwork' | ForEach-Object { $_.Path }"],{encoding:'utf8',windowsHide:true});
 if(running.split(/\r?\n/).some(file=>file&&(isInside(current,file)||isInside(incoming,file))))throw Error('Close Fieldwork before promoting this release');
 const versions=path.join(root,'versions');
 mkdirSync(versions,{recursive:true});
 if(realpathSync(versions)!==versions)throw Error('Versions must be a real folder inside release');
 let archived;
 if(existsSync(current)){
  archived=path.join(versions,`${packageVersion(current)}-${Date.now()}`);
  if(existsSync(archived))throw Error('The archive destination already exists');
  renameSync(current,archived);
 }
 try{renameSync(incoming,current);}
 catch(error){
  if(archived){
   try{renameSync(archived,current);}
   catch(rollback){throw new AggregateError([error,rollback],`Promotion and rollback failed. Prior build is at ${archived}`);}
  }
  throw error;
 }
 console.log(`Fieldwork ${incomingVersion} is now at ${path.join(current,'Fieldwork.exe')}`);
 if(archived)console.log(`Previous build archived at ${archived}`);
}finally{rmdirSync(lock);}

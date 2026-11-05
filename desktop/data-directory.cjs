const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
function migrateDataDirectory(home,appData){
 const target=path.join(home,'Documents','FieldworkDesktop'),database=path.join(target,'fieldwork-v2.db');
 if(fs.existsSync(database))return target;
 const candidates=[path.join(appData,'FieldworkDesktop'),path.join(home,'AppData','Local','Packages','OpenAI.Codex_2p2nqsd0c76g0','LocalCache','Roaming','FieldworkDesktop')];
 const sources=[];for(const directory of new Set(candidates)){const file=path.join(directory,'fieldwork-v2.db');if(!fs.existsSync(file))continue;let db;try{db=new DatabaseSync(file,{readOnly:true});if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')continue;const jobs=db.prepare("SELECT count(*) AS count FROM records WHERE kind='job'").get().count;sources.push({directory,file,jobs});}catch{}finally{db?.close();}}
 sources.sort((a,b)=>b.jobs-a.jobs);const source=sources[0];fs.mkdirSync(target,{recursive:true});
 if(source){fs.cpSync(source.directory,target,{recursive:true,filter:file=>!['fieldwork-v2.db','fieldwork-v2.db-wal','fieldwork-v2.db-shm'].some(name=>file===path.join(source.directory,name))});const db=new DatabaseSync(source.file,{readOnly:true});try{db.prepare('VACUUM INTO ?').run(database);}finally{db.close();}fs.writeFileSync(path.join(target,'migration.json'),JSON.stringify({version:1,source:source.directory,applications:source.jobs,at:new Date().toISOString()},null,2));}
 return target;
}
module.exports={migrateDataDirectory};

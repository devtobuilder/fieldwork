const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
function recover(userData,backupDirectory){
 const target=path.join(userData,'fieldwork-v2.db');if(fs.existsSync(target))return {existing:true};
 const {Store}=require('./store.cjs'),store=new Store(userData,'fieldwork-v2.db'),rows=new Map(),quarantined=[];
 for(const file of ['base-records-snapshot.json','records-snapshot.json']){const source=path.join(backupDirectory,file);if(!fs.existsSync(source))continue;for(const row of JSON.parse(fs.readFileSync(source,'utf8'))){try{const value=JSON.parse(row.payload);rows.set(row.kind+'\0'+row.id,{...row,value});}catch{quarantined.push({kind:row.kind,id:row.id,backup:source});}}}
 for(const row of rows.values())store.put(row.kind,row.id,row.value);
 for(const row of quarantined)store.put('recovery',row.id,row);
 store.put('recovery','migration',{backupDirectory,at:new Date().toISOString(),restored:rows.size,quarantined:quarantined.length});store.close();
 const db=new DatabaseSync(target,{readOnly:true});const integrity=db.prepare('PRAGMA quick_check').get().quick_check;db.close();if(integrity!=='ok')throw Error('Recovered database did not pass verification');return {restored:rows.size,quarantined:quarantined.length,integrity};
}
module.exports={recover};

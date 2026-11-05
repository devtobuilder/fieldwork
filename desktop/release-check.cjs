const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
async function run({app,safeStorage}){
 await app.whenReady();const report={packaged:app.isPackaged,version:app.getVersion(),dataDirectory:app.getPath('userData')};let db;
 try{
  report.sdkImport=typeof require('@midscene/web/playwright/agent').PlaywrightAgent==='function';
  db=new DatabaseSync(path.join(report.dataDirectory,'fieldwork-v2.db'),{readOnly:true});
  report.databaseQuickCheck=db.prepare('PRAGMA quick_check').get().quick_check==='ok';
  report.applicationRecords=db.prepare("SELECT count(*) AS n FROM records WHERE kind='job'").get().n;
  const settings=JSON.parse(db.prepare("SELECT payload FROM records WHERE kind='settings' AND id='main'").get().payload);
  report.resumeSourcePresent=fs.existsSync(settings.resumeSource);report.compilerPresent=fs.existsSync(settings.compiler);
  report.encryptionAvailable=safeStorage.isEncryptionAvailable();
  const state=db.prepare("SELECT payload FROM records WHERE kind='browser-state' LIMIT 1").get();
  report.browserStateDecryptable=state?!!JSON.parse(safeStorage.decryptString(Buffer.from(JSON.parse(state.payload).encrypted,'base64'))):true;
  report.ok=report.sdkImport&&report.databaseQuickCheck&&report.resumeSourcePresent&&report.compilerPresent&&report.encryptionAvailable&&report.browserStateDecryptable;
 }catch(e){report.ok=false;report.error=e.message;}finally{db?.close();}
 const target=process.env.FIELDWORK_RELEASE_REPORT||path.join(app.getPath('userData'),'diagnostics/release-check.json');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.ok?0:1);
}
module.exports={run};

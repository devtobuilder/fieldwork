// Read-only acceptance baseline: follow Apply only; never fill/send applicant data.
const {ExternalBrowser}=require('../desktop/external-browser.cjs'),actions=require('../desktop/page-actions.cjs'),{navigationPoint}=require('../desktop/visual.cjs'),{entryAction}=require('../desktop/navigation.cjs'),path=require('node:path'),fs=require('node:fs');
(async()=>{const browser=new ExternalBrowser({directory:path.resolve('.runtime/oracle-baseline/check-browser'),headless:true});try{
 const session=await browser.open('oracle-baseline','https://fa-exhh-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/StaplesInc/job/77076');let before,action;
 for(let i=0;i<80;i++){before=await actions.inspect(session);action=entryAction(before)?.action;if(action)break;await session.page.waitForTimeout(250);}if(!action)throw Error('No application entry became available');
 const started=Date.now(),point=await navigationPoint(session,action,{visionModel:process.env.FIELDWORK_VISION_MODEL||'qwen3-vl:4b-instruct'},new AbortController().signal);await actions.click(session,point.x,point.y,action.text);let after;
 for(let i=0;i<100;i++){await session.page.waitForTimeout(150);after=await actions.inspect(session);if(after.fields.some(f=>f.type==='email'))break;}
 const passed=after.fields.some(f=>f.type==='email'),report={passed,visualNavigation:point.source,elapsedSeconds:Math.round((Date.now()-started)/1000),advanced:session.page.url()!==before.url,fields:after.fields.map(f=>f.label)};fs.writeFileSync('.runtime/oracle-baseline-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});

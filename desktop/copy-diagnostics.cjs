const {app,clipboard,ClipboardItem,nativeImage,shell}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');

const clean=(value='')=>String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').replace(/https?:\/\/[^\s<>]+/gi,url=>pagePath(url)).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]').replace(/\s+/g,' ').trim().slice(0,650).toWellFormed();
function pagePath(value){
 try{const url=new URL(value);return url.origin+url.pathname;}
 catch{return '';}
}

async function captureStep(view){
 if(!view?.external||view.page.isClosed())return null;
 const url=view.frame.url();
 const heading=await view.frame.evaluate(()=>[...document.querySelectorAll('h1,h2,[role=heading]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').slice(0,3).map(e=>e.innerText).join(' / '));
 const secretInputs='input[type=password],input[autocomplete~="current-password"],input[autocomplete~="new-password"],input[autocomplete~="one-time-code"],input[name*=passcode i],input[id*=passcode i],input[name*=verificationCode i],input[id*=verificationCode i],input[name*=verification_code i],input[id*=verification_code i]';
 const codeFields=view.frame.locator('input').and(view.frame.getByLabel(/verification code|security code|passcode|^digit \d+/i));
 const png=await view.page.screenshot({scale:'css',timeout:2500,mask:[codeFields],maskColor:'#f5f5f1',style:`${secretInputs}{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important} #__fieldwork_cursor{visibility:hidden!important}`});
 if(view.frame.url()!==url)return null;
 return {url:pagePath(url),heading:clean(heading),png};
}

async function copyDiagnostics({job,error,step,version}){
 const recent=(job?.actionTrace||[]).slice(-10).map(item=>[item.action,item.label||item.intent].filter(Boolean).map(clean).join(' · ')).filter(Boolean);
 const question=job?.pages?.at(-1)?.missing?.[0]?.label||job?.actionTrace?.findLast(item=>item.label)?.label;
 const lines=[`Fieldwork Desktop ${version}`,job?.status&&`Status: ${job.status}`,`Message: ${clean(error||job?.message||'No error message')}`,job?.preparationStep&&`Step: ${clean(job.preparationStep)}`,question&&`Question: ${clean(question)}`,step?.heading&&`Page: ${step.heading}`,`Location: ${step?.url||pagePath(job?.currentUrl||job?.url)}`,recent.length&&`Recent actions: ${recent.join(' → ')}`].filter(Boolean).map(clean);
 const text=lines.join('\n');
 const copyText=async()=>{const fallback=text+'\nBrowser image unavailable.';await clipboard.writeText(fallback);if(await clipboard.readText()!==fallback)throw Error('Windows did not retain the copied diagnostics text');return {image:false,copied:true};};
 if(!step?.png)return copyText();

 let png;
 try{png=await composeReport(step.png,lines);}
 catch{return copyText();}
 const file=diagnosticImagePath();
 try{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,png);}
 catch{return copyText();}
 const image=nativeImage.createFromBuffer(png);
 try{
  await clipboard.write([new ClipboardItem({'image/png':new Blob([png],{type:'image/png'})})]);
  const readback=await readClipboardImage();
  return {image:true,copied:!readback.isEmpty()&&readback.toBitmap().equals(image.toBitmap())};
 }catch{return {image:true,copied:false};}
}

async function composeReport(screenshot,lines){
 // Keep the context readable even in apps that paste only the image format.
 const {width,height}=await sharp(screenshot).metadata();
 const bannerWidth=Math.max(width,640);
 const columns=Math.floor((bannerWidth-36)/8.5);
 const wrapped=lines.flatMap(line=>line.match(new RegExp(`.{1,${columns}}`,'gu'))||[]);
 const bannerHeight=wrapped.length*21+30;
 const xml=value=>value.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
 const banner=Buffer.from(`<svg width="${bannerWidth}" height="${bannerHeight}"><rect width="100%" height="100%" fill="#f5f5f1"/>${wrapped.map((line,i)=>`<text x="18" y="${24+i*21}" font-family="monospace" font-size="14" fill="#20302a">${xml(line)}</text>`).join('')}</svg>`);
 return sharp({create:{width:bannerWidth,height:bannerHeight+height,channels:3,background:'#f5f5f1'}}).composite([{input:banner,top:0,left:0},{input:screenshot,top:bannerHeight,left:0}]).png().toBuffer();
}
async function readClipboardImage(){
 const item=(await clipboard.read()).find(entry=>entry.types.includes('image/png'));
 if(!item)return nativeImage.createEmpty();
 const image=await item.getType('image/png');
 return nativeImage.createFromBuffer(Buffer.from(await image.arrayBuffer()));
}
function diagnosticImagePath(){return path.join(app.getPath('userData'),'diagnostics','latest-report.png');}
async function showDiagnosticImage(){const file=diagnosticImagePath();await fs.access(file);shell.showItemInFolder(file);}
module.exports={captureStep,copyDiagnostics,showDiagnosticImage,readClipboardImage};

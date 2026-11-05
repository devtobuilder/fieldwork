const {capture}=require('./visual.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function pageImages(view,page,signal){
 const sharp=require('sharp'),wc=view.webContents,tiles=[];
 if(view.external&&view.frame===view.page.mainFrame()){
  signal?.throwIfAborted();await view.frame.evaluate(()=>document.getElementById('__fieldwork_cursor')?.remove());const data=await view.page.screenshot({type:'png',fullPage:true,scale:'css',timeout:10000});signal?.throwIfAborted();const meta=await sharp(data).metadata(),height=Math.min(meta.height,16000),output=[];
  for(let y=0;y<height;y+=Math.ceil(height/3)){output.push((await sharp(data).extract({left:0,top:y,width:meta.width,height:Math.min(Math.ceil(height/3),height-y)}).resize({width:960,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer()).toString('base64'));}
  return output;
 }
 // Overlapping viewport captures cover the actual rendered page, including portals.
 const height=Math.min(page.height,16000),step=Math.max(200,Math.floor(page.viewport.height*.85));
 try{for(let top=0;top<height;top+=step){signal?.throwIfAborted();await wc.executeJavaScript('scrollTo(0,'+top+');void 0');await wait(70);const actual=await wc.executeJavaScript('scrollY');const data=Buffer.from((await capture(view)).split(',')[1],'base64');const size=await sharp(data).metadata();tiles.push({input:data,top:Math.round(actual),left:0,width:size.width,height:size.height});if(actual+page.viewport.height>=height)break;}
 }finally{await wc.executeJavaScript('scrollTo(0,'+page.scrollY+');void 0');}
 if(!tiles.length)throw Error('No visual page context captured');
 const width=tiles[0].width,total=Math.max(...tiles.map(t=>t.top+t.height));
 const full=await sharp({create:{width,height:total,channels:3,background:'#ffffff'}}).composite(tiles.map(({input,top,left})=>({input,top,left}))).png().toBuffer();
 // At most three readable strips, rather than shrinking a long page into one illegible thumbnail.
 const output=[];for(let y=0;y<total;y+=Math.ceil(total/3)){const h=Math.min(Math.ceil(total/3),total-y);output.push((await sharp(full).extract({left:0,top:y,width,height:h}).resize({width:960,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer()).toString('base64'));}
 return output;
}
module.exports={pageImages};

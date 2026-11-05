const actions=require('./page-actions.cjs'),{pageState}=require('./page-state.cjs');
const shape=p=>JSON.stringify({kind:pageState(p).kind,heading:p.heading,fields:p.fields.map(f=>[f.label,f.type]),navigation:p.navigation.filter(n=>!n.disabled&&/^(?:apply(?: now)?|next(?: .*)?|continue(?: .*)?|verify(?: .*)?|create.*account|register|sign in|log in|agree|accept(?: .*)?|submit(?: .*)?|save.*continue|finish(?: .*)?|cancel)$/i.test(n.text.trim())).map(n=>n.text.toLowerCase().trim())});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function navigateStep({view,action,page,settings,signal,fixture=false,verificationRequest=false,beforeClick,progress=()=>{}}){
 if(view.external&&!fixture)return require('./evidence-navigation.cjs').navigateEvidence({view,action,page,signal,verificationRequest,beforeClick});
 const prior=shape(page);view.followPopupUntil=Date.now()+15000;progress('Visually confirming '+action.text+' before continuing');
 const changed=async()=>{const next=await actions.inspect(view).catch(()=>null);return next&&shape(next)!==prior&&pageState(next).kind!=='loading'?next:null;};
 const alreadyChanged=await changed();if(alreadyChanged)return {page:alreadyChanged,recovered:true};
 let point;try{point=fixture?await view.webContents.executeJavaScript(`(()=>{const e=document.querySelector('[data-fieldwork-nav="${action.id}"]');if(!e)throw Error('Navigation changed');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`):await require('./visual.cjs').navigationPoint(view,action,settings,signal);}catch(error){const next=await changed();if(next)return {page:next,recovered:true};throw error;}
 const changedPage=await changed();if(changedPage)return {page:changedPage,recovered:true};
 signal?.throwIfAborted();beforeClick?.();
 await actions.click(view,point.x,point.y,action.text);if(verificationRequest)return {page:await actions.inspect(view),requestIssued:true};let last='',stable=0;
 for(let i=0;i<160;i++){signal?.throwIfAborted();await wait(150);const next=await changed();if(!next){stable=0;continue;}const current=shape(next);stable=current===last?stable+1:0;last=current;if(stable>=2)return {page:next};}
 throw Error('The rendered application did not advance after '+action.text+'. Check the visible validation or access requirement.');
}
module.exports={navigateStep,shape};

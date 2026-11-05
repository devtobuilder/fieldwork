const {setTimeout:delay}=require('node:timers/promises');
const navigationInterrupted=error=>/execution context was destroyed|cannot find context with specified id|inspected target navigated/i.test(typeof error==='string'?error:error?.message||'');

async function retryNavigationRead(read,signal){
 const deadline=Date.now()+10000;
 for(;;){
  signal?.throwIfAborted();
  try{const result=await read();signal?.throwIfAborted();return result;}
  catch(error){
   if(!navigationInterrupted(error))throw error;
   if(Date.now()>=deadline)throw Object.assign(Error('The browser is still changing pages. Resume once the new step is visible.'),{code:'STEP_NOT_READY'});
   await delay(125,undefined,{signal});
  }
 }
}
module.exports={navigationInterrupted,retryNavigationRead};

const {createHash}=require('node:crypto');
const prepared=new Map();
async function prepareVisualModel(model,request=fetch){
 if(prepared.has(model))return prepared.get(model);
 const work=(async()=>{
  const call=async(path,body)=>{const response=await request('http://127.0.0.1:11434/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Local model configuration failed');return data;};
  const info=await call('show',{model});if(info.remote_host||info.remote_model||/:cloud$/i.test(model))throw Error('Application inference must use a locally installed model');
  const context=Number(String(info.parameters||'').match(/\bnum_ctx\s+(\d+)/)?.[1]||0);if(context>=16384)return model;
  const alias='fieldwork-vision-'+createHash('sha256').update(model).digest('hex').slice(0,8)+':16k';
  await call('create',{model:alias,from:model,parameters:{num_ctx:16384,num_predict:2048},stream:false});return alias;
 })();prepared.set(model,work);try{return await work;}catch(error){prepared.delete(model);throw error;}
}
module.exports={prepareVisualModel};

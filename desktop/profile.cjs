function saveProfile(store,text,defaults={}){
 if(typeof text!=='string'||text.length>30000)throw Error('Candidate information must be text under 30,000 characters');
 const current={...defaults,...store.get('settings','main')};
 store.put('settings','main',{...current,additional:text,profileUpdatedAt:new Date().toISOString()});
 const saved=store.get('settings','main');
 if(saved?.additional!==text)throw Error('Candidate information could not be verified after saving');
 return {additional:saved.additional,savedAt:saved.profileUpdatedAt};
}
module.exports={saveProfile};

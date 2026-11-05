const {verify}=require('./evidence-domain.cjs');
function validateAnswers(inventory,answers){
 if(!inventory.length)throw Error('No current question evidence is available for final review');
 for(const q of inventory){
  const expected=q.controls.map(c=>{const a=answers.findLast(a=>a.id===c.id||(a.domain===c.domain&&(a.questionId===q.questionId||a.label===c.label||(c.domain==='file'&&/resume|cv/i.test(a.label)&&/resume|cv/i.test(c.label)))));if(!a||a.state!=='verified')throw Error('Unassessed question remains: '+c.label);return {controlId:c.id,value:a.expected??a.value,displayValue:a.value,optionIds:a.optionIds,empty:a.empty};});
  if(!verify(q,{answers:expected}))throw Error('A committed answer changed or is invalid: '+q.label);
 }
 return true;
}
function reviewFields(inventory){return inventory.flatMap(q=>q.controls.map(c=>({id:c.id,label:c.label,value:c.committed.value,proven:c.committed.proven,invalid:c.invalid,type:c.type,domain:c.domain,choices:c.choices.map(o=>({id:o.id,label:o.label,value:o.value}))})));}
module.exports={validateAnswers,reviewFields};

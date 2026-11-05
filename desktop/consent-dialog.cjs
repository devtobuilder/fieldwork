async function acceptConsentDialog(view,field,settings,signal){
 if(!/I authorize the assistant to accept application terms and privacy acknowledgments automatically/i.test(settings.additional||''))return false;
 if(!/terms|privacy|agree|acknowledge|accept/i.test(field.label+' '+(field.context||'')))return false;
 let candidate;for(let attempt=0;attempt<10;attempt++){signal?.throwIfAborted();candidate=await view.frame.evaluate(()=>{
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const roots=[...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog,[class*=modal],[class*=dialog]')].filter(visible).filter(e=>/terms|privacy|conditions/i.test(e.innerText));
  const buttons=[...new Set(roots.flatMap(e=>[...e.querySelectorAll('button,[role=button],a')]))].filter(visible).filter(e=>/^(?:i )?(?:agree|accept|accept and continue)$/i.test(e.innerText.trim()));
  if(buttons.length!==1)return null;const e=buttons[0],id='consent-'+Date.now();e.setAttribute('data-fieldwork-nav',id);return {id,text:e.innerText.trim()};
 });if(candidate)break;await new Promise(r=>setTimeout(r,100));}if(!candidate)return false;
 signal?.throwIfAborted();const point=settings.visionModel?await require('./visual.cjs').navigationPoint(view,candidate,settings,signal):await view.frame.locator('[data-fieldwork-nav="'+candidate.id+'"]').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 await require('./page-actions.cjs').click(view,point.x,point.y,candidate.text);return true;
}
module.exports={acceptConsentDialog};

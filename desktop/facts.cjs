// Personal preferences and attestations cannot be inferred from work history.
function preferenceBlock(label,profile){const l=String(label).toLowerCase(),extra=String(profile.additional||'').toLowerCase(),p=profile.resume?.application_preferences||{};
 if(/signature|certify|attest|agree.*terms|accept.*terms/.test(l))return 'Personal attestation needs your explicit review';
 if(/work arrangement|work preference|preferred.*(?:work|location)|remote.*hybrid/.test(l)&&!p.work_arrangement&&!/prefer.{0,60}(remote|hybrid|on.site)|work arrangement/.test(extra))return 'No explicit work-arrangement preference saved';
 if(/salary|compensation|pay expectation/.test(l)&&!p.salary&&!/salary|compensation|pay expectation/.test(extra))return 'No salary expectation saved';
 if(/start date|available.*start|notice period/.test(l)&&!p.start_date&&!/start date|available.*start|notice period/.test(extra))return 'No availability fact saved';
 return null;}
module.exports={preferenceBlock};

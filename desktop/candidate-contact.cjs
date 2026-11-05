function candidateContact(profile){
 const contact={...(profile.resume?.contact||{})},notes=String(profile.additional||'');
 const take=(key,regex)=>{const match=notes.match(regex);if(match)contact[key]=match[1].trim().replace(/\.$/,'');};
 take('street',/my street address is ([^\n]+?)(?=\.\s+my |\n|$)/i);
 take('city',/my city is ([^\n.]+)/i);take('state',/my state is ([^\n.]+)/i);
 take('postal_code',/my (?:zip|postal) code is ([a-z0-9 -]+)/i);take('country',/my country is ([^\n.]+)/i);
 take('county',/my county is ([^\n.,]+)/i);
 contact.state=String(contact.state||'').replace(/\s*\([A-Z]{2}\)\s*$/,'');
 return contact;
}
module.exports={candidateContact};

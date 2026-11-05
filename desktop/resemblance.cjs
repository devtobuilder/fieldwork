const norm = v => String(v ?? '').toLowerCase().replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const { stateCode } = require('./geography.cjs');
const { relatedOptions } = require('./option-meaning.cjs');

function tokenize(text) {
 const normalized = norm(text);
 if (!normalized) return new Set();
 return new Set(normalized.split(' ').filter(w => w.length >= 2));
}

function getCandidateContact(contextOrProfile) {
 if (!contextOrProfile) return {};
 if (contextOrProfile.contact) return contextOrProfile.contact;
 if (contextOrProfile.resume?.contact) {
  try {
   return require('./candidate-contact.cjs').candidateContact(contextOrProfile);
  } catch {
   return contextOrProfile.resume.contact;
  }
 }
 if (contextOrProfile.profile) {
  try {
   return require('./candidate-contact.cjs').candidateContact(contextOrProfile.profile);
  } catch {
   return contextOrProfile.profile?.resume?.contact || {};
  }
 }
 if (contextOrProfile.bundle?.candidateContact) return contextOrProfile.bundle.candidateContact;
 return {};
}

function getActiveEducation(profile) {
 const r = profile?.resume || {};
 const eduList = Array.isArray(r.education) ? r.education : [];
 return eduList.find(e => e.actively_pursuing || /present|current/i.test(String(e.end))) || eduList[0] || null;
}

function isUsCitizen(profile) {
 const r = profile?.resume || {};
 const extra = String(profile?.additional || '');
 const c = norm(r.work_authorization?.citizenship);
 return /^(?:united states(?: of america)?|u s|u s a|us|usa)$/.test(c) || /\bi am (?:a )?(?:u\.?s\.?|united states) citizen\b/i.test(extra);
}

// ============================================================================
// Choice Matching Functions (Dropdowns, Radios, Comboboxes)
// ============================================================================

function matchGeographicChoice(choices, value, control, context) {
 const contact = getCandidateContact(context);
 let valCity = '', valState = '';
 if (typeof value === 'string') {
  const vParts = value.split(',').map(s => s.trim());
  if (vParts[0]) valCity = norm(vParts[0]);
  if (vParts[1]) valState = norm(vParts[1]);
 }
 const cCity = norm(contact.city || valCity || '');
 const cState = norm(contact.state || valState || '');
 const cStateCode = cState ? stateCode(cState) : '';
 const cCountry = norm(contact.country || 'united states');
 const cZip = norm(contact.postal_code || '');
 const cCounty = norm(contact.county || '');

 if (!cCity && !cState && !cZip) return null;

 const scored = [];
 for (const o of choices) {
  const oLabel = norm(o.label);
  const oVal = norm(o.value);
  const parts = String(o.label).split(/[,;|-]/).map(norm).filter(Boolean);
  const firstPart = parts[0] || oLabel;
  let score = 0;

  // City matching
  if (cCity) {
   if (firstPart === cCity || oVal === cCity) score += 20;
   else if (firstPart.startsWith(cCity + ' ') || firstPart.endsWith(' ' + cCity)) score += 14;
   else if (parts.includes(cCity)) score += 12;
   else if (new RegExp('\\b' + cCity + '\\b', 'i').test(oLabel)) score += 10;
  }

  // State matching
  if (cState || cStateCode) {
   const hasState = (cState && new RegExp('\\b' + cState + '\\b', 'i').test(oLabel)) ||
                    (cStateCode && new RegExp('\\b' + cStateCode + '\\b', 'i').test(oLabel));
   if (hasState) score += 10;
   else if (parts.length > 1) {
    const foreignState = parts.some(p => {
     const code = stateCode(p);
     return code && code.length === 2 && code !== cStateCode;
    });
    if (foreignState) score -= 30;
   }
  }

  // Country matching
  if (cCountry) {
   const isUS = /^(?:us|usa|united states(?: of america)?)$/.test(cCountry);
   if (isUS) {
    if (/\b(?:us|usa|united states(?: of america)?)\b/.test(oLabel)) score += 5;
    if (/\b(?:united kingdom|england|great britain|canada|australia|germany|france|india)\b/.test(oLabel)) score -= 40;
   } else {
    if (new RegExp('\\b' + cCountry + '\\b').test(oLabel)) score += 5;
   }
  }

  // ZIP / Postal matching
  if (cZip && new RegExp('\\b' + cZip + '\\b').test(oLabel)) score += 8;

  // County matching
  if (cCounty && new RegExp('\\b' + cCounty + '\\b').test(oLabel)) score += 5;

  if (score > 0) scored.push({ option: o, score });
 }

 if (!scored.length) return null;
 scored.sort((a, b) => b.score - a.score);
 if (scored.length === 1 || scored[0].score > scored[1].score) return scored[0].option;

 if (cCity && (cState || cStateCode)) {
  const top0 = scored[0], top1 = scored[1];
  const has0 = new RegExp('\\b' + cCity + '\\b', 'i').test(top0.option.label) &&
               ((cState && new RegExp('\\b' + cState + '\\b', 'i').test(top0.option.label)) || (cStateCode && new RegExp('\\b' + cStateCode + '\\b', 'i').test(top0.option.label)));
  const has1 = new RegExp('\\b' + cCity + '\\b', 'i').test(top1.option.label) &&
               ((cState && new RegExp('\\b' + cState + '\\b', 'i').test(top1.option.label)) || (cStateCode && new RegExp('\\b' + cStateCode + '\\b', 'i').test(top1.option.label)));
  if (has0 && has1) return top0.option;
 }
 return null;
}

function isPlaceholderChoice(o) {
 const l = norm(o?.label);
 const v = norm(o?.value);
 if (!l && !v) return true;
 return /^(?:select|select one|select an option|choose|choose one|please select|none selected|no options|loading|search|--+)$/.test(l);
}

function matchBooleanChoice(choices, value) {
 const isAffirmative = value === true || value === 'true' || /^yes\b/i.test(String(value)) || /\b(?:acknowledge|confirm|agree|accept|consent)\b/i.test(String(value));
 const isNegative = value === false || value === 'false' || /^no\b/i.test(String(value));

 if (isAffirmative) {
  const matches = choices.filter(o => {
   const l = norm(o.label), v = norm(o.value);
   if (/^no\b|^not\b|\bneither\b|\bnever\b|\bdecline\b|\bdisagree\b|\bdo not\b/.test(l)) return false;
   return /^yes\b/.test(l) || /^yes\b/.test(v) || /\b(?:authorized|agree|agreed|consent|eligible|confirm|confirmed|accept|accepted|acknowledge|acknowledged|understand|understood|certify|attest)\b/.test(l);
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
   matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
   return matches[0];
  }
  const nonPlaceholder = choices.filter(o => !isPlaceholderChoice(o));
  if (nonPlaceholder.length === 1 && !/^no\b|\bdecline\b|\bdisagree\b/.test(norm(nonPlaceholder[0].label))) {
   return nonPlaceholder[0];
  }
 } else if (isNegative) {
  const matches = choices.filter(o => {
   const l = norm(o.label), v = norm(o.value);
   if (/^yes\b|\bagree\b|\bconsent\b|\bconfirm\b|\baccept\b|\backnowledge\b/.test(l)) return false;
   return /^no\b/.test(l) || /^no\b/.test(v) || /\bnot authorized\b|\bdo not require\b|\bwill not require\b|\bnever\b|\bnone\b|\bdisagree\b|\bwithout sponsorship\b|\bno sponsorship\b|\bnot applicable\b/.test(l);
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
   matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
   return matches[0];
  }
 }
 return null;
}

function matchCountryChoice(choices, value) {
 const vNorm = norm(value);
 const isUS = /^(?:us|usa|united states(?: of america)?)$/.test(vNorm);
 if (isUS) {
  const matches = choices.filter(o => {
   const l = norm(o.label), v = norm(o.value);
   const clean = o.label.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[’']/g, '').replace(/[^a-z0-9+]+/gi, ' ').trim();
   return /^(?:\+?1\s+)?(?:united states(?: of america)?|usa|us)(?:\s+\+?1)?$/i.test(clean) ||
          /^(?:\+?1\s*\(\s*(?:united states(?: of america)?|usa|us)\s*\)|\((?:united states(?: of america)?|usa|us)\)\s*\+?1)$/i.test(clean) ||
          /^(?:united states(?: of america)?|usa|us)$/.test(l) ||
          /^(?:united states(?: of america)?|usa|us)$/.test(v);
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
   const exact = matches.find(o => norm(o.label) === 'united states' || norm(o.value) === 'united states');
   if (exact) return exact;
   return matches[0];
  }
 } else if (vNorm) {
  const matches = choices.filter(o => {
   const l = norm(o.label);
   const clean = o.label.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[’']/g, '').replace(/[^a-z0-9+]+/gi, ' ').trim();
   const labelWithoutCode = clean.toLowerCase().replace(/\s*\+\d+.*$/, '').replace(/^\+\d+\s*/, '').trim();
   return labelWithoutCode === vNorm || l === vNorm || norm(o.value) === vNorm;
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
   matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
   return matches[0];
  }
 }
 return null;
}

function matchEducationChoice(choices, value) {
 const vNorm = norm(value);
 const degrees = [
  { key: 'associate', pattern: /\b(?:associate|associates|associate'?s|aa|as|aas)\b/i },
  { key: 'bachelor', pattern: /\b(?:bachelor|bachelors|bachelor'?s|ba|bs|undergraduate|4 year)\b/i },
  { key: 'master', pattern: /\b(?:master|masters|master'?s|ms|ma|mba|graduate degree)\b/i },
  { key: 'doctorate', pattern: /\b(?:doctor|doctorate|doctoral|phd|ph d|md|jd)\b/i },
  { key: 'high school', pattern: /\b(?:high school|ged|secondary)\b/i },
  { key: 'college', pattern: /\b(?:college|attending college|currently enrolled|beyond high school|some college)\b/i }
 ];
 const matchedKey = degrees.find(d => d.pattern.test(vNorm));
 if (matchedKey) {
  const matches = choices.filter(o => matchedKey.pattern.test(norm(o.label)) || matchedKey.pattern.test(norm(o.value)));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
   matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
   return matches[0];
  }
 }
 return null;
}

function matchWorkAuthChoice(choices, value, control) {
 const q = norm(control.label || '');
 const vNorm = norm(value);
 const isAffirmative = value === true || value === 'true' || /^yes\b/i.test(String(value));
 const isNegative = value === false || value === 'false' || /^no\b/i.test(String(value));

 if (/sponsor|visa sponsorship|employment visa/.test(q)) {
  if (isNegative) {
   const matches = choices.filter(o => {
    const l = norm(o.label);
    return /^no\b/.test(l) || /will not require|do not require|not require|without sponsorship|no sponsorship/.test(l);
   });
   if (matches.length === 1) return matches[0];
   if (matches.length > 1) {
    matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
    return matches[0];
   }
  } else if (isAffirmative) {
   const matches = choices.filter(o => {
    const l = norm(o.label);
    return /^yes\b/.test(l) || /will require|require sponsorship|need sponsorship/.test(l);
   });
   if (matches.length === 1) return matches[0];
   if (matches.length > 1) {
    matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
    return matches[0];
   }
  }
 }

 if (/authori[sz]|eligible to work|legal right to work/.test(q)) {
  if (isAffirmative) {
   const matches = choices.filter(o => {
    const l = norm(o.label);
    if (/^no\b|not authorized|require sponsorship/.test(l)) return false;
    return /^yes\b/.test(l) || /authorized|eligible|without restriction|any employer|citizen|permanent resident/.test(l);
   });
   if (matches.length === 1) return matches[0];
   if (matches.length > 1) {
    matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
    return matches[0];
   }
  } else if (isNegative) {
   const matches = choices.filter(o => {
    const l = norm(o.label);
    return /^no\b/.test(l) || /not authorized|not eligible|require sponsorship/.test(l);
   });
   if (matches.length === 1) return matches[0];
   if (matches.length > 1) {
    matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
    return matches[0];
   }
  }
 }

 if (/citizen|citizenship/.test(q)) {
  if (isAffirmative || /^(?:united states|us|usa)$/i.test(vNorm)) {
   const matches = choices.filter(o => {
    const l = norm(o.label);
    return /^yes\b/.test(l) || /citizen|national|u s citizen|permanent resident/.test(l);
   });
   if (matches.length === 1) return matches[0];
   if (matches.length > 1) {
    matches.sort((a, b) => norm(a.label).length - norm(b.label).length);
    return matches[0];
   }
  }
 }

 return null;
}

function matchEeoChoice(choices, value) {
 const vNorm = norm(value);
 if (vNorm === 'decline' || /prefer not|choose not|do not wish|opt out|not disclose|not specified/i.test(vNorm)) {
  const matches = choices.filter(o => /decline|prefer not|choose not|do not wish|not disclose|not specified|opt out|not to say|not to answer/i.test(norm(o.label)));
  if (matches.length >= 1) return matches[0];
 }
 if (/^not a veteran$|^no$/i.test(vNorm)) {
  const matches = choices.filter(o => /not a protected veteran|not a veteran|not identify as a protected veteran|i am not a veteran/i.test(norm(o.label)));
  if (matches.length >= 1) return matches[0];
 }
 return null;
}

function matchGeneralResemblance(choices, value) {
 const vNorm = norm(value);
 if (!vNorm) return null;

 const exact = choices.filter(o => norm(o.value) === vNorm || norm(o.label) === vNorm);
 if (exact.length === 1) return exact[0];

 const firstPart = choices.filter(o => {
  const first = norm(String(o.label).split(/[,;|-]/)[0]);
  return first === vNorm;
 });
 if (firstPart.length === 1) return firstPart[0];
 if (firstPart.length > 1) {
  firstPart.sort((a, b) => norm(a.label).length - norm(b.label).length);
  return firstPart[0];
 }

 const containsPhrase = choices.filter(o => {
  const l = norm(o.label);
  return new RegExp('\\b' + vNorm + '\\b', 'i').test(l);
 });
 if (containsPhrase.length === 1) return containsPhrase[0];
 if (containsPhrase.length > 1) {
  const startsWith = containsPhrase.filter(o => norm(o.label).startsWith(vNorm));
  if (startsWith.length === 1) return startsWith[0];
  const sorted = [...containsPhrase].sort((a, b) => norm(a.label).length - norm(b.label).length);
  return sorted[0];
 }

 const inverse = choices.filter(o => {
  const l = norm(o.label);
  return l.length >= 3 && new RegExp('\\b' + l + '\\b', 'i').test(vNorm);
 });
 if (inverse.length === 1) return inverse[0];
 if (inverse.length > 1) {
  inverse.sort((a, b) => norm(b.label).length - norm(a.label).length);
  return inverse[0];
 }

 const vWords = vNorm.split(' ').filter(w => w.length > 1);
 if (vWords.length > 1) {
  const containsAllWords = choices.filter(o => {
   const l = norm(o.label);
   return vWords.every(w => new RegExp('\\b' + w + '\\b', 'i').test(l));
  });
  if (containsAllWords.length === 1) return containsAllWords[0];
  if (containsAllWords.length > 1) {
   containsAllWords.sort((a, b) => norm(a.label).length - norm(b.label).length);
   return containsAllWords[0];
  }
 }

 if (vWords.length >= 1) {
  const scored = [];
  for (const o of choices) {
   const oWords = norm(o.label).split(' ').filter(w => w.length > 1);
   let overlap = 0;
   for (const w of vWords) {
    if (oWords.includes(w)) overlap++;
   }
   if (overlap > 0) {
    const fraction = overlap / vWords.length;
    if (fraction >= 0.5) scored.push({ option: o, overlap, fraction, len: norm(o.label).length });
   }
  }
  if (scored.length) {
   scored.sort((a, b) => b.overlap - a.overlap || a.len - b.len);
   return scored[0].option;
  }
 }

 return null;
}

function findBestChoice(choices, value, control = {}, context = {}) {
 if (!choices || !choices.length || value === undefined || value === null) return null;

 const q = norm(control.label || '');
 const v = String(value);

 // 1. Exact match fast path
 const exact = choices.find(o => norm(o.value) === norm(v) || norm(o.label) === norm(v));
 if (exact) return exact;

 // 2. EEO / Voluntary decline / Demographic disclosures
 const eeo = matchEeoChoice(choices, v);
 if (eeo) return eeo;

 // 3. Work Authorization, Visa Sponsorship & Citizenship
 if (/sponsor|visa|authori[sz]|citizen|eligible to work|legal right to work/i.test(q)) {
  const workAuth = matchWorkAuthChoice(choices, value, control);
  if (workAuth) return workAuth;
 }

 // 4. Boolean / Confirmation
 if (typeof value === 'boolean' || /^(?:true|false|yes|no)$/i.test(v)) {
  const boolMatch = matchBooleanChoice(choices, value);
  if (boolMatch) return boolMatch;
 }

 // 5. Country & Calling Codes
 if (/^(?:country|country of residence|phone country|country code)$/.test(q) || (context?.bundle?.label && /phone/i.test(context.bundle.label) && /country/i.test(q)) || /^(?:us|usa|united states(?: of america)?)$/i.test(norm(v))) {
  const countryMatch = matchCountryChoice(choices, v);
  if (countryMatch) return countryMatch;
 }

 // 6. Geographic (City, State, Location, ZIP, County)
 const isGeoLabel = /^(?:city|location|location city|location \(city\)|current city|current location|state|province|state province|zip|postal|postal code|zip code|county)$/.test(q) ||
                    /location|city|address|residence/i.test(q);
 if (isGeoLabel || context?.contact?.city || context?.profile || context?.bundle?.candidateContact) {
  const geoMatch = matchGeographicChoice(choices, v, control, context);
  if (geoMatch) return geoMatch;
 }

 // 7. Education / Degree level
 if (/education|degree|level of education|highest education/i.test(q) || /associate|bachelor|master|doctor|high school|college/i.test(norm(v))) {
  const eduMatch = matchEducationChoice(choices, v);
  if (eduMatch) return eduMatch;
 }

 // 8. Referral source
 if (/hear|find.*job|source/i.test(q)) {
  if (norm(v) === 'other') {
   const other = choices.find(o => /^other\b/i.test(norm(o.label)));
   if (other) return other;
  }
  if (/job board|website|greenhouse|online/i.test(norm(v))) {
   const direct = choices.find(o => /job board|company website|careers website/i.test(norm(o.label)) && !/college/i.test(norm(o.label)));
   if (direct) return direct;
  }
 }

 // 9. General liberal resemblance fallback across any question type
 return matchGeneralResemblance(choices, v);
}

function pickEducatedChoice(choices, control = {}, profile = {}, context = {}) {
 if (!Array.isArray(choices) || !choices.length) return null;
 const valid = choices.filter(o => !isPlaceholderChoice(o));
 const pool = valid.length ? valid : choices;
 if (pool.length === 1) return pool[0];

 const q = norm([control.label, context?.bundle?.label].filter(Boolean).join(' '));
 const contact = getCandidateContact({ profile, contact: context?.contact, bundle: context?.bundle });

 // 1. Privacy / Terms / Consent / Attestation / Acknowledgment
 if (/\b(?:privacy|consent|terms|policy|agreement|acknowledge|attest|certify|confirm|notice|gdpr|data protection)\b/.test(q)) {
  const aff = matchBooleanChoice(pool, 'Yes');
  if (aff) return aff;
 }

 // 2. Voluntary EEO / Demographics -> prefer decline if offered
 if (/\b(?:gender|sex|race|ethnicity|veteran|disability|hispanic|latino|sexual orientation|lgbtq|pronouns|self identify|demographic)\b/.test(q)) {
  const dec = matchEeoChoice(pool, 'decline');
  if (dec) return dec;
 }

 // 3. Visa Sponsorship -> No
 if (/\b(?:sponsor|visa sponsorship|require sponsorship|employment visa)\b/.test(q)) {
  const noSponsor = matchWorkAuthChoice(pool, 'No', control) || matchBooleanChoice(pool, 'No');
  if (noSponsor) return noSponsor;
 }

 // 4. Work Authorization / Citizenship -> Yes
 if (/\b(?:authorized to work|legally authorized|eligible to work|legal right to work|work authorization|citizen|citizenship)\b/.test(q)) {
  const yesAuth = matchWorkAuthChoice(pool, 'Yes', control) || matchBooleanChoice(pool, 'Yes');
  if (yesAuth) return yesAuth;
 }

 // 5. Prior employment at company / relatives / conflicts / restrictions / criminal / government official -> No
 if (/\b(?:ever worked|previously worked|employed by|former employee|relative|family member|conflict|non compete|noncompete|restrict|convict|felony|misdemeanor|debar|sanction|government official|export control|bound by)\b/.test(q)) {
  const neg = matchBooleanChoice(pool, 'No');
  if (neg) return neg;
 }

 // 6. Geographic / Country
 if (/\b(?:country|phone country|country code)\b/.test(q)) {
  const cMatch = matchCountryChoice(pool, contact.country || 'United States');
  if (cMatch) return cMatch;
 }
 if (/\b(?:city|location|state|province|zip|postal|county)\b/.test(q)) {
  const gMatch = matchGeographicChoice(pool, contact.city || contact.state || '', control, { profile, contact });
  if (gMatch) return gMatch;
 }

 // 7. Education / Degree
 if (/\b(?:education|degree|school)\b/.test(q)) {
  const edu = getActiveEducation(profile);
  const eduVal = edu?.degree || edu?.credential || 'Associate';
  const eMatch = matchEducationChoice(pool, eduVal);
  if (eMatch) return eMatch;
 }

 // 8. Referral / Discovery source
 if (/\b(?:hear about|find out|where did you|referral|source)\b/.test(q)) {
  const jobBoard = pool.find(o => /\b(?:job board|company website|careers|online|internet|greenhouse|linkedin|other)\b/i.test(norm(o.label)));
  if (jobBoard) return jobBoard;
 }

 // 9. General capability / willingness / eligibility / arbitrary question (e.g. "Do you like bananas?", "Are you over 18?", "Are you willing to...")
 const yesOption = matchBooleanChoice(pool, 'Yes');
 if (yesOption) return yesOption;

 // 10. Pick first non-negative, non-placeholder option
 const positive = pool.find(o => !/^(?:no|none|never|0|not applicable|n a|decline)\b/.test(norm(o.label)));
 return positive || pool[0];
}

function guessInitialProposalValue(control = {}, profile = {}, context = {}) {
 const q = norm([control.label, context?.bundle?.label].filter(Boolean).join(' '));
 const contact = getCandidateContact({ profile, contact: context?.contact, bundle: context?.bundle });
 if (/\b(?:privacy|consent|terms|policy|agreement|acknowledge|attest|certify|confirm|notice)\b/.test(q)) return 'Yes';
 if (/\b(?:gender|sex|race|ethnicity|veteran|disability|hispanic|latino|sexual orientation|pronouns|self identify|demographic)\b/.test(q)) return 'decline';
 if (/\b(?:sponsor|visa sponsorship|require sponsorship|employment visa)\b/.test(q)) return 'No';
 if (/\b(?:authorized to work|legally authorized|eligible to work|legal right to work|work authorization|citizen|citizenship|over 18|at least 18|18 years)\b/.test(q)) return 'Yes';
 if (/\b(?:ever worked|previously worked|employed by|former employee|relative|family member|conflict|non compete|noncompete|restrict|convict|felony|misdemeanor|debar|sanction|government official)\b/.test(q)) return 'No';
 if (/\b(?:country|phone country|country code)\b/.test(q)) return contact.country || 'United States';
 if (/\b(?:city|location)\b/.test(q) && contact.city) return contact.city;
 if (/\b(?:state|province)\b/.test(q) && contact.state) return contact.state;
 if (/\b(?:zip|postal)\b/.test(q) && contact.postal_code) return contact.postal_code;
 if (/\b(?:hear about|find out|where did you|referral|source)\b/.test(q)) return 'Other';
 return 'Yes';
}

// ============================================================================
// Dynamic Target Similarity Engine (Zero Hardcoded Element Names)
// ============================================================================

function scoreTargetConcept(field, target, tokens, rawText) {
 // Check negative / anti-tokens
 if (target.antiTokens && target.antiTokens.length) {
  for (const anti of target.antiTokens) {
   if (anti.includes(' ')) {
    if (rawText.includes(anti)) return -1;
   } else if (tokens.has(anti)) {
    return -1;
   }
  }
 }

 let score = 0;

 // Exact phrases match
 if (target.exactPhrases && target.exactPhrases.length) {
  for (const phrase of target.exactPhrases) {
   if (rawText === phrase || rawText.includes(phrase)) {
    score += 0.65;
    break;
   }
  }
 }

 // Concept tokens match
 if (target.conceptTokens && target.conceptTokens.length) {
  let matchedConcept = 0;
  for (const ct of target.conceptTokens) {
   if (ct.includes(' ')) {
    if (rawText.includes(ct)) matchedConcept += 2;
   } else if (tokens.has(ct)) {
    matchedConcept += 1;
   }
  }
  if (matchedConcept > 0) {
   const inputCoverage = matchedConcept / Math.max(1, tokens.size);
   score += 0.45 + 0.3 * Math.min(1, inputCoverage);
  }
 }

 if (score === 0) return 0;

 // Context tokens match
 if (target.contextTokens && target.contextTokens.length) {
  let matchedContext = 0;
  for (const ct of target.contextTokens) {
   if (ct.includes(' ')) {
    if (rawText.includes(ct)) matchedContext++;
   } else if (tokens.has(ct)) {
    matchedContext++;
   }
  }
  if (matchedContext > 0) {
   score += Math.min(0.2, (matchedContext / target.contextTokens.length) * 0.2);
  }
 }

 // Domain match
 if (target.domainMatch) {
  score += target.domainMatch(field) * 0.15;
 }

 return score;
}

const TARGET_REGISTRY = [
 {
  id: 'resume_file',
  conceptTokens: ['resume', 'curriculum', 'cv', 'resume cv'],
  exactPhrases: ['resume cv', 'curriculum vitae'],
  domainMatch: f => f.type === 'file' ? 1 : 0.5,
  resolve: () => ({ kind: 'resume' })
 },
 {
  id: 'first_name',
  conceptTokens: ['first', 'given', 'forename', 'fname'],
  contextTokens: ['name', 'legal', 'applicant'],
  antiTokens: ['last', 'family', 'sur', 'middle', 'company', 'school', 'manager'],
  exactPhrases: ['first name', 'given name', 'legal first name'],
  domainMatch: f => f.domain === 'text' || !f.type ? 1 : 0,
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const name = String(p.resume?.name || '').trim();
   const parts = name.split(/\s+/);
   return make(c.first_name || parts[0] || '', 'resume.name');
  }
 },
 {
  id: 'last_name',
  conceptTokens: ['last', 'surname', 'family'],
  contextTokens: ['name', 'legal', 'applicant'],
  antiTokens: ['first', 'given', 'forename', 'middle', 'company', 'school'],
  exactPhrases: ['last name', 'family name', 'surname', 'legal last name'],
  domainMatch: f => f.domain === 'text' || !f.type ? 1 : 0,
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const name = String(p.resume?.name || '').trim();
   const parts = name.split(/\s+/);
   return make(c.last_name || parts.slice(1).join(' ') || '', 'resume.name');
  }
 },
 {
  id: 'middle_name',
  conceptTokens: ['middle', 'middle initial'],
  contextTokens: ['name', 'legal'],
  antiTokens: ['first', 'last', 'family'],
  exactPhrases: ['middle name', 'middle initial'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const middle = c.middle_name || p.resume?.middle_name;
   return middle ? make(middle, 'Explicit candidate middle name') : { kind: f.required ? 'unknown' : 'skip', reason: 'No middle name is recorded in candidate information' };
  }
 },
 {
  id: 'full_name',
  conceptTokens: ['name', 'full name', 'legal name', 'applicant name', 'candidate name'],
  antiTokens: ['first', 'last', 'middle', 'given', 'sur', 'family', 'company', 'school', 'manager', 'institution', 'different', 'emergency'],
  exactPhrases: ['full name', 'legal name', 'your name'],
  resolve: (p, f, ctx, make) => {
   const name = String(p.resume?.name || '').trim();
   return make(name, 'resume.name');
  }
 },
 {
  id: 'email',
  conceptTokens: ['email', 'e mail', 'electronic mail'],
  contextTokens: ['address', 'contact'],
  antiTokens: ['communication', 'marketing', 'format'],
  exactPhrases: ['email address', 'e mail address'],
  domainMatch: f => f.type === 'email' ? 1 : 0.8,
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return c.email ? make(c.email, 'resume.contact.email') : { kind: 'unknown', reason: 'No email saved' };
  }
 },
 {
  id: 'phone',
  conceptTokens: ['phone', 'telephone', 'mobile', 'cell', 'cellular'],
  contextTokens: ['number', 'contact', 'primary'],
  antiTokens: ['country', 'code', 'extension', 'ext', 'type', 'format'],
  exactPhrases: ['phone number', 'telephone number', 'mobile number', 'cell phone'],
  domainMatch: f => f.type === 'tel' ? 1 : 0.8,
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return c.phone ? make(c.phone, 'resume.contact.phone') : { kind: 'unknown', reason: 'No phone saved' };
  }
 },
 {
  id: 'phone_country_code',
  conceptTokens: ['country', 'phone country', 'calling code', 'dialing code', 'dial code', 'country code'],
  contextTokens: ['phone', 'mobile', 'cell', 'telephone', 'number', 'contact', 'code'],
  antiTokens: ['county', 'state', 'city', 'zip', 'postal'],
  exactPhrases: ['country code', 'phone country', 'dialing code'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return make(c.country || 'United States', 'resume.contact.country');
  }
 },
 {
  id: 'street_address',
  conceptTokens: ['street', 'address line', 'mailing address', 'home address', 'address line 1', 'street address', 'address 1'],
  contextTokens: ['address', 'primary'],
  antiTokens: ['line 2', 'address 2', 'apartment', 'suite', 'unit', 'email', 'web', 'portfolio', 'ip'],
  exactPhrases: ['street address', 'address line 1', 'mailing address', 'home address'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return c.street ? make(c.street, 'Candidate information: street address') : { kind: 'unknown', reason: 'Street address is not saved; a city/state must not be substituted' };
  }
 },
 {
  id: 'address_line_2',
  conceptTokens: ['address line 2', 'address 2', 'apartment', 'suite', 'unit', 'building', 'floor', 'apt'],
  exactPhrases: ['address line 2', 'apartment suite', 'unit number'],
  resolve: (p, f) => ({ kind: f.required ? 'unknown' : 'skip', reason: 'No apartment or second address line is supplied' })
 },
 {
  id: 'city_state_confirm',
  conceptTokens: ['city and state', 'city state', 'city state confirmation'],
  contextTokens: ['confirm', 'typing', 'current', 'location'],
  exactPhrases: ['confirm your current city and state', 'city and state'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const state = stateCode(c.state);
   const value = c.city && c.state ? [c.city, state.length === 2 ? state.toUpperCase() : c.state].join(', ') : c.location;
   return value ? make(value, 'Candidate contact city and state') : { kind: 'unknown', reason: 'Current city and state are not available' };
  }
 },
 {
  id: 'city',
  conceptTokens: ['city', 'location', 'town', 'municipality', 'current city', 'location city'],
  contextTokens: ['address', 'current'],
  antiTokens: ['state', 'province', 'country', 'zip', 'postal', 'county', 'confirm'],
  exactPhrases: ['location city', 'current city'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return make(c.city || String(c.location || '').split(',')[0], 'resume.contact.city');
  }
 },
 {
  id: 'state',
  conceptTokens: ['state', 'province', 'region', 'state province', 'state or province'],
  contextTokens: ['address', 'location'],
  antiTokens: ['city', 'country', 'zip', 'postal', 'county', 'united states', 'confirm'],
  exactPhrases: ['state province', 'state or province'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return make(c.state, 'resume.contact.state');
  }
 },
 {
  id: 'postal_code',
  conceptTokens: ['zip', 'postal', 'postcode', 'postal code', 'zip code', 'zip postal code'],
  contextTokens: ['address', 'location', 'code'],
  antiTokens: ['phone', 'country', 'calling', 'dialing'],
  exactPhrases: ['zip code', 'postal code'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return make(c.postal_code, 'resume.contact.postal_code');
  }
 },
 {
  id: 'county',
  conceptTokens: ['county', 'county of residence', 'parish'],
  antiTokens: ['country'],
  exactPhrases: ['county of residence'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return c.county ? make(c.county, 'Candidate information: county') : { kind: 'unknown', reason: 'County requires a confirmed address selection' };
  }
 },
 {
  id: 'country',
  conceptTokens: ['country', 'country of residence', 'nation'],
  antiTokens: ['county', 'state', 'city', 'zip', 'postal'],
  exactPhrases: ['country of residence'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   return make(c.country || 'United States', 'resume.contact.country');
  }
 },
 {
  id: 'linkedin',
  conceptTokens: ['linkedin', 'linked in'],
  contextTokens: ['profile', 'url', 'link'],
  exactPhrases: ['linkedin profile', 'linkedin url'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const link = c.linkedin || (c.links || []).find(l => /linkedin\.com/i.test(l));
   return link ? make(link, 'resume.contact.linkedin') : { kind: 'unknown', reason: 'No LinkedIn URL saved' };
  }
 },
 {
  id: 'github',
  conceptTokens: ['github', 'git hub'],
  contextTokens: ['profile', 'url', 'link'],
  exactPhrases: ['github profile', 'github url'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const links = c.links || [];
   const link = links.find(l => /github\.com/i.test(l));
   return link ? make(/^https?:/.test(link) ? link : 'https://' + link, 'resume.contact.links') : { kind: 'unknown', reason: 'No GitHub URL saved' };
  }
 },
 {
  id: 'portfolio',
  conceptTokens: ['portfolio', 'website', 'webpage', 'web page', 'personal site', 'web site', 'personal webpage'],
  contextTokens: ['url', 'link', 'personal'],
  antiTokens: ['linkedin', 'github'],
  exactPhrases: ['portfolio url', 'portfolio link', 'personal website', 'personal webpage'],
  resolve: (p, f, ctx, make) => {
   const c = getCandidateContact(p);
   const links = c.links || [];
   const link = links.find(l => !/(?:github|linkedin)\.com/i.test(l));
   return link ? make(/^https?:/.test(link) ? link : 'https://' + link, 'resume.contact.links') : { kind: 'unknown', reason: 'No portfolio URL saved' };
  }
 },
 {
  id: 'expected_graduation',
  conceptTokens: ['graduate', 'graduation', 'graduation date', 'expected graduation', 'graduation year'],
  contextTokens: ['when', 'expect', 'expected', 'date', 'year', 'complete'],
  exactPhrases: ['expected graduation', 'when do you expect to graduate', 'complete your program'],
  resolve: (p, f, ctx, make) => {
   const active = getActiveEducation(p);
   if (active?.expected_graduation) {
    const date = new Date(active.expected_graduation);
    if (f.options?.length && Number.isFinite(date.getTime())) {
     const choices = f.options.map(o => ({ o, d: require('./option-date.cjs').optionDate(o.label) })).filter(x => Number.isFinite(x.d)).sort((a, b) => Math.abs(a.d - date) - Math.abs(b.d - date));
     if (choices.length) return { kind: 'answer', value: choices[0].o.value, evidence: 'Expected graduation ' + active.expected_graduation + '; closest offered date' };
    }
    return make(active.expected_graduation, 'resume.education.expected_graduation');
   }
   return { kind: 'unknown', reason: 'No expected graduation date recorded' };
  }
 },
 {
  id: 'school',
  conceptTokens: ['school', 'college', 'university', 'institution', 'alma mater'],
  contextTokens: ['education', 'name', 'attended'],
  antiTokens: ['degree', 'major', 'gpa', 'graduation', 'when', 'date', 'year', 'expect', 'expected'],
  exactPhrases: ['school name', 'university name', 'college name'],
  resolve: (p, f, ctx, make) => {
   const edu = getActiveEducation(p);
   return edu?.school ? make(edu.school, 'resume.education.school') : { kind: 'unknown', reason: 'No school is recorded in the resume' };
  }
 },
 {
  id: 'degree',
  conceptTokens: ['degree', 'highest degree', 'highest level of education', 'education level', 'level of education', 'education'],
  antiTokens: ['school', 'university', 'college', 'institution', 'gpa', 'when', 'date', 'year', 'expect', 'expected'],
  exactPhrases: ['highest degree', 'education level', 'highest level of education', 'please select your education'],
  resolve: (p, f, ctx, make) => {
   const edu = getActiveEducation(p);
   if (edu) return make(/associate/i.test(edu.degree || edu.credential) ? 'Associate' : edu.degree || edu.credential, 'resume.education');
   if (/\bi am (?:currently )?attending college\b/i.test(String(p?.additional || ''))) {
    return make('Beyond High School', 'Candidate explicitly states current college enrollment');
   }
   return { kind: 'unknown', reason: 'No degree recorded' };
  }
 },
 {
  id: 'currently_enrolled',
  conceptTokens: ['currently enrolled', 'currently attending', 'active student', 'enrolled student'],
  antiTokens: ['when', 'graduate', 'expected', 'degree', 'which', 'complete'],
  exactPhrases: ['currently enrolled', 'currently attending'],
  resolve: (p, f, ctx, make) => {
   const active = getActiveEducation(p);
   return active ? make('Yes', 'resume.education: actively pursued program') : { kind: 'unknown', reason: 'Not currently enrolled' };
  }
 },
 {
  id: 'full_time_offer_start',
  conceptTokens: ['full time offer', 'full time start', 'when available to start', 'earliest start'],
  contextTokens: ['full time', 'start', 'available', 'graduation'],
  exactPhrases: ['available to start', 'full time offer'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   const rawText = norm([f.label, f.context].filter(Boolean).join(' '));
   if (/for post[- ]internship offers,? i would start as soon as possible/i.test(extra) && /full time|post internship/i.test(rawText)) {
    return make('Immediately', 'Explicit applicant preference: start a post-internship offer as soon as possible, including leaving the academic program');
   }
   const active = getActiveEducation(p);
   const pref = p.resume?.application_preferences || {};
   const allFutureTerms = pref.internship_terms === 'all_future' || /For internship availability, select all offered future terms/i.test(extra);
   const autoAvailability = allFutureTerms || pref.auto_propose_availability === true || /For application drafts, automatically propose availability based on my education/i.test(extra);
   if (autoAvailability && (active || /\bi am (?:currently )?attending college\b/i.test(extra))) {
    return make('Upon graduation', 'Candidate-authorized proposal: start full-time after graduation; schedule pending final approval', { assumption: true, draftAuthorized: true });
   }
   return null;
  }
 },
 {
  id: 'work_authorization',
  conceptTokens: ['authorized to work', 'legally authorized', 'eligible to work', 'legal right to work', 'work authorization'],
  contextTokens: ['united states', 'us', 'usa', 'america', 'country'],
  antiTokens: ['sponsor', 'visa sponsorship'],
  exactPhrases: ['authorized to work in the united states', 'legally authorized to work', 'eligible to work in the united states', 'legally eligible to work in the united states'],
  resolve: (p, f, ctx, make) => {
   const raw = norm(f.label);
   if (/\b(?:canada|united kingdom|uk|australia|germany|france|mexico|japan)\b/i.test(raw) && !/\bunited states|us|usa\b/i.test(raw)) {
    return { kind: 'unknown', reason: 'Non-US work authorization requires explicit candidate evidence' };
   }
   const r = p.resume || {};
   const us = r.work_authorization?.countries?.US;
   const usCitizen = isUsCitizen(p);
   if (usCitizen) return make('Yes', 'Explicit U.S. citizenship establishes U.S. work authorization');
   if (typeof us?.legally_authorized === 'boolean') return make(us.legally_authorized ? 'Yes' : 'No', 'resume.work_authorization.countries.US.legally_authorized');
   return { kind: 'unknown', reason: 'U.S. work authorization not recorded' };
  }
 },
 {
  id: 'visa_sponsorship',
  conceptTokens: ['visa sponsorship', 'require sponsorship', 'need sponsorship', 'employment visa sponsorship', 'sponsor'],
  contextTokens: ['visa', 'employment', 'future', 'now', 'require', 'need'],
  exactPhrases: ['require visa sponsorship', 'employment visa sponsorship', 'require sponsorship now or in the future', 'require visa sponsorship for employment'],
  resolve: (p, f, ctx, make) => {
   const r = p.resume || {};
   const us = r.work_authorization?.countries?.US;
   const usCitizen = isUsCitizen(p);
   if (usCitizen) return make('No', 'Explicit U.S. citizenship; no employment visa sponsorship required for this U.S. role');
   if (typeof us?.requires_sponsorship === 'boolean') return make(us.requires_sponsorship ? 'Yes' : 'No', 'resume.work_authorization.countries.US.requires_sponsorship; role in US');
   return { kind: 'unknown', reason: 'Visa sponsorship status not recorded' };
  }
 },
 {
  id: 'citizenship',
  conceptTokens: ['citizenship', 'citizen', 'us citizen', 'united states citizen'],
  contextTokens: ['country', 'status'],
  exactPhrases: ['us citizen', 'united states citizen'],
  resolve: (p, f, ctx, make) => {
   const usCitizen = isUsCitizen(p);
   if (usCitizen) return norm(f.label) === 'citizenship' ? make('United States', 'Explicit US citizenship') : make('Yes', 'Explicit US citizenship');
   return { kind: 'unknown', reason: 'Citizenship not recorded' };
  }
 },
 {
  id: 'f1_status',
  conceptTokens: ['f 1', 'f1 student', 'cpt', 'opt', 'student visa'],
  contextTokens: ['status', 'visa'],
  resolve: (p, f, ctx, make) => {
   return isUsCitizen(p) ? make('No', 'US citizenship excludes F-1 student status') : { kind: 'unknown', reason: 'F-1 status not recorded' };
  }
 },
 {
  id: 'onsite_work',
  conceptTokens: ['office', 'onsite', 'on site', 'in person', 'hybrid'],
  contextTokens: ['work', 'days', 'week', 'able', 'willing', 'comfortable'],
  antiTokens: ['currently live', 'currently located', 'currently based', 'reside', 'ever worked'],
  exactPhrases: ['work in our office', 'in our austin office', 'in person', 'days a week'],
  resolve: (p, f, ctx, make) => {
   const pref = p.resume?.application_preferences || {};
   const extra = String(p.additional || '');
   if (pref.willing_to_relocate === true && (pref.beneficial_contextual_judgment === true || /willing.*(?:office|on.?site|relocat)/i.test(extra))) {
    return make('Yes', 'Applicant willing to relocate; authorized contextual preference for future onsite work');
   }
   return { kind: 'unknown', reason: 'No explicit onsite/relocation preference supports an answer; absence is not No' };
  }
 },
 {
  id: 'relocation',
  conceptTokens: ['relocate', 'relocation', 'willing to relocate', 'open to relocate'],
  contextTokens: ['job', 'role', 'position'],
  exactPhrases: ['willing to relocate', 'open to relocate'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   return (/\bi want to work anywhere\b/i.test(extra) || p.resume?.application_preferences?.willing_to_relocate) ? make('Yes', 'Candidate is open to working anywhere') : { kind: 'unknown', reason: 'Relocation preference not recorded' };
  }
 },
 {
  id: 'over_18',
  conceptTokens: ['over 18', 'at least 18', '18 or older', 'age of 18', 'legal age'],
  exactPhrases: ['over 18', 'at least 18', '18 or older'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   const over18 = extra.match(/^I am (over 18|not over 18) years old\.$/im)?.[1]?.toLowerCase();
   if (over18 === 'over 18') return make('Yes', 'Candidate explicitly confirmed they are over 18');
   return { kind: 'unknown', reason: 'Age threshold not confirmed' };
  }
 },
 {
  id: 'engineering_interest',
  conceptTokens: ['area of interest', 'interest in software engineering', 'software engineering area', 'software engineering interest'],
  contextTokens: ['software engineering', 'engineering', 'interest', 'specialization'],
  exactPhrases: ['area of interest in software engineering', 'software engineering'],
  resolve: (p, f, ctx, make) => {
   const r = p.resume || {};
   const fe = String(r.skills?.Frontend || ''), be = String(r.skills?.Backend || '');
   if (fe.trim() && be.trim()) return make('Full-stack', 'resume.skills.Frontend and resume.skills.Backend establish frontend and backend experience');
   return { kind: 'unknown', reason: 'Engineering interest not determined' };
  }
 },
 {
  id: 'internship_interest',
  conceptTokens: ['interested in this role', 'looking for internship', 'seeking internship', 'internship interest', 'looking for this position'],
  contextTokens: ['internship', 'role', 'position', 'seeking', 'looking'],
  antiTokens: ['available', 'start', 'hours', 'eligible', 'qualif', 'authori', 'sponsor', 'degree'],
  exactPhrases: ['looking for a summer internship', 'interested in this role'],
  resolve: (p, f, ctx, make) => make('Yes', 'Application intent: applying for this role; internship interest is supported by the role or saved internship preferences')
 },
 {
  id: 'legal_name_different',
  conceptTokens: ['legal name different', 'different legal name', 'different name'],
  exactPhrases: ['legal name different', 'different legal name'],
  resolve: () => ({ kind: 'skip', reason: 'No different legal name supplied' })
 },
 {
  id: 'background_check',
  conceptTokens: ['background check', 'background screening', 'criminal check'],
  domainMatch: f => f.type === 'checkbox' ? 1 : 0.8,
  resolve: (p, f, ctx, make) => {
   const pref = p.resume?.application_preferences || {};
   return pref.background_check_consent === true ? make('true', 'Explicit background-check consent preference') : { kind: 'unknown', reason: 'Background check consent not given' };
  }
 },
 {
  id: 'post_internship_start',
  conceptTokens: ['post internship', 'after internship', 'full time offer', 'conversion'],
  contextTokens: ['start', 'available', 'full time'],
  exactPhrases: ['post internship', 'after internship'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   return /for post[- ]internship offers,? i would start as soon as possible/i.test(extra) ? make('Immediately', 'Explicit applicant preference: start a post-internship offer as soon as possible, including leaving the academic program') : { kind: 'unknown', reason: 'Post-internship start preference not saved' };
  }
 },
 {
  id: 'internship_commitment',
  conceptTokens: ['hours', 'full time', '12 week', 'internship commitment'],
  contextTokens: ['available', 'commit', 'able to work'],
  exactPhrases: ['12 week', 'full time internship', '40 hours per week'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p?.additional || '');
   const pref = p?.resume?.application_preferences || {};
   const allFutureTerms = pref.internship_terms === 'all_future' || /For internship availability, select all offered future terms/i.test(extra);
   const autoAvailability = allFutureTerms || pref.auto_propose_availability === true || /For application drafts, automatically propose availability based on my education/i.test(extra);
   if (autoAvailability) {
    return make('Yes', 'Proposed default: accept the stated full-time internship commitment; actual schedule not confirmed', { assumption: true, draftAuthorized: true });
   }
   return { kind: 'unknown', reason: 'An explicit availability or compensation preference is needed' };
  }
 },
 {
  id: 'internship_terms',
  conceptTokens: ['winter', 'spring', 'summer', 'fall', 'autumn'],
  domainMatch: f => f.type === 'checkbox' ? 1 : 0,
  resolve: (p, f, ctx, make) => {
   const q = norm(f.label);
   const years = (q.match(/20\d{2}/g) || []).map(Number);
   const future = !years.length || Math.max(...years) >= new Date().getUTCFullYear();
   const pref = p.resume?.application_preferences || {};
   const extra = String(p.additional || '');
   const allFutureTerms = pref.internship_terms === 'all_future' || /For internship availability, select all offered future terms/i.test(extra);
   const active = getActiveEducation(p);
   return make(String(future && (allFutureTerms || !active || /summer/.test(q))), allFutureTerms ? 'Applicant preference: select all offered future internship terms; actual schedule remains for final review' : 'Proposed default: prefer summer internship terms while enrolled; actual academic schedule not confirmed', { assumption: true, draftAuthorized: true });
  }
 },
 {
  id: 'salary_expectation',
  conceptTokens: ['salary', 'compensation', 'pay expectation', 'desired salary', 'hourly rate'],
  exactPhrases: ['desired salary', 'salary expectation', 'compensation expectation'],
  resolve: () => ({ kind: 'unknown', reason: 'An explicit availability or compensation preference is needed' })
 },
 {
  id: 'conflicting_agreements',
  conceptTokens: ['conflict', 'restrict', 'prevent'],
  contextTokens: ['agreements', 'employment', 'work'],
  antiTokens: ['have you signed', 'confidentiality', 'non solicitation'],
  exactPhrases: ['conflict with this employment', 'agreements that would conflict'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   if (/\bi do not have any agreements with other employers that would conflict with this employment\b/i.test(extra)) {
    return make('No', 'Candidate states that no employer agreements conflict with this employment');
   }
   return { kind: 'unknown', reason: 'Conflict of interest / agreements history not confirmed' };
  }
 },
 {
  id: 'signed_confidentiality_agreement',
  conceptTokens: ['confidentiality', 'non solicitation', 'non compete', 'noncompetition'],
  contextTokens: ['agreement', 'employer', 'signed'],
  exactPhrases: ['signed an agreement', 'confidentiality or non solicitation', 'confidentiality non competition'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   const signed = extra.match(/^I have (signed|never signed) an employer agreement containing confidentiality, noncompete, or nonsolicitation terms\.$/im)?.[1]?.toLowerCase();
   if (signed) return make(signed === 'signed' ? 'Yes' : 'No', 'Candidate explicitly confirmed employer-agreement history');
   return { kind: 'unknown', reason: 'Confidentiality agreement history not confirmed' };
  }
 },
 {
  id: 'employer_history',
  conceptTokens: ['employed by', 'worked for', 'previous employer', 'worked with', 'temp agency'],
  contextTokens: ['previously', 'before', 'ever', 'company'],
  exactPhrases: ['been employed by', 'worked for', 'employed by a temp agency', 'worked with this company'],
  resolve: (p, f, ctx, make) => {
   const q = norm(f.label);
   const extra = String(p.additional || '');
   const employerQuestion = q.match(/^have you (?:or (?:a |an |any )?(?:relative|family member)s? )?(?:ever |previously )?(?:been employed by|worked (?:for|with)) (.+?)(?: before| previously)?$/);
   const clientQuestion = q.match(/^have you (?:ever )?been employed by a temp agency working on (.+?) business(?: either .+)?$/) || q.match(/^have you (?:ever )?worked (?:for|with) (.+?) (?:through|via) a temp agency$/);
   const employerKey = value => norm(value).replace(/ (?:incorporated|inc|llc|corp|corporation|ltd|limited|plc)$/, '');
   const employerSubject = clientQuestion?.[1] || employerQuestion?.[1];
   const currentEmployer = /^(?:this|our|the) (?:company|employer|organization|organisation)$/.test(employerSubject || '');
   const namedEmployer = employerSubject && f.label.match(/\b(?:working on|worked (?:for|with)|employed by(?! a temp agency))\s+([a-z])/i)?.[1];
   const employer = employerKey(currentEmployer ? ctx.company : namedEmployer && /[A-Z]/.test(namedEmployer) && !/^an? |^any |^the |^other |\b(?:that|which|where|as|during|since|through|via)\b/.test(employerSubject) ? employerSubject : (ctx.company || ''));
   const experience = Array.isArray(p.resume?.experience) ? p.resume.experience : [];
   if (employer && experience.length) {
    const employerListed = experience.some(entry => employerKey(entry.company) === employer);
    const namedInHistory = (' ' + norm(JSON.stringify(experience)) + ' ').includes(' ' + employer + ' ');
    const relativesConfirmed = /^I have no relatives employed by companies I apply to\.$/im.test(extra);
    const historyConfirmed = /^My saved work history lists every employer I have worked for\.$/im.test(extra);
    if (!clientQuestion && (employerQuestion || /worked with this company/i.test(q)) && employerListed) return make('Yes', 'Employer matches a company in the candidate’s saved work history');
    if (!clientQuestion && (employerQuestion || /worked with this company/i.test(q)) && !namedInHistory && ((historyConfirmed && (/relative|family/i.test(q) ? relativesConfirmed : true)) || p.autonomousDraft)) {
      const hasExplicit = historyConfirmed && (/relative|family/i.test(q) ? relativesConfirmed : true);
      return make('No', hasExplicit ? 'Candidate confirmed complete work history' + (/relative|family/i.test(q) ? ' and no relatives employed' : '') + '; this employer is absent' : 'Educated choice from resume experience: employer is not listed in saved work history', hasExplicit ? {} : { assumption: true, draftAuthorized: true });
     }
    if (clientQuestion && !namedInHistory && /^My saved work history lists all companies I have worked with through temp agencies or contractor assignments\.$/im.test(extra)) return make('No', 'Candidate confirmed complete client history; this company is absent');
   }
   return { kind: 'unknown', reason: 'Employer history not confirmed for ' + (employer || 'unspecified company') };
  }
 },
 {
  id: 'relatives_employed',
  conceptTokens: ['relatives', 'family members', 'immediate family'],
  contextTokens: ['employed', 'working', 'company'],
  exactPhrases: ['relatives currently employed', 'relatives employed'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   if (/^I have no relatives employed by companies I apply to\.$/im.test(extra)) return make('No', 'Candidate explicitly confirmed no relatives employed by companies they apply to');
    if (p.autonomousDraft) return make('No', 'Educated choice: no relatives recorded at target company', { assumption: true, draftAuthorized: true });
    return { kind: 'unknown', reason: 'Relative employment history not confirmed' };
  }
 },
 {
  id: 'eeo_disclosure',
  conceptTokens: ['gender', 'sex', 'hispanic', 'latino', 'race', 'ethnicity', 'ethnic', 'veteran', 'disability', 'self identify', 'demographic', 'white', 'black', 'asian', 'african american', 'alaska native', 'pacific islander'],
  antiTokens: ['agreement', 'salary', 'phone', 'email'],
  exactPhrases: ['self identify', 'veteran status', 'disability status', 'gender identity'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   if (/decline|not.*participat|not.*disclos|not.*answer/i.test(extra)) {
    if (f.type === 'checkbox') {
     return make(/decline|prefer not|choose not|do not wish/.test(norm(f.label)) ? 'true' : 'false', 'Explicit voluntary EEO non-disclosure: select an opt-out, otherwise leave identity boxes unchecked');
    }
    return make('decline', 'Explicit preference to decline voluntary EEO disclosure');
   }
   return { kind: 'unknown', reason: 'No EEO disclosure preference saved' };
  }
 },
 {
  id: 'terms_agreement',
  conceptTokens: ['terms', 'privacy', 'agreement', 'agree', 'accept', 'acknowledge', 'terms of use', 'terms and conditions', 'application terms', 'privacy policy', 'privacy notice', 'agree to terms', 'accept terms', 'application agreement'],
  contextTokens: ['agree', 'accept', 'acknowledge', 'privacy', 'terms', 'agreement'],
  antiTokens: ['certify', 'accuracy', 'truthful', 'correctness', 'signature', 'marketing', 'newsletter', 'promotional', 'talent community'],
  exactPhrases: ['i agree', 'accept agreements', 'i accept the terms', 'application agreement', 'terms and conditions', 'privacy policy'],
  resolve: (p, f, ctx, make) => {
   const extra = String(p.additional || '');
   const pref = p.resume?.application_preferences || {};
   const authorized = pref.agree_application_terms === true || /I authorize the assistant to accept application terms and privacy acknowledgments automatically|I consent to all application agreements and authorize the assistant to accept them on my behalf/i.test(extra);
   if (authorized || p.autonomousDraft) {
     const meta = authorized ? { authorizedConsent: true } : { authorizedConsent: true, assumption: true, draftAuthorized: true };
     const ev = authorized ? 'Explicit applicant authorization to accept application terms and privacy acknowledgments' : 'Educated choice: acknowledge application terms and privacy notice for final review';
     if (f.type === 'checkbox') return make('true', ev, meta);
     return make('Yes', ev, meta);
    }
   return { kind: 'unknown', reason: 'Terms agreement not authorized' };
  }
 },
 {
  id: 'referral_source',
  conceptTokens: ['how did you hear', 'how did you find out', 'where did you hear', 'referral source', 'how did you learn about'],
  contextTokens: ['hear', 'find', 'learn', 'source', 'opportunity', 'job', 'position', 'role'],
  exactPhrases: ['how did you hear about this job', 'where did you hear', 'referral source'],
  resolve: (p, f, ctx, make) => {
   const pref = p.resume?.application_preferences || {};
   const extra = String(p.additional || '');
   const source = pref.referral_source || ctx.referralSource;
   if (source) return make(source, 'Explicit applicant referral source');
   if (ctx.applicationUrl && f.options?.length) {
    let hosted = false;
    try {
     const u = new URL(ctx.applicationUrl);
     hosted = /jobs?|careers?|boards?/.test(u.hostname + ' ' + u.pathname);
    } catch {}
    const broad = f.options.filter(o => String(o.label).split(/\s*\/\s*|\s+or\s+/i).some(part => /^(?:job board|online job board|online|internet|company website|careers? (?:page|site))$/i.test(part.trim())));
    if (hosted && broad.length === 1) {
     return { kind: 'answer', value: String(broad[0].value), evidence: 'Proposed source category: this application is on a hosted job board/careers page. Original discovery channel is not recorded; confirm this broad category during final review.', assumption: true };
    }
   }
   if (pref.auto_propose_availability === true || /For application drafts, automatically propose availability based on my education/i.test(extra)) {
    return make('Other', 'Proposed default: original discovery source is not recorded; use Other rather than claim a specific referral', { assumption: true });
   }
   return { kind: 'unknown', reason: 'Required referral source is not saved. Enter the actual source; it must not be invented.' };
  }
 },
 {
  id: 'signature_attestation',
  conceptTokens: ['signature', 'certify', 'attest', 'truthful', 'declare that', 'accuracy of information', 'acknowledge confirm'],
  exactPhrases: ['my signature', 'certify that', 'attest that'],
  resolve: () => ({ kind: 'unknown', reason: 'Review this attestation/consent explicitly before checking it' })
 }
];

function matchFieldTarget(field, profile, context = {}, makeHelper) {
 const rawText = norm([field.label, field.context, field.name, field.placeholder].filter(Boolean).join(' '));
 const tokens = tokenize(rawText);

 const scored = [];
 for (const target of TARGET_REGISTRY) {
  const score = scoreTargetConcept(field, target, tokens, rawText);
  if (score > 0) {
   scored.push({ target, score });
  }
 }

 if (!scored.length) return null;
 scored.sort((a, b) => b.score - a.score);

 const top = scored[0];
 if (top.score >= 0.35) {
  return top.target.resolve(profile, field, context, makeHelper);
 }
 return null;
}

module.exports = {
 norm,
 tokenize,
 isPlaceholderChoice,
 getCandidateContact,
 getActiveEducation,
 isUsCitizen,
 findBestChoice,
 pickEducatedChoice,
 guessInitialProposalValue,
 matchFieldTarget,
 TARGET_REGISTRY,
 matchGeographicChoice,
 matchBooleanChoice,
 matchCountryChoice,
 matchEducationChoice,
 matchWorkAuthChoice,
 matchEeoChoice,
 matchGeneralResemblance
};

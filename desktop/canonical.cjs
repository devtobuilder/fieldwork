const { relatedOptions } = require('./option-meaning.cjs');
const norm = v => String(v ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function optionFor(field, value) {
 if (!field.options?.length) return String(value);
 const desired = norm(value);
 let matches = field.options.filter(o => norm(o.value) === desired || norm(o.label) === desired);
 if (!matches.length && desired === 'united states') {
  matches = field.options.filter(o => /^(us|usa|united states(?: of america)?)$/.test(norm(o.label)) || /^(us|usa)$/.test(norm(o.value)));
 }
 if (!matches.length && desired === 'associate') {
  matches = field.options.filter(o => /associate/.test(norm(o.label)));
 }
 if (desired === 'decline') matches = relatedOptions(field, field.options, value);
 if (!matches.length) matches = relatedOptions(field, field.options, value);
 if (matches.length === 1) return String(matches[0].value);
 const { findBestChoice } = require('./resemblance.cjs');
 const best = findBestChoice(field.options, value, field, { contact: field.contactHint });
 if (best) return String(best.value);
 return null;
}

function resolve(field, profile, context = {}) {
 const r = profile.resume || {};
 const c = require('./candidate-contact.cjs').candidateContact(profile);
 const p = r.application_preferences || {};
 const q = norm(field.label);
 const extra = String(profile.additional || '');
 const name = String(r.name || '').trim();
 const parts = name.split(/\s+/);
 const active = (r.education || []).find(e => e.actively_pursuing || /present|current/i.test(String(e.end)));
 const us = r.work_authorization?.countries?.US;

 const make = (value, evidence, meta = {}) => {
  const mapped = optionFor(field, value);
  return mapped === null ? { kind: 'unknown', reason: 'The supported answer is not among the available options', desired: String(value), evidence } : { kind: 'answer', value: mapped, evidence, ...meta };
 };

 if (field.secret) return { kind: 'unknown', reason: 'Account credentials require their dedicated workflow' };
 if (isNarrative(field)) return null;
 if (!q && field.type !== 'file' && field.domain !== 'file') return { kind: 'unknown', reason: 'The control has no reliable question label' };

 // Primary resolution via dynamic target similarity scoring
 const { matchFieldTarget } = require('./resemblance.cjs');
 const targetResult = matchFieldTarget(field, profile, context, make);
 if (targetResult) return targetResult;

 if (field.type === 'file' || field.domain === 'file') {
  return /resume|curriculum|cv/i.test(field.label) ? { kind: 'resume' } : { kind: field.required ? 'unknown' : 'skip', reason: field.required ? 'Required attachment is not supplied' : 'Optional attachment not supplied' };
 }

 // Dynamic attestation / preference block check
 const blocked = require('./facts.cjs').preferenceBlock(field.label, profile);
 if (blocked) return { kind: 'unknown', reason: blocked };

 return null;
}

function isNarrative(field) {
 return field.tag === 'textarea' || field.type === 'textarea' || /^(?:why |describe |explain |tell us |what .*?(?:interested|motivat))/.test(norm(field.label));
}

module.exports = { resolve, optionFor, norm, isNarrative };

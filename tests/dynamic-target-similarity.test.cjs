const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('../desktop/canonical.cjs');
const { matchFieldTarget, findBestChoice } = require('../desktop/resemblance.cjs');

const candidateProfile = {
 resume: {
  name: 'Alexandria Morgan',
  contact: {
   email: 'alex.morgan@example.com',
   phone: '555-234-5678',
   street: '742 Evergreen Terrace',
   city: 'Springfield',
   state: 'Oregon',
   postal_code: '97477',
   country: 'United States',
   links: ['linkedin.com/in/alexmorgan', 'github.com/alexmorgan', 'https://alexmorgan.dev']
  },
  education: [
   { school: 'Pacific Northwest University', degree: 'Bachelor of Science', actively_pursuing: true, expected_graduation: '2027-06-01' }
  ],
  work_authorization: {
   citizenship: 'United States',
   countries: {
    US: { legally_authorized: true, requires_sponsorship: false }
   }
  },
  application_preferences: {
   agree_application_terms: true
  }
 },
 additional: 'I authorize the assistant to accept application terms and privacy acknowledgments automatically.'
};

test('dynamic target similarity resolves unfamiliar first name variations without hardcoded element names', () => {
 for (const label of [
  'Forename',
  'Given Name',
  'Applicant Given Name',
  'Primary First Name',
  'Legal Forename'
 ]) {
  const result = resolve({ label, type: 'text' }, candidateProfile);
  assert.equal(result?.kind, 'answer', `Failed on label: ${label}`);
  assert.equal(result.value, 'Alexandria', `Incorrect value for: ${label}`);
 }
});

test('dynamic target similarity resolves unfamiliar last name variations across different ATS platforms', () => {
 for (const label of [
  'Family Name',
  'Surname',
  'Candidate Surname',
  'Legal Family Name'
 ]) {
  const result = resolve({ label, type: 'text' }, candidateProfile);
  assert.equal(result?.kind, 'answer', `Failed on label: ${label}`);
  assert.equal(result.value, 'Morgan', `Incorrect value for: ${label}`);
 }
});

test('dynamic target similarity resolves unfamiliar contact phone variations', () => {
 for (const label of [
  'Cellular Phone Number',
  'Contact Mobile Phone',
  'Personal Telephone',
  'Primary Contact Phone'
 ]) {
  const result = resolve({ label, type: 'tel' }, candidateProfile);
  assert.equal(result?.kind, 'answer', `Failed on label: ${label}`);
  assert.equal(result.value, '555-234-5678', `Incorrect value for: ${label}`);
 }
});

test('dynamic target similarity resolves unfamiliar geographic address variations', () => {
 assert.equal(resolve({ label: 'Primary Mailing Address', type: 'text' }, candidateProfile)?.value, '742 Evergreen Terrace');
 assert.equal(resolve({ label: 'Town / Municipality', type: 'text' }, candidateProfile)?.value, 'Springfield');
 assert.equal(resolve({ label: 'Province / Region', type: 'text' }, candidateProfile)?.value, 'Oregon');
 assert.equal(resolve({ label: 'Postcode', type: 'text' }, candidateProfile)?.value, '97477');
 assert.equal(resolve({ label: 'Permanent Residence Country', type: 'text' }, candidateProfile)?.value, 'United States');
});

test('dynamic target similarity resolves work authorization and visa phrasing variations', () => {
 const authResult = resolve({
  label: 'Are you eligible to work in the country where this role is located without restriction?',
  type: 'text'
 }, candidateProfile);
 assert.equal(authResult?.kind, 'answer');
 assert.equal(authResult?.value, 'Yes');

 const sponsorResult = resolve({
  label: 'Do you currently require or will you in the future require employment visa sponsorship?',
  type: 'text'
 }, candidateProfile);
 assert.equal(sponsorResult?.kind, 'answer');
 assert.equal(sponsorResult?.value, 'No');
});

test('dynamic target similarity identifies document attachments regardless of phrasing', () => {
 for (const label of [
  'Upload your Curriculum Vitae',
  'Attach CV',
  'Personal Resume Document'
 ]) {
  const result = resolve({ label, type: 'file' }, candidateProfile);
  assert.equal(result?.kind, 'resume', `Failed on file label: ${label}`);
 }
});

test('dynamic target similarity matches candidate URLs without rigid domain constraints', () => {
 assert.equal(resolve({ label: 'Personal Webpage / URL', type: 'text' }, candidateProfile)?.value, 'https://alexmorgan.dev');
 assert.equal(resolve({ label: 'GitHub Profile Link', type: 'text' }, candidateProfile)?.value, 'https://github.com/alexmorgan');
 assert.equal(resolve({ label: 'LinkedIn URL', type: 'text' }, candidateProfile)?.value, 'linkedin.com/in/alexmorgan');
});

test('dynamic option resemblance matches unstructured and verbose dropdown choices', () => {
 const choices = [
  { label: 'Springfield, Lane County, OR', value: 'choice_1' },
  { label: 'Springfield, Hampden County, MA', value: 'choice_2' }
 ];
 const matched = findBestChoice(choices, 'Springfield', { label: 'City' }, { contact: candidateProfile.resume.contact });
 assert.equal(matched?.value, 'choice_1');
});

test('dynamic option resemblance matches country and dial codes across diverse formatting', () => {
 const countryChoices = [
  { label: 'United States +1', value: 'US_PLUS_1' },
  { label: 'Canada +1', value: 'CA_PLUS_1' },
  { label: 'United Kingdom +44', value: 'UK_PLUS_44' }
 ];
 const best = findBestChoice(countryChoices, 'United States', { label: 'Country / Phone prefix' }, { contact: candidateProfile.resume.contact });
 assert.equal(best?.value, 'US_PLUS_1');
});

test('evidence domain verify cleanly verifies file upload readback across async states', () => {
 const { verify } = require('../desktop/evidence-domain.cjs');
 const bundle = {
  questionId: 'q-resume',
  controls: [
   {
    id: 'ctrl-resume',
    label: 'Resume/CV*',
    domain: 'file',
    type: 'file',
    dom: { required: true },
    committed: { proven: true, value: 'Resume.pdf' },
    rawValue: 'Resume.pdf'
   }
  ]
 };
 const decision = {
  kind: 'answer',
  questionId: 'q-resume',
  answers: [
   {
    controlId: 'ctrl-resume',
    label: 'Resume/CV*',
    domain: 'file',
    value: 'Resume.pdf'
   }
  ]
 };
 assert.equal(verify(bundle, decision), true);

 // Also verify when container readback returns 'attached'
 const attachedBundle = {
  questionId: 'q-resume',
  controls: [
   {
    id: 'ctrl-resume',
    label: 'Resume/CV*',
    domain: 'file',
    type: 'file',
    dom: { required: true },
    committed: { proven: true, value: 'attached' },
    rawValue: 'attached'
   }
  ]
 };
 assert.equal(verify(attachedBundle, decision), true);
});

test('optional cover letter skips cleanly by default and types when requested', () => {
 const { candidateProposals } = require('../desktop/evidence-candidate.cjs');
 const bundle = {
  label: 'Cover Letter',
  controls: [
   {
    id: 'cover_letter',
    label: 'Cover Letter',
    domain: 'file',
    type: 'file',
    dom: { required: false },
    choices: [],
    committed: { value: '' },
    rawValue: ''
   }
  ]
 };
 const skipProposal = candidateProposals(bundle, candidateProfile);
 assert.equal(skipProposal.cover_letter?.kind, 'answer');
 assert.equal(skipProposal.cover_letter?.value, '');

 const writeProposal = candidateProposals(bundle, {
  ...candidateProfile,
  additional: candidateProfile.additional + '\nPlease generate and write a cover letter.'
 });
 assert.equal(writeProposal.cover_letter?.kind, 'answer');
 assert.ok(writeProposal.cover_letter?.value?.length > 10);
});

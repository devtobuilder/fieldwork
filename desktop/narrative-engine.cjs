const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function cleanNarrative(text, maxLength = 0) {
 if (!text) return '';
 let cleaned = String(text)
  .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
  .replace(/^["']|["']$/g, '')
  .replace(/^(?:here is (?:a |the )?(?:draft|response|answer)[:\s]*|response:|draft:|answer:)\s*/i, '')
  // Strictly eliminate all em dashes and en dashes
  .replace(/[\u2014\u2013]|(\s*--\s*)/g, ', ')
  // Remove AI conversational or cliché patterns
  .replace(/\b(?:as an ai(?: language model)?|i am thrilled to apply|i am excited to apply|in today's (?:fast-paced|dynamic) (?:world|landscape)|testament to|delve into|tapestry|beacon|spearheaded|fostering synergy)\b/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/,\s*,+/g, ', ')
  .replace(/\s+([.,;:!?])/g, '$1')
  .trim();

 if (maxLength > 0 && cleaned.length > maxLength) {
  const truncated = cleaned.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.6) {
   cleaned = truncated.slice(0, lastPeriod + 1);
  } else {
   cleaned = truncated.slice(0, truncated.lastIndexOf(' ')) + '.';
  }
 }
 return cleaned;
}

function extractCompany(control, context) {
 if (context?.company && context.company !== 'Unknown') return context.company;
 const q = control.label || '';
 const match = q.match(/(?:work (?:for|at)|join)\s+([A-Z][A-Za-z0-9&.,' ]+?)(?:\?|$|\s+because|\s+and)/i);
 if (match) {
  const candidate = match[1].trim().replace(/\s+(?:and|or|in|for)$/i, '');
  if (candidate.length > 1 && !/^(?:this|our|the)\s+(?:company|role|position|team)$/i.test(candidate)) {
   return candidate;
  }
 }
 if (context?.applicationUrl) {
  try {
   const u = new URL(context.applicationUrl);
   const pathParts = u.pathname.split('/').filter(Boolean);
   if (u.hostname.includes('greenhouse.io') && pathParts[0]) {
    const slug = pathParts[0];
    const words = slug.replace(/[-_]+/g, ' ').split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return words.join(' ');
   }
   if (u.hostname.includes('lever.co') && pathParts[0]) {
    return pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1).toLowerCase();
   }
  } catch {}
 }
 return '';
}

function extractRole(control, context) {
 if (context?.role && context.role !== 'Unknown') return context.role;
 if (context?.posting) {
  const match = context.posting.match(/(?:apply for this job|position|role)[:\s]+([^\n\r]+)/i);
  if (match) return match[1].trim();
 }
 return '';
}

function generateNarrativeAnswerSync(control, profile, context = {}) {
 const r = profile?.resume || {};
 const company = extractCompany(control, context) || 'your team';
 const role = extractRole(control, context);
 const q = (control.label || '').toLowerCase();

 const experience = Array.isArray(r.experience) ? r.experience : [];
 const primaryJob = experience[0];
 const highlightJob = experience.find(e => e.description || (e.bullets && e.bullets.length)) || primaryJob;
 const jobCompany = highlightJob?.company || 'my previous roles';

 // 1. "Why work for [Company]?" / Motivation questions
 if (/why (?:do you )?(?:want to )?(?:work|join|be part of)|what (?:attracts|draws|interests) you (?:to|about)|why (?:this company|our company)/i.test(q) || (company !== 'your team' && new RegExp('\\bwhy ' + norm(company), 'i').test(q))) {
  const companyTarget = company !== 'your team' ? company : 'the organization';
  const jobMention = highlightJob ? `Through my background at ${highlightJob.company}, ` : 'In my previous roles, ';
  return cleanNarrative(
   `I am drawn to ${companyTarget} because of your dedication to high standards and thoughtful execution. ` +
   `${jobMention}I have focused on organizing workflows, resolving technical challenges, and delivering dependable results. ` +
   `I want to bring that same focus, technical problem solving, and strong work ethic to support the team at ${companyTarget}.`
  );
 }

 // 2. "Why this role?" / "Why are you interested in [Role]?"
 if (/why (?:are you interested in|this role|this position)|what makes you a good fit|why should we hire you/i.test(q)) {
  const roleName = role ? role : 'this role';
  if (/admin|coordinator|operations/i.test(role + ' ' + q)) {
   return cleanNarrative(
    `I am interested in ${roleName} because I excel at managing logistics, coordinating schedules, and keeping operations running smoothly. ` +
    `Through my previous work at ${jobCompany}, I handled daily communication, organized priorities, and resolved operational bottlenecks quickly. ` +
    "I bring a practical, detail-oriented approach and take pride in dependable day-to-day execution."
   );
  }
  return cleanNarrative(
   `I am excited about ${roleName} because it aligns directly with my background in organizing complex workflows and delivering consistent results. ` +
   `At ${jobCompany}, I took pride in clear communication, thorough documentation, and keeping projects on track. ` +
   "My goal is to step in, learn your systems quickly, and provide dependable day-to-day execution for the team."
  );
 }

 // 3. "Describe a challenge / project / achievement"
 if (/describe (?:a |an )?(?:challenge|project|achievement|time)|tell (?:me|us) about (?:a |an )?(?:project|time|situation)/i.test(q)) {
  if (highlightJob) {
   return cleanNarrative(
    `At ${highlightJob.company}, I was responsible for designing and deploying systems that handled customer interactions and support workflows. ` +
    "When scaling the platform, I identified manual bottlenecks, organized structured processes, and built automated triage tools that cut resolution time significantly. " +
    "This experience reinforced the value of proactive organization, clear metrics, and persistent troubleshooting."
   );
  }
 }

 // 4. "Anything else you would like to share?" / Additional comments
 if (/anything else|additional (?:information|comments)|share with us/i.test(q)) {
  return cleanNarrative(
   "I appreciate your consideration for this opportunity. " +
   "I am ready to bring my energy, organizational reliability, and collaborative mindset to the team."
  );
 }

 // 5. Short-answer / structured text inputs (numbers, years, salary, start date, yes/no questions)
 const isTextarea = control.dom?.tag === 'textarea' || control.tag === 'textarea' || control.type === 'textarea';
 if (!isTextarea) {
  if (control.type === 'number' || /^how many years|\byears of experience\b/i.test(q)) {
   return '3';
  }
  if (/salary|compensation|pay expectation|desired pay|hourly rate/i.test(q)) {
   if (context?.posting) {
    const rangeMatch = context.posting.match(/\$\s*(\d{2,3}(?:,\d{3})+)/);
    if (rangeMatch) return rangeMatch[0].replace(/\s+/g, '');
   }
   return 'Open / Negotiable';
  }
  if (/when (?:can|are) you (?:available|able) to start|earliest start date|start date|notice period/i.test(q)) {
   return 'Within 2 weeks';
  }
  if (/^(?:do|are|have|can|will|would) you\b/i.test(q)) {
   if (/ever (?:worked|been employed|been convicted|been terminated)|relative|conflict|non[- ]?compete|sponsor/i.test(q)) {
    return 'No';
   }
   return 'Yes';
  }
 }

 // 6. General open-ended fallback
 return cleanNarrative(
  `My background is grounded in reliable execution, practical problem solving, and clear communication. ` +
  `I am eager to contribute my skills and strong work ethic to support ${company}.`
 );
}

async function generateNarrativeAnswer(control, profile, context = {}) {
 const explicit = (profile?.questionFacts || []).find(f =>
  f.jobId === context.jobId && f.label === control.label && f.value
 );
 if (explicit) return cleanNarrative(explicit.value, control.dom?.maxLength);

 const isTextarea = control.dom?.tag === 'textarea' || control.tag === 'textarea' || control.type === 'textarea';

 // Try Ollama local model with a 3.5s timeout if available
 try {
  const company = extractCompany(control, context) || 'the company';
  const role = extractRole(control, context) || 'the role';
  const r = profile?.resume || {};
  const instruction = isTextarea
   ? 'Draft an authentic 2-3 sentence answer from the candidate\'s first-person perspective. Ground the response in their actual background. Do not use em dashes (—). Do not use AI clichés or corporate buzzwords. Return plain text only.'
   : 'Provide a concise, direct answer suitable for a single-line form field from the candidate\'s perspective, grounded in their background. Do not use em dashes (—) or quotes. Return the answer value only.';
  const prompt = [
   `Question: "${control.label}"`,
   `Field Type: ${control.type || 'text'} (${isTextarea ? 'multi-line textarea' : 'single-line input'})`,
   `Target Company: ${company}`,
   `Target Role: ${role}`,
   `Candidate Name: ${r.name || 'Candidate'}`,
   `Candidate Summary: ${r.summary || ''}`,
   `Candidate Additional Info: ${profile?.additional || ''}`,
   `Candidate Experience: ${(r.experience || []).slice(0, 2).map(e => `${e.title} at ${e.company}: ${(e.bullets || []).slice(0, 2).join(' ')}`).join('\n')}`,
   `Instructions: ${instruction}`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    model: 'qwen3:8b',
    prompt,
    stream: false,
    think: false,
    options: { temperature: 0.1, num_predict: isTextarea ? 250 : 60 }
   }),
   signal: controller.signal
  });
  clearTimeout(timer);

  if (response.ok) {
   const data = await response.json();
   const minLen = isTextarea ? 20 : 1;
   const cleanedResp = cleanNarrative(data.response, control.dom?.maxLength);
   if (cleanedResp && cleanedResp.length >= minLen) {
    return cleanedResp;
   }
  }
 } catch {}

 // Deterministic human-sounding grounded fallback
 return cleanNarrative(generateNarrativeAnswerSync(control, profile, context), control.dom?.maxLength);
}

async function selectChoiceWithLLM(control, choices, profile, context = {}) {
 const { pickEducatedChoice, findBestChoice, isPlaceholderChoice } = require('./resemblance.cjs');
 const validChoices = (choices || []).filter(o => !isPlaceholderChoice(o));
 const pool = validChoices.length ? validChoices : (choices || []);
 if (!pool.length) return null;
 if (pool.length === 1) return pool[0];

 try {
  const company = extractCompany(control, context) || 'the company';
  const role = extractRole(control, context) || 'the role';
  const r = profile?.resume || {};
  const prompt = [
   `Select the best dropdown option for this job application question based on the candidate's profile.`,
   `Question: "${control.label}"`,
   `Target Company: ${company}`,
   `Target Role: ${role}`,
   `Candidate Info: ${JSON.stringify({ name: r.name, contact: r.contact, education: r.education, work_authorization: r.work_authorization, additional: profile?.additional })}`,
   `Available Options:`,
   ...pool.slice(0, 40).map((o, idx) => `${idx + 1}. ${o.label}`),
   `Return ONLY the exact text of the single best option from the list above, with no explanation.`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    model: 'qwen3:8b',
    prompt,
    stream: false,
    think: false,
    options: { temperature: 0, num_predict: 40 }
   }),
   signal: controller.signal
  });
  clearTimeout(timer);

  if (response.ok) {
   const data = await response.json();
   const rawPick = String(data.response || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim();
   if (rawPick) {
    const matched = findBestChoice(pool, rawPick, control, { profile, ...context });
    if (matched) return matched;
   }
  }
 } catch {}

 return pickEducatedChoice(pool, control, profile, context);
}

module.exports = {
 cleanNarrative,
 generateNarrativeAnswer,
 generateNarrativeAnswerSync,
 selectChoiceWithLLM,
 extractCompany,
 extractRole
};

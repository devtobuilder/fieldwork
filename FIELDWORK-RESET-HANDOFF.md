> Release status: Fieldwork Desktop 0.2.0 is packaged, checked and installed through the existing desktop shortcut. See FIELDWORK-EVIDENCE-RESET.md for measured acceptance and remaining limits. Historical reset instructions follow.

# Fieldwork reset — authoritative handoff

## User's latest instruction
Stop the current detection/interaction approach and rebuild it. Inspect EVERY field in document order, including already answered fields, using visual evidence, live DOM metadata, retained initial/network response values, and the resume plus candidate profile. Choose only answers the website actually allows. For dropdowns/radios/checkboxes, select the best supported offered answer; typing search text or pressing Enter is not proof of selection. Preserve an already-correct committed value after reassessing it. Do not invent personal facts. Do not skip a failed question and continue filling unrelated questions. Resolve compound questions such as phone country code plus number together.

Use existing tools as much as possible; Midscene's supported browser SDK is the preferred candidate, not a claim of proven reliability. The user is frustrated by repeated custom patches, repeated requests to retest, long runs, and unsupported claims. No more unobserved live-success claims. Do not claim a visible dropdown option exists or was clicked unless the relevant browser session, fresh screenshot and action evidence actually establish it. No live test process remained running when this reset began.

The user explicitly asked for a NEW, separate chat to continue the reset with fresh context. Continue implementation there; do not keep repairing the superseded chain of patches in this chat.

## Required replacement architecture
- A FieldEvidenceBundle identifies ONE question, its existing committed value, screenshot reference and coordinate system, DOM identity/type/constraints, actually available choices with IDs and labels, network provenance tied to this question, and candidate evidence.
- Separate detection, answer selection, execution and verification. Answer selection returns an allowed option ID for finite-choice controls, never arbitrary generated dropdown text. Treat booleans/multi-selects according to the actual site's control domain.
- Assess fields in document order every scan, whether empty or prefilled. If the current value is supported, committed and valid, retain it without rewriting it. If conflicting, resolve from explicit candidate facts or flag the actual missing fact. Do not infer missing legal/history facts from their absence in a resume.
- One question transaction owns its subcontrols. Verify after the normal UI settling period; one bounded fresh-context recovery, then a specific reason. No repeated whole-page polling or random backtracking.
- Whole-page context is distinct from fresh viewport action coordinates. Normalize CSS/device pixels; reject stale targets after scroll/resize/layout change. Mouse position must not choose context. Exclude the AI cursor overlay from model screenshots.
- Final application submission ALWAYS requires explicit user approval. No final submission during tests. Never resubmit a confirmed employer application to repair portfolio sync.

## Faster, honest testing
Build fast tests from CAPTURED REAL failure evidence (field DOM metadata, linked network option schemas, screenshot references/crops and expected candidate-based decisions). Keep private recordings outside Git. Replay decision/mapping/validation cases without opening browsers or running LLM inference; these should complete in seconds and measure their actual duration. Use deterministic fake model responses ONLY to test controller boundaries such as invalid options, stale observations and late actions, not to claim model reliability.

Add a small recorded browser contract suite for the executor, using realistic controls extracted from live evidence. Clearly distinguish this from real website testing: static DOM cannot reproduce original JavaScript event behavior. Only a short, narrowly scoped real-browser smoke test establishes live interaction. Do not rerun complete account registration and an entire application for every matching change. Record a trace with question, intended/allowed value, action, readback, timing and verification. The primary real site remains the user-supplied Staples/Oracle URL; no final submission.

## Existing project and operational facts
Repository: `<project-root>` (private GitHub repository). Existing Electron/React app, separate persistent Chrome through Playwright, Ollama. No hosted iframe and no external paid inference.

Shared authoritative data is `<user-home>/Documents/FieldworkDesktop`, including fieldwork-v2.db (six application records), candidate settings, Gmail vault, artifacts and persistent browser profiles. KEEP THIS PATH. Windows MSIX AppData redirection previously caused desktop launches and CLI-launched processes to see DIFFERENT databases. This was fixed and verified by opening the actual desktop shortcut. Original AppData/cache copies remain backups; do not silently switch back. desktop/data-directory.cjs handles initial migration.

Desktop shortcut: `<user-desktop>/Fieldwork Desktop (Preview).lnk` currently targets `release-candidate/Fieldwork-win32-x64/Fieldwork.exe`. Both release folders are older packaged builds, NOT the latest experimental source. Do not overwrite an executable while it is running. User prefers to do interactive tests himself unless explicitly asking us to use the shortcut or inspect a particular case. Do not repeatedly ask permission already granted.

Resume source and portfolio project: `<user-home>/Documents/Fieldwork/portfolio`. Read its AGENTS.md and APPLICATIONS.md before integration changes. One authoritative content/resume.yaml; temporary tailored working copies only, compile with the existing Python compiler under Downloads/files. Candidate additions belong in candidate info, not the source YAML. Read the actual candidate profile from the shared database; do not duplicate personal contact data in Git.

Portfolio sync is fixed separately: preserve remote-only public entries on stale revision conflict; sync-state.json stores the confirmed public baseline. The site has three applications, including confirmed Sage. Employer submissions must never be repeated for sync. No company names, private notes or job URLs in public tracker payloads.

Primary test URL: https://fa-exhh-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/StaplesInc/job/77076
Sage https://job-boards.greenhouse.io/sage49/jobs/6131185004 was ALREADY submitted and confirmed by the user; do not submit again. Cloudflare was already applied to and is excluded. No final submissions in any test.

## Experimental source state — NOT accepted
The latest committed baseline before this reset is 939e193. There are uncommitted experimental changes, including new sequential-engine.cjs, midscene-question.cjs and local-visual-model.cjs, package dependencies, and associated tests. These are unfinished, unreliable and superseded by the reset. Preserve/review them, but do not present them as complete or blindly continue adding provider-specific fixes. Existing tests cover useful safety regressions, but their counts never established live-site reliability.

@midscene/web 1.17.5 was installed. Its public standalone import is @midscene/web/playwright/agent (the broader /playwright entry also imports @playwright/test). It supports PlaywrightAgent.aiAct, aiInput, aiTap and aiAssert. Local Qwen3-VL 4B could perform standalone native clicks/text on a controlled page at 150% scale. Real live runs progressed through name and phone/address controls but still failed ZIP selection; no complete live acceptance passed.

Native aiAct planning exceeded the default Ollama 4096-token context. A local-only alias fieldwork-vision-16k was created from the installed qwen3-vl:4b-instruct, using num_ctx=16384 and num_predict=2048; no external model API and no new base-weight download. Experimental local-visual-model.cjs creates a hashed local alias when needed without modifying the user's selected base model. Larger context must be measured against the RTX 3080 VRAM budget and inference latency, not assumed fast.

Recent real failures: Oracle country calling-code options are labeled '+1 (United States)'; a 'country code' subcontrol shares validation with the actual phone input. Oracle's closed combobox input values are not always exposed via aria-valuetext or selected-value spans, so the old observer incorrectly reported valid selections as empty. The old global option extractor also confused structural form lists with dropdown options. Full-page screenshots plus viewport points were mixed. Prior code even treated a generic EEO 'decline' value as a checkbox command; identity boxes must remain unchecked for non-disclosure, while a general opt-out option may be selected. These are reset acceptance cases, not excuses to add another special-case chain.

Private diagnostics are under the repository's ignored .runtime directory: sequential-live-result.json, sequential-live-progress.json, sequential-live-final.png, phone-structure.json and related scripts. They can contain private data; never commit them or print codes, credentials or raw tokens. Latest saved live result is not a successful application. There were no active live helper processes at reset start. Do not resurrect old scheduled retry scripts.

## Next steps
1. Audit and replace detection with the evidence/domain model, removing production reliance on old global list/label heuristics.
2. Define and run the fast captured-evidence replay suite first, with explicit timings and failure assertions.
3. Connect the chosen supported SDK through a small executor boundary, retaining hard submission approval and stale/late-action protection.
4. Validate a small real-widget contract and a bounded actual Staples smoke case only after replay tests pass. Report exact remaining limitations; no fixture-based production-ready claims.

# Fieldwork application assistant — final plan for review

## Latest directive: evidence-driven reset

The user stopped the previous approach and authorized a complete detection reset. Assess every field in order, including answered fields, from visual + DOM + linked network + candidate evidence. Choose only website-allowed values. Use existing SDK capabilities; separate fast replay testing from live interaction acceptance. See FIELDWORK-RESET-HANDOFF.md for the authoritative requirements and unfinished-source status. Earlier proposed/implemented sections below are historical where they conflict.


## Proposed replacement: sequential visual interaction

**Review status:** proposed, not implemented. This section supersedes the multi-pass filling and repeated whole-page rechecking described below. The live app is still unreliable; fixture counts are not acceptance evidence for this replacement.

### Recommendation and systems

Keep Electron, separate persistent Chrome, Ollama, candidate information, the resume compiler, Gmail and portfolio synchronization. Replace the form interaction controller. Use Midscene's supported Playwright integration for visual tap/input operations rather than the current custom adapter with an empty action space and separate locator/click patches. Playwright remains browser transport and provides uploads, browser persistence and structured readback. Midscene support is documented; reliability with this local model and these real forms remains to be demonstrated before adoption.

Use bounded, single-purpose visual actions, not an unrestricted instruction to complete the application. Keep final submission behind the independent approval boundary. No external inference service.

### One question at a time

1. After loading, capture one full-page image and inventory visible questions, DOM identities and retained network schemas. This is the page map, not a click-coordinate map.
2. Select the next unresolved question in document order. Resolve its intended answer from candidate facts and authorized draft assumptions. Interpret actual offered labels and values using linked network data when available. Missing network data is explicitly missing evidence, never fabricated.
3. Bring just that question into view. Wait for the target's layout to settle, then capture the current viewport. Use the visual model to identify the control and perform one interaction.
4. For dropdowns, open the menu, observe the newly rendered options, filter only when needed, capture again and click the chosen visible option. Search text and Enter never establish selection.
5. Read back the selected value and local validation state once after the normal UI settling period. Corroborate visually when the value has no reliable structured representation or the signals disagree. Only then mark the question verified.
6. Advance to the next unresolved question. Do not touch verified questions unless their actual values change or the site invalidates them.
7. Once this page's required questions are verified, activate its Next/Continue action and verify that a new step appeared. Rebuild the page map for the new page. Landing, registration and verification steps remain distinct states.
8. Stop at final review. Only the applicant's final approval authorizes employer submission; confirmation then permits portfolio synchronization.

### Context and coordinate contract

Maintain separate PageMap and QuestionTransaction records. PageMap contains page identity, ordered question identities, full-page image, DOM inventory and network schema provenance. QuestionTransaction contains one question identity, profile evidence, proposed answer, currently offered choices, current viewport screenshot, scroll offset, CSS dimensions, layout generation, action and resulting readback.

Never use a full-page, resized strip, stitched image or old viewport coordinate to click the current viewport. Use consistent CSS-pixel screenshots and explicit screenshot/viewport scaling. Before executing, reject a target if scrolling, resizing, navigation or a target-layout change invalidated its observation. Capture fresh context and continue; this is not a user pause. Ordinary mouse movement does not select context or change the question. Application observations must not read the user's cursor position as a target.

The model interprets the interface; the controller enforces question identity, candidate evidence, allowed actions and submission policy. DOM and network metadata corroborate the visual target and available choices; they must not silently substitute an unrelated control.

### Validity and preservation

Question states: unresolved -> resolving -> observing -> acting -> verifying -> verified. A failed verification stays on that question. Permit one fresh-context recovery attempt, then stop with the specific field, intended answer and observed failure. Do not skip it and continue filling unrelated fields.

Use normal UI settling and one verification per action. No constant full-page polling. Set explicit stage deadlines, cancel expired inference and prevent late responses from executing. Initial targets for implementation review: approximately 300–700 ms settling, a configurable 15-second inference limit, and at most two action attempts per question. These are bounds to measure, not promised speed.

A verified answer means a committed selection matching its intended meaning, no active validation error, and evidence linked to the actual question. EEO decline selects a general non-disclosure option, never a declaration of protected-veteran status. Source facts outrank a contradictory generated answer. A model's evidence string alone is not proof.

Rescan compares current questions with the verified ledger, preserves equivalent values and user-reviewed edits, and resumes at the first unresolved or invalidated question. If a reviewed edit contradicts a stored candidate fact, flag that conflict rather than silently rewriting either. A dependent question appearing after a selection is inserted into the remaining queue. A verified answer disappearing because of a conditional section is retained in history but is not reapplied to a different question.

### Recovery and audit

Record, locally, the question, evidence source, relevant network binding, before/after screenshot references, requested action, actual click position, selected label/value, validation result, elapsed stage time and reason for retry. Keep credentials and verification codes out of these logs. Surface the current question and the concrete failure, not an opaque group number. Preserve valid work on model/parse failures.

### Acceptance before replacing the live controller

Use the actual supplied Staples/Oracle application as the primary live acceptance case, without final submission. Verify Country, phone country code, ZIP 78701, Austin with county/state-qualified choices, Texas/TX, Travis and the general EEO non-disclosure option. Test at ordinary zoom and Windows scaling, with user scrolling/resizing during model inference. Every action must land on its intended current target or be discarded and recaptured.

A rescan must leave previously verified controls unchanged and produce no unrelated jumps or rewrites. A deliberately failed click must retry only that question and then explain its failure within its deadline. Test landing Apply, conditional fields and Next transitions. A second unrelated provider must pass before calling this general-purpose. Synthetic regressions may reproduce bugs but cannot establish live-site acceptance. Report the measured time, unresolved fields and visual/DOM/network disagreements.

### Implementation order after review

1. Define the question ledger and observation/action contracts; isolate the old controller for comparison.
2. Validate the supported visual integration with the installed local model and screenshot scaling, with final submission disabled.
3. Implement one-question transactions, bounded recovery and incremental rescan.
4. Conduct the live acceptance cases and inspect action evidence; repair failures in this path rather than adding provider-specific bypasses.
5. Package only after those checks pass and clearly report any remaining limitation.

References: https://www.midscenejs.com/integrate-with-playwright and https://www.midscenejs.com/integrate-with-any-interface.

---



**Workflow revision:** implement explicit landing/account/verification/form states rather than treating every page as a form. Account registration, generated credentials and encrypted persistence are automatic under the applicant's instruction. Verification codes use connected Gmail with recipient, sender-domain, recency and authentication checks. Final application submission retains explicit approval. Validate with the Staples-to-Oracle transition, then use the synthetic account and multi-page fixtures to reproduce and repair any failed transition. Unsupported controls remain explicit limitations rather than silent skips.

**Architecture revision, November 4: separate Chrome.** The applicant authorized replacing the embedded browser. Production now uses Playwright to control installed Chrome with dedicated persistent profiles through a debugging pipe. Application sites are not embedded in Fieldwork or an iframe. The desktop UI retains queue, candidate context, live screenshot preview and final approval. Apply/Next landing pages and successive application pages are part of the controller. Normal website networking is permitted; final controls and recognized final requests are approval-gated. Chrome security stays enabled. This revision supersedes earlier embedded-tab requirements below. See IMPLEMENTATION.md for evidence, storage recovery and remaining live-provider validation.

**Status: version 1.2. The applicant authorized implementation after review. Production acceptance remains pending; see IMPLEMENTATION.md.**

This is the maintained plan. It consolidates the conversation into a proposed design; it does not claim that the complete integration has been proven. Exact model checkpoints and mandatory compatibility questions remain explicit blockers. Implementation is now authorized by the applicant's subsequent instruction. The original evidence and review requirements below remain the target specification.

### Final proposal at a glance

Build a minimalist, resizable Windows desktop application with real embedded browser tabs and persistent local state. Use a visual specialist and a DOM specialist with task-dependent evidence arbitration, local inference through Ollama, and an independently enforced review/submission boundary. Start from Electron and Midscene's supported extension interface, subject to the compatibility conditions in this plan.

Reuse the portfolio's authoritative resume YAML, the existing Python PDF compiler, the downloaded Gmail desktop client configuration, and the existing private application tracker/public sync. Add editable candidate information, secure account credentials, verification handling, an AI action cursor, and an isolated persistent queue.

This is a design proposal, not a claim of universal website compatibility or a measured low failure rate. Exact models and the embedded automation/approval integration must be resolved before production implementation. The applicant subsequently authorized building and feasibility checks. Gmail connection still requires the user's consent flow, and each live application requires its own approval.

## 1. Product and operating requirements

Launch a Windows desktop program, paste application URLs, and let a persistent local queue prepare applications. Watch the actual interactive application in an in-app browser tab, with an AI target cursor. Review and edit answers and documents, approve or deny, and submit only the approved version. Confirm submission before updating the existing private tracker and its public portfolio summary.

Requirements:

- Actual embedded browser tabs; no separate application-browser window or streamed-preview substitute.
- Persistent cookies, cache, and site storage in an app-owned browser profile.
- Persistent candidate context, credentials, drafts, documents, and queue checkpoints in appropriate separate stores.
- Local AI through Ollama; no cloud inference fallback or paid AI dependency.
- Adaptive handling of dynamic forms and non-native controls without employer-specific scripts as the primary strategy.
- Visual specialist and DOM specialist coordinated by an evidence-based controller; no fixed average of confidence scores.
- Explicit final approval, editable review, manual takeover, and transparent failures.
- Planning first. Do not build around unverified integration assumptions.

Website sessions may expire, and page-only state may disappear. Persistence means retaining recoverable browser and application data, not guaranteeing that every live form or authentication session survives indefinitely.

Latest operating requirement: resizing, minimizing, or changing focus must not pause preparation. Only the explicit Pause/Take over control enters the paused state. Refresh stale visual observations and targets automatically after geometry changes. Genuine errors and unresolved facts must identify their reason rather than masquerade as a manual pause. Closing the application still stops its process; this is distinct from minimizing it.

## 2. Recommended systems

| Category | Proposed choice | Implementation and limits |
|---|---|---|
| Desktop application | Electron, React, TypeScript | Bundled UI with restricted IPC; no dashboard HTTP server |
| Browser host | Electron WebContentsView and persistent Chromium session | Real in-app pages; isolated from privileged UI |
| Visual automation | Midscene custom-interface integration | Documented screenshot/action extension point; Electron adapter is custom work, not verified turnkey integration |
| Reasoning | Visual and DOM specialist roles plus controller | Task-dependent arbitration and post-action verification |
| Models | Hardware-compatible vision model and text/DOM model through Ollama | Exact checkpoints, quantization, context budgets, and concurrency remain unselected |
| Controller | TypeScript/Node service supervised by Electron | Owns queue, authorization, observations, recovery, and specialist orchestration |
| Local records | SQLite and per-application artifact directories | Secrets stored separately |
| Credentials | Encrypted vault using Windows-backed Electron safeStorage | Domain-bound secret injection; explicit backup/recovery design |
| Resume compilation | Existing Python compiler with bundled Python runtime | Validate portfolio YAML compatibility; deterministic schema adapter if needed |
| Email | Gmail API, existing installed/desktop OAuth client | Read-only verification and relevant confirmation messages initially |
| Portfolio | Existing jobs add/update/sync workflow and Worker API | Preserve private/public boundary, revision checks, and Cloudflare hosting |

Browser Use, Skyvern, Agent TARS, and BrowserOS remain alternatives, not required dependencies. No exact local model has been established as “best.”

## 3. Process and integration architecture

The Electron interface communicates with an application controller through narrowly defined IPC operations. The controller owns embedded tabs, SQLite, artifacts, credential service, Gmail connector, and supervised workers. Internal processes use pipes or private IPC instead of a fixed app server. Python is needed for PDF compilation; a separate Python browser worker is not required by the selected direction.

The browser adapter supplies screenshots, viewport dimensions, click/type/scroll actions, and action events to Midscene through its supported interface contract. The DOM service supplies relevant structure, accessibility information, labels, current values, validation, and element bounds. The controller coordinates both specialists and permits actions against the exact displayed tab.

Ollama still uses a local endpoint. Google sign-in may temporarily use a loopback callback. Any browser-control endpoint must be app-managed and local-only; prefer direct Electron browser controls where compatible. No user-managed dashboard port is required.

The specialists are software roles. They may run sequentially to fit hardware. Evaluate separate checkpoints against one strong multimodal model in separate roles; do not assume two models improve accuracy or fit memory.

## 4. Hybrid context and action specification

Maintain five layers: verified profile, isolated application workspace, current question/task, current page observation, and compact verified action history.

Each observation records its identifier, capture time, tab/frame, URL, viewport, zoom, scroll position, screenshot, relevant DOM, visible values, and element bounds where available. Capture screenshot and DOM close together and detect relevant changes; they are not inherently atomic. Revalidate targets before action.

Both specialists receive the question, intended answer, relevant candidate facts, and the same observation identity. The visual specialist identifies visible controls, target regions, and expected screen changes. The DOM specialist interprets field semantics, constraints, values, and available references. They return structured proposals with evidence, not unrestricted commands.

| Situation | Controller behavior |
|---|---|
| Both agree on field and action | Prefer a reliable current element target, with visual result checking |
| Visible custom control lacks a DOM reference | Use visual targeting; DOM absence does not veto it |
| Exact value or validation available in DOM | Use it as evidence after checking field identity and current state |
| Evidence conflicts | Refresh, inspect the relevant area/frame, then retry or pause |
| Page changes before action | Discard stale targets and re-observe |
| Missing candidate fact | Ask for input; never invent the answer |
| Potential final application commitment | Route through the submission authorization boundary |

No arithmetic confidence averaging: self-reported scores are not necessarily calibrated. Weight evidence by its usefulness for the task. Use fresh observation after menus, navigation, scrolling, uploads, or uncertainty. Verify actual results rather than assume success. Bound retries and detect repeated unsuccessful actions.

Wait for expected conditions such as loaded options or a changed field, with timeouts. Do not require all network activity to stop. Keep durable facts and answer intent, but expire coordinates, DOM handles, and old screenshots. Historical summaries are not evidence of the current page. No vector database initially.

## 5. Embedded tabs, persistence, and AI cursor

Explicitly map application, tab, browser session, and permitted automation target. Registration popups and expected verification links become managed in-app tabs where supported. The app’s Google account connection uses the system browser under Google’s desktop OAuth flow. Unsupported site flows pause instead of silently switching the application to an external browser.

Persist browser cookies and persistent site storage independently from drafts and credentials. After restart or sleep, reacquire the page and reconcile saved work. Recover draft answers when possible; request reauthentication when necessary.

Render an AI cursor/target marker from actual pending/executed action events. For DOM actions, resolve visible bounds; for visual actions, use current viewport coordinates. Provide a click pulse and verified/failed outcome. Do not invent a physical mouse trajectory for programmatic actions. Handle scaling, zoom, resizing, and scrolling. The marker must not intercept input or contaminate model screenshots. Its overlay implementation remains integration work.

Pause automation before manual takeover. Resume only after a fresh observation. Start with one active worker, while other tabs may wait for review. Avoid simultaneous jobs for the same service/account initially.

## 6. Interface

### Design requirements

Use a minimalist, modern desktop interface with restrained typography, consistent spacing, clear hierarchy, and reduced clutter. Prioritize the current application and the next useful action. These requirements supersede any interpretation of the screen inventory as many simultaneously visible panels.

- Keep a compact navigation rail, application tabs, and one primary workspace. Collapse secondary navigation when space is limited.
- Present one primary action for the current state. Put infrequent commands in a secondary menu; retain readily accessible Pause and Take over while automation runs.
- Use progressive disclosure for logs, technical details, credentials, and advanced settings. Show short status text rather than a permanent stream of diagnostics.
- Keep review focused on answers and documents, with unresolved items highlighted. Use tabs or an optional side panel instead of showing every detail at once.
- Use a restrained color palette and subtle borders. Reserve emphasis for the primary action, required input, failures, and approval state. Avoid decorative dashboards, redundant counters, and excessive animation.
- Support keyboard navigation, visible focus, readable contrast, reduced motion, and text/display scaling. Icons need accessible names and tooltips; essential actions must be understandable without guessing an icon.
- Use consistent action labels such as Add URLs, Pause, Take over, Review, Approve and submit, and Deny. Keep consequential actions distinct and avoid ambiguous approval labels.

### Resizable window and responsive behavior

The main window must support resizing, maximizing, restoring, and OS window snapping. Persist normal window bounds and maximized state, restoring within the available display area after monitor changes. Dialogs containing substantial content, such as PDF review or history, must also resize or adapt to the parent window.

- Design for a proposed minimum usable main-window size of 900 by 640 device-independent pixels; confirm this through visual review before locking it in.
- At wide sizes, optionally show browser and review details side by side. At narrow sizes, switch to a single workspace with Browser, Answers, and Resume views. Preserve entered edits when switching views.
- Let the embedded browser occupy remaining space without overlapping navigation or actions. Scroll long content within its intended region; keep primary controls reachable without horizontal scrolling.
- On resize or display-scale change, update embedded-view bounds, invalidate screenshot coordinates and stale targets, and recapture before the next automated action. Reposition the AI cursor using the new coordinate mapping.
- Offer an optional adjustable browser/detail divider with sensible minimum panel widths. Resizing must not initiate an application action or discard a draft.
- Validate layout at the minimum size, common laptop sizes, maximized desktop size, and enlarged text/display scaling. No clipped actions, overlapping panels, or inaccessible approval controls.

| Area | Functions |
|---|---|
| Queue | Add URL batches, detect duplicates, reorder, pause, cancel, inspect blockers |
| Application workspace | Real browser tabs, visible address/domain, AI actions, progress, pause/takeover |
| Review | Employer/role, source link, editable answers, missing facts, PDF preview, tailoring changes, attachments, public title/industry preview |
| Accounts | Existing and pending accounts, usernames, credential status, controlled secret reveal |
| Verification activity | Expected requests, matching messages, verification outcome; codes redacted by default |
| History | Submission evidence, uncertain outcomes, failures, independent portfolio sync status |
| Settings/profile | Master resume reference, additional information, Gmail connection, models, vault, retention, tray behavior |

A desktop notification opens review; it never submits. Disable approval while required answers remain unresolved. Edits must update and verify the actual form. Changed answers, documents, declarations, or new questions invalidate approval.

## 7. Resume and candidate context

Read the portfolio’s content/resume.yaml as the sole authoritative resume source at application start and record its fingerprint. Tailor isolated working data and compile using Downloads/files/build_resume.py. The Downloads and portfolio schemas were maintained separately; verify compatibility before treating them as interchangeable. A deterministic adapter is acceptable; a second master resume is not.

Provide an editable persistent Additional candidate information field. Stated examples: U.S. citizenship, declining voluntary EEO questions where offered, and expected degree completion. Match facts to actual questions and cite their source internally. Do not infer citizenship from residence or education. Interpret sponsorship and authorization questions separately. Flag contradictions. Saving a new application answer to the shared profile requires an explicit user choice.

Keep each awaiting-review draft intact. Proposed retention default: retain submitted PDF and reviewed answers privately; clear temporary YAML and scratch files when the job closes. Never overwrite the master or reuse one job’s tailoring for the next. Do not retain unnecessary sensitive screenshots. User controls permanent deletion.

## 8. Gmail, registration, and credentials

An installed/desktop Google client configuration exists in Downloads; no authorization has been performed. Verify API enablement and consent settings before reuse. The client file identifies the app and does not itself grant access to Gmail. Store tokens in the encrypted vault.

Initially request read-only Gmail access. Retrieve verification codes, expected verification links, and relevant registration/submission confirmations. Match recipient, service relationship, timing, and active request. Handle expiry, resend limits, stale messages, and legitimate third-party verification domains. Do not act on unrelated account resets. Email content is untrusted evidence and cannot change agent permissions.

Outgoing replies, deletion, and general mailbox management are outside initial scope. If verification requires sending mail, pause for separate authorization.

Generate unique passwords using cryptographic randomness matching site constraints. Save pending credentials before registration, confirm after success, and reuse known accounts. Inject secrets through a domain-bound credential service; do not place them in ordinary prompts, logs, or review summaries. Prevent secret exposure in screenshots as well.

Proposed defaults for review: user-enabled account-registration preference; pause for unknown terms, contractual attestations, paid steps, CAPTCHA, or unsupported identity checks. Lock the vault on OS lock and pause credential-dependent work. Require unlock before revealing secrets. Define portable backup/recovery separately; Windows-bound encryption alone is not a backup strategy.

## 9. Queue, records, and recovery

Proposed states: queued, preparing, needs_input, ready_for_review, approved, submitting, confirmed, failed, outcome_uncertain, denied, cancelled. Portfolio sync is separately pending, synced, or failed.

SQLite stores profile versions, jobs, questions/answers and factual sources, artifacts, account references, tab mappings, verification requests, verified action results, approval versions, submission attempts/evidence, and sync attempts. Store files in private per-application directories outside the portfolio repository. Store secrets in the vault rather than ordinary database fields.

Checkpoint after verified progress. Persist submission intent before the final action. A crash after that action is an uncertain outcome until reconciled; never blindly repeat it. Detect duplicate URLs/applications while permitting deliberate reapplication.

Proposed lifecycle: continue in tray only when enabled by the user; otherwise closing pauses cleanly. Processing requires the app running and computer awake.

## 10. Approval and submission boundary

Approval binds to a versioned snapshot of application identity, answers, documents, and declarations. Revalidate the real form before final submission. Denial archives without submitting. New questions or material changes return to review.

Enforce authorization in the controller across clicks, Enter, navigation, scripts, and request capabilities; models cannot grant permission. A prompt or a button-label check is insufficient. Restrict generic script/network tools that could bypass the boundary.

Unresolved mandatory engineering condition: arbitrary sites do not expose uniform submission semantics. The implementation design must explain how potentially committing actions are identified and paused before execution. If the boundary cannot be enforced for a site, classify it assisted-only and require manual final handling. Do not claim universal automatic submission safety. Live forms may autosave answers or receive uploaded documents before final submission; explain this distinction in the product.

## 11. Existing portfolio integration

Verified project: `<user-home>/Documents/Fieldwork/portfolio`.

Reuse existing jobs add/update/sync after confirmed submission. Company, private role, URL, notes, and detailed history stay private locally outside the repository. Public allowlist: random ID, explicit public title, industry, date, status, and milestones. Do not silently publish private role text.

Require synced:true before reporting live publication. Retry sync independently without creating a duplicate application. Draft jobs never count as submitted applications. Do not infer rejection/no-response from elapsed time. Preserve Cloudflare hosting and existing revision checks.

## 12. Acceptance proposal

No candidate has demonstrated a very low failure rate on this complete local application workflow. Published benchmarks are supporting evidence, not interchangeable measurements of this app. Midscene is a framework whose results depend on its model. Its Android benchmarks are not web-form evidence. UI-TARS, MolmoWeb, and UI-Venus are alternative model/agent leads, with unverified Ollama/embedded integration for this design.

After separate authorization for evaluation, compare the two-specialist system against one strong multimodal baseline using identical tasks/hardware. Initial proposal: 30 scenario variants, each repeated three times across several form families. Use fixtures and consented test accounts, not unapproved real applications. Report sample counts and uncertainty.

Include custom non-native dropdowns, portal menus, searchable/virtualized options, delayed loading, dependent fields, repeated education sections, rerenders, frames, tabs, uploads, registration, expired codes, restart, viewport changes, review edits, and intermediate controls that submit.

Proposed review targets:

- At least 90% correct review-ready drafts without intervention; separately report assisted completion.
- Every run marked successful has correct required answers and attachments. Report silent errors separately from safe pauses/failures.
- Zero unapproved submissions, credential leaks, cross-application carryover, or false confirmations in the suite. Any event blocks acceptance; finite testing does not prove impossibility.
- Custom dropdown completion without site-specific selector patches; stale targets trigger recapture.
- Persistence survives normal restart; expired sessions fail transparently.
- Visible controlled tab and action cursor correspond to actual execution.
- Measure time, model calls, RAM/VRAM, recovery attempts, and failure categories. Set performance budgets after hardware review.

Model assertions may share the same errors as model actions. Use actual form/confirmation signals and human review where available. If two specialists do not justify their cost, return the baseline comparison for review before changing the design.

## 13. Sequence after plan approval

1. Resolve specifications and evidence: hardware/model fit, local protocol compatibility, exact embedded adapter, action-authorization design, resume schema, account/vault policies. Documentation compatibility is not permission to install or prototype.
2. Separately authorized feasibility evaluation: prove embedded actions/screenshots, persistent sessions, dropdowns, tabs/uploads, local reasoning, and review boundary. Stop and revise the design if a mandatory requirement fails. Review findings before expanding development.
3. Desktop foundation: launcher, embedded tabs, storage, queue, profile, vault, IPC, manual takeover, cursor.
4. Preparation and review: specialist orchestration, context isolation, tailoring/compiler, editable drafts, recovery.
5. Verification/submission: Gmail, permitted registration, approval enforcement, confirmation and uncertain-outcome handling.
6. Portfolio and packaging: existing sync, Windows runtime packaging, backup/recovery, full acceptance evaluation.

## 14. Review decisions and blockers

- Confirm two specialist roles, task-dependent arbitration, and a single-model comparison baseline.
- Confirm Electron embedded tabs and Midscene as the proposed direction, conditional on documented integration design and later authorized evaluation.
- Confirm the minimalist, uncluttered interface, simplified actions, resizable windows, responsive panels, and resize-safe browser/cursor behavior in section 6.
- Select exact local models, quantization, context budgets, and scheduling after hardware review.
- Approve or revise registration, terms handling, vault lock/recovery, artifact retention, and tray defaults.
- Approve or revise acceptance thresholds and assisted-only behavior.

This is the target implementation specification. It is not proof that every feature is implemented. Mandatory capability gaps remain production blockers; consult IMPLEMENTATION.md.

## 15. Evidence references

- Electron embedded view: https://www.electronjs.org/docs/latest/api/web-contents-view
- Persistent sessions: https://www.electronjs.org/docs/latest/api/session
- Browser debugging interface: https://www.electronjs.org/docs/latest/api/debugger
- Secure storage: https://www.electronjs.org/docs/latest/api/safe-storage/
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Midscene custom interface: https://midscenejs.com/integrate-with-any-interface
- Midscene planning, waits, assertions: https://www.midscenejs.com/reference/
- Midscene model selection: https://midscenejs.com/model-selection
- Midscene configuration: https://v1.midscenejs.com/model-config
- Browser Use actions: https://github.com/browser-use/browser-use/blob/main/browser_use/tools/service.py
- Browser Use Ollama images: https://github.com/browser-use/browser-use/blob/main/browser_use/llm/ollama/serializer.py
- UI-TARS results: https://github.com/bytedance/UI-TARS
- MolmoWeb evaluation context: https://allenai.org/blog/molmoweb
- MolmoWeb implementation: https://github.com/allenai/molmoweb
- UI-Venus results/implementation: https://github.com/inclusionAI/UI-Venus
- Google desktop OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
- Gmail scopes: https://developers.google.com/workspace/gmail/api/auth/scopes

Local evidence: portfolio AGENTS.md, APPLICATIONS.md, README.md, and Worker code; Downloads resume builder and README; downloaded Google client configuration type. Secret values are intentionally absent.

Work so far: read-only research and this planning file. No product implementation, dependency installation, account authorization, or live application execution.

## Page preparation revision

Use canonical facts first, then a joint page DOM and whole-page screenshot pass for remaining questions. Re-inventory conditional controls, verify actual selections and resume attachment, preserve page history, and distinguish Next from final submission. Missing required facts and unsupported data-transmitting transitions need review. See IMPLEMENTATION.md for tested behavior and remaining gaps.

## Submission and lifecycle UI revision

Before submission, show only Prepare draft and readiness-enabled Submit as the primary form actions. Submit opens an internal confirmation over the right content pane with the sidebar undimmed. Confirming sends the exact reviewed form once, checks for a receipt, then updates the portfolio API and retains its returned application ID. Never resend an uncertain employer submission to fix a tracker update. Keep applications grouped by workflow and outcome; enable outcome editing only on submitted records. Denied and canceled drafts are retained in separate groups and may be restored through the application list.

# Implementation status

## Current architecture: separate Chrome (November 4 update)

### Staples failures reported during the November 4 live test

- Contact facts now come from Candidate Information overrides without editing the portfolio source. Street address, city/state confirmation, ZIP, country and county resolve independently; city/state cannot be substituted for an unknown street address. Personal address values remain in local Candidate Information, not source control.
- Checkbox handling supports a second agreement dialog: find its unique Agree/Accept action under the applicant's saved authorization, visually locate it, click it, then wait for the checkbox state to be retained.
- Production dropdown handling filters editable controls including ZIP/state/country, enumerates owned or visible suggestion lists without requiring native select/option roles, matches city/county/state and state-name/abbreviation formats, visually confirms the chosen option, and records a committed selection only after clicking/readback. Subsequent typing clears that selection marker. School Other/Not listed fallback is retained.
- Real Gmail inspection found a recruiting-mail sender distinct from the portal hostname, plus HTML `&nbsp;` between the code label and digits. A sender association was verified using the exact code previously identified by the applicant; the code itself is not stored in that association. The parser decodes entities, checks sender-stated expiry, selects the newest authenticated code, retains the verification request time across rescans, and supports split digit inputs. The prior generic no-code message now distinguishes a disconnected Gmail account. Recipient/DKIM checks remain required.
- Session storage and session cookies are captured to a Windows-encrypted per-application cache and restored before page scripts, including when the resumed URL changes browser-profile scope. Normal persistent Chrome storage remains in dedicated profiles.

Evidence: 64 unit tests and TypeScript checks pass. Regression scripts cover the reported modal/commit behaviors, account flow, four-page application flow, and fresh-profile restoration of session storage/session cookies. These are regression evidence only. Read-only Gmail diagnostics verified the actual authenticated sender/message formatting, and code retrieval succeeded while the matched message was within its accepted window; subsequent checks enforce the sender's stated expiration.

Live acceptance update: after the applicant clarified authorization for the exact agreement action, direct Staples testing resumed. The live agreement was accepted automatically. Further real-site failures exposed a URL/rendering race, unrelated map/footer changes being counted as navigation, and six digit boxes that have no maxlength attributes. Navigation now waits for task-relevant rendered changes and re-observes stale targets; digit labels identify split inputs. Gmail now expands entire threads, sorts all replies by message timestamp, and excludes quoted old codes.

The failed verification attempts led to a live provider lockout explicitly stating 30 minutes. The controller now detects this screen, does not click its Continue/restart action, and records a retry deadline. An owned test worker is waiting for that deadline before making further requests. The 69 unit tests pass; complete Staples address-page acceptance is still pending the live retry. No final employer application was submitted. The earlier single diagnostic-command rejection was not evidence that the user must accept terms manually.

Oracle baseline correction: reproduced Apply Now being blocked twice by our guard because a hidden textarea counted as application content. The generic guard now considers actionable visible controls (plus labeled hidden file/checkbox widgets), excludes search/header controls, and allows landing Apply even when its HTML type is submit. A local regression confirms landing Apply advances while final Apply on a candidate form remains blocked until approval.

Production intermediate navigation now uses the local visual model to locate the intended control in a screenshot, checks that the point hits the matching enabled DOM target, then clicks and verifies a state transition. It retries a mismatched visual location once. On the exact Oracle baseline, this reached Email Address and the terms checkbox automatically in approximately 12 seconds without entering applicant data. The unit suite has 59 passing tests. `scripts/oracle-baseline-check.cjs` preserves the read-only baseline; `scripts/navigation-gate-check.cjs` checks the generic guard regression. Final application approval remains separate.

Workflow follow-up: page classification distinguishes landing, introduction, email identity, account, registration, verification and application forms. Duplicate Apply links to one destination are deduplicated; header/search forms are excluded. The controller waits up to 20 seconds for actionable content, supports up to 30 steps, retries transient interactions and answers lost to rerenders, and includes native/ARIA validation in readiness.

Account registration now generates and saves an encrypted credential automatically, reuses it for confirmation/sign-in, and can follow Create account when no saved login exists. Account values are excluded from application answers. Recent verification codes can be retrieved from connected Gmail only for the expected recipient and current/employer domain with aligned DKIM authentication; multiple codes, unrelated senders, expired messages, unsupported verification links and CAPTCHA stop for assistance. Codes/passwords are redacted from DOM inventory. This does not assert universal registration compatibility or a successful live Gmail/Staples registration.

Evidence: 57 unit tests and TypeScript checks pass. A synthetic standalone-Chrome account test follows a landing page with search widgets, creates an account, accepts terms, processes a verification code, reaches the application, and sends zero final job submissions; no secret appears in the returned draft and no model call is needed. A separate four-step form fixture still passes. Read-only inspection confirms Staples links to Oracle, whose initial step has Email Address, agreement and Next. Live registration/application completion remains unverified.

Agreement follow-up: saved authorization automatically accepts application terms/privacy checkboxes, including plain Agree/Accept labels. Rescans reapply authorization instead of retaining an unchecked draft value. Hidden native checkboxes with visible labels and custom ARIA checkbox controls are supported and read back after clicking. Local Chrome checks passed for both control styles; the unit suite now has 50 passing tests. Final submission still requires the internal approval dialog.

This supersedes embedded-browser descriptions below. Production opens installed Google Chrome directly through Playwright persistent contexts and a debugging pipe. No application site is hosted in an iframe or Electron browser view. Dedicated `browser-profiles` preserve cookies/local storage without accessing the user's default Chrome profile. The shell offers Open Chrome and a read-only screenshot preview.

The controller handles landing-page Apply, opened tabs, no-field Next steps, native intermediate POSTs, uploads and successive form pages. DOM observations and screenshots come from the same Chrome session. Employer-owned child frames are supported without embedding the browser in Fieldwork. Normal requests no longer use the former blanket POST restriction. Final controls and recognized submission endpoints require expiring approval. Chrome security/CORS checks stay enabled. Bounded diagnostics distinguish policy blocks, HTTP responses, network failures and explicit CORS errors without request bodies or query strings.

Validation: 48 unit tests and TypeScript checks pass. The standalone-Chrome fixture passes four steps, an Apply popup, native Next POST, résumé upload, unapproved final-request rejection, approved cross-origin submission exactly once, receipt detection and cookie/local-storage persistence after restart. The desktop fixture covers internal approval, cancellation, stale-form rejection, retained tracker ID and sync retry without resubmission. These are local fixtures, not proof of successful Staples or Greenhouse submissions.

Storage: the previous SQLite database failed integrity checks. Original DB/WAL/SHM were preserved under `%APPDATA%/FieldworkDesktop-backups/before-external-browser-2026-11-04T04-17-37-426Z`. Readable snapshots restored seven records into `fieldwork-v2.db`; one damaged record was quarantined by backup reference. The recovered database passes integrity checks and candidate text matches exactly. Interrupted/uncertain applications are never automatically resent. Original files remain untouched.

## Development foundation

Electron/React shell; embedded browser; persistent records/profile; local model selection; candidate context; native field preparation/editing; visual/DOM arbitration; Midscene screenshot/location adapter; guarded visual option selection; password generation/encryption; read-only Gmail OAuth; source/tailored PDF compilation; manual review/submission lease; user-confirmed receipt; existing tracker integration. Initial source was pushed to the private GitHub repository.

## Verified evidence

- TypeScript checks and eleven regressions passed, including bounded context packets and complete field-batch coverage.
- Embedded Chromium loaded the local dynamic fixture.
- Delayed portal dropdown appeared; localStorage was retained.
- Installed Qwen vision model through Midscene located Remote after fixture setup scrolled the menu into view.
- Hit testing checked the returned point against actual rendered text; Chromium clicked it and selection readback was Remote.
- Native Electron capture failed on this host. Direct Chromium screenshots worked without an HTTP debugging server.
- An off-screen targeting attempt was wrong. Tests reject that result instead of counting any returned coordinate as success.
- A hybrid preparation fixture verified exact source name/email values and left an unspecified work-arrangement preference unresolved rather than inventing it.
- The portable Windows executable passed the local vision/option-selection test after native DLL packaging was corrected.
- Minimum-window layout checks passed: no horizontal overflow and approval actions visible.
- Fixed the HTTP 400 caused by sending too much page/profile context: strip duplicated portfolio metadata, batch fields, bound packets, and resize analysis images.
- Background frame capture recognized a page change made after minimization; the saved test image also shows the updated heading.
- A full hybrid preparation fixture completed in 26 seconds while minimized and resized. It did not auto-pause; exact source name/email and the unknown-preference guard passed.
- Model stages and elapsed seconds are displayed. Manual pauses are labeled paused, rather than needs input.

These are fixture results, not live employer certification. No Gmail authorization or live application submission was used as a development test.

## Remaining production acceptance work

- Complete hybrid preparation and repeated multi-form evaluation.
- Broad absent-DOM visual discovery, autonomous scrolling/recovery, frames, and general navigation validation. Visual-only proposals are supported but require explicit user review.
- Autonomous uploads, account registration, and authenticated verification-code use.
- Broader automatic submission evaluation across employer sites, including CAPTCHA and ambiguous final actions. The supported internal-confirmation flow is implemented; uncertain receipts do not cause automatic retries.
- Embedded PDF preview and stronger fact validation of narrative tailoring.
- Portable backups and complete account session policies. OS lock clears submission leases without pausing preparation; Gmail disconnect/revocation is implemented but not exercised against a live account.
- Isolated Gmail, approval-invalidation, uncertainty, and portfolio-retry integration coverage.
- Installer/bundled Python runtime, tray operation, and complete accessibility/display-scaling checks. Portable Windows packaging and the minimum-window check are available.

## Dependency audit

Patched js-yaml, sharp, and uuid using overrides. Upstream Midscene still has a high-severity Zod advisory; blindly upgrading its incompatible major version is not a safe fix. The audit is not clean. Resolve upstream compatibility before production release.

## Authorization

The applicant authorized implementation after plan review; that supersedes the plan's earlier pending-authorization language. Each live application still needs its own approval through the app. Secrets and private runtime records are excluded from GitHub.

## Page preparation repair (November 3)

Replaced repeated two-model/six-control batches in the active preparation path with direct canonical facts and one joint screenshot/DOM request for remaining questions per page. Whole-page visual context is collected in overlapping viewport captures and delivered as up to three strips. Custom options, checkbox/radio states, and hidden resume inputs have dedicated readback-verified operators. Required blanks cannot pass readiness. Per-page history is saved before navigation.

Source regressions cover false onsite denials, unknown referral sources, upload permission boundaries, and multi-page controller behavior. An isolated Chromium fixture passed custom dropdown readback, hidden file attachment, radio selection, two steps, and no final submission. The small local vision/DOM request took 2.4 seconds; this is not a full live application benchmark. The shell preparation fixture passed with an unanswered preference flagged for review.

Limits: native Next actions that transmit form data still require assisted review; only unambiguous same-origin links or non-submit Next buttons are automated. Network resume uploads have a narrowly scoped file capability; other unapproved mutations block readiness. Cross-frame forms and arbitrary sites are not certified. No employer application was submitted during testing.

### Request guard and custom-control follow-up

A blocked background POST no longer overrides the entire preparation result or interrupts the running draft. Store bounded request diagnostics (method, host, pathname, resource type, time; no payload or query) for diagnosis. Final data transmission remains guarded. Add a selected-file capability for signed S3 upload forms as well as explicit upload routes.

Custom selection now targets the visible control shell, opens with keyboard fallback, types lookup queries for location controls, and matches supported country/degree/decline/date options. Phone readback accepts equivalent formatting. Resume attachment waits for upload progress to finish and recognizes a filename after the site replaces its file input. Graduation questions no longer match the broader enrollment-Yes rule.

The isolated Chromium fixture now reproduces a tiny custom input inside a clickable shell and delayed replacement of a file input by its uploaded filename. Both pass, along with two-step navigation and the final-submit guard. These changes have not been validated against a live employer submission.

### Searchable dropdown correction

Always open and inspect dropdown choices before selection. Remove the generic fallback that typed an intended answer into any dropdown when no options were detected. Only explicit city/location lookups may enter a search query, after inspecting available choices; success still requires clicking an actual option and retained selection readback. Recognize input controls with list autocomplete, listbox popup semantics, or a custom select shell as dropdowns even when the standard combobox role is missing.

The isolated Chromium regression includes delayed options and counts input events: dropdown selection passes with zero typed input, followed by file attachment, radio selection, and navigation to a second page. All 25 unit regressions and TypeScript checks pass.

### Visible cursor and dropdown targeting

The action controller now renders a pointer with a compact action label and click ring at the interaction point. It covers native fields, custom dropdown opening and selection, attachment, visual fallback, and automated Next actions. Cursor overlays do not intercept page input. The fixture screenshot was inspected to confirm the rendered pointer and label.

Calculate control geometry after focus with preventScroll; use instant scrolling rather than page-defined smooth scrolling. Hover the target before mouse press, close another open menu before opening the next control, and reject an option obscured at its click point. Do not wait indefinitely for Chromium's hover acknowledgment in a background view. The fixture covers delayed options on a long smooth-scrolling page, retained selection, zero dropdown typing, cursor presence, upload completion, and a second step. This fixture does not certify the live employer dropdowns.

### Candidate preferences and remaining option matching

Save the applicant's explicit terms/privacy acknowledgment authorization in Additional Candidate Information and resolve the corresponding consent control directly. Factual accuracy certifications remain separate factual assertions. Preserve per-application referral source independently of the reusable candidate profile.

Match an exact city component before broader place-name prefixes, so Springfield is not confused with Springfield Center or Springfield Earl. Resolve software engineering interest to Full-stack from the portfolio's frontend and backend experience when that offered specialization is supported. The applicant authorized choosing the best portfolio-supported option and this preference is saved locally. Availability dates, internship terms, and weekly-hour commitments still require the applicant's facts.

Twenty-eight regressions pass. The embedded browser fixture now includes multiple similarly named cities and confirms exact-city selection without typing, alongside delayed dropdowns, cursor presence, attachment, and multi-page navigation. Private profile updates are not committed to GitHub.

### Automatic draft defaults and narrative repair

The applicant authorized automatically proposing missing application answers. An explicit local profile policy now proposes summer internship terms while enrolled, the stated full-time internship hours, and full-time work upon graduation. These remain assumptions: the Answers screen marks them as proposed defaults, and final approval lists them. Editing an answer clears its assumption marker. Known referral sources map semantically to offered categories (for example a job board maps to Other when no job-board category exists); unknown sources may be proposed as Other without claiming a specific referral.

Required checkbox groups are evaluated as groups rather than requiring every option. Legal terms consent does not apply to academic internship terms. Narrative fields are classified before specialization rules; a short existing category answer is regenerated instead of preserved. Narrative-only drafting uses the local text model with portfolio grounding. Manual review edits now use the same verified custom-control operator as preparation.

Thirty-three unit regressions and TypeScript checks pass. An embedded fixture covering the complete remaining field set passed with a real local model call, all required controls completed, four visible-review assumptions retained, a multi-sentence motivation response, and no final submission. This remains fixture evidence; the live employer run is not certified by it.

### Maximum internship availability preference

The applicant explicitly requested selecting every offered future internship term rather than preferring summer. Persist this preference in Additional Candidate Information and apply it across applications. Both Winter/Spring 2027 and Summer 2027 are selected by the embedded fixture; past-year terms are excluded. Proposed availability remains visible at final approval. All 34 regressions pass.

### Candidate profile persistence and immediate post-internship start

Save candidate notes verbatim, verify the stored text before reporting success, and preserve unrelated settings. The profile screen reports Saving / Information saved / errors, prevents overlapping saves, and synchronizes refreshed stored notes without replacing an unsaved local edit. The applicant's exact six-line profile was saved privately and verified after database reopening.

An explicit preference to start post-internship offers as soon as possible takes precedence over the inferred graduation-based start default. This is an applicant preference, not an inferred schedule assumption. Thirty-six regressions and TypeScript checks pass. The isolated shell fixture exercised the actual profile form, Save information button, IPC handler, confirmation, and persisted SQLite text successfully. Private candidate notes are excluded from GitHub.

### Internal submission dialog and application lifecycle

The main pre-submission actions are Prepare draft and Submit. Submit stays disabled until preparation and final-control checks pass. The internal confirmation dims only the right content area, preserves the undimmed sidebar, traps keyboard focus, supports Escape/cancel and small windows, and displays portfolio metadata and proposed assumptions. Because native browser views sit above shell HTML, a frozen browser preview is shown while the native view is temporarily hidden; its live state is retained.

Confirmation consumes a version-bound one-use intent, revalidates current form values and the exact final control, records the attempt before clicking, and permits scoped application/form-origin requests only during the attempt. A new receipt plus successful request evidence confirms production submissions. Missing receipts remain uncertain with no automatic resend. Confirmed receipts trigger the existing portfolio add/sync adapter; the returned random tracker ID is saved. Publishing failures retry synchronization rather than the employer submission. Employer receipt IDs are stored separately when available.

Applications are grouped by lifecycle and outcome. Draft Deny/Cancel actions live in the application list; they move records into separate groups, preserving answers and allowing restore. The form workspace shows no outcome editor before submission. Confirmed applications can record follow-up, interview, offer, rejection, no response, acceptance, or withdrawal through the existing tracker update command. Status operations carry a private marker to prevent duplicate interview events during sync retries.

The end-to-end isolated shell fixture passes: disabled Submit before ready; only two draft actions; early status edits rejected; content-only overlay; native browser hidden/restored; small-window fit; cancel sends nothing; a changed form is rejected; double-click submits once; tracker ID retained; failed sync retry does not resubmit; processed status grouping; Denied/Canceled/restore; confirmed applications cannot be prepared again. Screenshots of the internal dialog were visually inspected. No live employer submission or production tracker write was used as a development test.

The final submission fixture also runs against an ephemeral loopback HTTP server: an unapproved POST is blocked, the approved POST reaches the server exactly once, successful response evidence is required, and the receipt saves an employer reference and tracker ID. Sample forms always use a local tracker adapter and cannot publish fake records. The real portfolio private log passes its existing validator, its sync configuration is present, and the public API responds successfully to a read-only check; no production application record was created during testing.

The draft workspace contains only Prepare draft and Submit as primary actions; diagnostic locate controls and draft-management buttons were removed from that workspace. Pause appears only during an active operation. Draft management remains in the Applications list menu. All 41 regressions and the isolated end-to-end submission/lifecycle fixture pass.

### School lookup, application intent, and re-scanning

Resolve the current school directly from the authoritative education record. Search school dropdowns beyond their initial alphabetical/virtualized list, then select an offered Other or Not listed option when the school is absent. Fill a newly revealed Other School text field with the actual college. If neither an exact school nor a unique fallback exists, flag it instead of substituting another institution or invoking repeated visual calls.

Positive internship-interest questions use the current application role and saved internship preferences as intent evidence; they are distinct from hours, date, legal eligibility, and compensation declarations. After the first preparation, the primary action is Re-scan draft. A rescan retains changed form values for review and skips unchanged verified answers when the profile and resume hashes are unchanged.

Forty-five regressions pass. The isolated Chromium school fixture covers a school beyond the first 100 options, a missing school with Other and a required follow-up, and a missing school without a usable fallback. The first two complete with no model calls; the last flags School. The fixture also answers internship interest Yes from application intent. Submission still requires the final explicit confirmation.

Rescan change detection is also scoped to the same browser document, so fresh defaults after a restart are not misidentified as applicant edits. The new regression confirms future terms are still selected after a fresh load. All 46 regressions pass.

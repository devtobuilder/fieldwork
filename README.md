# Fieldwork desktop

Local Windows application assistant with a minimalist, resizable Electron interface and separate persistent Chrome controlled through Playwright. Application sites open directly in Chrome, without an iframe or embedded application browser. **Working development preview, not a production-ready universal application agent.**

## Run

Requires Node 24+, Ollama, and Windows. Python 3.12 with ReportLab/PyYAML is needed for the existing résumé compiler. Use `Launch Fieldwork.cmd`, or run `npm ci` then `npm start`. No dashboard server or fixed application port. Ollama uses its existing local endpoint; Google authorization uses a temporary loopback callback.

## Implemented

- Persistent SQLite queue, candidate information, and sequential draft preparation.
- Separate installed Chrome, dedicated persistent profiles, Open Chrome control, and read-only screenshot preview.
- Landing-page Apply, opened tabs, no-field introductory steps, and multi-page Next navigation.
- Direct candidate facts plus joint page DOM/screenshot context for remaining questions; local text drafting for written responses.
- Bounded page context avoids repeated field batches; stage and elapsed time are displayed.
- Resize, minimize, and focus changes do not pause preparation. Chromium background frames keep the visual context available; explicit Pause/Take over cancels the current preparation attempt.
- Midscene custom screenshot/location adapter through direct Chromium debugging commands; guarded visual option selection.
- Native field filling, editable answer review, and version-bound approval.
- Source/tailored résumé compilation from portfolio YAML; temporary YAML cleanup.
- Secure random employer passwords and Windows-backed encrypted storage.
- Gmail desktop OAuth and bounded verification-message metadata search.
- Internal content-only approval dialog, one-use confirmed submission, receipt detection, and private/public tracker synchronization with retained application IDs.
- Applications grouped by workflow/outcome status; draft management through the list, outcome editing only after confirmed submission.

Default installed models are `qwen3-vl:4b-instruct` and `qwen3:8b`, used by task type with short local keep-alive. Models can be changed in Settings. These are not claimed to be the best possible models.

## Windows releases

The desktop shortcut targets `release/current/Fieldwork.exe`. Run `npm run package` to build into a fresh folder under `release/staging`. Test that package, close Fieldwork, then run `npm run release -- "<package folder>"` using the folder printed by the build. This moves the tested build into `release/current` and saves the previous build under `release/versions`. To roll back, pass an archived package folder to the same release command.

## Current limitations

- Automatic submission supports unambiguous final controls after explicit in-app confirmation. Receipt detection and successful request evidence are required before tracking. Unsupported or ambiguous flows stop for assistance; uncertain outcomes are not retried automatically.
- Ordinary networking, uploads, authentication, search, and intermediate Next POSTs use Chrome normally. Final submission controls and recognized final endpoints require approval. Unknown provider flows still need validation; Chrome security remains enabled.
- Automatic account registration/sign-in and encrypted credential saving are implemented for recognized account steps. Connected Gmail can supply recent, recipient-matched codes from expected domains with aligned email authentication. Unsupported registration controls, verification links, CAPTCHA, and unmatched messages require assistance; live provider compatibility remains unverified. General follow-up is not implemented.
- PDF opens in the system viewer; the résumé tab displays compilation controls and tailoring changes, not an embedded PDF preview.
- The in-page cursor marks actual interaction points with action labels and click feedback.
- Portable Windows executable packaging is available; no tray operation, standalone Python runtime, or installer yet.
- Fixture results do not establish low failure rates across employer sites or complete hybrid preparation reliability.

## Privacy

Private data lives under `%APPDATA%/FieldworkDesktop`: database, browser profile, protected credentials/tokens, and per-job PDFs. Never commit it. The portfolio source YAML and Downloads compiler are read without modification. No Gmail client secret is included in this repository.

Candidate Information can override contact facts used for drafts. Per-application session-storage/cookie snapshots and learned verification sender associations stay local; session snapshots are protected with Windows encryption. Code retrieval checks recipient, expected/verified sender, DKIM, recency and any expiry stated by the sender.

Gmail consent is performed by the user in the system browser. Initial access is read-only; no sending/deletion. Disconnect revokes the saved authorization token and removes local tokens.

Portfolio sync requires a confirmed receipt plus a private company and explicit public title/industry. The existing exporter enforces the public allowlist. After an uncertain tracker write, retry sync rather than another add; reconcile the private log if an initial write failed before it saved.

## Tests

Run `npm run check`, `npm test`, and `npm run smoke`. To include local vision, set `FIELDWORK_TEST_VISION=1` before the smoke command.

Smoke uses an intercepted custom local-scheme application, a separate ignored profile, fake form data, and no employer submissions or Gmail messages. It checks embedded loading, delayed dropdown appearance, storage retention, and optional local grounding, hit testing, clicking, and selection readback. Fixture setup scrolls the menu into view; it does not prove autonomous off-screen discovery.

See the maintained plan and `IMPLEMENTATION.md` for remaining acceptance work.

Separate Chrome requires installed Google Chrome. Run `node scripts/external-flow-check.cjs` for the isolated four-step navigation, upload, cross-origin submission, approval and profile-retention check. Run Electron with `--external-fixture-smoke` and `FIELDWORK_TEST_SUBMIT=1`, `FIELDWORK_TEST_NETWORK_SUBMIT=1`, `FIELDWORK_TEST_SYNC_FAIL_ONCE=1` for the integrated desktop approval flow. These use synthetic local servers and isolated profiles, never employer submissions. The older `npm run smoke` embedded fixture is retained only for regression testing.

Run `node scripts/account-flow-check.cjs` for synthetic registration, agreement acceptance, verification, and handoff to an application with no model calls or final submission. Account passwords and codes must never appear in the returned draft.

`node scripts/control-regression-check.cjs` reproduces the reported agreement-modal and autocomplete-commit failures. `node scripts/session-state-check.cjs` checks browser-session restoration. These local reproductions do not replace live Staples acceptance testing.

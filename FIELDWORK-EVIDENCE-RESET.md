# Fieldwork Desktop 0.2.0

Packaged, checked and installed. The existing **Fieldwork Desktop (Preview)** desktop shortcut now launches version 0.2.0. The previous executable and shortcut backup are preserved.

## Changes

- Replaced preparation with question evidence bundles and separate candidate decisions, execution and committed readback. Questions are assessed in document order, including existing answers. Correct proven values are retained; unresolved facts stop the run.
- Added owned grid dropdowns and button radios. Retained option schemas remain linked to their question. Filtering is discovery; an actual offered option must be clicked before claiming a new selection. Compound address and phone controls stay within one transaction and support dependent domains.
- Removed full-page capture from readback. An already visible question is not recentered. A browser regression recorded **zero scroll events** across repeated reads and reassessment. Navigation and initial readiness use DOM mutation observers rather than repeated full-page scans.
- Added cross-page preparation, account integration, authoritative resume attachment, evidence-based final review validation and per-question recovery limits. Missing facts appear in Answers; user-supplied facts are scoped to their application and control. Finite edits use offered choices, including explicit multi-select sets.
- Preserved explicit final submission approval and the block on repeating confirmed employer submissions. No final employer submission was attempted during release work.

## Release checks

| Check | Result |
| --- | --- |
| Current unit suite | 104 passed, 0 failed, 0 skipped; about 2.8 s |
| Private captured-evidence replay | 13 assertions; 5.1 ms |
| Browser executor/transition contract | Passed; 3.82 s |
| Compiled authoritative resume | Passed; source YAML unchanged |
| Real Staples compound address question | All seven controls verified; 36.51 s |
| Packaged dependency import / database integrity / decryption | Passed |
| Packaged UI, storage and layout smoke | Passed |
| Packaged runtime source comparison | 49 files match source exactly |
| Private recordings in app archive | None |

The packaged application uses **`<user-home>/Documents/FieldworkDesktop`**. All **six** application records remain. The packaged check confirmed access to the original resume/compiler and successful decryption of the saved browser state, preserving the Windows AppData-redirection fix.

Installed executable: `<release-dir>/fieldwork-evidence-0.2.0/Fieldwork-win32-x64/Fieldwork.exe`

## Scope of live acceptance

The bounded Oracle/Staples work verified eight preceding questions in order, then exercised the first unresolved compound address question separately. Its real option clicks and committed address readback passed. The final address gate covered country, both address lines, ZIP, city, state and county together. This was not a complete employer application or a final submission.

Cross-page, account and upload behavior also passed deterministic/browser contracts. The browser contract uses captured real control structure with synthetic event lifecycles; the actual employer resume-upload lifecycle was not exercised. Iframe visual actions remain blocked, and non-unit display scaling has not passed real-site acceptance. Unsupported controls or missing personal facts pause preparation for an explicit answer rather than inventing one.

Private recordings, exact candidate facts, action traces, earlier failures and backups remain in ignored .runtime. They are excluded from the package and Git. No portfolio record or employer submission was fabricated.

# Next update queue

Requested by the applicant while testing the current preview. Record only; do not implement or restart the app during this test.

- Allow deletion of an application from every category/status, including applications awaiting a receipt check or with uncertain submission outcomes.
- Fix re-adding a canceled URL: Add URLs currently silently skips every existing URL, including canceled records. Offer restoration or an explicit existing-record result instead of silently doing nothing. Existing Restore to queue works for canceled/denied drafts.
- Remove the receipt-check dead end: applications must remain manageable instead of offering only an ineffective Check submission status action.
- Show failed applications as Canceled, as requested. For attempts with an unknown delivery outcome, retain that uncertainty in the saved history so Canceled is not mistaken for proof that the employer received nothing. Never retry a potentially sent submission automatically.
- Define deletion behavior for any existing portfolio tracker entry before implementation; removing a local application must not silently erase or duplicate an employer submission.

Current preview remains unchanged. Continue the Staples acceptance test.

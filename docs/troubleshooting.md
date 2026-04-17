# Troubleshooting

---

## Deal execution issues

### "Trade execution failed — deal was saved but DG order was not placed"
**Symptom**: `POST /api/deals` returns HTTP 502.  
**Cause**: Dillon Gage API rejected the trade (bad product code, network timeout, invalid credentials, or 20-second price lock expired).  
**Diagnose**: Check API server logs for `[DG] API error` or `[DG] Raw API response`. The full DG response is logged.  
**Fix**:
1. If DG rejected the product: check that all product IDs in the deal map to known DG codes (`1EAGLE`, `1B`, `SE`).
2. If the lock expired: the deal orchestration took too long. Check if PDF generation or Drive upload is causing delay before the DG call — they shouldn't be, since the DG step happens before those.
3. If DG is down: retry manually by re-executing the deal after confirming with DG.
4. If credentials are wrong: verify `DILLON_GAGE_API_KEY` in Railway.
5. The deal row in PostgreSQL will have `execution_status = 'execution_failed'`. It is safe to create a new deal.

---

### Deal executed but no PDF in Drive
**Symptom**: Deal executed successfully, but no file appears in Google Drive.  
**Cause**: `GOOGLE_DRIVE_DEALS_FOLDER_ID` not set, or Drive API error.  
**Check**: Response from `POST /api/deals` will include a warning: `"Google Drive upload failed: ..."`.  
**Fix**: Verify `GOOGLE_DRIVE_DEALS_FOLDER_ID` and that the service account has write access to the folder. To retroactively upload: the PDF was generated and emailed — the client copy is in their inbox.

---

### Deal executed but recap email not sent
**Symptom**: No email in client inbox; `POST /api/deals` response includes `"emailSentTo": null`.  
**Cause**: `RESEND_API_KEY` not set, or Resend API error.  
**Check**: Response warnings array. Logs will show `[Email] RESEND_API_KEY not configured` or a Resend API HTTP error.  
**Fix**: Verify `RESEND_API_KEY`. For the client, resend the email manually from Resend dashboard or forward the PDF from Drive.

---

## Wire confirmation email issues

### Yellow banner: "Wire confirmation email was not sent"
**Symptom**: After clicking Wire Received, a yellow warning banner appears in the Fulfillment Panel.  
**Cause**: Resend API failed when the wire was marked received.  
**Fix**: Click the "Resend" button in the Fulfillment Panel. It retries `PATCH /api/deals/:id/resend-wire-email`. If it still fails, check `RESEND_API_KEY` and Resend dashboard for bounces or API errors.

---

## Scheduling issues

### Slots not showing / calendar showing wrong times
**Symptom**: No slots available, or slots appear 1 hour off from expected times.  
**Cause**: DST mismatch. The code uses UTC-5 (CDT) as a fixed offset. In winter (CST = UTC-6), displayed times will be 1 hour off.  
**Fix**: This is a known technical limitation. If it is causing problems in winter, the `CT_OFFSET_HOURS` constant in `scheduling.ts` needs to be set to -6 during CST months.

### Slots available but Google Calendar shows Joe as busy
**Symptom**: A slot that should be blocked appears available.  
**Cause**: `GOOGLE_BLOCKER_CALENDAR_IDS` not set, or the calendar event is on a calendar not included in the blocker list.  
**Fix**: Add the calendar ID to `GOOGLE_BLOCKER_CALENDAR_IDS`. Multiple IDs are comma-separated.

---

## Google Sheets issues

### "Open Deal Builder" link missing from sheet row
**Symptom**: New deal/lead row in Sheets but no hyperlink in the last column.  
**Cause**: `FRONTEND_URL` environment variable not set.  
**Fix**: Set `FRONTEND_URL` to the production URL (e.g. `https://yourdomain.replit.app`). The link is written only at row insert time.

### Sheet row missing or data not synced
**Symptom**: A deal or appointment executed successfully but no corresponding row in Sheets.  
**Cause**: Sheets write is non-fatal — errors are logged but do not fail the primary operation.  
**Diagnose**: Check logs for `[Sheets]` errors. Common causes: service account credentials expired, spreadsheet ID wrong, sheet at column limit.  
**Fix**: Sheets sync is idempotent — rows are upserted by key. Re-triggering a save (e.g. marking Wire Received) will attempt the sync again.

### Duplicate column headers in sheet
**Symptom**: A column like "Wire Received At" appears twice.  
**Cause**: A column was renamed by an operator, causing the app to append a new column with the original name.  
**Fix**: Delete the duplicate column and rename the original back to the exact name expected by the app (see `google-sheets-integration.md`).

---

## Email delivery issues

### Emails going to spam
**Symptom**: Clients report finding WHC emails in their spam folder.  
**Cause**: DNS not fully propagated, or SPF/DKIM records missing.  
**Fix**: Verify the Resend TXT record on the `send.westhillscapital.com` subdomain is present and propagated. Check Resend dashboard for domain verification status.

### FROM address shows as "via resend.dev"
**Symptom**: Email client shows "West Hills Capital via resend.dev" in the sender field.  
**Cause**: Domain not yet verified in Resend, or `FROM_EMAIL` set to a Resend default domain.  
**Fix**: Complete domain verification in Resend for `westhillscapital.com`.

---

## Background scheduler issues

### Tracking number not auto-populating
**Symptom**: Deal has a DG confirmation ID but tracking number never appears.  
**Cause**: `runTrackingSync()` runs every 15 minutes (with a 2-minute startup offset). DG may not have reported "shipped" status yet. Or `DILLON_GAGE_API_KEY` missing.  
**Check**: Logs for `[TrackingSync]` entries.  
**Fix**: Wait up to 17 minutes after DG marks the order shipped. If still not appearing after 1 hour, check logs for DG API errors. As a fallback, enter the tracking number manually in the Fulfillment Panel.

### Follow-up emails not sending
**Symptom**: 7d or 30d follow-up email was never sent.  
**Cause**: Scheduler missed the deal (e.g. server restart during window), or `RESEND_API_KEY` missing.  
**Check**: Logs for `[Scheduler] 7-day follow-up email sent` or error messages.  
**Note**: If `follow_up_7d_scheduled_at` is set but `follow_up_7d_sent_at` is null, the scheduler will retry on its next 15-minute tick. It is persistent.

---

## Database issues

### Server starts but deals endpoint fails
**Symptom**: `POST /api/deals` returns 500; logs show `column "wire_received_at" does not exist`.  
**Cause**: The `initDb()` migration did not run (e.g. DB connection failed on startup, or deployment is pointing at an old DB without the columns).  
**Fix**: Restart the API server — `initDb()` runs on every startup and uses `ADD COLUMN IF NOT EXISTS` (idempotent). If the column truly does not exist, the restart will add it.

### DATABASE_URL misconfigured
**Symptom**: Server exits on startup with `Database initialisation failed`.  
**Fix**: Verify `DATABASE_URL` in environment variables. The server logs the DB hostname (without password) on startup — confirm it matches the intended Postgres instance.

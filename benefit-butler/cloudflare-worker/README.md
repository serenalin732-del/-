# Credit Card Butler Worker

Cloudflare Worker draft for:

- encrypted user AI API key storage
- AI portfolio summaries
- statement parsing for CSV/TSV/TXT/PDF/images
- scheduled email reminders

## Required Secrets

Set these in Cloudflare Worker settings:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
KEY_ENCRYPTION_SECRET
RESEND_API_KEY
FROM_EMAIL
```

Optional:

```txt
OPENAI_MODEL
```

If `OPENAI_MODEL` is not set, statement parsing uses `gpt-4.1-mini`.

`KEY_ENCRYPTION_SECRET` should be a long random string. The Worker uses it to derive an AES-GCM key.

## Statement parsing

- CSV and TSV are parsed on the Worker first, then optionally classified by the user's saved OpenAI key.
- TXT is sent to the user's saved OpenAI key for extraction.
- PDF and JPG/PNG/WEBP are sent to the user's saved OpenAI key for document/image parsing.
- Parsed output is saved back to `uploaded_documents.extracted_data`.

## Routes

```txt
POST /api-keys
POST /ai-summary
POST /parse-statement
POST /send-reminders
```

## Cron

Add a Cron Trigger such as:

```txt
0 13 * * *
```

That can call `sendDueReminders()` once daily.

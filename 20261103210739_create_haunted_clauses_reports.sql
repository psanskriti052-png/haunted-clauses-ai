/*
# Create Haunted Clauses reports

1. New Tables
- `haunted_clauses_reports` stores short-lived agreement scans for shareable report pages.
- `id` is the shareable report identifier.
- `created_at` records when the scan was created.
- `expires_at` is set to 24 hours after creation.
- `language` stores the selected report language.
- `document_type` stores rental, loan, or internship.
- `source_text` stores the submitted agreement text for the report context.
- `clauses` stores validated clause findings as JSON.
- `scare_score` stores the weighted overall risk score.
- `verdict` stores the plain-language overall result.

2. Security
- Row-level security is enabled.
- Anonymous and authenticated visitors may create reports and read only reports that have not expired.
- Anonymous and authenticated visitors cannot update or directly delete report rows.
- The cleanup function deletes only reports whose expiration time has passed.

3. Important Notes
- Reports are intentionally shareable by UUID and contain no account information.
- The application also filters expired reports before displaying them.
- Cleanup runs during normal report creation and retrieval so expired data is removed without requiring a separate scheduler.
*/

CREATE TABLE IF NOT EXISTS public.haunted_clauses_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  language text NOT NULL CHECK (language IN ('en', 'hi', 'mr')),
  document_type text NOT NULL CHECK (document_type IN ('rental', 'loan', 'internship')),
  source_text text NOT NULL CHECK (char_length(source_text) BETWEEN 1 AND 100000),
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  scare_score integer NOT NULL CHECK (scare_score BETWEEN 0 AND 100),
  verdict text NOT NULL
);

ALTER TABLE public.haunted_clauses_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.haunted_clauses_reports TO anon, authenticated;

DROP POLICY IF EXISTS "read_active_haunted_reports" ON public.haunted_clauses_reports;
CREATE POLICY "read_active_haunted_reports"
ON public.haunted_clauses_reports FOR SELECT
TO anon, authenticated
USING (expires_at > now());

DROP POLICY IF EXISTS "create_haunted_reports" ON public.haunted_clauses_reports;
CREATE POLICY "create_haunted_reports"
ON public.haunted_clauses_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  expires_at > now()
  AND expires_at <= now() + interval '25 hours'
  AND char_length(source_text) BETWEEN 1 AND 100000
);

CREATE INDEX IF NOT EXISTS haunted_clauses_reports_expires_at_idx
ON public.haunted_clauses_reports (expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_expired_haunted_reports()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.haunted_clauses_reports WHERE expires_at <= now();
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_haunted_reports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_haunted_reports() TO anon, authenticated;

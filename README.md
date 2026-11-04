# Haunted Clauses

Haunted Clauses is a Halloween-themed fine-print guide for students and first-time renters. It highlights clauses worth questioning in rental, loan, and internship agreements and explains them in plain language.

## Setup

The project runs as a Vite React app. Supabase is used to store reports for 24 hours. The report table and its expiry-aware access rules are provisioned in the connected project.

## Configuration

- `VITE_API_BASE_URL` is reserved for the AWS API Gateway + Lambda integration. When provided, the upload, analysis, and report requests can be routed there.
- Supabase connection values are supplied by the project environment.

The current demo includes a local rules-based analyzer so the experience works without an external AI key. It is designed so the analysis boundary can later be replaced by an AWS Lambda service that extracts PDF/image text, calls an LLM, validates strict clause JSON, retries once when needed, and saves the report.

## Architecture

- Landing flow: upload or paste text, choose language and document type.
- Processing flow: staged progress animation for upload, extraction, scanning, and report writing.
- Report flow: scare meter, risk filters, clause explanations, questions to ask, safer wording, copyable questions, shareable UUID route.
- Data retention: reports carry a 24-hour expiry and expired rows are cleaned whenever a new report is created or an existing report is opened.
- Safety: the product is informational only, not legal advice, and reports contain no account information.

## Live deployment

Add the live deployment URL here after publishing the hackathon demo.

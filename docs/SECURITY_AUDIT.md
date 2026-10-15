# Security and Privacy Audit Report

**Date:** April 16, 2026  
**Status:** Completed  
**Scope:** `app/`, `backend/`

---

## 1. Executive Summary
A comprehensive security and privacy audit was conducted on the repository codebase. The audit utilized Static Application Security Testing (SAST) and manual taint analysis to identify potential vulnerabilities. One medium-severity vulnerability was identified related to the browser environment used for scraping.

---

## 2. Findings

### VULN-001: Puppeteer Sandbox Disabled
*   **Vulnerability:** Disabled Browser Sandbox
*   **Vulnerability Type:** Security
*   **Severity:** Medium (FIXED)
*   **Location:** `backend/scraper/strategies/puppeteer.js` (`launchScraperBrowser`)
*   **Status:** Resolved (Remediated on October 15, 2026)

#### Description
The Puppeteer browser instance was previously launched unconditionally with the `--no-sandbox` and `--disable-setuid-sandbox` flags. This has been remediated in `launchScraperBrowser()` so that the Chromium sandbox remains enabled by default in local and standard environments, and `--no-sandbox` is only appended when explicitly running inside a restricted container environment (`CI=true` or `PUPPETEER_NO_SANDBOX=true`).

### VULN-002: Insecure Row Level Security (RLS) Policy
*   **Vulnerability:** Broken Access Control (Anonymous Table Insertion)
*   **Vulnerability Type:** Security
*   **Severity:** High (FIXED)
*   **Location:** `backend/price_alerts_schema.sql` (Lines 25-29)
*   **Status:** Resolved (Remediated on April 20, 2026)

#### Description
The RLS policy "Allow anonymous alert insertion" was removed. Authenticated sessions (including Supabase Anonymous Sign-ins) are strictly governed by the "Users can manage their own alerts" policy, which utilizes `(select auth.uid()) = user_id` for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

### VULN-003: PII Leak in Execution Logs
*   **Vulnerability:** Privacy Violation (Plaintext Push Token Logging)
*   **Vulnerability Type:** Privacy
*   **Severity:** Medium (FIXED)
*   **Location:** `backend/scraper/utils/alerts.js`
*   **Status:** Resolved (Remediated on April 20, 2026)

#### Description
Raw Expo Push Tokens were previously logged in plaintext during validation errors. This has been remediated by masking the token in the log output, preserving only the first 10 characters for debugging.

---

## 3. Audit Methodology & False Positives
The audit followed a two-pass "Recon & Investigate" model. The following potential issues were investigated and ruled out:

1.  **Unsafe URL Handling (`app/components/ExternalLink.tsx`):** Use of `WebBrowser.openBrowserAsync()` was checked for URI scheme injection. All current usages involve hardcoded `https://` documentation links.
2.  **Historical Diagnostic Scripts:** Legacy one-off diagnostic scripts (`backend/test_security.js` and `backend/scraper/utils/fix_policy.js`) were audited and removed from the repository.

---

## 4. Remediation Summary
All three identified findings (`VULN-001`, `VULN-002`, and `VULN-003`) have been remediated and verified via automated unit tests in `backend/scraper/tests/validation_and_alerts.test.js`.

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
*   **Location:** `backend/scraper/strategies/puppeteer.js` (Line 24)
*   **Status:** Resolved (Remediated on April 18, 2026)

#### Description
The Puppeteer browser instance was previously launched with the `--no-sandbox` and `--disable-setuid-sandbox` flags. This has been remediated by removing these flags and configuring the execution environment (GitHub Actions) to support the Chromium sandbox.

### VULN-002: Insecure Row Level Security (RLS) Policy
*   **Vulnerability:** Broken Access Control (Anonymous Table Insertion)
*   **Vulnerability Type:** Security
*   **Severity:** High (FIXED)
*   **Location:** `backend/price_alerts_schema.sql` (Lines 25-28)
*   **Status:** Resolved (Remediated on April 20, 2026)

#### Description
The RLS policy "Allow anonymous alert insertion" was removed. Anonymous users are now strictly governed by the "Users can manage their own alerts" policy, which utilizes `(select auth.uid())` for secure, performant identity verification.

### VULN-003: PII Leak in Execution Logs
*   **Vulnerability:** Privacy Violation (Plaintext Push Token Logging)
*   **Vulnerability Type:** Privacy
*   **Severity:** Medium (FIXED)
*   **Location:** `backend/scraper/utils/alerts.js` (Line 52)
*   **Status:** Resolved (Remediated on April 20, 2026)

#### Description
Raw Expo Push Tokens were previously logged in plaintext during validation errors. This has been remediated by masking the token in the log output, preserving only the first 10 characters for debugging.

---

## 3. Audit Methodology & False Positives
The audit followed a two-pass "Recon & Investigate" model. The following potential issues were investigated and ruled out:

1.  **Unsafe URL Handling (`app/components/ExternalLink.tsx`):** Use of `WebBrowser.openBrowserAsync()` was checked for URI scheme injection. All current usages involve hardcoded `https://` documentation links.
2.  **Public Key Exposure (`backend/test_security.js`):** The presence of `supabaseAnonKey` was noted. This is confirmed to be a public publishable key intended for client-side use and does not grant administrative database access.
3.  **Database RPC Usage (`backend/scraper/utils/fix_policy.js`):** The use of a custom `execute_sql` RPC was verified to be for one-off internal configuration scripts using static, non-user-controlled input.

---

## 4. Remediation Plan
A detailed fix plan is being developed to address the identified vulnerability without disrupting the scraping service.

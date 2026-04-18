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

#### Remediation Applied
1.  **Enabled Sandbox:** Removed `--no-sandbox` and `--disable-setuid-sandbox` from `backend/scraper/strategies/puppeteer.js`.
2.  **Environment Configuration:** Updated `.github/workflows/scrape-prices.yml` to install necessary system libraries (`libgbm-dev`, `libnss3`, etc.) required for the sandbox to function on Linux runners.
3.  **Security Verification:** The browser now runs within its intended security boundary, mitigating risks of RCE from compromised targets.

---

## 3. Audit Methodology & False Positives
The audit followed a two-pass "Recon & Investigate" model. The following potential issues were investigated and ruled out:

1.  **Unsafe URL Handling (`app/components/ExternalLink.tsx`):** Use of `WebBrowser.openBrowserAsync()` was checked for URI scheme injection. All current usages involve hardcoded `https://` documentation links.
2.  **Public Key Exposure (`backend/test_security.js`):** The presence of `supabaseAnonKey` was noted. This is confirmed to be a public publishable key intended for client-side use and does not grant administrative database access.
3.  **Database RPC Usage (`backend/scraper/utils/fix_policy.js`):** The use of a custom `execute_sql` RPC was verified to be for one-off internal configuration scripts using static, non-user-controlled input.

---

## 4. Remediation Plan
A detailed fix plan is being developed to address the identified vulnerability without disrupting the scraping service.

const nodemailer = require('nodemailer');
const escapeHTML = require('escape-html');

/**
 * Mailer Utility
 * Handles SMTP configuration and sending of health check alerts.
 */

const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to 'SendGrid', 'Mailgun', or a custom SMTP
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use an "App Password" for Gmail
  },
});

/**
 * Sends a health alert email with the list of failed providers.
 * @param {string} failureHtmlList - Pre-escaped HTML string containing <li> tags.
 */
async function sendHealthAlert(failureHtmlList) {
  if (!process.env.NOTIFICATION_EMAIL) {
      console.warn('[Mailer] NOTIFICATION_EMAIL not set, skipping email alert.');
      return;
  }

  const mailOptions = {
    from: `"Qatar Gold Scraper" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `🚨 Gold Scraper Alert: Provider Failures Detected`,
    html: `
      <h2>Data Source Health Alert</h2>
      <p>The daily health check detected issues with the following data sources:</p>
      <ul>
        ${failureHtmlList}
      </ul>
      <p>Please check the <a href="https://github.com/nabeeles/Qatar-Gold-Prices/actions">GitHub Actions logs</a> for details.</p>
      <br/>
      <hr/>
      <p><small>Automated Message from Qatar Gold Price Backend</small></p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Health alert email sent:', info.messageId);
  } catch (error) {
    console.error('[Mailer] Failed to send alert email:', error.message);
  }
}

/**
 * Builds the subject, plain-text summary, and escaped HTML body for fallback / primary failure emails.
 * @param {string} providerName - Name of the provider.
 * @param {string} errorReason - The primary error that triggered the fallback or total failure.
 * @param {boolean} fallbackSucceeded - Whether the fallback aggregator succeeded.
 */
function buildFallbackEmailContent(providerName, errorReason, fallbackSucceeded = true) {
  const sanitizedProvider = escapeHTML(String(providerName || 'Unknown Provider'));
  const sanitizedError = escapeHTML(String(errorReason || 'Unknown error'));

  if (fallbackSucceeded) {
    return {
      subject: `⚠️ [Qatar Gold] Fallback Activated for ${sanitizedProvider}`,
      text: `Primary extraction failed for '${providerName}'. Reason: ${errorReason}. Fallback to 'goldpriceqatar.com' succeeded.`,
      html: `
        <h2>Primary Source Failure - Fallback Utilized</h2>
        <p>The scraper for <b>${sanitizedProvider}</b> failed to reach its primary direct source.</p>
        <p><b>Primary Error:</b> ${sanitizedError}</p>
        <p>✅ <b>Action Taken:</b> Fallback to 'goldpriceqatar.com' succeeded and market data was synchronized.</p>
        <p>No immediate action is required, but you may want to check if the primary URL or website structure has changed.</p>
        <br/>
        <hr/>
        <p><small>Automated Message from Qatar Gold Price Backend</small></p>
      `,
    };
  }

  return {
    subject: `🚨 [Qatar Gold] CRITICAL: Extraction Failed for ${sanitizedProvider}`,
    text: `Both primary and fallback extraction failed for '${providerName}'. Reason: ${errorReason}. Immediate investigation required.`,
    html: `
      <h2>Critical Provider Failure - Primary &amp; Fallback Failed</h2>
      <p>Both primary and fallback extraction failed for <b>${sanitizedProvider}</b>.</p>
      <p><b>Error Details:</b> ${sanitizedError}</p>
      <p>❌ <b>Action Required:</b> Immediate investigation required. No prices were recorded for this provider in the current run.</p>
      <br/>
      <hr/>
      <p><small>Automated Message from Qatar Gold Price Backend</small></p>
    `,
  };
}

/**
 * Sends an alert when a primary source fails and the system either uses a fallback or fails completely.
 * @param {string} providerName - Name of the provider.
 * @param {string} error - The primary error that triggered the fallback.
 * @param {boolean} fallbackSucceeded - Whether fallback extraction succeeded.
 */
async function sendFallbackAlert(providerName, error, fallbackSucceeded = true) {
  if (!process.env.NOTIFICATION_EMAIL) {
    console.warn('[Mailer] NOTIFICATION_EMAIL not set, skipping fallback alert.');
    return;
  }

  const content = buildFallbackEmailContent(providerName, error, fallbackSucceeded);

  const mailOptions = {
    from: `"Qatar Gold Scraper" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: content.subject,
    text: content.text,
    html: content.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Fallback alert sent for ${providerName} (fallbackSucceeded=${fallbackSucceeded})`);
  } catch (err) {
    console.error('[Mailer] Failed to send fallback alert:', err.message);
  }
}

module.exports = { sendHealthAlert, sendFallbackAlert, buildFallbackEmailContent, escapeHTML };

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
 * Sends an alert when a primary source fails and the system successfully uses a fallback.
 * @param {string} providerName - Name of the provider.
 * @param {string} error - The primary error that triggered the fallback.
 */
async function sendFallbackAlert(providerName, error) {
  if (!process.env.NOTIFICATION_EMAIL) return;

  const sanitizedProvider = escapeHTML(providerName);
  const sanitizedError = escapeHTML(error);

  const mailOptions = {
    from: `"Qatar Gold Scraper" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `⚠️ Gold Scraper Fallback: ${sanitizedProvider}`,
    html: `
      <h2>Primary Source Failure - Fallback Utilized</h2>
      <p>The scraper for <b>${sanitizedProvider}</b> failed to reach its primary direct source.</p>
      <p><b>Primary Error:</b> ${sanitizedError}</p>
      <p>✅ <b>Action Taken:</b> The system successfully retrieved market data using the aggregator fail-safe.</p>
      <p>No immediate action is required, but you may want to check if the primary URL or website structure has changed.</p>
      <br/>
      <hr/>
      <p><small>Automated Message from Qatar Gold Price Backend</small></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Fallback alert sent for ${providerName}`);
  } catch (err) {
    console.error('[Mailer] Failed to send fallback alert:', err.message);
  }
}

module.exports = { sendHealthAlert, sendFallbackAlert, escapeHTML };

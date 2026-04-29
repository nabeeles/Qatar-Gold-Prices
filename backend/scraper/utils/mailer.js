const nodemailer = require('nodemailer');

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
 * @param {Array} failures - Array of objects containing { name, error }.
 */
async function sendHealthAlert(failures) {
  if (!process.env.NOTIFICATION_EMAIL) {
      console.warn('[Mailer] NOTIFICATION_EMAIL not set, skipping email alert.');
      return;
  }

  const failureList = failures.map(f => `<li><b>${f.name}</b>: ${f.error}</li>`).join('');
  
  const mailOptions = {
    from: `"Qatar Gold Scraper" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `🚨 Gold Scraper Alert: ${failures.length} Providers Failed`,
    html: `
      <h2>Data Source Health Alert</h2>
      <p>The daily health check detected issues with the following data sources:</p>
      <ul>
        ${failureList}
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

module.exports = { sendHealthAlert };

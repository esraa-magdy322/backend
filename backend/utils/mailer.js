const nodemailer = require('nodemailer');

const sendMail = async ({ to, subject, html }) => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"HRX Platform" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`[Email Sent] Verification email successfully sent to: ${to}`);
      return true;
    } catch (error) {
      console.error('[Email Error] Failed to send email via SMTP:', error.message);
    }
  }
  
  console.log('\n------------------------------------------------');
  console.log(`[Email Mocked] To: ${to}`);
  console.log(`[Email Mocked] Subject: ${subject}`);
  console.log(`[Email Mocked] HTML Content:`);
  console.log(html);
  console.log('------------------------------------------------\n');
  return false;
};

module.exports = { sendMail };

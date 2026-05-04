const nodemailer = require('nodemailer');

function getTransporter() {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider === 'sendgrid') {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  if (provider === 'ses') {
    return nodemailer.createTransport({
      host: 'email-smtp.' + (process.env.AWS_REGION || 'us-east-1') + '.amazonaws.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_SES_ACCESS_KEY_ID,
        pass: process.env.AWS_SES_SECRET_ACCESS_KEY,
      },
    });
  }

  // Default: generic SMTP (Mailgun, Zoho, Gmail, etc.)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function isEmailConfigured() {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  if (provider === 'sendgrid') return !!process.env.SENDGRID_API_KEY;
  if (provider === 'ses') return !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY);
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    throw new Error('E-mail provider not configured. Set EMAIL_PROVIDER and related env vars.');
  }

  const from = process.env.EMAIL_FROM || 'noreply@zapai.app';
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return info;
}

module.exports = {
  sendEmail,
  isEmailConfigured,
};

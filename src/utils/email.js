/**
 * @file src/utils/email.js
 * @description Email sending utility using Nodemailer (Gmail SMTP).
 * Sends real 6-digit OTP and transactional emails with zero third-party gatekeeping.
 */

const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user.trim(),
          pass: pass.replace(/\s+/g, ''), // handles 16-char app passwords with spaces
        },
      });
    }
  }
  return transporter;
};

/**
 * Send real 6-digit OTP verification email.
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} name - User's name (optional)
 */
const sendOTPEmail = async (toEmail, otp, name = 'FoodRush User') => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[FoodRush Email] EMAIL_USER or EMAIL_PASS not configured in environment.');
    return false;
  }

  const mailOptions = {
    from: `"FoodRush App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `🔐 Your FoodRush Verification Code: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0F0E17; color: #FFFFFE; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #FF6B35; margin: 0; font-size: 26px;">🍕 FoodRush</h1>
          <p style="color: #A7A9BE; font-size: 14px; margin-top: 4px;">Fast & Fresh Food Delivery</p>
        </div>
        
        <p style="font-size: 15px; color: #FFFFFE;">Hello <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #A7A9BE; line-height: 1.5;">
          Use the 6-digit verification code below to verify your account or reset your password. This code is valid for <strong>10 minutes</strong>.
        </p>

        <div style="background: rgba(255, 107, 53, 0.12); border: 2px dashed #FF6B35; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #FF6B35;">${otp}</span>
        </div>

        <p style="font-size: 12px; color: #A7A9BE; text-align: center; margin-top: 20px;">
          If you did not request this code, please ignore this email. Do not share this code with anyone.
        </p>

        <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 24px; padding-top: 16px; text-align: center;">
          <p style="font-size: 11px; color: #72757E; margin: 0;">© 2026 FoodRush. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await mailer.sendMail(mailOptions);
    console.log(`[FoodRush Email] OTP email sent successfully to ${toEmail.split('@')[0]}***: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[FoodRush Email] Failed to send email to ${toEmail.split('@')[0]}***:`, err.message);
    return false;
  }
};

module.exports = { sendOTPEmail };

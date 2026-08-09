/**
 * @file src/services/email.service.js
 * @description Email notification service using Nodemailer + Gmail SMTP.
 */

const nodemailer = require('nodemailer');

// ── Transporter (Gmail SMTP) ─────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars)
    },
  });

// ── Base HTML template ───────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FoodRush</title>
</head>
<body style="margin:0;padding:0;background:#0F0E17;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0E17;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#16152A;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#FF6B35,#E94560);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
                🍕 FoodRush
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Fast & Fresh Delivery
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#8B8FA8;font-size:12px;">
                © 2025 FoodRush • Jaipur, India<br/>
                Koi samasya? Reply karo is email pe.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── Helper: send email ───────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured — skipping email send');
    return;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"FoodRush 🍕" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    // Don't throw — email failure shouldn't break the main flow
  }
};

// ════════════════════════════════════════════════════════════════
// Email Templates
// ════════════════════════════════════════════════════════════════

/**
 * Send "Order Placed" email to customer
 */
const sendOrderPlacedEmail = async ({ customerEmail, customerName, order, restaurantName }) => {
  const itemsHTML = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;color:#EAEAF0;font-size:14px;">${item.name}</td>
          <td style="padding:8px 0;color:#8B8FA8;font-size:14px;text-align:center;">×${item.quantity}</td>
          <td style="padding:8px 0;color:#FF6B35;font-size:14px;text-align:right;font-weight:600;">₹${item.price * item.quantity}</td>
        </tr>`
    )
    .join('');

  const content = `
    <h2 style="margin:0 0 6px;color:#EAEAF0;font-size:22px;font-weight:700;">
      Order Placed! 🎉
    </h2>
    <p style="margin:0 0 24px;color:#8B8FA8;font-size:14px;line-height:1.6;">
      Namaste <strong style="color:#EAEAF0;">${customerName}</strong>! Tumhara order receive ho gaya hai.
    </p>

    <!-- Order ID Box -->
    <div style="background:rgba(255,107,53,0.1);border:1px solid rgba(255,107,53,0.25);border-radius:10px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;color:#8B8FA8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Order ID</p>
      <p style="margin:4px 0 0;color:#FF6B35;font-size:16px;font-weight:700;">#${String(order._id).slice(-10).toUpperCase()}</p>
    </div>

    <!-- Restaurant -->
    <p style="margin:0 0 16px;color:#EAEAF0;font-size:14px;">
      🍽️ <strong>${restaurantName}</strong>
    </p>

    <!-- Items Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding-bottom:8px;color:#8B8FA8;font-size:12px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Item</td>
        <td style="padding-bottom:8px;color:#8B8FA8;font-size:12px;text-transform:uppercase;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">Qty</td>
        <td style="padding-bottom:8px;color:#8B8FA8;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(255,255,255,0.08);">Price</td>
      </tr>
      ${itemsHTML}
      <tr>
        <td colspan="3" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;"></td>
      </tr>
      <tr>
        <td colspan="2" style="color:#EAEAF0;font-weight:700;font-size:15px;">Grand Total</td>
        <td style="color:#FF6B35;font-weight:800;font-size:18px;text-align:right;">₹${order.grandTotal}</td>
      </tr>
    </table>

    <!-- Payment Method -->
    <p style="margin:0 0 24px;color:#8B8FA8;font-size:13px;">
      💳 Payment: <span style="color:#EAEAF0;">${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}</span>
    </p>

    <!-- Status -->
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:12px 18px;text-align:center;">
      <p style="margin:0;color:#F59E0B;font-size:14px;font-weight:600;">⏳ Status: Pending</p>
      <p style="margin:4px 0 0;color:#8B8FA8;font-size:12px;">Restaurant jald hi confirm karega</p>
    </div>
  `;

  await sendEmail({
    to: customerEmail,
    subject: `🍕 Order Placed! #${String(order._id).slice(-8).toUpperCase()} — FoodRush`,
    html: baseTemplate(content),
  });
};

/**
 * Send "Order Confirmed / Status Update" email to customer
 */
const sendOrderStatusEmail = async ({ customerEmail, customerName, orderId, status }) => {
  const statusConfig = {
    confirmed:         { emoji: '✅', label: 'Confirmed',         color: '#818CF8', msg: 'Restaurant ne tumhara order accept kar liya!' },
    preparing:         { emoji: '👨‍🍳', label: 'Preparing',        color: '#FF6B35', msg: 'Chef khana bana raha hai — thoda wait karo!' },
    out_for_delivery:  { emoji: '🛵', label: 'Out for Delivery',  color: '#22D3EE', msg: 'Delivery boy aa raha hai tumhare paas!' },
    delivered:         { emoji: '🎉', label: 'Delivered',         color: '#22C55E', msg: 'Khana pahunch gaya! Enjoy karo!' },
    cancelled:         { emoji: '❌', label: 'Cancelled',         color: '#EF4444', msg: 'Order cancel ho gaya. Sorry for inconvenience.' },
  };

  const cfg = statusConfig[status] || { emoji: '📦', label: status, color: '#FF6B35', msg: 'Order update.' };

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">${cfg.emoji}</div>
      <h2 style="margin:0 0 6px;color:#EAEAF0;font-size:22px;font-weight:700;">
        Order ${cfg.label}!
      </h2>
      <p style="margin:0;color:#8B8FA8;font-size:14px;">
        ${cfg.msg}
      </p>
    </div>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;color:#8B8FA8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Order ID</p>
      <p style="margin:4px 0 0;color:${cfg.color};font-size:16px;font-weight:700;">#${String(orderId).slice(-10).toUpperCase()}</p>
    </div>

    <div style="background:rgba(255,255,255,0.04);border-left:3px solid ${cfg.color};padding:12px 18px;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:#EAEAF0;font-size:14px;">
        Namaste <strong>${customerName}</strong>! Tumhare order ka status update hua hai.
      </p>
    </div>
  `;

  await sendEmail({
    to: customerEmail,
    subject: `${cfg.emoji} Order ${cfg.label}! #${String(orderId).slice(-8).toUpperCase()} — FoodRush`,
    html: baseTemplate(content),
  });
};

/**
 * Send "Payment Successful" email to customer
 */
const sendPaymentSuccessEmail = async ({ customerEmail, customerName, orderId, amount, paymentId }) => {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">💳✅</div>
      <h2 style="margin:0 0 6px;color:#EAEAF0;font-size:22px;font-weight:700;">
        Payment Successful!
      </h2>
      <p style="margin:0;color:#8B8FA8;font-size:14px;">
        Namaste <strong style="color:#EAEAF0;">${customerName}</strong>! Payment confirm ho gaya.
      </p>
    </div>

    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;color:#8B8FA8;font-size:12px;text-transform:uppercase;">Amount Paid</p>
      <p style="margin:0;color:#22C55E;font-size:32px;font-weight:800;">₹${amount}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;color:#8B8FA8;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">Order ID</td>
        <td style="padding:10px 0;color:#EAEAF0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">#${String(orderId).slice(-10).toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8B8FA8;font-size:13px;">Payment ID</td>
        <td style="padding:10px 0;color:#EAEAF0;font-size:13px;font-weight:600;text-align:right;">${paymentId}</td>
      </tr>
    </table>
  `;

  await sendEmail({
    to: customerEmail,
    subject: `💳 Payment ₹${amount} Successful! — FoodRush`,
    html: baseTemplate(content),
  });
};

module.exports = {
  sendOrderPlacedEmail,
  sendOrderStatusEmail,
  sendPaymentSuccessEmail,
};

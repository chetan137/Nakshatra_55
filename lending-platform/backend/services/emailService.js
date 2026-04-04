/**
 * Email Service — uses Brevo (Sendinblue) Transactional Email API
 * No extra packages needed — uses Node.js native fetch.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function buildOTPBoxes(otp) {
  return otp
    .split('')
    .map(
      (digit) => `
      <td style="padding: 0 4px;">
        <div style="
          width: 48px; height: 56px;
          background: #2D1B69;
          border-radius: 10px;
          display: inline-block;
          line-height: 56px;
          text-align: center;
          font-size: 26px;
          font-weight: 700;
          color: #FFFFFF;
          font-family: 'Inter', Arial, sans-serif;
        ">${digit}</div>
      </td>`
    )
    .join('');
}

function getEmailHTML(name, otp, type) {
  const isVerify = type === 'verify';
  const heading = isVerify ? 'Verify your email' : 'Reset your password';
  const message = isVerify
    ? 'Thanks for signing up with LendChain! Use the code below to verify your email address and activate your account.'
    : 'We received a request to reset your LendChain password. Use the code below to continue.';
  const warning = isVerify
    ? "If you didn't create a LendChain account, you can safely ignore this email."
    : "If you didn't request a password reset, please ignore this email. Your password will remain unchanged.";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#0F0A1E; font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0F0A1E; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px; width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px; font-weight:800; color:#6B4EFF;">Lend</span><span style="font-size:28px; font-weight:800; color:#FF8C69;">Chain</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#1A1040; border-radius:20px; padding:40px 36px;">
              <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:#FFFFFF;">${heading}</h1>
              <p style="margin:0 0 28px; font-size:15px; color:#C4B5FD; line-height:1.6;">Hi ${name},</p>
              <p style="margin:0 0 32px; font-size:15px; color:#C4B5FD; line-height:1.6;">${message}</p>
              <!-- OTP Boxes -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 28px;">
                <tr>
                  ${buildOTPBoxes(otp)}
                </tr>
              </table>
              <p style="margin:0 0 28px; font-size:13px; color:#8B7EC8; text-align:center;">This code expires in <strong style="color:#FF8C69;">10 minutes</strong></p>
              <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:24px 0;">
              <p style="margin:0; font-size:12px; color:#6B5FA5; line-height:1.6;">⚠️ ${warning}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0; font-size:12px; color:#4A3F6B;">&copy; ${new Date().getFullYear()} LendChain. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendOTPEmail(email, name, otp, type = 'verify') {
  const subject =
    type === 'verify'
      ? 'Verify your LendChain account'
      : 'Reset your LendChain password';

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n========================================`);
    console.log(`🔑 DEV MODE OTP FOR ${email}: ${otp}`);
    console.log(`========================================\n`);
  }

  const payload = {
    sender: {
      name: process.env.EMAIL_FROM_NAME || 'LendChain',
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email, name }],
    subject,
    htmlContent: getEmailHTML(name, otp, type),
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[EmailService] Brevo API error:', response.status, errBody);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[WARNING] Failed to send OTP through Brevo. Check OTP printed above (dev only).`);
      } else {
        console.error('[EmailService] Failed to send OTP email. Check BREVO_API_KEY and BREVO_SENDER_EMAIL.');
      }
      return; // Fail gracefully instead of crashing registration
    }

    const data = await response.json();
    console.log(`[EmailService] ${type} OTP sent to ${email} — messageId: ${data.messageId}`);
  } catch (error) {
    console.error('[EmailService] Failed to execute email fetch:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[WARNING] Network or config issue sending email. Check OTP printed above (dev only).`);
    }
    // Do not throw an error here, so the backend still returns 201 to frontend and doesn't crash the flow
  }
}

module.exports = { sendOTPEmail };
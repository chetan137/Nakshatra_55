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

// ── Shared Brevo send helper ───────────────────────────────────
async function sendBrevo(to, subject, htmlContent) {
  const payload = {
    sender: {
      name:  process.env.EMAIL_FROM_NAME  || 'LendChain',
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to,
    subject,
    htmlContent,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[EmailService] Brevo error:', response.status, err);
      return;
    }
    const data = await response.json();
    console.log(`[EmailService] Email sent to ${to.map(t => t.email).join(', ')} — messageId: ${data.messageId}`);
  } catch (err) {
    console.error('[EmailService] fetch failed:', err.message);
  }
}

// ── Margin Call Alert ──────────────────────────────────────────
/**
 * Sent to BOTH borrower + lender when collateral ratio drops below 150%.
 * @param {object} borrower   { name, email }
 * @param {object} lender     { name, email }
 * @param {object} loan       { _id, principal, collateral, durationDays }
 * @param {number} currentRatio  e.g. 138 (percent)
 * @param {Date}   deadline      48h from now
 */
async function sendMarginCallAlert(borrower, lender, loan, currentRatio, deadline) {
  const deadlineStr = new Date(deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const shortfall   = ((loan.principal * 1.5) - (loan.collateral * currentRatio / 100)).toFixed(4);

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F0A1E;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0F0A1E;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#6B4EFF;">Lend</span><span style="font-size:28px;font-weight:800;color:#FF8C69;">Chain</span>
        </td></tr>
        <tr><td style="background:#1A1040;border-radius:20px;padding:40px 36px;">
          <div style="background:#FF8C6920;border:1px solid #FF8C69;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#FF8C69;">⚠️ Margin Call — Action Required</p>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:#C4B5FD;line-height:1.6;">
            The collateral ratio on loan <strong style="color:#fff;">#${loan._id.toString().slice(-8)}</strong> has dropped to
            <strong style="color:#FF8C69;">${currentRatio}%</strong> (minimum required: 150%).
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Loan Principal</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">${loan.principal} ETH</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Current Collateral</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">${loan.collateral} ETH</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Current Ratio</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#FF8C69;font-size:13px;font-weight:700;text-align:right;">${currentRatio}%</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8B7EC8;font-size:13px;">Deadline</td>
              <td style="padding:8px 0;color:#FF8C69;font-size:13px;font-weight:700;text-align:right;">${deadlineStr} IST</td>
            </tr>
          </table>
          <div style="background:#2D1B69;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;color:#C4B5FD;font-size:13px;font-weight:600;">Borrower — you must act within 48 hours:</p>
            <ul style="margin:0;padding-left:18px;color:#C4B5FD;font-size:13px;line-height:1.8;">
              <li>Repay the full loan to recover your collateral</li>
              <li>Or deposit ~${shortfall} ETH more collateral (login to LendChain)</li>
            </ul>
          </div>
          <p style="margin:0;font-size:12px;color:#6B5FA5;line-height:1.6;">
            If no action is taken by the deadline, this loan will be automatically liquidated and the collateral transferred to the lender.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#4A3F6B;">© ${new Date().getFullYear()} LendChain. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const recipients = [{ email: borrower.email, name: borrower.name }];
  if (lender?.email) recipients.push({ email: lender.email, name: lender.name });

  await sendBrevo(recipients, '⚠️ Margin Call — Your Loan Needs Attention', html);
}

// ── Liquidation Alert ──────────────────────────────────────────
/**
 * Sent after a loan is liquidated.
 * @param {object} lender    { name, email }
 * @param {object} borrower  { name, email }
 * @param {object} loan      { _id, principal, collateral }
 * @param {number} currentRatio  collateral ratio at time of liquidation
 * @param {string} reason    'overdue' | 'price_drop'
 */
async function sendLiquidationAlert(lender, borrower, loan, currentRatio, reason) {
  const reasonText = reason === 'overdue'
    ? 'The loan passed its due date without repayment.'
    : 'The collateral price dropped below the 120% liquidation threshold.';

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F0A1E;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0F0A1E;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#6B4EFF;">Lend</span><span style="font-size:28px;font-weight:800;color:#FF8C69;">Chain</span>
        </td></tr>
        <tr><td style="background:#1A1040;border-radius:20px;padding:40px 36px;">
          <div style="background:#C6282820;border:1px solid #C62828;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#FF4D4D;">🔴 Loan Liquidated</p>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:#C4B5FD;line-height:1.6;">
            Loan <strong style="color:#fff;">#${loan._id.toString().slice(-8)}</strong> has been liquidated.
            ${reasonText}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Principal</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">${loan.principal} ETH</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Collateral (sent to lender)</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#00C896;font-size:13px;font-weight:700;text-align:right;">${loan.collateral} ETH</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8B7EC8;font-size:13px;">Final Ratio</td>
              <td style="padding:8px 0;color:#FF4D4D;font-size:13px;font-weight:700;text-align:right;">${currentRatio ?? 'N/A'}%</td>
            </tr>
          </table>
          <div style="background:#2D1B69;border-radius:12px;padding:16px 20px;">
            <p style="margin:0;color:#C4B5FD;font-size:13px;">
              <strong style="color:#fff;">Lender:</strong> The collateral (${loan.collateral} ETH) has been transferred to your wallet.<br><br>
              <strong style="color:#fff;">Borrower:</strong> Your collateral has been used to settle this loan. Your on-chain reputation score has been updated.
            </p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#4A3F6B;">© ${new Date().getFullYear()} LendChain. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const recipients = [];
  if (lender?.email)   recipients.push({ email: lender.email,   name: lender.name });
  if (borrower?.email) recipients.push({ email: borrower.email, name: borrower.name });

  if (recipients.length > 0) {
    await sendBrevo(recipients, '🔴 Loan Liquidated — LendChain', html);
  }
}

// ── Guarantor Request Notification ────────────────────────────
/**
 * Sent ONLY to the specific guarantor user when a borrower requests them.
 * @param {object} guarantorUser   { name, email }
 * @param {object} borrowerUser    { name, walletAddress }
 * @param {object} loan            { _id, principal, durationDays, interestRateBps }
 * @param {number} guaranteeAmount ETH amount guarantor is liable for
 * @param {string} borrowerMessage optional message from borrower
 */
async function sendGuarantorRequestEmail(guarantorUser, borrowerUser, loan, guaranteeAmount, borrowerMessage) {
  const loanShortId = loan._id.toString().slice(-8).toUpperCase();
  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inboxUrl    = `${frontendUrl}/guarantor-inbox`;

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F0A1E;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0F0A1E;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="500" style="max-width:500px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#6B4EFF;">Lend</span><span style="font-size:28px;font-weight:800;color:#FF8C69;">Chain</span>
        </td></tr>
        <tr><td style="background:#1A1040;border-radius:20px;padding:40px 36px;">

          <div style="background:rgba(107,78,255,0.15);border:1px solid #6B4EFF;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#C4B5FD;">🤝 You've Been Asked to Guarantee a Loan</p>
          </div>

          <p style="margin:0 0 8px;font-size:15px;color:#C4B5FD;line-height:1.6;">Hi <strong style="color:#fff;">${guarantorUser.name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#C4B5FD;line-height:1.6;">
            <strong style="color:#FF8C69;">${borrowerUser.name}</strong> has requested you as a <strong style="color:#fff;">Guarantor</strong>
            for their loan on LendChain. As a guarantor, you promise to cover the loan if the borrower is unable to pay.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Loan ID</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">#${loanShortId}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Borrower Wallet</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#FF8C69;font-size:12px;text-align:right;font-family:monospace;">${borrowerUser.walletAddress?.slice(0, 8)}…${borrowerUser.walletAddress?.slice(-6)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Loan Amount</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">${loan.principal} ETH</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8B7EC8;font-size:13px;">Duration</td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;text-align:right;">${loan.durationDays} days @ ${interestPct}% APR</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8B7EC8;font-size:13px;font-weight:700;">Your Guarantee Liability</td>
              <td style="padding:8px 0;color:#FF4D4D;font-size:14px;font-weight:800;text-align:right;">${guaranteeAmount} ETH</td>
            </tr>
          </table>

          ${borrowerMessage ? `
          <div style="background:#2D1B69;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#8B7EC8;font-weight:600;">MESSAGE FROM BORROWER:</p>
            <p style="margin:0;font-size:14px;color:#C4B5FD;font-style:italic;">"${borrowerMessage}"</p>
          </div>` : ''}

          <div style="background:rgba(255,76,76,0.08);border:1px solid rgba(255,76,76,0.3);border-radius:12px;padding:14px 18px;margin-bottom:28px;">
            <p style="margin:0;font-size:13px;color:#FFB3B3;line-height:1.6;">
              ⚠️ <strong>Important:</strong> If you approve this guarantee and the borrower defaults,
              you will be held responsible for repaying <strong>${guaranteeAmount} ETH</strong>.
              Only approve if you trust this borrower and can cover the amount.
            </p>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-right:8px;" width="50%">
                <a href="${inboxUrl}" style="display:block;text-align:center;background:#6B4EFF;color:#fff;font-weight:700;font-size:14px;padding:14px;border-radius:10px;text-decoration:none;">
                  ✅ Review Request
                </a>
              </td>
              <td style="padding-left:8px;" width="50%">
                <a href="${inboxUrl}" style="display:block;text-align:center;background:rgba(255,255,255,0.06);color:#C4B5FD;font-weight:700;font-size:14px;padding:14px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.1);">
                  View Inbox
                </a>
              </td>
            </tr>
          </table>

        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#4A3F6B;">© ${new Date().getFullYear()} LendChain. This notification was sent only to you.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await sendBrevo(
    [{ email: guarantorUser.email, name: guarantorUser.name }],
    `🤝 Guarantee Request for Loan #${loanShortId} — Action Required`,
    html
  );
}

// ── Guarantor Response Notification (to borrower) ─────────────
/**
 * Sent to borrower when guarantor approves or rejects.
 * @param {object} borrowerUser   { name, email }
 * @param {object} guarantorUser  { name, walletAddress }
 * @param {object} loan           { _id, principal }
 * @param {'approved'|'rejected'} decision
 * @param {string} guarantorNote
 */
async function sendGuarantorResponseEmail(borrowerUser, guarantorUser, loan, decision, guarantorNote) {
  const loanShortId = loan._id.toString().slice(-8).toUpperCase();
  const isApproved  = decision === 'approved';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F0A1E;font-family:'Inter',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0F0A1E;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="500" style="max-width:500px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#6B4EFF;">Lend</span><span style="font-size:28px;font-weight:800;color:#FF8C69;">Chain</span>
        </td></tr>
        <tr><td style="background:#1A1040;border-radius:20px;padding:40px 36px;">

          <div style="background:${isApproved ? 'rgba(0,200,150,0.12)' : 'rgba(255,76,76,0.12)'};border:1px solid ${isApproved ? '#00C896' : '#FF4D4D'};border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <p style="margin:0;font-size:18px;font-weight:800;color:${isApproved ? '#00C896' : '#FF4D4D'};">
              ${isApproved ? '✅ Guarantee Approved!' : '❌ Guarantee Rejected'}
            </p>
          </div>

          <p style="margin:0 0 8px;font-size:15px;color:#C4B5FD;line-height:1.6;">Hi <strong style="color:#fff;">${borrowerUser.name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#C4B5FD;line-height:1.6;">
            ${isApproved
              ? `<strong style="color:#FF8C69;">${guarantorUser.name}</strong> has <strong style="color:#00C896;">approved</strong> your guarantee request for loan <strong style="color:#fff;">#${loanShortId}</strong>. Your loan is now backed by a guarantor.`
              : `<strong style="color:#FF8C69;">${guarantorUser.name}</strong> has <strong style="color:#FF4D4D;">declined</strong> your guarantee request for loan <strong style="color:#fff;">#${loanShortId}</strong>. Please find another guarantor.`
            }
          </p>

          ${guarantorNote ? `
          <div style="background:#2D1B69;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#8B7EC8;font-weight:600;">GUARANTOR'S NOTE:</p>
            <p style="margin:0;font-size:14px;color:#C4B5FD;font-style:italic;">"${guarantorNote}"</p>
          </div>` : ''}

          <a href="${frontendUrl}/borrow" style="display:block;text-align:center;background:#6B4EFF;color:#fff;font-weight:700;font-size:14px;padding:14px;border-radius:10px;text-decoration:none;">
            ${isApproved ? 'Proceed to Borrow' : 'Request Another Guarantor'}
          </a>

        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#4A3F6B;">© ${new Date().getFullYear()} LendChain. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await sendBrevo(
    [{ email: borrowerUser.email, name: borrowerUser.name }],
    `${isApproved ? '✅ Guarantee Approved' : '❌ Guarantee Rejected'} — Loan #${loanShortId}`,
    html
  );
}

module.exports = {
  sendOTPEmail,
  sendMarginCallAlert,
  sendLiquidationAlert,
  sendGuarantorRequestEmail,
  sendGuarantorResponseEmail,
};

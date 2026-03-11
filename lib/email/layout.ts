/**
 * BAM branded email HTML layout.
 * Uses inline styles for maximum email client compatibility.
 */
export function renderEmailHtml({
  headerText,
  bodyHtml,
  buttonText,
  buttonUrl,
  footerText,
}: {
  headerText?: string | null;
  bodyHtml: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  footerText?: string | null;
}): string {
  const button =
    buttonText && buttonUrl
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
      <tr>
        <td style="border-radius: 8px; background-color: #9C8BBF;">
          <a href="${escapeHtml(buttonUrl)}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: 'Montserrat', Arial, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(buttonText)}
          </a>
        </td>
      </tr>
    </table>`
      : "";

  const footer = footerText
    ? escapeHtml(footerText)
    : "Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ballet Academy and Movement</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: 'Montserrat', Arial, sans-serif; color: #2C2C2C; -webkit-text-size-adjust: 100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF7F2;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- Lavender header bar -->
          <tr>
            <td style="background-color: #9C8BBF; padding: 24px 32px; border-radius: 16px 16px 0 0; text-align: center;">
              <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">
                Ballet Academy and Movement
              </p>
            </td>
          </tr>

          <!-- Header text -->
          ${
            headerText
              ? `
          <tr>
            <td style="background-color: #ffffff; padding: 32px 32px 0 32px;">
              <h1 style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 600; color: #2C2C2C;">
                ${escapeHtml(headerText)}
              </h1>
            </td>
          </tr>`
              : ""
          }

          <!-- Body content -->
          <tr>
            <td style="background-color: #ffffff; padding: ${headerText ? "16px" : "32px"} 32px 32px 32px; font-size: 15px; line-height: 1.7; color: #2C2C2C;">
              ${bodyHtml}
              ${button}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5F0E8; padding: 20px 32px; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6B6B7B; line-height: 1.5;">
                ${footer}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #A8A8B8;">
                <a href="https://balletacademyandmovement.com" style="color: #9C8BBF; text-decoration: none;">balletacademyandmovement.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

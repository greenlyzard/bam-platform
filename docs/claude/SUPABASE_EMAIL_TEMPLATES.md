# Supabase Auth Email Templates — BAM Branded

Paste these into your Supabase Dashboard under **Authentication > Email Templates**.

Each template uses the BAM brand layout: lavender header bar, cream background,
Cormorant Garamond headings, Nunito body text, gold/lavender CTA button, and
studio footer.

> **Note:** Supabase templates use Go template syntax (`{{ .Variable }}`).
> Do NOT confuse with the `{{variable}}` syntax used in the platform email_templates table.

---

## 1. Magic Link (Confirm signup / Magic link)

**Subject:** `Your sign-in link for Ballet Academy and Movement`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Nunito',Arial,sans-serif;color:#2C2C2C;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#9C8BBF;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                Ballet Academy and Movement
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:#2C2C2C;">
                Sign in to your account
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:16px 32px 32px 32px;font-size:15px;line-height:1.7;color:#2C2C2C;">
              <p>Click the button below to sign in to your Ballet Academy and Movement account. This link expires in 1 hour.</p>
              <p>If you didn't request this link, you can safely ignore this email.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#9C8BBF;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F0E8;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B6B7B;line-height:1.5;">
                Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#A8A8B8;">
                <a href="https://balletacademyandmovement.com" style="color:#9C8BBF;text-decoration:none;">balletacademyandmovement.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Confirm Signup

**Subject:** `Confirm your Ballet Academy and Movement account`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Signup</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Nunito',Arial,sans-serif;color:#2C2C2C;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#9C8BBF;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                Ballet Academy and Movement
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:#2C2C2C;">
                Welcome to our studio family
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:16px 32px 32px 32px;font-size:15px;line-height:1.7;color:#2C2C2C;">
              <p>Thank you for creating your account with Ballet Academy and Movement. Please confirm your email address to get started.</p>
              <p>Once confirmed, you'll be able to add your dancer's profile and browse our class catalog.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#9C8BBF;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Confirm Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;color:#6B6B7B;">If you didn't create this account, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F0E8;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B6B7B;line-height:1.5;">
                Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#A8A8B8;">
                <a href="https://balletacademyandmovement.com" style="color:#9C8BBF;text-decoration:none;">balletacademyandmovement.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Password Reset

**Subject:** `Reset your password — Ballet Academy and Movement`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Nunito',Arial,sans-serif;color:#2C2C2C;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#9C8BBF;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                Ballet Academy and Movement
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:#2C2C2C;">
                Reset your password
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:16px 32px 32px 32px;font-size:15px;line-height:1.7;color:#2C2C2C;">
              <p>We received a request to reset the password for your Ballet Academy and Movement account.</p>
              <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#9C8BBF;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;color:#6B6B7B;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F0E8;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B6B7B;line-height:1.5;">
                Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#A8A8B8;">
                <a href="https://balletacademyandmovement.com" style="color:#9C8BBF;text-decoration:none;">balletacademyandmovement.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Email Change

**Subject:** `Confirm your new email address — Ballet Academy and Movement`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Change</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Nunito',Arial,sans-serif;color:#2C2C2C;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#9C8BBF;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                Ballet Academy and Movement
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:#2C2C2C;">
                Confirm your new email address
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:16px 32px 32px 32px;font-size:15px;line-height:1.7;color:#2C2C2C;">
              <p>You requested to change the email address associated with your Ballet Academy and Movement account.</p>
              <p>Click the button below to confirm this change. If you didn't make this request, please contact the studio immediately.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#9C8BBF;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Confirm Email Change
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F0E8;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B6B7B;line-height:1.5;">
                Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#A8A8B8;">
                <a href="https://balletacademyandmovement.com" style="color:#9C8BBF;text-decoration:none;">balletacademyandmovement.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to Apply

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Email Templates**
3. For each template type (Confirm signup, Magic Link, Change Email, Reset Password):
   - Replace the **Subject** with the subject line above
   - Replace the **Body** with the HTML above
4. Click **Save**

The templates use `{{ .ConfirmationURL }}` which Supabase replaces with the actual link at send time.

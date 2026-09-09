This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Booking confirmation email (Gmail)

Booking confirmations use Gmail SMTP through Nodemailer. After a booking is saved,
the browser calls `/api/notifications/email`, which sends the confirmation to the
customer. Email failures do not undo the booking and are not retried automatically.

1. Enable 2-Step Verification on the Google account that will send confirmations.
2. Create an [app password](https://myaccount.google.com/apppasswords) for this app.
   Use this app password, not your regular Google password. See
   [Google's instructions and account restrictions](https://support.google.com/accounts/answer/185833).
3. Add these settings to `.env.local` in the project root:

   ```dotenv
   GMAIL_USER=your-account@gmail.com
   GMAIL_APP_PASSWORD=your-16-character-app-password
   GMAIL_SENDER_NAME=DocuJet
   ```

4. Restart the development server. For a deployed site, add the same settings to
   the hosting environment and redeploy. Keep the app password out of source control
   and do not prefix these settings with `NEXT_PUBLIC_`.
5. Submit a booking using an inbox you control and check for the confirmation.
   Check the server logs if sending fails.

The sender address is the authenticated Gmail account. `GMAIL_SENDER_NAME` is
optional and defaults to `DocuJet`. The old `BREVO_*` settings are no longer used.
The hosting environment must allow outbound SMTP connections to Gmail on port 465.
See the [Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail).

Confirmations include a Google Calendar button, an `appointment.ics` invitation,
and a reschedule button that opens an email request to the sender. Calendar events
last 60 minutes in Malaysia/Singapore time (UTC+8); this does not change the booking
availability rules. Calendar acceptance does not update the booking database.
The template includes a plain-text fallback. Email clients control whether native
invitation buttons appear. Test message generation without sending email with
`npx tsx --test src/lib/booking-email.test.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

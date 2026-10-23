import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Outbox used by tests to inspect what would have been sent. */
export const testOutbox = [];

export async function sendMail({ to, subject, text, link }) {
  if (env.isTest) {
    testOutbox.push({ to, subject, text, link });
    return;
  }
  if (!transport) {
    if (env.isProd) {
      logger.error({ subject }, 'SMTP is not configured; email was not sent');
      return;
    }
    // Development without SMTP: print the link so the flow can still be exercised locally.
    logger.warn({ to, subject, link }, 'SMTP not configured — email logged instead of sent');
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
  } catch (err) {
    logger.error({ err, subject }, 'Failed to send email');
  }
}

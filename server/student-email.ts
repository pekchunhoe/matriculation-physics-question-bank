export type VerificationMessage = {
  to: string;
  url: string;
  expiresAt: number;
  idempotencyKey: string;
};
export interface VerificationMailer {
  readonly configured: boolean;
  send(message: VerificationMessage): Promise<void>;
}
export class EmailDeliveryFailure extends Error {
  constructor(readonly outcome: 'FAILED' | 'UNKNOWN' | 'NOT_CONFIGURED') {
    super('Verification email delivery could not be confirmed');
  }
}
export const unavailableMailer: VerificationMailer = {
  configured: false,
  async send() {
    throw new EmailDeliveryFailure('NOT_CONFIGURED');
  },
};
export const productionVerificationOrigin =
  'https://matriculation-physics-question-bank.vercel.app';
/** No browser Host, redirect parameter or user-supplied destination is accepted. */
export function studentEmailConfiguration(env = process.env): {
  mailer: VerificationMailer;
  origin: string;
} {
  if (env.VERCEL_ENV === 'preview' && !env.VERCEL_URL)
    throw new Error('Preview verification origin is required');
  const origin =
    env.VERCEL_ENV === 'preview' && env.VERCEL_URL
      ? 'https://' + env.VERCEL_URL
      : productionVerificationOrigin;
  if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))
    throw new Error('Invalid configured verification origin');
  if (env.STUDENT_EMAIL_PROVIDER !== 'resend') return { mailer: unavailableMailer, origin };
  const key = env.RESEND_API_KEY?.trim(),
    from = env.STUDENT_EMAIL_FROM?.trim();
  // An explicit configuration attestation is set only after domain/DNS/provider approval.
  if (
    !key ||
    !from ||
    env.STUDENT_EMAIL_DOMAIN_VERIFIED !== 'true' ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) ||
    /@.*vercel\.app$/i.test(from)
  )
    return { mailer: unavailableMailer, origin };
  return { origin, mailer: new ResendVerificationMailer(key, from) };
}
export class ResendVerificationMailer implements VerificationMailer {
  readonly configured = true;
  constructor(
    private readonly key: string,
    private readonly from: string,
    private readonly request: typeof fetch = fetch,
  ) {}
  async send(message: VerificationMessage) {
    const text = [
      'Matriculation Physics Question Bank',
      '',
      'The Question Bank administrator registered this email address for student access.',
      'Confirm that you control this inbox by opening the link and choosing Verify My Email:',
      message.url,
      '',
      'This single-use link expires in 24 hours. Verifying your email does not sign you in or activate access.',
      'After verification, the administrator must issue your individual access code privately.',
      'If you did not expect this registration, ignore this message. No action is required.',
    ].join('\n');
    try {
      const r = await this.request('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: 'Bearer ' + this.key,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: 'Verify your Physics Question Bank email',
          text,
        }),
      });
      if (!r.ok) throw new EmailDeliveryFailure(r.status >= 500 ? 'UNKNOWN' : 'FAILED');
      // Provider acceptance is not proof of delivery to the inbox. Never log the response/body/link.
      const result = (await r.json()) as { id?: unknown };
      if (typeof result.id !== 'string') throw new EmailDeliveryFailure('UNKNOWN');
    } catch (error) {
      throw error instanceof EmailDeliveryFailure ? error : new EmailDeliveryFailure('UNKNOWN');
    }
  }
}

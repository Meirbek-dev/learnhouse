import { z } from 'zod';

/**
 * Reusable password schema factory.
 * Accepts a translator so error messages are localised at call-site.
 *
 * Rules:
 *   - min 8 characters
 *   - max 128 characters
 *   - at least one lowercase letter
 *   - at least one uppercase letter
 *   - at least one digit
 */
export const passwordSchema = (t: (key: string) => string) =>
  z
    .string()
    .min(8, { message: t('passwordTooShort') })
    .max(128, { message: t('passwordTooLong') })
    .regex(/[a-z]/, { message: t('passwordNeedsLowercase') })
    .regex(/[A-Z]/, { message: t('passwordNeedsUppercase') })
    .regex(/[0-9]/, { message: t('passwordNeedsNumber') });

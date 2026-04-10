'use client';

import { useMutation } from '@tanstack/react-query';
import {
  resendVerificationMutationOptions,
  verifyEmailMutationOptions,
} from '../mutations/email-verification.mutation';

export function useVerifyEmail() {
  return useMutation(verifyEmailMutationOptions());
}

export function useResendVerification() {
  return useMutation(resendVerificationMutationOptions());
}

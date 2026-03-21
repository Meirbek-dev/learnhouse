const hasAuthRuntimeConfig = () => {
  const requiredKeys = [
    process.env.NEXTAUTH_SECRET,
    process.env.NEXTAUTH_URL,
  ];

  return requiredKeys.every((value) => typeof value === 'string' && value.trim().length > 0);
};

const isDeferredRequestApiError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('During prerendering, `headers()` rejects when the prerender is complete');
};

export async function getOptionalSession() {
  if (!hasAuthRuntimeConfig()) {
    return null;
  }

  const { auth } = await import('@/auth');

  try {
    return await auth();
  } catch (error) {
    if (isDeferredRequestApiError(error)) {
      return null;
    }

    throw error;
  }
}

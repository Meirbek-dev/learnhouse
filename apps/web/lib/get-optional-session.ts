const isDeferredRequestApiError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('During prerendering, `headers()` rejects when the prerender is complete');
};

export async function getOptionalSession() {
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

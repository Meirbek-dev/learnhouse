const hasAuthRuntimeConfig = () => {
  const requiredKeys = [
    process.env.NEXTAUTH_SECRET,
    process.env.NEXTAUTH_URL,
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  ];

  return requiredKeys.every((value) => typeof value === 'string' && value.trim().length > 0);
};

export async function getOptionalSession() {
  if (!hasAuthRuntimeConfig()) {
    return null;
  }

  const { auth } = await import('@/auth');
  return auth();
}

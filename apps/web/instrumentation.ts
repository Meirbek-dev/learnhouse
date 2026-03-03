export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { publicEnv, getServerEnv } = await import('@/lib/env');
    void publicEnv;
    getServerEnv();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime specific instrumentation
  }
}

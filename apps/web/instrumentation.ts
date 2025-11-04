export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js specific instrumentation
    // Enhanced error logging for production debugging
    if (process.env.NODE_ENV === 'production') {
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        // Log full error details in production
        originalConsoleError('[PRODUCTION ERROR]', new Date().toISOString(), ...args);
        
        // Extract stack traces and digests
        args.forEach((arg) => {
          if (arg instanceof Error) {
            originalConsoleError('Stack:', arg.stack);
            originalConsoleError('Message:', arg.message);
            originalConsoleError('Name:', arg.name);
            if ('digest' in arg) {
              originalConsoleError('Digest:', (arg as any).digest);
            }
          }
        });
      };
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime specific instrumentation
  }
}

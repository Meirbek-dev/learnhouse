export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js specific instrumentation
    // Enhanced error logging for debugging
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Log full error details with timestamp
      originalConsoleError('[ERROR]', new Date().toISOString(), ...args);

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
    
    // Log unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime specific instrumentation
  }
}

/**
 * This file configures static generation for routes that can be pre-rendered
 * at build time for better performance.
 */

export const revalidate = 3600; // Revalidate every hour

// Add ISR (Incremental Static Regeneration) configuration
export const dynamic = 'force-static';
export const dynamicParams = true;

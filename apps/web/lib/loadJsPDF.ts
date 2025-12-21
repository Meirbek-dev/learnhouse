'use client';

// Small helper to lazily load jspdf and create an instance only when needed.
// This keeps `jspdf` out of the initial client bundle.

export async function createPDF(...args: any[]) {
  // Dynamic import so the heavy library is only fetched when the user requests a PDF
  const mod = await import('jspdf');
  // jspdf may export a default or a named `jsPDF` export depending on build
  const PDFCtor = (mod && (mod.jsPDF ?? mod.default ?? mod)) as any;
  return new PDFCtor(...args);
}

'use client';

import { ServerStyleSheet, StyleSheetManager } from 'styled-components';
import { useServerInsertedHTML } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

export default function StyledComponentsRegistry({ children }: { children: ReactNode }) {
  // Only create stylesheet once with lazy initial state
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement();
    styledComponentsStyleSheet.instance.clearTag();
    return <>{styles}</>;
  });

  if (typeof window !== 'undefined') return <>{children}</>;

  return <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>{children}</StyleSheetManager>;
}

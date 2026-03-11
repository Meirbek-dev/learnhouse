'use client';

import { useEffect, useRef } from 'react';

interface UnsavedChangesGuardOptions {
  message?: string;
  interceptInAppNavigation?: boolean;
}

export function useUnsavedChangesGuard(isDirty: boolean, options?: UnsavedChangesGuardOptions) {
  const message = options?.message ?? '';
  const interceptInAppNavigation = options?.interceptInAppNavigation ?? false;
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!(isDirty && interceptInAppNavigation)) {
      return;
    }

    const confirmLeave = () => window.confirm(messageRef.current || 'You have unsaved changes. Leave this page?');
    let ignoreNextPop = false;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (link.target && link.target !== '_self') {
        return;
      }

      if (link.hasAttribute('download')) {
        return;
      }

      const nextUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return;
      }

      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.history.pushState({ ...(window.history.state ?? {}), __unsavedChangesGuard: true }, '', window.location.href);

    const handlePopState = () => {
      if (ignoreNextPop) {
        ignoreNextPop = false;
        return;
      }

      if (!confirmLeave()) {
        window.history.pushState({ ...(window.history.state ?? {}), __unsavedChangesGuard: true }, '', window.location.href);
        return;
      }

      ignoreNextPop = true;
      window.history.back();
    };

    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [interceptInAppNavigation, isDirty]);
}

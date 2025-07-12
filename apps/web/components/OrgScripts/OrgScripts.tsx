'use client';

import { useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'dompurify';
import type React from 'react';

import { useOrg } from '@/components/Contexts/OrgContext';

const OrgScripts: React.FC = () => {
  const org = useOrg() as any;
  const t = useTranslations('DashPage.OrgScripts');

  // Function to cleanup existing scripts
  const cleanupExistingScript = (scriptId: string) => {
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      const parent = existingScript.parentNode;
      if (parent) {
        let node = existingScript.previousSibling;
        while (node && node.nodeType === Node.COMMENT_NODE) {
          const prevNode = node.previousSibling;
          parent.removeChild(node);
          node = prevNode;
        }
        node = existingScript.nextSibling;
        while (node && node.nodeType === Node.COMMENT_NODE) {
          const nextNode = node.nextSibling;
          parent.removeChild(node);
          node = nextNode;
        }
        parent.removeChild(existingScript);
      }
    }
  };

  // Function to check if script is already loaded
  const isScriptLoaded = (scriptName: string): boolean => {
    const scripts = document.querySelectorAll(`script[data-script-name="${scriptName}"]`);
    return scripts.length > 0;
  };

  // Function to sanitize script content using DOMPurify
  const sanitizeScriptContent = (content: string): string => {
    if (typeof window === 'undefined') {
      return content;
    }

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeName === 'SCRIPT') {
        node.setAttribute('type', 'text/javascript');
      }
    });

    const purifyConfig = {
      ALLOWED_TAGS: ['script'],
      ALLOWED_ATTR: [
        'src',
        'async',
        'defer',
        'crossorigin',
        'integrity',
        'type',
        'nonce',
        'id',
        'data-*',
        'referrerpolicy',
      ],
      ADD_TAGS: ['script'],
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      FORCE_BODY: true,
    };

    if (content.trim().toLowerCase().startsWith('<script')) {
      return DOMPurify.sanitize(content, purifyConfig);
    }
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      WHOLE_DOCUMENT: false,
    });
  };

  // Function to safely load and execute a script
  const loadScript = useCallback(
    (scriptContent: string, scriptName: string) => {
      try {
        if (isScriptLoaded(scriptName) || !scriptContent.trim()) {
          return;
        }

        const safeScriptId = `learnhouse-org-script-${scriptName.toLowerCase().replaceAll(/[^\da-z]+/g, '-')}-${Math.random().toString(36).slice(2, 9)}`;

        cleanupExistingScript(safeScriptId);

        if (scriptContent.trim().toLowerCase().startsWith('<script')) {
          const sanitizedHtml = sanitizeScriptContent(scriptContent.trim());
          const div = document.createElement('div');
          div.innerHTML = sanitizedHtml;
          const scriptTag = div.querySelector('script');

          if (!scriptTag) {
            return;
          }

          const scriptElement = document.createElement('script');
          [...scriptTag.attributes].forEach((attr) => {
            scriptElement.setAttribute(attr.name, attr.value);
          });

          if (scriptTag.src) {
            try {
              new URL(scriptTag.src);
              scriptElement.async = true;
              scriptElement.addEventListener('load', () => {
                scriptElement.dataset.loaded = 'true';
              });
              scriptElement.onerror = (error) => {
                console.error(t('failedToLoadExternalScript', { scriptName }), error);
                cleanupExistingScript(safeScriptId);
              };
            } catch (error) {
              console.error(t('invalidScriptUrl', { scriptName }), error);
              return;
            }
          } else {
            const sanitizedContent = sanitizeScriptContent(scriptTag.textContent || '');
            scriptElement.textContent = `
            /* OpenU Organization Script - ${scriptName} */
            try {
              (function() {
                'use strict';
                ${sanitizedContent}
              })();
            } catch (error) {
              console.error(t('scriptError', { scriptName }), error);
            }
          `;
          }

          scriptElement.id = safeScriptId;
          scriptElement.dataset.scriptName = scriptName;
          scriptElement.dataset.loadTime = new Date().toISOString();
          scriptElement.dataset.type = scriptTag.src ? 'external' : 'inline';
          scriptElement.dataset.orgId = org?.id;
          scriptElement.dataset.orgSlug = org?.slug;

          const comment = document.createComment(` OpenU Organization Script - ${scriptName} (${safeScriptId}) `);
          document.body.append(comment);
          document.body.append(scriptElement);
        } else {
          const scriptElement = document.createElement('script');
          scriptElement.type = 'text/javascript';

          const sanitizedContent = sanitizeScriptContent(scriptContent);
          scriptElement.textContent = `
          /* OpenU Organization Script - ${scriptName} */
          try {
            (function() {
              'use strict';
              ${sanitizedContent}
            })();
          } catch (error) {
            console.error(t('scriptError', { scriptName }), error)
          }
        `;

          scriptElement.id = safeScriptId;
          scriptElement.dataset.scriptName = scriptName;
          scriptElement.dataset.loadTime = new Date().toISOString();
          scriptElement.dataset.type = 'raw';
          scriptElement.dataset.orgId = org?.id;
          scriptElement.dataset.orgSlug = org?.slug;

          const comment = document.createComment(` OpenU Organization Script - ${scriptName} (${safeScriptId}) `);
          document.body.append(comment);
          document.body.append(scriptElement);
        }
      } catch (error) {
        console.error(t('failedToLoadScript', { scriptName }), error);
      }
    },
    [t, org?.id, org?.slug],
  );

  useEffect(() => {
    if (!(org?.scripts?.scripts && Array.isArray(org.scripts.scripts))) {
      return;
    }

    const loadedScripts = new Map();

    org.scripts.scripts.forEach((script: { content: string; name: string }, index: number) => {
      const scriptName = script.name || `Script ${index + 1}`;

      if (!loadedScripts.has(scriptName) && script.content) {
        loadedScripts.set(scriptName, true);
        loadScript(script.content, scriptName);
      }
    });
    return () => {
      const scripts = document.querySelectorAll('script[id^="learnhouse-org-script-"]');
      scripts.forEach((script) => {
        cleanupExistingScript(script.id);
      });
    };
  }, [org, loadScript]);

  return null;
};

export default OrgScripts;

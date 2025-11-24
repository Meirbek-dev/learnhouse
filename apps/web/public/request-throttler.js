/**
 * Request throttler that intercepts fetch and XMLHttpRequest
 * to prevent rate limiting on initial page load.
 * This must run BEFORE Next.js chunks load.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  const ASSET_PATH_REGEX = /\/_next\/static\/.+\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|gif)$/i;
  const MAX_PARALLEL_REQUESTS = 2;
  const REQUEST_DELAY_MS = 100;

  const requestQueue = [];
  let activeCount = 0;

  function processQueue() {
    if (activeCount >= MAX_PARALLEL_REQUESTS || requestQueue.length === 0) {
      return;
    }

    const next = requestQueue.shift();
    if (next) {
      activeCount++;
      next();
    }
  }

  function shouldThrottle(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return ASSET_PATH_REGEX.test(urlObj.pathname);
    } catch {
      return false;
    }
  }

  function queueRequest(fn) {
    return new Promise(function (resolve, reject) {
      const execute = async function () {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          setTimeout(processQueue, REQUEST_DELAY_MS);
        }
      };

      if (activeCount < MAX_PARALLEL_REQUESTS) {
        execute();
      } else {
        requestQueue.push(execute);
      }
    });
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (!shouldThrottle(url)) {
      return originalFetch.call(this, input, init);
    }

    return queueRequest(function () {
      return originalFetch.call(this, input, init);
    });
  };

  // Intercept XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function (method, url) {
      const urlString = typeof url === 'string' ? url : url.href;
      this._throttled = shouldThrottle(urlString);
      return originalOpen.apply(this, arguments);
    };

    xhr.send = function (body) {
      if (this._throttled) {
        queueRequest(function () {
          return new Promise(function (resolve, reject) {
            const handleLoad = function () {
              xhr.removeEventListener('loadend', handleLoad);
              xhr.removeEventListener('error', handleError);
              resolve();
            };
            const handleError = function () {
              xhr.removeEventListener('loadend', handleLoad);
              xhr.removeEventListener('error', handleError);
              reject(new Error('XHR request failed'));
            };
            xhr.addEventListener('loadend', handleLoad);
            xhr.addEventListener('error', handleError);
            originalSend.call(this, body);
          });
        }).catch(function () {
          /* errors handled by XHR event listeners */
        });
      } else {
        return originalSend.call(this, body);
      }
    };

    return xhr;
  };
})();


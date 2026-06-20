/**
 * This is the main entry point for the server which will launch the RR7 application
 * and spin up auth, api, etc.
 *
 * Note:
 *  This file will be copied to the build folder during build time.
 *  Running this file will not work without a build.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

import server from './hono/server/router.js';
import * as build from './index.js';

server.use(
  serveStatic({
    root: 'build/client',
    onFound: (path, c) => {
      if (path.startsWith('build/client/assets')) {
        // Hard cache assets with hashed file names.
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        // Cache with revalidation for rest of static files.
        c.header('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400');
      }
    },
  }),
);

const handler = handle(build, server);

const port = parseInt(process.env.PORT || '3000', 10);

// Behind the Cloudflare -> Railway proxy chain, the `X-Forwarded-Host` header
// arrives as the internal *.railway.app host while the browser's `Origin` is the
// public host (e.g. sign.foraker.ai). React Router v7's single-fetch CSRF check
// aborts any action (POST) request when those two don't match, which surfaced as
// a 500 ("x-forwarded-host header does not match `origin` header") on every form
// submission. Normalize X-Forwarded-Host to the trusted public host: legitimate
// same-origin actions pass, while genuine cross-origin posts (whose Origin will
// not equal the trusted host) are still rejected.
let trustedHost = 'sign.foraker.ai';
try {
  if (process.env.NEXT_PUBLIC_WEBAPP_URL) {
    trustedHost = new URL(process.env.NEXT_PUBLIC_WEBAPP_URL).host;
  }
} catch {
  // keep the default
}

const baseFetch = handler.fetch;

const wrappedFetch = async (request, ...rest) => {
  const origin = request.headers.get('origin');

  if (origin) {
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }

    if (originHost === trustedHost && request.headers.get('x-forwarded-host') !== originHost) {
      const headers = new Headers(request.headers);
      headers.set('x-forwarded-host', originHost);
      request = new Request(request, { headers });
    }
  }

  return baseFetch(request, ...rest);
};

serve({ fetch: wrappedFetch, port });

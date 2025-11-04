# Production Error Debugging Guide

## Overview

This guide helps diagnose the "An error occurred in the Server Components render" error in
production.

## Quick Diagnostics

### 1. Check System Health

Visit: `https://your-domain.com/api/diagnostics`

This will show:

- Environment variable status
- Backend API connectivity
- Cookie functionality
- i18n configuration
- Auth system status

### 2. Check Server Logs

Look for these patterns in your production logs:

```bash
# Docker logs
docker logs <container-name> -f --tail=100

# PM2 logs
pm2 logs --lines 100

# System logs
journalctl -u your-service -n 100 -f
```

### 3. Common Issues & Solutions

#### Issue: Backend Connection Failed (ECONNREFUSED)

**Symptoms:**

```
TypeError: fetch failed
cause: AggregateError:
  code: 'ECONNREFUSED'
```

**Solutions:**

1. Verify backend is running: `curl http://localhost:1338/health`
2. Check environment variables:
   - `NEXT_PUBLIC_PLATFORM_API_URL`
   - `NEXT_PUBLIC_PLATFORM_BACKEND_URL`
3. Verify Docker network connectivity
4. Check firewall/security group rules

#### Issue: Missing Environment Variables

**Symptoms:**

- API URL is `undefined` or `null`
- Auth errors
- Locale detection failures

**Solutions:**

1. Verify `.env` file is loaded in production
2. For Docker: Check `env_file` in docker-compose.yml
3. For standalone: Set environment variables in process manager

#### Issue: Serialization Errors

**Symptoms:**

- Error only in production, not development
- Mentions "non-serializable" data

**Solutions:**

1. Don't pass functions/classes from Server to Client Components
2. Convert Dates to strings: `date.toISOString()`
3. Use `JSON.parse(JSON.stringify(data))` to test serializability

#### Issue: Auth Session Errors

**Symptoms:**

- `CredentialsSignin` errors
- Invalid session data

**Solutions:**

1. Verify `NEXTAUTH_SECRET` is set and consistent
2. Check `NEXTAUTH_URL` matches your domain
3. Clear session cookies and retry
4. Verify backend `/auth/` endpoints are accessible

## Deployment Checklist

### Environment Variables (Required)

```env
NEXT_PUBLIC_PLATFORM_API_URL=http://backend:1338/api/v1/
NEXT_PUBLIC_PLATFORM_BACKEND_URL=http://backend:1338/
NEXT_PUBLIC_PLATFORM_DOMAIN=yourdomain.com
NEXT_PUBLIC_PLATFORM_TOP_DOMAIN=yourdomain.com
NEXTAUTH_SECRET=<generate-strong-secret>
NEXTAUTH_URL=https://yourdomain.com
```

### Docker Network Configuration

Ensure your docker-compose.yml has proper networking:

```yaml
services:
  web:
    environment:
      - NEXT_PUBLIC_PLATFORM_API_URL=http://api:1338/api/v1/
      - NEXT_PUBLIC_PLATFORM_BACKEND_URL=http://api:1338/
    depends_on:
      - api
  api:
    # your api service config
```

### Build Steps

```bash
# Clean install
rm -rf .next node_modules
pnpm install
pnpm build

# Verify build
NODE_ENV=production node server.js
```

## Monitoring

### Enable Detailed Error Logging

The instrumentation has been updated to log full errors in production. Check:

```bash
# Look for these log patterns:
[PRODUCTION ERROR]
[getUserLocale]
[LandingContent]
```

### Health Checks

Add to your monitoring:

- `GET /api/health` - General health
- `GET /api/diagnostics` - Detailed diagnostics
- `GET /api/auth/session` - Auth status

## Support

If issues persist:

1. Collect diagnostics output: `/api/diagnostics`
2. Gather recent logs (last 100 lines)
3. Note exact error digest from error page
4. Check browser console for client-side errors
5. Verify network requests in browser DevTools

## Recent Changes

The following files have been updated with better error handling:

- `instrumentation.ts` - Production error logging
- `app/error.tsx` - Root error boundary
- `app/global-error.tsx` - Global error handler
- `app/api/diagnostics/route.ts` - Diagnostic endpoint
- `i18n/locale.ts` - Improved error handling
- `app/orgs/[orgslug]/(withmenu)/LandingContent.tsx` - Error boundaries

## Next Steps

1. Deploy these changes
2. Visit `/api/diagnostics` immediately after deployment
3. Monitor logs during first user requests
4. Check for specific error messages (no longer hidden)

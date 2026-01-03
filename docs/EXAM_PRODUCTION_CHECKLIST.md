# Exam Module - Pre-Production Checklist

## 🔴 CRITICAL - Must Do Before Production

### 1. Database Migration

- [ ] Create Alembic migration for exam indexes

  ```bash
  cd apps/api
  alembic revision -m "add exam performance indexes"
  # Then copy content from migrations/MIGRATION_NEEDED.py
  alembic upgrade head
  ```

### 2. Environment Variables

- [ ] Verify these are set in production:

  ```bash
  # Rate limiting (if using Redis)
  REDIS_URL=redis://localhost:6379/0

  # Logging
  LOG_LEVEL=INFO
  STRUCTURED_LOGGING=true

  # Security
  CSRF_ENABLED=true
  CORS_ORIGINS=https://yourdomain.com
  ```

### 3. Monitoring Setup

- [ ] Set up error tracking (Sentry, Rollbar, etc.)
- [ ] Configure alerts for:
  - Exam submission failure rate >1%
  - Violation count spike (>50% increase)
  - Database query time >2s
  - localStorage quota errors
- [ ] Set up application metrics dashboard

### 4. Security Audit

- [ ] Run security scan: `npm audit` and `pip-audit`
- [ ] Verify HTTPS enforced on all endpoints
- [ ] Test CSRF protection on exam submission
- [ ] Review CORS settings
- [ ] Check authentication token expiry

## 🟡 HIGH PRIORITY - Recommended Before Production

### 5. Performance Testing

- [ ] Load test with 100 concurrent exam starts
- [ ] Test 1000 submissions in 1 minute
- [ ] Verify database query performance
- [ ] Check memory usage during peak load
- [ ] Test with slow network (3G simulation)

### 6. Error Handling Verification

- [ ] Test network failure during submission
- [ ] Test browser crash recovery (localStorage)
- [ ] Test concurrent attempts from same user
- [ ] Test time limit edge cases
- [ ] Test malformed answer payloads

### 7. User Experience

- [ ] Add React Error Boundary around ExamActivity
- [ ] Test on mobile devices (iOS/Android)
- [ ] Verify accessibility (screen readers)
- [ ] Test keyboard navigation
- [ ] Check loading states and spinners

### 8. Data Backup

- [ ] Verify database backup schedule
- [ ] Test restore procedure
- [ ] Document recovery process
- [ ] Set up automated backups of exam attempts

## 🟢 NICE TO HAVE - Post-Launch

### 9. Analytics

- [ ] Set up exam completion tracking
- [ ] Monitor average attempt duration
- [ ] Track question difficulty (% correct)
- [ ] Analyze common wrong answers

### 10. Optimization

- [ ] Implement Redis caching for results dashboard
- [ ] Add CDN for static assets
- [ ] Optimize database queries (use EXPLAIN)
- [ ] Add database connection pooling

### 11. Documentation

- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide for exam creation
- [ ] Troubleshooting guide
- [ ] Security incident response plan

## 📊 Testing Scenarios

### Security Tests

```bash
# Test time limit bypass
# 1. Start exam
# 2. Wait for timer expiry
# 3. Submit 5 minutes late
# Expected: Auto-submit with TIME_EXCEEDED violation

# Test answer manipulation
# 1. Start exam with questions [1,2,3]
# 2. Submit answers for questions [4,5,6]
# Expected: 400 Bad Request

# Test concurrent attempts
# 1. Set attempt limit to 1
# 2. Start 5 attempts simultaneously
# Expected: Only 1 succeeds, others get 403
```

### Edge Case Tests

```bash
# Test localStorage quota
# 1. Fill localStorage to near-quota
# 2. Take exam and answer all questions
# Expected: Graceful handling, cleanup, retry

# Test network failure
# 1. Start exam
# 2. Disconnect network
# 3. Submit exam
# Expected: Retry with exponential backoff

# Test timer edge case
# 1. Submit at exactly timer expiry
# Expected: Accept with grace period (30s)
```

### Performance Tests

```bash
# Load test
artillery quick --count 100 --num 10 http://localhost:8000/api/exams/start

# Database query performance
# Check slow query log for queries >1s

# Memory leak test
# Take 100 exams in sequence, monitor memory
```

## 🚀 Deployment Steps

### Pre-Deployment (Day Before)

1. [ ] Run all tests (unit, integration, e2e)
2. [ ] Create database backup
3. [ ] Review recent code changes
4. [ ] Prepare rollback plan
5. [ ] Schedule deployment window
6. [ ] Notify users of maintenance (if needed)

### Deployment (Deploy Day)

1. [ ] Set maintenance mode (if needed)
2. [ ] Pull latest code
3. [ ] Install dependencies: `pnpm install` and `uv sync`
4. [ ] Run migrations: `alembic upgrade head`
5. [ ] Restart services
6. [ ] Verify health checks
7. [ ] Test critical paths (start exam, submit)
8. [ ] Monitor logs for 15 minutes
9. [ ] Remove maintenance mode

### Post-Deployment (First 24 Hours)

1. [ ] Monitor error rates (target: <0.1%)
2. [ ] Check database performance
3. [ ] Review violation logs
4. [ ] Monitor localStorage errors
5. [ ] Check response times
6. [ ] Verify auto-submit working
7. [ ] Test on multiple devices
8. [ ] Collect user feedback

## 🔧 Rollback Plan

### If Critical Issue Found

1. **Immediate** (< 5 minutes)

   ```bash
   # Revert to previous version
   git checkout <previous-release-tag>
   pnpm install
   pm2 restart all
   ```

2. **Database Rollback**

   ```bash
   # If migration applied
   alembic downgrade -1
   ```

3. **Notify Users**
   - Post maintenance banner
   - Send email to active exam takers
   - Update status page

4. **Investigate**
   - Review error logs
   - Check Sentry for exceptions
   - Analyze database queries
   - Review deployment diff

## 📞 Support Contacts

### During Deployment

- **On-call Developer**: [Your Name]
- **Database Admin**: [DBA Name]
- **DevOps**: [DevOps Team]
- **Emergency**: [Emergency Contact]

### Escalation Path

1. Developer → Tech Lead (15 min)
2. Tech Lead → Engineering Manager (30 min)
3. Engineering Manager → CTO (1 hour)

## 📝 Post-Launch Review

### Week 1 Review

- [ ] Analyze error rates
- [ ] Review performance metrics
- [ ] Collect user feedback
- [ ] Identify optimization opportunities
- [ ] Document lessons learned

### Month 1 Review

- [ ] Evaluate security posture
- [ ] Review analytics data
- [ ] Plan feature improvements
- [ ] Optimize database queries
- [ ] Update documentation

---

## ✅ Sign-Off

**Completed By**: ********\_******** **Date**: ********\_******** **Production Ready**: ☐ Yes ☐ No
(explain): ********\_********

---

**Last Updated**: December 31, 2025

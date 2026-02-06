/**
 * Permission Performance Monitoring
 *
 * Utilities for tracking permission check performance and cache effectiveness.
 * Import and use in development/staging to monitor RBAC performance.
 */

import * as React from 'react';

interface PermissionMetrics {
  totalChecks: number;
  cacheHits: number;
  cacheMisses: number;
  avgCheckTime: number;
  checksPerSecond: number;
  lastReset: number;
}

class PermissionMonitor {
  private metrics: PermissionMetrics = {
    totalChecks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgCheckTime: 0,
    checksPerSecond: 0,
    lastReset: Date.now(),
  };

  private checkTimes: number[] = [];
  private readonly MAX_SAMPLES = 100;

  /**
   * Record a permission check
   */
  recordCheck(cached: boolean, durationMs: number) {
    this.metrics.totalChecks++;

    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    this.checkTimes.push(durationMs);

    // Keep only recent samples
    if (this.checkTimes.length > this.MAX_SAMPLES) {
      this.checkTimes.shift();
    }

    // Update average
    this.metrics.avgCheckTime =
      this.checkTimes.reduce((a, b) => a + b, 0) / this.checkTimes.length;

    // Calculate checks per second
    const elapsed = (Date.now() - this.metrics.lastReset) / 1000;
    this.metrics.checksPerSecond = this.metrics.totalChecks / elapsed;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PermissionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache hit rate as percentage
   */
  getCacheHitRate(): number {
    if (this.metrics.totalChecks === 0) return 0;
    return (this.metrics.cacheHits / this.metrics.totalChecks) * 100;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      totalChecks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgCheckTime: 0,
      checksPerSecond: 0,
      lastReset: Date.now(),
    };
    this.checkTimes = [];
  }

  /**
   * Log metrics to console
   */
  logMetrics() {
    const metrics = this.getMetrics();
    const hitRate = this.getCacheHitRate();

    console.group('📊 Permission System Metrics');
    console.log(`Total Checks: ${metrics.totalChecks}`);
    console.log(`Cache Hits: ${metrics.cacheHits} (${hitRate.toFixed(1)}%)`);
    console.log(`Cache Misses: ${metrics.cacheMisses}`);
    console.log(`Avg Check Time: ${metrics.avgCheckTime.toFixed(2)}ms`);
    console.log(`Checks/Second: ${metrics.checksPerSecond.toFixed(2)}`);
    console.groupEnd();
  }

  /**
   * Start auto-logging metrics at intervals
   */
  startAutoLog(intervalMs: number = 30000) {
    return setInterval(() => {
      if (this.metrics.totalChecks > 0) {
        this.logMetrics();
      }
    }, intervalMs);
  }
}

// Singleton instance
export const permissionMonitor = new PermissionMonitor();

/**
 * React hook to monitor permission performance
 */
export function usePermissionMetrics() {
  const [metrics, setMetrics] = React.useState<PermissionMetrics>(
    permissionMonitor.getMetrics()
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(permissionMonitor.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    cacheHitRate: permissionMonitor.getCacheHitRate(),
    reset: () => permissionMonitor.reset(),
  };
}

/**
 * DevTools component to display permission metrics
 * Add this to your app in development mode
 */
export function PermissionDevTools() {
  const { metrics, cacheHitRate, reset } = usePermissionMetrics();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#00ff00',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 99999,
        minWidth: '200px',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        🔐 Permission Metrics
      </div>
      <div>Checks: {metrics.totalChecks}</div>
      <div>Cache Hit: {cacheHitRate.toFixed(1)}%</div>
      <div>Avg Time: {metrics.avgCheckTime.toFixed(2)}ms</div>
      <div>Checks/s: {metrics.checksPerSecond.toFixed(2)}</div>
      <button
        onClick={reset}
        style={{
          marginTop: '8px',
          padding: '4px 8px',
          background: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '10px',
        }}
      >
        Reset
      </button>
    </div>
  );
}

// Export for direct use in permission provider
export { PermissionMonitor };

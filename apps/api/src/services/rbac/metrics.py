"""
RBAC v2 Metrics - Prometheus Instrumentation

Metrics exposed:
- rbac_v2_permission_checks_total{result, resource_type, action}
- rbac_v2_permission_check_duration_seconds
- rbac_v2_cache_hits_total
- rbac_v2_cache_misses_total
- rbac_v2_role_assignments_total{action}
- rbac_v2_audit_logs_total{action, result}

Usage:
    from src.services.rbac.metrics import (
        permission_checks_total,
        permission_check_duration,
        cache_hits,
    )

    # Increment counter
    permission_checks_total.labels(
        result="granted",
        resource_type="course",
        action="update"
    ).inc()

    # Time operation
    with permission_check_duration.time():
        result = rbac.check(...)
"""

try:
    from prometheus_client import Counter, Histogram, Gauge

    # Permission checks
    permission_checks_total = Counter(
        "rbac_v2_permission_checks_total",
        "Total permission checks in RBAC v2",
        ["result", "resource_type", "action"],
    )

    permission_check_duration = Histogram(
        "rbac_v2_permission_check_duration_seconds",
        "Permission check latency in seconds",
        buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
    )

    # Cache metrics
    cache_hits = Counter("rbac_v2_cache_hits_total", "RBAC v2 cache hits")
    cache_misses = Counter("rbac_v2_cache_misses_total", "RBAC v2 cache misses")
    cache_size = Gauge("rbac_v2_cache_size_bytes", "RBAC v2 cache size in bytes")

    # Role management
    role_assignments = Counter(
        "rbac_v2_role_assignments_total",
        "Total role assignments/revocations",
        ["action"],  # "assigned" or "revoked"
    )

    # Audit logs
    audit_logs = Counter(
        "rbac_v2_audit_logs_total",
        "Total audit log entries",
        ["action", "result"],
    )

    METRICS_ENABLED = True

except ImportError:
    # Prometheus client not installed - metrics disabled
    METRICS_ENABLED = False

    # Create dummy objects
    class DummyMetric:
        def labels(self, **kwargs):
            return self

        def inc(self, amount=1):
            pass

        def time(self):
            class DummyContext:
                def __enter__(self):
                    pass

                def __exit__(self, *args):
                    pass

            return DummyContext()

    permission_checks_total = DummyMetric()
    permission_check_duration = DummyMetric()
    cache_hits = DummyMetric()
    cache_misses = DummyMetric()
    cache_size = DummyMetric()
    role_assignments = DummyMetric()
    audit_logs = DummyMetric()


__all__ = [
    "permission_checks_total",
    "permission_check_duration",
    "cache_hits",
    "cache_misses",
    "cache_size",
    "role_assignments",
    "audit_logs",
    "METRICS_ENABLED",
]

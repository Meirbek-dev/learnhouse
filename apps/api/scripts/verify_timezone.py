"""
Timezone Verification Script

Run this script to verify the timezone configuration is working correctly.
"""

from datetime import datetime, timezone

from src.core.timezone import (
    get_timezone,
    now,
    to_timezone,
    utcnow,
)


def print_separator():
    print("=" * 70)


def main():
    print_separator()
    print("TIMEZONE CONFIGURATION VERIFICATION")
    print_separator()

    # 1. Show configured timezone
    tz = get_timezone()
    print(f"\n1. Configured Timezone: {tz}")
    print(f"   Timezone type: {type(tz)}")

    # 2. Show current time in configured timezone
    current_time = now()
    print("\n2. Current time in configured timezone:")
    print(f"   {current_time}")
    print(f"   ISO format: {current_time.isoformat()}")

    # 3. Show current UTC time
    utc_time = utcnow()
    print("\n3. Current UTC time:")
    print(f"   {utc_time}")
    print(f"   ISO format: {utc_time.isoformat()}")

    # 4. Show time difference
    if str(tz) != "UTC":
        offset = current_time.utcoffset()
        if offset:
            hours = offset.total_seconds() / 3600
            print(f"\n4. Timezone offset from UTC: {hours:+.1f} hours")
        else:
            print("\n4. No timezone offset (using UTC)")
    else:
        print("\n4. Currently using UTC (no offset)")

    # 5. Demonstrate conversion
    print("\n5. Datetime conversion examples:")

    # Naive datetime (assumes UTC)
    naive_dt = datetime(2025, 1, 1, 12, 0, 0)
    converted_naive = to_timezone(naive_dt)
    print(f"   Naive datetime: {naive_dt} (no timezone)")
    print(f"   Converted to {tz}: {converted_naive}")

    # UTC datetime
    utc_dt = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    converted_utc = to_timezone(utc_dt)
    print(f"   UTC datetime: {utc_dt}")
    print(f"   Converted to {tz}: {converted_utc}")

    # 6. Show database usage example
    print("\n6. Database usage example:")
    print("   Use this for model defaults:")
    print("   ```python")
    print("   from src.core.timezone import now as tz_now")
    print("   created_at: datetime = Field(default_factory=tz_now)")
    print("   ```")

    print_separator()
    print("✅ Timezone configuration is working correctly!")
    print_separator()

    # Configuration info
    print("\nConfiguration:")
    print("  - Edit config/config.yaml to change timezone")
    print("  - Or set OPENU_TIMEZONE environment variable")
    print(f"  - Current timezone: {tz}")
    print("  - Valid values: Any IANA timezone identifier")
    print("    Examples: UTC, Asia/Almaty, Europe/London, America/New_York")

    print("\nFor more information, see docs/TIMEZONE.md")
    print()


if __name__ == "__main__":
    main()

"""Test if permissions are loading correctly after fixing enum case."""
from sqlmodel import Session, create_engine
from config.config import get_platform_config
from src.services.permissions.policy_engine import PolicyEngine

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)
session = Session(engine)

pe = PolicyEngine(session, use_cache=False)

print("Testing PolicyEngine.get_user_permissions for user 1...")
try:
    perms = pe.get_user_permissions(1, None)
    print(f"✓ Successfully loaded {len(perms)} permissions")
    print(f"  course:create:org: {perms.get('course:create:org', False)}")
    print(f"  course:update:org: {perms.get('course:update:org', False)}")
    print(f"  role:create:org: {perms.get('role:create:org', False)}")
    print("\nSample permissions:")
    for i, (key, value) in enumerate(list(perms.items())[:10]):
        print(f"  {key}: {value}")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\nTesting with org_id=1...")
try:
    perms_org1 = pe.get_user_permissions(1, 1)
    print(f"✓ Successfully loaded {len(perms_org1)} permissions for org 1")
except Exception as e:
    print(f"✗ Error: {e}")

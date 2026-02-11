"""List model fields typed as string for date fields to plan migrations.
Run: python scripts/list_date_string_fields.py
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'apps' / 'api' / 'src'
pattern = re.compile(r"\b(creation_date|update_date|created_at|updated_at)\s*:\s*str\b")

for f in root.rglob('*.py'):
    try:
        txt = f.read_text(encoding='utf8')
    except Exception:
        continue
    for i, line in enumerate(txt.splitlines(), start=1):
        if pattern.search(line):
            print(f"{f.relative_to(root)}:{i}: {line.strip()}")

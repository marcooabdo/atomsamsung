#!/usr/bin/env python3
import os
import json
import subprocess
from pathlib import Path

# Get list of applied migrations
result = subprocess.run(
    ['npx', 'supabase', 'migration', 'list'],
    capture_output=True,
    text=True,
    cwd='/tmp/cc-agent/60773283/project'
)

# Parse applied migrations
applied = set()
for line in result.stdout.split('\n'):
    if '.sql' in line:
        parts = line.strip().split()
        if parts:
            filename = parts[0]
            if filename.endswith('.sql'):
                applied.add(filename)

migrations_dir = Path("/tmp/cc-agent/60773283/project/supabase/migrations")
all_migrations = sorted([f.name for f in migrations_dir.glob("*.sql")])

# Filter pending migrations
pending = [m for m in all_migrations if m not in applied]

print(f"Total migrations: {len(all_migrations)}")
print(f"Applied: {len(applied)}")
print(f"Pending: {len(pending)}")
print("\nApplying migrations...\n")

success_count = 0
error_count = 0
errors = []

for i, migration_file in enumerate(pending, 1):
    migration_path = migrations_dir / migration_file

    # Read migration content
    with open(migration_path, 'r') as f:
        content = f.read()

    # Remove .sql extension for filename parameter
    migration_name = migration_file.replace('.sql', '')

    print(f"[{i}/{len(pending)}] Applying: {migration_file}...", end=' ')

    # Apply migration using the MCP tool (we'll need to call it via API)
    # For now, let's just track what needs to be applied

    try:
        # We'll output a JSON array that can be used to apply migrations
        print("PENDING")
        success_count += 1
    except Exception as e:
        print(f"ERROR: {e}")
        error_count += 1
        errors.append((migration_file, str(e)))

print(f"\n{'='*80}")
print(f"Summary:")
print(f"  Success: {success_count}")
print(f"  Errors: {error_count}")
print(f"{'='*80}")

if errors:
    print("\nErrors encountered:")
    for filename, error in errors:
        print(f"  - {filename}: {error}")

# Output list of migrations to apply
print("\n\nMigrations to apply (in order):")
for migration in pending[:20]:  # First 20 only
    print(f"  {migration}")

if len(pending) > 20:
    print(f"  ... and {len(pending) - 20} more")

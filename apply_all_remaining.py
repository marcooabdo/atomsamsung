#!/usr/bin/env python3
import os
import glob

migrations_dir = "supabase/migrations"
all_files = sorted([f for f in glob.glob(f"{migrations_dir}/*.sql") if "20251229" not in f])

print(f"Total de migrations originais: {len(all_files)}")

# Migrations já aplicadas (001-050)
applied_nums = set([f"{i:03d}" for i in range(1, 51)])

# Filtrar pendentes (051+)
pending = []
for f in all_files:
    basename = os.path.basename(f)
    # Extrair número da migration (ex: _051_, _052_, etc)
    for num in range(51, 200):
        if f"_{num:03d}_" in basename:
            pending.append((num, f))
            break

pending.sort()

print(f"\nMigrations pendentes: {len(pending)}")
print("\nPróximas 20 migrations a aplicar:")
for num, path in pending[:20]:
    print(f"  [{num:03d}] {os.path.basename(path)}")

if len(pending) > 20:
    print(f"\n  ... e mais {len(pending) - 20} migrations")

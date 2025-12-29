#!/usr/bin/env python3
import glob
import os

# Lista de migrations aplicadas
applied = [
    '001', '002', '003', '004', '005', '006', '007', '008', '009', '010',
    '011', '012', '013'
]

migrations_dir = 'supabase/migrations'
all_files = sorted(glob.glob(f'{migrations_dir}/*.sql'))

# Filtrar apenas as que faltam (014-020 para este lote)
pending = []
for f in all_files:
    basename = os.path.basename(f)
    # Extrair número da migration
    if '_014_' in basename or '_015_' in basename or '_016_' in basename or \
       '_017_' in basename or '_018_' in basename or '_019_' in basename or \
       '_020_' in basename:
        pending.append(f)

print(f"Migrations 014-020 para aplicar: {len(pending)}")
for f in pending:
    print(f"  - {os.path.basename(f)}")

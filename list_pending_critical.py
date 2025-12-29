#!/usr/bin/env python3
"""
Lista as migrações críticas que precisam ser aplicadas
"""
import glob
import os

migrations_dir = "supabase/migrations"

# Migrações críticas baseadas no nome
critical_keywords = [
    "payment", "pagamento", "valor_total", "valor_pago", "saldo_restante",
    "numero_tecnico", "performance", "goals", "samsung", "tipo_orcamento",
    "tipo_reparo", "prioridade", "coordinates", "google_maps"
]

all_files = sorted(glob.glob(f"{migrations_dir}/*.sql"))

# Filtrar apenas as que não foram aplicadas (baseado nos timestamps 20251229)
# As aplicadas começam com 20251229
pending = [f for f in all_files if not os.path.basename(f).startswith("20251229")]

print(f"📊 Total de migrações pendentes: {len(pending)}\n")

# Identificar críticas
critical = []
for f in pending:
    basename = os.path.basename(f).lower()
    if any(keyword in basename for keyword in critical_keywords):
        critical.append(f)

print(f"🔴 Migrações CRÍTICAS ({len(critical)}):")
print("="*80)
for f in critical:
    print(f"  • {os.path.basename(f)}")

print(f"\n{'='*80}")
print(f"✅ PRÓXIMOS PASSOS:")
print(f"{'='*80}")
print("1. Aplicar as migrações de 051 a 103 (sistema de rotas, pagamentos, chat)")
print("2. Aplicar as migrações sem número (configurações, prioridades)")
print("3. Aplicar as migrações Samsung (221-226)")
print("4. Aplicar as migrações de performance (228)")
print()
print(f"Total de migrações para aplicar: {len(pending)}")

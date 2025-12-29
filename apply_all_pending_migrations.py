#!/usr/bin/env python3
"""
Script para aplicar todas as migrações pendentes do Supabase
"""
import os
import re
from pathlib import Path

# Lista de migrações já aplicadas (das últimas 69 aplicadas)
APPLIED_MIGRATIONS = {
    "20251229185433_20251127012018_001_create_core_schema.sql",
    "20251229185523_20251127021931_002_add_client_and_tax_tables.sql",
    "20251229185529_20251127023005_003_update_markup_with_price_ranges.sql",
    "20251229185617_20251127023350_004_add_missing_columns_to_config_tables.sql",
    "20251229185731_20251127023809_005_create_hierarchical_permission_system.sql",
    "20251229185737_20251127024118_006_add_unidade_to_config_tables.sql",
    "20251229185830_20251127024849_007_fix_servicos_codigo_column.sql",
    "20251229185836_20251127025433_008_fix_usuarios_id_default.sql",
    "20251229185842_20251127025621_009_update_rls_for_all_units_users.sql",
    "20251229185849_20251127030429_010_fix_usuarios_rls_recursion.sql",
    "20251229185934_20251127030746_011_complete_rls_cleanup_usuarios.sql",
    "20251229185940_20251127031206_012_remove_auth_users_fk_from_usuarios.sql",
    "20251229185946_20251127033021_013_allow_null_unidade_for_shared_configs.sql",
    "20251229192652_20251127041502_014_add_chave_acesso_to_estoque_nfs.sql.sql",
    "20251229192658_20251127044053_015_create_warehouse_map_system.sql.sql",
    "20251229192759_20251127045516_016_fix_estoque_salas_rls_for_master.sql.sql",
    "20251229192805_20251127045536_017_fix_estoque_estantes_bins_rls_for_master.sql.sql",
    "20251229192811_20251127050310_018_add_position_and_dimensions_to_estantes.sql.sql",
    "20251229192818_20251127050325_019_update_bins_to_battleship_coordinates.sql.sql",
    "20251229192824_20251127053042_020_create_etiquetas_system.sql.sql",
    "20251229192830_20251127110912_021_add_location_to_pecas.sql.sql",
    "20251229192856_20251127143643_022_add_sequential_id_to_pecas.sql.sql",
    "20251229192902_20251127151200_023_add_sequential_cotacao_number.sql.sql",
    "20251229192925_20251130101152_024_create_requisicoes_pecas_system.sql.sql",
    "20251229193028_20251130101950_025_add_payment_discount_fields_to_cotacoes.sql.sql",
    "20251229193035_20251130105140_026_create_storage_policies_for_cotacoes_anexos.sql.sql",
    "20251229193041_20251130110045_027_fix_os_anexos_allow_null_os_id.sql.sql",
    "20251229193047_20251130113708_028_add_is_system_to_comments.sql.sql",
    "20251229193053_20251130113758_029_add_os_id_to_cotacao_tables.sql.sql",
    "20251229193100_20251130121659_030_add_taxa_cliente_to_cotacoes.sql.sql",
    "20251229193128_20251130122053_031_fix_cotacao_comentarios_update_policy.sql.sql",
    "20251229193134_20251130122144_032_fix_os_anexos_update_policy.sql.sql",
    "20251229193216_20251130124442_033_fix_comments_and_anexos_preservation.sql.sql",
    "20251229193222_20251130125442_034_fix_os_foreign_keys_for_deletion.sql.sql",
    "20251229193247_20251130133955_035_fix_remaining_os_foreign_keys.sql.sql",
    "20251229193314_20251130141422_036_fix_estoque_foreign_keys_blocking_deletion.sql.sql",
    "20251229193321_20251130142103_037_add_delete_policy_to_os_table.sql.sql",
    "20251229193400_20251130162046_038_add_missing_fields_and_nf_devolucoes_table.sql.sql",
    "20251229193406_20251130192117_039_add_imei_and_clientes_table.sql.sql",
    "20251229193413_20251130201926_040_add_reprovacao_fields_to_requisicoes_pecas.sql.sql",
    "20251229193509_20251130202011_041_add_reprovada_to_requisicao_status_enum.sql.sql",
    "20251229193515_20251130212414_042_add_observacoes_to_estoque_pedidos.sql.sql",
    "20251229193521_20251130213009_043_add_pedido_feito_status_and_observacoes.sql.sql",
    "20251229193528_20251130224102_044_add_address_fields_to_os_and_cotacoes.sql.sql",
    "20251229193534_20251130231058_045_add_cotacao_id_to_requisicoes_pecas.sql.sql",
    "20251229193627_20251130231549_046_add_devolucao_pendente_status.sql.sql",
    "20251229193633_20251201022206_047_fix_requisicoes_preserve_on_os_deletion.sql.sql",
    "20251229193640_20251201022716_048_allow_null_os_id_in_requisicoes.sql.sql",
    "20251229193646_20251201024848_049_add_numero_os_samsung_to_requisicoes.sql.sql",
    "20251229193652_20251201030142_050_add_route_columns_and_system.sql.sql",
    "20251229204349_051_fix_rotas_per_unit_system.sql",
    "20251229204655_053_create_agendamentos_and_checklist_system_fixed.sql",
    "20251229204543_054_create_payment_system.sql",
    "20251229204549_055_fix_payment_value_calculation.sql",
    "20251229204556_056_add_tipo_orcamento_system.sql",
    "20251229204809_057_create_chat_system.sql",
    "20251229204815_058_create_chat_storage_bucket.sql",
    "20251229204822_059_add_delivery_to_estoque_nfs.sql",
    "20251229204828_060_add_payment_details_and_trigger.sql",
    "20251229204938_061_populate_os_payment_values.sql",
    "20251229204945_062_force_recalculate_all_os_payment_values.sql",
    "20251229204951_063_fix_markup_rpc_return_ativo.sql",
    "20251229204958_064_create_pagamentos_storage_bucket.sql",
    "20251229205005_065_add_orcamento_sent_and_modification_tracking.sql",
    "20251229205037_066_fix_cotacao_trigger_desconto_tipo.sql",
    "20251229205044_067_fix_cotacao_trigger_remove_nonexistent_fields.sql",
    "20251229205050_068_allow_null_os_id_in_pagamentos.sql",
    "20251229205056_069_fix_payment_trigger_enum_casting.sql",
    "20251229203620_20251223013411_add_samsung_fields_to_unidades.sql",
}

def get_all_migrations():
    """Lista todas as migrações do diretório"""
    migrations_dir = Path("/tmp/cc-agent/60773283/project/supabase/migrations")
    all_files = sorted(migrations_dir.glob("*.sql"))

    migrations = []
    for file_path in all_files:
        filename = file_path.name
        # Extrair timestamp do nome do arquivo
        match = re.match(r'(\d{14})', filename)
        if match:
            timestamp = match.group(1)
            migrations.append({
                'filename': filename,
                'timestamp': timestamp,
                'path': str(file_path)
            })

    # Ordenar por timestamp
    migrations.sort(key=lambda x: x['timestamp'])
    return migrations

def get_pending_migrations():
    """Retorna lista de migrações pendentes"""
    all_migrations = get_all_migrations()
    pending = []

    for migration in all_migrations:
        if migration['filename'] not in APPLIED_MIGRATIONS:
            pending.append(migration)

    return pending

def main():
    pending = get_pending_migrations()

    print(f"\n{'='*80}")
    print(f"Total de migrações pendentes: {len(pending)}")
    print(f"{'='*80}\n")

    for i, migration in enumerate(pending, 1):
        print(f"{i:3d}. {migration['filename']}")

    print(f"\n{'='*80}")
    print("Execute este script através do Claude para aplicar todas as migrações")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()

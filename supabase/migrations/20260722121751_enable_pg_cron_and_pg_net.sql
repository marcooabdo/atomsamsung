/*
# Habilitar pg_cron e pg_net para agendamento automático de relatórios

1. Extensions
   - pg_cron: agendamento de tarefas dentro do Postgres
   - pg_net: chamadas HTTP assíncronas a partir do banco

2. Propósito
   - Permitir que os relatórios da GIA sejam disparados automaticamente
     nos horários configurados sem depender de serviço externo
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

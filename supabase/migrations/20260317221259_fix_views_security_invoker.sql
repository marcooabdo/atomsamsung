/*
  # Fix views to use security_invoker

  By default, PostgreSQL views execute with the permissions of the view owner
  (the role that created them), which bypasses RLS policies on the underlying
  tables. Setting `security_invoker = true` ensures that the view respects
  the RLS policies of the querying user.

  1. Views updated:
    - chat_conversations_with_info
    - v_agendamentos_com_status_visual
    - v_agendamentos_hoje
    - v_skywalker_elegibilidade
    - v_skywalker_elegibilidade_detalhada
    - vw_os_status_pecas
    - vw_pipeline_eficiencia

  2. Security impact:
    - Views now respect RLS policies of the querying user
    - Users can only see data through views that they could also see directly
    - Prevents potential data leakage through view access
*/

ALTER VIEW chat_conversations_with_info SET (security_invoker = true);
ALTER VIEW v_agendamentos_com_status_visual SET (security_invoker = true);
ALTER VIEW v_agendamentos_hoje SET (security_invoker = true);
ALTER VIEW v_skywalker_elegibilidade SET (security_invoker = true);
ALTER VIEW v_skywalker_elegibilidade_detalhada SET (security_invoker = true);
ALTER VIEW vw_os_status_pecas SET (security_invoker = true);
ALTER VIEW vw_pipeline_eficiencia SET (security_invoker = true);

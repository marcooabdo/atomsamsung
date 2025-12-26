/*
  # Remove incorrect trigger from os_anexos

  The trigger `sync_anexos_checkout_to_kanban` references `agendamento_id` 
  which does not exist in the os_anexos table. This trigger was incorrectly
  attached to os_anexos and needs to be removed.
*/

DROP TRIGGER IF EXISTS trigger_sync_anexos_checkout ON os_anexos;
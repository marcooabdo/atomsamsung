/*
# Fix checklist respostas FK blocking cascade

agendamento_checklist_respostas.template_id references checklist_templates with NO ACTION.
Since checklist_templates cascades from unidades, this blocks deletion.

## Modified:
- agendamento_checklist_respostas.template_id -> CASCADE
*/

ALTER TABLE agendamento_checklist_respostas DROP CONSTRAINT IF EXISTS agendamento_checklist_respostas_template_id_fkey;
ALTER TABLE agendamento_checklist_respostas ADD CONSTRAINT agendamento_checklist_respostas_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE;

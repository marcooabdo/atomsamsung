export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      unidades: {
        Row: {
          id: string
          nome: string
          cidade: string
          estado: string
          endereco: string | null
          telefone: string | null
          ativa: boolean
          samsung_asccode: string | null
          samsung_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cidade: string
          estado: string
          endereco?: string | null
          telefone?: string | null
          ativa?: boolean
          samsung_asccode?: string | null
          samsung_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cidade?: string
          estado?: string
          endereco?: string | null
          telefone?: string | null
          ativa?: boolean
          samsung_asccode?: string | null
          samsung_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          nome: string
          email: string
          tipo: 'tecnico' | 'estoque' | 'recepcao' | 'financeiro' | 'gerente' | 'master'
          unidade_id: string | null
          ativo: boolean
          numero_tecnico: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          tipo: 'tecnico' | 'estoque' | 'recepcao' | 'financeiro' | 'gerente' | 'master'
          unidade_id?: string | null
          ativo?: boolean
          numero_tecnico?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          tipo?: 'tecnico' | 'estoque' | 'recepcao' | 'financeiro' | 'gerente' | 'master'
          unidade_id?: string | null
          ativo?: boolean
          numero_tecnico?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      servicos: {
        Row: {
          id: string
          codigo: string
          descricao: string
          valor_padrao: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          codigo: string
          descricao: string
          valor_padrao?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          codigo?: string
          descricao?: string
          valor_padrao?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      rotas: {
        Row: {
          id: string
          nome: string
          cor: string | null
          cidades: string[]
          ativa: boolean
          coluna_kanban: string | null
          unidade_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cor?: string | null
          cidades?: string[]
          ativa?: boolean
          coluna_kanban?: string | null
          unidade_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cor?: string | null
          cidades?: string[]
          ativa?: boolean
          coluna_kanban?: string | null
          unidade_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      formas_pagamento: {
        Row: {
          id: string
          nome: string
          requer_sku: boolean
          taxa_percentual: number
          ativa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          requer_sku?: boolean
          taxa_percentual?: number
          ativa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          requer_sku?: boolean
          taxa_percentual?: number
          ativa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      markup_regras: {
        Row: {
          id: string
          nome: string
          valor_minimo: number | null
          valor_maximo: number | null
          tipo: 'percentual' | 'multiplicador' | 'valor_fixo'
          valor: number
          descricao: string | null
          ativo: boolean
          tipo_orcamento: 'normal' | 'acessorios' | 'samsung_contigo'
          unidade_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          valor_minimo?: number | null
          valor_maximo?: number | null
          tipo: 'percentual' | 'multiplicador' | 'valor_fixo'
          valor?: number
          descricao?: string | null
          ativo?: boolean
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo'
          unidade_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          valor_minimo?: number | null
          valor_maximo?: number | null
          tipo?: 'percentual' | 'multiplicador' | 'valor_fixo'
          valor?: number
          descricao?: string | null
          ativo?: boolean
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo'
          unidade_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cotacoes: {
        Row: {
          id: string
          numero_cotacao: string
          numero_os_samsung: string | null
          tipo_atendimento: 'IH' | 'CI'
          tipo_os: 'LP' | 'OW'
          unidade_id: string
          status: 'pendente_preenchimento' | 'enviada' | 'aprovada' | 'reprovada' | 'reprovada_refeita'
          cliente_nome: string
          cliente_cpf_cnpj: string | null
          cliente_telefone: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_cep: string | null
          cliente_logradouro: string | null
          cliente_numero: string | null
          cliente_complemento: string | null
          cliente_bairro: string | null
          cliente_cidade: string | null
          cliente_estado: string | null
          aparelho_marca: string | null
          aparelho_linha: string | null
          aparelho_modelo: string | null
          aparelho_numero_serie: string | null
          aparelho_imei: string | null
          defeito_relatado: string | null
          observacoes_internas: string | null
          observacoes_cliente: string | null
          forma_pagamento_id: string | null
          parcelamento: number | null
          valor_entrada: number
          link_aprovacao: string | null
          aprovada_em: string | null
          aprovada_ip: string | null
          aprovada_localizacao: string | null
          aprovada_dispositivo: string | null
          reprovada_em: string | null
          reprovada_motivo: string | null
          versao: number
          cotacao_original_id: string | null
          tipo_orcamento: 'normal' | 'acessorios' | 'samsung_contigo' | null
          taxa_para_cliente: boolean
          criado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero_cotacao: string
          numero_os_samsung?: string | null
          tipo_atendimento: 'IH' | 'CI'
          tipo_os: 'LP' | 'OW'
          unidade_id: string
          status?: 'pendente_preenchimento' | 'enviada' | 'aprovada' | 'reprovada' | 'reprovada_refeita'
          cliente_nome: string
          cliente_cpf_cnpj?: string | null
          cliente_telefone?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_cep?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_complemento?: string | null
          cliente_bairro?: string | null
          cliente_cidade?: string | null
          cliente_estado?: string | null
          aparelho_marca?: string | null
          aparelho_linha?: string | null
          aparelho_modelo?: string | null
          aparelho_numero_serie?: string | null
          aparelho_imei?: string | null
          defeito_relatado?: string | null
          observacoes_internas?: string | null
          observacoes_cliente?: string | null
          forma_pagamento_id?: string | null
          parcelamento?: number | null
          valor_entrada?: number
          link_aprovacao?: string | null
          aprovada_em?: string | null
          aprovada_ip?: string | null
          aprovada_localizacao?: string | null
          aprovada_dispositivo?: string | null
          reprovada_em?: string | null
          reprovada_motivo?: string | null
          versao?: number
          cotacao_original_id?: string | null
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo' | null
          taxa_para_cliente?: boolean
          criado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          numero_cotacao?: string
          numero_os_samsung?: string | null
          tipo_atendimento?: 'IH' | 'CI'
          tipo_os?: 'LP' | 'OW'
          unidade_id?: string
          status?: 'pendente_preenchimento' | 'enviada' | 'aprovada' | 'reprovada' | 'reprovada_refeita'
          cliente_nome?: string
          cliente_cpf_cnpj?: string | null
          cliente_telefone?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_cep?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_complemento?: string | null
          cliente_bairro?: string | null
          cliente_cidade?: string | null
          cliente_estado?: string | null
          aparelho_marca?: string | null
          aparelho_linha?: string | null
          aparelho_modelo?: string | null
          aparelho_numero_serie?: string | null
          aparelho_imei?: string | null
          defeito_relatado?: string | null
          observacoes_internas?: string | null
          observacoes_cliente?: string | null
          forma_pagamento_id?: string | null
          parcelamento?: number | null
          valor_entrada?: number
          link_aprovacao?: string | null
          aprovada_em?: string | null
          aprovada_ip?: string | null
          aprovada_localizacao?: string | null
          aprovada_dispositivo?: string | null
          reprovada_em?: string | null
          reprovada_motivo?: string | null
          versao?: number
          cotacao_original_id?: string | null
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo' | null
          taxa_para_cliente?: boolean
          criado_por?: string
          created_at?: string
          updated_at?: string
        }
      }
      cotacoes_pecas: {
        Row: {
          id: string
          cotacao_id: string
          os_id: string | null
          pn: string
          descricao: string
          quantidade: number
          valor_base_gspn: number
          markup_aplicado: number | null
          valor_final_unitario: number
          valor_total: number
          observacao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          os_id?: string | null
          pn: string
          descricao: string
          quantidade?: number
          valor_base_gspn: number
          markup_aplicado?: number | null
          valor_final_unitario: number
          valor_total: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          os_id?: string | null
          pn?: string
          descricao?: string
          quantidade?: number
          valor_base_gspn?: number
          markup_aplicado?: number | null
          valor_final_unitario?: number
          valor_total?: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cotacoes_servicos: {
        Row: {
          id: string
          cotacao_id: string
          os_id: string | null
          servico_id: string
          descricao: string
          quantidade: number
          valor_unitario: number
          valor_total: number
          observacao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          os_id?: string | null
          servico_id: string
          descricao: string
          quantidade?: number
          valor_unitario: number
          valor_total: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          os_id?: string | null
          servico_id?: string
          descricao?: string
          quantidade?: number
          valor_unitario?: number
          valor_total?: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cotacoes_historico: {
        Row: {
          id: string
          cotacao_id: string
          usuario_id: string
          acao: string
          campo_alterado: string | null
          valor_anterior: string | null
          valor_novo: string | null
          motivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          usuario_id: string
          acao: string
          campo_alterado?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
          motivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          usuario_id?: string
          acao?: string
          campo_alterado?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
          motivo?: string | null
          created_at?: string
        }
      }
      cotacao_comentarios: {
        Row: {
          id: string
          cotacao_id: string
          os_id: string | null
          usuario_id: string | null
          texto: string
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          os_id?: string | null
          usuario_id?: string | null
          texto: string
          is_system?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          os_id?: string | null
          usuario_id?: string | null
          texto?: string
          is_system?: boolean
          created_at?: string
        }
      }
      os: {
        Row: {
          id: string
          numero_os_samsung: string | null
          numero_os_interna: string | null
          cotacao_id: string | null
          tipo_atendimento: 'IH' | 'CI'
          tipo_os: 'LP' | 'OW'
          unidade_id: string
          coluna_kanban: string
          cliente_nome: string
          cliente_cpf_cnpj: string | null
          cliente_telefone: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_cep: string | null
          cliente_logradouro: string | null
          cliente_numero: string | null
          cliente_complemento: string | null
          cliente_bairro: string | null
          cliente_cidade: string | null
          cliente_estado: string | null
          aparelho_marca: string | null
          aparelho_linha: string | null
          aparelho_modelo: string | null
          aparelho_numero_serie: string | null
          aparelho_imei: string | null
          defeito_relatado: string | null
          observacoes_internas: string | null
          dias_na_etapa: number
          alerta_divergencia_gspn: boolean
          status_gspn: string | null
          tecnico_id: string | null
          rota_id: string | null
          data_agendamento: string | null
          tecnico_agendado_id: string | null
          confirmado_com_cliente: boolean
          periodo_agendamento: 'manha' | 'tarde' | null
          tecnico_designado_id: string | null
          tecnico_designado_em: string | null
          fechada_em: string | null
          fechada_por: string | null
          valor_total: number
          valor_pago: number
          saldo_restante: number
          status_pagamento: 'pendente' | 'parcial' | 'pago'
          tipo_orcamento: 'normal' | 'acessorios' | 'samsung_contigo' | null
          tempo_medio_atendimento: number | null
          cliente_vip: boolean
          data_compra: string | null
          status_garantia: string | null
          status_samsung_desc: string | null
          status_samsung_reason: string | null
          data_abertura_samsung: string | null
          data_requisicao_samsung: string | null
          tipo_reparo: string | null
          is_cortesia: boolean
          motivo_cortesia: string | null
          criado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero_os_samsung?: string | null
          numero_os_interna?: string | null
          cotacao_id?: string | null
          tipo_atendimento: 'IH' | 'CI'
          tipo_os: 'LP' | 'OW'
          unidade_id: string
          coluna_kanban?: string
          cliente_nome: string
          cliente_cpf_cnpj?: string | null
          cliente_telefone?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_cep?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_complemento?: string | null
          cliente_bairro?: string | null
          cliente_cidade?: string | null
          cliente_estado?: string | null
          aparelho_marca?: string | null
          aparelho_linha?: string | null
          aparelho_modelo?: string | null
          aparelho_numero_serie?: string | null
          aparelho_imei?: string | null
          defeito_relatado?: string | null
          observacoes_internas?: string | null
          dias_na_etapa?: number
          alerta_divergencia_gspn?: boolean
          status_gspn?: string | null
          tecnico_id?: string | null
          rota_id?: string | null
          data_agendamento?: string | null
          tecnico_agendado_id?: string | null
          confirmado_com_cliente?: boolean
          periodo_agendamento?: 'manha' | 'tarde' | null
          tecnico_designado_id?: string | null
          tecnico_designado_em?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          valor_total?: number
          valor_pago?: number
          saldo_restante?: number
          status_pagamento?: 'pendente' | 'parcial' | 'pago'
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo' | null
          tempo_medio_atendimento?: number | null
          cliente_vip?: boolean
          data_compra?: string | null
          status_garantia?: string | null
          status_samsung_desc?: string | null
          status_samsung_reason?: string | null
          data_abertura_samsung?: string | null
          data_requisicao_samsung?: string | null
          tipo_reparo?: string | null
          is_cortesia?: boolean
          motivo_cortesia?: string | null
          criado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          numero_os_samsung?: string | null
          numero_os_interna?: string | null
          cotacao_id?: string | null
          tipo_atendimento?: 'IH' | 'CI'
          tipo_os?: 'LP' | 'OW'
          unidade_id?: string
          coluna_kanban?: string
          cliente_nome?: string
          cliente_cpf_cnpj?: string | null
          cliente_telefone?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_cep?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_complemento?: string | null
          cliente_bairro?: string | null
          cliente_cidade?: string | null
          cliente_estado?: string | null
          aparelho_marca?: string | null
          aparelho_linha?: string | null
          aparelho_modelo?: string | null
          aparelho_numero_serie?: string | null
          aparelho_imei?: string | null
          defeito_relatado?: string | null
          observacoes_internas?: string | null
          dias_na_etapa?: number
          alerta_divergencia_gspn?: boolean
          status_gspn?: string | null
          tecnico_id?: string | null
          rota_id?: string | null
          data_agendamento?: string | null
          tecnico_agendado_id?: string | null
          confirmado_com_cliente?: boolean
          periodo_agendamento?: 'manha' | 'tarde' | null
          tecnico_designado_id?: string | null
          tecnico_designado_em?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          valor_total?: number
          valor_pago?: number
          saldo_restante?: number
          status_pagamento?: 'pendente' | 'parcial' | 'pago'
          tipo_orcamento?: 'normal' | 'acessorios' | 'samsung_contigo' | null
          tempo_medio_atendimento?: number | null
          cliente_vip?: boolean
          data_compra?: string | null
          status_garantia?: string | null
          status_samsung_desc?: string | null
          status_samsung_reason?: string | null
          data_abertura_samsung?: string | null
          data_requisicao_samsung?: string | null
          tipo_reparo?: string | null
          is_cortesia?: boolean
          motivo_cortesia?: string | null
          criado_por?: string
          created_at?: string
          updated_at?: string
        }
      }
      os_pecas: {
        Row: {
          id: string
          os_id: string
          pn: string
          descricao: string
          quantidade: number
          status: string
          estoque_peca_id: string | null
          requisitada_por: string
          requisitada_em: string
          aprovada_por: string | null
          aprovada_em: string | null
          usada_em: string | null
          gi_postado_em: string | null
          devolvida_em: string | null
          observacao: string | null
          codigo: string | null
          valor_unitario: number | null
          valor_total: number | null
          cotacao_peca_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id: string
          pn: string
          descricao: string
          quantidade?: number
          status?: string
          estoque_peca_id?: string | null
          requisitada_por: string
          requisitada_em?: string
          aprovada_por?: string | null
          aprovada_em?: string | null
          usada_em?: string | null
          gi_postado_em?: string | null
          devolvida_em?: string | null
          observacao?: string | null
          codigo?: string | null
          valor_unitario?: number | null
          valor_total?: number | null
          cotacao_peca_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string
          pn?: string
          descricao?: string
          quantidade?: number
          status?: string
          estoque_peca_id?: string | null
          requisitada_por?: string
          requisitada_em?: string
          aprovada_por?: string | null
          aprovada_em?: string | null
          usada_em?: string | null
          gi_postado_em?: string | null
          devolvida_em?: string | null
          observacao?: string | null
          codigo?: string | null
          valor_unitario?: number | null
          valor_total?: number | null
          cotacao_peca_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      os_checklist: {
        Row: {
          id: string
          os_id: string
          item: string
          concluido: boolean
          concluido_por: string | null
          concluido_em: string | null
          observacao: string | null
          ordem: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id: string
          item: string
          concluido?: boolean
          concluido_por?: string | null
          concluido_em?: string | null
          observacao?: string | null
          ordem?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string
          item?: string
          concluido?: boolean
          concluido_por?: string | null
          concluido_em?: string | null
          observacao?: string | null
          ordem?: number
          created_at?: string
          updated_at?: string
        }
      }
      os_comentarios: {
        Row: {
          id: string
          os_id: string
          usuario_id: string
          comentario: string
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          os_id: string
          usuario_id: string
          comentario: string
          is_system?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          os_id?: string
          usuario_id?: string
          comentario?: string
          is_system?: boolean
          created_at?: string
        }
      }
      os_anexos: {
        Row: {
          id: string
          os_id: string | null
          cotacao_id: string | null
          tipo: 'foto' | 'video' | 'documento'
          nome_arquivo: string
          url: string
          tamanho_bytes: number | null
          usuario_id: string
          created_at: string
        }
        Insert: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          tipo: 'foto' | 'video' | 'documento'
          nome_arquivo: string
          url: string
          tamanho_bytes?: number | null
          usuario_id: string
          created_at?: string
        }
        Update: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          tipo?: 'foto' | 'video' | 'documento'
          nome_arquivo?: string
          url?: string
          tamanho_bytes?: number | null
          usuario_id?: string
          created_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          cpf_cnpj: string
          nome: string
          telefone: string | null
          email: string | null
          endereco: string | null
          cep: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cpf_cnpj: string
          nome: string
          telefone?: string | null
          email?: string | null
          endereco?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cpf_cnpj?: string
          nome?: string
          telefone?: string | null
          email?: string | null
          endereco?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      taxas_maquina: {
        Row: {
          id: string
          parcelamento: number
          taxa: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parcelamento: number
          taxa?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parcelamento?: number
          taxa?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      estoque_nfs: {
        Row: {
          id: string
          numero_nf: string
          xml_conteudo: string | null
          data_emissao: string
          fornecedor: string
          valor_total: number
          unidade_id: string
          processada: boolean
          processada_em: string | null
          processada_por: string | null
          chave_acesso: string | null
          pdf_url: string | null
          pdf_downloaded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          numero_nf: string
          xml_conteudo?: string | null
          data_emissao: string
          fornecedor: string
          valor_total: number
          unidade_id: string
          processada?: boolean
          processada_em?: string | null
          processada_por?: string | null
          chave_acesso?: string | null
          pdf_url?: string | null
          pdf_downloaded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          numero_nf?: string
          xml_conteudo?: string | null
          data_emissao?: string
          fornecedor?: string
          valor_total?: number
          unidade_id?: string
          processada?: boolean
          processada_em?: string | null
          processada_por?: string | null
          chave_acesso?: string | null
          pdf_url?: string | null
          pdf_downloaded_at?: string | null
          created_at?: string
        }
      }
      estoque_pecas: {
        Row: {
          id: string
          id_numerico: number
          id_unico: string
          pn: string
          descricao: string
          nf_id: string
          unidade_id: string
          localizacao: string | null
          valor_com_impostos: number
          status: string
          os_id: string | null
          tecnico_id: string | null
          data_entrada: string
          data_ultima_movimentacao: string
          qrcode_url: string | null
          bin_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          id_numerico?: number
          id_unico: string
          pn: string
          descricao: string
          nf_id: string
          unidade_id: string
          localizacao?: string | null
          valor_com_impostos: number
          status?: string
          os_id?: string | null
          tecnico_id?: string | null
          data_entrada?: string
          data_ultima_movimentacao?: string
          qrcode_url?: string | null
          bin_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          id_numerico?: number
          id_unico?: string
          pn?: string
          descricao?: string
          nf_id?: string
          unidade_id?: string
          localizacao?: string | null
          valor_com_impostos?: number
          status?: string
          os_id?: string | null
          tecnico_id?: string | null
          data_entrada?: string
          data_ultima_movimentacao?: string
          qrcode_url?: string | null
          bin_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      estoque_salas: {
        Row: {
          id: string
          unidade_id: string
          nome: string
          cor: string
          posicao_x: number
          posicao_y: number
          largura: number
          altura: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unidade_id: string
          nome: string
          cor?: string
          posicao_x?: number
          posicao_y?: number
          largura?: number
          altura?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unidade_id?: string
          nome?: string
          cor?: string
          posicao_x?: number
          posicao_y?: number
          largura?: number
          altura?: number
          created_at?: string
          updated_at?: string
        }
      }
      estoque_estantes: {
        Row: {
          id: string
          sala_id: string
          nome: string
          andares: number
          bins_por_andar: number
          posicao_x: number
          posicao_y: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sala_id: string
          nome: string
          andares?: number
          bins_por_andar?: number
          posicao_x?: number
          posicao_y?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sala_id?: string
          nome?: string
          andares?: number
          bins_por_andar?: number
          posicao_x?: number
          posicao_y?: number
          created_at?: string
          updated_at?: string
        }
      }
      estoque_bins: {
        Row: {
          id: string
          estante_id: string
          andar: number
          posicao: number
          codigo: string
          capacidade_maxima: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          estante_id: string
          andar: number
          posicao: number
          codigo: string
          capacidade_maxima?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          estante_id?: string
          andar?: number
          posicao?: number
          codigo?: string
          capacidade_maxima?: number
          created_at?: string
          updated_at?: string
        }
      }
      estoque_transferencias: {
        Row: {
          id: string
          peca_id: string
          os_id: string | null
          tipo: string
          origem_unidade_id: string | null
          destino_unidade_id: string | null
          origem_tecnico_id: string | null
          destino_tecnico_id: string | null
          status: string
          qrcode_bipado: boolean
          solicitada_por: string
          aprovada_por: string | null
          concluida_por: string | null
          concluida_em: string | null
          observacao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          peca_id: string
          os_id?: string | null
          tipo: string
          origem_unidade_id?: string | null
          destino_unidade_id?: string | null
          origem_tecnico_id?: string | null
          destino_tecnico_id?: string | null
          status?: string
          qrcode_bipado?: boolean
          solicitada_por: string
          aprovada_por?: string | null
          concluida_por?: string | null
          concluida_em?: string | null
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          peca_id?: string
          os_id?: string | null
          tipo?: string
          origem_unidade_id?: string | null
          destino_unidade_id?: string | null
          origem_tecnico_id?: string | null
          destino_tecnico_id?: string | null
          status?: string
          qrcode_bipado?: boolean
          solicitada_por?: string
          aprovada_por?: string | null
          concluida_por?: string | null
          concluida_em?: string | null
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      estoque_devolucoes: {
        Row: {
          id: string
          peca_id: string
          tipo_devolucao: string
          solicitada_por: string
          aprovada_por: string | null
          conferida: boolean
          conferida_por: string | null
          conferida_em: string | null
          qrcode_bipado: boolean
          nf_devolucao: string | null
          data_coleta: string | null
          justificativa_nao_devolucao: string | null
          dias_vinculada: number
          observacao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          peca_id: string
          tipo_devolucao: string
          solicitada_por: string
          aprovada_por?: string | null
          conferida?: boolean
          conferida_por?: string | null
          conferida_em?: string | null
          qrcode_bipado?: boolean
          nf_devolucao?: string | null
          data_coleta?: string | null
          justificativa_nao_devolucao?: string | null
          dias_vinculada?: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          peca_id?: string
          tipo_devolucao?: string
          solicitada_por?: string
          aprovada_por?: string | null
          conferida?: boolean
          conferida_por?: string | null
          conferida_em?: string | null
          qrcode_bipado?: boolean
          nf_devolucao?: string | null
          data_coleta?: string | null
          justificativa_nao_devolucao?: string | null
          dias_vinculada?: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      estoque_pedidos: {
        Row: {
          id: string
          os_id: string
          pn: string
          descricao: string
          quantidade: number
          valor_estimado: number | null
          numero_pedido_samsung: string | null
          fornecedor: string | null
          previsao_chegada: string | null
          status: string
          observacoes: string | null
          solicitado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id: string
          pn: string
          descricao: string
          quantidade?: number
          valor_estimado?: number | null
          numero_pedido_samsung?: string | null
          fornecedor?: string | null
          previsao_chegada?: string | null
          status?: string
          observacoes?: string | null
          solicitado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string
          pn?: string
          descricao?: string
          quantidade?: number
          valor_estimado?: number | null
          numero_pedido_samsung?: string | null
          fornecedor?: string | null
          previsao_chegada?: string | null
          status?: string
          observacoes?: string | null
          solicitado_por?: string
          created_at?: string
          updated_at?: string
        }
      }
      estoque_historico: {
        Row: {
          id: string
          peca_id: string
          usuario_id: string
          acao: string
          status_anterior: string | null
          status_novo: string | null
          origem: string | null
          destino: string | null
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          peca_id: string
          usuario_id: string
          acao: string
          status_anterior?: string | null
          status_novo?: string | null
          origem?: string | null
          destino?: string | null
          observacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          peca_id?: string
          usuario_id?: string
          acao?: string
          status_anterior?: string | null
          status_novo?: string | null
          origem?: string | null
          destino?: string | null
          observacao?: string | null
          created_at?: string
        }
      }
      requisicoes_pecas: {
        Row: {
          id: string
          os_id: string | null
          cotacao_id: string | null
          cotacao_peca_id: string | null
          codigo_peca: string
          descricao: string
          quantidade_requisitada: number
          status: string
          peca_estoque_id: string | null
          requisitado_por: string | null
          atendido_por: string | null
          gi_postada_em: string | null
          motivo_devolucao: string | null
          tipo_devolucao: string | null
          numero_os_samsung: string | null
          unidade_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          cotacao_peca_id?: string | null
          codigo_peca: string
          descricao: string
          quantidade_requisitada?: number
          status?: string
          peca_estoque_id?: string | null
          requisitado_por?: string | null
          atendido_por?: string | null
          gi_postada_em?: string | null
          motivo_devolucao?: string | null
          tipo_devolucao?: string | null
          numero_os_samsung?: string | null
          unidade_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          cotacao_peca_id?: string | null
          codigo_peca?: string
          descricao?: string
          quantidade_requisitada?: number
          status?: string
          peca_estoque_id?: string | null
          requisitado_por?: string | null
          atendido_por?: string | null
          gi_postada_em?: string | null
          motivo_devolucao?: string | null
          tipo_devolucao?: string | null
          numero_os_samsung?: string | null
          unidade_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      agendamentos: {
        Row: {
          id: string
          os_id: string
          tecnico_id: string
          rota_id: string | null
          data_agendamento: string
          horario_inicio: string
          horario_fim: string
          status: string
          confirmado_com_cliente: boolean
          observacao: string | null
          agendado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id: string
          tecnico_id: string
          rota_id?: string | null
          data_agendamento: string
          horario_inicio: string
          horario_fim: string
          status?: string
          confirmado_com_cliente?: boolean
          observacao?: string | null
          agendado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string
          tecnico_id?: string
          rota_id?: string | null
          data_agendamento?: string
          horario_inicio?: string
          horario_fim?: string
          status?: string
          confirmado_com_cliente?: boolean
          observacao?: string | null
          agendado_por?: string
          created_at?: string
          updated_at?: string
        }
      }
      agendamentos_checkin_checkout: {
        Row: {
          id: string
          agendamento_id: string
          tipo: 'checkin' | 'checkout'
          data_hora: string
          localizacao_lat: number | null
          localizacao_lng: number | null
          localizacao_endereco: string | null
          fotos: string[]
          assinatura_cliente: string | null
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agendamento_id: string
          tipo: 'checkin' | 'checkout'
          data_hora?: string
          localizacao_lat?: number | null
          localizacao_lng?: number | null
          localizacao_endereco?: string | null
          fotos?: string[]
          assinatura_cliente?: string | null
          observacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agendamento_id?: string
          tipo?: 'checkin' | 'checkout'
          data_hora?: string
          localizacao_lat?: number | null
          localizacao_lng?: number | null
          localizacao_endereco?: string | null
          fotos?: string[]
          assinatura_cliente?: string | null
          observacao?: string | null
          created_at?: string
        }
      }
      pagamentos: {
        Row: {
          id: string
          os_id: string | null
          cotacao_id: string | null
          unidade_id: string
          forma_pagamento: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro'
          valor: number
          comprovante_url: string
          sku_maquininha: string | null
          observacoes: string | null
          lancado_por: string
          responsavel_fechamento: string
          data_lancamento: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          unidade_id: string
          forma_pagamento: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro'
          valor: number
          comprovante_url: string
          sku_maquininha?: string | null
          observacoes?: string | null
          lancado_por: string
          responsavel_fechamento: string
          data_lancamento?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          unidade_id?: string
          forma_pagamento?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro'
          valor?: number
          comprovante_url?: string
          sku_maquininha?: string | null
          observacoes?: string | null
          lancado_por?: string
          responsavel_fechamento?: string
          data_lancamento?: string
          created_at?: string
          updated_at?: string
        }
      }
      financeiro_lancamentos: {
        Row: {
          id: string
          os_id: string | null
          cotacao_id: string | null
          numero_os_samsung: string | null
          numero_os_interna: string | null
          numero_cotacao: string | null
          forma_pagamento_id: string
          valor: number
          sku_transacao: string | null
          data_pagamento: string
          unidade_id: string
          observacao: string | null
          lancado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          numero_os_samsung?: string | null
          numero_os_interna?: string | null
          numero_cotacao?: string | null
          forma_pagamento_id: string
          valor: number
          sku_transacao?: string | null
          data_pagamento: string
          unidade_id: string
          observacao?: string | null
          lancado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_id?: string | null
          cotacao_id?: string | null
          numero_os_samsung?: string | null
          numero_os_interna?: string | null
          numero_cotacao?: string | null
          forma_pagamento_id?: string
          valor?: number
          sku_transacao?: string | null
          data_pagamento?: string
          unidade_id?: string
          observacao?: string | null
          lancado_por?: string
          created_at?: string
          updated_at?: string
        }
      }
      financeiro_aportes: {
        Row: {
          id: string
          valor: number
          data_aporte: string
          descricao: string | null
          unidade_id: string
          lancado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          valor: number
          data_aporte: string
          descricao?: string | null
          unidade_id: string
          lancado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          valor?: number
          data_aporte?: string
          descricao?: string | null
          unidade_id?: string
          lancado_por?: string
          created_at?: string
        }
      }
      chat_conversations: {
        Row: {
          id: string
          tipo: 'direct' | 'group'
          nome: string | null
          descricao: string | null
          foto_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo: 'direct' | 'group'
          nome?: string | null
          descricao?: string | null
          foto_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo?: 'direct' | 'group'
          nome?: string | null
          descricao?: string | null
          foto_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string
          last_read_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string
          last_read_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          joined_at?: string
          last_read_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          message_type: 'text' | 'image' | 'document' | 'audio'
          file_url: string | null
          file_name: string | null
          file_size: number | null
          reply_to_message_id: string | null
          created_at: string
          edited_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string | null
          message_type?: 'text' | 'image' | 'document' | 'audio'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_message_id?: string | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string | null
          message_type?: 'text' | 'image' | 'document' | 'audio'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          reply_to_message_id?: string | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
      }
      chat_message_reads: {
        Row: {
          id: string
          message_id: string
          user_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          read_at?: string
        }
      }
      user_presence: {
        Row: {
          user_id: string
          status: 'online' | 'offline'
          last_seen_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: 'online' | 'offline'
          last_seen_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          status?: 'online' | 'offline'
          last_seen_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

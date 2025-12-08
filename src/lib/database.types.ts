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
          criado_por?: string
          created_at?: string
          updated_at?: string
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
          fechada_em: string | null
          fechada_por: string | null
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
          fechada_em?: string | null
          fechada_por?: string | null
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
          fechada_em?: string | null
          fechada_por?: string | null
          criado_por?: string
          created_at?: string
          updated_at?: string
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
          created_at?: string
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

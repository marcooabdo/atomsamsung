import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, Receipt, Building2, User, DollarSign, MapPin,
  AlertCircle, CheckCircle, Clock, ChevronDown, FileText, Loader2, Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NFConfig {
  id: string;
  nome: string;
  tipo: string;
  provedor: string | null;
  nfse_tipo_ambiente: number | null;
  nfse_codigo_tributacao_nacional: string | null;
  nfse_codigo_nbs: string | null;
  nfse_codigo_municipio_prestacao: string | null;
  nfse_descricao_servico: string | null;
  nfse_trib_issqn: number | null;
  nfse_codigo_municipio_ibge: string | null;
  codigo_servico: string | null;
  cnae: string | null;
  aliquota_iss: number;
  iss_retido: boolean;
  observacoes_padrao: string | null;
}

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
  razao_social: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
}

export interface EmitirNFSeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  osId?: string | null;
  pagamentoId?: string | null;
  unidadeId: string;
  clienteNome: string;
  clienteDocumento?: string | null;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  clienteEndereco?: string | null;
  clienteLogradouro?: string | null;
  clienteNumero?: string | null;
  clienteBairro?: string | null;
  clienteCep?: string | null;
  clienteCidadeIbge?: string | null;
  clienteMunicipio?: string | null;
  clienteUF?: string | null;
  valorServicos: number;
  descricaoServico?: string;
  existingNfId?: string | null;
}

interface FormState {
  configId: string;
  valorServicos: number;
  descricaoServico: string;
  tomadorNome: string;
  tomadorDocumento: string;
  tomadorEmail: string;
  tomadorLogradouro: string;
  tomadorNumero: string;
  tomadorBairro: string;
  tomadorCep: string;
  tomadorCidadeIbge: string;
  tomadorMunicipio: string;
  tomadorUF: string;
  ambiente: number;
  cTribNac: string;
  cNBS: string;
  cLocPrestacao: string;
  tribISSQN: number;
  tpRetISSQN: number | null;
  modoTribMun: 'vLiq' | 'pAliq';
  pAliq: number;
  cLocIncid: string;
  observacoes: string;
}

export function EmitirNFSeModal({
  isOpen,
  onClose,
  onSuccess,
  osId,
  pagamentoId,
  unidadeId,
  clienteNome,
  clienteDocumento,
  clienteTelefone,
  clienteEmail,
  clienteEndereco,
  clienteLogradouro,
  clienteNumero,
  clienteBairro,
  clienteCep,
  clienteCidadeIbge,
  clienteMunicipio,
  clienteUF,
  valorServicos,
  descricaoServico,
  existingNfId
}: EmitirNFSeModalProps) {
  const [configs, setConfigs] = useState<NFConfig[]>([]);
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);

  const [form, setForm] = useState<FormState>({
    configId: '',
    valorServicos: valorServicos || 0,
    descricaoServico: descricaoServico || '',
    tomadorNome: clienteNome || '',
    tomadorDocumento: (clienteDocumento || '').replace(/\D/g, ''),
    tomadorEmail: clienteEmail || '',
    tomadorLogradouro: clienteLogradouro || '',
    tomadorNumero: clienteNumero || '',
    tomadorBairro: clienteBairro || '',
    tomadorCep: (clienteCep || '').replace(/\D/g, ''),
    tomadorCidadeIbge: clienteCidadeIbge || '',
    tomadorMunicipio: clienteMunicipio || '',
    tomadorUF: clienteUF || '',
    ambiente: 2,
    cTribNac: '',
    cNBS: '',
    cLocPrestacao: '',
    tribISSQN: 1,
    tpRetISSQN: null,
    modoTribMun: 'vLiq',
    pAliq: 0,
    cLocIncid: '',
    observacoes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      setForm(prev => ({
        ...prev,
        valorServicos: valorServicos || 0,
        descricaoServico: descricaoServico || prev.descricaoServico,
        tomadorNome: clienteNome || '',
        tomadorDocumento: (clienteDocumento || '').replace(/\D/g, ''),
        tomadorEmail: clienteEmail || '',
        tomadorLogradouro: clienteLogradouro || prev.tomadorLogradouro,
        tomadorNumero: clienteNumero || prev.tomadorNumero,
        tomadorBairro: clienteBairro || prev.tomadorBairro,
        tomadorCep: (clienteCep || '').replace(/\D/g, ''),
        tomadorCidadeIbge: clienteCidadeIbge || prev.tomadorCidadeIbge,
        tomadorMunicipio: clienteMunicipio || prev.tomadorMunicipio,
        tomadorUF: clienteUF || prev.tomadorUF,
      }));
    }
  }, [isOpen, valorServicos, clienteNome, clienteDocumento, clienteLogradouro, clienteNumero, clienteBairro, clienteCep, clienteCidadeIbge, clienteMunicipio, clienteUF]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, unidadeRes] = await Promise.all([
        supabase
          .from('nf_configuracoes')
          .select('*')
          .eq('unidade_id', unidadeId)
          .eq('tipo', 'nfse')
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('unidades')
          .select('id, nome, cnpj, razao_social, cidade, estado, cep, rua, numero, bairro')
          .eq('id', unidadeId)
          .maybeSingle()
      ]);

      const cfgs = configsRes.data || [];
      setConfigs(cfgs);
      setUnidade(unidadeRes.data);

      if (cfgs.length > 0 && !form.configId) {
        applyConfig(cfgs[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyConfig = (config: NFConfig) => {
    setForm(prev => ({
      ...prev,
      configId: config.id,
      ambiente: config.nfse_tipo_ambiente || 2,
      cTribNac: config.nfse_codigo_tributacao_nacional || '',
      cNBS: config.nfse_codigo_nbs || '',
      cLocPrestacao: config.nfse_codigo_municipio_prestacao || '',
      tribISSQN: config.nfse_trib_issqn || 1,
      tpRetISSQN: config.iss_retido ? 1 : null,
      tomadorCidadeIbge: config.nfse_codigo_municipio_ibge || prev.tomadorCidadeIbge,
      descricaoServico: config.nfse_descricao_servico || prev.descricaoServico,
      observacoes: config.observacoes_padrao || prev.observacoes
    }));
    setShowConfigDropdown(false);
  };

  const selectedConfig = configs.find(c => c.id === form.configId);

  const buildPayload = () => {
    const now = new Date();
    const tzOffset = -3 * 60;
    const localDate = new Date(now.getTime() + (tzOffset - now.getTimezoneOffset()) * 60000);
    const dhEmi = localDate.toISOString().replace('Z', '-03:00');
    const dCompet = localDate.toISOString().split('T')[0];

    const isCpf = form.tomadorDocumento.replace(/\D/g, '').length <= 11;
    const docKey = isCpf ? 'CPF' : 'CNPJ';

    const aliquota = selectedConfig?.aliquota_iss || 0;
    const vServ = parseFloat(form.valorServicos.toFixed(2));
    const vTotTribMun = parseFloat((vServ * (aliquota / 100)).toFixed(2));
    const vLiq = parseFloat((vServ + vTotTribMun).toFixed(2));
    const pAliqEfetiva = form.pAliq > 0 ? form.pAliq : aliquota;

    const toma: any = {
      [docKey]: form.tomadorDocumento.replace(/\D/g, ''),
      xNome: form.tomadorNome,
      end: {
        xLgr: form.tomadorLogradouro || 'NAO INFORMADO',
        nro: form.tomadorNumero || 'S/N',
        xBairro: form.tomadorBairro || 'NAO INFORMADO',
        endNac: {
          cMun: form.tomadorCidadeIbge || '0000000',
          CEP: form.tomadorCep.replace(/\D/g, '') || '00000000'
        }
      }
    };

    if (form.tomadorEmail) {
      toma.email = form.tomadorEmail;
    }

    const cServObj: any = {
      cTribNac: form.cTribNac,
      xDescServ: form.descricaoServico || 'Prestacao de servicos',
    };

    if (selectedConfig?.codigo_servico) {
      cServObj.cTribMun = selectedConfig.codigo_servico;
    }

    if (form.cNBS) {
      cServObj.cNBS = form.cNBS;
    }

    const payload: any = {
      ambiente: form.ambiente === 1 ? 'producao' : 'homologacao',
      provedor: 'nacional',
      infDPS: {
        tpAmb: form.ambiente,
        dhEmi,
        dCompet,
        prest: {
          CNPJ: (unidade?.cnpj || '').replace(/\D/g, '')
        },
        toma,
        serv: {
          locPrest: {
            cLocPrestacao: form.cLocPrestacao
          },
          cServ: cServObj
        },
        valores: {
          vServPrest: {
            vServ
          },
          trib: {
            tribMun: form.modoTribMun === 'pAliq'
              ? {
                  tribISSQN: form.tribISSQN,
                  ...(form.tpRetISSQN !== null ? { tpRetISSQN: form.tpRetISSQN } : {}),
                  pAliq: pAliqEfetiva,
                  ...(form.cLocIncid ? { cLocIncid: form.cLocIncid } : {})
                }
              : {
                  tribISSQN: form.tribISSQN,
                  ...(form.tpRetISSQN !== null ? { tpRetISSQN: form.tpRetISSQN } : {}),
                  vLiq
                },
            ...(form.modoTribMun === 'vLiq' ? {
              totTrib: {
                vTotTrib: {
                  vTotTribFed: 0,
                  vTotTribEst: 0,
                  vTotTribMun
                }
              }
            } : {})
          }
        }
      }
    };

    return payload;
  };

  const handleEmitir = async () => {
    if (!form.configId) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma parametrizacao de NFS-e' });
      return;
    }
    if (form.valorServicos <= 0) {
      setMensagem({ tipo: 'error', texto: 'O valor dos servicos deve ser maior que zero' });
      return;
    }
    if (!form.tomadorDocumento) {
      setMensagem({ tipo: 'error', texto: 'Informe o CPF/CNPJ do tomador' });
      return;
    }
    if (!form.cTribNac) {
      setMensagem({ tipo: 'error', texto: 'Codigo de Tributacao Nacional (cTribNac) e obrigatorio' });
      return;
    }
    if (!form.cLocPrestacao) {
      setMensagem({ tipo: 'error', texto: 'Codigo do Municipio de Prestacao e obrigatorio' });
      return;
    }

    setEmitindo(true);
    setMensagem(null);

    try {
      const payload = buildPayload();

      const insertData: any = {
        os_id: osId || null,
        pagamento_id: pagamentoId || null,
        nf_config_id: form.configId,
        unidade_id: unidadeId,
        tipo: 'nfse',
        provedor: 'nacional',
        valor_servicos: form.valorServicos,
        valor_produtos: 0,
        valor_total: form.valorServicos,
        valor_retencoes: 0,
        base_calculo: form.valorServicos,
        status: 'pendente',
        payload_json: payload,
        tomador_nome: form.tomadorNome,
        tomador_documento: form.tomadorDocumento,
        tomador_endereco: clienteEndereco || `${form.tomadorLogradouro}, ${form.tomadorNumero}`,
        tomador_email: form.tomadorEmail || null,
        tomador_telefone: clienteTelefone || null,
        tomador_bairro: form.tomadorBairro || null,
        tomador_cidade_ibge: form.tomadorCidadeIbge || null,
        tomador_cep: form.tomadorCep || null,
        tomador_uf: form.tomadorUF || null,
        tomador_municipio: form.tomadorMunicipio || null,
        tomador_logradouro: form.tomadorLogradouro || null,
        tomador_numero: form.tomadorNumero || null,
        observacoes: form.observacoes || null,
        tentativas: 1
      };

      let nfseId: string | null = null;

      if (existingNfId) {
        const { error } = await supabase
          .from('nf_emitidas')
          .update({
            ...insertData,
            status: 'pendente',
            erro_mensagem: null,
            tentativas: supabase.rpc ? 1 : 1
          })
          .eq('id', existingNfId);

        if (error) throw error;
        nfseId = existingNfId;
        setMensagem({ tipo: 'success', texto: 'NFS-e reenviada para processamento!' });
      } else {
        const { data: inserted, error } = await supabase
          .from('nf_emitidas')
          .insert(insertData)
          .select('id')
          .single();

        if (error) throw error;
        nfseId = inserted?.id || null;
        setMensagem({ tipo: 'success', texto: 'NFS-e Nacional registrada! Aguardando processamento do servidor emissor.' });
      }

      if (nfseId) {
        try {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('emit-nfse', {
            body: { nfse_id: nfseId }
          });

          if (edgeError) {
            const errMsg = edgeError.message || 'Erro ao acionar servidor de emissao';
            setMensagem({ tipo: 'error', texto: errMsg });
            return;
          }

          if (edgeData?.error) {
            setMensagem({ tipo: 'error', texto: edgeData.error });
            return;
          }

          setMensagem({ tipo: 'success', texto: 'Emissao iniciada' });
        } catch (fetchErr: any) {
          setMensagem({ tipo: 'error', texto: fetchErr.message || 'Erro ao acionar servidor de emissao' });
          return;
        }
      }

      onSuccess?.();
      setTimeout(() => {
        onClose();
        setMensagem(null);
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao emitir NFS-e:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao emitir NFS-e' });
    } finally {
      setEmitindo(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="modal-panel w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="modal-header flex items-center justify-between p-5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)', border: '1px solid rgba(var(--accent-rgb),0.4)' }}>
              <Receipt className="w-5 h-5 text-[#00D4FF]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {existingNfId ? 'Reenviar NFS-e Nacional' : 'Emitir NFS-e Nacional'}
              </h3>
              <p className="text-xs text-gray-500">
                {osId ? `OS vinculada` : 'Emissao avulsa'}
                {form.ambiente === 2 && ' - HOMOLOGACAO'}
                {form.ambiente === 1 && ' - PRODUCAO'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/10 modal-label transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {mensagem && (
            <div className={`p-3 rounded-lg flex items-center gap-3 text-sm ${
              mensagem.tipo === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {mensagem.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{mensagem.texto}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#00D4FF] animate-spin" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma parametrizacao de NFS-e cadastrada</p>
              <p className="text-sm mt-1">Configure em Atom Core Settings &gt; Nota Fiscal</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Parametrizacao NFS-e *</label>
                <button
                  onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                  className="modal-input w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm hover:border-[#00D4FF]/50 transition-colors"
                >
                  <span>{selectedConfig?.nome || 'Selecionar parametrizacao'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showConfigDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showConfigDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 modal-panel rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {configs.map(c => (
                      <button
                        key={c.id}
                        onClick={() => applyConfig(c)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-[#00D4FF]/10 transition-colors ${
                          form.configId === c.id ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'text-gray-200'
                        }`}
                      >
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {c.provedor === 'nacional' ? 'Nacional' : 'Municipal'}
                          {c.nfse_codigo_tributacao_nacional && ` | cTribNac: ${c.nfse_codigo_tributacao_nacional}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-[#00D4FF]/5 to-transparent border border-[#00D4FF]/20">
                  <h4 className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Tomador (Cliente)
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-1">Nome *</label>
                        <input
                          type="text"
                          value={form.tomadorNome}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorNome: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CPF/CNPJ *</label>
                        <input
                          type="text"
                          value={form.tomadorDocumento}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorDocumento: e.target.value.replace(/\D/g, '') }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF] font-mono"
                          maxLength={14}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={form.tomadorEmail}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorEmail: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-1">Logradouro</label>
                        <input
                          type="text"
                          value={form.tomadorLogradouro}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorLogradouro: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Numero</label>
                        <input
                          type="text"
                          value={form.tomadorNumero}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorNumero: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Bairro</label>
                        <input
                          type="text"
                          value={form.tomadorBairro}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorBairro: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CEP</label>
                        <input
                          type="text"
                          value={form.tomadorCep}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorCep: e.target.value.replace(/\D/g, '') }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF] font-mono"
                          maxLength={8}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">UF *</label>
                        <input
                          type="text"
                          value={form.tomadorUF}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorUF: e.target.value.toUpperCase().slice(0, 2) }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF] font-mono uppercase"
                          maxLength={2}
                          placeholder="SP"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Cod. Municipio IBGE</label>
                        <input
                          type="text"
                          value={form.tomadorCidadeIbge}
                          onChange={(e) => setForm(prev => ({ ...prev, tomadorCidadeIbge: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF] font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Municipio (xMun)</label>
                      <input
                        type="text"
                        value={form.tomadorMunicipio}
                        onChange={(e) => setForm(prev => ({ ...prev, tomadorMunicipio: e.target.value }))}
                        className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#00D4FF]"
                        placeholder="Belo Horizonte"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-[#FFA500]/5 to-transparent border border-[#FFA500]/20">
                  <h4 className="text-xs font-bold text-[#FFA500] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    Prestador (Emitente)
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Razao Social:</span>
                      <span className="text-gray-200 font-medium truncate ml-2">{unidade?.razao_social || unidade?.nome || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CNPJ:</span>
                      <span className="text-gray-200 font-mono">{unidade?.cnpj || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cidade:</span>
                      <span className="text-gray-200">{unidade?.cidade || '-'} / {unidade?.estado || '-'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#FFA500]/20">
                    <h4 className="text-xs font-bold text-[#FFA500] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />
                      Dados NFS-e Nacional
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Ambiente</label>
                          <select
                            value={form.ambiente}
                            onChange={(e) => setForm(prev => ({ ...prev, ambiente: parseInt(e.target.value) }))}
                            className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500]"
                          >
                            <option value={2}>Homologacao</option>
                            <option value={1}>Producao</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">tribISSQN</label>
                          <select
                            value={form.tribISSQN}
                            onChange={(e) => setForm(prev => ({ ...prev, tribISSQN: parseInt(e.target.value) }))}
                            className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500]"
                          >
                            <option value={0}>0 - Reserva</option>
                            <option value={1}>1 - Exigivel</option>
                            <option value={2}>2 - Nao Incidencia</option>
                            <option value={3}>3 - Isencao</option>
                            <option value={4}>4 - Imunidade</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">tpRetISSQN</label>
                          <select
                            value={form.tpRetISSQN ?? ''}
                            onChange={(e) => setForm(prev => ({ ...prev, tpRetISSQN: e.target.value === '' ? null : parseInt(e.target.value) }))}
                            className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500]"
                          >
                            <option value="">Nao enviar</option>
                            <option value={1}>1 - Retencao pelo tomador</option>
                            <option value={2}>2 - Retencao pelo intermediario</option>
                            <option value={3}>3 - Retencao pelo prestador</option>
                          </select>
                        </div>
                        <div className="flex items-end pb-1">
                          <p className="text-[10px] text-gray-500 leading-relaxed">
                            ISS retido pelo tomador (alguns municipios exigem). Deixe em "Nao enviar" se o municipio nao reter ISS.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cTribNac *</label>
                          <input
                            type="text"
                            value={form.cTribNac}
                            onChange={(e) => setForm(prev => ({ ...prev, cTribNac: e.target.value }))}
                            className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500] font-mono"
                            placeholder="140101"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cNBS</label>
                          <input
                            type="text"
                            value={form.cNBS}
                            onChange={(e) => setForm(prev => ({ ...prev, cNBS: e.target.value }))}
                            className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500] font-mono"
                            placeholder="120018100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">cLocPrestacao (Cod. Municipio Prestacao) *</label>
                        <input
                          type="text"
                          value={form.cLocPrestacao}
                          onChange={(e) => setForm(prev => ({ ...prev, cLocPrestacao: e.target.value }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500] font-mono"
                          placeholder="3170206"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Modo Tributacao Municipal</label>
                        <select
                          value={form.modoTribMun}
                          onChange={(e) => setForm(prev => ({ ...prev, modoTribMun: e.target.value as 'vLiq' | 'pAliq' }))}
                          className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500]"
                        >
                          <option value="vLiq">vLiq + totTrib (ex: Uberlandia)</option>
                          <option value="pAliq">pAliq + cLocIncid (ex: Sao Paulo)</option>
                        </select>
                      </div>
                      {form.modoTribMun === 'pAliq' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">pAliq (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={form.pAliq || ''}
                              onChange={(e) => setForm(prev => ({ ...prev, pAliq: parseFloat(e.target.value) || 0 }))}
                              className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500] font-mono"
                              placeholder="5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">cLocIncid (Municipio Incidencia)</label>
                            <input
                              type="text"
                              value={form.cLocIncid}
                              onChange={(e) => setForm(prev => ({ ...prev, cLocIncid: e.target.value }))}
                              className="modal-input w-full px-3 py-2 rounded text-sm focus:outline-none focus:border-[#FFA500] font-mono"
                              placeholder="3548708"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-section p-4 rounded-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#39FF14]" />
                  Servico e Valores
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Valor do Serviço *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="number"
                        value={form.valorServicos}
                        onChange={(e) => setForm(prev => ({ ...prev, valorServicos: parseFloat(e.target.value) || 0 }))}
                        className="modal-input w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-[#39FF14] text-lg font-bold"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Descrição do Serviço</label>
                    <input
                      type="text"
                      value={form.descricaoServico}
                      onChange={(e) => setForm(prev => ({ ...prev, descricaoServico: e.target.value }))}
                      className="modal-input w-full px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#00D4FF]"
                      placeholder="Descrição do serviço prestado..."
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[10px] text-gray-500 mb-1">Observacoes</label>
                  <textarea
                    value={form.observacoes}
                    onChange={(e) => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                    className="modal-input w-full px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#00D4FF] resize-none text-sm"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.08) 0%, rgba(57,255,20,0.08) 100%)',
                  borderColor: 'rgba(var(--accent-rgb),0.3)'
                }}
              >
                <div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">Valor do Serviço:</span>
                    <span className="text-[#39FF14] font-bold text-xl">{formatCurrency(form.valorServicos)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Provedor: Nacional | Ambiente: {form.ambiente === 1 ? 'Producao' : 'Homologacao'}
                  </p>
                </div>

                <button
                  onClick={handleEmitir}
                  disabled={emitindo || form.valorServicos <= 0 || !form.configId}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.3) 0%, rgba(var(--accent-rgb),0.1) 100%)',
                    border: '2px solid rgba(var(--accent-rgb),0.7)',
                    color: 'var(--text-accent)',
                    boxShadow: '0 0 20px rgba(var(--accent-rgb),0.2)'
                  }}
                >
                  {emitindo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {existingNfId ? 'Reenviar NFS-e' : 'Emitir NFS-e'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Package, Camera, FileText, CheckCircle, User, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface OSFinalizadaModalProps {
  osId: string;
  agendamentoId: string;
  onClose: () => void;
}

interface ChecklistVinculado {
  id: string;
  checklist_template: {
    nome: string;
    descricao: string | null;
    itens: Array<{
      ordem: number;
      texto: string;
    }>;
  };
  respostas: Array<{
    ordem: number;
    texto: string;
    checked: boolean;
    updated_at?: string;
    updated_by_name?: string;
  }>;
}

interface Peca {
  id: string;
  codigo_peca: string;
  descricao: string;
  quantidade_requisitada: number;
  status: string;
  tipo_devolucao: string | null;
  estoque_pecas: {
    pn: string;
    descricao: string;
    estoque_etiquetas: Array<{
      id_sequencial: string;
      delivery: string;
    }>;
  } | null;
}

interface Anexo {
  id: string;
  tipo: string;
  nome_arquivo: string;
  url: string;
  tamanho_bytes: number;
  descricao: string | null;
  created_at: string;
}

interface OSData {
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string;
  cliente_endereco: string;
  cliente_bairro: string | null;
  cliente_cidade: string;
  tipo_atendimento: string;
  tipo_reparo: string | null;
  defeito_relatado: string | null;
}

export function OSFinalizadaModal({ osId, agendamentoId, onClose }: OSFinalizadaModalProps) {
  const [loading, setLoading] = useState(true);
  const [os, setOS] = useState<OSData | null>(null);
  const [agendamento, setAgendamento] = useState<any>(null);
  const [checklists, setChecklists] = useState<ChecklistVinculado[]>([]);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);


  useEffect(() => {
    loadOSData();
  }, [osId, agendamentoId]);

  const loadOSData = async () => {
    setLoading(true);

    // Carregar dados da OS
    const { data: osData } = await supabase
      .from('os')
      .select('numero_os_samsung, numero_os_interna, cliente_nome, cliente_endereco, cliente_bairro, cliente_cidade, tipo_atendimento, tipo_reparo, defeito_relatado')
      .eq('id', osId)
      .maybeSingle();

    if (osData) {
      setOS(osData);
    }

    // Carregar dados do agendamento
    const { data: agendamentoData } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .maybeSingle();

    if (agendamentoData) {
      setAgendamento(agendamentoData);
    }

    // Carregar checklists vinculados
    const { data: checklistsData } = await supabase
      .from('agendamento_checklist_vinculados')
      .select(`
        id,
        respostas,
        checklist_template:checklist_templates(
          id,
          nome,
          descricao,
          itens
        )
      `)
      .eq('agendamento_id', agendamentoId);

    if (checklistsData) {
      setChecklists(checklistsData as any);
    }

    // Carregar peças
    const { data: pecasData } = await supabase
      .from('requisicoes_pecas')
      .select(`
        id,
        codigo_peca,
        descricao,
        quantidade_requisitada,
        status,
        tipo_devolucao,
        estoque_pecas:peca_estoque_id (
          pn,
          descricao,
          estoque_etiquetas (
            id_sequencial,
            delivery
          )
        )
      `)
      .eq('os_id', osId)
      .in('status', ['gi_postada', 'devolvida', 'em_uso']);

    if (pecasData) {
      setPecas(pecasData as any);
    }

    // Carregar anexos
    const { data: anexosData } = await supabase
      .from('os_anexos')
      .select('id, tipo, nome_arquivo, url, tamanho_bytes, descricao, created_at')
      .eq('os_id', osId)
      .order('created_at', { ascending: true });

    if (anexosData) {
      setAnexos(anexosData);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!os || !agendamento) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-white">Erro ao carregar dados da OS</p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const numeroOS = os.numero_os_samsung || os.numero_os_interna || 'S/N';
  const enderecoCompleto = `${os.cliente_endereco}, ${os.cliente_bairro || ''}, ${os.cliente_cidade}`.trim();

  const tempoAtendimento = agendamento.checkin_hora && agendamento.checkout_hora
    ? Math.round((new Date(agendamento.checkout_hora).getTime() - new Date(agendamento.checkin_hora).getTime()) / (1000 * 60))
    : 0;

  const anexosPorTipo = {
    checkin: anexos.filter(a => a.tipo === 'checkin'),
    checkout: anexos.filter(a => a.tipo === 'checkout'),
    assinatura_tecnico: anexos.filter(a => a.tipo === 'assinatura_tecnico'),
    assinatura_cliente: anexos.filter(a => a.tipo === 'assinatura_cliente'),
    peca_nova: anexos.filter(a => a.tipo === 'peca_nova'),
    peca_velha: anexos.filter(a => a.tipo === 'peca_velha'),
    evidencias: anexos.filter(a => !['checkin', 'checkout', 'assinatura_tecnico', 'assinatura_cliente', 'peca_nova', 'peca_velha'].includes(a.tipo))
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between rounded-t-2xl">
            <div>
              <h2 className="text-xl font-bold text-white">OS #{numeroOS}</h2>
              <p className="text-gray-400 text-sm">{os.cliente_nome}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Resumo do Atendimento */}
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="text-white font-bold">Atendimento Concluído</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">Check-in</p>
                  <p className="text-white font-medium">
                    {new Date(agendamento.checkin_hora).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Check-out</p>
                  <p className="text-white font-medium">
                    {new Date(agendamento.checkout_hora).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400">Tempo de Atendimento</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <p className="text-white font-bold">{tempoAtendimento} minutos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações da OS */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Informações da OS
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-400">Endereço</p>
                  <p className="text-white">{enderecoCompleto}</p>
                </div>
                <div>
                  <p className="text-gray-400">Tipo de Atendimento</p>
                  <p className="text-white">
                    {os.tipo_atendimento === 'IH' ? `IH - ${os.tipo_reparo || ''}` : os.tipo_atendimento}
                  </p>
                </div>
                {os.defeito_relatado && (
                  <div>
                    <p className="text-gray-400">Defeito Relatado</p>
                    <p className="text-white">{os.defeito_relatado}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Checklists */}
            {checklists.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                  Checklists Técnicos
                </h3>
                <div className="space-y-3">
                  {checklists.map((checklist) => {
                    const template = checklist.checklist_template;
                    const itens = template.itens || [];
                    const respostas = checklist.respostas || [];

                    return (
                      <div key={checklist.id} className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-cyan-400 font-bold mb-2">{template.nome}</p>
                        {template.descricao && (
                          <p className="text-gray-400 text-xs mb-2">{template.descricao}</p>
                        )}
                        <div className="space-y-1">
                          {itens.map((item) => {
                            const resposta = respostas.find(r => r.ordem === item.ordem);
                            const checked = resposta?.checked || false;

                            return (
                              <div key={item.ordem} className="flex items-start gap-2 text-sm">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  checked ? 'bg-green-500 border-green-500' : 'border-gray-600'
                                }`}>
                                  {checked && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <p className={`text-white ${checked ? 'line-through opacity-70' : ''}`}>
                                  {item.texto}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Peças Utilizadas */}
            {pecas.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Peças Utilizadas
                </h3>
                <div className="space-y-2">
                  {pecas.map((peca) => {
                    const etiqueta = peca.estoque_pecas?.estoque_etiquetas?.[0];
                    const pn = peca.estoque_pecas?.pn || peca.codigo_peca;
                    const descricao = peca.estoque_pecas?.descricao || peca.descricao;

                    return (
                      <div key={peca.id} className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-white font-bold">{pn}</p>
                            <p className="text-gray-400 text-sm">{descricao}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            peca.status === 'gi_postada' ? 'bg-green-500/20 text-green-400' :
                            peca.status === 'devolvida' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {peca.status === 'gi_postada' ? 'GI Postado' :
                             peca.status === 'devolvida' ? 'Devolvida' : peca.status}
                          </span>
                        </div>
                        {etiqueta && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-cyan-400">ID: {etiqueta.id_sequencial}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-orange-400">Delivery: {etiqueta.delivery}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400">Qtd: {peca.quantidade_requisitada}</span>
                          </div>
                        )}
                        {peca.tipo_devolucao && (
                          <p className="text-gray-400 text-xs mt-1">
                            Tipo: {peca.tipo_devolucao === 'nova' ? 'Nova' :
                                   peca.tipo_devolucao === 'usada' ? 'Usada' :
                                   peca.tipo_devolucao === 'nova_com_defeito' ? 'Defeito de Fábrica' : peca.tipo_devolucao}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Evidências Fotográficas */}
            {anexosPorTipo.evidencias.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-cyan-400" />
                  Evidências Fotográficas
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {anexosPorTipo.evidencias.map((anexo) => (
                    <a
                      key={anexo.id}
                      href={anexo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-colors"
                    >
                      <img
                        src={anexo.url}
                        alt={anexo.descricao || anexo.nome_arquivo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      {anexo.descricao && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
                          <p className="text-white text-xs truncate">{anexo.descricao}</p>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Fotos de Peças */}
            {(anexosPorTipo.peca_nova.length > 0 || anexosPorTipo.peca_velha.length > 0) && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Fotos das Peças
                </h3>

                {anexosPorTipo.peca_nova.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Peças Novas</p>
                    <div className="grid grid-cols-3 gap-2">
                      {anexosPorTipo.peca_nova.map((anexo) => (
                        <a
                          key={anexo.id}
                          href={anexo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-colors"
                        >
                          <img
                            src={anexo.url}
                            alt={anexo.descricao || anexo.nome_arquivo}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {anexosPorTipo.peca_velha.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Peças Usadas</p>
                    <div className="grid grid-cols-3 gap-2">
                      {anexosPorTipo.peca_velha.map((anexo) => (
                        <a
                          key={anexo.id}
                          href={anexo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-colors"
                        >
                          <img
                            src={anexo.url}
                            alt={anexo.descricao || anexo.nome_arquivo}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assinaturas */}
            {(anexosPorTipo.assinatura_tecnico.length > 0 || anexosPorTipo.assinatura_cliente.length > 0) && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" />
                  Assinaturas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {anexosPorTipo.assinatura_tecnico.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Assinatura do Técnico</p>
                      <img
                        src={anexosPorTipo.assinatura_tecnico[0].url}
                        alt="Assinatura do Técnico"
                        className="w-full border border-gray-700 rounded-lg bg-white p-2"
                      />
                    </div>
                  )}
                  {anexosPorTipo.assinatura_cliente.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Assinatura do Cliente</p>
                      <img
                        src={anexosPorTipo.assinatura_cliente[0].url}
                        alt="Assinatura do Cliente"
                        className="w-full border border-gray-700 rounded-lg bg-white p-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 rounded-b-2xl">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

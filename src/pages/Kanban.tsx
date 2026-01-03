import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { OSModal } from '../components/OSModal';
import { OSLPModal } from '../components/OSLPModal';
import { Search, AlertCircle, Activity, Zap, Clock, Plus, Package, MapPin, Calendar, CheckCircle, DollarSign, Eye, EyeOff, RefreshCw, Copy } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { geocodeAddress } from '../lib/geocoding';

type OS = Database['public']['Tables']['os']['Row'];

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova', color: '#0EA5E9', icon: Zap },
  { id: 'diagnostico', label: 'Diagnóstico', color: '#06B6D4', icon: Activity },
  { id: 'aguardando_cotacao', label: 'Aguardando Cotação', color: '#F59E0B', icon: Clock },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: '#F97316', icon: Clock },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado', color: '#10B981', icon: Zap },
  { id: 'aguardando_peca', label: 'Aguardando Peça', color: '#8B5CF6', icon: Clock },
  { id: 'peca_em_transito', label: 'Peça em Trânsito', color: '#3B82F6', icon: Activity },
  { id: 'peca_disponivel', label: 'Peça Disponível', color: '#06B6D4', icon: Zap },
  { id: 'em_reparo_ci', label: 'Em Reparo CI', color: '#0EA5E9', icon: Activity },
  { id: 'rota_preta', label: 'Rota Preta', color: '#1a1a1a', icon: MapPin },
  { id: 'rota_vermelha', label: 'Rota Vermelha', color: '#EF4444', icon: MapPin },
  { id: 'rota_azul', label: 'Rota Azul', color: '#3B82F6', icon: MapPin },
  { id: 'rota_verde', label: 'Rota Verde', color: '#10B981', icon: MapPin },
  { id: 'rota_rosa', label: 'Rota Rosa', color: '#EC4899', icon: MapPin },
  { id: 'rota_amarela', label: 'Rota Amarela', color: '#EAB308', icon: MapPin },
  { id: 'rota_laranja', label: 'Rota Laranja', color: '#F97316', icon: MapPin },
  { id: 'em_rota_ih', label: 'Em Rota IH', color: '#10B981', icon: Activity },
  { id: 'reparo_concluido', label: 'Reparo Concluído', color: '#10B981', icon: Zap },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento', color: '#F59E0B', icon: Clock },
  { id: 'fechar_os', label: 'Fechar OS', color: '#22C55E', icon: Zap },
  { id: 'os_fechada', label: 'OS Fechada', color: '#6B7280', icon: Zap },
  { id: 'orcamentos_rejeitados', label: 'Orçamentos Rejeitados', color: '#EF4444', icon: AlertCircle }
];

export function Kanban() {
  const { user, usuario } = useAuth();
  const [osData, setOsData] = useState<Record<string, OS[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedCard, setDraggedCard] = useState<OS | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('1b9ff2d1-474e-4783-aa39-80c89a6a48cf');
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [selectedOSTipo, setSelectedOSTipo] = useState<'LP' | 'OW' | null>(null);
  const [criarOSLP, setCriarOSLP] = useState(false);
  const [mostrarInfoFinanceira, setMostrarInfoFinanceira] = useState(true);
  const [mostrarStatusSamsung, setMostrarStatusSamsung] = useState(false);
  const [syncingSamsung, setSyncingSamsung] = useState(false);
  const autoScrollInterval = useRef<number | null>(null);

  const getTextColor = (colunaId: string, originalColor: string) => {
    if (colunaId === 'rota_preta') {
      return '#ffffff';
    }
    return originalColor;
  };

  useEffect(() => {
    loadUnidades();
  }, []);

  
  useEffect(() => {
    console.log('🔄 Recarregando Kanban - selectedUnidade:', selectedUnidade || 'NENHUMA');
    if (usuario) {
      loadKanbanData();
    }
  }, [usuario, selectedUnidade]);

  useEffect(() => {
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, []);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const syncSamsungGSPN = async () => {
    if (!selectedUnidade) {
      alert('Selecione uma unidade para atualizar');
      return;
    }

    setSyncingSamsung(true);
    try {
      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('nome, samsung_asccode, samsung_token')
        .eq('id', selectedUnidade)
        .single();

      if (!unidadeData) {
        alert('Unidade não encontrada');
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        alert('Unidade sem configuração Samsung (ASC Code ou Token não configurados)');
        return;
      }

      const response = await fetch('https://groupglobal.app.n8n.cloud/webhook/atualizar-os', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ascCode: unidadeData.samsung_asccode,
          tokenApi: unidadeData.samsung_token,
          filial: unidadeData.nome.toLowerCase(),
          unidade_id: selectedUnidade
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        alert(`Atualização concluída com sucesso!\n\n${result.message}\nFilial: ${result.filial}`);
        await loadKanbanData();
      } else {
        alert(`Erro na atualização: ${result.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar OS:', error);
      alert(`Erro ao atualizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncingSamsung(false);
    }
  };

  const calcularValorPecas = (os: any) => {
    if (!os.requisicoes || os.requisicoes.length === 0) return 0;
    return os.requisicoes.reduce((total: number, req: any) => {
      const preco = req.valor_peca || 0;
      return total + preco;
    }, 0);
  };

  const calcularValorGSPN = (os: any) => {
    if (!os.cotacao_pecas || os.cotacao_pecas.length === 0) return 0;
    return os.cotacao_pecas.reduce((total: number, peca: any) => {
      const valorBase = peca.valor_base_gspn || 0;
      const quantidade = peca.quantidade || 1;
      return total + (valorBase * quantidade);
    }, 0);
  };

  const calcularLucro = (os: any) => {
    if (os.tipo_os !== 'OW') return null;
    const valorTotal = os.valor_total || 0;
    const valorGSPN = calcularValorGSPN(os);
    return valorTotal - valorGSPN;
  };

  const loadKanbanData = async () => {
    try {
      let query = supabase
        .from('os')
        .select(`
          *,
          cotacao:cotacoes!os_cotacao_id_fkey(
            numero_cotacao,
            taxa_para_cliente
          ),
          cotacao_pecas:cotacoes_pecas(
            valor_base_gspn,
            quantidade
          ),
          requisicoes:requisicoes_pecas(
            id,
            status,
            descricao,
            codigo_peca,
            observacoes_pedido,
            valor_peca,
            numero_pedido_samsung,
            created_at,
            peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
              delivery,
              pn,
              estoque_etiquetas(
                id_sequencial,
                delivery
              )
            )
          ),
          unidade:unidades!os_unidade_id_fkey(nome),
          tecnico_agendado:usuarios!os_tecnico_agendado_id_fkey(nome)
        `);

      // Verificar se o usuário pode ver todas as unidades
      const canSelectAllUnits = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';

      // Se o usuário selecionou uma unidade específica no filtro, use essa
      if (selectedUnidade) {
        console.log('🔍 Filtrando por unidade selecionada:', selectedUnidade);
        query = query.eq('unidade_id', selectedUnidade);
      }
      // Se não selecionou e não pode ver todas, usa a unidade do usuário
      else if (!canSelectAllUnits && usuario?.unidade_id) {
        console.log('🔍 Filtrando por unidade do usuário:', usuario.unidade_id);
        query = query.eq('unidade_id', usuario.unidade_id);
      }
      // Se pode ver todas e não selecionou, mostra todas
      else {
        console.log('🔍 Mostrando todas as unidades (usuário master/diretoria)');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      console.log('📦 Total de OSs carregadas:', data?.length || 0);

      // Debug: Mostrar unidades das OSs carregadas
      if (data && data.length > 0) {
        const unidadesUnicas = [...new Set(data.map(os => os.unidade?.nome || 'Sem unidade'))];
        console.log('🏢 Unidades presentes nas OSs:', unidadesUnicas.join(', '));
        data.forEach(os => {
          console.log(`  - OS ${os.numero_os_interna || os.numero_os_samsung || os.id.slice(0,8)}: ${os.unidade?.nome || 'Sem unidade'}`);
        });
      }

      const grouped = COLUNAS_KANBAN.reduce((acc, coluna) => {
        acc[coluna.id] = (data || []).filter(os => os.coluna_kanban === coluna.id);
        return acc;
      }, {} as Record<string, OS[]>);

      console.log('📋 OS agrupadas por coluna:', Object.entries(grouped).map(([col, oss]) => `${col}: ${oss.length}`).join(', '));

      setOsData(grouped);
    } catch (error) {
      console.error('Erro ao carregar dados do Kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, os: OS) => {
    setDraggedCard(os);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (!draggedCard) return;

    const kanbanContainer = e.currentTarget;
    const rect = kanbanContainer.getBoundingClientRect();
    const scrollThreshold = 80;
    const scrollSpeed = 7;
    const mouseX = e.clientX - rect.left;

    const isInLeftZone = mouseX < scrollThreshold && mouseX >= 0;
    const isInRightZone = mouseX > rect.width - scrollThreshold && mouseX <= rect.width;

    if (!isInLeftZone && !isInRightZone) {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
      return;
    }

    if (!autoScrollInterval.current) {
      if (isInLeftZone) {
        autoScrollInterval.current = window.setInterval(() => {
          if (kanbanContainer.scrollLeft > 0) {
            kanbanContainer.scrollLeft -= scrollSpeed;
          }
        }, 30);
      } else if (isInRightZone) {
        autoScrollInterval.current = window.setInterval(() => {
          if (kanbanContainer.scrollLeft < kanbanContainer.scrollWidth - kanbanContainer.clientWidth) {
            kanbanContainer.scrollLeft += scrollSpeed;
          }
        }, 30);
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleContainerDragLeave = () => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  const handleDragEnd = () => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  const criarAgendamentoParaRota = async (os: OS) => {
    try {
      // Verificar se já existe agendamento para esta OS
      const { data: agendamentoExistente } = await supabase
        .from('agendamentos')
        .select('id, lat, lng')
        .eq('os_id', os.id)
        .maybeSingle();

      // Se já tem agendamento com coordenadas, não precisa criar novo
      if (agendamentoExistente?.lat && agendamentoExistente?.lng) {
        console.log('Agendamento já existe com coordenadas:', agendamentoExistente);
        return;
      }

      // Buscar informações da unidade para data/hora padrão
      const { data: config } = await supabase
        .from('configuracoes_unidade')
        .select('horario_inicio, horario_fim')
        .eq('unidade_id', os.unidade_id)
        .maybeSingle();

      // Montar endereço completo
      const enderecoCompleto = `${os.cliente_endereco || ''}, ${os.cliente_bairro || ''}, ${os.cliente_cidade || ''}, ${os.cliente_estado || 'SP'}, Brasil`.trim();

      console.log('Geocodificando endereço:', enderecoCompleto);

      // Geocodificar endereço
      const coords = await geocodeAddress(enderecoCompleto);

      if (!coords) {
        console.warn('Não foi possível geocodificar o endereço:', enderecoCompleto);
        // Criar agendamento sem coordenadas
        if (!agendamentoExistente) {
          await supabase
            .from('agendamentos')
            .insert({
              os_id: os.id,
              tecnico_id: os.tecnico_id || usuario?.id,
              data_agendamento: new Date().toISOString().split('T')[0],
              horario_inicio: config?.horario_inicio || '08:00',
              horario_fim: config?.horario_fim || '18:00',
              status: 'pendente_confirmacao',
              agendado_por: usuario?.id
            });
        }
        return;
      }

      console.log('Coordenadas obtidas:', coords);

      // Criar ou atualizar agendamento com coordenadas
      if (agendamentoExistente) {
        await supabase
          .from('agendamentos')
          .update({
            lat: coords.lat,
            lng: coords.lng
          })
          .eq('id', agendamentoExistente.id);
      } else {
        await supabase
          .from('agendamentos')
          .insert({
            os_id: os.id,
            tecnico_id: os.tecnico_id || usuario?.id,
            data_agendamento: new Date().toISOString().split('T')[0],
            horario_inicio: config?.horario_inicio || '08:00',
            horario_fim: config?.horario_fim || '18:00',
            status: 'pendente_confirmacao',
            agendado_por: usuario?.id,
            lat: coords.lat,
            lng: coords.lng
          });
      }

      console.log('Agendamento criado/atualizado com sucesso para OS:', os.numero_os_samsung || os.numero_os_interna);
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    if (!draggedCard || draggedCard.coluna_kanban === targetColumn) {
      setDraggedCard(null);
      return;
    }

    const colunaOrigem = COLUNAS_KANBAN.find(c => c.id === draggedCard.coluna_kanban);
    const colunaDestino = COLUNAS_KANBAN.find(c => c.id === targetColumn);

    const rotasIds = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
    const isOrigemAguardandoPeca = draggedCard.coluna_kanban === 'aguardando_peca';
    const isDestinoRota = rotasIds.includes(targetColumn);

    if (isOrigemAguardandoPeca && isDestinoRota) {
      const confirmacao = window.confirm(
        `Você está movendo uma OS de "Aguardando Peça" para "${colunaDestino?.label}".\n\n` +
        `Deseja continuar?`
      );

      if (!confirmacao) {
        setDraggedCard(null);
        return;
      }
    }

    try {
      const { data: requisicoes } = await supabase
        .from('requisicoes_pecas')
        .select('id, status, codigo_peca, descricao, numero_pedido_samsung')
        .eq('os_id', draggedCard.id);

      // Verificar peças em processo ativo que realmente bloqueiam movimentação
      // Status que NÃO bloqueiam: 'pendente', 'reprovada', 'devolvida', 'cancelada'
      // (estes permitem criar nova requisição ou já foram finalizados)
      const pecasAtivas = requisicoes?.filter(r =>
        ['atendida', 'em_uso', 'gi_postada', 'pedido_feito'].includes(r.status)
      ) || [];

      // Colunas permitidas mesmo com peças ativas (relacionadas ao fluxo de peças e rotas)
      const colunasPermitidas = [
        'peca_em_transito',
        'peca_disponivel',
        'aguardando_peca',
        'rota_preta',
        'rota_vermelha',
        'rota_azul',
        'rota_verde',
        'rota_rosa',
        'rota_amarela',
        'rota_laranja',
        'em_rota_ih',
        'reparo_concluido',
        'em_reparo_ci',
        'aguardando_fechamento',
        'fechar_os'
      ];

      // IMPORTANTE: Se não há peças ativas, permite mover para qualquer coluna
      // (incluindo voltar para cotações/orcamentos_rejeitados)
      if (pecasAtivas.length > 0 && !colunasPermitidas.includes(targetColumn)) {
        const statusLabels: Record<string, string> = {
          pedido_feito: '🚚 Pedido Ativo',
          atendida: '✅ Peça Atendida',
          em_uso: '🔧 Em Uso',
          gi_postada: '📦 GI Pendente'
        };

        const listaPecas = pecasAtivas
          .map(p => {
            const statusLabel = statusLabels[p.status] || p.status;
            return `• ${p.codigo_peca || 'N/A'} - ${statusLabel}${p.numero_pedido_samsung ? ` (Pedido #${p.numero_pedido_samsung})` : ''}`;
          })
          .join('\n');

        alert(
          `⚠️ MOVIMENTAÇÃO BLOQUEADA\n\n` +
          `Esta OS possui ${pecasAtivas.length} peça(s) em processo ativo:\n\n${listaPecas}\n\n` +
          `Para desbloquear:\n` +
          `• Pedido Ativo: Cancele em Estoque → Transferências\n` +
          `• Peça Atendida: Técnico deve postar GI ou devolver\n` +
          `• Em Uso: Técnico deve postar GI ou devolver\n` +
          `• GI Pendente: Estoque deve aprovar/reprovar em Devoluções\n\n` +
          `Ou mova para:\n` +
          `• Rotas (Preta, Vermelha, Azul, Verde, Rosa, Amarela, Laranja)\n` +
          `• Em Rota IH, Reparo Concluído, Em Reparo CI\n` +
          `• Aguardando Peça, Peça em Trânsito, Peça Disponível\n` +
          `• Aguardando Fechamento, Fechar OS`
        );
        setDraggedCard(null);
        return;
      }

      const { error, data } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          updated_at: new Date().toISOString()
        })
        .eq('id', draggedCard.id)
        .select();

      if (error) {
        console.error('Erro detalhado ao atualizar OS:', {
          error,
          osId: draggedCard.id,
          fromColumn: draggedCard.coluna_kanban,
          toColumn: targetColumn
        });
        throw error;
      }

      console.log('OS movida com sucesso:', data);

      // Se moveu para uma rota, criar agendamento com geocodificação
      const rotasColumns = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
      if (rotasColumns.includes(targetColumn)) {
        await criarAgendamentoParaRota(draggedCard);
      }

      setOsData(prevData => {
        const newData = { ...prevData };
        newData[draggedCard.coluna_kanban] = newData[draggedCard.coluna_kanban].filter(os => os.id !== draggedCard.id);
        newData[targetColumn] = [...(newData[targetColumn] || []), { ...draggedCard, coluna_kanban: targetColumn }];
        return newData;
      });
    } catch (error: any) {
      console.error('Erro ao mover card:', error);
      const errorMessage = error?.message || error?.error_description || error?.hint || 'Erro desconhecido';
      alert(`❌ Erro ao mover OS:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);
    } finally {
      setDraggedCard(null);
    }
  };

  const filteredData = Object.keys(osData).reduce((acc, coluna) => {
    acc[coluna] = osData[coluna].filter(os =>
      os.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (os.numero_os_samsung && os.numero_os_samsung.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (os.numero_os_interna && os.numero_os_interna.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    return acc;
  }, {} as Record<string, OS[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const handleUnidadeChange = (unidadeId: string) => {
    console.log('🎯 Usuário mudou filtro de unidade para:', unidadeId || 'TODAS');
    setSelectedUnidade(unidadeId);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-3 overflow-hidden">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={handleUnidadeChange}
      />

      <div className="premium-card p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,245,255,0.05) 100%)',
              border: '1px solid rgba(0,212,255,0.3)',
              boxShadow: '0 0 20px rgba(0,212,255,0.1)'
            }}>
              <Activity className="w-4 h-4 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 4px #00D4FF)' }} />
              <h3 className="tech-heading text-sm text-[#00D4FF] tracking-widest">KANBAN</h3>
            </div>
          </div>

          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00D4FF]/50" />
            <input
              type="text"
              placeholder="Buscar OS, Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="neon-input pl-10 text-xs py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMostrarInfoFinanceira(!mostrarInfoFinanceira)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300"
              style={{
                background: mostrarInfoFinanceira
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 100%)'
                  : 'rgba(107,114,128,0.1)',
                border: `1px solid ${mostrarInfoFinanceira ? '#00D4FF' : '#6B7280'}`,
                color: mostrarInfoFinanceira ? '#00D4FF' : '#6B7280',
                boxShadow: mostrarInfoFinanceira ? '0 0 10px rgba(0,212,255,0.2)' : 'none'
              }}
            >
              {mostrarInfoFinanceira ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              FINANCEIRO
            </button>

            <button
              onClick={() => setMostrarStatusSamsung(!mostrarStatusSamsung)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300"
              style={{
                background: mostrarStatusSamsung
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 100%)'
                  : 'rgba(107,114,128,0.1)',
                border: `1px solid ${mostrarStatusSamsung ? '#8B5CF6' : '#6B7280'}`,
                color: mostrarStatusSamsung ? '#8B5CF6' : '#6B7280',
                boxShadow: mostrarStatusSamsung ? '0 0 10px rgba(139,92,246,0.2)' : 'none'
              }}
            >
              {mostrarStatusSamsung ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              STATUS
            </button>

            <button
              onClick={() => setCriarOSLP(true)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(255,165,0,0.2) 0%, rgba(255,165,0,0.05) 100%)',
                border: '1px solid #FFA500',
                color: '#FFA500',
                boxShadow: '0 0 10px rgba(255,165,0,0.2)'
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              CRIAR LP
            </button>

            <button
              onClick={syncSamsungGSPN}
              disabled={syncingSamsung || !selectedUnidade}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,245,255,0.05) 100%)',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
                boxShadow: '0 0 10px rgba(0,212,255,0.2)'
              }}
              title={!selectedUnidade ? 'Selecione uma unidade para atualizar' : 'Atualizar OS da Samsung'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSamsung ? 'animate-spin' : ''}`} />
              {syncingSamsung ? 'SINCRONIZANDO...' : 'ATUALIZAR'}
            </button>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden cyber-scrollbar"
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
        >
          <div className="flex gap-3 h-full pb-3" style={{ minWidth: 'max-content', maxHeight: '100%' }}>
            {COLUNAS_KANBAN.map((coluna) => {
              const ColumnIcon = coluna.icon;
              const isOver = dragOverColumn === coluna.id;

              return (
                <div
                  key={coluna.id}
                  className={`flex-shrink-0 w-72 h-full max-h-full rounded-xl transition-all duration-300 overflow-hidden ${
                    isOver ? 'scale-[1.02]' : ''
                  }`}
                  style={{
                    background: `linear-gradient(180deg, ${coluna.color}08 0%, rgba(0,0,0,0.3) 100%)`,
                    border: `1px solid ${isOver ? coluna.color : coluna.color + '30'}`,
                    boxShadow: isOver
                      ? `0 0 40px ${coluna.color}40, inset 0 0 30px ${coluna.color}10`
                      : `0 0 15px ${coluna.color}15, inset 0 1px 1px ${coluna.color}05`
                  }}
                  onDragOver={(e) => handleDragOver(e, coluna.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, coluna.id)}
                >
                  <div className="flex flex-col h-full min-h-0">
                    <div className="sticky top-0 z-10 flex items-center justify-between mb-3 pb-2 border-b flex-shrink-0 px-3 pt-3"
                      style={{
                        borderColor: `${getTextColor(coluna.id, coluna.color)}30`,
                        background: `linear-gradient(180deg, ${coluna.color}15 0%, ${coluna.color}08 100%)`,
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-lg" style={{
                          backgroundColor: `${coluna.color}15`,
                          border: `1px solid ${getTextColor(coluna.id, coluna.color)}40`,
                          boxShadow: `0 0 10px ${coluna.color}20`
                        }}>
                          <ColumnIcon
                            className="w-3.5 h-3.5"
                            style={{
                              color: getTextColor(coluna.id, coluna.color),
                              filter: `drop-shadow(0 0 6px ${getTextColor(coluna.id, coluna.color)})`
                            }}
                          />
                        </div>
                        <h4 className="font-bold text-xs uppercase tracking-wider"
                          style={{
                            color: getTextColor(coluna.id, coluna.color),
                            textShadow: `0 0 10px ${getTextColor(coluna.id, coluna.color)}60`
                          }}
                        >
                          {coluna.label}
                        </h4>
                      </div>
                      <div
                        className="px-2 py-0.5 rounded-md text-xs font-bold min-w-[28px] text-center"
                        style={{
                          background: `linear-gradient(135deg, ${coluna.color}25 0%, ${coluna.color}10 100%)`,
                          color: getTextColor(coluna.id, coluna.color),
                          border: `1px solid ${getTextColor(coluna.id, coluna.color)}50`,
                          boxShadow: `0 0 15px ${coluna.color}25, inset 0 1px 1px ${coluna.color}20`
                        }}
                      >
                        {filteredData[coluna.id]?.length || 0}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 cyber-scrollbar px-3 pb-3">
                      {filteredData[coluna.id]?.map((os) => (
                        <div
                          key={os.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, os)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            setSelectedOSId(os.id);
                            setSelectedOSTipo(os.tipo_os as 'LP' | 'OW');
                          }}
                          className="rounded-lg p-2.5 cursor-pointer group relative overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.3) 100%)',
                            border: `1px solid ${getTextColor(coluna.id, coluna.color)}25`,
                            boxShadow: `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)`,
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = `${getTextColor(coluna.id, coluna.color)}60`;
                            e.currentTarget.style.boxShadow = `0 4px 16px ${coluna.color}30, inset 0 1px 1px rgba(255,255,255,0.1)`;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = `${getTextColor(coluna.id, coluna.color)}25`;
                            e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)`;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div className="absolute top-0 left-0 w-full h-0.5" style={{
                            background: `linear-gradient(90deg, ${coluna.color} 0%, transparent 100%)`,
                            opacity: 0.5
                          }}></div>

                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <h5 className="font-bold text-xs text-white truncate" style={{
                                  textShadow: '0 0 8px rgba(0,212,255,0.5)'
                                }}>
                                  {os.numero_os_samsung || os.cliente_nome}
                                </h5>
                                {os.numero_os_samsung && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(os.numero_os_samsung);
                                      const btn = e.currentTarget;
                                      const originalHTML = btn.innerHTML;
                                      btn.innerHTML = '<span style="color: #39FF14;">✓</span>';
                                      setTimeout(() => {
                                        btn.innerHTML = originalHTML;
                                      }, 1000);
                                    }}
                                    className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                                    title="Copiar número da OS"
                                  >
                                    <Copy className="w-3 h-3 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 4px #00D4FF)' }} />
                                  </button>
                                )}
                                {os.tipo_os === 'OW' && os.tipo_orcamento === 'samsung_contigo' && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(255,165,0,0.3) 0%, rgba(255,165,0,0.15) 100%)',
                                      color: '#FFA500',
                                      border: '1px solid rgba(255,165,0,0.5)',
                                      boxShadow: '0 0 8px rgba(255,165,0,0.3)'
                                    }}
                                    title="Samsung Contigo"
                                  >
                                    SC
                                  </span>
                                )}
                              </div>
                              {os.numero_os_samsung && (
                                <p className="text-[10px] text-gray-500 truncate">{os.cliente_nome}</p>
                              )}
                            </div>
                            {os.alerta_divergencia_gspn && (
                              <div className="p-1 rounded-md flex-shrink-0" style={{
                                backgroundColor: 'rgba(255,0,100,0.15)',
                                border: '1px solid rgba(255,0,100,0.4)'
                              }}>
                                <AlertCircle
                                  className="w-3 h-3 text-[#FF0064]"
                                  style={{ filter: 'drop-shadow(0 0 4px rgba(255, 0, 100, 0.8))' }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{
                                  background: os.tipo_atendimento === 'IH'
                                    ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.1) 100%)'
                                    : 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.1) 100%)',
                                  color: os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316',
                                  border: `1px solid ${os.tipo_atendimento === 'IH' ? 'rgba(16,185,129,0.5)' : 'rgba(249,115,22,0.5)'}`,
                                  boxShadow: `0 0 8px ${os.tipo_atendimento === 'IH' ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.2)'}`
                                }}
                              >
                                {os.tipo_atendimento}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{
                                  background: os.tipo_os === 'LP'
                                    ? 'linear-gradient(135deg, rgba(255,165,0,0.25) 0%, rgba(255,165,0,0.1) 100%)'
                                    : 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(0,212,255,0.1) 100%)',
                                  color: os.tipo_os === 'LP' ? '#FFA500' : '#00D4FF',
                                  border: `1px solid ${os.tipo_os === 'LP' ? 'rgba(255,165,0,0.5)' : 'rgba(0,212,255,0.5)'}`,
                                  boxShadow: `0 0 8px ${os.tipo_os === 'LP' ? 'rgba(255,165,0,0.2)' : 'rgba(0,212,255,0.2)'}`
                                }}
                              >
                                {os.tipo_os}
                              </span>
                            </div>

                            {mostrarStatusSamsung && os.numero_os_samsung && ((os as any).status_samsung_desc || (os as any).status_samsung_reason) && (
                              <div className="mt-1.5 rounded-md p-1.5"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.03) 100%)',
                                  border: '1px solid rgba(139,92,246,0.3)',
                                  boxShadow: '0 0 10px rgba(139,92,246,0.1)'
                                }}
                              >
                                <div className="text-[9px] space-y-1">
                                  {(os as any).status_samsung_desc && (
                                    <>
                                      <span className="text-[#8B5CF6] font-bold block">Status:</span>
                                      <span className="text-gray-200 font-medium block">{(os as any).status_samsung_desc}</span>
                                    </>
                                  )}
                                  {(os as any).status_samsung_reason && (
                                    <>
                                      <span className="text-[#8B5CF6] font-bold block mt-1">Motivo:</span>
                                      <span className="text-gray-200 font-medium block">{(os as any).status_samsung_reason}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {(() => {
                              const pecasEmTransito = (os as any).requisicoes?.filter((req: any) =>
                                req.status === 'pedido_feito'
                              ) || [];

                              if (pecasEmTransito.length === 0) return null;

                              return (
                                <div className="mt-1.5 rounded-md p-1.5 space-y-1"
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,212,255,0.03) 100%)',
                                    border: '1px solid rgba(0,212,255,0.3)',
                                    boxShadow: '0 0 10px rgba(0,212,255,0.1)'
                                  }}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Package className="w-3 h-3 text-[#00D4FF] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #00D4FF)' }} />
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.15) 100%)',
                                        color: '#00D4FF',
                                        border: '1px solid rgba(0,212,255,0.5)'
                                      }}
                                    >
                                      {pecasEmTransito.length} PEÇA{pecasEmTransito.length > 1 ? 'S' : ''} EM TRÂNSITO
                                    </span>
                                  </div>
                                  {pecasEmTransito.map((req: any) => {
                                    const diasDesdeRequisicao = Math.floor(
                                      (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24)
                                    );

                                    return (
                                      <div key={req.id} className="text-[9px] space-y-0.5 pl-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-300 truncate flex-1 pr-1">{req.codigo_peca}</span>
                                          <span className="text-[#FFBF00] font-bold flex-shrink-0">{diasDesdeRequisicao}d</span>
                                        </div>
                                        {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                                          <div className="text-[#00D4FF] font-mono truncate">
                                            Pedido: {req.numero_pedido_samsung}
                                          </div>
                                        )}
                                        {req.peca_estoque?.delivery && (
                                          <div className="text-[#39FF14] font-mono truncate">
                                            Delivery: {req.peca_estoque.delivery}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {os.data_agendamento && os.tecnico_agendado_id && os.confirmado_com_cliente && (
                              <div className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
                                style={{
                                  borderColor: 'rgba(57,255,20,0.3)',
                                  background: 'linear-gradient(135deg, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.03) 100%)',
                                  boxShadow: '0 0 10px rgba(57,255,20,0.1)'
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-[#39FF14] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #39FF14)' }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                        style={{
                                          background: 'linear-gradient(135deg, rgba(57,255,20,0.3) 0%, rgba(57,255,20,0.15) 100%)',
                                          color: '#39FF14',
                                          border: '1px solid rgba(57,255,20,0.5)'
                                        }}
                                      >
                                        AGENDADO
                                      </span>
                                      <CheckCircle className="w-2.5 h-2.5 text-[#39FF14]" />
                                    </div>
                                    <p className="text-[10px] text-gray-300 font-medium">
                                      {new Date(os.data_agendamento).toLocaleDateString('pt-BR')}
                                    </p>
                                    {(os as any).tecnico_agendado?.nome && (
                                      <p className="text-[9px] text-gray-500 truncate">{(os as any).tecnico_agendado.nome}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {mostrarInfoFinanceira && os.valor_total && os.valor_total > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
                                style={{
                                  borderColor: os.status_pagamento === 'pago' ? 'rgba(57,255,20,0.3)' :
                                               os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.3)' : 'rgba(255,0,100,0.3)',
                                  background: os.status_pagamento === 'pago' ? 'linear-gradient(135deg, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.03) 100%)' :
                                                   os.status_pagamento === 'parcial' ? 'linear-gradient(135deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.03) 100%)' : 'linear-gradient(135deg, rgba(255,0,100,0.1) 0%, rgba(255,0,100,0.03) 100%)',
                                  boxShadow: `0 0 10px ${os.status_pagamento === 'pago' ? 'rgba(57,255,20,0.1)' : os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.1)' : 'rgba(255,0,100,0.1)'}`
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="w-3 h-3 flex-shrink-0"
                                    style={{
                                      color: os.status_pagamento === 'pago' ? '#39FF14' :
                                             os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064',
                                      filter: `drop-shadow(0 0 4px ${os.status_pagamento === 'pago' ? '#39FF14' : os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064'})`
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-1"
                                      style={{
                                        background: os.status_pagamento === 'pago' ? 'linear-gradient(135deg, rgba(57,255,20,0.3) 0%, rgba(57,255,20,0.15) 100%)' :
                                                           os.status_pagamento === 'parcial' ? 'linear-gradient(135deg, rgba(255,191,0,0.3) 0%, rgba(255,191,0,0.15) 100%)' : 'linear-gradient(135deg, rgba(255,0,100,0.3) 0%, rgba(255,0,100,0.15) 100%)',
                                        color: os.status_pagamento === 'pago' ? '#39FF14' :
                                               os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064',
                                        border: `1px solid ${os.status_pagamento === 'pago' ? 'rgba(57,255,20,0.5)' :
                                                              os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.5)' : 'rgba(255,0,100,0.5)'}`
                                      }}
                                    >
                                      {os.status_pagamento === 'pago' ? 'PAGO' :
                                       os.status_pagamento === 'parcial' ? 'PARCIAL' : 'PENDENTE'}
                                    </span>
                                    <div className="text-[10px] space-y-0.5">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Total:</span>
                                        <span className="text-white font-mono font-bold">R$ {(os.valor_total || 0).toFixed(2)}</span>
                                      </div>
                                      {os.valor_pago > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-500">Pago:</span>
                                          <span className="text-[#39FF14] font-mono">R$ {(os.valor_pago || 0).toFixed(2)}</span>
                                        </div>
                                      )}
                                      {os.saldo_restante > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-500">Saldo:</span>
                                          <span className="text-[#FFBF00] font-mono">R$ {(os.saldo_restante || 0).toFixed(2)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {mostrarInfoFinanceira && (() => {
                              const valorPecas = calcularValorPecas(os);
                              const valorGSPN = calcularValorGSPN(os);
                              const lucro = calcularLucro(os);
                              const valorTotal = os.valor_total;

                              if (!valorPecas && !valorGSPN && !valorTotal) return null;

                              return (
                                <div className="space-y-1 mt-1.5 pt-1.5 border-t" style={{ borderColor: `${getTextColor(coluna.id, coluna.color)}20` }}>
                                  {valorPecas > 0 && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-[10px] font-bold" style={{
                                        color: '#00D4FF',
                                        textShadow: '0 0 6px rgba(0,212,255,0.5)'
                                      }}>PEÇAS:</span>
                                      <span className="font-mono text-white text-[10px] font-bold">
                                        R$ {valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                  {valorGSPN > 0 && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-[10px] font-bold" style={{
                                        color: '#FFA500',
                                        textShadow: '0 0 6px rgba(255,165,0,0.5)'
                                      }}>GSPN:</span>
                                      <span className="font-mono text-[#FFA500] text-[10px] font-bold">
                                        R$ {valorGSPN.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                  {os.tipo_os === 'OW' && valorTotal && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-[10px] font-bold" style={{
                                        color: '#00F5FF',
                                        textShadow: '0 0 6px rgba(0,245,255,0.5)'
                                      }}>ORÇAM:</span>
                                      <span className="font-mono text-[#00F5FF] text-[10px] font-bold">
                                        R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                  {os.tipo_os === 'OW' && lucro !== null && valorTotal > 0 && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-[10px] font-bold" style={{
                                        color: lucro >= 0 ? '#39FF14' : '#FF0064',
                                        textShadow: `0 0 6px ${lucro >= 0 ? 'rgba(57,255,20,0.5)' : 'rgba(255,0,100,0.5)'}`
                                      }}>LUCRO:</span>
                                      <span className={`font-mono text-[10px] font-bold ${lucro >= 0 ? 'text-[#39FF14]' : 'text-[#FF0064]'}`}>
                                        R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {os.dias_na_etapa > 0 && (
                              <div
                                className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t"
                                style={{ borderColor: `${getTextColor(coluna.id, coluna.color)}20` }}
                              >
                                <Clock className="w-3 h-3 text-[#FFBF00]" style={{ filter: 'drop-shadow(0 0 4px #FFBF00)' }} />
                                <span className="text-[#FFBF00] font-bold text-[10px]">
                                  SLA: {os.dias_na_etapa}d
                                </span>
                              </div>
                            )}
                            {(os as any).requisicoes?.filter((r: any) => r.status === 'pedido_feito').map((req: any) => (
                              <div
                                key={req.id}
                                className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
                                style={{
                                  borderColor: 'rgba(255,191,0,0.3)',
                                  background: 'linear-gradient(135deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.03) 100%)',
                                  boxShadow: '0 0 10px rgba(255,191,0,0.1)'
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Package className="w-3 h-3 text-[#FFBF00] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #FFBF00)' }} />
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-0.5"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(255,191,0,0.3) 0%, rgba(255,191,0,0.15) 100%)',
                                        color: '#FFBF00',
                                        border: '1px solid rgba(255,191,0,0.5)'
                                      }}
                                    >
                                      PEDIDO ATIVO
                                    </span>
                                    <p className="text-[10px] text-gray-300 font-medium truncate">{req.peca_estoque?.pn || req.codigo_peca}</p>
                                    <p className="text-[9px] text-gray-400 truncate">{req.descricao}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {req.peca_estoque?.estoque_etiquetas?.[0]?.id_sequencial && (
                                        <>
                                          <span className="text-[8px] text-cyan-400">ID: {req.peca_estoque.estoque_etiquetas[0].id_sequencial}</span>
                                          <span className="text-gray-600">•</span>
                                        </>
                                      )}
                                      {req.peca_estoque?.estoque_etiquetas?.[0]?.delivery && (
                                        <span className="text-[8px] text-orange-400">Delivery: {req.peca_estoque.estoque_etiquetas[0].delivery}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {(os as any).requisicoes?.filter((r: any) => ['atendida', 'em_uso', 'gi_postada'].includes(r.status)).map((req: any) => (
                              <div
                                key={req.id}
                                className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
                                style={{
                                  borderColor: 'rgba(57,255,20,0.3)',
                                  background: 'linear-gradient(135deg, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.03) 100%)',
                                  boxShadow: '0 0 10px rgba(57,255,20,0.1)'
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Package className="w-3 h-3 text-[#39FF14] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #39FF14)' }} />
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-0.5"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(57,255,20,0.3) 0%, rgba(57,255,20,0.15) 100%)',
                                        color: '#39FF14',
                                        border: '1px solid rgba(57,255,20,0.5)'
                                      }}
                                    >
                                      {req.status === 'atendida' ? 'COM TÉCNICO' : req.status === 'em_uso' ? 'EM USO' : 'GI PENDENTE'}
                                    </span>
                                    <p className="text-[10px] text-gray-300 font-medium truncate">{req.peca_estoque?.pn || req.codigo_peca}</p>
                                    <p className="text-[9px] text-gray-400 truncate">{req.descricao}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {req.peca_estoque?.estoque_etiquetas?.[0]?.id_sequencial && (
                                        <>
                                          <span className="text-[8px] text-cyan-400">ID: {req.peca_estoque.estoque_etiquetas[0].id_sequencial}</span>
                                          <span className="text-gray-600">•</span>
                                        </>
                                      )}
                                      {req.peca_estoque?.estoque_etiquetas?.[0]?.delivery && (
                                        <span className="text-[8px] text-orange-400">Delivery: {req.peca_estoque.estoque_etiquetas[0].delivery}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {(!filteredData[coluna.id] || filteredData[coluna.id].length === 0) && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-2"
                            style={{
                              background: `linear-gradient(135deg, ${coluna.color}15 0%, ${coluna.color}05 100%)`,
                              border: `1px dashed ${coluna.color}30`,
                              boxShadow: `0 0 15px ${coluna.color}10, inset 0 0 10px ${coluna.color}05`
                            }}
                          >
                            <ColumnIcon
                              className="w-6 h-6"
                              style={{ color: `${getTextColor(coluna.id, coluna.color)}60` }}
                            />
                          </div>
                          <p className="text-gray-600 text-[10px] uppercase tracking-wider font-bold">
                            Vazio
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedOSId && selectedOSTipo === 'OW' && (
        <OSModal
          osId={selectedOSId}
          onClose={() => {
            setSelectedOSId(null);
            setSelectedOSTipo(null);
          }}
          onReload={loadKanbanData}
        />
      )}

      {selectedOSId && selectedOSTipo === 'LP' && (
        <OSLPModal
          osId={selectedOSId}
          onClose={() => {
            setSelectedOSId(null);
            setSelectedOSTipo(null);
          }}
          onReload={loadKanbanData}
          mode="view"
        />
      )}

      {criarOSLP && (
        <OSLPModal
          osId={null}
          onClose={() => setCriarOSLP(false)}
          onReload={loadKanbanData}
          mode="create"
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Upload, FileText, CheckCircle, AlertCircle, Package,
  Download, Eye, Trash2, Zap, X, Brain, ArrowRight,
  Clock, Star, AlertTriangle, ChevronDown, Cpu
} from 'lucide-react';
import { NFDetailsModal } from './NFDetailsModal';

interface EstoqueEntradaProps {
  selectedUnidade: string;
  user: any;
}

interface NF {
  id: string;
  numero_nf: string;
  chave_acesso: string | null;
  fornecedor: string;
  data_emissao: string;
  valor_total: number;
  qtd_pecas: number;
  processada: boolean;
  created_at: string;
}

interface RequisicaoPendente {
  id: string;
  os_id: string;
  codigo_peca: string;
  descricao?: string;
  os_peca_id?: string | null;
  os: {
    numero_os_interna: string;
    numero_os_samsung: string | null;
    tipo_os: string;
    created_at: string;
    cliente_nome: string | null;
  } | null;
}

interface PecaExpandida {
  id_temp: string;
  pn: string;
  descricao: string;
  valorUnitario: number;
  valorComImpostos: number;
  os_alocada_id: string;
  requisicao_alocada_id: string;
}

interface NFParsed {
  numeroNF: string;
  chaveAcesso: string;
  fornecedor: string;
  dataEmissao: string;
  valorTotal: number;
  delivery: string | null;
  xmlContent: string;
  produtos: {
    pn: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorComImpostos: number;
  }[];
}

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LP: { label: 'LP GARANTIA', color: '#FF0064', bg: 'rgba(255,0,100,0.12)', border: 'rgba(255,0,100,0.4)' },
  atrasada: { label: 'ATRASADA', color: '#FFBF00', bg: 'rgba(255,191,0,0.12)', border: 'rgba(255,191,0,0.4)' },
  IH: { label: 'IN-HOME', color: '#00D4FF', bg: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.4)' },
};

export function EstoqueEntrada({ selectedUnidade, user: userProp }: EstoqueEntradaProps) {
  const { usuario } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [nfs, setNfs] = useState<NF[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedNFId, setSelectedNFId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [downloadingNFId, setDownloadingNFId] = useState<string | null>(null);
  const [deletingNFId, setDeletingNFId] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [requisicoesDisponiveis, setRequisicoesDisponiveis] = useState<RequisicaoPendente[]>([]);
  const [pecasExpandidas, setPecasExpandidas] = useState<PecaExpandida[]>([]);
  const [previewData, setPreviewData] = useState<NFParsed | null>(null);
  const [xmlQueue, setXmlQueue] = useState<NFParsed[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [scanningEffect, setScanningEffect] = useState(false);

  useEffect(() => {
    loadNFs();
  }, [selectedUnidade]);

  const loadNFs = async () => {
    try {
      const unidadeFilter = selectedUnidade || usuario?.unidade_id;
      if (!unidadeFilter) return;

      const { data, error } = await supabase
        .from('estoque_nfs')
        .select('*')
        .eq('unidade_id', unidadeFilter)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNfs(data || []);
    } catch (err) {}
  };

  const parseXML = (xmlText: string): NFParsed => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const getTextContent = (tagName: string, parent: Document | Element = xmlDoc): string => {
      const element = parent.getElementsByTagName(tagName)[0];
      return element?.textContent || '';
    };

    const numeroNF = getTextContent('nNF');

    let chaveAcesso = getTextContent('chNFe');
    if (!chaveAcesso) {
      const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
      if (infNFe) {
        const idAttr = infNFe.getAttribute('Id');
        if (idAttr) chaveAcesso = idAttr.replace('NFe', '');
      }
    }

    const fornecedor = getTextContent('xNome');
    const dataEmissao = getTextContent('dhEmi').split('T')[0];
    const valorTotal = parseFloat(getTextContent('vNF')) || 0;

    let delivery: string | null = null;
    const infCpl = getTextContent('infCpl');
    if (infCpl) {
      const deliveryMatch = infCpl.match(/DELIVERY:\s*([^\s]+)/i);
      if (deliveryMatch) delivery = deliveryMatch[1].trim();
    }

    const produtos: NFParsed['produtos'] = [];
    const dets = xmlDoc.getElementsByTagName('det');

    for (let i = 0; i < dets.length; i++) {
      const det = dets[i];
      const pn = getTextContent('cProd', det);
      const descricao = getTextContent('xProd', det);
      const quantidade = parseFloat(getTextContent('qCom', det)) || 1;
      const valorUnitario = parseFloat(getTextContent('vUnCom', det)) || 0;

      const vProd = parseFloat(getTextContent('vProd', det)) || 0;
      const vIPI = parseFloat(getTextContent('vIPI', det)) || 0;
      const vICMS = parseFloat(getTextContent('vICMS', det)) || 0;
      const valorComImpostos = (vProd + vIPI + vICMS) / quantidade;

      produtos.push({ pn, descricao, quantidade, valorUnitario, valorComImpostos });
    }

    return { numeroNF, chaveAcesso, fornecedor, dataEmissao, valorTotal, delivery, xmlContent: xmlText, produtos };
  };

  const getPriorityScore = (req: RequisicaoPendente): number => {
    if (!req.os) return 0;
    let score = 0;
    if (req.os.tipo_os === 'LP') score += 100;
    const daysOpen = (Date.now() - new Date(req.os.created_at).getTime()) / 86400000;
    if (daysOpen > 10) score += 50;
    if (req.os.tipo_os === 'IH') score += 10;
    return score;
  };

  const getPriorityTag = (req: RequisicaoPendente): keyof typeof PRIORITY_LABELS | null => {
    if (!req.os) return null;
    if (req.os.tipo_os === 'LP') return 'LP';
    const daysOpen = (Date.now() - new Date(req.os.created_at).getTime()) / 86400000;
    if (daysOpen > 10) return 'atrasada';
    if (req.os.tipo_os === 'IH') return 'IH';
    return null;
  };

  const handleXMLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) {
      setError('Selecione uma unidade antes de fazer upload');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);
    setTotalFiles(files.length);
    setCurrentFileIndex(0);

    const validXmls: NFParsed[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFileIndex(i + 1);

      try {
        const text = await file.text();
        const nfData = parseXML(text);

        if (!nfData.numeroNF || nfData.produtos.length === 0) {
          errors.push(`${file.name}: XML inválido ou sem produtos`);
          continue;
        }

        const { data: existingNF } = await supabase
          .from('estoque_nfs')
          .select('id, numero_nf')
          .eq('chave_acesso', nfData.chaveAcesso)
          .maybeSingle();

        if (existingNF) {
          errors.push(`${file.name}: NF já importada (NF ${existingNF.numero_nf})`);
          continue;
        }

        validXmls.push(nfData);
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Erro ao processar'}`);
      }
    }

    if (errors.length > 0) setError(errors.join('\n'));

    if (validXmls.length > 0) {
      setXmlQueue(validXmls);
      await openPreviewModal(validXmls[0], unidadeId);
    } else {
      setUploading(false);
    }

    e.target.value = '';
  };

  const normalizePn = (pn: string) => pn.replace(/[-\s]/g, '').toUpperCase();

  const openPreviewModal = async (nfData: NFParsed, unidadeId: string) => {
    setScanningEffect(true);
    try {
      const pnsUnicos = [...new Set(nfData.produtos.map(p => p.pn))];
      const xmlPnsNorm = new Set(pnsUnicos.map(normalizePn));

      // Step 1: fetch requisicoes_pecas without nested join to avoid RLS join failures
      const { data: reqsRaw } = await supabase
        .from('requisicoes_pecas')
        .select('id, os_id, codigo_peca, descricao, os_peca_id')
        .in('status', ['pendente', 'pedido_feito'])
        .not('os_id', 'is', null);

      const reqsFiltered = (reqsRaw || []).filter(
        r => xmlPnsNorm.has(normalizePn(r.codigo_peca))
      );

      // Step 2: fetch all matching OS in one query
      const osIds = [...new Set(reqsFiltered.map(r => r.os_id).filter(Boolean))];
      const { data: osData } = osIds.length > 0
        ? await supabase
            .from('os')
            .select('id, numero_os_interna, numero_os_samsung, tipo_os, created_at, cliente_nome')
            .in('id', osIds)
        : { data: [] };

      const osMap = new Map((osData || []).map(o => [o.id, o]));

      const reqs: RequisicaoPendente[] = reqsFiltered
        .map(r => ({
          id: r.id,
          os_id: r.os_id,
          codigo_peca: r.codigo_peca,
          descricao: r.descricao || '',
          os_peca_id: r.os_peca_id ?? null,
          os: osMap.get(r.os_id) ?? null,
        }))
        .filter(r => r.os !== null);

      const sortedReqs = reqs.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
      setRequisicoesDisponiveis(sortedReqs);

      // Auto-allocate: match each product to a requisicao
      const pecasParaAlocar: PecaExpandida[] = [];
      let reqsDisponiveis = [...sortedReqs];

      nfData.produtos.forEach(prod => {
        for (let i = 0; i < prod.quantidade; i++) {
          const reqMatchIndex = reqsDisponiveis.findIndex(
            r => normalizePn(r.codigo_peca) === normalizePn(prod.pn)
          );
          let alocadaOsId = '';
          let alocadaReqId = '';
          let alocadaOsPecaId: string | null = null;

          if (reqMatchIndex !== -1) {
            const match = reqsDisponiveis.splice(reqMatchIndex, 1)[0];
            alocadaOsId = match.os_id;
            alocadaReqId = match.id;
            alocadaOsPecaId = match.os_peca_id;
          }

          pecasParaAlocar.push({
            id_temp: crypto.randomUUID(),
            pn: prod.pn,
            descricao: prod.descricao,
            valorUnitario: prod.valorUnitario,
            valorComImpostos: prod.valorComImpostos,
            os_alocada_id: alocadaOsId,
            requisicao_alocada_id: alocadaReqId,
            os_peca_id: alocadaOsPecaId,
          });
        }
      });

      setPecasExpandidas(pecasParaAlocar);
      setPreviewData(nfData);
      setShowPreviewModal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      setScanningEffect(false);
    }
  };

  const handleAlocacaoChange = (id_temp: string, valueStr: string) => {
    // format: "os_id|req_id|os_peca_id"  (OFS = "||")
    const parts = valueStr.split('|');
    const os_id = parts[0] || '';
    const req_id = parts[1] || '';
    const raw_os_peca_id = parts[2] || '';
    const os_peca_id: string | null = raw_os_peca_id || null;

    setPecasExpandidas(prev =>
      prev.map(p =>
        p.id_temp === id_temp
          ? { ...p, os_alocada_id: os_id, requisicao_alocada_id: req_id, os_peca_id }
          : p
      )
    );
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) return;

    setIsSaving(true);
    setShowPreviewModal(false);

    try {
      const { data: nfRecord, error: nfError } = await supabase
        .from('estoque_nfs')
        .insert({
          numero_nf: previewData.numeroNF,
          chave_acesso: previewData.chaveAcesso,
          fornecedor: previewData.fornecedor,
          data_emissao: previewData.dataEmissao,
          valor_total: previewData.valorTotal,
          delivery: previewData.delivery,
          xml_conteudo: previewData.xmlContent,
          unidade_id: unidadeId,
          processada: true,
          processada_em: new Date().toISOString(),
          processada_por: usuario?.id,
        })
        .select()
        .single();

      if (nfError) throw nfError;

      let contador = 0;
      const osParaMover = new Set<string>();
      const reqsParaAtualizar = new Set<string>();

      const pecasToInsert = pecasExpandidas.map(peca => {
        contador++;
        const idUnico = `PC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${contador}`;

        if (peca.os_alocada_id) {
          osParaMover.add(peca.os_alocada_id);
          if (peca.requisicao_alocada_id) reqsParaAtualizar.add(peca.requisicao_alocada_id);
        }

        return {
          id_unico: idUnico,
          pn: peca.pn,
          descricao: peca.descricao,
          nf_id: nfRecord.id,
          unidade_id: unidadeId,
          valor_com_impostos: peca.valorComImpostos,
          status: peca.os_alocada_id ? 'reservada' : 'disponivel',
          os_id: peca.os_alocada_id || null,
          data_entrada: new Date().toISOString(),
        };
      });

      const { data: pecasInseridas, error: pecasError } = await supabase
        .from('estoque_pecas')
        .insert(pecasToInsert)
        .select();

      if (pecasError) throw pecasError;

      if (pecasInseridas && pecasInseridas.length > 0) {
        const historicoEntries = pecasInseridas.map(peca => ({
          peca_id: peca.id,
          usuario_id: usuario?.id,
          acao: peca.os_id ? 'Entrada e Alocação Automática' : 'Entrada de Estoque',
          status_novo: peca.status,
          origem: `NF ${nfRecord.numero_nf}`,
          observacao: peca.os_id
            ? `GIA Stock: Alocada na entrada para OS vinculada`
            : `GIA Stock: Adicionada ao estoque livre (OFS)`,
        }));
        await supabase.from('estoque_historico').insert(historicoEntries);
      }

      for (const osId of osParaMover) {
        await supabase.from('os').update({ coluna_kanban: 'em_reparo' }).eq('id', osId);
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GIA Stock: Peca recebida na NF ${nfRecord.numero_nf} e alocada automaticamente com sucesso. OS movida para Em Reparo.`,
          is_system: true,
        });
      }

      for (const reqId of reqsParaAtualizar) {
        await supabase.from('requisicoes_pecas').update({ status: 'atendida' }).eq('id', reqId);
      }

      const { data: osData } = await supabase
        .from('os')
        .select('id, numero_os_interna')
        .in('id', [...osParaMover]);

      const osNumeroMap: Record<string, string> = {};
      (osData || []).forEach((o: any) => { osNumeroMap[o.id] = o.numero_os_interna; });

      for (const peca of pecasExpandidas) {
        if (!peca.os_alocada_id || !peca.os_peca_id) continue;

        // Fetch current values to detect change before updating
        const { data: osPecaAtual } = await supabase
          .from('os_pecas')
          .select('descricao, valor_gspn')
          .eq('id', peca.os_peca_id)
          .maybeSingle();

        const descricaoAntiga = osPecaAtual?.descricao || '';
        const valorAntigo = osPecaAtual?.valor_gspn || 0;
        const descricaoNova = peca.descricao;
        const valorNovo = peca.valorComImpostos;
        const changed = descricaoNova !== descricaoAntiga || Math.abs(valorNovo - valorAntigo) > 0.01;
        const precoDivergente = Math.abs(valorNovo - valorAntigo) > 0.01;

        // Update os_peca by exact ID — DB trigger recalculates markup automatically
        const updatePayload: Record<string, any> = {
          descricao: descricaoNova,
          valor_gspn: valorNovo,
          editado_manualmente: false,
        };

        if (precoDivergente && valorAntigo > 0) {
          updatePayload.valor_anterior_nf = valorAntigo;
          updatePayload.alerta_preco_nf = true;
        }

        await supabase
          .from('os_pecas')
          .update(updatePayload)
          .eq('id', peca.os_peca_id);

        if (precoDivergente && valorAntigo > 0) {
          await supabase
            .from('os')
            .update({ orcamento_pendente_reenvio: true })
            .eq('id', peca.os_alocada_id);
        }

        if (!changed) continue;

        const osNumero = osNumeroMap[peca.os_alocada_id] || peca.os_alocada_id;
        const valorFormatado = valorNovo.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        await supabase.from('gia_mural_tarefas').insert({
          gia_source: 'ESTOQUE',
          titulo: `Custo Atualizado via NF - OS ${osNumero}`,
          descricao: `GIA Stock informa: A peca ${peca.pn} (${descricaoNova}) entrou na NF ${nfRecord.numero_nf} com o custo de R$ ${valorFormatado}. O sistema recalculou automaticamente o markup e o valor total da OS. Favor conferir se o orcamento do cliente precisa de renegociacao.`,
          prioridade: 'alta',
          gia_responsavel: 'GIA Stock',
          status: 'pendente',
          os_id: peca.os_alocada_id,
          os_numero: osNumero,
          metadata: {
            pn: peca.pn,
            descricao_antiga: descricaoAntiga,
            descricao_nova: descricaoNova,
            valor_antigo: valorAntigo,
            valor_novo: valorNovo,
            numero_nf: nfRecord.numero_nf,
          },
        });
      }

      setSuccessMsg(
        `NF ${previewData.numeroNF} processada com sucesso! ${pecasToInsert.length} peças registradas. ${osParaMover.size > 0 ? `${osParaMover.size} OS(s) movida(s) para Em Reparo automaticamente.` : ''}`
      );

      const remainingQueue = xmlQueue.slice(1);
      setXmlQueue(remainingQueue);

      if (remainingQueue.length > 0) {
        await openPreviewModal(remainingQueue[0], unidadeId);
      } else {
        setPreviewData(null);
        setPecasExpandidas([]);
      }

      loadNFs();
    } catch (err: any) {
      setError(`Falha na importação: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setPecasExpandidas([]);
    setXmlQueue([]);
  };

  const handleViewNFDetails = (nfId: string) => {
    setSelectedNFId(nfId);
    setShowDetailsModal(true);
  };

  const handleDownloadNFPDF = async (nf: NF) => {
    if (!nf.chave_acesso) {
      setError('Chave de acesso não disponível para esta NF');
      return;
    }

    setDownloadingNFId(nf.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-danfe`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chaveAcesso: nf.chave_acesso }),
        }
      );

      const data = await response.json();

      if (data.success && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        setError(data.error || 'Erro ao consultar DANFE');
      }
    } catch (err) {
      setError('Erro ao consultar DANFE');
    } finally {
      setDownloadingNFId(null);
    }
  };

  const handleDeleteNF = async (nf: NF) => {
    if (!confirm(`Deseja excluir a NF ${nf.numero_nf}? Todas as peças vinculadas serão removidas.`)) return;

    setDeletingNFId(nf.id);
    try {
      const { error } = await supabase.from('estoque_nfs').delete().eq('id', nf.id);
      if (error) throw error;
      setNfs(prev => prev.filter(n => n.id !== nf.id));
      setSuccessMsg(`NF ${nf.numero_nf} excluída com sucesso.`);
    } catch (err: any) {
      setError(`Erro ao excluir NF: ${err.message}`);
    } finally {
      setDeletingNFId(null);
    }
  };

  const qtdAlocadas = pecasExpandidas.filter(p => p.os_alocada_id).length;
  const qtdOFS = pecasExpandidas.length - qtdAlocadas;

  return (
    <>
      <NFDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        nfId={selectedNFId || ''}
      />

      {/* GIA STOCK INTELLIGENT ALLOCATION MODAL */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-5xl max-h-[96vh] overflow-hidden flex flex-col rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 50%, #0a0a0a 100%)',
              border: '1px solid rgba(57,255,20,0.3)',
              boxShadow: '0 0 60px rgba(57,255,20,0.12), 0 0 120px rgba(57,255,20,0.05), inset 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{
                background: 'linear-gradient(90deg, rgba(57,255,20,0.08) 0%, rgba(57,255,20,0.03) 60%, transparent 100%)',
                borderBottom: '1px solid rgba(57,255,20,0.2)',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="p-2.5 rounded-xl"
                  style={{
                    background: 'rgba(57,255,20,0.1)',
                    border: '1px solid rgba(57,255,20,0.3)',
                    boxShadow: '0 0 20px rgba(57,255,20,0.2)',
                  }}
                >
                  <Zap
                    className="w-6 h-6"
                    style={{ color: '#39FF14', filter: 'drop-shadow(0 0 8px #39FF14)' }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2
                      className="text-lg font-black tracking-[0.2em] uppercase"
                      style={{ color: '#39FF14', textShadow: '0 0 20px rgba(57,255,20,0.5)' }}
                    >
                      GIA STOCK
                    </h2>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full tracking-widest"
                      style={{
                        background: 'rgba(57,255,20,0.15)',
                        border: '1px solid rgba(57,255,20,0.4)',
                        color: '#39FF14',
                      }}
                    >
                      ALOCAÇÃO INTELIGENTE
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    NF <span className="text-white font-mono font-bold">{previewData.numeroNF}</span>
                    {' '}•{' '}
                    <span className="text-gray-300">{previewData.fornecedor}</span>
                    {' '}•{' '}
                    <span style={{ color: '#39FF14' }}>
                      R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelImport}
                className="p-2 rounded-lg transition-colors hover:bg-white/5"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Stats bar */}
            <div
              className="flex items-center gap-6 px-6 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" style={{ color: '#39FF14' }} />
                <span className="text-xs text-gray-400">
                  Motor de prioridade ativo •{' '}
                  <span style={{ color: '#39FF14' }}>{requisicoesDisponiveis.length} OS(s)</span> cruzadas
                </span>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#39FF14', boxShadow: '0 0 6px #39FF14' }} />
                  <span className="text-xs text-gray-300">
                    <span style={{ color: '#39FF14' }} className="font-bold">{qtdAlocadas}</span> alocadas para OS
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                  <span className="text-xs text-gray-400">
                    <span className="text-gray-300 font-bold">{qtdOFS}</span> para OFS
                  </span>
                </div>
              </div>
            </div>

            {/* Parts list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(57,255,20,0.3) transparent' }}>
              {pecasExpandidas.map((peca, idx) => {
                const osCompativeis = requisicoesDisponiveis.filter(r => r.codigo_peca === peca.pn);
                const isAlocada = !!peca.os_alocada_id;
                const selectedReq = requisicoesDisponiveis.find(r => r.os_id === peca.os_alocada_id && r.codigo_peca === peca.pn);
                const priorityTag = selectedReq ? getPriorityTag(selectedReq) : null;

                return (
                  <div
                    key={peca.id_temp}
                    className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center rounded-xl p-4 transition-all duration-300"
                    style={{
                      background: isAlocada
                        ? 'linear-gradient(135deg, rgba(57,255,20,0.06) 0%, rgba(57,255,20,0.02) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: isAlocada
                        ? '1px solid rgba(57,255,20,0.35)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Part info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                        style={{
                          background: isAlocada ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isAlocada ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(255,255,255,0.1)',
                          color: isAlocada ? '#39FF14' : '#6B7280',
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-sm font-black tracking-wider"
                            style={{ color: '#00D4FF' }}
                          >
                            {peca.pn}
                          </span>
                          {peca.valorComImpostos > 0 && (
                            <span className="text-xs text-gray-500 font-mono">
                              R$ {peca.valorComImpostos.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{peca.descricao}</p>
                      </div>
                    </div>

                    {/* Allocation select */}
                    <div className="flex items-center gap-3 lg:w-[420px] shrink-0">
                      {priorityTag && PRIORITY_LABELS[priorityTag] && (
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap shrink-0"
                          style={{
                            background: PRIORITY_LABELS[priorityTag].bg,
                            border: `1px solid ${PRIORITY_LABELS[priorityTag].border}`,
                            color: PRIORITY_LABELS[priorityTag].color,
                          }}
                        >
                          {PRIORITY_LABELS[priorityTag].label}
                        </span>
                      )}

                      <div className="relative flex-1">
                        <select
                          value={`${peca.os_alocada_id}|${peca.requisicao_alocada_id}|${peca.os_peca_id || ''}`}
                          onChange={(e) => handleAlocacaoChange(peca.id_temp, e.target.value)}
                          className="w-full appearance-none text-sm rounded-xl px-3 py-2.5 pr-8 outline-none transition-all"
                          style={{
                            background: isAlocada ? 'rgba(57,255,20,0.08)' : 'rgba(0,0,0,0.5)',
                            border: isAlocada ? '1px solid rgba(57,255,20,0.5)' : '1px solid rgba(255,255,255,0.15)',
                            color: isAlocada ? '#39FF14' : '#9CA3AF',
                          }}
                        >
                          <option value="||" style={{ background: '#111', color: '#9CA3AF' }}>
                            Enviar para Estoque Livre (OFS)
                          </option>
                          {osCompativeis.map(req => {
                            if (!req.os) return null;
                            const daysOpen = (Date.now() - new Date(req.os.created_at).getTime()) / 86400000;
                            const isAtrasada = daysOpen > 10;
                            const tipoLabel = req.os.tipo_os || '';
                            return (
                              <option
                                key={req.id}
                                value={`${req.os_id}|${req.id}|${req.os_peca_id || ''}`}
                                style={{ background: '#111', color: '#fff' }}
                              >
                                OS {req.os.numero_os_interna}
                                {req.os.numero_os_samsung ? ` (${req.os.numero_os_samsung})` : ''}
                                {' '}- {tipoLabel}
                                {isAtrasada ? ' - ATRASADA' : ''}
                                {req.os.tipo_os === 'LP' ? ' - GARANTIA' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: isAlocada ? '#39FF14' : '#6B7280' }}
                        />
                      </div>

                      {isAlocada ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(57,255,20,0.15)', border: '1px solid rgba(57,255,20,0.4)' }}
                        >
                          <CheckCircle className="w-4 h-4" style={{ color: '#39FF14' }} />
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <Package className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{
                borderTop: '1px solid rgba(57,255,20,0.15)',
                background: 'rgba(0,0,0,0.5)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4" style={{ color: '#39FF14' }} />
                    <span className="text-xs text-gray-400">
                      <span style={{ color: '#39FF14' }} className="font-black text-sm">{qtdAlocadas}</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-gray-300 font-bold">{pecasExpandidas.length}</span>
                      <span className="text-gray-500"> peças alocadas inteligentemente</span>
                    </span>
                  </div>
                  {qtdAlocadas > 0 && (
                    <span className="text-xs text-gray-600 ml-6">
                      {qtdAlocadas} OS(s) serão movidas para Em Reparo automaticamente
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelImport}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#9CA3AF',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
                  style={{
                    background: isSaving ? 'rgba(57,255,20,0.4)' : '#39FF14',
                    color: '#000',
                    boxShadow: isSaving ? 'none' : '0 0 20px rgba(57,255,20,0.4)',
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Gerar Entrada e Etiquetas
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="space-y-6">
        {/* Upload Section */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(57,255,20,0.06) 0%, rgba(57,255,20,0.02) 100%)',
            border: '1px solid rgba(57,255,20,0.25)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="p-3 rounded-xl shrink-0"
              style={{
                background: 'rgba(57,255,20,0.1)',
                border: '1px solid rgba(57,255,20,0.3)',
                boxShadow: '0 0 16px rgba(57,255,20,0.15)',
              }}
            >
              <Zap className="w-6 h-6 animate-pulse" style={{ color: '#39FF14' }} />
            </div>
            <div className="flex-1">
              <h4
                className="font-black text-base tracking-wide mb-1"
                style={{ color: '#39FF14' }}
              >
                GIA STOCK — ENTRADA INTELIGENTE VIA XML
              </h4>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                Faça upload do XML da NF. A GIA Stock cruza automaticamente os PNs com as OS em aberto,
                sugere alocação por prioridade (LP &gt; Atrasada &gt; IH) e move o Kanban ao confirmar.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <label
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer"
                  style={{
                    background: uploading || isSaving ? 'rgba(57,255,20,0.4)' : '#39FF14',
                    color: '#000',
                    boxShadow: uploading || isSaving ? 'none' : '0 0 16px rgba(57,255,20,0.35)',
                    opacity: uploading || isSaving ? 0.7 : 1,
                  }}
                >
                  <Upload className="w-4 h-4" />
                  {uploading
                    ? `Analisando XML... (${currentFileIndex}/${totalFiles})`
                    : isSaving
                    ? 'Processando...'
                    : 'Upload de XML'}
                  <input
                    type="file"
                    accept=".xml"
                    multiple
                    onChange={handleXMLUpload}
                    disabled={uploading || isSaving}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500">Suporta múltiplos arquivos simultâneos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(255,0,100,0.08)', border: '1px solid rgba(255,0,100,0.3)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FF0064' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: '#FF0064' }}>Erro na importação</p>
              <pre className="text-xs text-red-300 mt-1 whitespace-pre-wrap font-mono">{error}</pre>
            </div>
            <button onClick={() => setError(null)} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)' }}
          >
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#39FF14' }} />
            <p className="text-sm text-gray-200">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
            </button>
          </div>
        )}

        {/* NF List */}
        {nfs.length > 0 && (
          <div>
            <h3
              className="text-xs font-black tracking-[0.2em] uppercase mb-4"
              style={{ color: '#00D4FF' }}
            >
              Notas Fiscais Recentes
            </h3>
            <div className="space-y-2">
              {nfs.map(nf => (
                <div
                  key={nf.id}
                  className="flex items-center gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: '#00D4FF' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-white">NF {nf.numero_nf}</span>
                      {nf.processada ? (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(57,255,20,0.12)',
                            border: '1px solid rgba(57,255,20,0.3)',
                            color: '#39FF14',
                          }}
                        >
                          Processada
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(255,191,0,0.12)',
                            border: '1px solid rgba(255,191,0,0.3)',
                            color: '#FFBF00',
                          }}
                        >
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{nf.fornecedor}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-500">
                        {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                      </span>
                      {nf.qtd_pecas > 0 && (
                        <>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">{nf.qtd_pecas} peças</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold mr-2" style={{ color: '#39FF14' }}>
                      R$ {nf.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>

                    <button
                      onClick={() => handleViewNFDetails(nf.id)}
                      title="Ver detalhes"
                      className="p-2 rounded-lg transition-colors hover:bg-white/5"
                    >
                      <Eye className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    </button>

                    {nf.chave_acesso && (
                      <button
                        onClick={() => handleDownloadNFPDF(nf)}
                        disabled={downloadingNFId === nf.id}
                        title="Baixar DANFE"
                        className="p-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
                      >
                        {downloadingNFId === nf.id ? (
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: '#00D4FF', borderTopColor: 'transparent' }}
                          />
                        ) : (
                          <Download className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteNF(nf)}
                      disabled={deletingNFId === nf.id}
                      title="Excluir NF"
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-40"
                    >
                      {deletingNFId === nf.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-400 transition-colors" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nfs.length === 0 && !uploading && !isSaving && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="p-5 rounded-2xl mb-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Package className="w-10 h-10 text-gray-700" />
            </div>
            <p className="text-gray-500 font-medium">Nenhuma NF importada ainda</p>
            <p className="text-xs text-gray-600 mt-1">Faça upload de um XML para começar</p>
          </div>
        )}
      </div>
    </>
  );
}

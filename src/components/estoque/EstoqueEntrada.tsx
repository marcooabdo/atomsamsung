import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Upload, FileText, CheckCircle, AlertCircle, Package,
  Download, Eye, Trash2, Zap, X, Brain,
  ChevronDown, Cpu, GripHorizontal, Minus, Maximize2,
  Tag, ChevronRight
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

interface TaxDetail {
  valor: number;
  aliquota: number;
}

interface ProdutoTaxes {
  icms: TaxDetail | null;
  icms_st: TaxDetail | null;
  ipi: TaxDetail | null;
  pis: TaxDetail | null;
  cofins: TaxDetail | null;
}

interface PecaExpandida {
  id_temp: string;
  nfIndex: number;
  pn: string;
  descricao: string;
  valorUnitario: number;
  valorComImpostos: number;
  os_alocada_id: string;
  requisicao_alocada_id: string;
  os_peca_id?: string | null;
  taxes: ProdutoTaxes;
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
    taxes: ProdutoTaxes;
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

  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [requisicoesDisponiveis, setRequisicoesDisponiveis] = useState<RequisicaoPendente[]>([]);
  const [allPecas, setAllPecas] = useState<PecaExpandida[]>([]);
  const [allNFs, setAllNFs] = useState<NFParsed[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedNFs, setCollapsedNFs] = useState<Record<number, boolean>>({});
  const [isMinimized, setIsMinimized] = useState(false);

  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPreviewPanel && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPanelPos({
        x: window.innerWidth - rect.width - 24,
        y: 24,
      });
    }
  }, [showPreviewPanel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: panelPos.x,
      origY: panelPos.y,
    };
  }, [panelPos]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.origY + dy)),
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

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
      const vUnCom = parseFloat(getTextContent('vUnCom', det)) || 0;

      const vItemStr = getTextContent('vItem', det);
      const vItemVal = vItemStr ? parseFloat(vItemStr) : 0;
      const vIPI = parseFloat(getTextContent('vIPI', det)) || 0;
      const pIPI = parseFloat(getTextContent('pIPI', det)) || 0;
      const vICMS = parseFloat(getTextContent('vICMS', det)) || 0;
      const pICMS = parseFloat(getTextContent('pICMS', det)) || 0;
      const vICMSST = parseFloat(getTextContent('vICMSST', det)) || 0;
      const pICMSST = parseFloat(getTextContent('pICMSST', det)) || 0;
      const vPIS = parseFloat(getTextContent('vPIS', det)) || 0;
      const pPIS = parseFloat(getTextContent('pPIS', det)) || 0;
      const vCOFINS = parseFloat(getTextContent('vCOFINS', det)) || 0;
      const pCOFINS = parseFloat(getTextContent('pCOFINS', det)) || 0;

      let valorComImpostos: number;
      if (vItemVal > 0) {
        valorComImpostos = vItemVal / quantidade;
      } else {
        const ipiPorUnidade = pIPI > 0 ? vUnCom * (pIPI / 100) : 0;
        const icmsStPorUnidade = vICMSST > 0 ? vICMSST / quantidade : 0;
        valorComImpostos = vUnCom + ipiPorUnidade + icmsStPorUnidade;
      }

      const taxes: ProdutoTaxes = {
        icms: vICMS > 0 || pICMS > 0 ? { valor: vICMS / quantidade, aliquota: pICMS } : null,
        icms_st: vICMSST > 0 || pICMSST > 0 ? { valor: vICMSST / quantidade, aliquota: pICMSST } : null,
        ipi: vIPI > 0 || pIPI > 0 ? { valor: vIPI / quantidade, aliquota: pIPI } : null,
        pis: vPIS > 0 || pPIS > 0 ? { valor: vPIS / quantidade, aliquota: pPIS } : null,
        cofins: vCOFINS > 0 || pCOFINS > 0 ? { valor: vCOFINS / quantidade, aliquota: pCOFINS } : null,
      };

      produtos.push({ pn, descricao, quantidade, valorUnitario: vUnCom, valorComImpostos, taxes });
    }

    return { numeroNF, chaveAcesso, fornecedor, dataEmissao, valorTotal, delivery, xmlContent: xmlText, produtos };
  };

  const normalizePn = (pn: string) => pn.replace(/[-\s]/g, '').toUpperCase();

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
          errors.push(`${file.name}: XML invalido ou sem produtos`);
          continue;
        }
        const { data: existingNF } = await supabase
          .from('estoque_nfs')
          .select('id, numero_nf')
          .eq('chave_acesso', nfData.chaveAcesso)
          .maybeSingle();
        if (existingNF) {
          errors.push(`${file.name}: NF ja importada (NF ${existingNF.numero_nf})`);
          continue;
        }
        validXmls.push(nfData);
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Erro ao processar'}`);
      }
    }

    if (errors.length > 0) setError(errors.join('\n'));

    if (validXmls.length > 0) {
      await openAllNFsPreview(validXmls, unidadeId);
    } else {
      setUploading(false);
    }

    e.target.value = '';
  };

  const openAllNFsPreview = async (nfsList: NFParsed[], unidadeId: string) => {
    try {
      const allPns = new Set<string>();
      nfsList.forEach(nf => nf.produtos.forEach(p => allPns.add(normalizePn(p.pn))));

      const { data: reqsRaw } = await supabase
        .from('requisicoes_pecas')
        .select('id, os_id, codigo_peca, descricao, os_peca_id')
        .in('status', ['pendente', 'pedido_feito'])
        .not('os_id', 'is', null);

      const reqsFiltered = (reqsRaw || []).filter(
        r => allPns.has(normalizePn(r.codigo_peca))
      );

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

      const pecasParaAlocar: PecaExpandida[] = [];
      let reqsDisponiveis = [...sortedReqs];

      nfsList.forEach((nfData, nfIdx) => {
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
              nfIndex: nfIdx,
              pn: prod.pn,
              descricao: prod.descricao,
              valorUnitario: prod.valorUnitario,
              valorComImpostos: prod.valorComImpostos,
              os_alocada_id: alocadaOsId,
              requisicao_alocada_id: alocadaReqId,
              os_peca_id: alocadaOsPecaId,
              taxes: prod.taxes,
            });
          }
        });
      });

      setAllPecas(pecasParaAlocar);
      setAllNFs(nfsList);
      setShowPreviewPanel(true);
      setIsMinimized(false);
    } catch (err) {
    } finally {
      setUploading(false);
    }
  };

  const handleAlocacaoChange = (id_temp: string, valueStr: string) => {
    const parts = valueStr.split('|');
    const os_id = parts[0] || '';
    const req_id = parts[1] || '';
    const raw_os_peca_id = parts[2] || '';
    const os_peca_id: string | null = raw_os_peca_id || null;

    setAllPecas(prev =>
      prev.map(p =>
        p.id_temp === id_temp
          ? { ...p, os_alocada_id: os_id, requisicao_alocada_id: req_id, os_peca_id }
          : p
      )
    );
  };

  const generateLabelsForPecas = async (pecasInseridas: any[], nfRecord: any, nfData: NFParsed) => {
    const labelsData: any[] = [];
    let seq = 1;

    for (const peca of pecasInseridas) {
      const idSequencial = `NF${nfRecord.numero_nf.padStart(6, '0')}-${seq.toString().padStart(3, '0')}`;
      let codigoBarras = '';
      try {
        const { data } = await supabase.rpc('gerar_codigo_barras');
        codigoBarras = data || '';
      } catch {}
      if (!codigoBarras) {
        codigoBarras = (Date.now().toString() + Math.floor(Math.random() * 1000000)).padStart(12, '0').substring(0, 12);
      }

      labelsData.push({
        id_sequencial: idSequencial,
        codigo_barras: codigoBarras,
        data_emissao: new Date().toISOString(),
        part_number: peca.pn,
        descricao: peca.descricao,
        delivery: nfData.delivery,
        nf_numero: nfRecord.numero_nf,
        os_numero: peca.os_id ? '' : undefined,
      });
      seq++;
    }

    try {
      const dbLabels = labelsData.map(l => ({
        unidade_id: selectedUnidade || usuario?.unidade_id,
        nf_id: nfRecord.id,
        codigo_barras: l.codigo_barras,
        id_sequencial: l.id_sequencial,
        part_number: l.part_number,
        descricao: l.descricao,
        delivery: l.delivery,
        data_emissao: l.data_emissao,
        quantidade_impressoes: 1,
        ultima_impressao: new Date().toISOString(),
      }));
      await supabase.from('estoque_etiquetas').insert(dbLabels);
    } catch {}

    return labelsData;
  };

  const handleConfirmAllImport = async () => {
    if (allNFs.length === 0) return;
    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) return;

    setIsSaving(true);
    const allLabels: any[] = [];

    try {
      for (let nfIdx = 0; nfIdx < allNFs.length; nfIdx++) {
        const nfData = allNFs[nfIdx];
        const nfPecas = allPecas.filter(p => p.nfIndex === nfIdx);

        const { data: nfRecord, error: nfError } = await supabase
          .from('estoque_nfs')
          .insert({
            numero_nf: nfData.numeroNF,
            chave_acesso: nfData.chaveAcesso,
            fornecedor: nfData.fornecedor,
            data_emissao: nfData.dataEmissao,
            valor_total: nfData.valorTotal,
            delivery: nfData.delivery,
            xml_conteudo: nfData.xmlContent,
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

        const pecasToInsert = nfPecas.map(peca => {
          contador++;
          const idUnico = `PC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${contador}`;
          if (peca.os_alocada_id) {
            osParaMover.add(peca.os_alocada_id);
            if (peca.requisicao_alocada_id) reqsParaAtualizar.add(peca.requisicao_alocada_id);
          }
          const t = peca.taxes;
          return {
            id_unico: idUnico,
            pn: peca.pn,
            descricao: peca.descricao,
            nf_id: nfRecord.id,
            unidade_id: unidadeId,
            valor_com_impostos: peca.valorComImpostos,
            valor_unitario_sem_imposto: peca.valorUnitario,
            icms_valor: t.icms?.valor ?? null,
            icms_aliquota: t.icms?.aliquota ?? null,
            icms_st_valor: t.icms_st?.valor ?? null,
            icms_st_aliquota: t.icms_st?.aliquota ?? null,
            ipi_valor: t.ipi?.valor ?? null,
            ipi_aliquota: t.ipi?.aliquota ?? null,
            pis_valor: t.pis?.valor ?? null,
            pis_aliquota: t.pis?.aliquota ?? null,
            cofins_valor: t.cofins?.valor ?? null,
            cofins_aliquota: t.cofins?.aliquota ?? null,
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
            acao: peca.os_id ? 'Entrada e Alocacao Automatica' : 'Entrada de Estoque',
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

        const { data: osDataMap } = await supabase
          .from('os')
          .select('id, numero_os_interna')
          .in('id', [...osParaMover]);

        const osNumeroMap: Record<string, string> = {};
        (osDataMap || []).forEach((o: any) => { osNumeroMap[o.id] = o.numero_os_interna; });

        for (const peca of nfPecas) {
          if (!peca.os_alocada_id || !peca.os_peca_id) continue;
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

          const updatePayload: Record<string, any> = {
            descricao: descricaoNova,
            valor_gspn: valorNovo,
            editado_manualmente: false,
          };
          if (precoDivergente && valorAntigo > 0) {
            updatePayload.valor_anterior_nf = valorAntigo;
            updatePayload.alerta_preco_nf = true;
          }
          await supabase.from('os_pecas').update(updatePayload).eq('id', peca.os_peca_id);
          if (precoDivergente && valorAntigo > 0) {
            await supabase.from('os').update({ orcamento_pendente_reenvio: true }).eq('id', peca.os_alocada_id);
          }
          if (!changed) continue;
          const osNumero = osNumeroMap[peca.os_alocada_id] || peca.os_alocada_id;
          const valorFormatado = valorNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          await supabase.from('gia_mural_tarefas').insert({
            gia_source: 'ESTOQUE',
            titulo: `Custo Atualizado via NF - OS ${osNumero}`,
            descricao: `GIA Stock informa: A peca ${peca.pn} (${descricaoNova}) entrou na NF ${nfRecord.numero_nf} com o custo de R$ ${valorFormatado}. O sistema recalculou automaticamente o markup e o valor total da OS.`,
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

        const labels = await generateLabelsForPecas(pecasToInsert, nfRecord, nfData);
        allLabels.push(...labels);
      }

      const totalPecas = allPecas.length;
      const totalAlocadas = allPecas.filter(p => p.os_alocada_id).length;
      setSuccessMsg(
        `${allNFs.length} NF(s) processadas com sucesso! ${totalPecas} pecas registradas. ${totalAlocadas > 0 ? `${totalAlocadas} alocadas em OS automaticamente.` : ''}`
      );

      setShowPreviewPanel(false);
      setAllNFs([]);
      setAllPecas([]);

      if (allLabels.length > 0) {
        const params = encodeURIComponent(JSON.stringify(allLabels));
        window.open(`/etiqueta-editor?dados=${params}`, '_blank');
      }

      loadNFs();
    } catch (err: any) {
      setError(`Falha na importacao: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreviewPanel(false);
    setAllNFs([]);
    setAllPecas([]);
  };

  const handleViewNFDetails = (nfId: string) => {
    setSelectedNFId(nfId);
    setShowDetailsModal(true);
  };

  const handleDownloadNFPDF = async (nf: NF) => {
    if (!nf.chave_acesso) {
      setError('Chave de acesso nao disponivel para esta NF');
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
    if (!confirm(`Deseja excluir a NF ${nf.numero_nf}? Todas as pecas vinculadas serao removidas.`)) return;
    setDeletingNFId(nf.id);
    try {
      const { error } = await supabase.from('estoque_nfs').delete().eq('id', nf.id);
      if (error) throw error;
      setNfs(prev => prev.filter(n => n.id !== nf.id));
      setSuccessMsg(`NF ${nf.numero_nf} excluida com sucesso.`);
    } catch (err: any) {
      setError(`Erro ao excluir NF: ${err.message}`);
    } finally {
      setDeletingNFId(null);
    }
  };

  const toggleNFCollapse = (nfIdx: number) => {
    setCollapsedNFs(prev => ({ ...prev, [nfIdx]: !prev[nfIdx] }));
  };

  const totalQtdAlocadas = allPecas.filter(p => p.os_alocada_id).length;
  const totalQtdOFS = allPecas.length - totalQtdAlocadas;

  return (
    <>
      <NFDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        nfId={selectedNFId || ''}
      />

      {showPreviewPanel && (
        <div
          ref={panelRef}
          className="fixed z-50 flex flex-col"
          style={{
            left: panelPos.x,
            top: panelPos.y,
            width: isMinimized ? 420 : 680,
            maxHeight: isMinimized ? 'auto' : 'calc(100vh - 48px)',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 50%, #0a0a0a 100%)',
            border: '1px solid rgba(var(--neon-green-rgb),0.3)',
            borderRadius: 16,
            boxShadow: '0 8px 60px rgba(0,0,0,0.6), 0 0 60px rgba(var(--neon-green-rgb),0.1)',
            transition: isDragging ? 'none' : 'width 0.3s ease',
          }}
        >
          {/* Draggable Header */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-move select-none"
            onMouseDown={handleMouseDown}
            style={{
              background: 'linear-gradient(90deg, rgba(var(--neon-green-rgb),0.08) 0%, rgba(var(--neon-green-rgb),0.03) 60%, transparent 100%)',
              borderBottom: isMinimized ? 'none' : '1px solid rgba(var(--neon-green-rgb),0.2)',
              borderRadius: isMinimized ? 16 : '16px 16px 0 0',
            }}
          >
            <div className="flex items-center gap-3">
              <GripHorizontal className="w-4 h-4 text-gray-600" />
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: 'rgba(var(--neon-green-rgb),0.1)',
                  border: '1px solid rgba(var(--neon-green-rgb),0.3)',
                }}
              >
                <Zap className="w-4 h-4" style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 6px var(--neon-green))' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-[0.15em] uppercase" style={{ color: 'var(--neon-green)' }}>
                    GIA STOCK
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tracking-wider"
                    style={{
                      background: 'rgba(var(--neon-green-rgb),0.15)',
                      border: '1px solid rgba(var(--neon-green-rgb),0.4)',
                      color: 'var(--neon-green)',
                    }}
                  >
                    {allNFs.length} NF{allNFs.length > 1 ? 's' : ''}
                  </span>
                </div>
                {!isMinimized && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {allPecas.length} pecas | {totalQtdAlocadas} alocadas | {totalQtdOFS} OFS
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5 text-gray-500" /> : <Minus className="w-3.5 h-3.5 text-gray-500" />}
              </button>
              <button
                onClick={handleCancelImport}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Stats bar */}
              <div
                className="flex items-center gap-4 px-4 py-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--neon-green)' }} />
                  <span className="text-[10px] text-gray-400">
                    <span style={{ color: 'var(--neon-green)' }}>{requisicoesDisponiveis.length} OS(s)</span> cruzadas
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--neon-green)', boxShadow: '0 0 4px var(--neon-green)' }} />
                    <span className="text-[10px] text-gray-300">
                      <span style={{ color: 'var(--neon-green)' }} className="font-bold">{totalQtdAlocadas}</span> OS
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                    <span className="text-[10px] text-gray-400">
                      <span className="text-gray-300 font-bold">{totalQtdOFS}</span> OFS
                    </span>
                  </div>
                </div>
              </div>

              {/* NFs grouped list */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(var(--neon-green-rgb),0.3) transparent', maxHeight: 'calc(100vh - 240px)' }}>
                {allNFs.map((nf, nfIdx) => {
                  const nfPecas = allPecas.filter(p => p.nfIndex === nfIdx);
                  const nfAlocadas = nfPecas.filter(p => p.os_alocada_id).length;
                  const isCollapsed = collapsedNFs[nfIdx];

                  return (
                    <div key={nfIdx} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* NF Header */}
                      <button
                        onClick={() => toggleNFCollapse(nfIdx)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                        style={{
                          background: 'linear-gradient(90deg, rgba(0,212,255,0.05) 0%, transparent 100%)',
                          borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <ChevronRight
                          className="w-4 h-4 text-gray-500 transition-transform"
                          style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                        />
                        <FileText className="w-4 h-4" style={{ color: '#00D4FF' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-white">NF {nf.numeroNF}</span>
                            {nf.delivery && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                {nf.delivery}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 truncate">{nf.fornecedor}</span>
                            <span className="text-[10px]" style={{ color: 'var(--neon-green)' }}>
                              R$ {nf.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-gray-400">{nfPecas.length} pc</div>
                          <div className="text-[10px]" style={{ color: nfAlocadas > 0 ? 'var(--neon-green)' : '#6B7280' }}>
                            {nfAlocadas} alocadas
                          </div>
                        </div>
                      </button>

                      {/* NF Parts */}
                      {!isCollapsed && (
                        <div className="space-y-1 p-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                          {nfPecas.map((peca) => {
                            const osCompativeis = requisicoesDisponiveis.filter(r => r.codigo_peca === peca.pn);
                            const isAlocada = !!peca.os_alocada_id;
                            const selectedReq = requisicoesDisponiveis.find(r => r.os_id === peca.os_alocada_id && r.codigo_peca === peca.pn);
                            const priorityTag = selectedReq ? getPriorityTag(selectedReq) : null;

                            return (
                              <div
                                key={peca.id_temp}
                                className="flex flex-col gap-2 rounded-lg p-2.5 transition-all"
                                style={{
                                  background: isAlocada
                                    ? 'rgba(var(--neon-green-rgb),0.04)'
                                    : 'rgba(255,255,255,0.02)',
                                  border: isAlocada
                                    ? '1px solid rgba(var(--neon-green-rgb),0.2)'
                                    : '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold" style={{ color: '#00D4FF' }}>{peca.pn}</span>
                                  {peca.valorComImpostos > 0 && (
                                    <span className="text-[10px] text-gray-500 font-mono">R$ {peca.valorComImpostos.toFixed(2)}</span>
                                  )}
                                  {priorityTag && PRIORITY_LABELS[priorityTag] && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto shrink-0"
                                      style={{
                                        background: PRIORITY_LABELS[priorityTag].bg,
                                        border: `1px solid ${PRIORITY_LABELS[priorityTag].border}`,
                                        color: PRIORITY_LABELS[priorityTag].color,
                                      }}
                                    >
                                      {PRIORITY_LABELS[priorityTag].label}
                                    </span>
                                  )}
                                  {isAlocada ? (
                                    <CheckCircle className="w-3.5 h-3.5 shrink-0 ml-auto" style={{ color: 'var(--neon-green)' }} />
                                  ) : (
                                    <Package className="w-3.5 h-3.5 text-gray-600 shrink-0 ml-auto" />
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 truncate -mt-1">{peca.descricao}</p>

                                <div className="relative">
                                  <select
                                    value={`${peca.os_alocada_id}|${peca.requisicao_alocada_id}|${peca.os_peca_id || ''}`}
                                    onChange={(e) => handleAlocacaoChange(peca.id_temp, e.target.value)}
                                    className="w-full appearance-none text-[11px] rounded-lg px-2.5 py-2 pr-7 outline-none transition-all"
                                    style={{
                                      background: isAlocada ? 'rgba(var(--neon-green-rgb),0.06)' : 'rgba(0,0,0,0.4)',
                                      border: isAlocada ? '1px solid rgba(var(--neon-green-rgb),0.35)' : '1px solid rgba(255,255,255,0.1)',
                                      color: isAlocada ? 'var(--neon-green)' : '#9CA3AF',
                                    }}
                                  >
                                    <option value="||" style={{ background: '#111', color: '#9CA3AF' }}>
                                      Enviar para Estoque Livre (OFS)
                                    </option>
                                    {osCompativeis.map(req => {
                                      if (!req.os) return null;
                                      const daysOpen = (Date.now() - new Date(req.os.created_at).getTime()) / 86400000;
                                      const isAtrasada = daysOpen > 10;
                                      return (
                                        <option key={req.id} value={`${req.os_id}|${req.id}|${req.os_peca_id || ''}`} style={{ background: '#111', color: '#fff' }}>
                                          OS {req.os.numero_os_interna}
                                          {req.os.numero_os_samsung ? ` (${req.os.numero_os_samsung})` : ''}
                                          {' '}- {req.os.tipo_os || ''}
                                          {isAtrasada ? ' - ATRASADA' : ''}
                                          {req.os.tipo_os === 'LP' ? ' - GARANTIA' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <ChevronDown
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                                    style={{ color: isAlocada ? 'var(--neon-green)' : '#6B7280' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-4 py-3 gap-2"
                style={{
                  borderTop: '1px solid rgba(var(--neon-green-rgb),0.15)',
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '0 0 16px 16px',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" style={{ color: 'var(--neon-green)' }} />
                  <span className="text-[10px] text-gray-400">
                    <span style={{ color: 'var(--neon-green)' }} className="font-black">{totalQtdAlocadas}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-gray-300 font-bold">{allPecas.length}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelImport}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#9CA3AF',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmAllImport}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                    style={{
                      background: isSaving ? 'rgba(var(--neon-green-rgb),0.4)' : 'var(--neon-green)',
                      color: '#000',
                      boxShadow: isSaving ? 'none' : '0 0 16px rgba(var(--neon-green-rgb),0.3)',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Gerar Entrada e Etiquetas
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="space-y-6">
        {/* Upload Section */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.06) 0%, rgba(var(--neon-green-rgb),0.02) 100%)',
            border: '1px solid rgba(var(--neon-green-rgb),0.25)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="p-3 rounded-xl shrink-0"
              style={{
                background: 'rgba(var(--neon-green-rgb),0.1)',
                border: '1px solid rgba(var(--neon-green-rgb),0.3)',
                boxShadow: '0 0 16px rgba(var(--neon-green-rgb),0.15)',
              }}
            >
              <Zap className="w-6 h-6 animate-pulse" style={{ color: 'var(--neon-green)' }} />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-base tracking-wide mb-1" style={{ color: 'var(--neon-green)' }}>
                GIA STOCK — ENTRADA INTELIGENTE VIA XML
              </h4>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                Faca upload dos XMLs das NFs. A GIA Stock cruza automaticamente os PNs com as OS em aberto,
                sugere alocacao por prioridade (LP &gt; Atrasada &gt; IH) e move o Kanban ao confirmar.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <label
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer"
                  style={{
                    background: uploading || isSaving ? 'rgba(var(--neon-green-rgb),0.4)' : 'var(--neon-green)',
                    color: '#000',
                    boxShadow: uploading || isSaving ? 'none' : '0 0 16px rgba(var(--neon-green-rgb),0.35)',
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
                <span className="text-xs text-gray-500">Suporta multiplos arquivos simultaneos</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(255,0,100,0.08)', border: '1px solid rgba(255,0,100,0.3)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FF0064' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: '#FF0064' }}>Erro na importacao</p>
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
            style={{ background: 'rgba(var(--neon-green-rgb),0.06)', border: '1px solid rgba(var(--neon-green-rgb),0.3)' }}
          >
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--neon-green)' }} />
            <p className="text-sm text-gray-200">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
            </button>
          </div>
        )}

        {nfs.length > 0 && (
          <div>
            <h3 className="text-xs font-black tracking-[0.2em] uppercase mb-4" style={{ color: '#00D4FF' }}>
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
                  <div className="p-2 rounded-lg shrink-0" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
                    <FileText className="w-5 h-5" style={{ color: '#00D4FF' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-white">NF {nf.numero_nf}</span>
                      {nf.processada ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--neon-green-rgb),0.12)', border: '1px solid rgba(var(--neon-green-rgb),0.3)', color: 'var(--neon-green)' }}>
                          Processada
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,191,0,0.12)', border: '1px solid rgba(255,191,0,0.3)', color: '#FFBF00' }}>
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{nf.fornecedor}</span>
                      <span className="text-xs text-gray-600">-</span>
                      <span className="text-xs text-gray-500">{new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</span>
                      {nf.qtd_pecas > 0 && (
                        <>
                          <span className="text-xs text-gray-600">-</span>
                          <span className="text-xs text-gray-500">{nf.qtd_pecas} pecas</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold mr-2" style={{ color: 'var(--neon-green)' }}>
                      R$ {nf.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => handleViewNFDetails(nf.id)} title="Ver detalhes" className="p-2 rounded-lg transition-colors hover:bg-white/5">
                      <Eye className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    </button>
                    {nf.chave_acesso && (
                      <button onClick={() => handleDownloadNFPDF(nf)} disabled={downloadingNFId === nf.id} title="Baixar DANFE" className="p-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40">
                        {downloadingNFId === nf.id ? (
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00D4FF', borderTopColor: 'transparent' }} />
                        ) : (
                          <Download className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                        )}
                      </button>
                    )}
                    <button onClick={() => handleDeleteNF(nf)} disabled={deletingNFId === nf.id} title="Excluir NF" className="p-2 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-40">
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
            <div className="p-5 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Package className="w-10 h-10 text-gray-700" />
            </div>
            <p className="text-gray-500 font-medium">Nenhuma NF importada ainda</p>
            <p className="text-xs text-gray-600 mt-1">Faca upload de um XML para comecar</p>
          </div>
        )}
      </div>
    </>
  );
}

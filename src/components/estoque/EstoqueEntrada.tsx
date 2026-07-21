import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  Upload, FileText, CheckCircle, AlertCircle, Package,
  Download, Eye, Trash2, Zap, X, Brain, Search, Calendar,
  ChevronDown, Cpu, ChevronRight, Code, ChevronLeft,
  ChevronsLeft, ChevronsRight, FileSpreadsheet, Archive, MapPin, Key, Loader2, Clock
} from 'lucide-react';
import { NFDetailsModal } from './NFDetailsModal';
import { LocationSelector } from './LocationSelector';

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
  processada: boolean;
  created_at: string;
  xml_conteudo: string | null;
  delivery?: string | null;
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
  localizacao: string;
  bin_id: string;
  localizacao_sugerida: string;
  bin_id_sugerido: string;
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
  const [nfPage, setNfPage] = useState(0);
  const [nfTotal, setNfTotal] = useState(0);
  const NF_PER_PAGE = 100;
  const [nfSearch, setNfSearch] = useState('');
  const [nfDateFrom, setNfDateFrom] = useState('');
  const [nfDateTo, setNfDateTo] = useState('');
  const [exportingReport, setExportingReport] = useState(false);
  const [chaveAcessoInput, setChaveAcessoInput] = useState('');
  const [buscandoChave, setBuscandoChave] = useState(false);
  const [showChaveInput, setShowChaveInput] = useState(false);
  const [exportingXmls, setExportingXmls] = useState(false);
  const [nfPendentes, setNfPendentes] = useState<NF[]>([]);
  const [showPendentes, setShowPendentes] = useState(true);
  const [processandoEntrada, setProcessandoEntrada] = useState<string | null>(null);
  const [buscaProgress, setBuscaProgress] = useState<{ current: number; total: number; found: number } | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [requisicoesDisponiveis, setRequisicoesDisponiveis] = useState<RequisicaoPendente[]>([]);
  const [allPecas, setAllPecas] = useState<PecaExpandida[]>([]);
  const [allNFs, setAllNFs] = useState<NFParsed[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedNFs, setCollapsedNFs] = useState<Record<number, boolean>>({});
  const [locationSelectorPeca, setLocationSelectorPeca] = useState<{ id_temp: string; pn: string } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNfPage(0);
    loadNFs(0, '', '', '');
    loadNFsPendentes();
  }, [selectedUnidade]);

  const triggerSearch = (search: string, dateFrom: string, dateTo: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setNfPage(0);
      loadNFs(0, search, dateFrom, dateTo);
    }, 400);
  };

  const loadNFs = async (page = nfPage, search = nfSearch, dateFrom = nfDateFrom, dateTo = nfDateTo) => {
    try {
      const unidadeFilter = selectedUnidade || usuario?.unidade_id;
      if (!unidadeFilter) return;
      const from = page * NF_PER_PAGE;
      const to = from + NF_PER_PAGE - 1;

      let countQuery = supabase
        .from('estoque_nfs')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeFilter)
        .eq('processada', true);

      let dataQuery = supabase
        .from('estoque_nfs')
        .select('*')
        .eq('unidade_id', unidadeFilter)
        .eq('processada', true)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        countQuery = countQuery.gte('data_emissao', dateFrom);
        dataQuery = dataQuery.gte('data_emissao', dateFrom);
      }
      if (dateTo) {
        countQuery = countQuery.lte('data_emissao', dateTo);
        dataQuery = dataQuery.lte('data_emissao', dateTo);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        const orFilter = `numero_nf.ilike.${s},fornecedor.ilike.${s},chave_acesso.ilike.${s},delivery.ilike.${s},xml_conteudo.ilike.${s}`;
        countQuery = countQuery.or(orFilter);
        dataQuery = dataQuery.or(orFilter);
      }

      const { count } = await countQuery;
      setNfTotal(count || 0);

      const { data, error } = await dataQuery.range(from, to);
      if (error) throw error;
      setNfs(data || []);
    } catch (err) {}
  };

  const loadNFsPendentes = async () => {
    try {
      const unidadeFilter = selectedUnidade || usuario?.unidade_id;
      if (!unidadeFilter) return;
      const { data, error } = await supabase
        .from('estoque_nfs')
        .select('*')
        .eq('unidade_id', unidadeFilter)
        .eq('processada', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNfPendentes(data || []);
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
    const dataEmissao = (getTextContent('dhEmi') || getTextContent('dEmi')).split('T')[0];
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

  const handleBuscarPorChave = async () => {
    const linhas = chaveAcessoInput.split(/[\n,;]+/).map(l => l.replace(/\D/g, '')).filter(l => l.length === 44);
    if (linhas.length === 0) {
      alert('Nenhuma chave de acesso válida encontrada. Cada chave deve ter exatamente 44 dígitos.');
      return;
    }
    if (linhas.length > 100) {
      alert('Máximo de 100 chaves por vez.');
      return;
    }

    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) {
      alert('Selecione uma unidade primeiro.');
      return;
    }

    setBuscandoChave(true);
    setBuscaProgress({ current: 0, total: linhas.length, found: 0 });
    setError(null);

    try {
      // Fetch unit CNPJ for distribution lookup
      let unitCnpj: string | undefined;
      try {
        const unidadeFilter = selectedUnidade || usuario?.unidade_id;
        if (unidadeFilter) {
          const { data: unidadeData } = await supabase
            .from('unidades')
            .select('cnpj')
            .eq('id', unidadeFilter)
            .maybeSingle();
          if (unidadeData?.cnpj) unitCnpj = unidadeData.cnpj.replace(/\D/g, '');
        }
      } catch {}

      const requestBody: any = linhas.length === 1 ? { chaveAcesso: linhas[0] } : { chavesAcesso: linhas };
      if (unitCnpj) requestBody.cpf_cnpj = unitCnpj;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-danfe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (linhas.length === 1) {
        if (!response.ok || !result.success) {
          const debugSteps = result.debug?.steps ? JSON.stringify(result.debug.steps) : '';
          const debugDist = result.debug?.distribuicao ? JSON.stringify(result.debug.distribuicao) : '';
          const debugInfo = debugSteps || debugDist ? ` [Debug: dist=${debugDist} steps=${debugSteps}]` : '';
          throw new Error((result.error || 'Erro ao consultar chave de acesso') + debugInfo);
        }
        const xml = result.xml;
        if (!xml || xml.length < 100) {
          throw new Error('XML não encontrado para esta chave de acesso.');
        }
        const nfData = parseXML(xml);
        if (!nfData || !nfData.produtos || nfData.produtos.length === 0) {
          throw new Error('XML inválido ou sem produtos identificados.');
        }
        // Save as pending NF
        const duplicateCheck = await supabase.from('estoque_nfs').select('id').eq('chave_acesso', linhas[0]).maybeSingle();
        if (duplicateCheck.data) {
          throw new Error(`NF ${nfData.numeroNF} já foi importada anteriormente.`);
        }
        await supabase.from('estoque_nfs').insert({
          numero_nf: nfData.numeroNF,
          chave_acesso: nfData.chaveAcesso,
          fornecedor: nfData.fornecedor,
          data_emissao: nfData.dataEmissao,
          valor_total: nfData.valorTotal,
          delivery: nfData.delivery,
          xml_conteudo: nfData.xmlContent,
          unidade_id: unidadeId,
          processada: false,
        });
        setBuscaProgress({ current: 1, total: 1, found: 1 });
        setSuccessMsg(`NF ${nfData.numeroNF} importada e adicionada às NFs Pendentes de Entrada.`);
      } else {
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Erro ao consultar chaves de acesso');
        }
        let found = 0;
        const errors: string[] = [];
        for (const item of (result.results || [])) {
          if (!item.success || !item.xml) {
            errors.push(`${item.chaveAcesso.slice(-8)}: ${item.error || 'não encontrada'}`);
            continue;
          }
          try {
            const nfData = parseXML(item.xml);
            if (!nfData || !nfData.produtos || nfData.produtos.length === 0) {
              errors.push(`${item.chaveAcesso.slice(-8)}: XML sem produtos`);
              continue;
            }
            const dupCheck = await supabase.from('estoque_nfs').select('id').eq('chave_acesso', item.chaveAcesso).maybeSingle();
            if (dupCheck.data) {
              errors.push(`${item.chaveAcesso.slice(-8)}: já importada`);
              continue;
            }
            await supabase.from('estoque_nfs').insert({
              numero_nf: nfData.numeroNF,
              chave_acesso: nfData.chaveAcesso,
              fornecedor: nfData.fornecedor,
              data_emissao: nfData.dataEmissao,
              valor_total: nfData.valorTotal,
              delivery: nfData.delivery,
              xml_conteudo: nfData.xmlContent,
              unidade_id: unidadeId,
              processada: false,
            });
            found++;
          } catch (e: any) {
            errors.push(`${item.chaveAcesso.slice(-8)}: ${e.message}`);
          }
          setBuscaProgress({ current: found + errors.length, total: linhas.length, found });
        }
        const msg = `${found} NF(s) importadas com sucesso às Pendentes de Entrada.`;
        if (errors.length > 0) {
          setError(`${errors.length} chave(s) com erro:\n${errors.join('\n')}`);
        }
        setSuccessMsg(msg);
      }

      setChaveAcessoInput('');
      setShowChaveInput(false);
      loadNFs();
      loadNFsPendentes();
    } catch (error: any) {
      setError(error.message || 'Erro ao buscar NF pela chave de acesso');
    } finally {
      setBuscandoChave(false);
      setBuscaProgress(null);
    }
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

      const locationSuggestions = new Map<string, { bin_id: string; localizacao: string }>();
      for (const pn of allPns) {
        try {
          const { data: sugData } = await supabase.rpc('sugerir_localizacao', {
            pn_busca: pn,
            unidade_atual: unidadeId,
          });
          if (sugData && sugData.length > 0) {
            locationSuggestions.set(pn, {
              bin_id: sugData[0].bin_id,
              localizacao: sugData[0].localizacao_completa,
            });
          }
        } catch {}
      }

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

            const suggestion = locationSuggestions.get(normalizePn(prod.pn));

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
              localizacao: suggestion?.localizacao || '',
              bin_id: suggestion?.bin_id || '',
              localizacao_sugerida: suggestion?.localizacao || '',
              bin_id_sugerido: suggestion?.bin_id || '',
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

  const handleDarEntrada = async (nf: NF) => {
    if (!nf.xml_conteudo) {
      setError('Esta NF não possui XML armazenado.');
      return;
    }
    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) return;

    setProcessandoEntrada(nf.id);
    try {
      const nfData = parseXML(nf.xml_conteudo);
      if (!nfData || !nfData.produtos || nfData.produtos.length === 0) {
        throw new Error('XML sem produtos identificados');
      }
      await openAllNFsPreview([nfData], unidadeId);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar entrada');
    } finally {
      setProcessandoEntrada(null);
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

  const handleLocationChange = (id_temp: string, binId: string, locationText: string) => {
    setAllPecas(prev =>
      prev.map(p =>
        p.id_temp === id_temp
          ? { ...p, bin_id: binId, localizacao: locationText }
          : p
      )
    );
  };

  const handleLocationClear = (id_temp: string) => {
    setAllPecas(prev =>
      prev.map(p =>
        p.id_temp === id_temp
          ? { ...p, bin_id: '', localizacao: '' }
          : p
      )
    );
  };

  const applyLocationToAllSamePn = (sourcePeca: PecaExpandida) => {
    setAllPecas(prev =>
      prev.map(p =>
        p.pn === sourcePeca.pn && !p.localizacao
          ? { ...p, bin_id: sourcePeca.bin_id, localizacao: sourcePeca.localizacao }
          : p
      )
    );
  };

  const generateLabelsForPecas = async (pecasInseridas: any[], nfRecord: any, nfData: NFParsed) => {
    const labelsData: any[] = [];
    let seq = 1;

    for (const peca of pecasInseridas) {
      const idSequencial = peca.id_numerico
        ? `#${peca.id_numerico}`
        : (peca.id_unico || `NF${nfRecord.numero_nf.padStart(6, '0')}-${seq.toString().padStart(3, '0')}`);
      let codigoBarras = '';
      try {
        const { data } = await supabase.rpc('gerar_codigo_barras');
        codigoBarras = data || '';
      } catch {}
      if (!codigoBarras) {
        codigoBarras = (Date.now().toString() + Math.floor(Math.random() * 1000000)).padStart(12, '0').substring(0, 12);
      }

      let osNumeroSmart = '';
      if (peca.os_id) {
        const { data: osData } = await supabase
          .from('os')
          .select('numero_os_samsung, numero_os_interna')
          .eq('id', peca.os_id)
          .maybeSingle();
        osNumeroSmart = osData?.numero_os_samsung || osData?.numero_os_interna || '';
      }

      labelsData.push({
        id_sequencial: idSequencial,
        codigo_barras: codigoBarras,
        data_emissao: new Date().toISOString(),
        part_number: peca.pn,
        descricao: peca.descricao,
        delivery: nfData.delivery,
        nf_numero: nfRecord.numero_nf,
        nf_data_emissao: nfData.dataEmissao || '',
        os_numero: osNumeroSmart,
        localizacao: peca.localizacao || '',
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

        // Check if NF already exists (imported via chave as pending)
        let nfRecord: any;
        const existingNf = nfData.chaveAcesso
          ? await supabase.from('estoque_nfs').select('*').eq('chave_acesso', nfData.chaveAcesso).maybeSingle()
          : await supabase.from('estoque_nfs').select('*').eq('numero_nf', nfData.numeroNF).eq('unidade_id', unidadeId).maybeSingle();

        if (existingNf.data) {
          if (existingNf.data.processada) {
            throw new Error(`NF ${nfData.numeroNF} já foi processada anteriormente.`);
          }
          // Update existing pending NF to processed
          const { data: updatedNf, error: updateErr } = await supabase
            .from('estoque_nfs')
            .update({
              processada: true,
              processada_em: new Date().toISOString(),
              processada_por: usuario?.id,
            })
            .eq('id', existingNf.data.id)
            .select()
            .single();
          if (updateErr) throw updateErr;
          nfRecord = updatedNf;
        } else {
          const { data: newNf, error: nfError } = await supabase
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
          nfRecord = newNf;
        }

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
            localizacao: peca.localizacao || null,
            bin_id: peca.bin_id || null,
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

        const labels = await generateLabelsForPecas(pecasInseridas || pecasToInsert, nfRecord, nfData);
        allLabels.push(...labels);
      }

      const totalPecas = allPecas.length;
      const totalAlocadas = allPecas.filter(p => p.os_alocada_id).length;
      setSuccessMsg(
        `${allNFs.length} NF(s) processadas com sucesso! ${totalPecas} peças registradas. ${totalAlocadas > 0 ? `${totalAlocadas} alocadas em OS automaticamente.` : ''}`
      );

      setShowPreviewPanel(false);
      setAllNFs([]);
      setAllPecas([]);

      if (allLabels.length > 0) {
        const params = encodeURIComponent(JSON.stringify(allLabels));
        window.open(`/etiqueta-editor?dados=${params}`, '_blank');
      }

      loadNFs();
      loadNFsPendentes();
    } catch (err: any) {
      setError(`Falha na importação: ${err.message}`);
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

  const handleDownloadXML = async (nf: NF) => {
    try {
      let xmlContent = nf.xml_conteudo;
      if (!xmlContent) {
        const { data, error } = await supabase
          .from('estoque_nfs')
          .select('xml_conteudo')
          .eq('id', nf.id)
          .maybeSingle();
        if (error || !data?.xml_conteudo) {
          setError('XML não disponível para esta NF');
          return;
        }
        xmlContent = data.xml_conteudo;
      }
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nf.chave_acesso ? `${nf.chave_acesso}.xml` : `NF_${nf.numero_nf}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Erro ao baixar XML');
    }
  };

  const handleDeleteNF = async (nf: NF) => {
    if (!confirm(`Deseja excluir a NF ${nf.numero_nf}? Todas as peças vinculadas serão removidas.`)) return;
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

  const parseXMLMeta = (xml: string | null) => {
    if (!xml) return { destinatario: '', natOp: '', xPed: '', cfopSet: '', ncmSet: '' };
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const tag = (name: string, parent: Document | Element = doc) => parent.getElementsByTagName(name)[0]?.textContent || '';

      const dest = doc.getElementsByTagName('dest')[0];
      const destinatario = dest ? (tag('xNome', dest) || tag('CNPJ', dest) || tag('CPF', dest)) : '';
      const natOp = tag('natOp');
      const xPed = tag('xPed');

      const dets = doc.getElementsByTagName('det');
      const cfops = new Set<string>();
      const ncms = new Set<string>();
      for (let i = 0; i < dets.length; i++) {
        const cfop = tag('CFOP', dets[i]);
        const ncm = tag('NCM', dets[i]);
        if (cfop) cfops.add(cfop);
        if (ncm) ncms.add(ncm);
      }
      return { destinatario, natOp, xPed, cfopSet: [...cfops].join(', '), ncmSet: [...ncms].join(', ') };
    } catch { return { destinatario: '', natOp: '', xPed: '', cfopSet: '', ncmSet: '' }; }
  };

  const parseXMLDetMeta = (xml: string | null, pn: string) => {
    if (!xml) return { cfop: '', ncm: '', xPed: '' };
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const tag = (name: string, parent: Document | Element = doc) => parent.getElementsByTagName(name)[0]?.textContent || '';
      const xPed = tag('xPed');
      const dets = doc.getElementsByTagName('det');
      for (let i = 0; i < dets.length; i++) {
        const cProd = tag('cProd', dets[i]);
        if (cProd === pn) {
          return { cfop: tag('CFOP', dets[i]), ncm: tag('NCM', dets[i]), xPed };
        }
      }
      const firstDet = dets[0];
      return { cfop: firstDet ? tag('CFOP', firstDet) : '', ncm: firstDet ? tag('NCM', firstDet) : '', xPed };
    } catch { return { cfop: '', ncm: '', xPed: '' }; }
  };

  const handleExportReport = async () => {
    setExportingReport(true);
    try {
      const unidadeFilter = selectedUnidade || usuario?.unidade_id;
      if (!unidadeFilter) return;

      let query = supabase
        .from('estoque_nfs')
        .select('id, numero_nf, chave_acesso, fornecedor, data_emissao, valor_total, delivery, processada, created_at, xml_conteudo')
        .eq('unidade_id', unidadeFilter)
        .order('created_at', { ascending: false });

      if (nfDateFrom) query = query.gte('data_emissao', nfDateFrom);
      if (nfDateTo) query = query.lte('data_emissao', nfDateTo);
      if (nfSearch.trim()) {
        const s = `%${nfSearch.trim()}%`;
        query = query.or(`numero_nf.ilike.${s},fornecedor.ilike.${s},chave_acesso.ilike.${s},delivery.ilike.${s},xml_conteudo.ilike.${s}`);
      }

      const { data: nfsData } = await query;
      if (!nfsData || nfsData.length === 0) {
        setError('Nenhuma NF encontrada para exportar.');
        return;
      }

      const nfXmlMap: Record<string, string | null> = {};
      nfsData.forEach(n => { nfXmlMap[n.id] = n.xml_conteudo; });

      const nfIds = nfsData.map(n => n.id);
      const { data: pecasData } = await supabase
        .from('estoque_pecas')
        .select('*, os:os_id(numero_os_interna, numero_os_samsung), nf:nf_id(numero_nf, delivery, fornecedor, data_emissao)')
        .in('nf_id', nfIds)
        .order('pn');

      const rows = (pecasData || []).map((p: any) => {
        const detMeta = parseXMLDetMeta(nfXmlMap[p.nf_id], p.pn);
        const nfMeta = parseXMLMeta(nfXmlMap[p.nf_id]);
        return {
          'NF': p.nf?.numero_nf || '',
          'Data Emissão': p.nf?.data_emissao ? new Date(p.nf.data_emissao).toLocaleDateString('pt-BR') : '',
          'Fornecedor': p.nf?.fornecedor || '',
          'Destinatário': nfMeta.destinatario,
          'Nat. Operação': nfMeta.natOp,
          'Delivery': p.nf?.delivery || '',
          'Ped. Cliente': detMeta.xPed,
          'Part Number': p.pn,
          'Descrição': p.descricao,
          'NCM': detMeta.ncm,
          'CFOP': detMeta.cfop,
          'ID': p.id_numerico || '',
          'Qtd': 1,
          'Valor Unitário': p.valor_unitario_sem_imposto || 0,
          'Valor c/ Impostos': p.valor_com_impostos || 0,
          'ICMS Valor': p.icms_valor || 0,
          'ICMS %': p.icms_aliquota || 0,
          'ICMS-ST Valor': p.icms_st_valor || 0,
          'ICMS-ST %': p.icms_st_aliquota || 0,
          'IPI Valor': p.ipi_valor || 0,
          'IPI %': p.ipi_aliquota || 0,
          'PIS Valor': p.pis_valor || 0,
          'PIS %': p.pis_aliquota || 0,
          'COFINS Valor': p.cofins_valor || 0,
          'COFINS %': p.cofins_aliquota || 0,
          'Status': p.status,
          'OS': p.os?.numero_os_samsung || p.os?.numero_os_interna || '',
          'Data Entrada': p.data_entrada ? new Date(p.data_entrada).toLocaleDateString('pt-BR') : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 14) }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório NFs');

      const pecasByNf = (pecasData || []).reduce((acc: Record<string, number>, p: any) => {
        if (p.nf_id) acc[p.nf_id] = (acc[p.nf_id] || 0) + 1;
        return acc;
      }, {});
      const nfSummary = nfsData.map(n => {
        const meta = parseXMLMeta(n.xml_conteudo);
        return {
          'NF': n.numero_nf,
          'Data Emissão': n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '',
          'Fornecedor': n.fornecedor,
          'Destinatário': meta.destinatario,
          'Nat. Operação': meta.natOp,
          'Delivery': n.delivery || '',
          'Ped. Cliente': meta.xPed,
          'CFOP': meta.cfopSet,
          'NCM': meta.ncmSet,
          'Valor Total': n.valor_total,
          'Qtd Peças': pecasByNf[n.id] || 0,
          'Status': n.processada ? 'Processada' : 'Pendente',
          'Chave Acesso': n.chave_acesso || '',
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(nfSummary);
      ws2['!cols'] = Object.keys(nfSummary[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 14) }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumo NFs');

      XLSX.writeFile(wb, `Relatório_NFs_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccessMsg(`Relatório exportado com ${rows.length} peças de ${nfsData.length} NFs`);
    } catch (err: any) {
      setError(`Erro ao exportar: ${err.message}`);
    } finally {
      setExportingReport(false);
    }
  };

  const handleExportAllXmls = async () => {
    setExportingXmls(true);
    try {
      const unidadeFilter = selectedUnidade || usuario?.unidade_id;
      if (!unidadeFilter) return;

      let query = supabase
        .from('estoque_nfs')
        .select('numero_nf, chave_acesso, xml_conteudo')
        .eq('unidade_id', unidadeFilter)
        .not('xml_conteudo', 'is', null);

      if (nfDateFrom) query = query.gte('data_emissao', nfDateFrom);
      if (nfDateTo) query = query.lte('data_emissao', nfDateTo);
      if (nfSearch.trim()) {
        const s = `%${nfSearch.trim()}%`;
        query = query.or(`numero_nf.ilike.${s},fornecedor.ilike.${s},chave_acesso.ilike.${s},delivery.ilike.${s},xml_conteudo.ilike.${s}`);
      }

      const { data: xmlsData } = await query;
      const validXmls = xmlsData?.filter(x => x.xml_conteudo) || [];
      if (validXmls.length === 0) {
        setError('Nenhum XML disponível para download');
        return;
      }

      if (validXmls.length === 1) {
        const nfXml = validXmls[0];
        const blob = new Blob([nfXml.xml_conteudo!], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nfXml.chave_acesso ? `${nfXml.chave_acesso}.xml` : `NF_${nfXml.numero_nf}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        for (const nfXml of validXmls) {
          const filename = nfXml.chave_acesso ? `${nfXml.chave_acesso}.xml` : `NF_${nfXml.numero_nf}.xml`;
          zip.file(filename, nfXml.xml_conteudo!);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `XMLs_NFs_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccessMsg(`${validXmls.length} XML${validXmls.length > 1 ? 's' : ''} baixado${validXmls.length > 1 ? 's' : ''} com sucesso`);
    } catch (err: any) {
      setError(`Erro ao exportar XMLs: ${err.message}`);
    } finally {
      setExportingXmls(false);
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

      {showPreviewPanel && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 50%, #0a0a0a 100%)',
              border: '1px solid rgba(var(--neon-green-rgb),0.3)',
              borderRadius: 16,
              boxShadow: '0 8px 60px rgba(0,0,0,0.6), 0 0 60px rgba(var(--neon-green-rgb),0.1)',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{
                background: 'linear-gradient(90deg, rgba(var(--neon-green-rgb),0.08) 0%, rgba(var(--neon-green-rgb),0.03) 60%, transparent 100%)',
                borderBottom: '1px solid rgba(var(--neon-green-rgb),0.2)',
                borderRadius: '16px 16px 0 0',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{
                    background: 'rgba(var(--neon-green-rgb),0.1)',
                    border: '1px solid rgba(var(--neon-green-rgb),0.3)',
                  }}
                >
                  <Zap className="w-5 h-5" style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 6px var(--neon-green))' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black tracking-[0.15em] uppercase" style={{ color: 'var(--neon-green)' }}>
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
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {allPecas.length} peças | {totalQtdAlocadas} alocadas | {totalQtdOFS} OFS
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelImport}
                className="p-2 rounded-lg transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div
              className="flex items-center gap-4 px-5 py-2.5 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--neon-green)' }} />
                <span className="text-[11px] text-gray-400">
                  <span style={{ color: 'var(--neon-green)' }}>{requisicoesDisponiveis.length} OS(s)</span> cruzadas
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neon-green)', boxShadow: '0 0 4px var(--neon-green)' }} />
                  <span className="text-[11px] text-gray-300">
                    <span style={{ color: 'var(--neon-green)' }} className="font-bold">{totalQtdAlocadas}</span> OS
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                  <span className="text-[11px] text-gray-400">
                    <span className="text-gray-300 font-bold">{totalQtdOFS}</span> OFS
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(var(--neon-green-rgb),0.3) transparent' }}>
              {allNFs.map((nf, nfIdx) => {
                const nfPecas = allPecas.filter(p => p.nfIndex === nfIdx);
                const nfAlocadas = nfPecas.filter(p => p.os_alocada_id).length;
                const isCollapsed = collapsedNFs[nfIdx];

                return (
                  <div key={nfIdx} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
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
                                        OS {req.os.numero_os_samsung || req.os.numero_os_interna}
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

                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 shrink-0" style={{ color: peca.localizacao ? '#00D4FF' : '#4B5563' }} />
                                <div
                                  className="flex-1 flex items-center gap-1 min-w-0 rounded-lg px-2 py-1.5 cursor-pointer transition-all"
                                  style={{
                                    background: peca.localizacao ? 'rgba(0,212,255,0.06)' : 'rgba(0,0,0,0.3)',
                                    border: peca.localizacao ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
                                  }}
                                  onClick={() => setLocationSelectorPeca({ id_temp: peca.id_temp, pn: peca.pn })}
                                >
                                  <span className="text-[10px] truncate" style={{ color: peca.localizacao ? '#00D4FF' : '#6B7280' }}>
                                    {peca.localizacao || 'Sem localização - clique para definir'}
                                  </span>
                                  {peca.localizacao_sugerida && peca.localizacao === peca.localizacao_sugerida && (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
                                      style={{ background: 'rgba(0,212,255,0.12)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}>
                                      SUGERIDA
                                    </span>
                                  )}
                                </div>
                                {peca.localizacao && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleLocationClear(peca.id_temp); }}
                                    className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
                                    title="Remover localização"
                                  >
                                    <X className="w-3 h-3 text-gray-500" />
                                  </button>
                                )}
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

            <div
              className="flex items-center justify-between px-5 py-4 gap-3 shrink-0"
              style={{
                borderTop: '1px solid rgba(var(--neon-green-rgb),0.15)',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '0 0 16px 16px',
              }}
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" style={{ color: 'var(--neon-green)' }} />
                <span className="text-xs text-gray-400">
                  <span style={{ color: 'var(--neon-green)' }} className="font-black">{totalQtdAlocadas}</span>
                  <span className="text-gray-600"> / </span>
                  <span className="text-gray-300 font-bold">{allPecas.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#9CA3AF',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setAllPecas(prev => prev.map(p => ({ ...p, os_alocada_id: '', requisicao_alocada_id: '', os_peca_id: '' })));
                    handleConfirmAllImport();
                  }}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(0,212,255,0.1)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    color: '#00D4FF',
                  }}
                >
                  <Package className="w-3.5 h-3.5" />
                  Dar Entrada sem Vincular
                </button>
                <button
                  onClick={handleConfirmAllImport}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-black transition-all disabled:opacity-50"
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
          </div>
        </div>,
        document.body
      )}

      {locationSelectorPeca && (
        <LocationSelector
          partNumber={locationSelectorPeca.pn}
          currentUnidadeId={selectedUnidade || usuario?.unidade_id || ''}
          onSelect={(binId, locationText) => {
            handleLocationChange(locationSelectorPeca.id_temp, binId, locationText);
            const currentPeca = allPecas.find(p => p.id_temp === locationSelectorPeca.id_temp);
            if (currentPeca) {
              const samePnWithoutLoc = allPecas.filter(p => p.pn === currentPeca.pn && !p.localizacao && p.id_temp !== currentPeca.id_temp);
              if (samePnWithoutLoc.length > 0) {
                setAllPecas(prev => prev.map(p =>
                  p.pn === currentPeca.pn && !p.localizacao
                    ? { ...p, bin_id: binId, localizacao: locationText }
                    : p
                ));
              }
            }
            setLocationSelectorPeca(null);
          }}
          onClose={() => setLocationSelectorPeca(null)}
        />
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
                <button
                  onClick={() => setShowChaveInput(!showChaveInput)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: showChaveInput ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    color: '#60a5fa',
                  }}
                >
                  <Key className="w-4 h-4" />
                  Importar via Chave de Acesso
                </button>
              </div>
              {showChaveInput && (
                <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <label className="text-xs font-bold text-blue-400 mb-2 block">Chaves de Acesso NF-e (44 dígitos cada, uma por linha - até 100)</label>
                  <textarea
                    value={chaveAcessoInput}
                    onChange={(e) => setChaveAcessoInput(e.target.value)}
                    placeholder={"Cole uma ou mais chaves de acesso (44 dígitos cada).\nUma chave por linha, ex:\n12345678901234567890123456789012345678901234\n98765432109876543210987654321098765432109876"}
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-y"
                    rows={4}
                    disabled={buscandoChave}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const count = chaveAcessoInput.split(/[\n,;]+/).map(l => l.replace(/\D/g, '')).filter(l => l.length === 44).length;
                          return count > 0 ? `${count} chave(s) válida(s) detectada(s)` : 'Nenhuma chave válida detectada';
                        })()}
                      </p>
                      {buscaProgress && (
                        <span className="text-xs text-blue-400 font-medium">
                          Processando {buscaProgress.current}/{buscaProgress.total} ({buscaProgress.found} encontradas)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleBuscarPorChave}
                      disabled={buscandoChave || chaveAcessoInput.split(/[\n,;]+/).map(l => l.replace(/\D/g, '')).filter(l => l.length === 44).length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'var(--neon-green)',
                        color: '#000',
                        boxShadow: '0 0 12px rgba(var(--neon-green-rgb),0.3)',
                      }}
                    >
                      {buscandoChave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {buscandoChave ? 'Buscando XMLs...' : 'Buscar XMLs'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    O sistema consulta o XML de cada NF via Nuvem Fiscal e adiciona às NFs Pendentes de Entrada.
                  </p>
                </div>
              )}
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
            style={{ background: 'rgba(var(--neon-green-rgb),0.06)', border: '1px solid rgba(var(--neon-green-rgb),0.3)' }}
          >
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--neon-green)' }} />
            <p className="text-sm text-gray-200">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
            </button>
          </div>
        )}

        {/* NFs Pendentes de Entrada */}
        {nfPendentes.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black tracking-[0.2em] uppercase flex items-center gap-2" style={{ color: '#FFB800' }}>
                <Clock className="w-4 h-4" />
                NFs Pendentes de Entrada ({nfPendentes.length})
              </h3>
              <button
                onClick={() => setShowPendentes(!showPendentes)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {showPendentes ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {showPendentes && (
              <div className="space-y-2">
                {nfPendentes.map(nf => (
                  <div
                    key={nf.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-all hover:border-yellow-500/40"
                    style={{ background: 'rgba(255,184,0,0.04)', border: '1px solid rgba(255,184,0,0.15)' }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'rgba(255,184,0,0.15)' }}>
                        <FileText className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">NF {nf.numero_nf || '---'}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            PENDENTE
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{nf.fornecedor || 'Fornecedor não identificado'}</span>
                          {nf.data_emissao && <span className="text-xs text-gray-500">{new Date(nf.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                          {nf.valor_total && <span className="text-xs text-emerald-400 font-medium">R$ {Number(nf.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                          {nf.chave_acesso && <span className="text-[10px] text-gray-600 font-mono">...{nf.chave_acesso.slice(-12)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleDarEntrada(nf)}
                        disabled={processandoEntrada === nf.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm text-black transition-all disabled:opacity-50"
                        style={{ background: 'var(--neon-green)', boxShadow: '0 0 12px rgba(var(--neon-green-rgb),0.3)' }}
                      >
                        {processandoEntrada === nf.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                        ) : (
                          <><Download className="w-4 h-4" /> Dar Entrada</>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Deseja remover a NF ${nf.numero_nf || ''} pendente?`)) return;
                          await supabase.from('estoque_nfs').delete().eq('id', nf.id);
                          loadNFsPendentes();
                        }}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Remover NF pendente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: '#00D4FF' }}>
              Notas Fiscais Processadas ({nfTotal})
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportReport}
                disabled={exportingReport || nfTotal === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF' }}
                title="Exportar relatório completo em Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {exportingReport ? 'Exportando...' : 'Relatório'}
              </button>
              <button
                onClick={handleExportAllXmls}
                disabled={exportingXmls || nfTotal === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,191,0,0.08)', border: '1px solid rgba(255,191,0,0.25)', color: '#FFBF00' }}
                title="Baixar todos os XMLs do filtro atual"
              >
                <Archive className="w-3.5 h-3.5" />
                {exportingXmls ? 'Baixando...' : 'Exportar XMLs'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={nfSearch}
                onChange={(e) => {
                  setNfSearch(e.target.value);
                  triggerSearch(e.target.value, nfDateFrom, nfDateTo);
                }}
                placeholder="Buscar NF, PN, delivery, fornecedor, chave..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="date"
                value={nfDateFrom}
                onChange={(e) => {
                  setNfDateFrom(e.target.value);
                  setNfPage(0);
                  loadNFs(0, nfSearch, e.target.value, nfDateTo);
                }}
                className="px-2 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}
              />
              <span className="text-xs text-gray-600">ate</span>
              <input
                type="date"
                value={nfDateTo}
                onChange={(e) => {
                  setNfDateTo(e.target.value);
                  setNfPage(0);
                  loadNFs(0, nfSearch, nfDateFrom, e.target.value);
                }}
                className="px-2 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}
              />
              {(nfSearch || nfDateFrom || nfDateTo) && (
                <button
                  onClick={() => {
                    setNfSearch('');
                    setNfDateFrom('');
                    setNfDateTo('');
                    setNfPage(0);
                    loadNFs(0, '', '', '');
                  }}
                  className="px-2 py-2 rounded-lg text-[10px] font-bold transition-colors hover:bg-white/5"
                  style={{ color: '#FF0064' }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {nfs.length > 0 ? (
            <>
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
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{nf.fornecedor}</span>
                      <span className="text-xs text-gray-600">-</span>
                      <span className="text-xs text-gray-500">{new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</span>
                      {nf.delivery && (
                        <>
                          <span className="text-xs text-gray-600">-</span>
                          <span className="text-xs text-gray-500">{nf.delivery}</span>
                        </>
                      )}
                      {(() => {
                        const meta = parseXMLMeta(nf.xml_conteudo);
                        return meta.xPed ? (
                          <>
                            <span className="text-xs text-gray-600">-</span>
                            <span className="text-xs font-semibold" style={{ color: '#FFBF00' }}>PED.CLIENTE: {meta.xPed}</span>
                          </>
                        ) : null;
                      })()}
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
                    <button onClick={() => handleDownloadXML(nf)} title="Baixar XML" className="p-2 rounded-lg transition-colors hover:bg-white/5">
                      <Code className="w-4 h-4 text-gray-400 hover:text-[#FFBF00] transition-colors" />
                    </button>
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

            {nfTotal > NF_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-gray-500">
                  {nfPage * NF_PER_PAGE + 1}-{Math.min((nfPage + 1) * NF_PER_PAGE, nfTotal)} de {nfTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setNfPage(0); loadNFs(0); }}
                    disabled={nfPage === 0}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronsLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => { const p = nfPage - 1; setNfPage(p); loadNFs(p); }}
                    disabled={nfPage === 0}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <span className="text-xs text-gray-400 px-3">
                    {nfPage + 1} / {Math.ceil(nfTotal / NF_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => { const p = nfPage + 1; setNfPage(p); loadNFs(p); }}
                    disabled={(nfPage + 1) * NF_PER_PAGE >= nfTotal}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => { const p = Math.ceil(nfTotal / NF_PER_PAGE) - 1; setNfPage(p); loadNFs(p); }}
                    disabled={(nfPage + 1) * NF_PER_PAGE >= nfTotal}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronsRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-5 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Package className="w-10 h-10 text-gray-700" />
              </div>
              <p className="text-gray-500 font-medium">
                {nfSearch || nfDateFrom || nfDateTo ? 'Nenhuma NF encontrada com os filtros aplicados' : 'Nenhuma NF importada ainda'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {nfSearch || nfDateFrom || nfDateTo ? 'Tente alterar os filtros de busca' : 'Faca upload de um XML para comecar'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

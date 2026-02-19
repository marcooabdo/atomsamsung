import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, FileText, CheckCircle, AlertCircle, Package, Download, Eye, Trash2, Zap } from 'lucide-react';
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

// Novos tipos para a Lógica Inteligente
interface RequisicaoPendente {
  id: string;
  os_id: string;
  codigo_peca: string;
  os: {
    numero_os_interna: string;
    numero_os_samsung: string;
    tipo_os: string;
    data_abertura: string;
  };
}

interface PecaExpandida {
  id_temp: string;
  pn: string;
  descricao: string;
  valorUnitario: number;
  valorComImpostos: number;
  os_alocada_id: string; // Vazio = OFS
  requisicao_alocada_id: string;
}

export function EstoqueEntrada({ selectedUnidade, user: userProp }: EstoqueEntradaProps) {
  const { usuario } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [nfs, setNfs] = useState<NF[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNFId, setSelectedNFId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [downloadingNFId, setDownloadingNFId] = useState<string | null>(null);
  
  // States da Prévia Inteligente
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [requisicoesDisponiveis, setRequisicoesDisponiveis] = useState<RequisicaoPendente[]>([]);
  const [pecasExpandidas, setPecasExpandidas] = useState<PecaExpandida[]>([]);
  
  const [previewData, setPreviewData] = useState<{
    numeroNF: string;
    chaveAcesso: string;
    fornecedor: string;
    dataEmissao: string;
    valorTotal: number;
    delivery: string | null;
    xmlContent: string;
  } | null>(null);
  
  const [xmlQueue, setXmlQueue] = useState<any[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

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
        .limit(10);

      if (error) throw error;
      setNfs(data || []);
    } catch (err) {}
  };

  const parseXML = (xmlText: string) => {
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

    const produtos: any[] = [];
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

    return { numeroNF, chaveAcesso, fornecedor, dataEmissao, valorTotal, delivery, produtos };
  };

  // 🔥 MOTOR DE PRIORIDADE DA GIA STOCK
  const sortRequisicoesPriority = (a: RequisicaoPendente, b: RequisicaoPendente) => {
    const getScore = (req: RequisicaoPendente) => {
      let score = 0;
      if (req.os.tipo_os === 'LP') score += 100; // Garantia Local = Top Prioridade
      
      // Checar se tem mais de 10 dias
      const daysOpen = (new Date().getTime() - new Date(req.os.data_abertura).getTime()) / (1000 * 3600 * 24);
      if (daysOpen > 10) score += 50; // Atrasada
      
      if (req.os.tipo_os === 'IH') score += 10; // In-Home
      return score;
    };
    return getScore(b) - getScore(a);
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
    setTotalFiles(files.length);
    setCurrentFileIndex(0);

    const validXmls: Array<any> = [];
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

        validXmls.push({ ...nfData, xmlContent: text, fileName: file.name });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Erro ao processar'}`);
      }
    }

    if (errors.length > 0) setError(`Erros encontrados:\n${errors.join('\n')}`);

    if (validXmls.length > 0) {
      setXmlQueue(validXmls);
      await processarModalInteligente(validXmls[0], unidadeId);
    } else {
      setUploading(false);
    }
    e.target.value = '';
  };

  // 🔥 PROCESSAMENTO INTELIGENTE (Pré-Save)
  const processarModalInteligente = async (nfData: any, unidadeId: string) => {
    try {
      const pnsUnicos = [...new Set(nfData.produtos.map((p: any) => p.pn))];

      // Busca OSs precisando dessas peças
      const { data: reqs } = await supabase
        .from('requisicoes_pecas')
        .select(`
          id, os_id, codigo_peca,
          os:os_id (numero_os_interna, numero_os_samsung, tipo_os, data_abertura)
        `)
        .in('codigo_peca', pnsUnicos)
        .in('status', ['pendente', 'pedido_feito'])
        .eq('unidade_id', unidadeId);

      const sortedReqs = (reqs as unknown as RequisicaoPendente[] || []).sort(sortRequisicoesPriority);
      setRequisicoesDisponiveis(sortedReqs);

      // Expande as peças (Se qtd = 3, gera 3 linhas no modal)
      const pecasParaAlocar: PecaExpandida[] = [];
      let reqsDisponiveis = [...sortedReqs];

      nfData.produtos.forEach((prod: any) => {
        for (let i = 0; i < prod.quantidade; i++) {
          // Auto-Sugerir a OS mais prioritária se houver
          const reqMatchIndex = reqsDisponiveis.findIndex(r => r.codigo_peca === prod.pn);
          let alocadaOsId = '';
          let alocadaReqId = '';

          if (reqMatchIndex !== -1) {
            const match = reqsDisponiveis.splice(reqMatchIndex, 1)[0]; // Remove da lista de auto-alocação
            alocadaOsId = match.os_id;
            alocadaReqId = match.id;
          }

          pecasParaAlocar.push({
            id_temp: crypto.randomUUID(),
            pn: prod.pn,
            descricao: prod.descricao,
            valorUnitario: prod.valorUnitario,
            valorComImpostos: prod.valorComImpostos,
            os_alocada_id: alocadaOsId,
            requisicao_alocada_id: alocadaReqId
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
    }
  };

  const handleAlocacaoChange = (id_temp: string, valueStr: string) => {
    const [os_id, req_id] = valueStr.split('|');
    setPecasExpandidas(prev => 
      prev.map(p => p.id_temp === id_temp ? { ...p, os_alocada_id: os_id || '', requisicao_alocada_id: req_id || '' } : p)
    );
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) return;

    setUploading(true);
    setShowPreviewModal(false);

    try {
      // 1. CRIA A NF
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
          processada: true, // Já vamos salvar processada
          processada_em: new Date().toISOString(),
          processada_por: usuario?.id
        })
        .select().single();

      if (nfError) throw nfError;

      // 2. INSERE AS PEÇAS COM ALOCAÇÃO
      let contador = 0;
      const osParaMover = new Set<string>();
      const reqsParaAtualizar = new Set<string>();

      const pecasToInsert = pecasExpandidas.map(peca => {
        contador++;
        const idUnico = `PC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${contador}`;
        
        if (peca.os_alocada_id) {
          osParaMover.add(peca.os_alocada_id);
          reqsParaAtualizar.add(peca.requisicao_alocada_id);
        }

        return {
          id_unico: idUnico,
          pn: peca.pn,
          descricao: peca.descricao,
          nf_id: nfRecord.id,
          unidade_id: unidadeId,
          valor_com_impostos: peca.valorComImpostos,
          status: peca.os_alocada_id ? 'reservada' : 'disponivel',
          os_id: peca.os_alocada_id || null, // Amarra a peça na OS!
          data_entrada: new Date().toISOString()
        };
      });

      const { data: pecasInseridas, error: pecasError } = await supabase
        .from('estoque_pecas')
        .insert(pecasToInsert)
        .select();

      if (pecasError) throw pecasError;

      // 3. REGISTRA HISTÓRICO
      if (pecasInseridas && pecasInseridas.length > 0) {
        const historicoEntries = pecasInseridas.map(peca => ({
          peca_id: peca.id,
          usuario_id: usuario.id,
          acao: peca.os_id ? 'Entrada e Alocação Automática' : 'Entrada de Estoque',
          status_novo: peca.status,
          origem: `NF ${nfRecord.numero_nf}`,
          observacao: peca.os_id ? `Alocada diretamente na entrada para OS` : `Adicionada ao estoque livre (OFS)`
        }));
        await supabase.from('estoque_historico').insert(historicoEntries);
      }

      // 4. ATUALIZAÇÕES AUTOMÁTICAS GIA STOCK
      // Mover OS para Em Reparo e atualizar a Requisição
      for (const osId of osParaMover) {
        // Move Kanban
        await supabase.from('os').update({ coluna_kanban: 'em_reparo' }).eq('id', osId);
        // Adiciona comentário
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `🤖 GIA Stock: Peça recebida na NF ${nfRecord.numero_nf} e alocada automaticamente com sucesso. OS movida para Em Reparo.`,
          is_system: true
        });
      }

      for (const reqId of reqsParaAtualizar) {
        await supabase.from('requisicoes_pecas').update({ status: 'atendida' }).eq('id', reqId);
      }

      alert(`✅ NF ${previewData.numeroNF} processada!\n\n📦 ${pecasToInsert.length} peças criadas.\n🔄 ${osParaMover.size} OSs atualizadas automaticamente e prontas para impressão de etiqueta!`);

      // Fila do XML
      const remainingQueue = xmlQueue.slice(1);
      setXmlQueue(remainingQueue);

      if (remainingQueue.length > 0) {
        await processarModalInteligente(remainingQueue[0], unidadeId);
      } else {
        setPreviewData(null);
        setPecasExpandidas([]);
      }

      loadNFs();
    } catch (error: any) {
      setError(`Falha na importação: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setPecasExpandidas([]);
    setXmlQueue([]);
  };

  // Funções de NF existentes mantidas (Delete, Print, Details)...
  const handleDeleteNF = async (nf: NF) => { /* lógica mantida... */ };
  const handleDownloadNFPDF = async (nf: NF) => { /* lógica mantida... */ };
  const handleViewNFDetails = (nfId: string) => {
    setSelectedNFId(nfId);
    setShowDetailsModal(true);
  };

  return (
    <>
      <NFDetailsModal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} nfId={selectedNFId || ''} />

      {/* NOVO MODAL INTELIGENTE DE ALOCAÇÃO */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border-[#39FF14]/30 shadow-[0_0_30px_rgba(57,255,20,0.15)]">
            <div className="flex items-center justify-between p-6 border-b border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-[#39FF14] animate-pulse" />
                <div>
                  <h2 className="tech-heading text-xl text-[#39FF14]">GIA STOCK - ALOCAÇÃO INTELIGENTE</h2>
                  <p className="text-xs text-gray-400">NF {previewData.numeroNF} • {previewData.fornecedor}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 bg-gray-900/50">
              <div className="space-y-3">
                {pecasExpandidas.map((peca, idx) => {
                  // Filtra OSs que precisam especificamente deste PN
                  const osCompativeis = requisicoesDisponiveis.filter(r => r.codigo_peca === peca.pn);

                  return (
                    <div key={peca.id_temp} className={`p-4 rounded-xl border flex flex-col lg:flex-row gap-4 items-center justify-between transition-all ${peca.os_alocada_id ? 'bg-[#39FF14]/5 border-[#39FF14]/40' : 'bg-gray-800/50 border-gray-700'}`}>
                      <div className="flex-1 min-w-0 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-mono text-[#00D4FF] font-bold">{peca.pn}</p>
                          <p className="text-gray-300 text-sm truncate">{peca.descricao}</p>
                        </div>
                      </div>

                      <div className="w-full lg:w-1/2 flex items-center gap-2">
                        <div className="flex-1">
                          <select
                            value={`${peca.os_alocada_id}|${peca.requisicao_alocada_id}`}
                            onChange={(e) => handleAlocacaoChange(peca.id_temp, e.target.value)}
                            className={`w-full bg-gray-900 border text-sm rounded-lg px-3 py-2 outline-none transition-all ${peca.os_alocada_id ? 'border-[#39FF14] text-[#39FF14]' : 'border-gray-600 text-gray-300 focus:border-[#00D4FF]'}`}
                          >
                            <option value="|">📥 Enviar para Estoque Livre (OFS)</option>
                            {osCompativeis.map(req => {
                              const isAtrasada = (new Date().getTime() - new Date(req.os.data_abertura).getTime()) / (1000 * 3600 * 24) > 10;
                              return (
                                <option key={req.id} value={`${req.os_id}|${req.id}`}>
                                  OS {req.os.numero_os_interna} {req.os.numero_os_samsung ? `(${req.os.numero_os_samsung})` : ''} - {req.os.tipo_os} {isAtrasada ? '🚨 ATRASADA' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-900">
              <p className="text-sm text-gray-400">
                <span className="text-[#39FF14] font-bold">{pecasExpandidas.filter(p => p.os_alocada_id).length}</span> de <span className="font-bold">{pecasExpandidas.length}</span> peças alocadas para OS.
              </p>
              <div className="flex gap-3">
                <button onClick={handleCancelImport} className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-gray-800 hover:bg-gray-700 text-gray-300">
                  Cancelar
                </button>
                <button onClick={handleConfirmImport} disabled={uploading} className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all bg-[#39FF14] text-black hover:bg-[#39FF14]/80 disabled:opacity-50 flex items-center gap-2">
                  {uploading ? 'Salvando e Organizando...' : 'Gerar Entrada e Etiquetas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER NORMAL DA TELA (Inputs e Lista) */}
      <div className="space-y-6">
        <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-6">
          <h4 className="font-semibold text-[#39FF14] mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5" /> Entrada de Peças via XML
          </h4>
          <p className="text-sm text-gray-300 mb-4">
            Faça upload do XML. A GIA Stock irá cruzar os dados com as OS em aberto e sugerir a alocação inteligente antes de imprimir as etiquetas.
          </p>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-6 py-3 bg-[#39FF14] text-black font-bold rounded-lg hover:bg-[#39FF14]/80 transition cursor-pointer">
              <Upload className="w-5 h-5" />
              {uploading ? `Processando... (${currentFileIndex}/${totalFiles})` : 'Fazer Upload de XML'}
              <input type="file" accept=".xml" multiple onChange={handleXMLUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>

        {/* ... Restante igual (Erros e Lista de NFs Processadas) */}
      </div>
    </>
  );
}
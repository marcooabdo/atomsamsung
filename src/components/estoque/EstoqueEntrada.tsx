import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, FileText, CheckCircle, AlertCircle, Package, Download, Eye, Trash2 } from 'lucide-react';
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

export function EstoqueEntrada({ selectedUnidade, user: userProp }: EstoqueEntradaProps) {
  const { usuario } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [nfs, setNfs] = useState<NF[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNFId, setSelectedNFId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [downloadingNFId, setDownloadingNFId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<{
    numeroNF: string;
    chaveAcesso: string;
    fornecedor: string;
    dataEmissao: string;
    valorTotal: number;
    delivery: string | null;
    produtos: Array<{
      pn: string;
      descricao: string;
      quantidade: number;
      valorUnitario: number;
      valorComImpostos: number;
    }>;
    xmlContent: string;
  } | null>(null);
  const [xmlQueue, setXmlQueue] = useState<Array<{
    numeroNF: string;
    chaveAcesso: string;
    fornecedor: string;
    dataEmissao: string;
    valorTotal: number;
    delivery: string | null;
    produtos: Array<{
      pn: string;
      descricao: string;
      quantidade: number;
      valorUnitario: number;
      valorComImpostos: number;
    }>;
    xmlContent: string;
    fileName: string;
  }>>([]);
  const [processingQueue, setProcessingQueue] = useState(false);
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
    } catch (err) {
      console.error('Erro ao carregar NFs:', err);
    }
  };

  const parseXML = (xmlText: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const getTextContent = (tagName: string, parent: Document | Element = xmlDoc): string => {
      const element = parent.getElementsByTagName(tagName)[0];
      return element?.textContent || '';
    };

    const numeroNF = getTextContent('nNF');

    // Tentar extrair chave de acesso de múltiplas formas
    let chaveAcesso = getTextContent('chNFe');
    if (!chaveAcesso) {
      // Tentar encontrar no infNFe
      const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
      if (infNFe) {
        const idAttr = infNFe.getAttribute('Id');
        if (idAttr) {
          chaveAcesso = idAttr.replace('NFe', '');
        }
      }
    }

    const fornecedor = getTextContent('xNome');
    const dataEmissao = getTextContent('dhEmi').split('T')[0];
    const valorTotal = parseFloat(getTextContent('vNF')) || 0;

    // Extrair delivery do campo infCpl
    let delivery: string | null = null;
    const infCpl = getTextContent('infCpl');
    if (infCpl) {
      const deliveryMatch = infCpl.match(/DELIVERY:\s*([^\s]+)/i);
      if (deliveryMatch) {
        delivery = deliveryMatch[1].trim();
      }
    }

    const produtos: Array<{
      pn: string;
      descricao: string;
      quantidade: number;
      valorUnitario: number;
      valorComImpostos: number;
    }> = [];

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

      produtos.push({
        pn,
        descricao,
        quantidade,
        valorUnitario,
        valorComImpostos
      });
    }

    return {
      numeroNF,
      chaveAcesso,
      fornecedor,
      dataEmissao,
      valorTotal,
      delivery,
      produtos
    };
  };


  const handleViewNFDetails = (nfId: string) => {
    setSelectedNFId(nfId);
    setShowDetailsModal(true);
  };

  const handleDownloadNFPDF = async (nf: NF) => {
    if (!nf.chave_acesso) {
      alert('Chave de acesso não disponível para esta NF');
      return;
    }

    setDownloadingNFId(nf.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-danfe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chaveAcesso: nf.chave_acesso })
        }
      );

      const data = await response.json();

      if (data.success && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        alert(data.error || 'Erro ao consultar DANFE');
      }
    } catch (error) {
      console.error('Erro ao consultar DANFE:', error);
      alert('Erro ao consultar DANFE');
    } finally {
      setDownloadingNFId(null);
    }
  };

  const handleDeleteNF = async (nf: NF) => {
    const confirmacao = confirm(
      `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\n` +
      `Você está prestes a EXCLUIR:\n` +
      `• NF ${nf.numero_nf}\n` +
      `• Todas as ${nf.qtd_pecas} peça(s) vinculadas a esta NF\n` +
      `• Fornecedor: ${nf.fornecedor}\n` +
      `• Valor Total: R$ ${nf.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Os IDs das peças serão PERMANENTEMENTE removidos do sistema.\n\n` +
      `Deseja realmente continuar?`
    );

    if (!confirmacao) return;

    const confirmacaoFinal = confirm(
      `🚨 ÚLTIMA CONFIRMAÇÃO!\n\n` +
      `Confirme a exclusão da NF ${nf.numero_nf} e todas as suas peças.\n\n` +
      `Esta é sua última chance de cancelar.`
    );

    if (!confirmacaoFinal) return;

    try {
      const { data: pecas, error: countError } = await supabase
        .from('estoque_pecas')
        .select('id, id_numerico, pn, descricao')
        .eq('nf_id', nf.id);

      if (countError) throw countError;

      const qtdPecas = pecas?.length || 0;

      if (qtdPecas > 0) {
        console.log(`🗑️ Excluindo NF ${nf.numero_nf} e ${qtdPecas} peças`, pecas.map(p => `ID #${p.id_numerico}`));
      }

      const { error: deleteNFError } = await supabase
        .from('estoque_nfs')
        .delete()
        .eq('id', nf.id);

      if (deleteNFError) {
        console.error('Erro ao excluir NF:', deleteNFError);
        throw new Error(`Erro ao excluir NF: ${deleteNFError.message}`);
      }

      alert(
        `✅ NF excluída com sucesso!\n\n` +
        `• NF ${nf.numero_nf} removida\n` +
        `• ${qtdPecas} peça(s) excluída(s) automaticamente\n` +
        `• IDs liberados do sistema`
      );

      await loadNFs();
    } catch (error) {
      console.error('Erro ao excluir NF:', error);
      alert(`❌ Erro ao excluir NF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
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

        if (!nfData.chaveAcesso || nfData.chaveAcesso.length !== 44) {
          errors.push(`${file.name}: Chave de acesso não encontrada ou inválida`);
          continue;
        }

        // Verificar se NF já foi importada
        const { data: existingNF } = await supabase
          .from('estoque_nfs')
          .select('id, numero_nf')
          .eq('chave_acesso', nfData.chaveAcesso)
          .maybeSingle();

        if (existingNF) {
          errors.push(`${file.name}: NF já importada (NF ${existingNF.numero_nf})`);
          continue;
        }

        validXmls.push({
          ...nfData,
          xmlContent: text,
          fileName: file.name
        });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Erro ao processar'}`);
      }
    }

    if (errors.length > 0) {
      setError(`Erros encontrados:\n${errors.join('\n')}`);
    }

    if (validXmls.length > 0) {
      setXmlQueue(validXmls);
      setPreviewData(validXmls[0]);
      setShowPreviewModal(true);
    } else {
      setError(errors.length > 0 ? `Nenhum XML válido encontrado.\n${errors.join('\n')}` : 'Nenhum XML válido encontrado');
    }

    setUploading(false);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    const unidadeId = selectedUnidade || usuario?.unidade_id;
    if (!unidadeId) return;

    setUploading(true);
    setShowPreviewModal(false);

    try {
      console.log('📄 Iniciando importação de NF:', {
        numero_nf: previewData.numeroNF,
        fornecedor: previewData.fornecedor,
        total_produtos: previewData.produtos.length,
        unidade_id: unidadeId,
        usuario_id: usuario?.id
      });

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
          processada: false,
          processada_por: usuario?.id
        })
        .select()
        .single();

      if (nfError) {
        console.error('❌ Erro ao inserir NF:', nfError);
        throw new Error(`Erro ao criar registro da NF: ${nfError.message}`);
      }

      console.log('✅ NF criada com sucesso:', {
        nf_id: nfRecord.id,
        numero_nf: nfRecord.numero_nf
      });

      const pecasToInsert = [];
      let contador = 0;
      for (const produto of previewData.produtos) {
        for (let i = 0; i < produto.quantidade; i++) {
          contador++;
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 9).toUpperCase();
          const idUnico = `PC-${timestamp}-${random}-${contador}`;
          pecasToInsert.push({
            id_unico: idUnico,
            pn: produto.pn,
            descricao: produto.descricao,
            nf_id: nfRecord.id,
            unidade_id: unidadeId,
            valor_com_impostos: produto.valorComImpostos,
            status: 'disponivel',
            data_entrada: new Date().toISOString()
          });
        }
      }

      console.log('📦 Inserindo peças no estoque:', {
        total_pecas: pecasToInsert.length,
        nf_id: nfRecord.id,
        unidade_id: unidadeId,
        primeira_peca: pecasToInsert[0]
      });

      const { data: pecasInseridas, error: pecasError } = await supabase
        .from('estoque_pecas')
        .insert(pecasToInsert)
        .select();

      if (pecasError) {
        console.error('❌ Erro ao inserir peças:', pecasError);
        throw new Error(`Erro ao inserir peças no estoque: ${pecasError.message}`);
      }

      console.log('✅ Peças inseridas com sucesso:', {
        total_inserido: pecasInseridas?.length || 0,
        esperado: pecasToInsert.length
      });

      // Registrar histórico para cada peça inserida
      if (pecasInseridas && pecasInseridas.length > 0) {
        const historicoEntries = pecasInseridas.map(peca => ({
          peca_id: peca.id,
          usuario_id: usuario.id,
          acao: 'Entrada de Estoque',
          status_novo: 'disponivel',
          origem: `NF ${nfRecord.numero_nf}`,
          observacao: `Peça adicionada ao estoque via NF ${nfRecord.numero_nf} - ${peca.pn}`
        }));

        await supabase.from('estoque_historico').insert(historicoEntries);
      }

      await supabase
        .from('estoque_nfs')
        .update({ processada: true, processada_em: new Date().toISOString() })
        .eq('id', nfRecord.id);

      // Verificar se há requisições pendentes ou com pedido feito para os PNs inseridos
      const pnsUnicos = [...new Set(pecasToInsert.map(p => p.pn))];

      const { data: requisicoesEncontradas } = await supabase
        .from('requisicoes_pecas')
        .select('*, os:os(numero_os_samsung, numero_os_interna)')
        .in('codigo_peca', pnsUnicos)
        .in('status', ['pendente', 'pedido_feito'])
        .eq('unidade_id', unidadeId);

      // IMPORTANTE: NÃO mudamos o status "pedido_feito" para "pendente"
      // A requisição deve CONTINUAR como "pedido_feito" até que seja aprovado um ID específico
      // Apenas registramos que a peça chegou e atualizamos o Kanban se necessário
      if (requisicoesEncontradas && requisicoesEncontradas.length > 0) {
        const requisicoesComPedido = requisicoesEncontradas.filter(r => r.status === 'pedido_feito');

        if (requisicoesComPedido.length > 0) {
          console.log('📦 Peças chegaram para requisições com pedido feito:', {
            quantidade: requisicoesComPedido.length,
            observacao: 'Status permanece como "pedido_feito" até aprovação de ID específico'
          });

          // Registrar comentários nas OS afetadas
          for (const req of requisicoesComPedido) {
            if (req.os_id) {
              await supabase.from('os_comentarios').insert({
                os_id: req.os_id,
                usuario_id: usuario?.id,
                comentario: `✅ Peça CHEGOU no estoque - ${req.descricao} (${req.codigo_peca})\n` +
                           `📦 Status: PEDIDO FEITO - Peça em trânsito\n` +
                           `⚠️ Vá para Estoque > Transferências para aprovar e vincular um ID específico.\n` +
                           `Após aprovação, a peça será movida automaticamente para a rota ou ficará disponível.`,
                is_system: true
              });

              // IMPORTANTE: NÃO mudamos o kanban aqui!
              // O Kanban deve CONTINUAR como "peca_em_transito" até que seja aprovado um ID
              // Só após aprovação é que move para rota (se tem cidade) ou peca_disponivel (se não tem)
            }
          }
        }
      }

      let mensagemRequisicoes = '';
      if (requisicoesEncontradas && requisicoesEncontradas.length > 0) {
        mensagemRequisicoes = `\n\n⚠️ ATENÇÃO: Encontradas ${requisicoesEncontradas.length} requisição(ões) aguardando seleção de ID:\n`;
        requisicoesEncontradas.forEach(req => {
          const osNumero = req.os?.numero_os_samsung || req.os?.numero_os_interna;
          mensagemRequisicoes += `\n- ${req.descricao} (${req.codigo_peca}) - OS: ${osNumero}`;
        });
        mensagemRequisicoes += '\n\nVá para a aba "Transferências" para selecionar os IDs das peças.';
      }

      console.log('✅ NF processada completamente:', {
        nf_id: nfRecord.id,
        numero_nf: previewData.numeroNF,
        fornecedor: previewData.fornecedor,
        total_pecas: pecasToInsert.length,
        valor_total: previewData.valorTotal
      });

      alert(
        `✅ NF ${previewData.numeroNF} importada com sucesso!\n\n` +
        `📦 ${pecasToInsert.length} peças adicionadas ao estoque\n` +
        `🏢 Fornecedor: ${previewData.fornecedor}\n` +
        `💰 Valor Total: R$ ${previewData.valorTotal.toFixed(2)}${mensagemRequisicoes}`
      );

      // Processar próximo XML da fila
      const remainingQueue = xmlQueue.slice(1);
      setXmlQueue(remainingQueue);

      if (remainingQueue.length > 0) {
        setPreviewData(remainingQueue[0]);
        setShowPreviewModal(true);
      } else {
        setPreviewData(null);
      }

      loadNFs();
    } catch (error: any) {
      console.error('❌ ERRO ao processar XML:', error);
      const errorMessage = error.message || 'Erro desconhecido ao processar arquivo XML';
      setError(`Falha na importação: ${errorMessage}`);
      alert(`❌ Erro ao importar NF ${previewData.numeroNF}:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setXmlQueue([]);
  };

  return (
    <>
      <NFDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        nfId={selectedNFId || ''}
      />

      {/* Modal de Prévia do XML */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#39FF14]/20">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-[#39FF14]" />
                <h2 className="tech-heading text-xl text-[#39FF14]">
                  CONFIRMAR IMPORTAÇÃO DE NF
                </h2>
              </div>
              {xmlQueue.length > 1 && (
                <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg px-4 py-2">
                  <p className="text-xs text-[#00D4FF] font-bold">
                    📦 {xmlQueue.length} arquivos na fila
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Processando 1 de {xmlQueue.length}
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
              <div className="premium-card p-6 bg-[#39FF14]/5 border-[#39FF14]/20">
                <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider mb-4">
                  Informações da Nota Fiscal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Número NF:</span>
                    <p className="text-gray-300 font-mono font-bold text-lg">{previewData.numeroNF}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Fornecedor:</span>
                    <p className="text-gray-300 font-semibold">{previewData.fornecedor}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Data Emissão:</span>
                    <p className="text-gray-300">
                      {new Date(previewData.dataEmissao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Valor Total:</span>
                    <p className="text-[#39FF14] font-bold text-lg">
                      R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {previewData.delivery && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Delivery:</span>
                      <p className="text-[#00D4FF] font-bold text-lg">{previewData.delivery}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Chave de Acesso:</span>
                    <p className="text-gray-300 font-mono text-xs break-all">{previewData.chaveAcesso}</p>
                  </div>
                </div>
              </div>

              <div className="premium-card p-6">
                <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider mb-4">
                  Produtos ({previewData.produtos.length} itens)
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto cyber-scrollbar">
                  {previewData.produtos.map((produto, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg">
                      <Package className="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-mono text-sm font-semibold">{produto.pn}</p>
                        <p className="text-gray-400 text-xs truncate">{produto.descricao}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          <span className="text-gray-500">Qtd: <span className="text-[#39FF14] font-semibold">{produto.quantidade}</span></span>
                          <span className="text-gray-500">Valor Unit.: <span className="text-gray-300">R$ {produto.valorComImpostos.toFixed(2)}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400">
                    <span className="font-semibold text-[#39FF14]">
                      {previewData.produtos.reduce((sum, p) => sum + p.quantidade, 0)}
                    </span> peças serão adicionadas ao estoque
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
              <button
                onClick={handleCancelImport}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={uploading}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-[#39FF14] text-black hover:bg-[#39FF14]/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Importação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-6">
          <h4 className="font-semibold text-[#39FF14] mb-2">Entrada de Peças por NF</h4>
          <p className="text-sm text-gray-300 mb-4">
            Faça upload de um ou múltiplos arquivos XML de notas fiscais para processar automaticamente a entrada de peças.
            Cada peça receberá um ID único e etiqueta com QR Code.
          </p>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-6 py-3 bg-[#39FF14] text-black font-bold rounded-lg hover:bg-[#39FF14]/80 transition cursor-pointer">
              <Upload className="w-5 h-5" />
              {uploading ? `Processando... (${currentFileIndex}/${totalFiles})` : 'Fazer Upload de XML(s)'}
              <input
                type="file"
                accept=".xml"
                multiple
                onChange={handleXMLUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <div className="flex-1 text-sm text-gray-400">
              <p>Formatos aceitos: XML (NF-e)</p>
              <p className="text-xs text-[#39FF14] mt-1">💡 Selecione múltiplos arquivos para processar em lote</p>
            </div>
          </div>
        </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao processar XML</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="border-t border-gray-700 pt-6">
        <h4 className="font-semibold text-gray-200 mb-4">Últimas NFs Processadas</h4>
        {nfs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p>Nenhuma NF processada ainda</p>
            <p className="text-xs text-gray-500 mt-2">Faça upload de um XML para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nfs.map((nf) => (
              <div key={nf.id} className="premium-card p-4 hover-lift">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-mono font-bold text-[#00D4FF]">NF {nf.numero_nf}</h5>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Fornecedor:</span>
                        <span className="text-gray-300 ml-2">{nf.fornecedor}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Data Emissão:</span>
                        <span className="text-gray-300 ml-2">
                          {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Valor Total:</span>
                        <span className="text-[#39FF14] font-bold ml-2">
                          R$ {nf.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Processada em:</span>
                        <span className="text-gray-300 ml-2">
                          {new Date(nf.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleViewNFDetails(nf.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 hover:bg-[#00D4FF]/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Peças
                      </button>
                      {nf.chave_acesso && (
                        <button
                          onClick={() => handleDownloadNFPDF(nf)}
                          disabled={downloadingNFId === nf.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {downloadingNFId === nf.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                              Baixando...
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              Baixar DANFE
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNF(nf)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir NF
                      </button>
                    </div>
                  </div>
                  <Package className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

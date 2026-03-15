import { useState, useEffect } from 'react';
import { FileDown, FileText, Calendar, Filter, Truck, MapPin, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PecaRequisicao {
  id: string;
  codigo_peca: string;
  descricao: string;
  id_peca: string | null;
  delivery: string | null;
  quantidade_requisitada: number;
  status: string;
}

interface OSRomaneio {
  id: string;
  numero_os: string;
  numero_os_samsung: string | null;
  numero_os_interna: string;
  cliente_nome: string;
  aparelho_modelo: string;
  endereco_completo: string;
  periodo_agendamento: string | null;
  data_agendamento: string;
  cidade: string;
  tecnico_agendado_id: string;
  tecnico_nome: string;
  pecas: PecaRequisicao[];
}

interface RomaneioPorTecnico {
  tecnico_id: string;
  tecnico_nome: string;
  cidades: {
    [cidade: string]: OSRomaneio[];
  };
}

export default function RomaneioView() {
  const { selectedUnidade, loading } = useOtimizador();
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [romaneios, setRomaneios] = useState<RomaneioPorTecnico[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedTecnico, setExpandedTecnico] = useState<string | null>(null);
  const [expandedCidade, setExpandedCidade] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (selectedUnidade) {
      loadRomaneioData();
    }
  }, [selectedUnidade, dataInicio, dataFim]);

  const loadRomaneioData = async () => {
    setLoadingData(true);
    try {
      const { data: osAgendadas, error: osError } = await supabase
        .from('os')
        .select(`
          id,
          numero_os,
          numero_os_samsung,
          numero_os_interna,
          cliente_nome,
          aparelho_modelo,
          endereco_logradouro,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          periodo_agendamento,
          data_agendamento,
          tecnico_agendado_id,
          tipo_orcamento,
          usuarios!os_tecnico_agendado_id_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .eq('tipo_atendimento', 'IH')
        .gte('data_agendamento', dataInicio)
        .lte('data_agendamento', dataFim)
        .not('data_agendamento', 'is', null)
        .not('tecnico_agendado_id', 'is', null)
        .order('data_agendamento');

      if (osError) throw osError;

      const filteredOS = (osAgendadas || []).filter((os: any) =>
        os.tipo_orcamento !== 'samsung_contigo' && os.tipo_orcamento !== 'acessorios'
      );

      const osIds = filteredOS.map((os: any) => os.id);

      if (osIds.length === 0) {
        setRomaneios([]);
        setLoadingData(false);
        return;
      }

      const { data: requisicoes, error: reqError } = await supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
            id_numerico,
            estoque_etiquetas(delivery)
          )
        `)
        .in('os_id', osIds)
        .in('status', ['pendente', 'atendida', 'em_uso']);

      if (reqError) throw reqError;

      const loteIds: string[] = [];
      (requisicoes || []).forEach((req: any) => {
        if (req.is_lote && req.pecas_estoque_ids?.length > 0) {
          loteIds.push(...req.pecas_estoque_ids);
        }
      });

      let loteMap = new Map<string, { id_numerico: number; delivery: string | null }>();
      if (loteIds.length > 0) {
        const { data: loteData } = await supabase
          .from('estoque_pecas')
          .select('id, id_numerico, estoque_etiquetas(delivery)')
          .in('id', loteIds);
        (loteData || []).forEach((p: any) => {
          loteMap.set(p.id, {
            id_numerico: p.id_numerico,
            delivery: p.estoque_etiquetas?.[0]?.delivery || null
          });
        });
      }

      const osComPecas: OSRomaneio[] = filteredOS
        .map((os: any) => {
          const pecas = (requisicoes || [])
            .filter((req: any) => req.os_id === os.id)
            .map((req: any) => {
              let idPeca: string | null = null;
              let delivery: string | null = null;

              if (req.is_lote && req.pecas_estoque_ids?.length > 0) {
                const ids = req.pecas_estoque_ids.map((pid: string) => {
                  const info = loteMap.get(pid);
                  return info ? `#${info.id_numerico}` : null;
                }).filter(Boolean);
                idPeca = ids.join(', ') || null;

                const deliveries = req.pecas_estoque_ids.map((pid: string) => {
                  return loteMap.get(pid)?.delivery;
                }).filter(Boolean);
                delivery = deliveries.join(', ') || null;
              } else if (req.peca_estoque) {
                idPeca = req.peca_estoque.id_numerico ? `#${req.peca_estoque.id_numerico}` : null;
                delivery = req.peca_estoque.estoque_etiquetas?.[0]?.delivery || null;
              }

              return {
                id: req.id,
                codigo_peca: req.codigo_peca,
                descricao: req.descricao || '',
                id_peca: idPeca,
                delivery,
                quantidade_requisitada: req.quantidade_requisitada,
                status: req.status
              };
            });

          if (pecas.length === 0) return null;

          return {
            id: os.id,
            numero_os: os.numero_os,
            numero_os_samsung: os.numero_os_samsung,
            numero_os_interna: os.numero_os_interna || '',
            cliente_nome: os.cliente_nome,
            aparelho_modelo: os.aparelho_modelo || '',
            endereco_completo: [os.endereco_logradouro, os.endereco_numero, os.endereco_bairro].filter(Boolean).join(', '),
            periodo_agendamento: os.periodo_agendamento,
            data_agendamento: os.data_agendamento,
            cidade: os.endereco_cidade || 'Nao informado',
            tecnico_agendado_id: os.tecnico_agendado_id!,
            tecnico_nome: (os as any).usuarios?.nome || 'Nao atribuido',
            pecas
          };
        })
        .filter((os: any): os is OSRomaneio => os !== null);

      const agrupadoPorTecnico = osComPecas.reduce((acc, os) => {
        const tecnicoKey = os.tecnico_agendado_id;
        if (!acc[tecnicoKey]) {
          acc[tecnicoKey] = { tecnico_id: os.tecnico_agendado_id, tecnico_nome: os.tecnico_nome, cidades: {} };
        }
        const cidade = os.cidade;
        if (!acc[tecnicoKey].cidades[cidade]) {
          acc[tecnicoKey].cidades[cidade] = [];
        }
        acc[tecnicoKey].cidades[cidade].push(os);
        return acc;
      }, {} as { [key: string]: RomaneioPorTecnico });

      setRomaneios(Object.values(agrupadoPorTecnico));
    } catch (error) {
      console.error('Erro ao carregar romaneio:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    romaneios.forEach(romaneio => {
      const rows: any[] = [];
      rows.push([`ROMANEIO - ${romaneio.tecnico_nome.toUpperCase()}`]);
      rows.push([`Periodo: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`]);
      rows.push([]);
      rows.push(['Cidade', 'OS Samsung', 'OS Interna', 'Cliente', 'Aparelho', 'Endereco', 'Periodo', 'PN', 'Descricao', 'ID Peca', 'Delivery', 'Qtd', 'Status']);

      Object.entries(romaneio.cidades).forEach(([cidade, oss]) => {
        oss.forEach(os => {
          os.pecas.forEach((peca, index) => {
            rows.push([
              index === 0 ? cidade : '',
              index === 0 ? os.numero_os_samsung || '' : '',
              index === 0 ? os.numero_os_interna : '',
              index === 0 ? os.cliente_nome : '',
              index === 0 ? os.aparelho_modelo : '',
              index === 0 ? os.endereco_completo : '',
              index === 0 ? os.periodo_agendamento || 'N/D' : '',
              peca.codigo_peca,
              peca.descricao,
              peca.id_peca || 'N/A',
              peca.delivery || 'N/A',
              peca.quantidade_requisitada,
              peca.status
            ]);
          });
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 20 },
        { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 10 },
        { wch: 12 }, { wch: 6 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, romaneio.tecnico_nome.slice(0, 30));
    });

    const resumoRows: any[] = [['RESUMO GERAL'], [], ['Tecnico', 'Total OSs', 'Total Pecas', 'Cidades']];
    romaneios.forEach(romaneio => {
      const totalOs = Object.values(romaneio.cidades).reduce((sum, oss) => sum + oss.length, 0);
      const totalPecas = Object.values(romaneio.cidades)
        .reduce((sum, oss) => sum + oss.reduce((s, os) => s + os.pecas.reduce((ps, p) => ps + p.quantidade_requisitada, 0), 0), 0);
      resumoRows.push([romaneio.tecnico_nome, totalOs, totalPecas, Object.keys(romaneio.cidades).join(', ')]);
    });

    const resumoWs = XLSX.utils.aoa_to_sheet(resumoRows);
    resumoWs['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');

    XLSX.writeFile(wb, `ROMANEIO_${dataInicio}_${dataFim}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF('landscape');
    let pageNumber = 1;

    romaneios.forEach((romaneio, romaneioIndex) => {
      if (romaneioIndex > 0) doc.addPage();

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ROMANEIO DE PECAS', 14, 15);
      doc.setFontSize(11);
      doc.text(`Tecnico: ${romaneio.tecnico_nome}`, 14, 23);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periodo: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`, 14, 30);

      let startY = 36;

      Object.entries(romaneio.cidades).forEach(([cidade, oss]) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(cidade, 14, startY);
        startY += 4;

        const tableData: any[] = [];
        oss.forEach(os => {
          os.pecas.forEach((peca, index) => {
            tableData.push([
              index === 0 ? os.numero_os_samsung || os.numero_os_interna : '',
              index === 0 ? os.cliente_nome : '',
              index === 0 ? os.aparelho_modelo : '',
              index === 0 ? os.periodo_agendamento || 'N/D' : '',
              peca.codigo_peca,
              peca.id_peca || 'N/A',
              peca.delivery || 'N/A',
              peca.quantidade_requisitada,
              peca.status
            ]);
          });
        });

        autoTable(doc, {
          startY,
          head: [['OS', 'Cliente', 'Aparelho', 'Periodo', 'PN', 'ID Peca', 'Delivery', 'Qtd', 'Status']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [6, 182, 212], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 25 }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 },
            3: { cellWidth: 20 }, 4: { cellWidth: 28 }, 5: { cellWidth: 20 },
            6: { cellWidth: 20 }, 7: { cellWidth: 12 }, 8: { cellWidth: 18 }
          },
          margin: { left: 14, right: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 8;
        if (startY > 180) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.setFontSize(8);
      doc.text(`Pagina ${pageNumber}`, 270, 200);
      pageNumber++;
    });

    doc.save(`ROMANEIO_${dataInicio}_${dataFim}.pdf`);
  };

  const toggleTecnico = (tecnicoId: string) => {
    setExpandedTecnico(expandedTecnico === tecnicoId ? null : tecnicoId);
  };

  const toggleCidade = (key: string) => {
    setExpandedCidade(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalOs = romaneios.reduce((sum, r) =>
    sum + Object.values(r.cidades).reduce((s, oss) => s + oss.length, 0), 0
  );

  const totalPecas = romaneios.reduce((sum, r) =>
    sum + Object.values(r.cidades).reduce((s, oss) =>
      s + oss.reduce((ps, os) =>
        ps + os.pecas.reduce((p, peca) => p + peca.quantidade_requisitada, 0), 0
      ), 0
    ), 0
  );

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-600">
            Romaneio de Pecas
          </h2>
          <p className="text-gray-400 mt-1">Separacao de pecas por tecnico, OS IH (exceto SC/ACC)</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportarExcel}
            disabled={romaneios.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            <FileDown className="w-5 h-5 text-green-400" />
            <span className="text-green-400 text-sm">Excel</span>
          </button>
          <button
            onClick={exportarPDF}
            disabled={romaneios.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Filter className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs mb-1.5 block">Data Inicio</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1.5 block">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-5">
          <p className="text-gray-400 text-xs">Tecnicos</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">{romaneios.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-5">
          <p className="text-gray-400 text-xs">OSs com Pecas</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{totalOs}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-5">
          <p className="text-gray-400 text-xs">Total Pecas</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{totalPecas}</p>
        </div>
      </div>

      {romaneios.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nenhuma OS IH agendada com pecas requisitadas no periodo</p>
          <p className="text-gray-500 text-sm mt-2">Ajuste as datas para ver os romaneios disponiveis</p>
        </div>
      ) : (
        <div className="space-y-4">
          {romaneios.map(romaneio => {
            const tecOsCount = Object.values(romaneio.cidades).reduce((sum, oss) => sum + oss.length, 0);
            const tecPecaCount = Object.values(romaneio.cidades).reduce((sum, oss) =>
              sum + oss.reduce((s, os) => s + os.pecas.reduce((ps, p) => ps + p.quantidade_requisitada, 0), 0), 0
            );

            return (
              <div key={romaneio.tecnico_id} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                <div
                  className="p-4 bg-gradient-to-r from-orange-500/20 to-transparent border-b border-gray-700 cursor-pointer hover:bg-orange-500/30 transition-colors"
                  onClick={() => toggleTecnico(romaneio.tecnico_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className="w-6 h-6 text-orange-400" />
                      <div>
                        <h3 className="text-lg font-bold text-white">{romaneio.tecnico_nome}</h3>
                        <p className="text-gray-400 text-sm">{tecOsCount} OSs / {tecPecaCount} pecas</p>
                      </div>
                    </div>
                    {expandedTecnico === romaneio.tecnico_id
                      ? <ChevronDown className="w-5 h-5 text-gray-400" />
                      : <ChevronRight className="w-5 h-5 text-gray-400" />
                    }
                  </div>
                </div>

                {expandedTecnico === romaneio.tecnico_id && (
                  <div className="p-4 space-y-4">
                    {Object.entries(romaneio.cidades).map(([cidade, oss]) => {
                      const key = `${romaneio.tecnico_id}-${cidade}`;
                      return (
                        <div key={key} className="bg-gray-700/30 border border-gray-600 rounded-lg overflow-hidden">
                          <div
                            className="p-3 bg-gradient-to-r from-blue-500/15 to-transparent border-b border-gray-600 cursor-pointer hover:bg-blue-500/20 transition-colors"
                            onClick={() => toggleCidade(key)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                <span className="text-white font-bold text-sm">{cidade}</span>
                                <span className="text-gray-400 text-xs">({oss.length} OSs)</span>
                              </div>
                              {expandedCidade[key]
                                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                : <ChevronRight className="w-4 h-4 text-gray-400" />
                              }
                            </div>
                          </div>

                          {expandedCidade[key] && (
                            <div className="p-3 space-y-3">
                              {oss.map(os => (
                                <div key={os.id} className="bg-gray-800/60 border border-gray-600 rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-bold text-sm">
                                          OS: {os.numero_os_samsung || os.numero_os_interna}
                                        </span>
                                        {os.numero_os_samsung && os.numero_os_interna && (
                                          <span className="text-gray-500 text-xs">({os.numero_os_interna})</span>
                                        )}
                                        {os.periodo_agendamento && (
                                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400">
                                            {os.periodo_agendamento}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-gray-400 text-xs mt-0.5">{os.cliente_nome}</p>
                                      <p className="text-gray-500 text-xs">{os.aparelho_modelo}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-gray-500 text-xs">{os.endereco_completo}</p>
                                      <p className="text-gray-600 text-xs">{new Date(os.data_agendamento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 mt-2">
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Pecas:</p>
                                    {os.pecas.map(peca => (
                                      <div key={peca.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-sm gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-white font-mono text-xs font-bold">{peca.codigo_peca}</span>
                                            {peca.id_peca && (
                                              <span className="text-cyan-400 font-mono text-xs bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                                {peca.id_peca}
                                              </span>
                                            )}
                                            {peca.delivery && (
                                              <span className="text-orange-400 font-mono text-xs bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                                                DL: {peca.delivery}
                                              </span>
                                            )}
                                          </div>
                                          {peca.descricao && (
                                            <p className="text-gray-500 text-xs truncate mt-0.5">{peca.descricao}</p>
                                          )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-cyan-400 font-bold text-xs">Qtd: {peca.quantidade_requisitada}</p>
                                          <p className="text-gray-500 text-xs">{peca.status}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

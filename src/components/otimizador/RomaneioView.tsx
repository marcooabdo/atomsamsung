import { useState, useEffect } from 'react';
import { FileDown, FileText, Calendar, Filter, Truck, MapPin, Package } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PecaRequisicao {
  id: string;
  codigo_peca: string;
  id_peca: string | null;
  delivery: string | null;
  quantidade_requisitada: number;
  status: string;
}

interface OSRomaneio {
  id: string;
  numero_os: string;
  numero_os_samsung: string | null;
  cliente_nome: string;
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
          cliente_nome,
          endereco_logradouro,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          periodo_agendamento,
          data_agendamento,
          tecnico_agendado_id,
          usuarios!os_tecnico_agendado_id_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .gte('data_agendamento', dataInicio)
        .lte('data_agendamento', dataFim)
        .not('data_agendamento', 'is', null)
        .not('tecnico_agendado_id', 'is', null)
        .order('data_agendamento');

      if (osError) throw osError;

      const osIds = osAgendadas?.map(os => os.id) || [];

      if (osIds.length === 0) {
        setRomaneios([]);
        setLoadingData(false);
        return;
      }

      const { data: requisicoes, error: reqError } = await supabase
        .from('requisicoes_pecas')
        .select('*')
        .in('os_id', osIds)
        .in('status', ['pendente', 'atendida', 'em_uso']);

      if (reqError) throw reqError;

      const osComPecas: OSRomaneio[] = (osAgendadas || [])
        .map(os => {
          const pecas = (requisicoes || [])
            .filter(req => req.os_id === os.id)
            .map(req => ({
              id: req.id,
              codigo_peca: req.codigo_peca,
              id_peca: req.id_peca_atribuida,
              delivery: req.delivery,
              quantidade_requisitada: req.quantidade_requisitada,
              status: req.status
            }));

          if (pecas.length === 0) return null;

          return {
            id: os.id,
            numero_os: os.numero_os,
            numero_os_samsung: os.numero_os_samsung,
            cliente_nome: os.cliente_nome,
            endereco_completo: `${os.endereco_logradouro}, ${os.endereco_numero} - ${os.endereco_bairro}`,
            periodo_agendamento: os.periodo_agendamento,
            data_agendamento: os.data_agendamento,
            cidade: os.endereco_cidade || 'Não informado',
            tecnico_agendado_id: os.tecnico_agendado_id!,
            tecnico_nome: os.usuarios?.nome || 'Não atribuído',
            pecas
          };
        })
        .filter((os): os is OSRomaneio => os !== null);

      const agrupadoPorTecnico = osComPecas.reduce((acc, os) => {
        const tecnicoKey = os.tecnico_agendado_id;

        if (!acc[tecnicoKey]) {
          acc[tecnicoKey] = {
            tecnico_id: os.tecnico_agendado_id,
            tecnico_nome: os.tecnico_nome,
            cidades: {}
          };
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
      console.error('Erro ao carregar dados do romaneio:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    romaneios.forEach(romaneio => {
      const rows: any[] = [];

      rows.push([`ROMANEIO - ${romaneio.tecnico_nome.toUpperCase()}`]);
      rows.push([`Período: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`]);
      rows.push([]);
      rows.push(['Cidade', 'OS', 'Cliente', 'Endereço', 'Período', 'PN', 'ID Peça', 'Delivery', 'Qtd', 'Status']);

      Object.entries(romaneio.cidades).forEach(([cidade, oss]) => {
        oss.forEach(os => {
          os.pecas.forEach((peca, index) => {
            rows.push([
              index === 0 ? cidade : '',
              index === 0 ? os.numero_os_samsung || os.numero_os : '',
              index === 0 ? os.cliente_nome : '',
              index === 0 ? os.endereco_completo : '',
              index === 0 ? os.periodo_agendamento || 'Não definido' : '',
              peca.codigo_peca,
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
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 35 },
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 8 },
        { wch: 12 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, romaneio.tecnico_nome.slice(0, 30));
    });

    const resumoRows: any[] = [];
    resumoRows.push(['RESUMO GERAL']);
    resumoRows.push([]);
    resumoRows.push(['Técnico', 'Total OSs', 'Total Peças', 'Cidades']);

    romaneios.forEach(romaneio => {
      const totalOs = Object.values(romaneio.cidades).reduce((sum, oss) => sum + oss.length, 0);
      const totalPecas = Object.values(romaneio.cidades)
        .reduce((sum, oss) => sum + oss.reduce((s, os) => s + os.pecas.reduce((ps, p) => ps + p.quantidade_requisitada, 0), 0), 0);
      const cidades = Object.keys(romaneio.cidades).join(', ');

      resumoRows.push([romaneio.tecnico_nome, totalOs, totalPecas, cidades]);
    });

    const resumoWs = XLSX.utils.aoa_to_sheet(resumoRows);
    resumoWs['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');

    const nomeArquivo = `ROMANEIO_${selectedUnidade}_${dataInicio}_${dataFim}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    let pageNumber = 1;

    romaneios.forEach((romaneio, romaneioIndex) => {
      if (romaneioIndex > 0) {
        doc.addPage();
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`ROMANEIO DE PEÇAS`, 14, 15);

      doc.setFontSize(12);
      doc.text(`Técnico: ${romaneio.tecnico_nome}`, 14, 25);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`, 14, 32);

      let startY = 40;

      Object.entries(romaneio.cidades).forEach(([cidade, oss]) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${cidade}`, 14, startY);
        startY += 5;

        const tableData: any[] = [];
        oss.forEach(os => {
          os.pecas.forEach((peca, index) => {
            tableData.push([
              index === 0 ? os.numero_os_samsung || os.numero_os : '',
              index === 0 ? os.cliente_nome : '',
              index === 0 ? os.periodo_agendamento || 'N/D' : '',
              peca.codigo_peca,
              peca.id_peca || 'N/A',
              peca.delivery || 'N/A',
              peca.quantidade_requisitada
            ]);
          });
        });

        autoTable(doc, {
          startY: startY,
          head: [['OS', 'Cliente', 'Período', 'PN', 'ID Peça', 'Delivery', 'Qtd']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [6, 182, 212], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 45 },
            2: { cellWidth: 20 },
            3: { cellWidth: 30 },
            4: { cellWidth: 25 },
            5: { cellWidth: 20 },
            6: { cellWidth: 15 }
          },
          margin: { left: 14, right: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 10;

        if (startY > 250) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.setFontSize(8);
      doc.text(`Página ${pageNumber}`, 190, 285);
      pageNumber++;
    });

    const nomeArquivo = `ROMANEIO_${selectedUnidade}_${dataInicio}_${dataFim}.pdf`;
    doc.save(nomeArquivo);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-600">
            Romaneio de Peças
          </h2>
          <p className="text-gray-400 mt-1">Controle de peças por técnico e cidade</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportarExcel}
            disabled={romaneios.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            <FileDown className="w-5 h-5 text-green-400" />
            <span className="text-green-400">Exportar Excel</span>
          </button>
          <button
            onClick={exportarPDF}
            disabled={romaneios.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5 text-red-400" />
            <span className="text-red-400">Exportar PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-bold text-white">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Técnicos</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{romaneios.length}</p>
            </div>
            <Truck className="w-12 h-12 text-orange-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de OSs</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{totalOs}</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Peças</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{totalPecas}</p>
            </div>
            <Package className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      {romaneios.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nenhuma OS agendada com peças requisitadas no período selecionado</p>
          <p className="text-gray-500 text-sm mt-2">Ajuste os filtros de data para ver os romaneios disponíveis</p>
        </div>
      ) : (
        <div className="space-y-4">
          {romaneios.map(romaneio => (
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
                      <p className="text-gray-400 text-sm">
                        {Object.values(romaneio.cidades).reduce((sum, oss) => sum + oss.length, 0)} OSs · {' '}
                        {Object.values(romaneio.cidades).reduce((sum, oss) =>
                          sum + oss.reduce((s, os) => s + os.pecas.reduce((ps, p) => ps + p.quantidade_requisitada, 0), 0), 0
                        )} peças
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {expandedTecnico === romaneio.tecnico_id ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {expandedTecnico === romaneio.tecnico_id && (
                <div className="p-4 space-y-4">
                  {Object.entries(romaneio.cidades).map(([cidade, oss]) => {
                    const key = `${romaneio.tecnico_id}-${cidade}`;
                    return (
                      <div key={key} className="bg-gray-700/30 border border-gray-600 rounded-lg overflow-hidden">
                        <div
                          className="p-3 bg-gradient-to-r from-blue-500/20 to-transparent border-b border-gray-600 cursor-pointer hover:bg-blue-500/30 transition-colors"
                          onClick={() => toggleCidade(key)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-blue-400" />
                              <span className="text-white font-bold">{cidade}</span>
                              <span className="text-gray-400 text-sm">({oss.length} OSs)</span>
                            </div>
                            <div className="text-gray-400 text-sm">
                              {expandedCidade[key] ? '▼' : '▶'}
                            </div>
                          </div>
                        </div>

                        {expandedCidade[key] && (
                          <div className="p-3 space-y-3">
                            {oss.map(os => (
                              <div key={os.id} className="bg-gray-800/50 border border-gray-600 rounded p-3">
                                <div className="mb-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-white font-bold">
                                      OS: {os.numero_os_samsung || os.numero_os}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400">
                                      {os.periodo_agendamento || 'Não definido'}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 text-sm">{os.cliente_nome}</p>
                                  <p className="text-gray-500 text-xs">{os.endereco_completo}</p>
                                </div>

                                <div className="space-y-2 mt-3">
                                  <p className="text-gray-400 text-xs font-bold uppercase">Peças:</p>
                                  {os.pecas.map(peca => (
                                    <div key={peca.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-sm">
                                      <div className="flex-1">
                                        <p className="text-white font-mono">{peca.codigo_peca}</p>
                                        <p className="text-gray-400 text-xs">
                                          ID: {peca.id_peca || 'N/A'} · Delivery: {peca.delivery || 'N/A'}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-cyan-400 font-bold">Qtd: {peca.quantidade_requisitada}</p>
                                        <p className="text-xs text-gray-500">{peca.status}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}

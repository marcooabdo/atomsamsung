import { supabase } from './supabase';

interface Rota {
  id: string;
  nome: string;
  cor: string | null;
  cidades: string[];
}

const normalizarCidade = (cidade: string | null | undefined) =>
  cidade?.trim().replace(/\s+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || '';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export async function exportAguardandoPecaExcel({
  unidadeId,
  allUserUnits,
  rotas,
}: {
  unidadeId?: string;
  allUserUnits?: string[];
  rotas: Rota[];
}): Promise<number> {
  const XLSX = await import('xlsx');

  let query = supabase
    .from('os')
    .select(`
      id,
      numero_os_samsung,
      numero_os_interna,
      tipo_atendimento,
      cliente_cidade,
      aparelho_modelo,
      unidade_id,
      os_pecas:os_pecas(
        pn,
        codigo,
        descricao,
        valor_unitario,
        valor_gspn,
        quantidade
      ),
      requisicoes:requisicoes_pecas(
        id,
        status,
        descricao,
        codigo_peca,
        valor_peca,
        quantidade_requisitada
      )
    `)
    .eq('coluna_kanban', 'aguardando_peca');

  if (unidadeId) {
    if (allUserUnits && allUserUnits.length > 1) {
      query = query.in('unidade_id', allUserUnits);
    } else {
      query = query.eq('unidade_id', unidadeId);
    }
  }

  const { data: osData, error } = await query;
  if (error) throw error;
  if (!osData || osData.length === 0) return 0;

  const unidadeIds = [...new Set(osData.map(os => os.unidade_id).filter(Boolean))];

  const { data: kmData } = await supabase
    .from('rotas_cidades_km')
    .select('unidade_id, cidade, distancia_km_ida_volta')
    .in('unidade_id', unidadeIds);

  const kmMap = new Map<string, number>();
  kmData?.forEach(row => {
    kmMap.set(`${row.unidade_id}:${normalize(row.cidade)}`, row.distancia_km_ida_volta);
  });

  const findRota = (cidade: string): Rota | undefined => {
    if (!cidade) return undefined;
    const cidadeNorm = normalize(cidade);
    return rotas.find(r => r.cidades.some(c => normalize(c) === cidadeNorm));
  };

  const corParaNome = (hex: string): string => {
    const cores: Record<string, string> = {
      '#ef4444': 'Vermelha', '#f44336': 'Vermelha', '#e53935': 'Vermelha',
      '#f97316': 'Laranja', '#ff9800': 'Laranja',
      '#eab308': 'Amarela', '#ffeb3b': 'Amarela', '#ffc107': 'Amarela',
      '#22c55e': 'Verde', '#4caf50': 'Verde', '#10b981': 'Verde',
      '#3b82f6': 'Azul', '#2196f3': 'Azul', '#1e88e5': 'Azul',
      '#8b5cf6': 'Roxa', '#9c27b0': 'Roxa', '#7c3aed': 'Roxa',
      '#ec4899': 'Rosa', '#e91e63': 'Rosa',
      '#6b7280': 'Cinza', '#9e9e9e': 'Cinza', '#78909c': 'Cinza',
      '#000000': 'Preta', '#ffffff': 'Branca',
      '#14b8a6': 'Teal', '#06b6d4': 'Ciano',
      '#f59e0b': 'Âmbar', '#a855f7': 'Roxa',
    };
    const lower = hex?.toLowerCase();
    return cores[lower] || hex || '';
  };

  let maxPecas = 0;
  const processedRows = osData.map((os: any) => {
    const allPecas: { descricao: string; valor: number }[] = [];

    const osPecas = os.os_pecas || [];
    osPecas.forEach((p: any) => {
      allPecas.push({
        descricao: p.descricao || p.codigo || p.pn || 'S/N',
        valor: parseFloat(p.valor_gspn) || 0,
      });
    });

    const requisicoes = os.requisicoes || [];
    requisicoes.forEach((r: any) => {
      const isDuplicate = osPecas.some((p: any) => (p.codigo || p.pn) === r.codigo_peca);
      if (!isDuplicate) {
        allPecas.push({
          descricao: r.descricao || r.codigo_peca || 'S/N',
          valor: parseFloat(r.valor_peca) || 0,
        });
      }
    });

    if (allPecas.length > maxPecas) maxPecas = allPecas.length;

    const cidade = normalizarCidade(os.cliente_cidade);
    const rota = findRota(os.cliente_cidade || '');
    const kmKey = os.unidade_id && os.cliente_cidade
      ? `${os.unidade_id}:${normalize(os.cliente_cidade)}`
      : '';
    const km = kmKey ? kmMap.get(kmKey) || '' : '';

    return {
      os: os.numero_os_samsung || os.numero_os_interna || '',
      tipoOS: os.numero_os_samsung ? 'Samsung' : 'Interna',
      cidade,
      corRota: rota && rota.cor ? corParaNome(rota.cor) : '',
      tipoAtendimento: (os.tipo_atendimento || '').toUpperCase(),
      km,
      modelo: os.aparelho_modelo || '',
      pecas: allPecas,
    };
  });

  const rows = processedRows.map(r => {
    const row: Record<string, any> = {
      'OS': r.os,
      'Tipo': r.tipoOS,
      'Cidade': r.cidade,
      'Cor Rota': r.corRota,
      'IH/CI': r.tipoAtendimento,
      'KM Ida e Volta': r.km,
      'Modelo': r.modelo,
    };

    for (let i = 0; i < maxPecas; i++) {
      const peca = r.pecas[i];
      row[`Peça ${i + 1}`] = peca?.descricao || '';
      row[`Valor ${i + 1}`] = peca?.valor || '';
    }

    return row;
  });

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 18 }, // OS
    { wch: 10 }, // Tipo
    { wch: 20 }, // Cidade
    { wch: 12 }, // Cor Rota
    { wch: 8 },  // IH/CI
    { wch: 14 }, // KM
    { wch: 25 }, // Modelo
  ];
  for (let i = 0; i < maxPecas; i++) {
    colWidths.push({ wch: 30 }); // Peça
    colWidths.push({ wch: 12 }); // Valor
  }
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, ws, 'Aguardando Peça');

  const fileName = `Aguardando_Peca_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return osData.length;
}

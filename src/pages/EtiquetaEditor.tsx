import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import JsBarcode from 'jsbarcode';
import {
  Printer, Save, FolderOpen, Plus, Trash2, Type, BarChart3, Image as ImageIcon,
  Move, Settings, Minus, Square, RotateCw, Copy, AlignLeft, AlignCenter, AlignRight,
  Bold, ChevronDown, Eye, Star, X, Check, Loader2, Download, Upload
} from 'lucide-react';

interface ElementoEtiqueta {
  id: string;
  tipo: 'texto' | 'codigo_barras' | 'imagem' | 'linha' | 'retangulo';
  x: number;
  y: number;
  largura: number;
  altura: number;
  conteudo: string;
  fonte_tamanho: number;
  fonte_negrito: boolean;
  rotacao: number;
  cor: string;
  imagem_url?: string;
  alinhamento?: 'left' | 'center' | 'right';
  borda_largura?: number;
  borda_cor?: string;
  fundo_cor?: string;
}

interface Template {
  id: string;
  nome: string;
  descricao: string;
  largura_mm: number;
  altura_mm: number;
  elementos: ElementoEtiqueta[];
  is_padrao: boolean;
}

interface LabelData {
  id_sequencial?: string;
  codigo_barras?: string;
  data_emissao?: string;
  part_number?: string;
  descricao?: string;
  delivery?: string;
  localizacao?: string;
  nf_numero?: string;
  tecnico_nome?: string;
  os_numero?: string;
  os_samsung?: string;
  unidade_nome?: string;
}

const VARIAVEIS_DISPONIVEIS = [
  { var: '{{peca_codigo}}', label: 'Codigo da Peca', exemplo: 'GH82-12345' },
  { var: '{{peca_descricao}}', label: 'Descricao', exemplo: 'Display LCD' },
  { var: '{{peca_id}}', label: 'ID Sequencial', exemplo: 'P-00123' },
  { var: '{{nf_numero}}', label: 'Numero da NF', exemplo: '12345' },
  { var: '{{nf_delivery}}', label: 'Delivery', exemplo: 'DEL123456' },
  { var: '{{data_entrada}}', label: 'Data de Entrada', exemplo: '12/02/2026' },
  { var: '{{data_atual}}', label: 'Data Atual', exemplo: '12/02/2026' },
  { var: '{{localizacao}}', label: 'Localizacao', exemplo: 'A1-B2' },
  { var: '{{tecnico_nome}}', label: 'Tecnico', exemplo: 'Joao Silva' },
  { var: '{{os_numero}}', label: 'OS Interna', exemplo: 'G1234' },
  { var: '{{os_samsung}}', label: 'OS Samsung', exemplo: '4175123456' },
  { var: '{{unidade_nome}}', label: 'Unidade', exemplo: 'Matriz' },
];

const MM_TO_PX = 3.78;

export default function EtiquetaEditor() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateAtual, setTemplateAtual] = useState<Template | null>(null);
  const [elementos, setElementos] = useState<ElementoEtiqueta[]>([]);
  const [elementoSelecionado, setElementoSelecionado] = useState<string | null>(null);
  const [larguraMm, setLarguraMm] = useState(40);
  const [alturaMm, setAlturaMm] = useState(40);
  const [nomeTemplate, setNomeTemplate] = useState('Novo Template');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVariaveis, setShowVariaveis] = useState(false);
  const [dadosEtiqueta, setDadosEtiqueta] = useState<LabelData[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('unidade_id')
          .eq('id', user.id)
          .single();
        if (usuario?.unidade_id) {
          setUnidadeId(usuario.unidade_id);
        }
      }

      const dadosParam = searchParams.get('dados');
      if (dadosParam) {
        try {
          const dados = JSON.parse(decodeURIComponent(dadosParam));
          setDadosEtiqueta(Array.isArray(dados) ? dados : [dados]);
        } catch {
          console.error('Erro ao parsear dados');
        }
      }

      setLoading(false);
    };
    init();
  }, [searchParams]);

  useEffect(() => {
    if (unidadeId) {
      loadTemplates();
    }
  }, [unidadeId]);

  const loadTemplates = async () => {
    if (!unidadeId) return;

    const { data } = await supabase
      .from('etiquetas_templates')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('is_padrao', { ascending: false })
      .order('nome');

    if (data && data.length > 0) {
      setTemplates(data);
      const padrao = data.find(t => t.is_padrao) || data[0];
      if (padrao) {
        carregarTemplate(padrao);
      }
    } else {
      criarTemplateInicial();
    }
  };

  const criarTemplateInicial = () => {
    const elementosIniciais: ElementoEtiqueta[] = [
      {
        id: 'el-1',
        tipo: 'texto',
        x: 2,
        y: 2,
        largura: 36,
        altura: 5,
        conteudo: '{{peca_id}}',
        fonte_tamanho: 11,
        fonte_negrito: true,
        rotacao: 0,
        cor: '#000000',
        alinhamento: 'left'
      },
      {
        id: 'el-2',
        tipo: 'texto',
        x: 2,
        y: 7,
        largura: 20,
        altura: 4,
        conteudo: '{{data_entrada}}',
        fonte_tamanho: 8,
        fonte_negrito: false,
        rotacao: 0,
        cor: '#666666',
        alinhamento: 'right'
      },
      {
        id: 'el-3',
        tipo: 'codigo_barras',
        x: 2,
        y: 12,
        largura: 36,
        altura: 14,
        conteudo: '{{peca_codigo}}',
        fonte_tamanho: 8,
        fonte_negrito: false,
        rotacao: 0,
        cor: '#000000'
      },
      {
        id: 'el-4',
        tipo: 'texto',
        x: 2,
        y: 27,
        largura: 36,
        altura: 4,
        conteudo: '{{peca_descricao}}',
        fonte_tamanho: 7,
        fonte_negrito: false,
        rotacao: 0,
        cor: '#333333',
        alinhamento: 'center'
      },
      {
        id: 'el-5',
        tipo: 'texto',
        x: 2,
        y: 33,
        largura: 36,
        altura: 5,
        conteudo: '{{localizacao}}',
        fonte_tamanho: 9,
        fonte_negrito: true,
        rotacao: 0,
        cor: '#000000',
        alinhamento: 'center',
        fundo_cor: '#f0f0f0'
      }
    ];
    setElementos(elementosIniciais);
    setNomeTemplate('Etiqueta Padrao');
  };

  const carregarTemplate = (template: Template) => {
    setTemplateAtual(template);
    setNomeTemplate(template.nome);
    setLarguraMm(template.largura_mm);
    setAlturaMm(template.altura_mm);
    setElementos(template.elementos || []);
    setElementoSelecionado(null);
    setShowTemplates(false);
  };

  const salvarTemplate = async (comoNovo = false) => {
    if (!unidadeId) return;
    setSaving(true);

    const templateData = {
      unidade_id: unidadeId,
      nome: nomeTemplate,
      largura_mm: larguraMm,
      altura_mm: alturaMm,
      elementos: elementos,
      is_padrao: templateAtual?.is_padrao || templates.length === 0
    };

    try {
      if (templateAtual && !comoNovo) {
        await supabase
          .from('etiquetas_templates')
          .update(templateData)
          .eq('id', templateAtual.id);
      } else {
        const { data } = await supabase
          .from('etiquetas_templates')
          .insert(templateData)
          .select()
          .single();
        if (data) {
          setTemplateAtual(data);
        }
      }
      await loadTemplates();
      setShowSaveModal(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const definirComoPadrao = async (templateId: string) => {
    await supabase
      .from('etiquetas_templates')
      .update({ is_padrao: true })
      .eq('id', templateId);
    await loadTemplates();
  };

  const excluirTemplate = async (templateId: string) => {
    if (!confirm('Excluir este template?')) return;
    await supabase
      .from('etiquetas_templates')
      .delete()
      .eq('id', templateId);
    if (templateAtual?.id === templateId) {
      setTemplateAtual(null);
      criarTemplateInicial();
    }
    await loadTemplates();
  };

  const adicionarElemento = (tipo: ElementoEtiqueta['tipo']) => {
    const novoId = `el-${Date.now()}`;
    const novo: ElementoEtiqueta = {
      id: novoId,
      tipo,
      x: 5,
      y: 5,
      largura: tipo === 'linha' ? 30 : 20,
      altura: tipo === 'codigo_barras' ? 12 : tipo === 'linha' ? 1 : 6,
      conteudo: tipo === 'texto' ? 'Texto' : tipo === 'codigo_barras' ? '{{peca_codigo}}' : '',
      fonte_tamanho: 10,
      fonte_negrito: false,
      rotacao: 0,
      cor: '#000000',
      alinhamento: 'left'
    };
    setElementos([...elementos, novo]);
    setElementoSelecionado(novoId);
  };

  const atualizarElemento = (id: string, updates: Partial<ElementoEtiqueta>) => {
    setElementos(elementos.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removerElemento = (id: string) => {
    setElementos(elementos.filter(el => el.id !== id));
    if (elementoSelecionado === id) setElementoSelecionado(null);
  };

  const duplicarElemento = (id: string) => {
    const el = elementos.find(e => e.id === id);
    if (!el) return;
    const novoId = `el-${Date.now()}`;
    setElementos([...elementos, { ...el, id: novoId, x: el.x + 2, y: el.y + 2 }]);
    setElementoSelecionado(novoId);
  };

  const handleMouseDown = (e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    setElementoSelecionado(elId);
    setIsDragging(true);
    const el = elementos.find(e => e.id === elId);
    if (el && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom / MM_TO_PX;
      const y = (e.clientY - rect.top) / zoom / MM_TO_PX;
      setDragOffset({ x: x - el.x, y: y - el.y });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !elementoSelecionado || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(larguraMm - 5, (e.clientX - rect.left) / zoom / MM_TO_PX - dragOffset.x));
    const y = Math.max(0, Math.min(alturaMm - 5, (e.clientY - rect.top) / zoom / MM_TO_PX - dragOffset.y));
    atualizarElemento(elementoSelecionado, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }, [isDragging, elementoSelecionado, dragOffset, larguraMm, alturaMm, zoom]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const substituirVariaveis = (texto: string, dados: LabelData): string => {
    return texto
      .replace(/\{\{peca_codigo\}\}/g, dados.part_number || dados.codigo_barras || '')
      .replace(/\{\{peca_descricao\}\}/g, dados.descricao || '')
      .replace(/\{\{peca_id\}\}/g, dados.id_sequencial || '')
      .replace(/\{\{nf_numero\}\}/g, dados.nf_numero || '')
      .replace(/\{\{nf_delivery\}\}/g, dados.delivery || '')
      .replace(/\{\{data_entrada\}\}/g, dados.data_emissao || '')
      .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{localizacao\}\}/g, dados.localizacao || '')
      .replace(/\{\{tecnico_nome\}\}/g, dados.tecnico_nome || '')
      .replace(/\{\{os_numero\}\}/g, dados.os_numero || '')
      .replace(/\{\{os_samsung\}\}/g, dados.os_samsung || '')
      .replace(/\{\{unidade_nome\}\}/g, dados.unidade_nome || '');
  };

  const renderElemento = (el: ElementoEtiqueta, dados?: LabelData, isPreview = false) => {
    const conteudo = dados ? substituirVariaveis(el.conteudo, dados) : el.conteudo;
    const estilo: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x * MM_TO_PX}px`,
      top: `${el.y * MM_TO_PX}px`,
      width: `${el.largura * MM_TO_PX}px`,
      height: `${el.altura * MM_TO_PX}px`,
      transform: el.rotacao ? `rotate(${el.rotacao}deg)` : undefined,
      cursor: isPreview ? 'default' : 'move',
      userSelect: 'none',
    };

    if (el.tipo === 'texto') {
      return (
        <div
          key={el.id}
          style={{
            ...estilo,
            color: el.cor,
            fontSize: `${el.fonte_tamanho}pt`,
            fontWeight: el.fonte_negrito ? 'bold' : 'normal',
            textAlign: el.alinhamento || 'left',
            backgroundColor: el.fundo_cor || 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: el.alinhamento === 'center' ? 'center' : el.alinhamento === 'right' ? 'flex-end' : 'flex-start',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 2px',
            boxSizing: 'border-box',
            borderRadius: el.fundo_cor ? '2px' : undefined,
          }}
          className={!isPreview && elementoSelecionado === el.id ? 'ring-2 ring-cyan-400' : ''}
          onMouseDown={!isPreview ? (e) => handleMouseDown(e, el.id) : undefined}
        >
          {conteudo}
        </div>
      );
    }

    if (el.tipo === 'codigo_barras') {
      return (
        <div
          key={el.id}
          style={estilo}
          className={!isPreview && elementoSelecionado === el.id ? 'ring-2 ring-cyan-400' : ''}
          onMouseDown={!isPreview ? (e) => handleMouseDown(e, el.id) : undefined}
        >
          <BarcodeRenderer value={conteudo} width={el.largura * MM_TO_PX} height={el.altura * MM_TO_PX} />
        </div>
      );
    }

    if (el.tipo === 'linha') {
      return (
        <div
          key={el.id}
          style={{
            ...estilo,
            backgroundColor: el.cor,
            height: `${(el.borda_largura || 1) * MM_TO_PX}px`,
          }}
          className={!isPreview && elementoSelecionado === el.id ? 'ring-2 ring-cyan-400' : ''}
          onMouseDown={!isPreview ? (e) => handleMouseDown(e, el.id) : undefined}
        />
      );
    }

    if (el.tipo === 'retangulo') {
      return (
        <div
          key={el.id}
          style={{
            ...estilo,
            backgroundColor: el.fundo_cor || 'transparent',
            border: `${el.borda_largura || 1}px solid ${el.borda_cor || el.cor}`,
          }}
          className={!isPreview && elementoSelecionado === el.id ? 'ring-2 ring-cyan-400' : ''}
          onMouseDown={!isPreview ? (e) => handleMouseDown(e, el.id) : undefined}
        />
      );
    }

    if (el.tipo === 'imagem' && el.imagem_url) {
      return (
        <img
          key={el.id}
          src={el.imagem_url}
          style={estilo}
          className={!isPreview && elementoSelecionado === el.id ? 'ring-2 ring-cyan-400' : ''}
          onMouseDown={!isPreview ? (e) => handleMouseDown(e, el.id) : undefined}
          alt=""
        />
      );
    }

    return null;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = dadosEtiqueta.map((dados, idx) => {
      const elementsHtml = elementos.map(el => {
        const conteudo = substituirVariaveis(el.conteudo, dados);

        if (el.tipo === 'codigo_barras') {
          const canvas = document.createElement('canvas');
          try {
            JsBarcode(canvas, conteudo || 'ERRO', {
              format: 'CODE128',
              width: 1.5,
              height: el.altura * MM_TO_PX * 0.7,
              displayValue: true,
              fontSize: 8,
              margin: 2
            });
            return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.largura}mm;height:${el.altura}mm;text-align:center;">
              <img src="${canvas.toDataURL()}" style="max-width:100%;max-height:100%;" />
            </div>`;
          } catch {
            return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;">ERRO</div>`;
          }
        }

        if (el.tipo === 'texto') {
          return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.largura}mm;height:${el.altura}mm;
            font-size:${el.fonte_tamanho}pt;font-weight:${el.fonte_negrito ? 'bold' : 'normal'};
            color:${el.cor};text-align:${el.alinhamento || 'left'};
            background:${el.fundo_cor || 'transparent'};
            display:flex;align-items:center;justify-content:${el.alinhamento === 'center' ? 'center' : el.alinhamento === 'right' ? 'flex-end' : 'flex-start'};
            overflow:hidden;white-space:nowrap;padding:0 1mm;box-sizing:border-box;
            ${el.fundo_cor ? 'border-radius:1mm;' : ''}">
            ${conteudo}
          </div>`;
        }

        if (el.tipo === 'linha') {
          return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.largura}mm;height:${el.borda_largura || 0.3}mm;background:${el.cor};"></div>`;
        }

        if (el.tipo === 'retangulo') {
          return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.largura}mm;height:${el.altura}mm;
            background:${el.fundo_cor || 'transparent'};border:${el.borda_largura || 0.3}mm solid ${el.borda_cor || el.cor};"></div>`;
        }

        return '';
      }).join('');

      return `<div class="label" style="position:relative;width:${larguraMm}mm;height:${alturaMm}mm;page-break-after:always;box-sizing:border-box;">${elementsHtml}</div>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas</title>
        <style>
          @page { size: ${larguraMm}mm ${alturaMm}mm; margin: 0; }
          @media print { body { margin: 0; padding: 0; } .label:last-child { page-break-after: auto; } }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .label { background: white; }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const elementoAtual = elementos.find(e => e.id === elementoSelecionado);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#1A1A2E] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-cyan-400">Editor de Etiquetas</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{larguraMm}mm x {alturaMm}mm</span>
            {templateAtual?.is_padrao && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3 h-3 fill-current" /> Padrao
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
          >
            <FolderOpen className="w-4 h-4" /> Templates
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-sm"
          >
            <Save className="w-4 h-4" /> Salvar
          </button>
          {dadosEtiqueta.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-green-500 text-black font-medium hover:bg-green-400 text-sm"
            >
              <Printer className="w-4 h-4" /> Imprimir ({dadosEtiqueta.length})
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Ferramentas */}
        <div className="w-64 bg-[#1A1A2E] border-r border-white/10 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Dimensoes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Dimensoes</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">Largura (mm)</label>
                <input
                  type="number"
                  value={larguraMm}
                  onChange={(e) => setLarguraMm(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Altura (mm)</label>
                <input
                  type="number"
                  value={alturaMm}
                  onChange={(e) => setAlturaMm(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Adicionar Elementos */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Adicionar</h3>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => adicionarElemento('texto')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs"
              >
                <Type className="w-3 h-3" /> Texto
              </button>
              <button
                onClick={() => adicionarElemento('codigo_barras')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs"
              >
                <BarChart3 className="w-3 h-3" /> Barras
              </button>
              <button
                onClick={() => adicionarElemento('linha')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs"
              >
                <Minus className="w-3 h-3" /> Linha
              </button>
              <button
                onClick={() => adicionarElemento('retangulo')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs"
              >
                <Square className="w-3 h-3" /> Retangulo
              </button>
            </div>
          </div>

          {/* Variaveis */}
          <div className="space-y-2">
            <button
              onClick={() => setShowVariaveis(!showVariaveis)}
              className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase"
            >
              Variaveis Dinamicas
              <ChevronDown className={`w-3 h-3 transition-transform ${showVariaveis ? 'rotate-180' : ''}`} />
            </button>
            {showVariaveis && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {VARIAVEIS_DISPONIVEIS.map(v => (
                  <button
                    key={v.var}
                    onClick={() => {
                      if (elementoSelecionado && elementoAtual) {
                        atualizarElemento(elementoSelecionado, {
                          conteudo: elementoAtual.conteudo + v.var
                        });
                      }
                    }}
                    className="w-full text-left px-2 py-1 rounded bg-white/5 hover:bg-cyan-500/20 text-[10px]"
                  >
                    <span className="text-cyan-400">{v.var}</span>
                    <span className="text-gray-500 ml-1">- {v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Propriedades do Elemento Selecionado */}
          {elementoAtual && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">Propriedades</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => duplicarElemento(elementoAtual.id)}
                    className="p-1 hover:bg-white/10 rounded"
                    title="Duplicar"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removerElemento(elementoAtual.id)}
                    className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                    title="Remover"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {(elementoAtual.tipo === 'texto' || elementoAtual.tipo === 'codigo_barras') && (
                <div>
                  <label className="text-[10px] text-gray-500">Conteudo</label>
                  <input
                    type="text"
                    value={elementoAtual.conteudo}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { conteudo: e.target.value })}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500">X (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={elementoAtual.x}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { x: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Y (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={elementoAtual.y}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { y: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Largura</label>
                  <input
                    type="number"
                    step="0.5"
                    value={elementoAtual.largura}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { largura: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Altura</label>
                  <input
                    type="number"
                    step="0.5"
                    value={elementoAtual.altura}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { altura: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                  />
                </div>
              </div>

              {elementoAtual.tipo === 'texto' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">Tamanho</label>
                      <input
                        type="number"
                        value={elementoAtual.fonte_tamanho}
                        onChange={(e) => atualizarElemento(elementoAtual.id, { fonte_tamanho: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Cor</label>
                      <input
                        type="color"
                        value={elementoAtual.cor}
                        onChange={(e) => atualizarElemento(elementoAtual.id, { cor: e.target.value })}
                        className="w-full h-7 bg-white/5 border border-white/10 rounded"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => atualizarElemento(elementoAtual.id, { fonte_negrito: !elementoAtual.fonte_negrito })}
                      className={`p-1.5 rounded ${elementoAtual.fonte_negrito ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5'}`}
                    >
                      <Bold className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoAtual.id, { alinhamento: 'left' })}
                      className={`p-1.5 rounded ${elementoAtual.alinhamento === 'left' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5'}`}
                    >
                      <AlignLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoAtual.id, { alinhamento: 'center' })}
                      className={`p-1.5 rounded ${elementoAtual.alinhamento === 'center' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5'}`}
                    >
                      <AlignCenter className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoAtual.id, { alinhamento: 'right' })}
                      className={`p-1.5 rounded ${elementoAtual.alinhamento === 'right' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5'}`}
                    >
                      <AlignRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Cor de Fundo</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={elementoAtual.fundo_cor || '#ffffff'}
                        onChange={(e) => atualizarElemento(elementoAtual.id, { fundo_cor: e.target.value })}
                        className="w-10 h-7 bg-white/5 border border-white/10 rounded"
                      />
                      <button
                        onClick={() => atualizarElemento(elementoAtual.id, { fundo_cor: undefined })}
                        className="flex-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px]"
                      >
                        Sem fundo
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] text-gray-500">Rotacao</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={elementoAtual.rotacao}
                    onChange={(e) => atualizarElemento(elementoAtual.id, { rotacao: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-xs w-10">{elementoAtual.rotacao}°</span>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Elementos */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Elementos ({elementos.length})</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {elementos.map((el, idx) => (
                <button
                  key={el.id}
                  onClick={() => setElementoSelecionado(el.id)}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 ${
                    elementoSelecionado === el.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {el.tipo === 'texto' && <Type className="w-3 h-3" />}
                  {el.tipo === 'codigo_barras' && <BarChart3 className="w-3 h-3" />}
                  {el.tipo === 'linha' && <Minus className="w-3 h-3" />}
                  {el.tipo === 'retangulo' && <Square className="w-3 h-3" />}
                  <span className="truncate flex-1">{el.conteudo || el.tipo}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-[#0D0D1A] p-8 overflow-auto flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} className="p-1 hover:bg-white/10 rounded">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-16 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(4, zoom + 0.5))} className="p-1 hover:bg-white/10 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="bg-white relative shadow-2xl"
              style={{
                width: `${larguraMm * MM_TO_PX * zoom}px`,
                height: `${alturaMm * MM_TO_PX * zoom}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => setElementoSelecionado(null)}
            >
              <div style={{ transform: `scale(${1/zoom})`, transformOrigin: 'top left', width: `${larguraMm * MM_TO_PX * zoom}px`, height: `${alturaMm * MM_TO_PX * zoom}px` }}>
                {elementos.map(el => renderElemento(el, dadosEtiqueta[previewIndex]))}
              </div>
            </div>

            {/* Preview Navigation */}
            {dadosEtiqueta.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                  disabled={previewIndex === 0}
                  className="px-2 py-1 bg-white/10 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span>{previewIndex + 1} / {dadosEtiqueta.length}</span>
                <button
                  onClick={() => setPreviewIndex(Math.min(dadosEtiqueta.length - 1, previewIndex + 1))}
                  disabled={previewIndex === dadosEtiqueta.length - 1}
                  className="px-2 py-1 bg-white/10 rounded disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A2E] rounded-xl border border-white/10 w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold">Templates Salvos</h3>
              <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum template salvo</p>
              ) : (
                templates.map(t => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      templateAtual?.id === t.id ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <button
                      onClick={() => carregarTemplate(t)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.nome}</span>
                        {t.is_padrao && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                      </div>
                      <p className="text-xs text-gray-500">{t.largura_mm}mm x {t.altura_mm}mm</p>
                    </button>
                    <div className="flex items-center gap-1">
                      {!t.is_padrao && (
                        <button
                          onClick={() => definirComoPadrao(t.id)}
                          className="p-1.5 hover:bg-yellow-500/20 rounded"
                          title="Definir como padrao"
                        >
                          <Star className="w-4 h-4 text-yellow-400" />
                        </button>
                      )}
                      <button
                        onClick={() => excluirTemplate(t.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => {
                  setTemplateAtual(null);
                  criarTemplateInicial();
                  setShowTemplates(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30"
              >
                <Plus className="w-4 h-4" /> Novo Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Salvar */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A2E] rounded-xl border border-white/10 w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Salvar Template</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Nome do Template</label>
                <input
                  type="text"
                  value={nomeTemplate}
                  onChange={(e) => setNomeTemplate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                >
                  Cancelar
                </button>
                {templateAtual && (
                  <button
                    onClick={() => salvarTemplate(true)}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                  >
                    Salvar como novo
                  </button>
                )}
                <button
                  onClick={() => salvarTemplate(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 font-medium"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : templateAtual ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarcodeRenderer({ value, width, height }: { value: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: height * 0.7,
          displayValue: true,
          fontSize: 8,
          margin: 2
        });
      } catch {
        // erro silencioso
      }
    }
  }, [value, height]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />;
}

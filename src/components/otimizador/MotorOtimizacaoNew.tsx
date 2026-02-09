import { useState, useEffect, useCallback } from 'react';
import { Zap, MapPin, User, Play, ChevronDown, ChevronUp, AlertTriangle, Plus, GripVertical, Trash2, Check, Calendar, Loader2, Palette } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { geocodeAddress, buildOSAddress, getGoogleMapsApiKey } from '../../lib/googleMapsHelper';
import { otimizarRota, recalcularComNovaOrdem, type OSParaRoteirizar, type ParadaRota, type ResultadoOtimizacao, type ConfigRota } from '../../lib/routeEngine';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

type Step = 'config' | 'geocoding' | 'result' | 'schedule';

export default function MotorOtimizacaoNew() {
  const { selectedUnidade, tecnicosData } = useOtimizador();
  const { isLoaded } = useJsApiLoader({ id: 'google-map-motor', googleMapsApiKey: getGoogleMapsApiKey() });

  const [step, setStep] = useState<Step>('config');
  const [rotas, setRotas] = useState<any[]>([]);
  const [selectedRotas, setSelectedRotas] = useState<string[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState('');
  const [osList, setOsList] = useState<OSParaRoteirizar[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [resultado, setResultado] = useState<ResultadoOtimizacao | null>(null);
  const [cidadesSemRota, setCidadesSemRota] = useState<string[]>([]);
  const [novaCidadeCor, setNovaCidadeCor] = useState<Record<string, { rota_id: string }>>({});
  const [selectedParada, setSelectedParada] = useState<ParadaRota | null>(null);
  const [config, setConfig] = useState<Partial<ConfigRota>>({});
  const [existingAgendamentos, setExistingAgendamentos] = useState<any[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selectedUnidade) loadRotas();
  }, [selectedUnidade]);

  useEffect(() => {
    if (selectedUnidade && selectedTecnico) loadConfig();
  }, [selectedUnidade, selectedTecnico]);

  const loadRotas = async () => {
    const { data } = await supabase.from('rotas').select('*').eq('unidade_id', selectedUnidade!).eq('ativa', true).order('nome');
    if (data) setRotas(data);
  };

  const loadConfig = async () => {
    const [cfgRes, baseRes, tecRes] = await Promise.all([
      supabase.from('configuracoes_unidade').select('*').eq('unidade_id', selectedUnidade!).maybeSingle(),
      supabase.from('unidades').select('latitude, longitude').eq('id', selectedUnidade!).maybeSingle(),
      supabase.from('usuarios').select('horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos, permite_pernoite, dias_permitidos_fora, tempo_medio_ih_minutos').eq('id', selectedTecnico).maybeSingle(),
    ]);

    const cfg = cfgRes.data;
    const base = baseRes.data;
    const tec = tecRes.data;

    setConfig({
      base: { lat: Number(base?.latitude || -23.55), lng: Number(base?.longitude || -46.63) },
      horario_inicio: tec?.horario_inicio_expediente || cfg?.horario_inicio || '08:00',
      horario_fim: tec?.horario_fim_expediente || cfg?.horario_fim || '18:00',
      almoco_inicio: '12:00',
      duracao_almoco_min: tec?.duracao_almoco_minutos || cfg?.duracao_almoco || 60,
      tempo_medio_atendimento_min: tec?.tempo_medio_ih_minutos || cfg?.tempo_medio_ih || 90,
      permite_pernoite: tec?.permite_pernoite || false,
      max_dias: tec?.dias_permitidos_fora ? tec.dias_permitidos_fora + 1 : 1,
      velocidade_media_kmh: 40,
    });
  };

  const loadOS = async () => {
    if (!selectedUnidade || selectedRotas.length === 0) return;
    setLoading(true);

    const rotaCols = selectedRotas.map(id => {
      const r = rotas.find(rt => rt.id === id);
      return r ? `rota_${r.nome.toLowerCase().replace(/\s+/g, '_')}` : null;
    }).filter(Boolean);

    const { data: osData } = await supabase
      .from('os')
      .select('id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, cliente_rua, cliente_numero, cliente_bairro, cliente_estado, cliente_cep, cliente_endereco, tipo_atendimento, lat, lng, coluna_kanban, created_at, periodo_agendamento, linha_produto_id, data_agendamento')
      .eq('unidade_id', selectedUnidade!)
      .in('coluna_kanban', rotaCols as string[])
      .eq('tipo_atendimento', 'IH');

    if (!osData) { setLoading(false); return; }

    const hoje = new Date().toISOString().split('T')[0];
    const { data: agendExist } = await supabase
      .from('agendamentos')
      .select('os_id, data_agendamento, periodo, confirmado_cliente, tecnico_id')
      .eq('tecnico_id', selectedTecnico)
      .gte('data_agendamento', hoje)
      .neq('status', 'cancelado');

    setExistingAgendamentos(agendExist || []);

    const agendMap = new Map<string, any>();
    (agendExist || []).forEach(a => { if (a.os_id) agendMap.set(a.os_id, a); });

    const items: OSParaRoteirizar[] = osData.map(os => {
      const diasAberta = Math.floor((Date.now() - new Date(os.created_at).getTime()) / 86400000);
      const agend = agendMap.get(os.id);
      const rotaMatch = rotas.find(r => os.coluna_kanban === `rota_${r.nome.toLowerCase().replace(/\s+/g, '_')}`);

      return {
        id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna || '',
        lat: Number(os.lat) || 0,
        lng: Number(os.lng) || 0,
        cliente_nome: os.cliente_nome || '',
        cliente_cidade: os.cliente_cidade || '',
        cliente_endereco: buildOSAddress(os),
        tipo_atendimento: os.tipo_atendimento || 'IH',
        dias_aberta: diasAberta,
        tempo_estimado_minutos: config.tempo_medio_atendimento_min || 90,
        periodo_agendamento: os.periodo_agendamento as any,
        agendamento_existente: agend ? { data: agend.data_agendamento, periodo: agend.periodo, confirmado: agend.confirmado_cliente } : null,
        prioridade: os.prioridade || 'normal',
        rota_nome: rotaMatch?.nome,
        rota_cor: rotaMatch?.cor,
      };
    });

    setOsList(items);

    const semCoord = items.filter(os => !os.lat || !os.lng);
    if (semCoord.length > 0) {
      setStep('geocoding');
      setGeocodeProgress({ done: 0, total: semCoord.length });

      for (let i = 0; i < semCoord.length; i++) {
        const os = semCoord[i];
        const coords = await geocodeAddress(os.cliente_endereco);
        if (coords) {
          os.lat = coords.lat;
          os.lng = coords.lng;
          await supabase.from('os').update({ lat: coords.lat, lng: coords.lng }).eq('id', os.id);
        }
        setGeocodeProgress({ done: i + 1, total: semCoord.length });
      }

      setOsList([...items]);
    }

    setLoading(false);
    runOptimization(items);
  };

  const runOptimization = (items: OSParaRoteirizar[]) => {
    const rotasCidades = new Map<string, { nome: string; cor: string }>();
    rotas.forEach(r => {
      (r.cidades || []).forEach((c: string) => {
        rotasCidades.set(c.trim().toLowerCase(), { nome: r.nome, cor: r.cor });
      });
    });

    const result = otimizarRota(items, config, rotasCidades);

    if (result.cidadesSemRota.length > 0) {
      setCidadesSemRota(result.cidadesSemRota);
      setStep('config');
      return;
    }

    setResultado(result);
    setStep('result');
  };

  const handleAssignCidadeRota = async () => {
    for (const [cidade, assign] of Object.entries(novaCidadeCor)) {
      const rota = rotas.find(r => r.id === assign.rota_id);
      if (!rota) continue;
      const cidadesAtuais = rota.cidades || [];
      if (!cidadesAtuais.map((c: string) => c.toLowerCase()).includes(cidade.toLowerCase())) {
        await supabase.from('rotas').update({ cidades: [...cidadesAtuais, cidade] }).eq('id', rota.id);
      }
    }
    setCidadesSemRota([]);
    setNovaCidadeCor({});
    runOptimization(osList);
  };

  const handleReorder = (fromIdx: number, toIdx: number) => {
    if (!resultado) return;
    const newParadas = [...resultado.paradas];
    const [moved] = newParadas.splice(fromIdx, 1);
    newParadas.splice(toIdx, 0, moved);
    const recalc = recalcularComNovaOrdem(newParadas, config);
    setResultado({ ...resultado, paradas: recalc });
  };

  const handleRemoveParada = (idx: number) => {
    if (!resultado) return;
    const removed = resultado.paradas[idx];
    const newParadas = resultado.paradas.filter((_, i) => i !== idx);
    const recalc = recalcularComNovaOrdem(newParadas, config);
    setResultado({
      ...resultado,
      paradas: recalc,
      excluidas: [...resultado.excluidas, { os: removed.os, motivo: 'Removida manualmente' }],
      metricas: { ...resultado.metricas, os_incluidas: recalc.length, os_excluidas: resultado.excluidas.length + 1 },
    });
  };

  const handleAddExcluded = (os: OSParaRoteirizar) => {
    if (!resultado) return;
    const newParadas = [...resultado.paradas, { os, ordem: resultado.paradas.length + 1, distancia_km: 0, tempo_deslocamento_min: 0, horario_chegada: new Date(), horario_saida: new Date(), dia: 1, is_existente: false }];
    const recalc = recalcularComNovaOrdem(newParadas, config);
    setResultado({
      ...resultado,
      paradas: recalc,
      excluidas: resultado.excluidas.filter(e => e.os.id !== os.id),
      metricas: { ...resultado.metricas, os_incluidas: recalc.length, os_excluidas: resultado.excluidas.length - 1 },
    });
  };

  const handleDefinirAgenda = async () => {
    if (!resultado || !selectedTecnico) return;
    setLoading(true);

    for (const parada of resultado.paradas) {
      const dataAgend = new Date();
      dataAgend.setDate(dataAgend.getDate() + parada.dia - 1);
      const dataStr = dataAgend.toISOString().split('T')[0];
      const periodo = parada.horario_chegada.getHours() < 12 ? 'manha' : 'tarde';

      await supabase.from('agendamentos').insert({
        os_id: parada.os.id,
        unidade_id: selectedUnidade,
        tecnico_id: selectedTecnico,
        data_agendamento: dataStr,
        periodo,
        status: 'agendado',
        confirmado_cliente: false,
        ordem_na_rota: parada.ordem,
      });

      await supabase.from('os').update({
        tecnico_agendado_id: selectedTecnico,
        data_agendamento: dataStr,
        periodo_agendamento: periodo,
      }).eq('id', parada.os.id);
    }

    setLoading(false);
    setStep('schedule');
  };

  const fmtTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  const mapCenter = config.base?.lat ? config.base : { lat: -23.55, lng: -46.63 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-5 h-5" style={{ color: '#FFBF00' }} />
            Motor de Otimizacao
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Roteirizacao inteligente de atendimentos</p>
        </div>
        {step !== 'config' && (
          <button onClick={() => { setStep('config'); setResultado(null); setCidadesSemRota([]); }} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            Voltar
          </button>
        )}
      </div>

      {cidadesSemRota.length > 0 && (
        <CidadeSemRotaModal cidades={cidadesSemRota} rotas={rotas} values={novaCidadeCor} onChange={setNovaCidadeCor} onConfirm={handleAssignCidadeRota} />
      )}

      {step === 'config' && (
        <ConfigStep
          rotas={rotas}
          selectedRotas={selectedRotas}
          setSelectedRotas={setSelectedRotas}
          tecnicos={tecnicosData}
          selectedTecnico={selectedTecnico}
          setSelectedTecnico={setSelectedTecnico}
          existingAgendamentos={existingAgendamentos}
          loading={loading}
          onStart={loadOS}
        />
      )}

      {step === 'geocoding' && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Geolocalizando enderecos...</h3>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{geocodeProgress.done} / {geocodeProgress.total}</p>
          <div className="w-64 h-2 rounded-full mx-auto mt-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(geocodeProgress.done / Math.max(geocodeProgress.total, 1)) * 100}%`, backgroundColor: 'var(--text-accent)' }} />
          </div>
        </div>
      )}

      {step === 'result' && resultado && (
        <ResultStep
          resultado={resultado}
          config={config}
          mapCenter={mapCenter}
          isLoaded={isLoaded}
          selectedParada={selectedParada}
          setSelectedParada={setSelectedParada}
          onReorder={handleReorder}
          onRemove={handleRemoveParada}
          onAddExcluded={handleAddExcluded}
          onDefinirAgenda={handleDefinirAgenda}
          loading={loading}
          fmtTime={fmtTime}
          dragIdx={dragIdx}
          setDragIdx={setDragIdx}
          existingAgendamentos={existingAgendamentos}
        />
      )}

      {step === 'schedule' && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #10B98130' }}>
          <Check className="w-16 h-16 mx-auto mb-4" style={{ color: '#10B981' }} />
          <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Agenda Definida!</h3>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {resultado?.metricas.os_incluidas} atendimentos agendados para o tecnico. Ainda nao confirmados com o cliente.
          </p>
          <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>Confirme com o cliente e o agendamento vai para o mobile do tecnico.</p>
          <button onClick={() => { setStep('config'); setResultado(null); }} className="mt-6 px-6 py-2 rounded-lg font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
            Nova Roteirizacao
          </button>
        </div>
      )}
    </div>
  );
}

function CidadeSemRotaModal({ cidades, rotas, values, onChange, onConfirm }: any) {
  const allAssigned = cidades.every((c: string) => values[c]?.rota_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #F59E0B50' }}>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Cidades sem rota definida</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          As seguintes cidades nao pertencem a nenhuma rota. Defina a rota para cada uma:
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cidades.map((cidade: string) => (
            <div key={cidade} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{cidade}</span>
              <select
                value={values[cidade]?.rota_id || ''}
                onChange={(e) => onChange({ ...values, [cidade]: { rota_id: e.target.value } })}
                className="px-2 py-1 rounded text-sm"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Selecione...</option>
                {rotas.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button
          onClick={onConfirm}
          disabled={!allAssigned}
          className="w-full mt-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
          style={{ backgroundColor: allAssigned ? '#F59E0B' : 'var(--bg-secondary)', color: allAssigned ? '#000' : 'var(--text-secondary)' }}
        >
          Confirmar e Continuar
        </button>
      </div>
    </div>
  );
}

function ConfigStep({ rotas, selectedRotas, setSelectedRotas, tecnicos, selectedTecnico, setSelectedTecnico, existingAgendamentos, loading, onStart }: any) {
  const hoje = new Date().toISOString().split('T')[0];
  const agendHoje = existingAgendamentos.filter((a: any) => a.data_agendamento === hoje);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <MapPin className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
          1. Selecionar Rotas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {rotas.map((rota: any) => {
            const sel = selectedRotas.includes(rota.id);
            return (
              <button
                key={rota.id}
                onClick={() => setSelectedRotas(sel ? selectedRotas.filter((id: string) => id !== rota.id) : [...selectedRotas, rota.id])}
                className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: sel ? (rota.cor === '#1a1a1a' ? '#55555530' : rota.cor + '20') : 'var(--bg-secondary)',
                  border: `2px solid ${sel ? (rota.cor === '#1a1a1a' ? '#888' : rota.cor) : 'var(--border-primary)'}`,
                  color: sel ? (rota.cor === '#1a1a1a' ? '#fff' : rota.cor) : 'var(--text-secondary)',
                }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rota.cor }} />
                {rota.nome}
                {rota.cidades?.length > 0 && <span className="text-xs opacity-60">({rota.cidades.length})</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <User className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
          2. Selecionar Tecnico
        </h3>
        <select
          value={selectedTecnico}
          onChange={(e) => setSelectedTecnico(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <option value="">Selecione um tecnico...</option>
          {tecnicos.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>

        {selectedTecnico && agendHoje.length > 0 && (
          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#F59E0B10', border: '1px solid #F59E0B30' }}>
            <p className="text-xs font-medium" style={{ color: '#F59E0B' }}>
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              Este tecnico ja tem {agendHoje.length} atendimento(s) agendado(s) hoje. Eles serao destacados na rota.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={selectedRotas.length === 0 || !selectedTecnico || loading}
        className="w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
        style={{ backgroundColor: '#FFBF00', color: '#000' }}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
        Otimizar Rota
      </button>
    </div>
  );
}

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

function ResultStep({ resultado, config, mapCenter, isLoaded, selectedParada, setSelectedParada, onReorder, onRemove, onAddExcluded, onDefinirAgenda, loading, fmtTime, dragIdx, setDragIdx, existingAgendamentos }: any) {
  const { paradas, excluidas, metricas } = resultado;
  const [showExcluded, setShowExcluded] = useState(false);
  const existingIds = new Set((existingAgendamentos || []).map((a: any) => a.os_id));

  const routePath = config.base?.lat ? [
    config.base,
    ...paradas.map((p: ParadaRota) => ({ lat: p.os.lat, lng: p.os.lng })),
    config.base,
  ] : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Distancia Total', value: `${metricas.distancia_total_km} km`, color: '#3B82F6' },
          { label: 'Tempo Estimado', value: `${Math.floor(metricas.tempo_total_min / 60)}h${metricas.tempo_total_min % 60}min`, color: '#10B981' },
          { label: 'Dias', value: metricas.dias_necessarios, color: '#F59E0B' },
          { label: 'Incluidas', value: metricas.os_incluidas, color: '#06B6D4' },
          { label: 'Excluidas', value: metricas.os_excluidas, color: '#EF4444' },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: m.color + '10', border: `1px solid ${m.color}30` }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {isLoaded && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
          <GoogleMap mapContainerStyle={{ width: '100%', height: '450px' }} center={mapCenter} zoom={9} options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true }}>
            {config.base?.lat && (
              <Marker
                position={config.base}
                label={{ text: 'A', color: 'white', fontWeight: 'bold' }}
                icon={{ url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#10B981" stroke="white" stroke-width="3"/><text x="18" y="23" text-anchor="middle" fill="white" font-size="16" font-weight="bold">A</text></svg>'), scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) }}
              />
            )}
            {paradas.map((p: ParadaRota, idx: number) => (
              <Marker
                key={p.os.id}
                position={{ lat: p.os.lat, lng: p.os.lng }}
                icon={{ url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${existingIds.has(p.os.id) ? '#F59E0B' : p.os.rota_cor || '#3B82F6'}"/><text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${idx + 1}</text></svg>`), scaledSize: new google.maps.Size(30, 38), anchor: new google.maps.Point(15, 38) }}
                onClick={() => setSelectedParada(p)}
              />
            ))}
            {routePath.length > 1 && (
              <Polyline path={routePath} options={{ strokeColor: '#3B82F6', strokeWeight: 3, strokeOpacity: 0.7 }} />
            )}
            {selectedParada && (
              <InfoWindow position={{ lat: selectedParada.os.lat, lng: selectedParada.os.lng }} onCloseClick={() => setSelectedParada(null)}>
                <div style={{ color: '#000', minWidth: 180 }}>
                  <strong>#{selectedParada.ordem} - OS {selectedParada.os.numero_os}</strong><br/>
                  <span style={{ fontSize: 12 }}>{selectedParada.os.cliente_nome}</span><br/>
                  <span style={{ fontSize: 11, color: '#666' }}>{selectedParada.os.cliente_cidade}</span><br/>
                  <span style={{ fontSize: 11 }}>Chegada: {fmtTime(selectedParada.horario_chegada)} | Dia {selectedParada.dia}</span><br/>
                  <span style={{ fontSize: 11 }}>{selectedParada.distancia_km}km | {selectedParada.tempo_deslocamento_min}min</span>
                  {existingIds.has(selectedParada.os.id) && <><br/><span style={{ fontSize: 11, color: '#D97706', fontWeight: 'bold' }}>JA AGENDADO</span></>}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Sequencia de Atendimentos</h3>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {paradas.map((p: ParadaRota, idx: number) => (
              <div
                key={p.os.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx); setDragIdx(null); }}
                className={`flex items-center gap-2 p-2.5 rounded-lg transition-all cursor-move ${existingIds.has(p.os.id) ? 'ring-2 ring-yellow-500/50' : ''}`}
                style={{ backgroundColor: dragIdx === idx ? 'var(--text-accent)' + '20' : 'var(--bg-secondary)' }}
              >
                <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: p.os.rota_cor || '#3B82F6' }}>{p.ordem}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>OS {p.os.numero_os}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.os.cliente_cidade}</span>
                    {existingIds.has(p.os.id) && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}>AGENDADO</span>}
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{p.os.cliente_nome} | {fmtTime(p.horario_chegada)} Dia {p.dia} | {p.distancia_km}km</span>
                </div>
                <button onClick={() => onRemove(idx)} className="p-1 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {excluidas.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #EF444430' }}>
              <button onClick={() => setShowExcluded(!showExcluded)} className="flex items-center justify-between w-full">
                <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: '#EF4444' }}>
                  <AlertTriangle className="w-4 h-4" />
                  Excluidas ({excluidas.length})
                </h3>
                {showExcluded ? <ChevronUp className="w-4 h-4" style={{ color: '#EF4444' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#EF4444' }} />}
              </button>
              {showExcluded && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {excluidas.map((e: any) => (
                    <div key={e.os.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="min-w-0">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>OS {e.os.numero_os}</span>
                        <p className="text-[10px] truncate" style={{ color: '#EF4444' }}>{e.motivo}</p>
                      </div>
                      <button onClick={() => onAddExcluded(e.os)} className="p-1 flex-shrink-0" style={{ color: '#10B981' }}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onDefinirAgenda}
            disabled={loading || paradas.length === 0}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#10B981', color: '#fff' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Definir Agenda ({paradas.length} OS)
          </button>
        </div>
      </div>
    </div>
  );
}

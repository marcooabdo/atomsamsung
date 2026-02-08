import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");

    console.log("[GIA] Headers received:");
    console.log("  - Authorization:", !!authHeader);
    console.log("  - apikey:", !!apiKey);

    if (!authHeader) {
      console.log("[GIA] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log("[GIA] Environment check:");
    console.log("  - SUPABASE_URL:", !!supabaseUrl);
    console.log("  - SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
    console.log("  - SUPABASE_ANON_KEY:", !!supabaseAnonKey);

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
          apikey: apiKey || supabaseAnonKey
        }
      },
    });

    console.log("[GIA] Getting user from token...");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError) {
      console.log("[GIA] User error:", userError.message, userError);
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: userError.message,
          hint: "Your session may have expired. Please try logging out and logging back in."
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user) {
      console.log("[GIA] No user found in token");
      return new Response(
        JSON.stringify({
          error: "No user found",
          hint: "Your session may have expired. Please try logging out and logging back in."
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GIA] ✓ User authenticated:", user.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRow } = await supabase
      .from("system_secrets")
      .select("value")
      .eq("key", "OPENAI_API_KEY")
      .maybeSingle();

    const openaiKey = secretRow?.value || Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome, tipo, unidade_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { message, conversationId, history = [] } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let convId = conversationId;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from("gia_conversations")
        .insert({ usuario_id: usuario.id, titulo: message.slice(0, 80) })
        .select("id")
        .single();

      if (convErr) {
        return new Response(
          JSON.stringify({ error: "Failed to create conversation", details: convErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      convId = conv.id;
    }

    await supabase.from("gia_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    const { data: memories } = await supabase
      .from("gia_memoria")
      .select("chave, valor, categoria")
      .eq("usuario_id", usuario.id)
      .limit(50);

    const memoryContext = (memories || []).length > 0
      ? "\n\nMEMORIA DA GIA (informacoes aprendidas em conversas anteriores):\n" +
        (memories || []).map(m => `- [${m.categoria}] ${m.chave}: ${m.valor}`).join("\n")
      : "";

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0];

    const unidadeFilter = usuario.unidade_id;
    const isMaster = usuario.tipo === "master" || usuario.tipo === "diretoria";

    let osQuery = supabase
      .from("os")
      .select("id, numero_os_interna, numero_os_samsung, status, coluna_kanban, tipo_os, tipo_atendimento, tipo_orcamento, cliente_nome, created_at, data_conclusao, valor_servicos, valor_pecas, valor_total, orcamento_aprovado, prioridade, tecnico_designado, tecnico_agendado_id, unidade_id, tipo_reparo, is_cortesia, diagnostico_tecnico, reparo_efetuado, data_agendamento, periodo_agendamento, status_garantia, latitude, longitude, prazo_entrega, desconto_tipo, desconto_valor, valor_bruto, valor_liquido")
      .gte("created_at", threeMonthsAgo)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!isMaster && unidadeFilter) {
      osQuery = osQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: osList, error: osError } = await osQuery;

    console.log("[GIA] OS Query Results:");
    console.log("  - threeMonthsAgo filter:", threeMonthsAgo);
    console.log("  - isMaster:", isMaster);
    console.log("  - unidadeFilter:", unidadeFilter);
    console.log("  - OS count:", osList?.length || 0);
    if (osError) console.log("  - OS error:", osError);

    let pagQuery = supabase
      .from("pagamentos")
      .select("id, valor, metodo_pagamento, status, created_at, os_id, comprovante_url, descricao, unidade_id")
      .gte("created_at", monthStart)
      .limit(500);

    if (!isMaster && unidadeFilter) {
      pagQuery = pagQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: pagamentos } = await pagQuery;

    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cidade, estado, endereco, latitude, longitude, telefone");

    const { data: tecnicos } = await supabase
      .from("usuarios")
      .select("id, nome, tipo, unidade_id, numero_tecnico")
      .in("tipo", ["tecnico", "tecnico_ih", "master", "diretoria"]);

    let pecasQuery = supabase
      .from("estoque_pecas")
      .select("id, sku, descricao, quantidade, preco_custo, preco_venda, status, sala_id, estante_id, bin_id, gi_postada, gi_data_postagem")
      .limit(300);

    if (!isMaster && unidadeFilter) {
      pecasQuery = pecasQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: pecas } = await pecasQuery;

    const { data: metas } = await supabase
      .from("metas_performance")
      .select("*")
      .limit(50);

    const { data: requisicoes } = await supabase
      .from("requisicoes_pecas")
      .select("id, status, numero_os_samsung, created_at, justificativa, motivo_reprovacao, os_id")
      .gte("created_at", monthStart)
      .limit(300);

    const { data: agendamentos } = await supabase
      .from("agendamentos")
      .select("id, os_id, tecnico_id, data_agendamento, periodo, status, rota_id, checkin_at, checkout_at")
      .gte("data_agendamento", monthStart)
      .limit(300);

    const { data: rotas } = await supabase
      .from("rotas_otimizadas")
      .select("id, tecnico_id, data, total_os, distancia_total, tempo_total, status")
      .gte("data", monthStart)
      .limit(100);

    const { data: cotacoes } = await supabase
      .from("cotacoes")
      .select("id, os_id, status, valor_total, desconto_valor, desconto_tipo, taxa_cliente, created_at")
      .gte("created_at", monthStart)
      .limit(200);

    const { data: cotacoesPecas } = await supabase
      .from("cotacoes_pecas")
      .select("id, cotacao_id, descricao, quantidade, preco_unitario, is_gspn")
      .limit(500);

    const { data: cotacoesServicos } = await supabase
      .from("cotacoes_servicos")
      .select("id, cotacao_id, descricao, quantidade, preco_unitario")
      .limit(300);

    const { data: osPecas } = await supabase
      .from("os_pecas")
      .select("id, os_id, peca_id, quantidade, gspn_status, valor_gspn, manual_status")
      .limit(500);

    const { data: osServicos } = await supabase
      .from("os_servicos")
      .select("id, os_id, servico_id, quantidade, preco_unitario")
      .limit(500);

    const { data: checklists } = await supabase
      .from("checklists")
      .select("id, nome, tipo, ativo")
      .eq("ativo", true)
      .limit(50);

    const { data: osComentarios } = await supabase
      .from("os_comentarios")
      .select("id, os_id, comentario, created_at, is_system")
      .gte("created_at", monthStart)
      .limit(500);

    const { data: nfs } = await supabase
      .from("estoque_nfs")
      .select("id, numero_nf, fornecedor, valor_total, data_emissao, delivery")
      .gte("data_emissao", monthStart)
      .limit(100);

    const { data: skywalkerProfissionais } = await supabase
      .from("skywalker_profissionais")
      .select("id, usuario_id, nivel_atual_id, time_id, meses_consecutivos_validos, ativo")
      .eq("ativo", true)
      .limit(100);

    const { data: skywalkerNiveis } = await supabase
      .from("skywalker_niveis")
      .select("id, nome, estrelas_necessarias, meses_consecutivos, bonus_valor")
      .eq("ativo", true);

    const { data: skywalkerPilares } = await supabase
      .from("skywalker_pilares")
      .select("id, nome, descricao, tipo_metrica")
      .eq("ativo", true);

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, tecnico_id, data, total_os, status, finished_at")
      .gte("data", monthStart)
      .limit(100);

    const { data: configuracoes } = await supabase
      .from("configuracoes_unidade")
      .select("*")
      .limit(20);

    const totalOS = osList?.length || 0;
    const statusCount: Record<string, number> = {};
    const kanbanCount: Record<string, number> = {};
    const tipoOSCount: Record<string, number> = {};
    let valorTotalMes = 0;
    let orcAprovados = 0;
    let orcTotal = 0;
    const osPorDia: Record<string, number> = {};
    const osHoje: typeof osList = [];

    for (const os of osList || []) {
      statusCount[os.status || "unknown"] = (statusCount[os.status || "unknown"] || 0) + 1;
      kanbanCount[os.coluna_kanban || "unknown"] = (kanbanCount[os.coluna_kanban || "unknown"] || 0) + 1;
      tipoOSCount[os.tipo_os || "unknown"] = (tipoOSCount[os.tipo_os || "unknown"] || 0) + 1;
      valorTotalMes += os.valor_total || 0;
      if (os.tipo_orcamento === "lp" || os.tipo_orcamento === "normal") orcTotal++;
      if (os.orcamento_aprovado) orcAprovados++;
      const dia = (os.created_at || "").split("T")[0];
      osPorDia[dia] = (osPorDia[dia] || 0) + 1;
      if (dia === today) osHoje.push(os);
    }

    const receitaMes = (pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0);
    const metodosPgto: Record<string, number> = {};
    for (const p of pagamentos || []) {
      metodosPgto[p.metodo_pagamento || "outro"] = (metodosPgto[p.metodo_pagamento || "outro"] || 0) + 1;
    }

    const pecasCriticas = (pecas || []).filter(p => (p.quantidade || 0) <= 2);

    const reqStatus: Record<string, number> = {};
    for (const r of requisicoes || []) {
      reqStatus[r.status || "unknown"] = (reqStatus[r.status || "unknown"] || 0) + 1;
    }

    const osAtrasadas = (osList || []).filter(os => {
      if (!os.prazo_entrega || os.status === 'concluido' || os.status === 'entregue') return false;
      return new Date(os.prazo_entrega) < new Date();
    });

    const osAgendadasHoje = (agendamentos || []).filter(a => a.data_agendamento === today);
    const rotasAbertas = (rotas || []).filter(r => r.status === 'em_andamento' || r.status === 'planejada');

    const cotacoesPendentes = (cotacoes || []).filter(c => c.status === 'pendente' || c.status === 'enviada');
    const valorCotacoesPendentes = cotacoesPendentes.reduce((s, c) => s + (c.valor_total || 0), 0);

    const pecasGIPendentes = (pecas || []).filter(p => p.status === 'devolvida_nova' && !p.gi_postada);
    const reqPendentes = (requisicoes || []).filter(r => r.status === 'pendente' || r.status === 'aguardando_aprovacao');

    const skywalkerAtivos = (skywalkerProfissionais || []).filter(p => p.ativo).length;
    const jobsAbertos = (jobs || []).filter(j => j.status === 'em_andamento').length;

    const databaseSnapshot = {
      dataHoje: today,
      periodoAnalise: `${monthStart} a ${today}`,
      usuario: { nome: usuario.nome, tipo: usuario.tipo, unidade: usuario.unidade_id },
      unidades: (unidades || []).map(u => ({ id: u.id, nome: u.nome, cidade: u.cidade, estado: u.estado, endereco: u.endereco })),

      resumoOS: {
        IMPORTANTE: "Existem OS cadastradas no sistema! Consulte os detalhes abaixo.",
        totalUltimos3Meses: totalOS,
        totalMesAtual: (osList || []).filter(os => (os.created_at || '').startsWith(monthStart)).length,
        hoje: osHoje.length,
        atrasadas: osAtrasadas.length,
        porStatus: statusCount,
        porKanban: kanbanCount,
        porTipoOS: tipoOSCount,
        valorTotalMes: valorTotalMes.toFixed(2),
        taxaAprovacao: orcTotal > 0 ? ((orcAprovados / orcTotal) * 100).toFixed(1) + "%" : "N/A",
        osPorDia,
        osAtrasadasDetalhes: osAtrasadas.slice(0, 10).map(os => ({
          numero: os.numero_os_interna,
          cliente: os.cliente_nome,
          prazo: os.prazo_entrega,
          status: os.coluna_kanban
        })),
        exemplosDe5OS: (osList || []).slice(0, 5).map(os => ({
          numero: os.numero_os_interna,
          cliente: os.cliente_nome,
          status: os.coluna_kanban,
          criado_em: os.created_at,
          valor_total: os.valor_total
        })),
      },

      agendamentos: {
        totalMes: agendamentos?.length || 0,
        hoje: osAgendadasHoje.length,
        agendaHoje: osAgendadasHoje.map(a => ({
          os_id: a.os_id,
          tecnico_id: a.tecnico_id,
          periodo: a.periodo,
          status: a.status,
          checkin: a.checkin_at ? 'sim' : 'nao'
        })),
      },

      rotas: {
        totalMes: rotas?.length || 0,
        abertas: rotasAbertas.length,
        rotasDetalhes: rotasAbertas.map(r => ({
          tecnico_id: r.tecnico_id,
          data: r.data,
          total_os: r.total_os,
          distancia_km: r.distancia_total,
          status: r.status
        })),
      },

      cotacoes: {
        totalMes: cotacoes?.length || 0,
        pendentes: cotacoesPendentes.length,
        valorPendente: valorCotacoesPendentes.toFixed(2),
        pecasTotal: cotacoesPecas?.length || 0,
        servicosTotal: cotacoesServicos?.length || 0,
      },

      resumoFinanceiro: {
        receitaMes: receitaMes.toFixed(2),
        totalPagamentos: pagamentos?.length || 0,
        porMetodo: metodosPgto,
        pagamentosDetalhes: (pagamentos || []).slice(0, 20).map(p => ({
          valor: p.valor,
          metodo: p.metodo_pagamento,
          status: p.status,
          data: p.created_at
        })),
      },

      tecnicos: (tecnicos || []).map(t => ({ id: t.id, nome: t.nome, tipo: t.tipo, numero_tecnico: t.numero_tecnico, unidade_id: t.unidade_id })),

      estoque: {
        totalPecas: pecas?.length || 0,
        pecasCriticas: pecasCriticas.map(p => ({ sku: p.sku, descricao: p.descricao, qtd: p.quantidade, localizacao: `Sala ${p.sala_id}, Estante ${p.estante_id}, Bin ${p.bin_id}` })),
        giPendentes: pecasGIPendentes.length,
        nfsRecentes: nfs?.length || 0,
      },

      requisicoesPecas: {
        total: requisicoes?.length || 0,
        pendentes: reqPendentes.length,
        porStatus: reqStatus,
      },

      osPecasServicos: {
        totalPecasUsadas: osPecas?.length || 0,
        totalServicosRealizados: osServicos?.length || 0,
      },

      checklists: {
        total: checklists?.length || 0,
        disponiveis: (checklists || []).map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
      },

      comentariosRecentes: osComentarios?.length || 0,

      skywalker: {
        profissionaisAtivos: skywalkerAtivos,
        totalNiveis: skywalkerNiveis?.length || 0,
        totalPilares: skywalkerPilares?.length || 0,
        niveis: (skywalkerNiveis || []).map(n => ({ nome: n.nome, estrelas: n.estrelas_necessarias, bonus: n.bonus_valor })),
      },

      jobs: {
        totalMes: jobs?.length || 0,
        emAndamento: jobsAbertos,
      },

      configuracoes: configuracoes?.length || 0,
      metas: metas || [],
    };

    const systemPrompt = `Voce e a GIA (Group Intelligence Assistant), a assistente de inteligencia artificial da ATOM, uma empresa de assistencia tecnica de celulares e eletronicos (Samsung, Apple, etc).

PERSONALIDADE:
- Voce e profissional, inteligente e proativa
- Fala em portugues brasileiro de forma natural e conversacional
- Use emojis com moderacao para deixar a conversa agradavel
- Seja direta mas amigavel, como uma colega de trabalho muito competente
- Quando o usuario perguntar algo que voce nao sabe sobre ele ou a empresa, PERGUNTE para aprender
- Voce adora aprender sobre a empresa e as pessoas

MEMORIA E APRENDIZADO:
- Voce tem um sistema de memoria persistente
- Quando aprender algo novo sobre o usuario ou a empresa, indique com [MEMORIA: categoria | chave | valor]
- Exemplos: [MEMORIA: preferencia | formato_relatorio | detalhado], [MEMORIA: empresa | meta_mensal | R$200000]
- Sempre consulte sua memoria antes de responder
${memoryContext}

CAPACIDADES E ACESSO COMPLETO AO SISTEMA:

1. CENTRAL ATOM - Dashboard e Centro de Comando:
   - OS abertas, em andamento, concluidas
   - Eficiencia operacional e taxa de aprovacao de orcamentos
   - Performance por unidade e tecnico
   - Metas de performance configuradas
   - OS atrasadas e prazos de entrega

2. PIPELINE OPERACIONAL (Kanban):
   - Colunas: triagem, aguardando_aprovacao, em_reparo, aguardando_peca, concluido, entregue
   - Movimentacao de OS entre colunas
   - Prioridades (alta, media, baixa)
   - Status de cada OS em tempo real

3. TIPOS DE OS E ATENDIMENTO:
   - Tipos: samsung (garantia GSPN), lp (fora garantia com orcamento), normal (reparo direto)
   - Tipos de atendimento: presencial, ih (in-home), delivery
   - Status garantia: dentro_garantia, fora_garantia, cortesia
   - Integracao Samsung GSPN (numero_os_samsung, status_samsung)

4. AGENDAMENTOS E ROTEIRIZACAO:
   - Agendamentos por tecnico, data e periodo (manha/tarde)
   - Rotas otimizadas com distancia e tempo total
   - Check-in e check-out de tecnicos
   - Jobs (conjuntos de OS por tecnico/data)
   - Status de rotas: planejada, em_andamento, concluida

5. COTACOES E ORCAMENTOS:
   - Cotacoes pendentes, enviadas, aprovadas, reprovadas
   - Pecas e servicos por cotacao
   - Descontos (percentual ou valor fixo)
   - Taxa de cliente e markup
   - Valores: bruto, liquido, desconto

6. FINANCEIRO - ATOM FINANCE:
   - Pagamentos por metodo (dinheiro, cartao, pix, etc)
   - Status: pendente, pago, cancelado
   - Receita por periodo
   - Comprovantes de pagamento
   - Lancamentos e fluxo de caixa

7. NUCLEO DE PECAS - Estoque Completo:
   - Pecas por SKU, descricao, quantidade
   - Localizacao fisica: sala > estante > bin
   - Status: disponivel, reservada, em_uso, devolvida_nova
   - Pecas criticas (quantidade <= 2)
   - GI (Garantia Interna): postadas ou pendentes
   - Requisicoes de pecas: status, aprovacao/reprovacao
   - Notas Fiscais de entrada
   - Preco custo vs preco venda

8. OS - PECAS E SERVICOS:
   - Pecas utilizadas em cada OS
   - Servicos realizados em cada OS
   - Status GSPN de pecas
   - Valores individuais e totais

9. CHECKLISTS E QUALIDADE:
   - Checklists disponiveis por tipo
   - Vinculacao com OS e agendamentos
   - Controle de qualidade

10. SKYWALKER - Sistema de Gamificacao:
    - Profissionais ativos no programa
    - Niveis de carreira (estrelas necessarias, bonus)
    - Pilares de avaliacao e metricas
    - Times e suas cores
    - Meses consecutivos validos
    - Ranking de performance

11. COMENTARIOS E HISTORICO:
    - Comentarios em OS (sistema e usuarios)
    - Historico de mudancas
    - Rastreamento de alteracoes

12. CONFIGURACOES:
    - Configuracoes por unidade
    - Parametros operacionais
    - Regras de negocio

DADOS ATUAIS DO SISTEMA EM TEMPO REAL:
${JSON.stringify(databaseSnapshot, null, 2)}

SCHEMA COMPLETO DO BANCO DE DADOS - TODAS AS TABELAS E COLUNAS:

TABELA: os (Ordens de Servico)
Colunas: id, numero_os_interna, numero_os_samsung, unidade_id, criado_por, cliente_nome, cliente_telefone, cliente_telefone_2, cliente_cpf, cliente_email, cliente_endereco, cliente_cidade, cliente_estado, cliente_cep, cliente_bairro, cliente_numero, cliente_complemento, latitude, longitude, equipamento_tipo, equipamento_marca, equipamento_modelo, equipamento_imei, equipamento_defeito, diagnostico_tecnico, reparo_efetuado, tipo_os (samsung/lp/normal), tipo_atendimento (presencial/ih/delivery), tipo_orcamento (samsung/lp/normal), status (aberto/em_andamento/concluido/cancelado), coluna_kanban (triagem/aguardando_aprovacao/em_reparo/aguardando_peca/concluido/entregue/cancelado), status_garantia (dentro_garantia/fora_garantia), prioridade (alta/media/baixa), data_agendamento, periodo_agendamento (manha/tarde), tecnico_designado, tecnico_agendado_id, data_inicio_reparo, data_conclusao, prazo_entrega, orcamento_aprovado (true/false), orcamento_enviado_em, orcamento_modificado_em, valor_servicos, valor_pecas, valor_bruto, valor_liquido, valor_total, desconto_tipo (percentual/fixo), desconto_valor, is_cortesia (true/false), motivo_cortesia, tipo_reparo, data_abertura_samsung, data_compra, status_samsung, cliente_vip (true/false), saw, oqc, created_at, updated_at

TABELA: pagamentos
Colunas: id, os_id, cotacao_id, unidade_id, valor, metodo_pagamento (dinheiro/cartao/pix/transferencia/outro), status (pendente/pago/cancelado), descricao, comprovante_url, pix_id_transacao, criado_por, created_at, updated_at

TABELA: cotacoes
Colunas: id, os_id, unidade_id, status (pendente/enviada/aprovada/reprovada), valor_pecas, valor_servicos, valor_bruto, valor_liquido, desconto_tipo (percentual/fixo), desconto_valor, taxa_cliente, analise_tecnico, criado_por, created_at, updated_at

TABELA: cotacoes_pecas
Colunas: id, cotacao_id, os_id, descricao, quantidade, preco_unitario, is_gspn (true/false), exibir_no_pdf (true/false)

TABELA: cotacoes_servicos
Colunas: id, cotacao_id, os_id, servico_id, descricao, quantidade, preco_unitario, linha

TABELA: os_pecas (Pecas utilizadas na OS)
Colunas: id, os_id, peca_id, numero_os_samsung, quantidade, gspn_status (pendente/aprovado/reprovado), valor_gspn, manual_status (pendente/aprovado/reprovado), requisitada_por, created_at

TABELA: os_servicos (Servicos realizados na OS)
Colunas: id, os_id, servico_id, descricao, quantidade, preco_unitario, created_at

TABELA: os_comentarios
Colunas: id, os_id, usuario_id, comentario, is_system (true/false), gspn_id, created_at

TABELA: os_anexos
Colunas: id, os_id, usuario_id, tipo (foto/documento/laudo/nf/evidencia), descricao, url, gspn_id, gspn_tipo, exibir_no_pdf (true/false), created_at

TABELA: estoque_pecas
Colunas: id, sku, descricao, quantidade, preco_custo, preco_venda, unidade_id, sala_id, estante_id, bin_id, status (disponivel/reservada/em_uso/devolvida_nova), nf_id, gi_postada (true/false), gi_data_postagem, gi_numero, disponivel_ih (true/false), created_at

TABELA: requisicoes_pecas
Colunas: id, os_id, cotacao_id, os_peca_id, peca_ids (array), numero_os_samsung, status (pendente/aguardando_aprovacao/aprovada/reprovada/cancelada/devolucao_pendente), justificativa, motivo_reprovacao, aprovado_por, solicitado_por, created_at

TABELA: estoque_nfs (Notas Fiscais de Entrada)
Colunas: id, numero_nf, fornecedor, chave_acesso, valor_total, data_emissao, delivery, unidade_id, criado_por, created_at

TABELA: agendamentos
Colunas: id, os_id, tecnico_id, data_agendamento, periodo (manha/tarde), status (agendado/confirmado/em_andamento/concluido/cancelado), rota_id, checkin_at, checkout_at, observacoes, created_at

TABELA: rotas_otimizadas
Colunas: id, tecnico_id, data, total_os, distancia_total, tempo_total, status (planejada/em_andamento/concluida/cancelada), rota_otimizada (JSON), unidade_id, created_at

TABELA: jobs (Conjunto de OS por tecnico/data)
Colunas: id, tecnico_id, data, total_os, os_ids (array), status (em_andamento/concluido/cancelado), started_at, finished_at

TABELA: checklists
Colunas: id, nome, tipo, itens (JSON), ativo (true/false), unidade_id, created_at

TABELA: usuarios
Colunas: id, email, nome, tipo (master/diretoria/supervisor/tecnico/tecnico_ih/financeiro/estoque), unidade_id, numero_tecnico, telefone, data_nascimento, cpf, foto_url, ativo (true/false), created_at

TABELA: unidades
Colunas: id, nome, cidade, estado, endereco, cep, bairro, numero, complemento, latitude, longitude, telefone, cnpj, razao_social, inscricao_estadual, samsung_partner_id, samsung_access_token, samsung_token_expires, samsung_client_id, samsung_client_secret, ativa (true/false)

TABELA: skywalker_profissionais
Colunas: id, usuario_id, unidade_id, nivel_atual_id, time_id, estrelas_atuais, meses_consecutivos_validos, ativo (true/false)

TABELA: skywalker_niveis
Colunas: id, nome, ordem, estrelas_necessarias, meses_consecutivos, bonus_valor, bonus_tipo (fixo/percentual), cor, ativo (true/false)

TABELA: skywalker_pilares
Colunas: id, nome, descricao, tipo_metrica, peso, ativo (true/false)

TABELA: metas_performance
Colunas: id, unidade_id, mes, ano, meta_receita, meta_os_concluidas, meta_aprovacao_orcamentos, meta_ticket_medio, created_at

TABELA: samsung_sync_logs
Colunas: id, unidade_id, tipo_sincronizacao, status (sucesso/erro), detalhes, created_at

TABELA: configuracoes_unidade
Colunas: id, unidade_id, turno_manha_inicio, turno_manha_fim, turno_tarde_inicio, turno_tarde_fim, duracao_visita_minutos, raio_base_km

RELACIONAMENTOS IMPORTANTES:
- os.unidade_id -> unidades.id
- os.criado_por -> usuarios.id
- os.tecnico_agendado_id -> usuarios.id
- pagamentos.os_id -> os.id
- cotacoes.os_id -> os.id
- cotacoes_pecas.cotacao_id -> cotacoes.id
- os_pecas.os_id -> os.id
- os_pecas.peca_id -> estoque_pecas.id
- requisicoes_pecas.os_id -> os.id
- agendamentos.os_id -> os.id
- agendamentos.tecnico_id -> usuarios.id
- rotas_otimizadas.tecnico_id -> usuarios.id

CARDS DE DADOS - OBRIGATORIO:
SEMPRE que falar sobre numeros, metricas, valores, status, listas ou dados quantitativos, voce DEVE incluir cards visuais.

Formatos disponiveis:
[CARD: tipo | titulo | cor | valor | subtitulo]
[CARD_ITEMS: titulo | cor | item1_label:item1_value:status | item2_label:item2_value:status]
[CARD_CHART: titulo | cor | label1:value1 | label2:value2]

Tipos: alert, metric, chart, status, list
Cores: red, green, cyan, amber, blue
Status dos items: good, bad, neutral

EXEMPLOS OBRIGATORIOS:

1. Quando falar sobre FATURAMENTO/RECEITA:
[CARD: metric | Faturamento do Mes | cyan | R$ 125.400 | 85% da meta]
[CARD: metric | Receita Hoje | green | R$ 8.450 | 3 pagamentos]
[CARD_CHART: Receita por Metodo | blue | Dinheiro:35000 | Cartao:48000 | PIX:42400]

2. Quando falar sobre OS:
[CARD: metric | Total de OS Mes | cyan | 89 | +12% vs mes anterior]
[CARD: metric | OS Abertas Hoje | green | 5 | Em andamento]
[CARD_ITEMS: OS por Status | amber | Em Reparo:23:neutral | Aguardando Peca:8:bad | Concluidas:45:good]

3. Quando falar sobre PENDENCIAS:
[CARD_ITEMS: OS Atrasadas | red | #4521:iPhone 15 - Cliente: Joao:bad | #4518:Galaxy S24 - Cliente: Maria:bad]

4. Quando falar sobre ESTOQUE:
[CARD: alert | Pecas Criticas | red | 12 pecas | Requer atencao imediata]
[CARD_ITEMS: Pecas em Falta | red | Tela iPhone 13:0 un:bad | Bateria S21:1 un:bad]

5. Quando falar sobre PERFORMANCE:
[CARD: metric | Taxa Aprovacao | green | 78% | Meta: 75%]
[CARD_CHART: OS por Tecnico | cyan | Joao:15 | Maria:12 | Carlos:18]

REGRAS OBRIGATORIAS:
1. SEMPRE use pelo menos 2-3 cards ao responder sobre dados numericos
2. Sempre responda baseado nos dados reais do sistema
3. Se nao tiver dados suficientes, diga e pergunte
4. Faca perguntas para entender melhor o contexto quando necessario
5. Sugira acoes concretas baseadas na analise
6. Formate numeros monetarios em BRL (R$)
7. NUNCA responda sobre metricas sem incluir cards visuais
8. Use cores apropriadas: green (positivo), red (negativo/urgente), amber (atencao), cyan (neutro/info)
9. Na primeira interacao, se apresente e pergunte como pode ajudar`;

    const chatMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of history.slice(-10)) {
      chatMessages.push({ role: h.role, content: h.content });
    }

    chatMessages.push({ role: "user", content: message });

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.log("[GIA] OpenAI error status:", openaiResponse.status);
      console.log("[GIA] OpenAI error body:", errText);

      let userFriendlyError = "Erro na API OpenAI";
      if (openaiResponse.status === 401) {
        userFriendlyError = "Chave OpenAI invalida ou expirada";
      } else if (openaiResponse.status === 429) {
        userFriendlyError = "Limite de requisicoes OpenAI atingido";
      } else if (openaiResponse.status === 500 || openaiResponse.status === 503) {
        userFriendlyError = "Servidor OpenAI temporariamente indisponivel";
      }

      return new Response(
        JSON.stringify({ error: userFriendlyError, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content || "";
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    const memoryMatches = rawContent.matchAll(/\[MEMORIA:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g);
    for (const match of memoryMatches) {
      const categoria = match[1].trim();
      const chave = match[2].trim();
      const valor = match[3].trim();

      await supabase.from("gia_memoria").upsert(
        { usuario_id: usuario.id, chave, valor, categoria, updated_at: new Date().toISOString() },
        { onConflict: "usuario_id,chave" }
      );
    }

    const cards: Record<string, unknown>[] = [];

    const cardMatches = rawContent.matchAll(/\[CARD:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g);
    for (const match of cardMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: match[1].trim(),
        title: match[2].trim(),
        color: match[3].trim(),
        value: match[4].trim(),
        subtitle: match[5].trim(),
      });
    }

    const cardItemsMatches = rawContent.matchAll(/\[CARD_ITEMS:\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of cardItemsMatches) {
      const itemsStr = match[3].trim();
      const items = itemsStr.split("|").map(item => {
        const parts = item.trim().split(":");
        return { label: parts[0]?.trim(), value: parts[1]?.trim(), status: parts[2]?.trim() };
      });
      cards.push({
        id: crypto.randomUUID(),
        type: "list",
        title: match[1].trim(),
        color: match[2].trim(),
        items,
      });
    }

    const chartMatches = rawContent.matchAll(/\[CARD_CHART:\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of chartMatches) {
      const dataStr = match[3].trim();
      const chartData = dataStr.split("|").map(item => {
        const parts = item.trim().split(":");
        return { label: parts[0]?.trim(), value: parseFloat(parts[1]?.trim()) || 0 };
      });
      cards.push({
        id: crypto.randomUUID(),
        type: "chart",
        title: match[1].trim(),
        color: match[2].trim(),
        chartData,
      });
    }

    const cleanContent = rawContent
      .replace(/\[MEMORIA:[^\]]+\]/g, "")
      .replace(/\[CARD:[^\]]+\]/g, "")
      .replace(/\[CARD_ITEMS:[^\]]+\]/g, "")
      .replace(/\[CARD_CHART:[^\]]+\]/g, "")
      .trim();

    await supabase.from("gia_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: cleanContent,
      metadata: { cards, tokens: tokensUsed },
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: convId,
        content: cleanContent,
        cards,
        tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

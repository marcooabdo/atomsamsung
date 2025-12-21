import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SamsungOS {
  SvcOrderNo: string;
  CustFirstName?: string;
  CustLastName?: string;
  CustAddrStreet?: string;
  CustAddrStreetDetail?: string;
  CustAddrCity?: string;
  CustAddrState?: string;
  CustAddrZIP?: string;
  CustHomePhone?: string;
  CustMobilePhone?: string;
  Model?: string;
  IMEI?: string;
  DefectDesc?: string;
  DefectCode?: string;
  Symptoms?: string;
  CustEmail?: string;
  ProductModel?: string;
  SerialNo?: string;
  CreateDate?: string;
  ReqDate?: string;
  SvcType?: string;
  WarrantyStatus?: string;
  RepairType?: string;
}

interface SamsungAPIResponse {
  ServiceOrderList?: SamsungOS[];
  data?: SamsungOS[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('unidade_id')
      .eq('auth_id', user.id)
      .single();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const unidadeId = usuario.unidade_id;

    const { data: config } = await supabase
      .from('samsung_api_configs')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('ativo', true)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Configuração Samsung não encontrada ou inativa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: syncLog, error: syncLogError } = await supabase
      .from('samsung_sync_logs')
      .insert({
        unidade_id: unidadeId,
        config_id: config.id,
        status: 'em_progresso',
        iniciado_em: new Date().toISOString(),
        executado_por: user.id
      })
      .select()
      .single();

    if (syncLogError || !syncLog) {
      console.error('Erro ao criar log de sincronização:', syncLogError);
      return new Response(
        JSON.stringify({ error: 'Erro ao iniciar sincronização' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - config.dias_historico);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const payload = {
      ASCCode: config.asc_code,
      FromDate: formatDate(dataInicio),
      ToDate: formatDate(hoje)
    };

    const apiUrl = 'https://latam.ipaas.samsung.com/latam/gcic/GetSOList/1.0/ImportSet';
    const samsungToken = config.ambiente_ativo === 'prod' ? config.token_prod : config.token_dev;

    console.log('Consultando API Samsung:', payload);

    const samsungResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${samsungToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!samsungResponse.ok) {
      const errorText = await samsungResponse.text();
      console.error('Erro na API Samsung:', errorText);

      await supabase
        .from('samsung_sync_logs')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          mensagem_erro: `API retornou status ${samsungResponse.status}: ${errorText}`
        })
        .eq('id', syncLog.id);

      return new Response(
        JSON.stringify({
          error: 'Erro na API Samsung',
          details: errorText,
          status: samsungResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData: SamsungAPIResponse = await samsungResponse.json();
    const osList = responseData.ServiceOrderList || responseData.data || [];

    console.log(`Total de OS encontradas: ${osList.length}`);

    const { data: existingOS } = await supabase
      .from('os')
      .select('numero_os_samsung')
      .eq('unidade_id', unidadeId)
      .not('numero_os_samsung', 'is', null);

    const existingNumbers = new Set((existingOS || []).map(os => os.numero_os_samsung));

    let criadas = 0;
    let ignoradas = 0;
    const erros: string[] = [];

    for (const os of osList) {
      if (existingNumbers.has(os.SvcOrderNo)) {
        ignoradas++;
        continue;
      }

      const clienteNome = `${os.CustFirstName || ''} ${os.CustLastName || ''}`.trim() || 'Cliente Samsung';
      const endereco = [
        os.CustAddrStreet,
        os.CustAddrStreetDetail,
        os.CustAddrCity,
        os.CustAddrState
      ].filter(Boolean).join(', ');

      const telefone = os.CustMobilePhone || os.CustHomePhone || '';

      const osData = {
        unidade_id: unidadeId,
        numero_os_samsung: os.SvcOrderNo,
        cliente_nome: clienteNome,
        cliente_telefone: telefone,
        cliente_email: os.CustEmail || null,
        endereco: endereco || null,
        cep: os.CustAddrZIP || null,
        cidade: os.CustAddrCity || null,
        estado: os.CustAddrState || null,
        modelo_equipamento: os.Model || os.ProductModel || null,
        imei: os.IMEI || os.SerialNo || null,
        defeito_reclamado: os.DefectDesc || os.Symptoms || null,
        coluna_kanban: 'OS NOVA',
        tipo_os: 'SAMSUNG',
        tipo_reparo: os.RepairType || os.SvcType || 'VISITA TECNICA',
        status_garantia: os.WarrantyStatus || null,
        data_abertura_samsung: os.CreateDate || null,
        data_requisicao_samsung: os.ReqDate || null
      };

      const { error: insertError } = await supabase
        .from('os')
        .insert(osData);

      if (insertError) {
        console.error(`Erro ao criar OS ${os.SvcOrderNo}:`, insertError);
        erros.push(`OS ${os.SvcOrderNo}: ${insertError.message}`);
      } else {
        criadas++;
      }
    }

    await supabase
      .from('samsung_sync_logs')
      .update({
        status: erros.length > 0 ? 'concluido_com_erros' : 'concluido',
        finalizado_em: new Date().toISOString(),
        total_os_encontradas: osList.length,
        total_os_criadas: criadas,
        total_os_ignoradas: ignoradas,
        mensagem_erro: erros.length > 0 ? erros.join('\n') : null,
        detalhes: {
          periodo: {
            de: formatDate(dataInicio),
            ate: formatDate(hoje)
          },
          erros: erros
        }
      })
      .eq('id', syncLog.id);

    await supabase
      .from('samsung_api_configs')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({
        success: true,
        total_encontradas: osList.length,
        total_criadas: criadas,
        total_ignoradas: ignoradas,
        erros: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

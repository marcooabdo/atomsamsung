import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SamsungServiceOrder {
  SvcOrderNo: string;
  StatusDesc: string;
  StReasonDesc: string;
}

interface SamsungAPIResponse {
  Return: {
    EvRetCode: string;
    EvRetMsg: string;
  };
  EtSvcInfo: {
    results: SamsungServiceOrder[];
  };
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
      .select('id, nome, nivel_acesso, unidade_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado no sistema' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { unidade_id } = await req.json();

    if (!unidade_id) {
      return new Response(
        JSON.stringify({ error: 'unidade_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: unidade } = await supabase
      .from('unidades')
      .select('id, nome, samsung_asccode, samsung_token')
      .eq('id', unidade_id)
      .maybeSingle();

    if (!unidade) {
      return new Response(
        JSON.stringify({ error: 'Unidade não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!unidade.samsung_asccode || !unidade.samsung_token) {
      return new Response(
        JSON.stringify({
          error: 'Unidade não possui configuração Samsung completa',
          unidade: unidade.nome
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: osExistentes } = await supabase
      .from('os')
      .select('id, numero_os_samsung')
      .eq('unidade_id', unidade_id)
      .not('numero_os_samsung', 'is', null);

    if (!osExistentes || osExistentes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma OS Samsung encontrada para esta unidade',
          total_atualizadas: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Total de OS Samsung nesta unidade: ${osExistentes.length}`);

    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 90);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const generatePac = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}${hours}${minutes}${seconds}`;
    };

    const payload = {
      IsBasicCond: {
        AscCode: unidade.samsung_asccode,
        ReqDateFrom: formatDate(dataInicio),
        ReqDateTo: formatDate(hoje)
      },
      IvCompany: "",
      IsCommonHeader: {
        Company: "C820",
        AscCode: unidade.samsung_asccode,
        Country: "BR",
        Lang: "EN",
        Pac: generatePac()
      }
    };

    const apiUrl = 'https://latam.ipaas.samsung.com/latam/gcic/GetSOList/1.0/ImportSet';

    console.log('🔍 Consultando API Samsung para atualização de status...');

    const samsungResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unidade.samsung_token}`,
        'Cookie': 'sap-usercontext=sap-client=100'
      },
      body: JSON.stringify(payload)
    });

    if (!samsungResponse.ok) {
      const errorText = await samsungResponse.text();
      console.error('❌ Erro na API Samsung:', errorText);

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

    if (responseData.Return.EvRetCode !== "0") {
      const errorMsg = `API Samsung retornou erro: ${responseData.Return.EvRetMsg || 'Erro desconhecido'}`;
      console.error('❌', errorMsg);

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const osList = responseData.EtSvcInfo?.results || [];
    console.log(`📦 Total de OS retornadas pela API: ${osList.length}`);

    const osMap = new Map(osExistentes.map(os => [os.numero_os_samsung, os.id]));

    let atualizadas = 0;
    let naoEncontradas = 0;
    const erros: string[] = [];

    for (const os of osList) {
      const osId = osMap.get(os.SvcOrderNo);

      if (!osId) {
        naoEncontradas++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('os')
        .update({
          status_samsung_desc: os.StatusDesc || null,
          status_samsung_reason: os.StReasonDesc || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (updateError) {
        console.error(`❌ Erro ao atualizar OS ${os.SvcOrderNo}:`, updateError);
        erros.push(`OS ${os.SvcOrderNo}: ${updateError.message}`);
      } else {
        atualizadas++;
        console.log(`✅ OS ${os.SvcOrderNo} atualizada - Status: ${os.StatusDesc || '—'}, Motivo: ${os.StReasonDesc || '—'}`);
      }
    }

    console.log(`
    ✅ Atualização concluída:
    - OS na API: ${osList.length}
    - OS no sistema: ${osExistentes.length}
    - Atualizadas: ${atualizadas}
    - Não encontradas na API: ${naoEncontradas}
    - Erros: ${erros.length}
    `);

    return new Response(
      JSON.stringify({
        success: true,
        total_os_api: osList.length,
        total_os_sistema: osExistentes.length,
        total_atualizadas: atualizadas,
        total_nao_encontradas: naoEncontradas,
        erros: erros.length > 0 ? erros : undefined,
        periodo: {
          de: formatDate(dataInicio),
          ate: formatDate(hoje)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    console.error('Stack trace:', error.stack);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
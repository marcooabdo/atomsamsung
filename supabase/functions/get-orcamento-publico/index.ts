import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action'); // 'get' or 'respond'

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar link do orçamento
    const { data: linkData, error: linkError } = await supabase
      .from('orcamento_links')
      .select('*')
      .eq('token', token)
      .eq('ativo', true)
      .maybeSingle();

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: 'Link invalido ou expirado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o link expirou
    if (linkData.expires_at) {
      const expiresAt = new Date(linkData.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        // Desativar link expirado
        await supabase
          .from('orcamento_links')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', linkData.id);

        return new Response(
          JSON.stringify({
            error: 'Link expirado',
            message: 'Este link de aprovacao expirou. Entre em contato com a assistencia tecnica.'
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se for uma resposta do cliente
    if (req.method === 'POST' && action === 'respond') {
      const body = await req.json();
      const { status, mensagem, latitude, longitude, endereco_completo, selfie_url } = body;

      if (!status || !['aprovado', 'rejeitado', 'negociando'].includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Status invalido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar link com resposta
      const { error: updateError } = await supabase
        .from('orcamento_links')
        .update({
          status,
          mensagem_cliente: mensagem || null,
          data_resposta: new Date().toISOString(),
          ip_cliente: req.headers.get('x-forwarded-for') || 'unknown',
          latitude: latitude || null,
          longitude: longitude || null,
          endereco_completo: endereco_completo || null,
          selfie_url: selfie_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', linkData.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao salvar resposta' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Salvar selfie e localização como anexos da OS
      if (selfie_url) {
        await supabase.from('os_anexos').insert({
          os_id: linkData.os_id,
          url: selfie_url,
          tipo: 'selfie_aprovacao',
          descricao: `Selfie do cliente - ${status === 'aprovado' ? 'Orçamento Aprovado' : status === 'rejeitado' ? 'Orçamento Rejeitado' : 'Negociação'}`
        });
      }

      if (latitude && longitude) {
        await supabase.from('os_comentarios').insert({
          os_id: linkData.os_id,
          comentario: `📍 Localização do cliente ao ${status === 'aprovado' ? 'aprovar' : status === 'rejeitado' ? 'rejeitar' : 'negociar'} orçamento:\nLatitude: ${latitude}\nLongitude: ${longitude}\n${endereco_completo ? `Endereço: ${endereco_completo}` : ''}`,
          is_system: true
        });
      }

      // Se aprovado, marcar OS como orçamento aprovado
      if (status === 'aprovado') {
        await supabase
          .from('os')
          .update({
            orcamento_aprovado: true,
            orcamento_aprovado_em: new Date().toISOString()
          })
          .eq('id', linkData.os_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Resposta registrada com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da OS com cotações
    const { data: osData, error: osError } = await supabase
      .from('os')
      .select(`
        *,
        unidades:unidade_id(nome, telefone, endereco, cidade, uf),
        cotacoes(
          id,
          valor_total,
          valor_pecas,
          valor_servicos,
          desconto_tipo,
          desconto_valor,
          valor_liquido,
          created_at,
          cotacoes_pecas(id, codigo, descricao, quantidade, valor_final_unitario, valor_total),
          cotacoes_servicos(id, nome, descricao, valor, quantidade, valor_total)
        )
      `)
      .eq('id', linkData.os_id)
      .maybeSingle();

    if (osError || !osData) {
      return new Response(
        JSON.stringify({ error: 'OS nao encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retornar dados públicos (sem informações sensíveis)
    const response = {
      link: linkData,
      os: {
        numero_os_interna: osData.numero_os_interna,
        cliente_nome: osData.cliente_nome,
        cliente_telefone: osData.cliente_telefone,
        aparelho_marca: osData.aparelho_marca,
        aparelho_modelo: osData.aparelho_modelo,
        defeito_relatado: osData.defeito_relatado,
        diagnostico_tecnico: osData.diagnostico_tecnico,
        data_abertura: osData.data_abertura,
        unidade: osData.unidades,
        cotacao: osData.cotacoes?.[0] || null
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

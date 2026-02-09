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
    const action = url.searchParams.get('action');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    if (linkData.expires_at) {
      const expiresAt = new Date(linkData.expires_at);
      const now = new Date();

      if (now > expiresAt) {
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

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    if (req.method === 'POST' && action === 'respond') {
      const body = await req.json();
      const { status, mensagem, latitude, longitude, endereco_completo, selfie_url } = body;

      if (!status || !['aprovado', 'rejeitado', 'negociando'].includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Status invalido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusEmoji = status === 'aprovado' ? '✅' : status === 'rejeitado' ? '❌' : '💬';
      const statusTexto = status === 'aprovado' ? 'APROVADO' : status === 'rejeitado' ? 'REJEITADO' : 'EM NEGOCIACAO';

      const { error: updateError } = await supabase
        .from('orcamento_links')
        .update({
          status,
          mensagem_cliente: mensagem || null,
          data_resposta: new Date().toISOString(),
          ip_cliente: clientIp,
          latitude: latitude || null,
          longitude: longitude || null,
          endereco_completo: endereco_completo || null,
          selfie_url: selfie_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', linkData.id);

      if (updateError) {
        console.error('Error updating link:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao salvar resposta' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let comentarioResposta = `${statusEmoji} ORCAMENTO ${statusTexto} PELO CLIENTE VIA LINK\n`;
      comentarioResposta += `Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
      comentarioResposta += `IP: ${clientIp}\n`;

      if (mensagem) {
        comentarioResposta += `\nMensagem do cliente:\n"${mensagem}"`;
      }

      await supabase.from('os_comentarios').insert({
        os_id: linkData.os_id,
        comentario: comentarioResposta,
        is_system: true
      });

      if (latitude && longitude) {
        let comentarioLocalizacao = `📍 LOCALIZACAO DO CLIENTE AO RESPONDER ORCAMENTO\n`;
        comentarioLocalizacao += `Latitude: ${latitude}\n`;
        comentarioLocalizacao += `Longitude: ${longitude}\n`;
        if (endereco_completo) {
          comentarioLocalizacao += `Endereco: ${endereco_completo}\n`;
        }
        comentarioLocalizacao += `\nLink do Maps: https://www.google.com/maps?q=${latitude},${longitude}`;

        await supabase.from('os_comentarios').insert({
          os_id: linkData.os_id,
          comentario: comentarioLocalizacao,
          is_system: true
        });
      }

      if (selfie_url) {
        const fileName = `selfie-aprovacao-${Date.now()}.jpg`;
        const { error: anexoError } = await supabase.from('os_anexos').insert({
          os_id: linkData.os_id,
          url: selfie_url,
          tipo: 'foto',
          nome_arquivo: fileName,
          descricao: `Selfie do cliente - Orcamento ${statusTexto}`
        });

        if (!anexoError) {
          await supabase.from('os_comentarios').insert({
            os_id: linkData.os_id,
            comentario: `📸 Selfie do cliente registrada ao ${status === 'aprovado' ? 'aprovar' : status === 'rejeitado' ? 'rejeitar' : 'negociar'} o orcamento`,
            is_system: true
          });
        }
      }

      const osUpdateData: Record<string, unknown> = {
        status_orcamento_link: status,
        mensagem_cliente_orcamento: mensagem || null,
        updated_at: new Date().toISOString()
      };

      if (status === 'aprovado') {
        osUpdateData.orcamento_aprovado = true;
        osUpdateData.orcamento_aprovado_em = new Date().toISOString();
        osUpdateData.coluna_kanban = 'orcamento_aprovado';
      } else if (status === 'rejeitado') {
        osUpdateData.orcamento_aprovado = false;
        osUpdateData.orcamento_reprovado_em = new Date().toISOString();
        osUpdateData.coluna_kanban = 'orcamentos_rejeitados';
      }

      await supabase
        .from('os')
        .update(osUpdateData)
        .eq('id', linkData.os_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Resposta registrada com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('os_comentarios').insert({
      os_id: linkData.os_id,
      comentario: `🔗 Link de orcamento acessado pelo cliente\nIP: ${clientIp}\nData/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      is_system: true
    });

    const { data: osData, error: osError } = await supabase
      .from('os')
      .select('*')
      .eq('id', linkData.os_id)
      .maybeSingle();

    if (osError) {
      console.error('Error fetching OS:', osError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar OS', details: osError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!osData) {
      console.error('OS not found:', linkData.os_id);
      return new Response(
        JSON.stringify({ error: 'OS nao encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: unidadeData } = await supabase
      .from('unidades')
      .select('nome, telefone, endereco, cidade, uf, cnpj, logo_url')
      .eq('id', osData.unidade_id)
      .maybeSingle();

    const { data: pdfConfig } = await supabase
      .from('configuracoes_pdf_os')
      .select('termo_orcamento, termo_garantia, canais_atendimento, observacoes_gerais')
      .eq('unidade_id', osData.unidade_id)
      .maybeSingle();

    const { data: pecasData } = await supabase
      .from('os_pecas')
      .select('id, codigo, descricao, quantidade, valor_unitario, valor_total')
      .eq('os_id', linkData.os_id)
      .or('exibir_no_pdf.eq.true,mostrar_no_pdf.eq.true');

    const { data: servicosData } = await supabase
      .from('os_servicos')
      .select('id, nome, descricao, valor, quantidade, valor_total')
      .eq('os_id', linkData.os_id);

    const { data: anexosData } = await supabase
      .from('os_anexos')
      .select('id, url, nome_arquivo, descricao, tipo')
      .eq('os_id', linkData.os_id)
      .eq('exibir_no_pdf', true);

    const cotacao = {
      id: osData.id,
      valor_pecas: Number(osData.valor_pecas || 0),
      valor_servicos: Number(osData.valor_servicos || 0),
      desconto_tipo: osData.desconto_tipo,
      desconto_valor: Number(osData.desconto_valor || 0),
      valor_liquido: Number(osData.valor_total || 0),
      created_at: osData.created_at,
      cotacoes_pecas: (pecasData || []).map(p => ({
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        quantidade: p.quantidade,
        valor_final_unitario: Number(p.valor_unitario || 0),
        valor_total: Number(p.valor_total || 0)
      })),
      cotacoes_servicos: (servicosData || []).map(s => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao || '',
        valor: Number(s.valor || 0),
        quantidade: s.quantidade,
        valor_total: Number(s.valor_total || 0)
      }))
    };

    const response = {
      link: linkData,
      os: {
        numero_os_interna: osData.numero_os_interna,
        cliente_nome: osData.cliente_nome,
        cliente_telefone: osData.cliente_telefone,
        cliente_cpf_cnpj: osData.cliente_cpf_cnpj,
        cliente_endereco: osData.cliente_endereco,
        cliente_logradouro: osData.cliente_logradouro,
        cliente_numero: osData.cliente_numero,
        cliente_bairro: osData.cliente_bairro,
        cliente_cidade: osData.cliente_cidade,
        cliente_estado: osData.cliente_estado,
        cliente_cep: osData.cliente_cep,
        aparelho_marca: osData.aparelho_marca,
        aparelho_modelo: osData.aparelho_modelo,
        aparelho_numero_serie: osData.aparelho_numero_serie,
        aparelho_imei: osData.aparelho_imei,
        defeito_relatado: osData.defeito_relatado,
        diagnostico_tecnico: osData.diagnostico_tecnico,
        reparo_efetuado: osData.reparo_efetuado,
        data_abertura: osData.created_at,
        unidade: unidadeData,
        cotacao: cotacao,
        termos: pdfConfig || null,
        anexos: (anexosData || []).map(a => ({
          id: a.id,
          url: a.url,
          nome_arquivo: a.nome_arquivo,
          descricao: a.descricao,
          tipo: a.tipo
        }))
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

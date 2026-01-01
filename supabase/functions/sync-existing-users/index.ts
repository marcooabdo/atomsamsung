import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();
    const { secret_key, user_id, senha } = body;

    if (secret_key !== 'sync-users-2024-secret') {
      throw new Error('Chave secreta inválida');
    }

    if (!user_id || !senha) {
      throw new Error('user_id e senha são obrigatórios');
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user_id)
      .single();

    if (!usuario) {
      throw new Error('Usuário não encontrado na tabela usuarios');
    }

    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const authUser = existingAuth?.users?.find(u => u.email === usuario.email);

    if (authUser) {
      await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      const { error: updateError } = await supabase
        .from('usuarios')
        .upsert({
          id: authUser.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo,
          unidade_id: usuario.unidade_id,
          ativo: usuario.ativo,
          numero_tecnico: usuario.numero_tecnico,
          horario_inicio_expediente: usuario.horario_inicio_expediente,
          horario_fim_expediente: usuario.horario_fim_expediente,
          duracao_almoco_minutos: usuario.duracao_almoco_minutos,
          horario_almoco_inicio: usuario.horario_almoco_inicio
        });

      if (updateError) throw updateError;

      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        { password: senha }
      );

      if (passwordError) throw passwordError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuário sincronizado com auth existente',
          old_id: usuario.id,
          new_id: authUser.id,
          email: usuario.email
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: usuario.email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        name: usuario.nome
      }
    });

    if (authError) {
      throw authError;
    }

    await supabase
      .from('usuarios')
      .delete()
      .eq('id', usuario.id);

    const { error: insertError } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        unidade_id: usuario.unidade_id,
        ativo: usuario.ativo,
        numero_tecnico: usuario.numero_tecnico,
        horario_inicio_expediente: usuario.horario_inicio_expediente,
        horario_fim_expediente: usuario.horario_fim_expediente,
        duracao_almoco_minutos: usuario.duracao_almoco_minutos,
        horario_almoco_inicio: usuario.horario_almoco_inicio
      });

    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário migrado com sucesso para auth',
        old_id: usuario.id,
        new_id: authData.user.id,
        email: usuario.email
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
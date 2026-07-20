import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  action: 'create' | 'update' | 'reset-password' | 'delete';
  nome?: string;
  email?: string;
  senha?: string;
  tipo?: string;
  unidade_id?: string | null;
  ativo?: boolean;
  numero_tecnico?: string | null;
  user_id?: string;
}

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
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticacao nao fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    });

    const { data: { user: requestingUser }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nao autenticado ou token invalido',
          details: authError?.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requestingUsuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', requestingUser.id)
      .single();

    if (usuarioError || !requestingUsuario) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario nao encontrado no sistema' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['master', 'gerente', 'diretoria', 'administrador'].includes(requestingUsuario.tipo)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissao para gerenciar usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateUserRequest = await req.json();
    const { action, nome, email, senha, tipo, unidade_id, ativo = true, numero_tecnico, user_id } = body;

    if (action === 'create') {
      if (!nome || !email || !senha || !tipo) {
        throw new Error('Nome, email, senha e tipo sao obrigatorios');
      }

      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          name: nome
        }
      });

      if (createAuthError) {
        if (createAuthError.message.includes('already registered')) {
          throw new Error('Este email ja esta em uso');
        }
        throw createAuthError;
      }

      const { error: profileError } = await supabaseAdmin
        .from('usuarios')
        .insert({
          id: authData.user.id,
          nome,
          email,
          tipo,
          unidade_id: unidade_id || null,
          ativo,
          numero_tecnico: numero_tecnico || null
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario criado com sucesso!',
          user: {
            id: authData.user.id,
            email,
            nome
          }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else if (action === 'update') {
      if (!user_id) {
        throw new Error('ID do usuario e obrigatorio para atualizacao');
      }

      const updateData: any = {};

      if (nome !== undefined) updateData.nome = nome;
      if (email !== undefined) updateData.email = email;
      if (tipo !== undefined) updateData.tipo = tipo;
      if (unidade_id !== undefined) updateData.unidade_id = unidade_id || null;
      if (ativo !== undefined) updateData.ativo = ativo;
      if (numero_tecnico !== undefined) updateData.numero_tecnico = numero_tecnico || null;

      if (Object.keys(updateData).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('usuarios')
          .update(updateData)
          .eq('id', user_id);

        if (profileError) throw profileError;
      }

      if (senha) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { password: senha }
        );
        if (passwordError) throw passwordError;
      }

      if (email && updateData.email) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { email }
        );
        if (emailError) throw emailError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario atualizado com sucesso!'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else if (action === 'reset-password') {
      if (!user_id || !senha) {
        throw new Error('ID do usuario e nova senha sao obrigatorios');
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: senha }
      );

      if (passwordError) throw passwordError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Senha redefinida com sucesso!'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else if (action === 'delete') {
      if (!user_id) {
        throw new Error('ID do usuario e obrigatorio para exclusao');
      }

      if (user_id === requestingUser.id) {
        throw new Error('Voce nao pode excluir seu proprio usuario');
      }

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteAuthError) {
        throw deleteAuthError;
      }

      const { error: deleteProfileError } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('id', user_id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario excluido com sucesso!'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      throw new Error('Acao invalida');
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || String(error) || 'Erro ao gerenciar usuario'
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

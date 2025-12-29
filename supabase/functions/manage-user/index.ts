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

    console.log('Recebido header Authorization:', authHeader ? 'Sim' : 'Não');

    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extraído (primeiros 20 chars):', token.substring(0, 20));

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error('Erro de autenticação:', authError);
      console.error('Detalhes do erro:', JSON.stringify(authError));
      throw new Error('Não autenticado ou token inválido');
    }

    console.log('Usuário autenticado:', requestingUser.id, requestingUser.email);

    const { data: requestingUsuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', requestingUser.id)
      .single();

    if (usuarioError || !requestingUsuario) {
      console.error('Erro ao buscar usuário:', usuarioError);
      throw new Error('Usuário não encontrado');
    }

    if (!['master', 'gerente', 'diretoria'].includes(requestingUsuario.tipo)) {
      throw new Error('Sem permissão para gerenciar usuários');
    }

    const body: CreateUserRequest = await req.json();
    const { action, nome, email, senha, tipo, unidade_id, ativo = true, numero_tecnico, user_id } = body;

    if (action === 'create') {
      if (!nome || !email || !senha || !tipo) {
        throw new Error('Nome, email, senha e tipo são obrigatórios');
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          name: nome
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('Este email já está em uso');
        }
        throw authError;
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
          message: 'Usuário criado com sucesso!',
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
        throw new Error('ID do usuário é obrigatório para atualização');
      }

      const updateData: any = {
        nome,
        email,
        tipo,
        unidade_id: unidade_id || null,
        ativo,
        numero_tecnico: numero_tecnico || null
      };

      const { error: profileError } = await supabaseAdmin
        .from('usuarios')
        .update(updateData)
        .eq('id', user_id);

      if (profileError) throw profileError;

      if (senha) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { password: senha }
        );
        if (passwordError) throw passwordError;
      }

      if (email) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { email }
        );
        if (emailError) throw emailError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuário atualizado com sucesso!'
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
        throw new Error('ID do usuário e nova senha são obrigatórios');
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
        throw new Error('ID do usuário é obrigatório para exclusão');
      }

      if (user_id === requestingUser.id) {
        throw new Error('Você não pode excluir seu próprio usuário');
      }

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteAuthError) {
        console.error('Erro ao deletar do auth:', deleteAuthError);
        throw deleteAuthError;
      }

      const { error: deleteProfileError } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('id', user_id);

      if (deleteProfileError) {
        console.error('Erro ao deletar do usuarios:', deleteProfileError);
        throw deleteProfileError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuário excluído com sucesso!'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      throw new Error('Ação inválida');
    }
  } catch (error) {
    console.error('Erro ao gerenciar usuário:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao gerenciar usuário'
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

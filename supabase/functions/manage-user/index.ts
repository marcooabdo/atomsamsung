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
      throw new Error('Token de autentica\u00e7\u00e3o n\u00e3o fornecido');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !requestingUser) {
      console.error('Erro de autentica\u00e7\u00e3o:', authError);
      throw new Error('N\u00e3o autenticado ou token inv\u00e1lido');
    }

    const { data: requestingUsuario, error: usuarioError } = await supabaseClient
      .from('usuarios')
      .select('tipo')
      .eq('id', requestingUser.id)
      .single();

    if (usuarioError || !requestingUsuario) {
      console.error('Erro ao buscar usu\u00e1rio:', usuarioError);
      throw new Error('Usu\u00e1rio n\u00e3o encontrado');
    }

    if (!['master', 'gerente', 'diretoria'].includes(requestingUsuario.tipo)) {
      throw new Error('Sem permiss\u00e3o para gerenciar usu\u00e1rios');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body: CreateUserRequest = await req.json();
    const { action, nome, email, senha, tipo, unidade_id, ativo = true, numero_tecnico, user_id } = body;

    if (action === 'create') {
      if (!nome || !email || !senha || !tipo) {
        throw new Error('Nome, email, senha e tipo s\u00e3o obrigat\u00f3rios');
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
          throw new Error('Este email j\u00e1 est\u00e1 em uso');
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
          message: 'Usu\u00e1rio criado com sucesso!',
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
        throw new Error('ID do usu\u00e1rio \u00e9 obrigat\u00f3rio para atualiza\u00e7\u00e3o');
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
          message: 'Usu\u00e1rio atualizado com sucesso!'
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
        throw new Error('ID do usu\u00e1rio e nova senha s\u00e3o obrigat\u00f3rios');
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
        throw new Error('ID do usu\u00e1rio \u00e9 obrigat\u00f3rio para exclus\u00e3o');
      }

      if (user_id === requestingUser.id) {
        throw new Error('Voc\u00ea n\u00e3o pode excluir seu pr\u00f3prio usu\u00e1rio');
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
          message: 'Usu\u00e1rio exclu\u00eddo com sucesso!'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      throw new Error('A\u00e7\u00e3o inv\u00e1lida');
    }
  } catch (error) {
    console.error('Erro ao gerenciar usu\u00e1rio:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao gerenciar usu\u00e1rio'
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
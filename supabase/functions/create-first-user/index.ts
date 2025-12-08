import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    const email = 'marcoabdo@groupglobal.com.br';
    const password = 'Samsung@2024';

    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: 'Marco Abdo'
      }
    });

    if (authError) {
      throw authError;
    }

    // Buscar unidade
    const { data: unidade } = await supabase
      .from('unidades')
      .select('id')
      .limit(1)
      .single();

    // Criar perfil na tabela usuarios
    const { error: profileError } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: 'Marco Abdo',
        email: email,
        tipo: 'master',
        unidade_id: unidade?.id || null,
        ativo: true
      });

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário criado com sucesso!',
        email: email,
        password: password,
        user_id: authData.user.id
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
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
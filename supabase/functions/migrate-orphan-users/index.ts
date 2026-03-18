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

    if (secret_key !== 'migrate-orphan-2024') {
      throw new Error('Chave secreta invalida');
    }

    if (!user_id || !senha) {
      throw new Error('user_id e senha sao obrigatorios');
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user_id)
      .single();

    if (!usuario) {
      throw new Error('Usuario nao encontrado na tabela usuarios');
    }

    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const authUser = existingAuth?.users?.find(u => u.id === user_id);

    if (authUser) {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        user_id,
        { password: senha }
      );
      if (passwordError) throw passwordError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario ja existe no auth, senha atualizada',
          user_id: user_id,
          email: usuario.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailUser = existingAuth?.users?.find(u => u.email === usuario.email);
    
    if (emailUser) {
      const { error: migrateError } = await supabase.rpc('migrate_user_id', {
        old_user_id: user_id,
        new_user_id: emailUser.id
      });

      if (migrateError) throw migrateError;

      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        emailUser.id,
        { password: senha }
      );
      if (passwordError) throw passwordError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuario migrado para auth existente com mesmo email',
          old_id: user_id,
          new_id: emailUser.id,
          email: usuario.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: usuario.email,
      password: senha,
      email_confirm: true,
      user_metadata: { name: usuario.nome }
    });

    if (authError) throw authError;

    const { error: migrateError } = await supabase.rpc('migrate_user_id', {
      old_user_id: user_id,
      new_user_id: authData.user.id
    });

    if (migrateError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw migrateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario criado no auth e migrado com sucesso',
        old_id: user_id,
        new_id: authData.user.id,
        email: usuario.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user: requestingUser } } = await supabaseClient.auth.getUser();
    if (!requestingUser) {
      throw new Error('Não autenticado');
    }

    const { data: requestingUsuario } = await supabaseClient
      .from('usuarios')
      .select('tipo')
      .eq('id', requestingUser.id)
      .single();

    if (!requestingUsuario || requestingUsuario.tipo !== 'master') {
      throw new Error('Apenas usuários master podem migrar usuários órfãos');
    }

    const { data: orphanUsers } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .not('id', 'in', `(SELECT id FROM auth.users)`);

    if (!orphanUsers || orphanUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum usuário órfão encontrado',
          migrated: []
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const results = [];

    for (const user of orphanUsers) {
      try {
        const tempPassword = `Temp@${Math.random().toString(36).slice(-8)}`;

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: user.nome
          }
        });

        if (authError) {
          results.push({
            old_id: user.id,
            email: user.email,
            nome: user.nome,
            success: false,
            error: authError.message
          });
          continue;
        }

        await supabaseAdmin
          .from('usuarios')
          .delete()
          .eq('id', user.id);

        const { error: insertError } = await supabaseAdmin
          .from('usuarios')
          .insert({
            id: authData.user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            unidade_id: user.unidade_id,
            ativo: user.ativo
          });

        if (insertError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          results.push({
            old_id: user.id,
            email: user.email,
            nome: user.nome,
            success: false,
            error: insertError.message
          });
          continue;
        }

        results.push({
          old_id: user.id,
          new_id: authData.user.id,
          email: user.email,
          nome: user.nome,
          temp_password: tempPassword,
          success: true
        });
      } catch (error) {
        results.push({
          old_id: user.id,
          email: user.email,
          nome: user.nome,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migração concluída. ${results.filter(r => r.success).length} de ${results.length} usuários migrados com sucesso.`,
        migrated: results
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Erro ao migrar usuários:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao migrar usuários órfãos'
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

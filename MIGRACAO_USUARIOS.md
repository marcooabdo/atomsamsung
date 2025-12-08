# Migração de Usuários Órfãos

## Problema Identificado
Existem 2 usuários órfãos que foram criados diretamente na tabela `usuarios` sem passar pelo sistema de autenticação:
- **Bianca Pacheco** (admin@homeway.com) - Gerente
- **TESTE** (teste@hotmail.com) - Técnico

## Solução

### Opção 1: Migrar Automaticamente (Recomendado)

Abra o console do navegador (F12) e execute:

```javascript
(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-orphan-users`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const result = await response.json();
  console.log('Resultado da migração:', result);

  if (result.success) {
    alert('Usuários migrados com sucesso! Anote as senhas temporárias:');
    result.migrated.forEach(user => {
      if (user.success) {
        console.log(`${user.nome} (${user.email}): ${user.temp_password}`);
      }
    });
  }
})();
```

**IMPORTANTE:** Anote as senhas temporárias geradas para cada usuário!

### Opção 2: Recriar Manualmente

1. Acesse **Configurações > Usuários**
2. Edite cada usuário órfão e defina uma nova senha
3. Salve - isso irá recriá-los no sistema de autenticação

### Opção 3: Desativar Temporariamente

Se não quiser migrar agora, desative os usuários órfãos:

```sql
UPDATE usuarios
SET ativo = false
WHERE id IN (
  'c7aacaa5-a426-4537-8a89-50210a653c7a',
  '5e741d12-0c0e-4cda-a768-dadfce4dec87'
);
```

## Após a Migração

Depois que os usuários forem migrados ou recriados, eles aparecerão automaticamente na aba **Contatos** do Chat.

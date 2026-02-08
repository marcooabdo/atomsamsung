# Guia de Graficos GIA

A GIA possui suporte completo para 7 tipos diferentes de graficos profissionais e modernos. Este guia explica quando e como usar cada tipo.

## Tipos de Graficos Disponiveis

### 1. Grafico de Barras (bar)
**Quando usar:** Comparacao de valores entre diferentes categorias, ranking, top N.

**Exemplo:**
```typescript
{
  type: 'bar',
  title: 'Faturamento por Unidade',
  subtitle: 'Janeiro 2025',
  color: 'green',
  chartData: [
    { label: 'Campinas', value: 18400 },
    { label: 'Sao Bernardo', value: 12300 },
    { label: 'Osasco', value: 8150 },
    { label: 'Santo Andre', value: 4000 }
  ]
}
```

**Melhor para:**
- Comparacao de valores entre 3-8 categorias
- Rankings e tops
- Comparacao de performance entre equipes/unidades

---

### 2. Grafico de Colunas (column)
**Quando usar:** Similar ao de barras, mas melhor para valores menores ou mais categorias.

**Exemplo:**
```typescript
{
  type: 'column',
  title: 'OS por Dia da Semana',
  subtitle: 'Media semanal',
  color: 'cyan',
  chartData: [
    { label: 'Seg', value: 45 },
    { label: 'Ter', value: 52 },
    { label: 'Qua', value: 48 },
    { label: 'Qui', value: 55 },
    { label: 'Sex', value: 41 },
    { label: 'Sab', value: 23 }
  ]
}
```

**Melhor para:**
- Comparacao de 4-12 categorias
- Dados periodicos (dias, semanas)
- Rankings visuais

---

### 3. Grafico de Linhas (line)
**Quando usar:** Mostrar tendencias e evolucao ao longo do tempo.

**Exemplo:**
```typescript
{
  type: 'line',
  title: 'Evolucao do Faturamento',
  subtitle: 'Ultimos 6 meses',
  color: 'cyan',
  chartData: [
    { label: 'Jul', value: 380 },
    { label: 'Ago', value: 420 },
    { label: 'Set', value: 395 },
    { label: 'Out', value: 450 },
    { label: 'Nov', value: 490 },
    { label: 'Dez', value: 520 }
  ]
}
```

**Melhor para:**
- Series temporais
- Tendencias e evolucoes
- Dados mensais/semanais/diarios
- Crescimento ou declinio

---

### 4. Grafico de Area (area)
**Quando usar:** Similar ao de linhas, mas com enfase no volume total.

**Exemplo:**
```typescript
{
  type: 'area',
  title: 'Volume de OS',
  subtitle: 'Ultimos 8 meses',
  color: 'amber',
  chartData: [
    { label: 'Mai', value: 850 },
    { label: 'Jun', value: 920 },
    { label: 'Jul', value: 980 },
    { label: 'Ago', value: 1050 },
    { label: 'Set', value: 980 },
    { label: 'Out', value: 1120 },
    { label: 'Nov', value: 1180 },
    { label: 'Dez', value: 1250 }
  ]
}
```

**Melhor para:**
- Mostrar magnitude de mudanca
- Volume acumulado
- Crescimento progressivo
- Series temporais com enfase

---

### 5. Grafico de Pizza (pie)
**Quando usar:** Mostrar proporcoes e porcentagens de um todo.

**Exemplo:**
```typescript
{
  type: 'pie',
  title: 'Distribuicao por Tipo de Servico',
  subtitle: 'Total de OS do mes',
  color: 'cyan',
  chartData: [
    { label: 'Troca de Tela', value: 342 },
    { label: 'Troca de Bateria', value: 285 },
    { label: 'Reparo Placa', value: 156 },
    { label: 'Troca Camera', value: 89 },
    { label: 'Outros', value: 128 }
  ]
}
```

**Melhor para:**
- Mostrar partes de um todo
- Porcentagens e proporcoes
- 3-6 categorias principais
- Market share, distribuicao

---

### 6. Grafico de Rosca (donut)
**Quando usar:** Similar ao de pizza, mas com espaco para mostrar total no centro.

**Exemplo:**
```typescript
{
  type: 'donut',
  title: 'OS por Fabricante',
  subtitle: 'Dezembro 2024',
  color: 'blue',
  chartData: [
    { label: 'Samsung', value: 487 },
    { label: 'Apple', value: 342 },
    { label: 'Xiaomi', value: 156 },
    { label: 'Motorola', value: 98 },
    { label: 'Outros', value: 67 }
  ]
}
```

**Melhor para:**
- Distribuicao com total visivel
- Participacao de mercado
- Composicao de categorias
- 4-7 segmentos

---

### 7. Grafico Radar (radar)
**Quando usar:** Comparar multiplos indicadores ou dimensoes.

**Exemplo:**
```typescript
{
  type: 'radar',
  title: 'Indicadores de Performance',
  subtitle: 'Pontuacao de 0 a 100',
  color: 'green',
  chartData: [
    { label: 'Qualidade', value: 92 },
    { label: 'Velocidade', value: 85 },
    { label: 'Satisfacao', value: 94 },
    { label: 'Eficiencia', value: 78 },
    { label: 'Custo', value: 88 },
    { label: 'Inovacao', value: 82 }
  ]
}
```

**Melhor para:**
- Avaliacoes multi-dimensionais
- Performance em varios aspectos
- Competencias e habilidades
- 4-8 dimensoes

---

## Cores Disponiveis

As seguintes cores podem ser usadas com `color`:

- **cyan** - Azul ciano (padrao, tecnologia)
- **green** - Verde (sucesso, crescimento, positivo)
- **amber** - Amarelo alaranjado (alerta, atencao)
- **red** - Vermelho (critico, urgente)
- **blue** - Azul (informacao, confianca)

## Outros Tipos de Cards

Alem de graficos, a GIA tem cards especiais:

### Metric Card (metric)
Para mostrar uma metrica principal com destaque.
```typescript
{
  type: 'metric',
  title: 'OS Concluidas Hoje',
  value: '67',
  subtitle: '+15% vs. media semanal',
  color: 'cyan'
}
```

### Alert Card (alert)
Para alertas e avisos importantes.
```typescript
{
  type: 'alert',
  title: 'Gargalo Expedicao',
  value: '12',
  subtitle: 'OS aguardando despacho > 24h',
  color: 'red'
}
```

### Status Card (status)
Similar ao metric, para indicadores de status.
```typescript
{
  type: 'status',
  title: 'Sistema Operacional',
  value: 'Online',
  subtitle: 'Todos os servicos funcionando',
  color: 'green'
}
```

### List Card (list)
Para listas de itens com valores.
```typescript
{
  type: 'list',
  title: 'Status Geral Estoque',
  color: 'cyan',
  items: [
    { label: 'Pecas Samsung', value: '342 un.', status: 'good' },
    { label: 'Pecas Apple', value: '89 un.', status: 'neutral' },
    { label: 'Pecas Xiaomi', value: '12 un.', status: 'bad' }
  ]
}
```

## Boas Praticas

1. **Escolha o grafico certo:** Use o tipo que melhor representa seus dados
2. **Cores com significado:** Use green para positivo, red para negativo, cyan para neutro
3. **Titulos claros:** Sempre use titulos descritivos
4. **Subtitulos informativos:** Adicione contexto com subtitulos
5. **Dados adequados:** Respeite os limites de cada tipo (ex: pizza funciona melhor com 3-6 categorias)
6. **Formatacao de valores:** Use numeros apropriados (milhares, porcentagens, etc)

## Exemplos de Uso Combinado

Voce pode combinar varios cards em uma unica resposta:

```typescript
// Metrica principal
{ type: 'metric', title: 'Faturamento Hoje', value: 'R$ 42.850', color: 'green' }

// Grafico de barras
{ type: 'bar', title: 'Por Unidade', chartData: [...] }

// Alerta se necessario
{ type: 'alert', title: 'Atencao', value: '3', subtitle: 'Pecas em falta', color: 'amber' }

// Lista detalhada
{ type: 'list', title: 'Detalhes', items: [...] }
```

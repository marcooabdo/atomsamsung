import type { Colaborador } from './types';

export const mockColaboradores: Colaborador[] = [
  {
    id: '1',
    nome: 'Lucina',
    perfil: 'front_office',
    nivel: 'starter',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 4,
    metaEstrelas: 6,
    pilares: {
      storePlus: { nome: 'Store+', estrelas: 1, maxEstrelas: 3, icone: 'shopping-cart' },
      lpOw: { nome: 'LP/OW', estrelas: 2, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 1, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 0, maxEstrelas: 3, icone: 'handshake' },
      carePlus: { nome: 'Care+', estrelas: 0, maxEstrelas: 2, icone: 'shield' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 5, metaBatida: false },
      { mes: 'Out', ano: 2024, estrelasTotal: 6, metaBatida: true }
    ],
    travadoPorCultura: true,
    motivoTrava: 'Cultura zerada',
    mesesConsecutivos: 0,
    proximoNivel: 'avancado',
    progressoProximoNivel: 67
  },
  {
    id: '2',
    nome: 'Carlos',
    perfil: 'front_office',
    nivel: 'avancado',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 7,
    metaEstrelas: 8,
    pilares: {
      storePlus: { nome: 'Store+', estrelas: 2, maxEstrelas: 3, icone: 'shopping-cart' },
      lpOw: { nome: 'LP/OW', estrelas: 2, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 1, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 1, maxEstrelas: 3, icone: 'handshake' },
      carePlus: { nome: 'Care+', estrelas: 1, maxEstrelas: 2, icone: 'shield' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 8, metaBatida: true },
      { mes: 'Out', ano: 2024, estrelasTotal: 8, metaBatida: true },
      { mes: 'Set', ano: 2024, estrelasTotal: 7, metaBatida: false }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 2,
    proximoNivel: 'elite',
    progressoProximoNivel: 45
  },
  {
    id: '3',
    nome: 'Mariana',
    perfil: 'front_office',
    nivel: 'starter',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 6,
    metaEstrelas: 6,
    pilares: {
      storePlus: { nome: 'Store+', estrelas: 2, maxEstrelas: 3, icone: 'shopping-cart' },
      lpOw: { nome: 'LP/OW', estrelas: 1, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 0, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 2, maxEstrelas: 3, icone: 'handshake' },
      carePlus: { nome: 'Care+', estrelas: 1, maxEstrelas: 2, icone: 'shield' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 6, metaBatida: true },
      { mes: 'Out', ano: 2024, estrelasTotal: 6, metaBatida: true }
    ],
    travadoPorCultura: true,
    motivoTrava: 'Google zerado',
    mesesConsecutivos: 2,
    proximoNivel: 'avancado',
    progressoProximoNivel: 100
  },
  {
    id: '4',
    nome: 'Rafael',
    perfil: 'inside_sales',
    nivel: 'elite',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 11,
    metaEstrelas: 10,
    pilares: {
      lpOw: { nome: 'LP/OW', estrelas: 3, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 2, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 2, maxEstrelas: 3, icone: 'handshake' },
      conversao: { nome: 'Conversao', estrelas: 3, maxEstrelas: 5, icone: 'trending-up' },
      seguroInstalacao: { nome: 'Seguro/Inst', estrelas: 1, maxEstrelas: 2, icone: 'shield-check' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 10, metaBatida: true },
      { mes: 'Out', ano: 2024, estrelasTotal: 11, metaBatida: true },
      { mes: 'Set', ano: 2024, estrelasTotal: 10, metaBatida: true }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 3,
    proximoNivel: 'lider_global',
    progressoProximoNivel: 85
  },
  {
    id: '5',
    nome: 'Amanda',
    perfil: 'inside_sales',
    nivel: 'avancado',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 9,
    metaEstrelas: 8,
    pilares: {
      lpOw: { nome: 'LP/OW', estrelas: 2, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 2, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 2, maxEstrelas: 3, icone: 'handshake' },
      conversao: { nome: 'Conversao', estrelas: 2, maxEstrelas: 5, icone: 'trending-up' },
      seguroInstalacao: { nome: 'Seguro/Inst', estrelas: 1, maxEstrelas: 2, icone: 'shield-check' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 9, metaBatida: true },
      { mes: 'Out', ano: 2024, estrelasTotal: 8, metaBatida: true }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 2,
    proximoNivel: 'elite',
    progressoProximoNivel: 60
  },
  {
    id: '6',
    nome: 'Pedro',
    perfil: 'front_office',
    nivel: 'starter',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 3,
    metaEstrelas: 6,
    pilares: {
      storePlus: { nome: 'Store+', estrelas: 0, maxEstrelas: 3, icone: 'shopping-cart' },
      lpOw: { nome: 'LP/OW', estrelas: 1, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 1, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 1, maxEstrelas: 3, icone: 'handshake' },
      carePlus: { nome: 'Care+', estrelas: 0, maxEstrelas: 2, icone: 'shield' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 4, metaBatida: false }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 0,
    proximoNivel: 'avancado',
    progressoProximoNivel: 25
  },
  {
    id: '7',
    nome: 'Juliana',
    perfil: 'front_office',
    nivel: 'lider_global',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 12,
    metaEstrelas: 12,
    pilares: {
      storePlus: { nome: 'Store+', estrelas: 3, maxEstrelas: 3, icone: 'shopping-cart' },
      lpOw: { nome: 'LP/OW', estrelas: 3, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 2, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 3, maxEstrelas: 3, icone: 'handshake' },
      carePlus: { nome: 'Care+', estrelas: 1, maxEstrelas: 2, icone: 'shield' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 12, metaBatida: true },
      { mes: 'Out', ano: 2024, estrelasTotal: 11, metaBatida: true },
      { mes: 'Set', ano: 2024, estrelasTotal: 12, metaBatida: true }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 6,
    proximoNivel: null,
    progressoProximoNivel: 100
  },
  {
    id: '8',
    nome: 'Bruno',
    perfil: 'inside_sales',
    nivel: 'starter',
    unidade_id: 'fsa',
    unidade_nome: 'Feira de Santana',
    estrelasMesAtual: 5,
    metaEstrelas: 6,
    pilares: {
      lpOw: { nome: 'LP/OW', estrelas: 1, maxEstrelas: 3, icone: 'building' },
      googleReviews: { nome: 'Google', estrelas: 1, maxEstrelas: 2, icone: 'star' },
      cultura: { nome: 'Cultura', estrelas: 1, maxEstrelas: 3, icone: 'handshake' },
      conversao: { nome: 'Conversao', estrelas: 1, maxEstrelas: 5, icone: 'trending-up' },
      seguroInstalacao: { nome: 'Seguro/Inst', estrelas: 1, maxEstrelas: 2, icone: 'shield-check' }
    },
    historicoMeses: [
      { mes: 'Nov', ano: 2024, estrelasTotal: 5, metaBatida: false }
    ],
    travadoPorCultura: false,
    mesesConsecutivos: 0,
    proximoNivel: 'avancado',
    progressoProximoNivel: 40
  }
];

export const mockCurrentUser: Colaborador = {
  id: 'current',
  nome: 'Voce',
  perfil: 'front_office',
  nivel: 'avancado',
  unidade_id: 'fsa',
  unidade_nome: 'Feira de Santana',
  estrelasMesAtual: 7,
  metaEstrelas: 8,
  pilares: {
    storePlus: { nome: 'Store+', estrelas: 2, maxEstrelas: 3, icone: 'shopping-cart' },
    lpOw: { nome: 'LP/OW', estrelas: 2, maxEstrelas: 3, icone: 'building' },
    googleReviews: { nome: 'Google', estrelas: 1, maxEstrelas: 2, icone: 'star' },
    cultura: { nome: 'Cultura', estrelas: 1, maxEstrelas: 3, icone: 'handshake' },
    carePlus: { nome: 'Care+', estrelas: 1, maxEstrelas: 2, icone: 'shield' }
  },
  historicoMeses: [
    { mes: 'Nov', ano: 2024, estrelasTotal: 8, metaBatida: true },
    { mes: 'Out', ano: 2024, estrelasTotal: 7, metaBatida: false },
    { mes: 'Set', ano: 2024, estrelasTotal: 8, metaBatida: true }
  ],
  travadoPorCultura: false,
  mesesConsecutivos: 1,
  proximoNivel: 'elite',
  progressoProximoNivel: 55
};

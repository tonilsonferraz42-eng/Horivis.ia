const PLANOS = {
  starter: {
    nome: 'Starter',
    preco: 67,
    limites: {
      analises_mensais: 5,
      presell: false,
      metricas_pro: false,
      ideias_saas: false,
      palavras_chave: true,
      budget: true,
      blueprint: true,
      anuncios: true,
      compliance: true
    }
  },
  pro: {
    nome: 'Pro',
    preco: 97,
    limites: {
      analises_mensais: 12,
      presell: true,
      metricas_pro: true,
      ideias_saas: 5,
      palavras_chave: true,
      budget: true,
      blueprint: true,
      anuncios: true,
      compliance: true
    }
  },
  scale: {
    nome: 'Scale',
    preco: 147,
    limites: {
      analises_mensais: 20,
      presell: true,
      metricas_pro: true,
      ideias_saas: 12,
      palavras_chave: true,
      budget: true,
      blueprint: true,
      anuncios: true,
      compliance: true
    }
  }
};

function getPlano() {
  try {
    return localStorage.getItem('horivis_plano') || 'pro';
  } catch {
    return 'pro';
  }
}

function getPlanoData() {
  const plano = getPlano();
  return PLANOS[plano] || PLANOS.pro;
}

function getMesKey() {
  const now = new Date();
  return `horivis_analises_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getContagemAnalises() {
  try {
    const key = getMesKey();
    return parseInt(localStorage.getItem(key) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementarAnalise() {
  try {
    const key = getMesKey();
    const atual = getContagemAnalises();
    localStorage.setItem(key, String(atual + 1));
  } catch {
    // ignorar
  }
}

export function canUse(recurso) {
  const plano = getPlanoData();
  const limite = plano.limites[recurso];

  // Se for boolean, retorna directo
  if (typeof limite === 'boolean') return limite;

  // Se for número (analises_mensais, ideias_saas)
  if (typeof limite === 'number') {
    const usadas = recurso === 'analises_mensais' ? getContagemAnalises() : 0;
    return usadas < limite;
  }

  return false;
}

export function getRemainingAnalises() {
  const plano = getPlanoData();
  const limite = plano.limites.analises_mensais;
  const usadas = getContagemAnalises();
  return Math.max(0, limite - usadas);
}

export function getPlanoNome() {
  return getPlanoData().nome;
}

export function getPlanoPreco() {
  return getPlanoData().preco;
}

export function upgradeTo(plano) {
  if (PLANOS[plano]) {
    localStorage.setItem('horivis_plano', plano);
    return true;
  }
  return false;
}

export function getPlanoInfo() {
  const plano = getPlano();
  const data = getPlanoData();
  const restantes = getRemainingAnalises();
  return {
    id: plano,
    nome: data.nome,
    preco: data.preco,
    restantes,
    total: data.limites.analises_mensais
  };
}

export function usarAnalise() {
  if (getRemainingAnalises() <= 0) return false;
  incrementarAnalise();
  return true;
}

export function getRecursosBloqueados() {
  const plano = getPlanoData();
  const bloqueados = [];
  for (const [recurso, valor] of Object.entries(plano.limites)) {
    if (typeof valor === 'boolean' && !valor) {
      bloqueados.push(recurso);
    }
  }
  return bloqueados;
}

export function getProximoPlano() {
  const atual = getPlano();
  const ordem = ['starter', 'pro', 'scale'];
  const idx = ordem.indexOf(atual);
  if (idx < ordem.length - 1) {
    const prox = ordem[idx + 1];
    return { id: prox, ...PLANOS[prox] };
  }
  return null;
}
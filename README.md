# HORIVIS — Escale suas Campanhas com Inteligência Artificial

> Plataforma de IA para afiliados e produtores que querem tomar decisões baseadas em dados, não em achismo.

---

## 📁 Estrutura do Projeto

```
horivis/
├── horivis-index.html.  # Landing page de marketing
└── horivis-app.jsx       # Plataforma IA (React)
```

---

## 🌐 Site (`index.html`)

Landing page completa da HORIVIS. Abra direto no navegador ou hospede em qualquer servidor estático (Vercel, Netlify, GitHub Pages).

**Seções:**
- Hero com cards animados
- Estatísticas da plataforma
- Principais funcionalidades
- Como funciona (5 passos)
- Grade de recursos avançados
- Integrações (BR + Internacionais + Tráfego)
- CTA final + Footer

---

## 🤖 App IA (`horivis-app.jsx`)

Plataforma React com 5 ferramentas alimentadas por IA (Claude Sonnet 4).

### Ferramentas disponíveis

| Ferramenta | Descrição |
|---|---|
| ◈ Análise de Ofertas | Score de viabilidade, ROI estimado, CPC, público-alvo |
| ◉ Compliance Google | Validação de políticas do Google Ads antes de investir |
| ⬡ Gerador de Anúncios | Headlines, descrições e CTAs com contador de caracteres |
| ◑ Palavras-chave | Volume, competição, CPC estimado e intenção de busca |
| ◒ Análise de Métricas | ROAS, CTR, CPA e veredicto (Escalar / Otimizar / Pausar) |
| ◎ Integrações | 30+ plataformas brasileiras e internacionais |

### Como usar o app

**1. Em um projeto React existente:**
```bash
npm install react react-dom
```
Copie `horivis-app.jsx` para `src/` e importe no seu `App.jsx`:
```jsx
import Horivis from './horivis-app';
export default function App() { return <Horivis />; }
```

**2. Via Claude.ai Artifacts:**
Cole o conteúdo do arquivo diretamente em um novo Artifact React no Claude.

---

## 🔌 Integrações Suportadas

**🇧🇷 Brasileiras**
Hotmart · Kiwify · Eduzz · Monetizze · Braip · Perfectpay · TicTocPay · Doppus · Cademi · Pepper

**🌎 Internacionais**
ClickBank · ClickFunnels · Digistore24 · WarriorPlus · JVZoo · Shopify · Gumroad · Teachable · Thinkific · ThriveCart · WooCommerce · SamCart

**📊 Tráfego & Ferramentas**
Google Ads · Meta Ads · TikTok Ads · YouTube Ads · Twitter/X Ads · LinkedIn Ads · ActiveCampaign · Klaviyo

---

## 🎨 Design

- **Tema:** Dark luxury com acentos dourados (`#f0a500`)
- **Fontes:** Bebas Neue · Outfit · JetBrains Mono
- **Animações:** Fade-in no scroll, rings de score, pulse indicators

---

## ⚡ Tech Stack

- React (JSX) + Hooks
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- CSS-in-JS (inline styles)
- Google Fonts

---

## 📄 Licença

MIT © 2025 HORIVIS

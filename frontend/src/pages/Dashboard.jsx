import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Megaphone, Activity, Settings, ChevronRight,
  Search, ShieldCheck, BarChart3, FileText, Key, DollarSign, GitBranch,
  Lightbulb, History, Copy, Download, Trash2, Star, RefreshCw,
  X, AlertCircle, Clock, CheckCircle2, ExternalLink, ArrowLeftRight,
  LogOut, User
} from 'lucide-react';
import { callClaude, callKeywords, conectarGoogleDrive, buscarArquivosDrive, statusConexaoDrive } from '../lib/apiHandler';
import { useApiStatus } from '../lib/ApiStatusContext';
import { useAuth } from '../lib/useAuth';

// ============================================================
// CONSTANTES
// ============================================================
const MODULES = [
  { id: 'google-drive',      label: 'Google Drive',          icon: ExternalLink },
  { id: 'analise-ofertas',   label: 'Análise de Ofertas',   icon: Search },
  { id: 'compliance-google', label: 'Compliance Google',     icon: ShieldCheck },
  { id: 'analise-mercado',   label: 'Análise de Mercado',    icon: BarChart3 },
  { id: 'gerador-anuncios',  label: 'Gerador de Anúncios',   icon: Megaphone },
  { id: 'gerador-presell',   label: 'Gerador de Presell',    icon: FileText },
  { id: 'palavras-chave',    label: 'Palavras-chave',        icon: Key },
  { id: 'budget-recomendado',label: 'Budget Recomendado',    icon: DollarSign },
  { id: 'blueprint-campanha',label: 'Blueprint de Campanha', icon: GitBranch },
  { id: 'ideias-apps',       label: 'Ideias Apps/SaaS',     icon: Lightbulb },
];

const LOADING_MESSAGES = [
  'A analisar o produto...',
  'A verificar o mercado...',
  'A gerar recomendações...',
  'A preparar o relatório...',
];

// ============================================================
// HELPERS
// ============================================================
function getScoreColor(score) {
  if (score >= 71) return 'text-green-400';
  if (score >= 41) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBg(score) {
  if (score >= 71) return 'border-green-500';
  if (score >= 41) return 'border-yellow-500';
  return 'border-red-500';
}

function getDifficultyColor(dificuldade) {
  if (dificuldade <= 30) return 'text-green-400 bg-green-500/10';
  if (dificuldade <= 60) return 'text-yellow-400 bg-yellow-500/10';
  return 'text-red-400 bg-red-500/10';
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ============================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================
function ScoreCircle({ score, size = 60 }) {
  const color = score >= 71 ? '#22c55e' : score >= 41 ? '#eab308' : '#ef4444';
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="14" fontWeight="bold" className="rotate-90">{score}</text>
    </svg>
  );
}

function LoadingSpinner({ onCancel }) {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-cyan-400/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin" />
      </div>
      <div className="h-2 w-48 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-pulse"
          style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <p className="text-white/60 text-sm animate-pulse">{LOADING_MESSAGES[msgIndex]}</p>
      {onCancel && (
        <button onClick={onCancel} className="text-xs text-red-400 hover:text-red-300 underline">
          Cancelar
        </button>
      )}
    </div>
  );
}

function StatusBadge() {
  const { status, message } = useApiStatus();
  const colors = {
    online: 'bg-green-500/20 text-green-400 border-green-500/30',
    demo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    offline: 'bg-red-500/20 text-red-400 border-red-500/30',
    checking: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const dots = {
    online: 'bg-green-400',
    demo: 'bg-yellow-400',
    offline: 'bg-red-400',
    checking: 'bg-gray-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colors[status]}`}
      title={`Status da API: ${message}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {message}
    </span>
  );
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

function ErrorToast({ message, onRetry }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-300 text-sm">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-xs text-red-400 hover:text-red-300 underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

function SuccessToast({ message, visible, onClose }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in shadow-lg backdrop-blur-sm">
      <CheckCircle2 className="w-4 h-4" /> {message}
    </div>
  );
}

function Tooltip({ text, children }) {
  return (
    <span className="relative group" title={text}>
      {children}
    </span>
  );
}

// ============================================================
// COMPONENTE REUTILIZÁVEL — INPUT COM VALIDAÇÃO
// ============================================================
function ValidatedInput({ value, onChange, placeholder, type = 'text', minLength, maxLength, required, className = '', icon: Icon, ...props }) {
  const [touched, setTouched] = useState(false);
  const len = value?.length || 0;

  const showError = touched && (
    (required && len === 0) ||
    (minLength && len < minLength) ||
    (maxLength && len > maxLength)
  );

  const helpText = (() => {
    if (!touched) return null;
    if (minLength && len < minLength) return `Mínimo de ${minLength} caracteres`;
    if (maxLength && len > maxLength) return `Máximo de ${maxLength} caracteres`;
    return null;
  })();

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${className} ${showError ? '!border-red-500/50 focus:!border-red-400' : ''}`}
          {...props}
        />
      </div>
      {helpText && (
        <p className="text-[10px] text-red-400/80 ml-1">{helpText}</p>
      )}
      {maxLength && (
        <p className={`text-[10px] ml-1 ${len > maxLength ? 'text-red-400' : 'text-white/30'}`}>
          {len}/{maxLength}
        </p>
      )}
    </div>
  );
}

// ============================================================
// MÓDULOS
// ============================================================

function AnaliseOfertas() {
  const [produto, setProduto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [isCache, setIsCache] = useState(false);
  const [historico, setHistorico] = useState(() => {
    try { return JSON.parse(localStorage.getItem('horivis_historico_ofertas') || '[]'); }
    catch { return []; }
  });
  const [comparando, setComparando] = useState(false);
  const [produto2, setProduto2] = useState('');
  const [resultado2, setResultado2] = useState(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Impede envio duplicado
  const isSubmitting = loading;

  const analisar = async (prod, setRes, setLoad, setErr, setDemo, setCache) => {
    if (!prod || prod.trim().length < 3) {
      setErr('Informe um nome de produto válido (mínimo 3 caracteres).');
      return;
    }
    setLoad(true);
    setErr('');
    setRes(null);
    setDemo(false);
    setCache(false);

    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: `Analisa a oferta de afiliados para o produto: ${prod}. Fornece: score (0-100), nível, análise detalhada, pontos fortes, pontos fracos, recomendação e concorrentes com scores.` }
    ], {
      module: 'analise-ofertas',
      signal: abortRef.current.signal
    });

    if (result.fromCache) setIsCache?.(true);
    setCache(result.fromCache);
    setDemo(result.fromDemo);
    setLoad(false);

    if (result.success) {
      setRes(result.data);
      const novoHistorico = [
        { produto: prod, data: Date.now(), resultado: result.data, status: 'ok' },
        ...historico.filter(h => h.produto !== prod)
      ].slice(0, 5);
      setHistorico(novoHistorico);
      localStorage.setItem('horivis_historico_ofertas', JSON.stringify(novoHistorico));
    } else {
      setErr(result.error);
      setIsDemo(true);
      // Salva no histórico mesmo em erro para rastreabilidade
      const erroHistorico = { produto: prod, data: Date.now(), resultado: null, status: 'erro', erro: result.error };
      const novoHistorico = [erroHistorico, ...historico.filter(h => h.produto !== prod)].slice(0, 5);
      setHistorico(novoHistorico);
      localStorage.setItem('horivis_historico_ofertas', JSON.stringify(novoHistorico));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    analisar(produto, setResultado, setLoading, setError, setIsDemo, setIsCache);
  };

  const comparar = () => {
    if (!produto2 || produto2.length < 3) return;
    setComparando(true);
    analisar(produto2, setResultado2, setLoading, setError, setIsDemo, setIsCache);
  };

  const copiarRelatorio = () => {
    if (!resultado) return;
    const texto = `Relatório: ${resultado.produto}\nScore: ${resultado.score}/100\nNível: ${resultado.nivel}\n\nAnálise:\n${resultado.analise}\n\nPontos Fortes:\n${resultado.pontosFortes?.map(p => `- ${p}`).join('\n')}\n\nPontos Fracos:\n${resultado.pontosFracos?.map(p => `- ${p}`).join('\n')}\n\nRecomendação:\n${resultado.recomendacao}`;
    navigator.clipboard.writeText(texto).then(() => {
      // toast handled by parent
    });
  };

  const novaAnalise = () => {
    setProduto('');
    setResultado(null);
    setError('');
    setIsDemo(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ValidatedInput
          value={produto}
          onChange={e => setProduto(e.target.value)}
          placeholder="Nome do produto para analisar (ex: Prodentim)"
          minLength={3}
          required
          className="input-base pl-10 pr-4"
          icon={Search}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting || produto.length < 3}
            className="btn-primary flex-1 disabled:opacity-50">
            {isSubmitting ? 'A analisar...' : 'Analisar Oferta'}
          </button>
          {resultado && (
            <>
              <Tooltip text="Copiar Relatório">
                <button type="button" onClick={copiarRelatorio}
                  className="btn-primary !w-auto !px-4 !bg-white/10 !text-white !hover:bg-white/20">
                  <Copy className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip text="Nova Análise">
                <button type="button" onClick={novaAnalise}
                  className="btn-primary !w-auto !px-4 !bg-white/10 !text-white !hover:bg-white/20">
                  <X className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip text="Comparar com outro produto">
                <button type="button" onClick={() => setComparando(true)}
                  className="btn-primary !w-auto !px-4 !bg-white/10 !text-white !hover:bg-white/20">
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </form>

      {error && <ErrorToast message={error} onRetry={handleSubmit} />}

      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {isCache && resultado && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
          <Clock className="w-3 h-3" /> 📋 Resultado guardado em cache
        </div>
      )}

      {isDemo && resultado && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
          <Activity className="w-3 h-3" /> Modo demonstração ativo
        </div>
      )}

      {resultado && !comparando && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">{resultado.produto}</h3>
            <div className="flex items-center gap-3">
              <ScoreCircle score={resultado.score} />
            </div>
          </div>
          <p className="text-sm" style={{ color: resultado.score >= 71 ? '#22c55e' : resultado.score >= 41 ? '#eab308' : '#ef4444' }}>
            {resultado.nivel}
          </p>
          <p className="text-white/70 text-sm leading-relaxed">{resultado.analise}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h4 className="text-green-400 text-sm font-semibold mb-3">✅ Pontos Fortes</h4>
              <ul className="space-y-2">
                {resultado.pontosFortes?.map((p, i) => <li key={i} className="text-white/60 text-xs flex gap-2"><span className="text-green-400">•</span>{p}</li>)}
              </ul>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h4 className="text-red-400 text-sm font-semibold mb-3">⚠️ Pontos Fracos</h4>
              <ul className="space-y-2">
                {resultado.pontosFracos?.map((p, i) => <li key={i} className="text-white/60 text-xs flex gap-2"><span className="text-red-400">•</span>{p}</li>)}
              </ul>
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
            <h4 className="text-cyan-400 text-sm font-semibold mb-2">💡 Recomendação</h4>
            <p className="text-white/70 text-sm">{resultado.recomendacao}</p>
          </div>

          {resultado.concorrentes && (
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">Concorrentes</h4>
              <div className="grid grid-cols-2 gap-2">
                {resultado.concorrentes.map((c, i) => (
                  <div key={i} className="bg-white/5 rounded-xl px-3 py-2 flex justify-between items-center border border-white/10">
                    <span className="text-white/70 text-xs">{c.nome}</span>
                    <span className={`text-xs font-bold ${getScoreColor(c.score)}`}>{c.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {comparando && (
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Comparar com outro produto</h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input type="text" value={produto2} onChange={e => setProduto2(e.target.value)}
              placeholder="Nome do segundo produto"
              className="input-base pl-10 pr-4" />
          </div>
          <button onClick={comparar} disabled={!produto2 || produto2.length < 3}
            className="btn-primary disabled:opacity-50">
            Comparar
          </button>
          {resultado2 && (
            <div className="mt-4 space-y-3">
              <h5 className="text-sm font-bold text-white/80">{resultado2.produto}</h5>
              <div className="flex items-center justify-center">
                <ScoreCircle score={resultado2.score} />
              </div>
              <p className="text-white/60 text-xs">{resultado2.analise}</p>
            </div>
          )}
          <button onClick={() => { setComparando(false); setResultado2(null); setProduto2(''); }}
            className="text-xs text-white/40 hover:text-white/60 underline">
            Fechar comparação
          </button>
        </div>
      )}

      {historico.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
            <Clock className="w-3 h-3" /> Últimas análises
          </h4>
          <div className="space-y-2">
            {historico.map((h, i) => (
              <div key={i}
                className="bg-white/5 rounded-xl px-4 py-3 flex justify-between items-center border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => { setProduto(h.produto); setResultado(h.resultado); }}>
                <div>
                  <span className="text-white/80 text-sm font-medium">{h.produto}</span>
                  <span className="text-white/40 text-xs ml-2">{formatDate(h.data)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {h.resultado?.score && (
                    <span className={`text-xs font-bold ${getScoreColor(h.resultado.score)}`}>
                      {h.resultado.score}/100
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleDrive() {
  const [conectado, setConectado] = useState(null);
  const [arquivos, setArquivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [carregandoStatus, setCarregandoStatus] = useState(true);

  const formatarTamanho = (bytes) => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const tipoArquivo = (mimeType) => {
    if (mimeType?.includes('folder')) return { label: 'Pasta', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    if (mimeType?.includes('pdf')) return { label: 'PDF', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return { label: 'Planilha', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
    if (mimeType?.includes('document') || mimeType?.includes('word')) return { label: 'Documento', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return { label: 'Apresentação', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
    return { label: 'Ficheiro', color: 'bg-white/10 text-white/70 border-white/20' };
  };

  const carregarStatus = async () => {
    setCarregandoStatus(true);
    try {
      const data = await statusConexaoDrive();
      setConectado(data.conectado);
    } catch (e) {
      setError(e.message);
    } finally {
      setCarregandoStatus(false);
    }
  };

  useEffect(() => { carregarStatus(); }, []);

  const handleConectar = async () => {
    setLoading(true); setError('');
    try {
      await conectarGoogleDrive();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleListar = async () => {
    setLoading(true); setError('');
    try {
      const files = await buscarArquivosDrive();
      setArquivos(files);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <ErrorToast message={error} onRetry={carregarStatus} />}
      {loading && <LoadingSpinner />}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Estado da Ligação</h3>
          <p className="text-xs text-white/40 mt-0.5">
            {carregandoStatus ? 'A verificar estado...' : conectado ? 'Ligado ao Google Drive' : 'Não conectado'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleConectar} disabled={loading || conectado}
            className="btn-primary disabled:opacity-50 !w-auto !px-4">
            {conectado ? 'Conectado' : loading ? 'A ligar...' : 'Conectar Google Drive'}
          </button>
          <button onClick={carregarStatus} disabled={loading}
            className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      {conectado && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-sm text-green-300 font-medium">Google Drive conectado com sucesso</p>
            <p className="text-xs text-white/40">Podes listar ficheiros abaixo.</p>
          </div>
          <button onClick={handleListar} disabled={loading}
            className="ml-auto btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20">
            Listar ficheiros
          </button>
        </div>
      )}
      {arquivos.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <h4 className="text-sm font-semibold text-white/80">Ficheiros recentes</h4>
          <div className="space-y-2">
            {arquivos.map((file, i) => {
              const tipo = tipoArquivo(file.mimeType);
              return (
                <div key={file.id || i} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{file.name}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {tipo.label} · {formatarTamanho(file.size)} · {formatDate(file.modifiedTime)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tipo.color}`}>{tipo.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceGoogle() {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [isCache, setIsCache] = useState(false);
  const abortRef = useRef(null);

  const analisar = async () => {
    if (!texto) { setError('Insere o texto do anúncio para análise.'); return; }
    setLoading(true); setError(''); setResultado(null);

    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: `Analisa o compliance Google Ads para: "${texto}". Fornece: status (aprovado/aprovado com ressalvas/reprovado), cor (green/yellow/red), politicasVerificadas (array), sugestoes (array), textoCorrigido (versão corrigida do texto).` }
    ], { module: 'compliance-google', signal: abortRef.current.signal });

    setIsCache(result.fromCache);
    setIsDemo(result.fromDemo);
    setLoading(false);
    if (result.success) setResultado(result.data);
    else setError(result.error);
  };

  const aplicarCorrecao = () => {
    if (resultado?.textoCorrigido) setTexto(resultado.textoCorrigido);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="relative">
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Cole aqui o texto do anúncio para verificar compliance com políticas do Google Ads..."
            className="input-base min-h-[120px] resize-y" />
          <div className="absolute bottom-3 right-3 text-xs text-white/30">
            {texto.length} caracteres
          </div>
        </div>
        <button onClick={analisar} disabled={loading || !texto}
          className="btn-primary disabled:opacity-50">
          {loading ? 'A verificar...' : 'Verificar Compliance'}
        </button>
      </div>

      {error && <ErrorToast message={error} onRetry={analisar} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          <div className={`rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2 ${
            resultado.cor === 'green' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            resultado.cor === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
            'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {resultado.cor === 'green' ? '🟢' : resultado.cor === 'yellow' ? '🟡' : '🔴'} {resultado.status}
          </div>

          {/* Indicador de risco visual */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <h4 className="text-sm font-semibold text-white/80 mb-2">⚠️ Nível de Risco</h4>
            <div className="flex items-center gap-3">
              <div className={`flex-1 h-3 rounded-full ${
                resultado.cor === 'green' ? 'bg-green-500' :
                resultado.cor === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`} style={{ width: resultado.cor === 'red' ? '100%' : resultado.cor === 'yellow' ? '60%' : '30%' }} />
              <span className="text-xs text-white/40">
                {resultado.cor === 'green' ? 'Baixo' : resultado.cor === 'yellow' ? 'Médio' : 'Alto'}
              </span>
            </div>
          </div>

          {/* Status detalhado das políticas */}
          {resultado.politicasVerificadas && resultado.politicasVerificadas.length > 0 && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-3">📋 Políticas Verificadas</h4>
              <ul className="space-y-2">
                {resultado.politicasVerificadas.map((p, i) => (
                  <li key={i} className="text-white/60 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sugestões de correção */}
          {resultado.sugestoes && resultado.sugestoes.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
              <h4 className="text-yellow-400 text-sm font-semibold mb-3">💡 Sugestões de Correção</h4>
              <ul className="space-y-2">
                {resultado.sugestoes.map((s, i) => (
                  <li key={i} className="text-white/70 text-xs flex gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*Texto corrigido com ação de aplicar */}
          {resultado.textoCorrigido && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-cyan-400 text-sm font-semibold">✏️ Texto Corrigido (sugestão)</h4>
                <button onClick={aplicarCorrecao}
                  className="text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-lg transition-colors">
                  Aplicar Correção
                </button>
              </div>
              <p className="text-white/70 text-sm">{resultado.textoCorrigido}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnaliseMercado() {
  const [produto, setProduto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [isCache, setIsCache] = useState(false);
  const abortRef = useRef(null);

  const analisar = async () => {
    if (!produto.trim()) {
      setError('Informe o produto ou nicho para análise de mercado.');
      return;
    }
    setLoading(true); setError(''); setResultado(null);
    setDemo(false); setIsCache(false);
    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: `Analisa o mercado para o produto: ${produto}. Fornece: produto, mercado, tendencia, scoreGeral (0-100), concorrentes (nome, score, share), oportunidades.` }
    ], { module: 'analise-mercado', signal: abortRef.current.signal });

    setDemo(result.fromDemo);
    setIsCache(result.fromCache);
    setLoading(false);
    if (result.success) setResultado(result.data);
    else setError(result.error);
  };

  const getTendenciaColor = (t) => {
    if (!t) return 'text-white/60';
    const lower = t.toLowerCase();
    if (lower.includes('crescimento') || lower.includes('alta') || lower.includes('subindo')) return 'text-green-400';
    if (lower.includes('queda') || lower.includes('baixa') || lower.includes('descendo')) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input type="text" value={produto} onChange={e => setProduto(e.target.value)}
            placeholder="Produto para análise de mercado"
            className="input-base pl-10" />
        </div>
        <button onClick={analisar} disabled={loading || !produto}
          className="btn-primary !w-auto !px-6 disabled:opacity-50">
          {loading ? 'A analisar...' : 'Analisar'}
        </button>
      </div>

      {isDemo && !error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
          <Activity className="w-3 h-3" /> Modo demonstração — dados estimados
        </div>
      )}

      {error && <ErrorToast message={error} onRetry={analisar} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">{resultado.produto}</h3>
            <ScoreCircle score={resultado.scoreGeral} />
          </div>
          <p className="text-white/60 text-sm">
            {resultado.mercado} — <span className={getTendenciaColor(resultado.tendencia)}>{resultado.tendencia}</span>
          </p>

          {/* Indicador visual de tendência */}
          {resultado.tendencia && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">📈 Tendência de Mercado</h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: '70%' }} />
                </div>
                <span className="text-xs text-white/40">Últimos 30 dias</span>
              </div>
            </div>
          )}

          {/* Gráfico de barras concorrentes */}
          {resultado.concorrentes && (
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">Concorrência</h4>
              <div className="space-y-2">
                {resultado.concorrentes.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-white/60 text-xs w-28 truncate">{c.nome}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.score >= 71 ? 'bg-green-500' : c.score >= 41 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${c.score}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${getScoreColor(c.score)}`}>{c.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado.oportunidades && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <h4 className="text-green-400 text-sm font-semibold mb-3">🚀 Oportunidades</h4>
              <ul className="space-y-2">
                {resultado.oportunidades.map((o, i) => (
                  <li key={i} className="text-white/70 text-xs flex gap-2"><span className="text-green-400">•</span>{o}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
              <Download className="w-3 h-3" /> Exportar para PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeradorAnuncios() {
  const [produto, setProduto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const abortRef = useRef(null);

  const gerar = async (maisVariacoes = false) => {
    if (!produto) { setError('Insere o nome do produto.'); return; }
    setLoading(true); setError('');
    if (!maisVariacoes) setResultado(null);

    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: `Gera 3 anúncios para Google Ads para o produto: ${produto}. Cada anúncio deve ter headline (máx 30 caracteres), descricao (máx 90 caracteres) e cta.` }
    ], { module: 'gerador-anuncios', signal: abortRef.current.signal });

    setLoading(false);
    if (result.success) {
      if (maisVariacoes && resultado) {
        setResultado({
          anuncios: [...resultado.anuncios, ...result.data.anuncios]
        });
      } else {
        setResultado(result.data);
      }
    } else setError(result.error);
  };

  const copiarAnuncio = (anuncio, index) => {
    const texto = `${anuncio.headline}\n${anuncio.descricao}\n[${anuncio.cta}]`;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiedIndex(index);
      setToastVisible(true);
      setTimeout(() => { setCopiedIndex(null); setToastVisible(false); }, 2000);
    });
  };

  return (
    <div className="space-y-6">
      <SuccessToast message="✓ Copiado!" visible={toastVisible} onClose={() => setToastVisible(false)} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input type="text" value={produto} onChange={e => setProduto(e.target.value)}
            placeholder="Produto para gerar anúncios"
            className="input-base pl-10" />
        </div>
        <button onClick={() => gerar()} disabled={loading || !produto}
          className="btn-primary !w-auto !px-6 disabled:opacity-50">
          {loading ? 'A gerar...' : 'Gerar Anúncios'}
        </button>
      </div>

      {error && <ErrorToast message={error} onRetry={() => gerar()} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid gap-4">
            {resultado.anuncios?.map((a, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10 relative group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="bg-white/10 rounded-xl p-3 mb-3 border border-white/5">
                      <p className="text-sm font-bold text-white/90 mb-1">
                        {a.headline}
                        <span className="text-white/30 text-xs ml-2">{a.headline.length}/30</span>
                      </p>
                      <p className="text-xs text-white/60">
                        {a.descricao}
                        <span className="text-white/30 text-xs ml-2">{a.descricao.length}/90</span>
                      </p>
                    </div>
                    <div className="bg-cyan-500/20 text-cyan-300 text-xs font-medium px-3 py-1 rounded-full inline-block">
                      {a.cta}
                    </div>
                  </div>
                  <Tooltip text="Copiar anúncio">
                    <button onClick={() => copiarAnuncio(a, i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 rounded-lg p-2">
                      {copiedIndex === i ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                    </button>
                  </Tooltip>
                </div>
                {/* Preview Google */}
                <div className="mt-3 bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-white/10 rounded-full" />
                    <span className="text-[10px] text-white/30">anuncio.google.com</span>
                    <ExternalLink className="w-2 h-2 text-white/20" />
                  </div>
                  <p className="text-xs font-semibold text-blue-300">{a.headline}</p>
                  <p className="text-[10px] text-white/50">{a.descricao}</p>
                  <p className="text-[10px] text-green-400">{a.cta}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => gerar(true)}
            className="btn-primary !bg-white/10 !text-white hover:!bg-white/20">
            Gerar Mais 3 Variações
          </button>
        </div>
      )}
    </div>
  );
}

function GeradorPresell() {
  const [produto, setProduto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [isCache, setIsCache] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const abortRef = useRef(null);

  const gerar = async () => {
    const nome = produto.trim();
    if (!nome) { setError('Informe o nome do produto para gerar o presell.'); return; }
    if (nome.length < 3) { setError('O nome do produto deve ter pelo menos 3 caracteres.'); return; }
    setLoading(true); setError(''); setResultado(null); setDemo(false); setIsCache(false);
    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: `Gera uma página de pré-venda (presell) completa em HTML para o produto: ${nome}. A página deve ser persuasiva, ter headline clara, benefícios, depoimentos, garantia e CTA forte. Fornece: html (página completa), score (0-100), sugestoes.` }
    ], { module: 'gerador-presell', signal: abortRef.current.signal });

    setIsDemo(result.fromDemo);
    setIsCache(result.fromCache);
    setLoading(false);
    if (result.success) setResultado(result.data);
    else setError(result.error);
  };

  const copiarHTML = () => {
    if (!resultado?.html) return;
    navigator.clipboard.writeText(resultado.html);
  };

  const descarregarHTML = () => {
    if (!resultado?.html) return;
    const blob = new Blob([resultado.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presell-${produto.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <ValidatedInput
          value={produto}
          onChange={e => setProduto(e.target.value)}
          placeholder="Produto para gerar página de pré-venda"
          minLength={3}
          required
          className="input-base pl-10"
          icon={Search}
        />
        <button onClick={gerar} disabled={loading || !produto}
          className="btn-primary !w-auto !px-6 disabled:opacity-50">
          {loading ? 'A gerar...' : 'Gerar Presell'}
        </button>
      </div>

      {isDemo && !error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
          <Activity className="w-3 h-3" /> Modo demonstração — presell estimada
        </div>
      )}

      {error && <ErrorToast message={error} onRetry={gerar} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <ScoreCircle score={resultado.score} />
            <div>
              <p className="text-sm font-semibold text-white/80">Score de Qualidade</p>
              <p className="text-xs text-white/40">Avaliação da página de pré-venda</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Tooltip text="Copiar HTML completo">
              <button onClick={copiarHTML}
                className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20 flex items-center gap-2">
                <Copy className="w-4 h-4" /> Copiar HTML
              </button>
            </Tooltip>
            <Tooltip text="Descarregar ficheiro HTML">
              <button onClick={descarregarHTML}
                className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20 flex items-center gap-2">
                <Download className="w-4 h-4" /> Descarregar
              </button>
            </Tooltip>
            <Tooltip text="Preview da página">
              <button onClick={() => setShowPreview(!showPreview)}
                className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Preview
              </button>
            </Tooltip>
          </div>

          {resultado.sugestoes && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
              <h4 className="text-yellow-400 text-sm font-semibold mb-2">💡 Sugestões de Melhoria</h4>
              <ul className="space-y-1">
                {resultado.sugestoes.map((s, i) => (
                  <li key={i} className="text-white/60 text-xs">• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {showPreview && (
            <div className="bg-white rounded-2xl overflow-hidden border border-white/10" style={{ height: '500px' }}>
              <iframe srcDoc={resultado.html} title="Preview Presell"
                className="w-full h-full" style={{ background: 'white' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PalavrasChave() {
  const [produto, setProduto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [isCache, setIsCache] = useState(false);
  const [sortField, setSortField] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [semResultado, setSemResultado] = useState(false);
  const abortRef = useRef(null);

  const gerar = async () => {
    const termo = produto.trim();
    if (!termo) { setError('Informe um nicho ou produto para buscar palavras-chave.'); return; }
    setLoading(true); setError(''); setResultado(null); setSemResultado(false);
    setDemo(false); setIsCache(false);
    abortRef.current = new AbortController();

    const result = await callKeywords(termo, { signal: abortRef.current.signal });

    setLoading(false);
    if (result.success) {
      const data = result.data;
      const temResultado = (data?.results?.length || 0) > 0;
      if (!temResultado) setSemResultado(true);
      setResultado(data);
    } else {
      setError(result.error);
    }
  };

  const exportarCSV = () => {
    if (!resultado) return;
    const linhas = ['keyword,volume,dificuldade,concorrencia,tipo'];
    resultado.principais?.forEach(k => linhas.push(`${k.keyword},${k.volume},${k.dificuldade},${k.concorrencia},Principal`));
    resultado.longTail?.forEach(k => linhas.push(`${k.keyword},${k.volume},${k.dificuldade},${k.concorrencia},Long-tail`));
    const csv = linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${produto.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ordenar = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortedPrincipais = resultado?.principais ? [...resultado.principais].sort((a, b) => {
    const mult = sortDir === 'asc' ? 1 : -1;
    return (a[sortField] > b[sortField] ? 1 : -1) * mult;
  }) : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <ValidatedInput
          value={produto}
          onChange={e => setProduto(e.target.value)}
          placeholder="Nicho ou produto (ex: suplementos dentais)"
          minLength={3}
          required
          className="input-base pl-10"
          icon={Search}
        />
        <button onClick={gerar} disabled={loading || !produto}
          className="btn-primary !w-auto !px-6 disabled:opacity-50">
          {loading ? 'A gerar...' : 'Gerar Keywords'}
        </button>
      </div>

      {error && <ErrorToast message={error} onRetry={gerar} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}

      {resultado && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-white/80">Palavras-chave Principais</h4>
            <button onClick={exportarCSV}
              className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
              <Download className="w-3 h-3" /> Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-left pb-3 font-medium">Keyword</th>
                  <th className="text-right pb-3 font-medium cursor-pointer hover:text-white/60" onClick={() => ordenar('volume')}>
                    Volume {sortField === 'volume' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="text-right pb-3 font-medium cursor-pointer hover:text-white/60" onClick={() => ordenar('dificuldade')}>
                    Dificuldade {sortField === 'dificuldade' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="text-right pb-3 font-medium">Concorrência</th>
                </tr>
              </thead>
              <tbody>
                {sortedPrincipais.map((k, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 text-white/80 font-medium">{k.keyword}</td>
                    <td className="py-3 text-right text-white/60">{k.volume.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(k.dificuldade)}`}>
                        {k.dificuldade}
                      </span>
                    </td>
                    <td className="py-3 text-right text-white/60">{k.concorrencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h4 className="text-sm font-semibold text-white/60 mb-3">🔍 Long-tail Keywords</h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {resultado.longTail?.map((k, i) => (
                <div key={i} className="bg-white/5 rounded-xl px-3 py-2 border border-white/10 flex justify-between items-center">
                  <div>
                    <p className="text-white/70 text-xs">{k.keyword}</p>
                    <p className="text-white/30 text-[10px]">{k.volume.toLocaleString()} pesquisas/mês</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(k.dificuldade)}`}>
                    {k.dificuldade}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BlueprintCampanha() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('horivis_blueprint_checklist') || '{}'); }
    catch { return {}; }
  });
  const abortRef = useRef(null);

  const gerar = async () => {
    setLoading(true); setError('');
    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: 'Gera um blueprint de campanha de 4 semanas para marketing de afiliados. Fornece: semanas (numero, titulo, tarefas).' }
    ], { module: 'blueprint-campanha', signal: abortRef.current.signal });

    setLoading(false);
    if (result.success) setResultado(result.data);
    else setError(result.error);
  };

  const toggleTask = (weekIdx, taskIdx) => {
    const key = `${weekIdx}-${taskIdx}`;
    const novo = { ...checklist, [key]: !checklist[key] };
    setChecklist(novo);
    localStorage.setItem('horivis_blueprint_checklist', JSON.stringify(novo));
  };

  useEffect(() => { if (!resultado) gerar(); }, []);

  return (
    <div className="space-y-6">
      {error && <ErrorToast message={error} onRetry={gerar} />}
      {loading && <LoadingSpinner />}

      {resultado && (
        <div className="space-y-6 animate-fade-in">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-400 to-blue-500" />

            {resultado.semanas?.map((semana, wi) => (
              <div key={wi} className="relative pl-8 pb-8 last:pb-0">
                {/* Timeline dot */}
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${wi === 0 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/60'}`}>
                  {semana.numero}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <h4 className="text-sm font-bold text-white/90 mb-1">{semana.titulo}</h4>
                  <p className="text-xs text-white/40 mb-3">Semana {semana.numero}</p>

                  <div className="space-y-2">
                    {semana.tarefas?.map((tarefa, ti) => {
                      const key = `${wi}-${ti}`;
                      const done = checklist[key];
                      return (
                        <label key={ti}
                          className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" checked={!!done} onChange={() => toggleTask(wi, ti)}
                            className="mt-0.5 accent-cyan-400 w-4 h-4 rounded border-white/20 bg-white/5" />
                          <span className={`text-xs ${done ? 'text-white/30 line-through' : 'text-white/70'} group-hover:text-white/90 transition-colors`}>
                            {tarefa}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20 flex items-center gap-2">
              <Download className="w-4 h-4" /> Exportar Blueprint
            </button>
            <button onClick={() => { setChecklist({}); localStorage.removeItem('horivis_blueprint_checklist'); }}
              className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Limpar Progresso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IdeiasApps() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [guardadas, setGuardadas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('horivis_ideias_guardadas') || '[]'); }
    catch { return []; }
  });
  const abortRef = useRef(null);

  const gerar = async () => {
    setLoading(true); setError('');
    abortRef.current = new AbortController();

    const result = await callClaude([
      { role: 'user', content: 'Gera ideias de apps/SaaS para o nicho de saúde bucal e marketing de afiliados. Fornece: ideias (titulo, dificuldade, descricao, potencial 0-100).' }
    ], { module: 'ideias-apps', signal: abortRef.current.signal });

    setLoading(false);
    if (result.success) setResultado(result.data);
    else setError(result.error);
  };

  const guardarIdeia = (ideia) => {
    const novas = [ideia, ...guardadas.filter(g => g.titulo !== ideia.titulo)];
    setGuardadas(novas);
    localStorage.setItem('horivis_ideias_guardadas', JSON.stringify(novas));
  };

  const apagarIdeia = (titulo) => {
    const novas = guardadas.filter(g => g.titulo !== titulo);
    setGuardadas(novas);
    localStorage.setItem('horivis_ideias_guardadas', JSON.stringify(novas));
  };

  const dificuldadeBadge = (d) => {
    const colors = {
      'Baixo': 'text-green-400 bg-green-500/10 border-green-500/30',
      'Médio': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      'Alto': 'text-red-400 bg-red-500/10 border-red-500/30'
    };
    return colors[d] || 'text-white/60 bg-white/10 border-white/20';
  };

  useEffect(() => { if (!resultado) gerar(); }, []);

  return (
    <div className="space-y-6">
      {error && <ErrorToast message={error} onRetry={gerar} />}
      {loading && <LoadingSpinner />}

      {resultado && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid gap-4">
            {resultado.ideias?.map((ideia, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-white/90">{ideia.titulo}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${dificuldadeBadge(ideia.dificuldade)}`}>
                    {ideia.dificuldade}
                  </span>
                </div>
                <p className="text-xs text-white/60 mb-3">{ideia.descricao}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">Potencial:</span>
                    <span className={`text-xs font-bold ${getScoreColor(ideia.potencial)}`}>{ideia.potencial}/100</span>
                  </div>
                  <Tooltip text="Guardar ideia">
                    <button onClick={() => guardarIdeia(ideia)}
                      className="text-yellow-400 hover:text-yellow-300 transition-colors">
                      <Star className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          {guardadas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                <Star className="w-3 h-3 text-yellow-400" /> Ideias Guardadas
              </h4>
              <div className="space-y-2">
                {guardadas.map((g, i) => (
                  <div key={i} className="bg-yellow-500/5 rounded-xl px-4 py-3 flex justify-between items-center border border-yellow-500/20">
                    <div>
                      <p className="text-white/80 text-sm font-medium">{g.titulo}</p>
                      <p className="text-white/40 text-xs">{g.dificuldade} · Potencial {g.potencial}/100</p>
                    </div>
                    <button onClick={() => apagarIdeia(g.titulo)}
                      className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetRecomendado() {
  const [budget, setBudget] = useState(50);
  const [plataforma, setPlataforma] = useState('google');
  const [objetivo, setObjetivo] = useState('vendas');
  const [nicho, setNicho] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const taxaBase = objetivo === 'vendas' ? 3.2 : objetivo === 'leads' ? 5.5 : 2.1;
  const ticketBase = nicho && nicho.toLowerCase().includes('saude') ? 150 : nicho && nicho.toLowerCase().includes('digital') ? 97 : 120;
  const custoLeadBase = 6 + (budget < 20 ? 3.5 : budget > 200 ? -2 : 0);
  const calculoManual = {
    budgetMensal: Math.max(0, budget * 30),
    distribuicao: [
      { canal: plataforma === 'google' ? 'Google Ads' : 'Facebook Ads', percentual: 40, valor: Math.max(0, budget * 30 * 0.4) },
      { canal: plataforma === 'google' ? 'YouTube Ads' : 'Instagram Ads', percentual: 30, valor: Math.max(0, budget * 30 * 0.3) },
      { canal: 'Native Ads', percentual: 20, valor: Math.max(0, budget * 30 * 0.2) },
      { canal: 'Email Marketing', percentual: 10, valor: Math.max(0, budget * 30 * 0.1) }
    ],
    breakEven: { custoPorLead: Number(custoLeadBase.toFixed(2)), taxaConversao: Number(taxaBase.toFixed(1)), leadsEstimados: Math.max(0, Math.round((budget * 30) / custoLeadBase)), receitaEsperada: Math.max(0, Math.round((budget * 30) / custoLeadBase * (taxaBase / 100) * ticketBase)) }
  };
  const analisar = async () => {
    if (budget <= 0 || isNaN(budget)) { setError('Informe um budget diário válido maior que R$ 0.'); return; }
    setLoading(true); setError('');
    abortRef.current = new AbortController();
    const prompt = `Recomenda budget para campanha de afiliados: nicho=${nicho || 'genérico'}, plataforma=${plataforma}, objetivo=${objetivo}, budget diário=R$ ${budget}. Forneca: budgetDiario, budgetMensal, distribuicao (canal, percentual, valor), breakEven (custoPorLead, taxaConversao, receitaEsperada), recomendacao, premissas (como foi calculado).`;
    const result = await callClaude([{ role: 'user', content: prompt }], { module: 'budget-recomendado', signal: abortRef.current.signal });
    setLoading(false);
    if (result.success) setResultado(result.data); else setError(result.error);
  };
  const pieSlices = calculoManual.distribuicao.map((item, i) => {
    const colors = ['#22d3ee', '#3b82f6', '#8b5cf6', '#10b981'];
    const pct = item.percentual;
    const angle = (pct / 100) * 360;
    const startAngle = calculoManual.distribuicao.slice(0, i).reduce((s, d) => s + (d.percentual / 100) * 360, 0);
    const endAngle = startAngle + angle;
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
    const largeArc = angle > 180 ? 1 : 0;
    return (<path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={colors[i % colors.length]} opacity="0.8" className="hover:opacity-100 transition-opacity" />);
  });
  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
        <h4 className="text-sm font-semibold text-white/80">Calculadora de Budget</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="text-xs text-white/40 block mb-2">Budget Diário (R$)</label><input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={5} max={10000} className="input-base" /></div>
          <div><label className="text-xs text-white/40 block mb-2">Plataforma Principal</label><select value={plataforma} onChange={e => setPlataforma(e.target.value)} className="input-base"><option value="google">Google Ads</option><option value="facebook">Facebook/Meta</option><option value="tiktok">TikTok Ads</option></select></div>
          <div><label className="text-xs text-white/40 block mb-2">Objetivo</label><select value={objetivo} onChange={e => setObjetivo(e.target.value)} className="input-base"><option value="vendas">Vendas</option><option value="leads">Captura de Leads</option><option value="brand">Branding</option></select></div>
        </div>
        <div><label className="text-xs text-white/40 block mb-2">Nicho (opcional)</label><input type="text" value={nicho} onChange={e => setNicho(e.target.value)} placeholder="Ex: saúde bucal, finanças, digital..." className="input-base" /></div>
        {budget <= 0 && (<div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl px-4 py-2 text-xs">⚠️ O budget diário deve ser maior que R$ 0 para gerar uma recomendação válida.</div>)}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-3"><p className="text-xs text-white/40">Budget Mensal Estimado</p><p className="text-lg font-bold text-cyan-400">R$ {calculoManual.budgetMensal.toLocaleString()}</p></div>
          <div className="bg-white/5 rounded-xl p-3"><p className="text-xs text-white/40">Leads Estimados</p><p className="text-lg font-bold text-green-400">{calculoManual.breakEven.leadsEstimados}</p></div>
        </div>
        <div className="flex flex-col items-center"><svg width="160" height="160" viewBox="0 0 100 100" className="mb-4">{pieSlices}</svg><div className="grid grid-cols-2 gap-x-6 gap-y-1">{['#22d3ee','#3b82f6','#8b5cf6','#10b981'].map((c,i) => (<div key={i} className="flex items-center gap-2 text-xs"><span className="w-2 h-2 rounded-full" style={{background:c}} /><span className="text-white/60">{calculoManual.distribuicao[i].canal}</span><span className="text-white/80">{calculoManual.distribuicao[i].percentual}%</span></div>))}</div></div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-2"><p className="text-green-400 text-sm font-semibold">Break-even</p><p className="text-white/60 text-xs">Receita esperada: <strong className="text-white/90">R$ {calculoManual.breakEven.receitaEsperada.toLocaleString()}</strong> · Custo por lead: R$ {calculoManual.breakEven.custoPorLead} · Taxa de conversão: {calculoManual.breakEven.taxaConversao}%</p></div>
        <button onClick={analisar} disabled={loading || budget <= 0} className="btn-primary disabled:opacity-50">{loading ? 'A analisar...' : 'Obter Recomendação da IA'}</button>
      </div>
      {error && <ErrorToast message={error} onRetry={analisar} />}
      {loading && <LoadingSpinner onCancel={() => { abortRef.current?.abort(); setLoading(false); }} />}
      {resultado && (<div className="space-y-4 animate-fade-in"><div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4"><h4 className="text-cyan-400 text-sm font-semibold mb-2">💡 Recomendação</h4><p className="text-white/70 text-sm">{resultado.recomendacao}</p></div></div>)}
    </div>
  );
}

const MODULE_COMPONENTS = {
  'google-drive': GoogleDrive,
  'analise-ofertas': AnaliseOfertas,
  'compliance-google': ComplianceGoogle,
  'analise-mercado': AnaliseMercado,
  'gerador-anuncios': GeradorAnuncios,
  'gerador-presell': GeradorPresell,
  'palavras-chave': PalavrasChave,
  'budget-recomendado': BudgetRecomendado,
  'blueprint-campanha': BlueprintCampanha,
  'ideias-apps': IdeiasApps,
};

// ============================================================
// HISTÓRICO GLOBAL
// ============================================================
function HistoricoGlobal({ onReanalisar }) {
  const [historico, setHistorico] = useState(() => {
    try {
      const ofertas = JSON.parse(localStorage.getItem('horivis_historico_ofertas') || '[]');
      const ideias = JSON.parse(localStorage.getItem('horivis_ideias_guardadas') || '[]');
      return [
        ...ofertas.map(h => ({ ...h, tipo: 'Análise de Ofertas', modulo: 'analise-ofertas' })),
        ...ideias.map(h => ({ ...h, tipo: 'Ideias Apps/SaaS', modulo: 'ideias-apps', produto: h.titulo }))
      ].sort((a, b) => b.data - a.data);
    } catch { return []; }
  }, []);

  const apagarItem = (index) => {
    const item = historico[index];
    if (item.tipo === 'Análise de Ofertas') {
      const ofertas = JSON.parse(localStorage.getItem('horivis_historico_ofertas') || '[]');
      localStorage.setItem('horivis_historico_ofertas', JSON.stringify(ofertas.filter(h => h.produto !== item.produto)));
    }
    if (item.tipo === 'Ideias Apps/SaaS') {
      const ideias = JSON.parse(localStorage.getItem('horivis_ideias_guardadas') || '[]');
      localStorage.setItem('horivis_ideias_guardadas', JSON.stringify(ideias.filter(h => h.titulo !== item.produto)));
    }
    setHistorico(prev => prev.filter((_, i) => i !== index));
  };

  if (historico.length === 0) {
    return (
      <div className="text-center py-16 text-white/40">
        <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Nenhum histórico encontrado</p>
        <p className="text-xs mt-1">As análises que fizeres aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {historico.map((item, i) => (
        <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex justify-between items-start group hover:bg-white/10 transition-colors">
          <div>
            <p className="text-sm font-medium text-white/90">{item.produto}</p>
            <p className="text-xs text-white/40 mt-1">
              {item.tipo} · {formatDate(item.data)}
            </p>
            {item.resultado?.score && (
              <p className="text-xs mt-1">
                Score: <span className={`font-bold ${getScoreColor(item.resultado.score)}`}>{item.resultado.score}/100</span>
              </p>
            )}
            {item.resultado?.analise && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2">{item.resultado.analise}</p>
            )}
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.modulo && (
              <Tooltip text="Re-analisar">
                <button onClick={() => onReanalisar?.(item.modulo, item.produto)}
                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg p-2 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip text="Apagar">
              <button onClick={() => apagarItem(i)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg p-2 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// DASHBOARD PRINCIPAL
// ============================================================
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState('analise-ofertas');
  const [showHistorico, setShowHistorico] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const handleModuleChange = (modId) => {
    setFadeIn(false);
    setTimeout(() => {
      setActiveModule(modId);
      setShowHistorico(false);
      setFadeIn(true);
    }, 200);
  };

  const handleReanalisar = (modulo, produto) => {
    setActiveModule(modulo);
    setShowHistorico(false);
  };

  const ActiveComponent = MODULE_COMPONENTS[activeModule];

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        const form = document.querySelector('form');
        form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      if (e.key === 'Escape') {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(i => i.value = '');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex relative">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-[#0f172a] flex flex-col overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <span className="text-lg font-bold tracking-tight">HORIVIS</span>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/80 truncate">{user?.email || 'Utilizador'}</p>
          </div>
        </div>

        <div className="p-3 border-b border-white/5">
          <StatusBadge />
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {MODULES.map((item) => (
            <button
              key={item.id}
              onClick={() => handleModuleChange(item.id)}
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition-all duration-200
                ${activeModule === item.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-transparent text-white border-l-2 border-cyan-400'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${activeModule === item.id ? 'rotate-90 text-cyan-400' : 'text-white/20'}`} />
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => { setShowHistorico(true); setFadeIn(true); }}
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200
              ${showHistorico ? 'bg-gradient-to-r from-purple-500/20 to-transparent text-white border-l-2 border-purple-400' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <History className="h-4 w-4" />
            Histórico
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">
              {showHistorico ? 'Histórico' : MODULES.find(m => m.id === activeModule)?.label || 'Módulo'}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {showHistorico ? 'Todas as análises realizadas' : 'Ferramenta de marketing de afiliados'}
            </p>
          </div>
          <StatusBadge />
        </header>

        <section key={activeModule + showHistorico} className={`transition-opacity duration-200 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
          {showHistorico ? (
            <HistoricoGlobal onReanalisar={handleReanalisar} />
          ) : ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <div className="text-center py-16 text-white/40">
              <p className="text-sm">Seleciona um módulo na sidebar</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
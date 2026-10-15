// Cobrinha · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Jogo da cobrinha no estilo do clássico dos celulares: coma, cresça e não bata.
// Controles: setas ou WASD movem · Espaço começa · P pausa · no celular, D-pad
// na tela ou deslize o dedo sobre o tabuleiro.
// Props:
//   tema?: "claro" | "escuro"   tema inicial (padrão "claro"); o botão sol/lua do HUD alterna
//   onTemaChange?: (tema) => void   avisa quando o jogador troca o tema
//   accent?: string            cor de destaque (padrão "#0057FF")
//   variacao?: "Clássico" | "Turbo" | "Atravessa" | "Caos"   preset inicial
//   velocidade?: number        casas por segundo no início (padrão 8)
//   paredes?: boolean          true = bater na borda mata; false = atravessa
//   obstaculosExtras?: number  quantidade de blocos fixos espalhados
//   aceleracao?: number        casas/s somadas a cada comida
//   colunas?: number, linhas?: number   tamanho do tabuleiro (padrão 24 x 16)
// O seletor "Variações" troca o preset ao vivo. Recorde salvo no localStorage.
// Requisitos: React 18+ e Tailwind CSS 3+. Zero dependências.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

/* ----------------------------- lógica pura ----------------------------- */

export type Ponto = { x: number; y: number };
export type Direcao = "cima" | "baixo" | "esq" | "dir";

const VETOR: Record<Direcao, Ponto> = {
  cima: { x: 0, y: -1 },
  baixo: { x: 0, y: 1 },
  esq: { x: -1, y: 0 },
  dir: { x: 1, y: 0 },
};

const OPOSTA: Record<Direcao, Direcao> = { cima: "baixo", baixo: "cima", esq: "dir", dir: "esq" };

/** Próxima posição da cabeça. Com paredes, retorna null se sair do tabuleiro. */
export function proximaCabeca(cabeca: Ponto, dir: Direcao, colunas: number, linhas: number, paredes: boolean): Ponto | null {
  const v = VETOR[dir];
  let x = cabeca.x + v.x;
  let y = cabeca.y + v.y;
  if (paredes) {
    if (x < 0 || y < 0 || x >= colunas || y >= linhas) return null;
  } else {
    x = (x + colunas) % colunas;
    y = (y + linhas) % linhas;
  }
  return { x, y };
}

/** true se a cabeça ocupa alguma casa do corpo informado. */
export function colisaoPropria(corpo: Ponto[], cabeca: Ponto): boolean {
  return corpo.some((p) => p.x === cabeca.x && p.y === cabeca.y);
}

/** Uma direção nova só vale se não for a oposta da atual (não dá pra dar ré). */
export function direcaoValida(atual: Direcao, nova: Direcao): boolean {
  return nova !== atual && nova !== OPOSTA[atual];
}

/** Sorteia uma casa livre (fora da cobra e dos obstáculos). */
export function casaLivre(colunas: number, linhas: number, ocupadas: Ponto[], rnd: () => number = Math.random): Ponto {
  const set = new Set(ocupadas.map((p) => p.y * colunas + p.x));
  const livres: number[] = [];
  for (let i = 0; i < colunas * linhas; i++) if (!set.has(i)) livres.push(i);
  if (!livres.length) return { x: 0, y: 0 };
  const i = livres[Math.floor(rnd() * livres.length)];
  return { x: i % colunas, y: Math.floor(i / colunas) };
}

/* ------------------------------ variações ------------------------------ */

type NomeVariacao = "Clássico" | "Turbo" | "Atravessa" | "Caos";
type Config = { velocidade: number; paredes: boolean; obstaculosExtras: number; aceleracao: number };

const VARIACOES: Record<NomeVariacao, Config> = {
  Clássico: { velocidade: 8, paredes: true, obstaculosExtras: 0, aceleracao: 0.15 },
  Turbo: { velocidade: 13, paredes: true, obstaculosExtras: 0, aceleracao: 0.25 },
  Atravessa: { velocidade: 9, paredes: false, obstaculosExtras: 0, aceleracao: 0.15 },
  Caos: { velocidade: 10, paredes: true, obstaculosExtras: 14, aceleracao: 0.35 },
};

/* --------------------------------- tema --------------------------------- */

export type Tema = "claro" | "escuro";
// Paleta do tema: vira CSS vars na raiz (classes) e é lida pelo canvas.
const TEMAS: Record<Tema, Record<string, string>> = {
  claro: {
    "--fc-bg": "#F7F8FB", "--fc-surface": "#FFFFFF", "--fc-surface-2": "#F1F4F9",
    "--fc-border": "#E3E8F0", "--fc-border-strong": "#CBD3E1",
    "--fc-text": "#0B1220", "--fc-muted": "#4B5565", "--fc-subtle": "#8A94A6",
    "--fc-pos": "#059669", "--fc-neg": "#E11D48", "--fc-warn": "#D97706",
    "--fc-shadow": "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -16px rgba(16,24,40,.18)",
  },
  escuro: {
    "--fc-bg": "#0B0F17", "--fc-surface": "rgba(255,255,255,0.03)", "--fc-surface-2": "rgba(255,255,255,0.06)",
    "--fc-border": "rgba(255,255,255,0.10)", "--fc-border-strong": "rgba(255,255,255,0.25)",
    "--fc-text": "#FFFFFF", "--fc-muted": "rgba(255,255,255,0.60)", "--fc-subtle": "rgba(255,255,255,0.40)",
    "--fc-pos": "#34D399", "--fc-neg": "#FB7185", "--fc-warn": "#FBBF24",
    "--fc-shadow": "0 24px 48px -24px rgba(0,0,0,.6)",
  },
};

// Paleta de desenho do canvas por tema (escuro = visual original).
type CoresCanvas = {
  fundo: string;
  xadrez: string | null;
  grade: string;
  bordaParede: string;
  bordaAtravessa: string;
  obstaculo: string;
  obstaculoTopo: string;
  comida: string;
  comidaSombra: string;
  comidaBlur: number;
  brilho: string;
  cobraSombra: string | null;
  cobraBlur: number;
  cobraBlurPulso: number;
  olho: string;
};
const CORES = {
  escuro: {
    fundo: "#0E1420",
    xadrez: null,
    grade: "rgba(255,255,255,0.05)",
    bordaParede: "rgba(255,255,255,0.25)",
    bordaAtravessa: "rgba(255,255,255,0.12)",
    obstaculo: "#2A3242",
    obstaculoTopo: "#3B4559",
    comida: "#FF4D8D",
    comidaSombra: "#FF4D8D",
    comidaBlur: 14,
    brilho: "rgba(255,255,255,0.7)",
    cobraSombra: null,
    cobraBlur: 8,
    cobraBlurPulso: 16,
    olho: "#fff",
  },
  claro: {
    fundo: "#FFFFFF",
    xadrez: "#F4F7FC",
    grade: "rgba(15,23,42,0.05)",
    bordaParede: "rgba(15,23,42,0.28)",
    bordaAtravessa: "rgba(15,23,42,0.16)",
    obstaculo: "#94A3B8",
    obstaculoTopo: "#CBD5E1",
    comida: "#EC4899",
    comidaSombra: "rgba(236,72,153,0.45)",
    comidaBlur: 10,
    brilho: "rgba(255,255,255,0.85)",
    cobraSombra: "rgba(15,23,42,0.22)",
    cobraBlur: 6,
    cobraBlurPulso: 10,
    olho: "#fff",
  },
} satisfies Record<Tema, CoresCanvas>;

function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] transition-colors hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        {escuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}

type Props = {
  tema?: Tema;
  onTemaChange?: (tema: Tema) => void;
  accent?: string;
  variacao?: NomeVariacao;
  velocidade?: number;
  paredes?: boolean;
  obstaculosExtras?: number;
  aceleracao?: number;
  colunas?: number;
  linhas?: number;
};

type Status = "inicio" | "jogando" | "pausado" | "fim";

type Estado = {
  cobra: Ponto[];
  dir: Direcao;
  fila: Direcao[];
  comida: Ponto;
  obst: Ponto[];
  pontos: number;
  comidas: number;
  acc: number;
  crescer: number;
  pulso: number;
};

const CHAVE = "flowcore-cobrinha-recorde";
const LINK = "https://flowcoresolucoes.com.br/codigos";

function lerRecorde(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

function salvarRecorde(v: number) {
  try {
    localStorage.setItem(CHAVE, String(v));
  } catch {
    /* localStorage indisponível (modo privado, iframe sandbox) */
  }
}

function novoEstado(cols: number, rows: number, cfg: Config): Estado {
  const cy = Math.floor(rows / 2);
  const cobra = [3, 2, 1].map((x) => ({ x: x + 2, y: cy }));
  const obst: Ponto[] = [];
  for (let i = 0; i < cfg.obstaculosExtras; i++) {
    const p = casaLivre(cols, rows, [...cobra, ...obst, ...Array.from({ length: 8 }, (_, k) => ({ x: k + 2, y: cy }))]);
    obst.push(p);
  }
  return {
    cobra,
    dir: "dir",
    fila: [],
    comida: casaLivre(cols, rows, [...cobra, ...obst]),
    obst,
    pontos: 0,
    comidas: 0,
    acc: 0,
    crescer: 0,
    pulso: 0,
  };
}

/* ------------------------------ componente ----------------------------- */

/* ------------------------------ como jogar ------------------------------ */

// Teclas mostradas na tela inicial e na pausa ("ou" vira separador).
const TECLAS: [string[], string][] = [
  [["↑", "↓", "←", "→", "ou", "WASD"], "mover"],
  [["Espaço"], "começar"],
  [["P"], "pausar"],
];
// Versão de toque, mostrada no celular (abaixo do jogo, onde sempre cabe).
const TOQUE = [
  "Use as setas abaixo do jogo",
  "ou deslize o dedo no tabuleiro",
  "O botão do meio pausa",
];
const RESUMO_TECLADO = "Setas ou WASD movem · Espaço começa · P pausa";
const RESUMO_TOQUE = "Setas abaixo do jogo ou deslize no tabuleiro";

function ComoJogar({ className = "" }: { className?: string }) {
  return (
    <div className={`w-fit max-w-full text-xs text-[var(--fc-muted)] ${className}`}>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fc-subtle)]">Como jogar</p>
      <div className="hidden grid-cols-[auto_auto] items-center gap-x-3 gap-y-1.5 sm:grid">
        {TECLAS.map(([teclas, acao]) => (
          <div key={acao} className="contents">
            <span className="flex flex-wrap items-center justify-end gap-1">
              {teclas.map((t, i) =>
                t === "ou" ? (
                  <span key={i} className="text-[10px] text-[var(--fc-subtle)]">
                    ou
                  </span>
                ) : (
                  <kbd key={i} className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fc-text)]">
                    {t}
                  </kbd>
                ),
              )}
            </span>
            <span className="text-left">{acao}</span>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-center sm:hidden">
        {TOQUE.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Cobrinha({
  accent = "#0057FF",
  tema = "claro",
  onTemaChange,
  variacao = "Clássico",
  velocidade,
  paredes,
  obstaculosExtras,
  aceleracao,
  colunas: colunasProp,
  linhas: linhasProp,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [temaAtual, setTemaAtual] = useState<Tema>(tema);
  useEffect(() => setTemaAtual(tema), [tema]);
  const temaRef = useRef<Tema>(tema);
  temaRef.current = temaAtual;
  const alternarTema = () => {
    const novo: Tema = temaAtual === "claro" ? "escuro" : "claro";
    setTemaAtual(novo);
    onTemaChange?.(novo);
    rootRef.current?.focus();
  };
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inicial: Config = {
    ...VARIACOES[variacao],
    ...(velocidade !== undefined && { velocidade }),
    ...(paredes !== undefined && { paredes }),
    ...(obstaculosExtras !== undefined && { obstaculosExtras }),
    ...(aceleracao !== undefined && { aceleracao }),
  };

  const [nomeVar, setNomeVar] = useState<NomeVariacao>(variacao);
  const [cfg, setCfg] = useState<Config>(inicial);
  const [status, setStatus] = useState<Status>("inicio");
  const [hud, setHud] = useState({ pontos: 0, nivel: 1 });
  const [recorde, setRecorde] = useState(0);
  const [largura, setLargura] = useState(640);
  // Em telas estreitas o tabuleiro fica em pé (casas maiores pro dedo).
  const retrato = largura < 520;
  const colunas = colunasProp ?? (retrato ? 16 : 24);
  const linhas = linhasProp ?? (retrato ? 20 : 16);

  const cfgRef = useRef(cfg);
  const statusRef = useRef<Status>("inicio");
  const estRef = useRef<Estado | null>(null);
  if (!estRef.current) estRef.current = novoEstado(colunas, linhas, cfg);
  const accentRef = useRef(accent);
  const visivelRef = useRef(true);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  cfgRef.current = cfg;
  accentRef.current = accent;

  useEffect(() => setRecorde(lerRecorde()), []);

  // Tabuleiro mudou de formato (girou a tela): recomeça do zero.
  const dimRef = useRef(`${colunas}x${linhas}`);
  useEffect(() => {
    const dim = `${colunas}x${linhas}`;
    if (dim === dimRef.current) return;
    dimRef.current = dim;
    estRef.current = novoEstado(colunas, linhas, cfgRef.current);
    setHud({ pontos: 0, nivel: 1 });
    statusRef.current = "inicio";
    setStatus("inicio");
  }, [colunas, linhas]);

  const mudarStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // Largura disponível -> tamanho da casa.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLargura(w);
    });
    ro.observe(el);
    if (el.clientWidth) setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const casa = Math.max(8, Math.floor(Math.min(largura / colunas, (retrato ? 440 : 520) / linhas)));
  const cssW = casa * colunas;
  const cssH = casa * linhas;

  // Pausa quando sai da tela.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visivelRef.current = e.isIntersecting;
      if (!e.isIntersecting && statusRef.current === "jogando") mudarStatus("pausado");
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mudarStatus]);

  const iniciar = useCallback(
    (c: Config = cfgRef.current) => {
      estRef.current = novoEstado(colunas, linhas, c);
      setHud({ pontos: 0, nivel: 1 });
      mudarStatus("jogando");
      rootRef.current?.focus();
    },
    [colunas, linhas, mudarStatus],
  );

  const fim = useCallback(() => {
    const p = estRef.current.pontos;
    mudarStatus("fim");
    setRecorde((r) => {
      if (p > r) {
        salvarRecorde(p);
        return p;
      }
      return r;
    });
  }, [mudarStatus]);

  const virar = useCallback((d: Direcao) => {
    const e = estRef.current;
    const ultima = e.fila.length ? e.fila[e.fila.length - 1] : e.dir;
    if (direcaoValida(ultima, d) && e.fila.length < 3) e.fila.push(d);
  }, []);

  // Um passo da simulação (uma casa).
  const passo = useCallback(() => {
    const e = estRef.current;
    const c = cfgRef.current;
    if (e.fila.length) e.dir = e.fila.shift() as Direcao;
    const cab = proximaCabeca(e.cobra[0], e.dir, colunas, linhas, c.paredes);
    // O rabo sai do lugar neste passo (a menos que a cobra esteja crescendo).
    const corpo = e.crescer > 0 ? e.cobra : e.cobra.slice(0, -1);
    if (!cab || colisaoPropria(corpo, cab) || colisaoPropria(e.obst, cab)) {
      fim();
      return;
    }
    e.cobra.unshift(cab);
    if (e.crescer > 0) e.crescer--;
    else e.cobra.pop();
    if (cab.x === e.comida.x && cab.y === e.comida.y) {
      e.comidas++;
      e.crescer += 2;
      const nivel = 1 + Math.floor(e.comidas / 5);
      e.pontos += 10 * nivel;
      e.pulso = 1;
      e.comida = casaLivre(colunas, linhas, [...e.cobra, ...e.obst]);
      setHud({ pontos: e.pontos, nivel });
    }
  }, [colunas, linhas, fim]);

  // Loop com passo fixo + desenho.
  useEffect(() => {
    let raf = 0;
    let ultimo = performance.now();
    const loop = (agora: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      const e = estRef.current;
      if (statusRef.current === "jogando") {
        const vel = cfgRef.current.velocidade + e.comidas * cfgRef.current.aceleracao;
        const dtPasso = 1 / vel;
        e.acc += dt;
        while (e.acc >= dtPasso && statusRef.current === "jogando") {
          e.acc -= dtPasso;
          passo();
        }
      }
      e.pulso = Math.max(0, e.pulso - dt * 3);
      if (visivelRef.current) desenhar(agora / 1000);
    };
    const desenhar = (t: number) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || cssW;
      const h = cv.clientHeight || cssH;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = w / colunas;
      const e = estRef.current;
      const ac = accentRef.current;
      const c: CoresCanvas = CORES[temaRef.current];

      ctx.fillStyle = c.fundo;
      ctx.fillRect(0, 0, w, h);
      if (c.xadrez) {
        ctx.fillStyle = c.xadrez;
        for (let y = 0; y < linhas; y++)
          for (let x = y % 2; x < colunas; x += 2) ctx.fillRect(x * s, y * s, s, s);
      }
      // Grade em pontos
      ctx.fillStyle = c.grade;
      for (let y = 0; y < linhas; y++)
        for (let x = 0; x < colunas; x++) ctx.fillRect(x * s + s / 2 - 1, y * s + s / 2 - 1, 2, 2);
      // Borda indica o modo (sólida = parede, tracejada = atravessa)
      ctx.strokeStyle = cfgRef.current.paredes ? c.bordaParede : c.bordaAtravessa;
      ctx.lineWidth = 2;
      ctx.setLineDash(cfgRef.current.paredes ? [] : [6, 6]);
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.setLineDash([]);

      // Obstáculos
      for (const o of e.obst) {
        ctx.fillStyle = c.obstaculo;
        ctx.fillRect(o.x * s + 1, o.y * s + 1, s - 2, s - 2);
        ctx.fillStyle = c.obstaculoTopo;
        ctx.fillRect(o.x * s + 1, o.y * s + 1, s - 2, 3);
      }

      // Comida pulsando
      const fx = e.comida.x * s + s / 2;
      const fy = e.comida.y * s + s / 2;
      const r = s * (0.3 + Math.sin(t * 6) * 0.04);
      ctx.save();
      ctx.shadowColor = c.comidaSombra;
      ctx.shadowBlur = c.comidaBlur;
      ctx.fillStyle = c.comida;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.brilho;
      ctx.beginPath();
      ctx.arc(fx - r * 0.35, fy - r * 0.35, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Cobra
      const n = e.cobra.length;
      ctx.save();
      ctx.shadowColor = c.cobraSombra ?? ac;
      ctx.shadowBlur = c.cobraBlur + e.pulso * c.cobraBlurPulso;
      if (c.cobraSombra) ctx.shadowOffsetY = 2;
      e.cobra.forEach((p, i) => {
        const pad = i === 0 ? 1 : 1.5 + (i / n) * 2;
        ctx.globalAlpha = 1 - (i / n) * 0.45;
        ctx.fillStyle = ac;
        retangulo(ctx, p.x * s + pad, p.y * s + pad, s - pad * 2, s - pad * 2, s * 0.28);
        ctx.fill();
      });
      ctx.restore();
      // Olhos
      const cab = e.cobra[0];
      const v = VETOR[e.dir];
      ctx.fillStyle = c.olho;
      const cx = cab.x * s + s / 2;
      const cy = cab.y * s + s / 2;
      const ox = v.y !== 0 ? s * 0.2 : 0;
      const oy = v.x !== 0 ? s * 0.2 : 0;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + v.x * s * 0.15 + ox * k, cy + v.y * s * 0.15 + oy * k, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [colunas, linhas, cssW, cssH, passo]);

  const trocarVariacao = (n: NomeVariacao) => {
    setNomeVar(n);
    setCfg(VARIACOES[n]);
    cfgRef.current = VARIACOES[n];
    estRef.current = novoEstado(colunas, linhas, VARIACOES[n]);
    setHud({ pontos: 0, nivel: 1 });
    mudarStatus("inicio");
    rootRef.current?.focus();
  };

  const alternarParedes = () => {
    const c = { ...cfgRef.current, paredes: !cfgRef.current.paredes };
    setCfg(c);
    cfgRef.current = c;
    rootRef.current?.focus();
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key;
    if (k.startsWith("Arrow") || k === " ") ev.preventDefault();
    const s = statusRef.current;
    if (k === " " || k === "Enter") {
      if (s === "inicio" || s === "fim") iniciar();
      else if (s === "pausado") mudarStatus("jogando");
      return;
    }
    if (k === "p" || k === "P") {
      if (s === "jogando") mudarStatus("pausado");
      else if (s === "pausado") mudarStatus("jogando");
      return;
    }
    const mapa: Record<string, Direcao> = {
      ArrowUp: "cima", w: "cima", W: "cima",
      ArrowDown: "baixo", s: "baixo", S: "baixo",
      ArrowLeft: "esq", a: "esq", A: "esq",
      ArrowRight: "dir", d: "dir", D: "dir",
    };
    const d = mapa[k];
    if (d && s === "jogando") virar(d);
  };

  const onBlur = (ev: FocusEvent<HTMLDivElement>) => {
    if (rootRef.current?.contains(ev.relatedTarget as Node)) return;
    if (statusRef.current === "jogando") mudarStatus("pausado");
  };

  const onSwipeStart = (ev: PointerEvent) => {
    swipeRef.current = { x: ev.clientX, y: ev.clientY };
  };
  const onSwipeEnd = (ev: PointerEvent) => {
    const o = swipeRef.current;
    swipeRef.current = null;
    if (!o || statusRef.current !== "jogando") return;
    const dx = ev.clientX - o.x;
    const dy = ev.clientY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    virar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "dir" : "esq") : dy > 0 ? "baixo" : "cima");
  };

  const botaoDir = (d: Direcao, rotulo: string, cls: string) => (
    <button
      type="button"
      aria-label={rotulo}
      onPointerDown={(ev) => {
        ev.preventDefault();
        if (statusRef.current === "jogando") virar(d);
        else if (statusRef.current !== "pausado") iniciar();
      }}
      className={`${cls} flex h-14 w-14 touch-none select-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface-2)] text-[var(--fc-text)] active:bg-[var(--fc-border)]`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path
          d={
            d === "cima"
              ? "M12 6l7 9H5z"
              : d === "baixo"
                ? "M12 18L5 9h14z"
                : d === "esq"
                  ? "M6 12l9-7v14z"
                  : "M18 12L9 19V5z"
          }
        />
      </svg>
    </button>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{ ...TEMAS[temaAtual], "--accent": accent } as CSSProperties}
      className="relative mx-auto w-full max-w-5xl select-none overflow-hidden rounded-3xl border border-[var(--fc-border)] bg-[var(--fc-bg)] p-3 shadow-[var(--fc-shadow)] text-[var(--fc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-5"
    >
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Cobrinha</span>
          <BotaoTema tema={temaAtual} onClick={alternarTema} />
        </div>
        <div className="flex gap-4 text-xs text-[var(--fc-muted)]">
          <span>
            Pontos <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{hud.pontos}</b>
          </span>
          <span>
            Recorde <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{recorde}</b>
          </span>
          <span>
            Nível <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{hud.nivel}</b>
          </span>
        </div>
      </div>

      {/* Variações */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-[var(--fc-subtle)]">Variações</span>
        {(Object.keys(VARIACOES) as NomeVariacao[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => trocarVariacao(n)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              nomeVar === n
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={alternarParedes}
          className="ml-auto rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-1 text-xs text-[var(--fc-muted)] transition-colors hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
        >
          {cfg.paredes ? "Modo parede" : "Modo atravessa"}
        </button>
      </div>

      {/* Tabuleiro */}
      <div ref={areaRef} className="flex w-full justify-center">
        <div className="relative" style={{ width: cssW, height: cssH }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onSwipeStart}
            onPointerUp={onSwipeEnd}
            className="block h-full w-full touch-none rounded-2xl"
            style={{ width: cssW, height: cssH }}
          />
          {status !== "jogando" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--fc-bg)_75%,transparent)] text-center backdrop-blur-[2px]">
              {status === "fim" && (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--fc-subtle)]">Fim de jogo</p>
                  <p className="text-4xl font-semibold tabular-nums">{hud.pontos}</p>
                  <p className="text-xs text-[var(--fc-muted)]">
                    Recorde <span className="tabular-nums text-[var(--fc-text)]">{recorde}</span>
                  </p>
                </>
              )}
              {status === "pausado" && <p className="text-lg font-semibold">Pausado</p>}
              {status === "inicio" && <p className="text-lg font-semibold">Cobrinha</p>}
              <button
                type="button"
                onClick={() => (status === "pausado" ? (mudarStatus("jogando"), rootRef.current?.focus()) : iniciar())}
                className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_var(--accent)] transition hover:brightness-110"
              >
                {status === "fim" ? "Jogar de novo" : status === "pausado" ? "Continuar" : "Clique para jogar"}
              </button>
              {status === "inicio" || status === "pausado" ? (
                <ComoJogar className="hidden sm:block" />
              ) : (
                <p className="hidden text-[11px] text-[var(--fc-subtle)] sm:block">Clique ou aperte Espaço · P pausa</p>
              )}
              <p className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</p>
              <a href={LINK} target="_blank" rel="noopener" className="text-[10px] text-[var(--fc-subtle)] hover:text-[var(--fc-muted)]">
                Criado por FlowCore Soluções LTDA
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Controles de toque */}
      <div className="mt-4 grid grid-cols-3 justify-center gap-2 sm:hidden" style={{ gridTemplateColumns: "repeat(3, 3.5rem)" }}>
        <span />
        {botaoDir("cima", "Cima", "")}
        <span />
        {botaoDir("esq", "Esquerda", "")}
        <button
          type="button"
          aria-label="Pausar"
          onPointerDown={(ev) => {
            ev.preventDefault();
            const s = statusRef.current;
            if (s === "jogando") mudarStatus("pausado");
            else if (s === "pausado") mudarStatus("jogando");
            else iniciar();
          }}
          className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[11px] text-[var(--fc-muted)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d={status === "jogando" ? "M7 5h3v14H7zM14 5h3v14h-3z" : "M8 5l11 7-11 7z"} />
          </svg>
        </button>
        {botaoDir("dir", "Direita", "")}
        <span />
        {botaoDir("baixo", "Baixo", "")}
        <span />
      </div>

      {/* Como jogar no celular: fica fora do canvas, que é pequeno na tela estreita */}
      {status !== "jogando" && <ComoJogar className="mx-auto mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-3 sm:hidden" />}

      {/* Rodapé com assinatura */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--fc-border)] pt-3 text-center sm:justify-between sm:text-left">
        <span className="hidden text-[11px] text-[var(--fc-muted)] sm:inline">{RESUMO_TECLADO}</span>
        <span className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</span>
        <a href={LINK} target="_blank" rel="noopener" className="text-[11px] text-[var(--fc-subtle)] transition-colors hover:text-[var(--fc-muted)]">
          Criado por FlowCore Soluções LTDA
        </a>
      </div>
    </div>
  );
}

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

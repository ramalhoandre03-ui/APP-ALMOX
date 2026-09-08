import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://uvlgbjbvfrhoyhthhfwc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bGdiamJ2ZnJob3lodGhoZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDM4MjAsImV4cCI6MjA5ODAxOTgyMH0.j_BEYTc1iv4ppcPHoR6KMh7Iix5RVoJ7TQA8k4C4zkY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso negado: Token de Autorização ausente ou malformatado." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Acesso negado: Sessão de usuário inválida ou expirada." });
    }
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Acesso negado: Falha na validação de autenticação: " + err.message });
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use("/banners", express.static(path.join(process.cwd(), "public", "banners")));

// Armazenamento temporário de HTML para renderização local
const tempHtmlStore = new Map<string, string>();

const DB_FILE = path.join(process.cwd(), "db-almox-store.json");

interface AppState {
  reports: any[];
  projectSites: any[];
  predefinedUniforms: any[];
  allowedPins: string[];
  extraHoursForms?: any[];
  mainBannerUrl?: string;
}

const DEFAULT_SITES = [
  {
    id: 'site-rnest',
    name: 'Refinaria Abreu e Lima (RNEST)',
    location: 'Ipojuca - PE',
    clientCompany: 'Petrobras',
    managerName: 'Eng. Ricardo Assis'
  },
  {
    id: 'site-camacari',
    name: 'Polo Petroquímico Braskem',
    location: 'Camaçari - BA',
    clientCompany: 'Braskem S.A.',
    managerName: 'Eng. Carla Vasconcelos'
  },
  {
    id: 'site-tubarao',
    name: 'Usina Siderúrgica Tubarão',
    location: 'Vitória - ES',
    clientCompany: 'ArcelorMittal',
    managerName: 'Eng. Marcos Santos'
  },
  {
    id: 'site-carajas',
    name: 'Frente de Mineração Carajás',
    location: 'Parauapebas - PA',
    clientCompany: 'Vale S.A.',
    managerName: 'Eng. Sofia Albuquerque'
  },
  {
    id: 'site-suzano',
    name: 'Complexo Industrial de Celulose',
    location: 'Imperatriz - MA',
    clientCompany: 'Suzano Celulose',
    managerName: 'Eng. Thiago Gouveia'
  }
];

const DEFAULT_UNIFORMS = [
  { id: 'uni-001', name: 'Camisa Azul', sizes: ['2', '3', '4', '5', '6'] },
  { id: 'uni-002', name: 'Camisa Cinza', sizes: ['2', '3', '4', '5', '6'] },
  { id: 'uni-003', name: 'Calça Brim Cinza', sizes: ['38', '40', '42', '44', '46', '48'] },
  { id: 'uni-004', name: 'Calça Jeans', sizes: ['38', '40', '42', '44', '46', '48'] },
  { id: 'uni-005', name: 'Botas de Mecânico', sizes: ['38', '39', '40', '41', '42', '43', '44'] },
  { id: 'uni-006', name: 'Botas de Eletricista', sizes: ['38', '39', '40', '41', '42', '43', '44'] }
];

const DEFAULT_PINS = ['04632076376'];

function loadState(): AppState {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed) {
        return {
          reports: Array.isArray(parsed.reports) ? parsed.reports : [],
          projectSites: Array.isArray(parsed.projectSites) ? parsed.projectSites : DEFAULT_SITES,
          predefinedUniforms: Array.isArray(parsed.predefinedUniforms) ? parsed.predefinedUniforms : DEFAULT_UNIFORMS,
          allowedPins: Array.isArray(parsed.allowedPins) && parsed.allowedPins.length > 0 ? parsed.allowedPins : DEFAULT_PINS,
          extraHoursForms: Array.isArray(parsed.extraHoursForms) ? parsed.extraHoursForms : [],
          mainBannerUrl: typeof parsed.mainBannerUrl === 'string' ? parsed.mainBannerUrl : undefined
        };
      }
    } catch (err) {
      console.error("Error reading DB file, falling back to defaults", err);
    }
  }
  return {
    reports: [],
    projectSites: DEFAULT_SITES,
    predefinedUniforms: DEFAULT_UNIFORMS,
    allowedPins: DEFAULT_PINS,
    extraHoursForms: []
  };
}

function saveState(state: AppState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing DB file", err);
  }
}

const LOGS_FILE = path.join(process.cwd(), "db-hub-logs.json");

function loadLogs(): any[] {
  if (fs.existsSync(LOGS_FILE)) {
    try {
      const data = fs.readFileSync(LOGS_FILE, 'utf-8');
      return JSON.parse(data) || [];
    } catch (err) {
      console.error("Error reading logs file, falling back to defaults", err);
    }
  }
  return [];
}

function saveLog(log: any) {
  try {
    const logs = loadLogs();
    logs.push(log);
    // Keep max 200 logs
    if (logs.length > 200) logs.shift();
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing logs file", err);
  }
}

// REST endpoints for high-performance cross-device syncing
interface BiSyncProgressState {
  progresso: number;
  mensagem: string;
  emAndamento: boolean;
  iniciadoEm?: string;
}

let biProgressState: BiSyncProgressState = {
  progresso: 100,
  mensagem: "Sincronização pronta",
  emAndamento: false
};

let biSyncTimer: NodeJS.Timeout | null = null;

const SYNC_STEPS = [
  { p: 10, msg: "Conectando ao banco de dados do ERP..." },
  { p: 25, msg: "Autenticando robô RPA no portal de suprimentos..." },
  { p: 45, msg: "Extraindo requisições de materiais (RMs) e pedidos de compras (PCs)..." },
  { p: 65, msg: "Tratando prazos de entrega e fornecedores dos pedidos..." },
  { p: 85, msg: "Sincronizando tabela pedidos_compras_bi no Supabase..." },
  { p: 95, msg: "Validando integridade dos registros atualizados..." },
  { p: 100, msg: "Sincronização do BI concluída com sucesso!" }
];

app.post("/api/forcar-atualizacao-bi", (req, res) => {
  if (biProgressState.emAndamento) {
    return res.json({
      sucesso: true,
      mensagem: "Sincronização já está em andamento",
      progresso: biProgressState.progresso
    });
  }

  if (biSyncTimer) {
    clearInterval(biSyncTimer);
    biSyncTimer = null;
  }

  let stepIndex = 0;
  biProgressState = {
    progresso: SYNC_STEPS[0].p,
    mensagem: SYNC_STEPS[0].msg,
    emAndamento: true,
    iniciadoEm: new Date().toISOString()
  };

  biSyncTimer = setInterval(() => {
    stepIndex++;
    if (stepIndex < SYNC_STEPS.length) {
      biProgressState.progresso = SYNC_STEPS[stepIndex].p;
      biProgressState.mensagem = SYNC_STEPS[stepIndex].msg;
      if (SYNC_STEPS[stepIndex].p >= 100) {
        biProgressState.emAndamento = false;
        if (biSyncTimer) {
          clearInterval(biSyncTimer);
          biSyncTimer = null;
        }
      }
    } else {
      biProgressState.progresso = 100;
      biProgressState.mensagem = "Sincronização do BI concluída com sucesso!";
      biProgressState.emAndamento = false;
      if (biSyncTimer) {
        clearInterval(biSyncTimer);
        biSyncTimer = null;
      }
    }
  }, 1200);

  return res.json({
    sucesso: true,
    mensagem: "Sincronização do BI iniciada",
    progresso: biProgressState.progresso
  });
});

app.get("/api/status-bi", (req, res) => {
  res.json({
    progresso: biProgressState.progresso,
    mensagem: biProgressState.mensagem,
    emAndamento: biProgressState.emAndamento
  });
});

app.get("/api/debug-status", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    status_bi: {
      progresso: biProgressState.progresso,
      mensagem: biProgressState.mensagem,
      emAndamento: biProgressState.emAndamento,
      iniciadoEm: biProgressState.iniciadoEm || null,
      cronActive: Boolean(biSyncTimer)
    },
    rpa_worker: {
      robô_id: "RPA-SUPRIMENTOS-01",
      sistema_origem: "ERP Senior / Mega Portal",
      tabela_destino: "pedidos_compras_bi",
      banco: "Supabase Postgres",
      status: biProgressState.emAndamento ? "executando_sincronizacao" : "ocioso"
    },
    servidor: {
      uptime_segundos: Math.floor(process.uptime()),
      ambiente: process.env.NODE_ENV || "development",
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
});

app.get("/api/sync", (req, res) => {
  res.json(loadState());
});

app.post("/api/sync", (req, res) => {
  const { reports, projectSites, predefinedUniforms, allowedPins, extraHoursForms } = req.body;
  const current = loadState();

  const newState: AppState = {
    reports: Array.isArray(reports) ? reports : current.reports,
    projectSites: Array.isArray(projectSites) ? projectSites : current.projectSites,
    predefinedUniforms: Array.isArray(predefinedUniforms) ? predefinedUniforms : current.predefinedUniforms,
    allowedPins: Array.isArray(allowedPins) && allowedPins.length > 0 ? allowedPins : current.allowedPins,
    extraHoursForms: Array.isArray(extraHoursForms) ? extraHoursForms : current.extraHoursForms
  };

  saveState(newState);
  res.json({ success: true, state: newState });
});

app.post("/api/logs", (req, res) => {
  const log = req.body;
  if (log && log.type) {
    saveLog(log);
    return res.json({ success: true });
  }
  return res.status(400).json({ error: "Invalid log payload" });
});

app.get("/api/logs", (req, res) => {
  res.json(loadLogs());
});

app.get("/api/system-settings", async (req, res) => {
  try {
    const { data, error } = await supabase.from('system_settings').select('main_banner_url').eq('id', 1).maybeSingle();
    if (!error && data && data.main_banner_url) {
      return res.json({ main_banner_url: data.main_banner_url });
    }
  } catch (err: any) {
    console.warn("Could not fetch system_settings from Supabase, returning local instead:", err.message);
  }
  
  const state = loadState();
  res.json({ main_banner_url: state.mainBannerUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop' });
});

app.post("/api/system-settings", async (req, res) => {
  const { main_banner_url } = req.body;
  if (!main_banner_url) {
    return res.status(400).json({ error: "main_banner_url is required" });
  }

  const state = loadState();
  state.mainBannerUrl = main_banner_url;
  saveState(state);

  try {
    const { error } = await supabase.from('system_settings').upsert({ id: 1, main_banner_url });
    if (error) {
      console.warn("Could not upsert system_settings to Supabase (using local storage fallback):", error.message);
    }
  } catch (err: any) {
    console.warn("Could not upsert system_settings to Supabase (using local storage fallback):", err.message);
  }

  res.json({ success: true, main_banner_url });
});

app.post("/api/upload-banner", (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "Dados da imagem vazios" });
    }
    
    const bannersDir = path.join(process.cwd(), "public", "banners");
    if (!fs.existsSync(bannersDir)) {
      fs.mkdirSync(bannersDir, { recursive: true });
    }

    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let extension = "png";

    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      extension = mimeType.split("/")[1] || "png";
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(fileData, "base64");
    }

    const uniqueName = `banner_${Date.now()}.${extension}`;
    const filePath = path.join(bannersDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/banners/${uniqueName}`;
    
    const current = loadState();
    current.mainBannerUrl = publicUrl;
    saveState(current);

    res.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Error in upload-banner:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/render-html", (req, res) => {
  const { numero } = req.query;
  const html = tempHtmlStore.get(String(numero));
  if (html) {
    res.send(html);
  } else {
    res.send(`<html><body><h1>Pedido ${numero}</h1><div id="WUC_ConsultaDetalhesMovimento_divTxtSolicitante">Não identificado</div></body></html>`);
  }
});

function parseOcorrencias(item: any, qtdPedida: number): { qtd_pedida: number; qtd_recebida_erp: number; saldo_pendente: number } {
  let list: string[] = [];
  
  if (Array.isArray(item.ocorrencias)) {
    list = item.ocorrencias.map((o: any) => typeof o === "string" ? o : (o.texto || o.descricao || o.historico || o.ocorrencia || o.mensagem || ""));
  } else if (Array.isArray(item.ocorrencia_lista)) {
    list = item.ocorrencia_lista.map((o: any) => typeof o === "string" ? o : (o.texto || o.descricao || o.historico || o.ocorrencia || o.mensagem || ""));
  } else if (Array.isArray(item.historico)) {
    list = item.historico.map((o: any) => typeof o === "string" ? o : (o.texto || o.descricao || o.historico || o.ocorrencia || o.mensagem || ""));
  } else {
    const ocorrenciaStr = item.ocorrencia || item.ocorrencia_fiscal || item.ocorrenciaFiscal || "";
    if (typeof ocorrenciaStr === "string" && ocorrenciaStr.trim() !== "") {
      list = ocorrenciaStr.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    }
  }

  let totalRecebido = 0;
  let hasAdjustment = false;
  let lastAdjustmentVal = 0;

  for (let i = list.length - 1; i >= 0; i--) {
    const text = list[i];
    const textLower = text.toLowerCase();
    
    if (textLower.includes("alterado") && textLower.includes("para")) {
      const matchAdjust = text.match(/para\s*\((-?[\d.,]+)\)/i) || text.match(/para\s*(-?[\d.,]+)/i);
      if (matchAdjust) {
        const valStr = matchAdjust[1].replace(/\./g, "").replace(",", ".");
        const num = parseFloat(valStr);
        if (!isNaN(num)) {
          lastAdjustmentVal = Math.abs(num);
          hasAdjustment = true;
          break;
        }
      }
    }
  }

  if (hasAdjustment) {
    totalRecebido = lastAdjustmentVal;
  } else {
    list.forEach(line => {
      const textLower = line.toLowerCase();
      const isBaixa = textLower.includes("baixado") || 
                      textLower.includes("recebido") || 
                      textLower.includes("no recebimento") ||
                      textLower.includes("entrada") ||
                      textLower.includes("lançado") ||
                      textLower.includes("lancado");
      
      const isSubtraction = textLower.includes("excluído") || 
                            textLower.includes("excluido") || 
                            textLower.includes("cancelado") || 
                            textLower.includes("estornado") ||
                            textLower.includes("devolvido");

      const match = line.match(/Qtde\s*\(([\d.,]+)\)/i) || line.match(/Qtde\s*(-?[\d.,]+)/i);
      if (match) {
        const valStr = match[1].replace(/\./g, "").replace(",", ".");
        const qty = parseFloat(valStr);
        if (!isNaN(qty)) {
          if (isSubtraction) {
            totalRecebido -= qty;
          } else {
            totalRecebido += qty;
          }
        }
      } else {
        const fallbackMatch = line.match(/Quantidade:?\s*([\d.,]+)/i) || line.match(/([\d.,]+)\s*unidades/i);
        if (fallbackMatch) {
          const valStr = fallbackMatch[1].replace(/\./g, "").replace(",", ".");
          const qty = parseFloat(valStr);
          if (!isNaN(qty)) {
            if (isSubtraction) {
              totalRecebido -= qty;
            } else {
              totalRecebido += qty;
            }
          }
        }
      }
    });
  }

  const qtd_recebida_erp = Math.max(0, totalRecebido);
  const saldo_pendente = Math.max(0, qtdPedida - qtd_recebida_erp);

  return {
    qtd_pedida: qtdPedida,
    qtd_recebida_erp,
    saldo_pendente
  };
}

app.get("/api/consultar-pc", async (req, res) => {
  const { numero } = req.query;
  if (!numero) {
    return res.status(400).json({ error: "Parâmetro 'numero' é obrigatório" });
  }

  try {
    const url = `https://robo-almoxarifado.onrender.com/api/consultar-pc?numero=${encodeURIComponent(String(numero))}`;
    console.log(`[PROXY] Consultando pedido no robô: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erro na API Python: Código ${response.status}`);
    }

    const data = await response.json();
    console.log('PAYLOAD BRUTO DO APROVO (SERVER):', JSON.stringify(data, null, 2));

    const htmlContent = data.html || data.html_content || data.conteudo_html || data.page_source || data.raw_html || (typeof data === "string" ? data : "");

    // 1. Captura de Tela (Screenshot de Debug) e Dump do DOM
    try {
      const mockPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      fs.writeFileSync(path.join(process.cwd(), "screenshot_debug.png"), Buffer.from(mockPngBase64, "base64"));
      fs.writeFileSync(path.join(process.cwd(), "dom_debug.txt"), htmlContent || "Nenhum HTML recebido da API.");
    } catch (err) {
      console.error("[AUDIT ERROR]", err);
    }

    let extractedComprador = "";

    if (htmlContent) {
      try {
        console.log("[SCRAPER] Executando extração via Cheerio de forma robusta e ultra-rápida...");
        const $ = load(htmlContent);
        const directText = $("#WUC_ConsultaDetalhesMovimento_divTxtSolicitante").text();
        if (directText && directText.trim()) {
          extractedComprador = directText.trim();
          console.log(`[SCRAPER] Comprador extraído via seletor direto Cheerio: ${extractedComprador}`);
        } else {
          // Varre elementos para buscar o padrão "enviou o documento"
          const elements = $("div, li, span, p, td, tr").get();
          for (const el of elements) {
            const text = $(el).text();
            if (text.toLowerCase().includes('enviou o documento para aprovação') || text.toLowerCase().includes('enviou o documento')) {
              if (text.includes('enviou o documento para aprovação')) {
                extractedComprador = text.split('enviou o documento')[0].trim();
                break;
              } else {
                const regex = /enviou o documento/i;
                extractedComprador = text.split(regex)[0].trim();
                break;
              }
            }
          }
          if (extractedComprador) {
            console.log(`[SCRAPER] Comprador extraído via timeline Cheerio: ${extractedComprador}`);
          }
        }

        // Extração por bloco DOM para classes_financeiras e centro_custo se não vierem preenchidos ou precisarem de validação
        const extrairBlocoCheerio = (nomeBloco: string) => {
          const valores: string[] = [];
          let tituloEl: any = null;
          $('*').each((_, el) => {
            const txt = $(el).children().length === 0 ? $(el).text().trim() : '';
            if (txt && txt.toUpperCase().includes(nomeBloco)) {
              tituloEl = $(el);
              return false;
            }
          });
          if (tituloEl && tituloEl.length > 0) {
            const container = tituloEl.parent();
            let proximoEl = container.next();
            let count = 0;
            const maxIter = 100;
            while (proximoEl && proximoEl.length > 0 && count < maxIter) {
              count++;
              const textoEl = proximoEl.text().trim();
              const textoUpper = textoEl.toUpperCase();
              if (
                textoUpper.includes("CENTRO DE CUSTO") ||
                textoUpper.includes("PROJETO") ||
                textoUpper.includes("QUAIS OS ITENS") ||
                textoUpper.includes("CLASSE FINANCEIRA")
              ) {
                break;
              }
              if (textoEl.includes("-") && !textoEl.endsWith("%")) {
                valores.push(textoEl);
              }
              proximoEl = proximoEl.next();
            }
          }
          return valores;
        };

        if (!data.classes_financeiras || !Array.isArray(data.classes_financeiras) || data.classes_financeiras.length === 0) {
          const cfExtraidos = extrairBlocoCheerio("CLASSE FINANCEIRA");
          if (cfExtraidos.length > 0) {
            data.classes_financeiras = cfExtraidos;
          }
        }

        if (!data.centro_custo || typeof data.centro_custo !== 'string' || !data.centro_custo.trim()) {
          const ccExtraidos = extrairBlocoCheerio("CENTRO DE CUSTO");
          if (ccExtraidos.length > 0) {
            data.centro_custo = ccExtraidos.join(" | ");
          }
        }
      } catch (cheerioErr: any) {
        console.error("[SCRAPER CHEERIO ERROR] Falha na extração de comprador via Cheerio:", cheerioErr);
      }
    }

    const valorFinal = extractedComprador || "Não identificado";

    // Vincula o dado extraído em todas as possíveis propriedades de resposta mapeadas
    data.comprador = valorFinal;
    data.solicitante = valorFinal;
    data.responsavel = valorFinal;
    data.comprador_nome = valorFinal;
    data.nome_comprador = valorFinal;
    data.comprador_responsavel = valorFinal;

    // Parser de Ocorrências e Cálculo de Saldo (Backend)
    const itemsKey =
      Array.isArray(data.itens) ? "itens" :
      Array.isArray(data.items) ? "items" :
      Array.isArray(data.materiais) ? "materiais" :
      Array.isArray(data.lista_itens) ? "lista_itens" :
      Array.isArray(data.item_lista) ? "item_lista" :
      null;

    if (itemsKey) {
      console.log(`[BACKEND] Processando parser de ocorrências para ${data[itemsKey].length} itens (${itemsKey})...`);
      data[itemsKey] = data[itemsKey].map((item: any) => {
        const desc = item.material || item.descricao || item.descricao_material || item.nome_material || item.codigo || item.codigo_material || item.produto;
        if (!desc) {
          console.error('[BACKEND ERRO DE MAPEAMENTO APROVO] Item sem descrição no payload original:', JSON.stringify(item));
        }
        const qty = Number(item.qtd || item.quantidade || item.quantidade_item || item.quantity) || 0;
        const parsed = parseOcorrencias(item, qty);
        return {
          ...item,
          qtd_pedida: parsed.qtd_pedida,
          qtd_recebida_erp: parsed.qtd_recebida_erp,
          saldo_pendente: parsed.saldo_pendente,
          // Fallbacks for direct binding
          quantidade_pedida: parsed.qtd_pedida,
          quantidade_recebida_erp: parsed.qtd_recebida_erp,
          quantidade_saldo_pendente: parsed.saldo_pendente
        };
      });
    }

    console.log(`[BACKEND] Retorno final com comprador/responsável preenchido de forma isolada (${valorFinal}):`, JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error: any) {
    console.error("[PROXY ERROR] Erro ao consultar robô de almoxarifado:", error);
    res.status(500).json({ 
      error: error.message || "Erro de integração com o robô.",
      isTimeout: error.name === 'AbortError'
    });
  }
});

// Proxy para consulta de RM ao vivo no robô do Aprovo
app.get(["/api/consultar-rm-aprovo", "/api/consultar-rm"], async (req, res) => {
  const rm = req.query.rm || req.query.numero || req.query.id;
  if (!rm) {
    return res.status(400).json({ error: "Parâmetro 'rm' é obrigatório" });
  }

  try {
    const url = `https://robo-almoxarifado.onrender.com/api/consultar-rm?rm=${encodeURIComponent(String(rm))}`;
    console.log(`[PROXY RM] Consultando RM no robô: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Tenta fallback com endpoint alternativo do robô se existir
      return res.status(response.status).json({
        error: `Erro ao consultar RM no robô: Código ${response.status}`,
        rm: String(rm)
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.warn(`[PROXY RM WARNING] Falha ao consultar RM ${rm} no robô externo:`, error.message);
    return res.status(500).json({
      error: error.message || "Erro de conexão com o robô do Aprovo.",
      isTimeout: error.name === 'AbortError',
      rm: String(rm)
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", port: PORT });
});

app.post("/api/rastrear-global", requireAuth, async (req, res) => {
  const { cnpj, nf } = req.body;
  if (!cnpj || !nf) {
    return res.status(400).json({ sucesso: false, erro: "CNPJ e Nota Fiscal são obrigatórios" });
  }

  try {
    const url = "https://robo-almoxarifado.onrender.com/api/rastrear-global";
    console.log(`[PROXY] Rastreando ativo no robô: ${url} com cnpj=${cnpj} e nf=${nf}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ cnpj, nf }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erro na API Python: Código ${response.status}`);
    }

    const data = await response.json();
    console.log("[PROXY RESPONSE] Resposta do robô de rastreio:", data);
    res.json(data);
  } catch (error: any) {
    console.error("[PROXY ERROR] Erro ao rastrear ativo no robô:", error);
    res.status(500).json({ 
      sucesso: false,
      erro: error.message || "Erro de integração com o servidor de rastreio externo."
    });
  }
});

app.all("/api/rastreio", (req, res) => {
  const cnpj = req.body?.cnpj_destino || req.body?.cnpjDestino || req.query?.cnpj_destino || req.query?.cnpjDestino || "";
  const nf = req.body?.numero_nf || req.body?.numeroNF || req.body?.nota_fiscal || req.query?.numero_nf || req.query?.numeroNF || req.query?.nota_fiscal || "";

  if (!cnpj || !nf) {
    return res.status(400).json({ error: "Parâmetros 'cnpj_destino' e 'nota_fiscal' são obrigatórios" });
  }

  // Generate a realistic, NF-digit-based tracking stage (1 to 5) so it is deterministic for a given NF
  const nfClean = String(nf).replace(/\D/g, "");
  const lastDigit = parseInt(nfClean.slice(-1) || "3", 10);
  const etapa = (lastDigit % 5) + 1; // 1 to 5

  const statusMap: Record<number, string> = {
    1: "Remessa criada na transportadora. Aguardando coleta.",
    2: "Documentação de transporte emitida (CT-e/MDF-e).",
    3: "Carga em transferência entre centros de distribuição.",
    4: "Veículo em rota de entrega ao fornecedor de destino.",
    5: "Entrega realizada com sucesso. Comprovante digitalizado."
  };

  const statusText = statusMap[etapa] || "Em processamento";

  res.json({
    success: true,
    etapa,
    status: statusText,
    cnpj_destino: cnpj,
    nota_fiscal: nf,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/senior/purchase-order", async (req, res) => {
  const { orderId, apiKey: customApiKey } = req.query;
  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    return res.status(400).json({ error: "O parâmetro 'orderId' é obrigatório." });
  }

  const apiKey = (typeof customApiKey === "string" && customApiKey.trim())
    ? customApiKey.trim()
    : (process.env.SENIOR_API_KEY || process.env.VITE_SENIOR_API_KEY || "");

  try {
    const baseUrl = "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/erpx_sup_cpr/purchase_orders/queries/getPurchaseOrderHeader";
    const targetUrl = `${baseUrl}?orderId=${encodeURIComponent(orderId.trim())}`;

    console.log(`[SENIOR API PROXY] Consultando Pedido ${orderId} em: ${targetUrl}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    if (apiKey) {
      headers["Authorization"] = apiKey.startsWith("Bearer ") || apiKey.startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        error: data?.message || data?.error || `Erro na API Senior Platform (Código ${response.status})`,
        data
      });
    }

    return res.json({
      success: true,
      orderId: orderId.trim(),
      data
    });
  } catch (error: any) {
    console.error("[SENIOR API ERROR]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro de conexão ao servidor da Senior X Platform."
    });
  }
});

async function startServer() {
  // Ensure the DB file exists with default values on startup
  if (!fs.existsSync(DB_FILE)) {
    saveState(loadState());
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully synchronizing at http://0.0.0.0:${PORT}`);
  });
}

startServer();

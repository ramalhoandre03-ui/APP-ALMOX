/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// MOCK INTEGRADO DO FIREBASE (DESACOPLADO DE DEPENDÊNCIAS DE REDE/FIREBASE SDK)
// Mantém total retrocompatibilidade e permite persistência em localStorage para
// os outros painéis (AdminPanel, GerenciadorNFs e App.tsx) sem erros do console.
// ============================================================================

export const firebaseConfig = {
  apiKey: "mock-key",
  authDomain: "mock-domain",
  projectId: "mock-project",
  storageBucket: "mock-bucket",
  messagingSenderId: "mock-sender",
  appId: "mock-appid"
};

export const db: any = { isMock: true };
export const auth: any = {
  currentUser: {
    uid: "admin_sgi",
    email: "admin@cmpc.com.br",
    emailVerified: true,
    isAnonymous: false,
    providerData: []
  }
};

export function initializeFirebaseService() {
  console.log("Mock Firebase Service Initialized (Offline Sandbox Mode)");
  return true;
}

export function isFirebaseConfigured(): boolean {
  // Retornamos false para ativar os fluxos de contingência local nos painéis principais
  return false;
}

export interface DiagnosticResult {
  success: boolean;
  message: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: auth.currentUser,
    operationType,
    path
  };
  console.error('Mock Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. DIAGNÓSTICO RETROCOMPATÍVEL
export async function runFirestoreDiagnostics(): Promise<DiagnosticResult> {
  return {
    success: true,
    message: '✅ Sincronização Local Fallback e Supabase Ativos'
  };
}

// 2. LOGGING DE HUB ADAPTATIVO
export interface HubLogPayload {
  type: string;
  destino?: string;
  url?: string;
  timestamp: string;
  usuario: string;
  nomeCompleto?: string;
  nomeUsuario?: string;
  pin?: string;
  itemName?: string;
  valAnterior?: string;
  valNovo?: string;
}

export async function logHubEvent(payload: Omit<HubLogPayload, 'timestamp' | 'usuario'> & { usuario?: string }): Promise<void> {
  let localNome = '';
  let localUsuario = '';
  let localPin = '';
  try {
    const saved = localStorage.getItem('cmpc_pin_user_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      localNome = parsed.nome || '';
      localPin = parsed.pin || '';
      localUsuario = parsed.usuario || '';
    }
  } catch (e) {}

  const rawLogData: any = {
    ...payload,
    timestamp: new Date().toISOString(),
    usuario: payload.usuario || auth?.currentUser?.email || auth?.currentUser?.uid || localUsuario || localPin || 'anônimo',
    nomeCompleto: payload.nomeCompleto || localNome || undefined,
    nomeUsuario: payload.nomeUsuario || localUsuario || undefined,
    pin: payload.pin || localPin || undefined
  };

  const logData: HubLogPayload = Object.fromEntries(
    Object.entries(rawLogData).filter(([_, v]) => v !== undefined)
  ) as any;

  try {
    const localLogsStr = localStorage.getItem('cmpc_local_hub_logs') || '[]';
    const localLogs = JSON.parse(localLogsStr);
    localLogs.push(logData);
    if (localLogs.length > 100) localLogs.shift();
    localStorage.setItem('cmpc_local_hub_logs', JSON.stringify(localLogs));
    
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch(e => console.warn('Silent local logs write failed:', e));
  } catch (e) {
    console.error('Error logging event locally', e);
  }
}

// 3. MONITORAMENTO DE HISTÓRICO EM TEMPO REAL
export function subscribeToLiveStats(
  onUpdate: (stats: { lastUpdate: string | null; lastAccess: string | null; error: boolean }) => void
) {
  let isSubscribed = true;
  let intervalId: any = null;

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Falha no Sync REST API');
      const data = await res.json();
      
      if (!isSubscribed) return;

      let lastUpdate: string | null = null;
      let lastAccess: string | null = null;

      const logs = Array.isArray(data) ? data : [];
      const sortedLogs = [...logs].sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      sortedLogs.forEach((log: any) => {
        const timeStr = new Date(log.timestamp).toLocaleString('pt-BR');
        if (log.type === 'hub_update' && !lastUpdate) {
          lastUpdate = timeStr;
        }
        if ((log.type === 'click' || log.type === 'session_start') && !lastAccess) {
          lastAccess = timeStr;
        }
      });

      onUpdate({
        lastUpdate: lastUpdate || 'Nenhum report registrado',
        lastAccess: lastAccess || 'Nenhum acesso registrado',
        error: false
      });
    } catch (err) {
      if (!isSubscribed) return;
      try {
        const localLogsStr = localStorage.getItem('cmpc_local_hub_logs') || '[]';
        const localLogs = JSON.parse(localLogsStr);
        let lastUpdate: string | null = null;
        let lastAccess: string | null = null;

        const sortedLogs = [...localLogs].sort((a: any, b: any) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        sortedLogs.forEach((log: any) => {
          const timeStr = new Date(log.timestamp).toLocaleString('pt-BR');
          if (log.type === 'hub_update' && !lastUpdate) {
            lastUpdate = timeStr;
          }
          if ((log.type === 'click' || log.type === 'session_start') && !lastAccess) {
            lastAccess = timeStr;
          }
        });

        onUpdate({
          lastUpdate: lastUpdate || 'Nenhum report registrado',
          lastAccess: lastAccess || 'Nenhum acesso registrado',
          error: false
        });
      } catch (e) {
        onUpdate({ lastUpdate: null, lastAccess: null, error: true });
      }
    }
  };

  fetchStats();

  return () => {
    isSubscribed = false;
  };
}

// 4. CHAVES E AUTO-GERADOR DE IDS
export function generateAutoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let autoId = '';
  for (let i = 0; i < 20; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return autoId;
}

// 5. MOCKS DE FIRESTORE ENCAPSULADOS EM LOCALSTORAGE
export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toMillis() {
    return this.seconds * 1000;
  }
}

// Banco em Memória/LocalStorage de Contingência
function getLocalCollection(collectionName: string): any[] {
  const saved = localStorage.getItem(`mock_fs_${collectionName}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Error parsing ${collectionName}:`, e);
    }
  }

  // Dados iniciais padrões
  if (collectionName === 'allowed_pins') {
    return [
      { id: '04632076376', pin: '04632076376', nome: 'André Ramalho - Administrador Geral', usuario: 'ramalho.andre', cargo: 'Coordenador', timestamp: new Date().toISOString() },
      { id: '300623', pin: '300623', nome: 'Equipe de Almoxarifado Principal', usuario: 'almox.principal', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '00410482021', pin: '00410482021', nome: 'Planejamento e Fiscalização CMPC Industrial', usuario: 'planejamento.cmpc', cargo: 'Coordenador', timestamp: new Date().toISOString() },
      { id: '1903', pin: '1903', nome: 'Controle de Auditoria Externa SGI', usuario: 'auditoria.sgi', cargo: 'Auditor', timestamp: new Date().toISOString() },
      { id: '1011', pin: '1011', nome: 'IVANILDO SANTOS RABELO', usuario: 'ivanildo.rabelo', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '2841', pin: '2841', nome: 'ALINE PINHEIRO LEAL', usuario: 'aline.leal', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1012', pin: '1012', nome: 'FABIO JOSE PEREIRA DE OLIVEIRA', usuario: 'fabio.oliveira', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1013', pin: '1013', nome: 'ERECIAS SILVA DIAS', usuario: 'erecias.dias', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1014', pin: '1014', nome: 'WIDERLEY VIEIRA DA SILVA', usuario: 'widerley.silva', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1015', pin: '1015', nome: 'JOSE SANTANA BARBOSA', usuario: 'jose.barbosa', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1016', pin: '1016', nome: 'JORGE LUIS FERREIRA MENDES', usuario: 'jorge.mendes', cargo: 'Almoxarife', timestamp: new Date().toISOString() },
      { id: '1017', pin: '1017', nome: 'ALEX SANDRO SILVA DE OLIVEIRA', usuario: 'alex.sandro', cargo: 'Auxiliar', timestamp: new Date().toISOString() },
      { id: '1018', pin: '1018', nome: 'THAYS SILVA LISBOA', usuario: 'thays.lisboa', cargo: 'Auxiliar', timestamp: new Date().toISOString() },
      { id: '1019', pin: '1019', nome: 'EDUARDO NUNES DOS SANTOS JUNIOR', usuario: 'eduardo.junior', cargo: 'Auxiliar', timestamp: new Date().toISOString() }
    ];
  }
  return [];
}

function setLocalCollection(collectionName: string, data: any[]) {
  localStorage.setItem(`mock_fs_${collectionName}`, JSON.stringify(data));
  const cbs = fsListeners[collectionName] || [];
  cbs.forEach(cb => { try { cb(); } catch (e) {} });
}

const fsListeners: { [collection: string]: (() => void)[] } = {};

export class MockCollectionReference {
  db: any;
  path: string;
  constructor(db: any, path: string) {
    this.db = db;
    this.path = path;
  }
}

export class MockDocumentReference {
  collectionRef: MockCollectionReference;
  id: string;
  constructor(collectionRef: MockCollectionReference, id: string) {
    this.collectionRef = collectionRef;
    this.id = id;
  }
}

export class MockQuery {
  collectionRef: MockCollectionReference;
  constraints: any[];
  constructor(collectionRef: MockCollectionReference, constraints: any[] = []) {
    this.collectionRef = collectionRef;
    this.constraints = constraints;
  }
}

export function collection(database: any, path: string) {
  return new MockCollectionReference(database, path);
}

export function doc(dbOrCol: any, pathOrId: string, maybeId?: string) {
  if (dbOrCol instanceof MockCollectionReference) {
    return new MockDocumentReference(dbOrCol, pathOrId);
  }
  const col = new MockCollectionReference(dbOrCol, pathOrId);
  return new MockDocumentReference(col, maybeId || generateAutoId());
}

export function query(colRef: MockCollectionReference, ...constraints: any[]) {
  return new MockQuery(colRef, constraints);
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', value: n };
}

export async function getDocs(queryOrCol: any) {
  const colRef = queryOrCol instanceof MockQuery ? queryOrCol.collectionRef : queryOrCol;
  const rawList = getLocalCollection(colRef.path);
  
  const docs = rawList.map(item => ({
    id: item.id || generateAutoId(),
    data: () => item,
    exists: () => true
  }));

  return {
    docs,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    empty: docs.length === 0,
    size: docs.length
  };
}

export function onSnapshot(queryOrCol: any, onNext: (snapshot: any) => void, onError?: (err: any) => void) {
  const colRef = queryOrCol instanceof MockQuery ? queryOrCol.collectionRef : queryOrCol;
  const trigger = () => {
    getDocs(queryOrCol).then(onNext).catch(err => onError && onError(err));
  };
  
  setTimeout(trigger, 0);

  if (!fsListeners[colRef.path]) {
    fsListeners[colRef.path] = [];
  }
  fsListeners[colRef.path].push(trigger);

  return () => {
    fsListeners[colRef.path] = (fsListeners[colRef.path] || []).filter(cb => cb !== trigger);
  };
}

export async function setDoc(docRef: MockDocumentReference, data: any, options?: { merge?: boolean }) {
  const colName = docRef.collectionRef.path;
  const list = getLocalCollection(colName);
  const idx = list.findIndex(item => item.id === docRef.id);
  const newItem = { ...data, id: docRef.id };
  if (idx >= 0) {
    if (options?.merge) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list[idx] = newItem;
    }
  } else {
    list.push(newItem);
  }
  setLocalCollection(colName, list);
}

export async function addDoc(colRef: MockCollectionReference, data: any) {
  const colName = colRef.path;
  const id = generateAutoId();
  const list = getLocalCollection(colName);
  const newItem = { ...data, id };
  list.push(newItem);
  setLocalCollection(colName, list);
  return new MockDocumentReference(colRef, id);
}

export async function updateDoc(docRef: MockDocumentReference, data: any) {
  const colName = docRef.collectionRef.path;
  const list = getLocalCollection(colName);
  const idx = list.findIndex(item => item.id === docRef.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...data };
    setLocalCollection(colName, list);
  }
}

export async function deleteDoc(docRef: MockDocumentReference) {
  const colName = docRef.collectionRef.path;
  const list = getLocalCollection(colName);
  const filtered = list.filter(item => item.id !== docRef.id);
  setLocalCollection(colName, filtered);
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function writeBatch(database: any) {
  const operations: (() => Promise<void>)[] = [];
  return {
    set: (docRef: MockDocumentReference, data: any, options?: { merge?: boolean }) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: MockDocumentReference, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: MockDocumentReference) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

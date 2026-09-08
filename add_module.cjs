const fs = require('fs');
let code = fs.readFileSync('src/config/modules.ts', 'utf8');

const newModule = `  {
    id: 'checklist',
    titulo: 'Check List & Inspeções',
    descricao: 'Gestão analítica de inspeções diárias de equipamentos, registro de avarias, laudos técnicos e histórico de conformidade.',
    iconName: 'ClipboardCheck',
    badge: 'QUALIDADE & MANUTENÇÃO',
    path: '/app/checklist',
    appKey: 'CHECKLIST',
    themeColor: 'amber',
    quickInfoLabel: 'Conformidade:',
    quickInfoValue: 'Inspeções Ativas',
    categoria: 'Operacional',
    colunaLegada: 'acesso_oficina'
  },
`;

code = code.replace('export const HUB_MODULES: HubModule[] = [', 'export const HUB_MODULES: HubModule[] = [\n' + newModule);
fs.writeFileSync('src/config/modules.ts', code);

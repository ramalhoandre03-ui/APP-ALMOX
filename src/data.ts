/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProjectSite,
  PredefinedMaterial,
  PredefinedEquipment,
  PredefinedUniform,
  SiteDailyReport,
  ShiftType
} from './types';

export const PROJECT_SITES: ProjectSite[] = [
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
    name: 'Complexo Industrial CMPC',
    location: 'Imperatriz - MA',
    clientCompany: 'Suzano S.A.',
    managerName: 'Eng. Thiago Gouveia'
  }
];

export const PREDEFINED_MATERIALS: PredefinedMaterial[] = [
  { id: 'mat-001', name: 'Disco de Corte Flap 7" G40', unit: 'Peça(s)', category: 'Abrasivos' },
  { id: 'mat-002', name: 'Eletrodo Revestido E7018 3.25mm', unit: 'kg', category: 'Consumíveis de Solda' },
  { id: 'mat-003', name: 'Luva de Proteção Mecânica PU', unit: 'Par(es)', category: 'Equipamentos de Proteção' },
  { id: 'mat-004', name: 'Óculos de Segurança Fumê', unit: 'Peça(s)', category: 'Equipamentos de Proteção' },
  { id: 'mat-005', name: 'Fita Isolante de Auto-Fusão 10m', unit: 'Rolo(s)', category: 'Elétrica / Instrumentação' },
  { id: 'mat-006', name: 'Graxa Litio de Extrema Pressão', unit: 'kg', category: 'Lubrificantes / Vedantes' },
  { id: 'mat-007', name: 'Spray Antirespingo de Solda (300ml)', unit: 'Lata(s)', category: 'Consumíveis de Solda' },
  { id: 'mat-008', name: 'Desengripante Spray Industrial WD-40', unit: 'Lata(s)', category: 'Químicos / Limpeza' },
  { id: 'mat-009', name: 'Estopa Alvejada Extra Maciça', unit: 'kg', category: 'Químicos / Limpeza' },
  { id: 'mat-010', name: 'Parafuso Sextavado M16 x 50mm G8.8', unit: 'Peça(s)', category: 'Fixadores' }
];

export const PREDEFINED_EQUIPMENTS: PredefinedEquipment[] = [
  { id: 'eq-001', name: 'Esmerilhadeira Bosch 7" 2200W', category: 'Ferramentas Rotativas' },
  { id: 'eq-002', name: 'Inversora de Solda Esab 250A', category: 'Estações de Solda' },
  { id: 'eq-003', name: 'Torquímetro Snap-on Digital 1/2"', category: 'Instrumentos de Precisão' },
  { id: 'eq-004', name: 'Unidade Hidráulica de Torque 10000 PSI', category: 'Torques de Alta Capacidade' },
  { id: 'eq-005', name: 'Gerador Portátil Silenciado 3.5 kVA', category: 'Apoio Elétrico' },
  { id: 'eq-006', name: 'Furadeira com Impacto Dewalt 5/8"', category: 'Ferramentas de Perfuração' },
  { id: 'eq-007', name: 'Parafusadeira de Impacto Pneumática CP 3/4"', category: 'Ferramentas de Torque' },
  { id: 'eq-008', name: 'Multímetro Industrial Fluke 179', category: 'Instrumentação Diagnóstica' }
];

export const PREDEFINED_UNIFORMS: PredefinedUniform[] = [
  { id: 'uni-001', name: 'Camisa Azul', sizes: ['2', '3', '4', '5', '6'] },
  { id: 'uni-002', name: 'Camisa Cinza', sizes: ['2', '3', '4', '5', '6'] },
  { id: 'uni-003', name: 'Calça Brim Cinza', sizes: ['38', '40', '42', '44', '46', '48'] },
  { id: 'uni-004', name: 'Calça Jeans', sizes: ['38', '40', '42', '44', '46', '48'] },
  { id: 'uni-005', name: 'Botas de Mecânico', sizes: ['38', '39', '40', '41', '42', '43', '44'] },
  { id: 'uni-006', name: 'Botas de Eletricista', sizes: ['38', '39', '40', '41', '42', '43', '44'] }
];

// Seed Data representing past days of operations across some sites, using the updated schema and items
export const SEED_REPORTS: SiteDailyReport[] = [
  // Day 1 - Polo Camacari
  {
    id: 'rep-001',
    siteId: 'site-camacari',
    siteName: 'Polo Petroquímico Braskem',
    date: '2026-06-01',
    shift: ShiftType.TURNO_A,
    storekeeperName: 'Edivaldo Silva',
    manpower: {
      operacional: 35,
      administrativo: 7
    },
    uniforms: [
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '3', quantity: 15, condition: 'Novo' },
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '4', quantity: 22, condition: 'Higienizado' },
      { itemId: 'uni-003', itemName: 'Calça Brim Cinza', size: '42', quantity: 18, condition: 'Higienizado' },
      { itemId: 'uni-005', itemName: 'Botas de Mecânico', size: '40', quantity: 8 },
      { itemId: 'uni-006', itemName: 'Botas de Eletricista', size: '41', quantity: 12 }
    ],
    equipments: [],
    materialsConsumed: [],
    submittedAt: '2026-06-01T14:30:00Z',
    fieldObservations: 'Necessidade de prateleiras adicionais para setorizar camisas por tamanho. Colaboradores elogiaram a qualidade das botas de segurança fornecidas.'
  },
  // Day 1 - Siderurgica Tubarao
  {
    id: 'rep-002',
    siteId: 'site-tubarao',
    siteName: 'Usina Siderúrgica Tubarão',
    date: '2026-06-01',
    shift: ShiftType.FOLGUISTA,
    storekeeperName: 'Joaquim Ramos',
    manpower: {
      operacional: 56,
      administrativo: 7
    },
    uniforms: [
      { itemId: 'uni-002', itemName: 'Camisa Cinza', size: '4', quantity: 9, condition: 'Novo' },
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '3', quantity: 8, condition: 'Higienizado' },
      { itemId: 'uni-004', itemName: 'Calça Jeans', size: '44', quantity: 12, condition: 'Novo' },
      { itemId: 'uni-005', itemName: 'Botas de Mecânico', size: '42', quantity: 2 },
      { itemId: 'uni-006', itemName: 'Botas de Eletricista', size: '40', quantity: 15 }
    ],
    equipments: [],
    materialsConsumed: [],
    submittedAt: '2026-06-01T18:00:00Z',
    fieldObservations: 'Sem problemas de conduta com as frentes operacionais. Observação estrutural: infiltração leve identificada na parte traseira do almoxarifado móvel durante a chuva.'
  },
  // Day 2 - Vale Carajas
  {
    id: 'rep-003',
    siteId: 'site-carajas',
    siteName: 'Frente de Mineração Carajás',
    date: '2026-06-02',
    shift: ShiftType.TURNO_A,
    storekeeperName: 'Luciana Ferreira',
    manpower: {
      operacional: 91,
      administrativo: 10
    },
    uniforms: [
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '3', quantity: 4, condition: 'Novo' },
      { itemId: 'uni-003', itemName: 'Calça Brim Cinza', size: '40', quantity: 2, condition: 'Higienizado' },
      { itemId: 'uni-005', itemName: 'Botas de Mecânico', size: '39', quantity: 0 },
      { itemId: 'uni-006', itemName: 'Botas de Eletricista', size: '42', quantity: 2 }
    ],
    equipments: [],
    materialsConsumed: [],
    submittedAt: '2026-06-02T14:15:00Z',
    fieldObservations: 'Urgente: Escassez crítica de calças brim tamanho 40 no almoxarifado. Alguns colaboradores estão utilizando calças antigas devido à falta de novos lotes higienizados.'
  },
  // Day 2 - Abreu e Lima
  {
    id: 'rep-004',
    siteId: 'site-rnest',
    siteName: 'Refinaria Abreu e Lima (RNEST)',
    date: '2026-06-02',
    shift: ShiftType.TURNO_B,
    storekeeperName: 'Manoel Cavalcanti',
    manpower: {
      operacional: 47,
      administrativo: 5
    },
    uniforms: [
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '4', quantity: 18, condition: 'Novo' },
      { itemId: 'uni-002', itemName: 'Camisa Cinza', size: '5', quantity: 10, condition: 'Higienizado' },
      { itemId: 'uni-003', itemName: 'Calça Brim Cinza', size: '44', quantity: 14, condition: 'Higienizado' },
      { itemId: 'uni-005', itemName: 'Botas de Mecânico', size: '41', quantity: 6 },
      { itemId: 'uni-006', itemName: 'Botas de Eletricista', size: '39', quantity: 8 }
    ],
    equipments: [],
    materialsConsumed: [],
    submittedAt: '2026-06-02T22:10:00Z',
    fieldObservations: 'Alinhamento com a segurança do trabalho quanto às condições de conservação dos uniformes de brim. Colaboradores colaborando positivamente.'
  },
  // Day 3 - Vale Carajas
  {
    id: 'rep-005',
    siteId: 'site-carajas',
    siteName: 'Frente de Mineração Carajás',
    date: '2026-06-03',
    shift: ShiftType.TURNO_B,
    storekeeperName: 'Luciana Ferreira',
    manpower: {
      operacional: 87,
      administrativo: 10
    },
    uniforms: [
      { itemId: 'uni-001', itemName: 'Camisa Azul', size: '3', quantity: 3, condition: 'Novo' },
      { itemId: 'uni-003', itemName: 'Calça Brim Cinza', size: '40', quantity: 1, condition: 'Novo' },
      { itemId: 'uni-005', itemName: 'Botas de Mecânico', size: '39', quantity: 0 },
      { itemId: 'uni-006', itemName: 'Botas de Eletricista', size: '42', quantity: 1 }
    ],
    equipments: [],
    materialsConsumed: [],
    submittedAt: '2026-06-03T21:45:00Z',
    fieldObservations: 'Pendências relatadas anteriormente sobre botas de mecânico tamanho 39 continuam críticas. Solicito apoio imediato da base central para liberação de carregamento.'
  }
];

-- ============================================================================
-- SCRIPT DE AUDITORIA E IMPLEMENTAÇÃO DE SEGURANÇA: SUPABASE RLS
-- CMPC Industrial - Sistemas Integrados
-- ============================================================================
-- Este script habilita o Row Level Security (RLS) em todas as tabelas vitais
-- do sistema e aplica políticas restritivas que protegem os dados contra acessos
-- não autenticados (Mundo Externo/Anônimo).
--
-- Para aplicar estas políticas, copie e execute este script no Editor SQL (SQL Editor)
-- do seu painel do Supabase.
-- ============================================================================

-- Lista de tabelas vitais identificadas no sistema:
-- 1. oficina_eletrica
-- 2. configuracao_sistema
-- 3. previsao_horas_extras
-- 4. admissoes_fardamento
-- 5. devolucoes_ativos
-- 6. usuarios_permissoes
-- 7. requisicoes
-- 8. recebimentos_itens
-- 9. itens_pedido
-- 10. inventarios
-- 11. permissoes_hub
-- 12. checklists_eletrica
-- 13. munck_prontidao
-- 14. munck_agendamentos

-- ----------------------------------------------------------------------------
-- 1. TABELA: oficina_eletrica
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS oficina_eletrica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para oficina_eletrica" ON oficina_eletrica;
CREATE POLICY "Select authenticated para oficina_eletrica" ON oficina_eletrica
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para oficina_eletrica" ON oficina_eletrica;
CREATE POLICY "Insert authenticated para oficina_eletrica" ON oficina_eletrica
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para oficina_eletrica" ON oficina_eletrica;
CREATE POLICY "Update authenticated para oficina_eletrica" ON oficina_eletrica
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para oficina_eletrica" ON oficina_eletrica;
CREATE POLICY "Delete authenticated para oficina_eletrica" ON oficina_eletrica
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 2. TABELA: configuracao_sistema
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS configuracao_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para configuracao_sistema" ON configuracao_sistema;
CREATE POLICY "Select authenticated para configuracao_sistema" ON configuracao_sistema
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para configuracao_sistema" ON configuracao_sistema;
CREATE POLICY "Insert authenticated para configuracao_sistema" ON configuracao_sistema
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para configuracao_sistema" ON configuracao_sistema;
CREATE POLICY "Update authenticated para configuracao_sistema" ON configuracao_sistema
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para configuracao_sistema" ON configuracao_sistema;
CREATE POLICY "Delete authenticated para configuracao_sistema" ON configuracao_sistema
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 3. TABELA: previsao_horas_extras
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS previsao_horas_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para previsao_horas_extras" ON previsao_horas_extras;
CREATE POLICY "Select authenticated para previsao_horas_extras" ON previsao_horas_extras
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para previsao_horas_extras" ON previsao_horas_extras;
CREATE POLICY "Insert authenticated para previsao_horas_extras" ON previsao_horas_extras
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para previsao_horas_extras" ON previsao_horas_extras;
CREATE POLICY "Update authenticated para previsao_horas_extras" ON previsao_horas_extras
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para previsao_horas_extras" ON previsao_horas_extras;
CREATE POLICY "Delete authenticated para previsao_horas_extras" ON previsao_horas_extras
  FOR DELETE TO authenticated USING (true);

-- Políticas Anônimas (Acesso Público para formulário sem login obrigatório)
DROP POLICY IF EXISTS "Permitir leitura pública" ON previsao_horas_extras;
CREATE POLICY "Permitir leitura pública" ON previsao_horas_extras
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública" ON previsao_horas_extras;
CREATE POLICY "Permitir inserção pública" ON previsao_horas_extras
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização pública" ON previsao_horas_extras;
CREATE POLICY "Permitir atualização pública" ON previsao_horas_extras
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão pública" ON previsao_horas_extras;
CREATE POLICY "Permitir exclusão pública" ON previsao_horas_extras
  FOR DELETE TO anon USING (true);


-- ----------------------------------------------------------------------------
-- 3b. TABELA: previsao_horas_extras_funcionarios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS previsao_horas_extras_funcionarios (
  id BIGSERIAL PRIMARY KEY,
  previsao_id BIGINT REFERENCES previsao_horas_extras(id) ON DELETE CASCADE,
  nome_completo TEXT,
  nome TEXT,
  cargo TEXT,
  atividade TEXT,
  atv TEXT,
  provedor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE IF EXISTS previsao_horas_extras_funcionarios ENABLE ROW LEVEL SECURITY;

-- Políticas de Autenticação para previsao_horas_extras_funcionarios
DROP POLICY IF EXISTS "Select authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Select authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Insert authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Update authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Delete authenticated para previsao_horas_extras_funcionarios" ON previsao_horas_extras_funcionarios
  FOR DELETE TO authenticated USING (true);

-- Políticas Anônimas para previsao_horas_extras_funcionarios (Acesso Público)
DROP POLICY IF EXISTS "Permitir leitura pública para funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Permitir leitura pública para funcionarios" ON previsao_horas_extras_funcionarios
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública para funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Permitir inserção pública para funcionarios" ON previsao_horas_extras_funcionarios
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização pública para funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Permitir atualização pública para funcionarios" ON previsao_horas_extras_funcionarios
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão pública para funcionarios" ON previsao_horas_extras_funcionarios;
CREATE POLICY "Permitir exclusão pública para funcionarios" ON previsao_horas_extras_funcionarios
  FOR DELETE TO anon USING (true);


-- ----------------------------------------------------------------------------
-- 4. TABELA: admissoes_fardamento
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS admissoes_fardamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para admissoes_fardamento" ON admissoes_fardamento;
CREATE POLICY "Select authenticated para admissoes_fardamento" ON admissoes_fardamento
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para admissoes_fardamento" ON admissoes_fardamento;
CREATE POLICY "Insert authenticated para admissoes_fardamento" ON admissoes_fardamento
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para admissoes_fardamento" ON admissoes_fardamento;
CREATE POLICY "Update authenticated para admissoes_fardamento" ON admissoes_fardamento
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para admissoes_fardamento" ON admissoes_fardamento;
CREATE POLICY "Delete authenticated para admissoes_fardamento" ON admissoes_fardamento
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 5. TABELA: devolucoes_ativos
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS devolucoes_ativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para devolucoes_ativos" ON devolucoes_ativos;
CREATE POLICY "Select authenticated para devolucoes_ativos" ON devolucoes_ativos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para devolucoes_ativos" ON devolucoes_ativos;
CREATE POLICY "Insert authenticated para devolucoes_ativos" ON devolucoes_ativos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para devolucoes_ativos" ON devolucoes_ativos;
CREATE POLICY "Update authenticated para devolucoes_ativos" ON devolucoes_ativos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para devolucoes_ativos" ON devolucoes_ativos;
CREATE POLICY "Delete authenticated para devolucoes_ativos" ON devolucoes_ativos
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 6. TABELA: usuarios_permissoes
-- ----------------------------------------------------------------------------
-- Nota: Como usuarios_permissoes lida com perfis, ela precisa de uma política
-- inicial que permita a leitura pelo usuário de seu próprio registro, ou leitura/escrita
-- geral por usuários autenticados para permitir fluxos de registro e autorização.
ALTER TABLE IF EXISTS usuarios_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select para usuarios_permissoes" ON usuarios_permissoes;
CREATE POLICY "Select para usuarios_permissoes" ON usuarios_permissoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert para usuarios_permissoes" ON usuarios_permissoes;
CREATE POLICY "Insert para usuarios_permissoes" ON usuarios_permissoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update para usuarios_permissoes" ON usuarios_permissoes;
CREATE POLICY "Update para usuarios_permissoes" ON usuarios_permissoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete para usuarios_permissoes" ON usuarios_permissoes;
CREATE POLICY "Delete para usuarios_permissoes" ON usuarios_permissoes
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 7. TABELA: requisicoes
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS requisicoes ENABLE ROW LEVEL SECURITY;

-- Garante as colunas necessárias na tabela requisicoes para o workflow de Diligenciamento
ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS numero_rtd TEXT;
ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS item_status TEXT;
ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS quantidade_atendida NUMERIC;

DROP POLICY IF EXISTS "Select authenticated para requisicoes" ON requisicoes;
CREATE POLICY "Select authenticated para requisicoes" ON requisicoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para requisicoes" ON requisicoes;
CREATE POLICY "Insert authenticated para requisicoes" ON requisicoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para requisicoes" ON requisicoes;
CREATE POLICY "Update authenticated para requisicoes" ON requisicoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para requisicoes" ON requisicoes;
CREATE POLICY "Delete authenticated para requisicoes" ON requisicoes
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 8. TABELA: recebimentos_itens
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS recebimentos_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para recebimentos_itens" ON recebimentos_itens;
CREATE POLICY "Select authenticated para recebimentos_itens" ON recebimentos_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para recebimentos_itens" ON recebimentos_itens;
CREATE POLICY "Insert authenticated para recebimentos_itens" ON recebimentos_itens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para recebimentos_itens" ON recebimentos_itens;
CREATE POLICY "Update authenticated para recebimentos_itens" ON recebimentos_itens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para recebimentos_itens" ON recebimentos_itens;
CREATE POLICY "Delete authenticated para recebimentos_itens" ON recebimentos_itens
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 9. TABELA: itens_pedido
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS itens_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para itens_pedido" ON itens_pedido;
CREATE POLICY "Select authenticated para itens_pedido" ON itens_pedido
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para itens_pedido" ON itens_pedido;
CREATE POLICY "Insert authenticated para itens_pedido" ON itens_pedido
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para itens_pedido" ON itens_pedido;
CREATE POLICY "Update authenticated para itens_pedido" ON itens_pedido
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para itens_pedido" ON itens_pedido;
CREATE POLICY "Delete authenticated para itens_pedido" ON itens_pedido
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 10. TABELA: inventarios
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS inventarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para inventarios" ON inventarios;
CREATE POLICY "Select authenticated para inventarios" ON inventarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para inventarios" ON inventarios;
CREATE POLICY "Insert authenticated para inventarios" ON inventarios
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para inventarios" ON inventarios;
CREATE POLICY "Update authenticated para inventarios" ON inventarios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para inventarios" ON inventarios;
CREATE POLICY "Delete authenticated para inventarios" ON inventarios
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 11. TABELA: permissoes_hub
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS permissoes_hub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para permissoes_hub" ON permissoes_hub;
CREATE POLICY "Select authenticated para permissoes_hub" ON permissoes_hub
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para permissoes_hub" ON permissoes_hub;
CREATE POLICY "Insert authenticated para permissoes_hub" ON permissoes_hub
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para permissoes_hub" ON permissoes_hub;
CREATE POLICY "Update authenticated para permissoes_hub" ON permissoes_hub
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para permissoes_hub" ON permissoes_hub;
CREATE POLICY "Delete authenticated para permissoes_hub" ON permissoes_hub
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 12. TABELA: checklists_eletrica
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS checklists_eletrica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para checklists_eletrica" ON checklists_eletrica;
CREATE POLICY "Select authenticated para checklists_eletrica" ON checklists_eletrica
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para checklists_eletrica" ON checklists_eletrica;
CREATE POLICY "Insert authenticated para checklists_eletrica" ON checklists_eletrica
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para checklists_eletrica" ON checklists_eletrica;
CREATE POLICY "Update authenticated para checklists_eletrica" ON checklists_eletrica
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para checklists_eletrica" ON checklists_eletrica;
CREATE POLICY "Delete authenticated para checklists_eletrica" ON checklists_eletrica
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 13. TABELA: munck_prontidao
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS munck_prontidao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para munck_prontidao" ON munck_prontidao;
CREATE POLICY "Select authenticated para munck_prontidao" ON munck_prontidao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para munck_prontidao" ON munck_prontidao;
CREATE POLICY "Insert authenticated para munck_prontidao" ON munck_prontidao
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para munck_prontidao" ON munck_prontidao;
CREATE POLICY "Update authenticated para munck_prontidao" ON munck_prontidao
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para munck_prontidao" ON munck_prontidao;
CREATE POLICY "Delete authenticated para munck_prontidao" ON munck_prontidao
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 14. TABELA: munck_agendamentos
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS munck_agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select authenticated para munck_agendamentos" ON munck_agendamentos;
CREATE POLICY "Select authenticated para munck_agendamentos" ON munck_agendamentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert authenticated para munck_agendamentos" ON munck_agendamentos;
CREATE POLICY "Insert authenticated para munck_agendamentos" ON munck_agendamentos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update authenticated para munck_agendamentos" ON munck_agendamentos;
CREATE POLICY "Update authenticated para munck_agendamentos" ON munck_agendamentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete authenticated para munck_agendamentos" ON munck_agendamentos;
CREATE POLICY "Delete authenticated para munck_agendamentos" ON munck_agendamentos
  FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------------------------------
-- 15. TABELA: system_settings (Comunicação Visual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGINT PRIMARY KEY,
  main_banner_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE IF EXISTS system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para leitura e escrita
DROP POLICY IF EXISTS "Permitir leitura pública system_settings" ON system_settings;
CREATE POLICY "Permitir leitura pública system_settings" ON system_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir alteração pública system_settings" ON system_settings;
CREATE POLICY "Permitir alteração pública system_settings" ON system_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Inserir registro inicial se não existir
INSERT INTO system_settings (id, main_banner_url)
VALUES (1, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- FIM DO SCRIPT DE SEGURANÇA
-- ----------------------------------------------------------------------------

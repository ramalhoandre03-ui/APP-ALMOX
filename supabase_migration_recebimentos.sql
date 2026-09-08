-- MIGRATION SCRIPT PARA MODELO APPEND-ONLY NO SUPABASE
-- 1. Garante que 'id' exista e seja UUID com geração automática
ALTER TABLE recebimentos_itens ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 2. Remove restrições de unicidade que impediam o registro de múltiplas NFs para o mesmo PC e Item
-- (Exemplo: Chave composta de numero_pc + codigo_item)
ALTER TABLE recebimentos_itens DROP CONSTRAINT IF EXISTS recebimentos_itens_pkey;
ALTER TABLE recebimentos_itens DROP CONSTRAINT IF EXISTS uk_recebimentos_pc_item;
ALTER TABLE recebimentos_itens DROP CONSTRAINT IF EXISTS recebimentos_itens_numero_pc_codigo_item_key;

-- 3. Define 'id' como a única Chave Primária verdadeira
ALTER TABLE recebimentos_itens ADD PRIMARY KEY (id);

-- 4. Bloqueia updates e deletes indesejados (Imutabilidade do Histórico)
-- Nota: Caso os gerentes ainda precisem corrigir erros de digitação, não rode estas restrições.
-- Mas se for estritamente um log de auditoria append-only (Insert-Only), ative abaixo:
-- REVOKE UPDATE, DELETE ON recebimentos_itens FROM authenticated;

-- Criar views otimizadas para o dashboard para evitar limite de 1000 registros

-- View para KPIs principais (totalizações agregadas por cliente e ciclo)
CREATE OR REPLACE VIEW dashboard_kpis AS
SELECT 
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date,
  SUM(cs.consumption_ipu) as total_ipu,
  COUNT(DISTINCT cs.org_id) as active_orgs
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.meter_name != 'Sandbox Organizations IPU Usage'
GROUP BY cs.configuracao_id, c.cliente_id, cs.billing_period_start_date, cs.billing_period_end_date;

-- View para evolução de custos (agregação por ciclo)
CREATE OR REPLACE VIEW dashboard_cost_evolution AS
SELECT 
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date,
  cs.org_id,
  cs.org_name,
  SUM(cs.consumption_ipu) as consumption_ipu
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.meter_name != 'Sandbox Organizations IPU Usage'
  AND cs.consumption_ipu > 0
GROUP BY cs.configuracao_id, c.cliente_id, cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name;

-- View para distribuição de custos (agregação por organização)
CREATE OR REPLACE VIEW dashboard_cost_distribution AS
SELECT 
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date,
  cs.org_id,
  cs.org_name,
  SUM(cs.consumption_ipu) as consumption_ipu
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.meter_name != 'Sandbox Organizations IPU Usage'
  AND cs.consumption_ipu > 0
GROUP BY cs.configuracao_id, c.cliente_id, cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name;

-- View para métricas por ciclo de consumo (agregação por período)
CREATE OR REPLACE VIEW dashboard_billing_periods AS
SELECT 
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date,
  cs.org_id,
  cs.org_name,
  cs.meter_name,
  SUM(cs.consumption_ipu) as consumption_ipu
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.meter_name != 'Sandbox Organizations IPU Usage'
  AND cs.consumption_ipu > 0
GROUP BY cs.configuracao_id, c.cliente_id, cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name, cs.meter_name;

-- View para detalhes de organizações (incluindo hierarquia)
CREATE OR REPLACE VIEW dashboard_organization_details AS
SELECT 
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date,
  cs.org_id,
  cs.org_name,
  SUM(cs.consumption_ipu) as consumption_ipu
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.consumption_ipu > 0
GROUP BY cs.configuracao_id, c.cliente_id, cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name;

-- View para ciclos disponíveis
CREATE OR REPLACE VIEW dashboard_available_cycles AS
SELECT DISTINCT
  cs.configuracao_id,
  c.cliente_id,
  cs.billing_period_start_date,
  cs.billing_period_end_date
FROM api_consumosummary cs
INNER JOIN api_configuracaoidmc c ON cs.configuracao_id = c.id
WHERE cs.meter_name != 'Sandbox Organizations IPU Usage'
ORDER BY cs.billing_period_end_date DESC;

-- Configurar RLS para as views
ALTER VIEW dashboard_kpis ENABLE ROW LEVEL SECURITY;
ALTER VIEW dashboard_cost_evolution ENABLE ROW LEVEL SECURITY;
ALTER VIEW dashboard_cost_distribution ENABLE ROW LEVEL SECURITY;
ALTER VIEW dashboard_billing_periods ENABLE ROW LEVEL SECURITY;
ALTER VIEW dashboard_organization_details ENABLE ROW LEVEL SECURITY;
ALTER VIEW dashboard_available_cycles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para as views
CREATE POLICY "Users can view own dashboard KPIs" ON dashboard_kpis
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Users can view own cost evolution" ON dashboard_cost_evolution
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Users can view own cost distribution" ON dashboard_cost_distribution
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Users can view own billing periods" ON dashboard_billing_periods
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Users can view own organization details" ON dashboard_organization_details
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Users can view own available cycles" ON dashboard_available_cycles
FOR SELECT USING (cliente_id IN (
  SELECT profiles.cliente_id FROM profiles WHERE profiles.id = auth.uid()
));
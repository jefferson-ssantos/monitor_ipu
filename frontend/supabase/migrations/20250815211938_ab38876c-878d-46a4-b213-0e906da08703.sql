-- Enable RLS on the api_consumocaiassetsumario table that was missing it
ALTER TABLE api_consumocaiassetsumario ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for api_consumocaiassetsumario
CREATE POLICY "Users can view own CAI asset summary" 
ON api_consumocaiassetsumario 
FOR SELECT 
USING (configuracao_id IN (
  SELECT api_configuracaoidmc.id
  FROM api_configuracaoidmc
  WHERE api_configuracaoidmc.cliente_id IN (
    SELECT profiles.cliente_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));
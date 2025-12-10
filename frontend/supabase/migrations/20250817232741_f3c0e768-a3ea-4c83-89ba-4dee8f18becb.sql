-- Create custom tags table
CREATE TABLE public.api_tags_customizadas (
  id BIGSERIAL PRIMARY KEY,
  configuracao_id INTEGER NOT NULL,
  meter_id VARCHAR,
  asset_name TEXT,
  asset_type VARCHAR,
  project_name TEXT,
  folder_name TEXT,
  tag_name VARCHAR NOT NULL,
  tag_color VARCHAR DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(configuracao_id, meter_id, asset_name, asset_type, project_name, folder_name)
);

-- Enable RLS
ALTER TABLE public.api_tags_customizadas ENABLE ROW LEVEL SECURITY;

-- Create policies for custom tags
CREATE POLICY "Users can view own custom tags" 
ON public.api_tags_customizadas 
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

CREATE POLICY "Users can create custom tags" 
ON public.api_tags_customizadas 
FOR INSERT 
WITH CHECK (configuracao_id IN (
  SELECT api_configuracaoidmc.id
  FROM api_configuracaoidmc
  WHERE api_configuracaoidmc.cliente_id IN (
    SELECT profiles.cliente_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Users can update own custom tags" 
ON public.api_tags_customizadas 
FOR UPDATE 
USING (configuracao_id IN (
  SELECT api_configuracaoidmc.id
  FROM api_configuracaoidmc
  WHERE api_configuracaoidmc.cliente_id IN (
    SELECT profiles.cliente_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

CREATE POLICY "Users can delete own custom tags" 
ON public.api_tags_customizadas 
FOR DELETE 
USING (configuracao_id IN (
  SELECT api_configuracaoidmc.id
  FROM api_configuracaoidmc
  WHERE api_configuracaoidmc.cliente_id IN (
    SELECT profiles.cliente_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_api_tags_customizadas_updated_at
  BEFORE UPDATE ON public.api_tags_customizadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
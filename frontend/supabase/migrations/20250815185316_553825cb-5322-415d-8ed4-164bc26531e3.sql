-- Habilitar RLS em todas as tabelas restantes do sistema
ALTER TABLE public.api_consumoasset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_consumocaiassetsumario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_consumocdijobexecucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_consumoprojectfolder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_consumosummary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_extracaolog ENABLE ROW LEVEL SECURITY;

-- Políticas restritivas por padrão - usuários só veem dados das suas configurações

-- Para api_consumoasset
CREATE POLICY "Users can view own consumption data" 
ON public.api_consumoasset 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Para api_consumocaiassetsumario
CREATE POLICY "Users can view own CAI asset summary" 
ON public.api_consumocaiassetsumario 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Para api_consumocdijobexecucao
CREATE POLICY "Users can view own CDI job execution" 
ON public.api_consumocdijobexecucao 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Para api_consumoprojectfolder
CREATE POLICY "Users can view own project folder consumption" 
ON public.api_consumoprojectfolder 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Para api_consumosummary
CREATE POLICY "Users can view own consumption summary" 
ON public.api_consumosummary 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Para api_extracaolog
CREATE POLICY "Users can view own extraction logs" 
ON public.api_extracaolog 
FOR SELECT 
USING (
  configuracao_id IN (
    SELECT id 
    FROM public.api_configuracaoidmc 
    WHERE cliente_id IN (
      SELECT cliente_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Corrigir function search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;
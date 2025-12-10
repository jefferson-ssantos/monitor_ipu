-- Criar tabela de profiles para ligar usuários Supabase com clientes
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cliente_id BIGINT REFERENCES public.api_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seu próprio perfil
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Política para usuários criarem seu próprio perfil
CREATE POLICY "Users can create own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Política para usuários atualizarem seu próprio perfil
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Habilitar RLS nas tabelas existentes
ALTER TABLE public.api_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_configuracaoidmc ENABLE ROW LEVEL SECURITY;

-- Políticas para api_clientes - usuários só veem seus próprios clientes
CREATE POLICY "Users can view own client data" 
ON public.api_clientes 
FOR SELECT 
USING (
  id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create client data" 
ON public.api_clientes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update own client data" 
ON public.api_clientes 
FOR UPDATE 
USING (
  id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Políticas para api_configuracaoidmc - usuários só veem configurações dos seus clientes
CREATE POLICY "Users can view own configurations" 
ON public.api_configuracaoidmc 
FOR SELECT 
USING (
  cliente_id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create configurations" 
ON public.api_configuracaoidmc 
FOR INSERT 
WITH CHECK (
  cliente_id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update own configurations" 
ON public.api_configuracaoidmc 
FOR UPDATE 
USING (
  cliente_id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete own configurations" 
ON public.api_configuracaoidmc 
FOR DELETE 
USING (
  cliente_id IN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Função para criar perfil automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger para executar a função quando usuário é criado
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at na tabela profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
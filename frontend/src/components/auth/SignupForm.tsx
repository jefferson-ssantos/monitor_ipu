import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IDMCConfig {
  apelido_configuracao: string;
  iics_pod_url: string;
  iics_username: string;
  iics_password: string;
}

export function SignupForm() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Cliente data
  const [clienteData, setClienteData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nome_cliente: "",
    email_contato: "",
    preco_por_ipu: "",
    qtd_ipus_contratadas: ""
  });

  // IDMC configurations
  const [configurations, setConfigurations] = useState<IDMCConfig[]>([
    {
      apelido_configuracao: "",
      iics_pod_url: "",
      iics_username: "",
      iics_password: ""
    }
  ]);

  const handleAddConfiguration = () => {
    setConfigurations([...configurations, {
      apelido_configuracao: "",
      iics_pod_url: "",
      iics_username: "",
      iics_password: ""
    }]);
  };

  const handleRemoveConfiguration = (index: number) => {
    if (configurations.length > 1) {
      setConfigurations(configurations.filter((_, i) => i !== index));
    }
  };

  const handleConfigurationChange = (index: number, field: keyof IDMCConfig, value: string) => {
    const updatedConfigs = configurations.map((config, i) => 
      i === index ? { ...config, [field]: value } : config
    );
    setConfigurations(updatedConfigs);
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Validar dados do cliente
      if (!clienteData.email || !clienteData.password || !clienteData.nome_cliente) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive"
        });
        return;
      }
      if (clienteData.password !== clienteData.confirmPassword) {
        toast({
          title: "Erro",
          description: "As senhas não coincidem",
          variant: "destructive"
        });
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // 1. Criar usuário na auth
      const { error: signUpError } = await signUp(clienteData.email, clienteData.password);
      if (signUpError) {
        throw signUpError;
      }

      // 2. Criar cliente
      const { data: cliente, error: clienteError } = await supabase
        .from('api_clientes')
        .insert({
          nome_cliente: clienteData.nome_cliente,
          email_contato: clienteData.email_contato || clienteData.email,
          preco_por_ipu: parseFloat(clienteData.preco_por_ipu) || 0.10,
          qtd_ipus_contratadas: clienteData.qtd_ipus_contratadas ? parseFloat(clienteData.qtd_ipus_contratadas) : null,
          ativo: true,
          data_criacao: new Date().toISOString()
        })
        .select()
        .single();

      if (clienteError) {
        throw clienteError;
      }

      // 3. Atualizar profile com cliente_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ cliente_id: cliente.id })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (profileError) {
        throw profileError;
      }

      // 4. Criar configurações IDMC
      const configsToInsert = configurations
        .filter(config => config.apelido_configuracao && config.iics_pod_url)
        .map(config => ({
          ...config,
          cliente_id: cliente.id,
          ativo: true,
          data_criacao: new Date().toISOString()
        }));

      if (configsToInsert.length > 0) {
        const { error: configError } = await supabase
          .from('api_configuracaoidmc')
          .insert(configsToInsert);

        if (configError) {
          throw configError;
        }
      }

      toast({
        title: "Sucesso!",
        description: "Conta criada com sucesso. Verifique seu email para ativação.",
      });

    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message || "Erro inesperado durante o cadastro",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl bg-card/80 backdrop-blur-sm border-border/50 shadow-soft">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-heading text-foreground">
          Criar Nova Conta
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {step === 1 ? "Dados da conta e empresa" : "Configurações IDMC"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 1 ? (
          // Step 1: Dados do Cliente
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={clienteData.email}
                  onChange={(e) => setClienteData({...clienteData, email: e.target.value})}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_cliente">Nome da Empresa *</Label>
                <Input
                  id="nome_cliente"
                  value={clienteData.nome_cliente}
                  onChange={(e) => setClienteData({...clienteData, nome_cliente: e.target.value})}
                  placeholder="Nome da sua empresa"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={clienteData.password}
                  onChange={(e) => setClienteData({...clienteData, password: e.target.value})}
                  placeholder="Sua senha"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={clienteData.confirmPassword}
                  onChange={(e) => setClienteData({...clienteData, confirmPassword: e.target.value})}
                  placeholder="Confirme sua senha"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email_contato">Email de Contato</Label>
                <Input
                  id="email_contato"
                  type="email"
                  value={clienteData.email_contato}
                  onChange={(e) => setClienteData({...clienteData, email_contato: e.target.value})}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtd_ipus_contratadas">IPUs Contratadas</Label>
                <Input
                  id="qtd_ipus_contratadas"
                  type="number"
                  value={clienteData.qtd_ipus_contratadas}
                  onChange={(e) => setClienteData({...clienteData, qtd_ipus_contratadas: e.target.value})}
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco_por_ipu">Preço por IPU (R$)</Label>
                <Input
                  id="preco_por_ipu"
                  type="number"
                  step="0.01"
                  value={clienteData.preco_por_ipu}
                  onChange={(e) => setClienteData({...clienteData, preco_por_ipu: e.target.value})}
                  placeholder="0.10"
                />
              </div>
            </div>

            <Button 
              onClick={handleNextStep}
              className="w-full bg-[#283a86] text-white hover:bg-[#283a86]/90 border border-white/20"
              size="lg"
            >
              Próximo: Configurações IDMC
            </Button>
          </div>
        ) : (
          // Step 2: Configurações IDMC
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Configure pelo menos uma conexão IDMC para começar a monitorar seus custos.
            </div>

            {configurations.map((config, index) => (
              <Card key={index} className="p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-foreground">
                    Configuração {index + 1}
                  </h4>
                  {configurations.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveConfiguration(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`apelido_${index}`}>Nome da Configuração *</Label>
                    <Input
                      id={`apelido_${index}`}
                      value={config.apelido_configuracao}
                      onChange={(e) => handleConfigurationChange(index, 'apelido_configuracao', e.target.value)}
                      placeholder="Ex: Produção, Desenvolvimento"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`pod_url_${index}`}>IICS Pod URL *</Label>
                    <Input
                      id={`pod_url_${index}`}
                      value={config.iics_pod_url}
                      onChange={(e) => handleConfigurationChange(index, 'iics_pod_url', e.target.value)}
                      placeholder="https://dm-us.informaticacloud.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`username_${index}`}>Username IICS</Label>
                    <Input
                      id={`username_${index}`}
                      value={config.iics_username}
                      onChange={(e) => handleConfigurationChange(index, 'iics_username', e.target.value)}
                      placeholder="seu.usuario@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`password_${index}`}>Password IICS</Label>
                    <Input
                      id={`password_${index}`}
                      type="password"
                      value={config.iics_password}
                      onChange={(e) => handleConfigurationChange(index, 'iics_password', e.target.value)}
                      placeholder="Senha IICS"
                    />
                  </div>
                </div>
              </Card>
            ))}

            <Button
              variant="outline"
              onClick={handleAddConfiguration}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Configuração
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-[#283a86] text-white hover:bg-[#283a86]/90 border border-white/20"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Conta
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
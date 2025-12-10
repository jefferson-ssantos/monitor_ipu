import { useState, useEffect } from 'react';
import { useMemo } from "react";
import { usePageHeader } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Cable } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface IDMCConfig {
  id: number;
  apelido_configuracao: string;
  iics_pod_url: string;
  iics_username: string;
  iics_password: string;
  ativo: boolean;
  data_criacao: string;
  ultima_extracao_enddate: string | null;
}


export default function ConfigConnections() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<IDMCConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<IDMCConfig | null>(null);

  const pageTitle = useMemo(() => (
    <div className="flex items-center gap-3">
      <Cable className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-3xl font-bold">Configurações IDMC</h1>
      </div>
    </div>
  ), []);
 usePageHeader(pageTitle);



  const [configForm, setConfigForm] = useState({
    apelido_configuracao: '',
    iics_pod_url: '',
    iics_username: '',
    iics_password: '',
    ativo: true
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('api_configuracaoidmc')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (editingConfig) {
        const { error } = await supabase
          .from('api_configuracaoidmc')
          .update(configForm)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast.success('Configuração atualizada com sucesso');
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('cliente_id')
          .eq('id', user?.id)
          .single();

        if (profileError) throw profileError;

        const { error } = await supabase
          .from('api_configuracaoidmc')
          .insert({
            ...configForm,
            cliente_id: profileData.cliente_id,
            data_criacao: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Configuração criada com sucesso');
      }

      setIsConfigDialogOpen(false);
      setEditingConfig(null);
      setConfigForm({
        apelido_configuracao: '',
        iics_pod_url: '',
        iics_username: '',
        iics_password: '',
        ativo: true
      });
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  const handleEditConfig = (config: IDMCConfig) => {
    setEditingConfig(config);
    setConfigForm({
      apelido_configuracao: config.apelido_configuracao,
      iics_pod_url: config.iics_pod_url,
      iics_username: config.iics_username,
      iics_password: config.iics_password,
      ativo: config.ativo
    });
    setIsConfigDialogOpen(true);
  };

  const handleDeleteConfig = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;

    try {
      const { error } = await supabase
        .from('api_configuracaoidmc')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Configuração excluída com sucesso');
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao excluir configuração');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
               Conexões Criadas
            </CardTitle>
            <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingConfig(null);
                  setConfigForm({
                    apelido_configuracao: '',
                    iics_pod_url: '',
                    iics_username: '',
                    iics_password: '',
                    ativo: true
                  });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Configuração
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingConfig ? 'Editar' : 'Nova'} Configuração IDMC
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="apelido">Apelido da Configuração</Label>
                    <Input
                      id="apelido"
                      value={configForm.apelido_configuracao}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        apelido_configuracao: e.target.value
                      }))}
                      placeholder="Ex: Produção IICS"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pod_url">URL do Pod IICS</Label>
                    <Input
                      id="pod_url"
                      value={configForm.iics_pod_url}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        iics_pod_url: e.target.value
                      }))}
                      placeholder="https://your-pod.informaticacloud.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={configForm.iics_username}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        iics_username: e.target.value
                      }))}
                      placeholder="username@domain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={configForm.iics_password}
                      onChange={(e) => setConfigForm(prev => ({
                        ...prev,
                        iics_password: e.target.value
                      }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={configForm.ativo}
                      onCheckedChange={(checked) => setConfigForm(prev => ({
                        ...prev,
                        ativo: checked
                      }))}
                    />
                    <Label htmlFor="ativo">Configuração Ativa</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveConfig} className="flex-1">
                      {editingConfig ? 'Atualizar' : 'Criar'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsConfigDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma configuração encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apelido</TableHead>
                    <TableHead>URL do Pod</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Extração</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">
                        {config.apelido_configuracao}
                      </TableCell>
                      <TableCell>{config.iics_pod_url}</TableCell>
                      <TableCell>{config.iics_username}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          config.ativo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {config.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {config.ultima_extracao_enddate 
                          ? new Date(config.ultima_extracao_enddate).toLocaleDateString('pt-BR')
                          : 'Nunca'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditConfig(config)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteConfig(config.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
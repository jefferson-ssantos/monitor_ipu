import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CustomTag {
  id: number;
  configuracao_id: number;
  meter_id: string | null;
  asset_name: string | null;
  asset_type: string | null;
  project_name: string | null;
  folder_name: string | null;
  tag_name: string;
  tag_color: string;
  created_at: string;
  updated_at: string;
}

interface AssetCombination {
  configuracao_id: number;
  meter_id: string | null;
  asset_name: string | null;
  asset_type: string | null;
  project_name: string | null;
  folder_name: string | null;
}

interface TagManagerProps {
  selectedOrg?: string;
}

const TAG_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export function TagManager({ selectedOrg }: TagManagerProps) {
  const { user } = useAuth();
  const [tags, setTags] = useState<CustomTag[]>([]);
  const [assets, setAssets] = useState<AssetCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [formData, setFormData] = useState({
    tag_name: '',
    tag_color: TAG_COLORS[0],
    asset_combination: null as AssetCombination | null
  });

  useEffect(() => {
    if (user) {
      fetchTags();
      fetchAvailableAssets();
    }
  }, [user, selectedOrg]);

  const fetchTags = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.cliente_id) return;

      const { data: configs } = await supabase
        .from('api_configuracaoidmc')
        .select('id')
        .eq('cliente_id', profile.cliente_id);

      if (!configs?.length) return;

      let query = supabase
        .from('api_tags_customizadas')
        .select('*')
        .in('configuracao_id', configs.map(c => c.id));

      const { data, error } = await query;

      if (error) {
        return;
      }

      setTags(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAssets = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.cliente_id) return;

      const { data: configs } = await supabase
        .from('api_configuracaoidmc')
        .select('id')
        .eq('cliente_id', profile.cliente_id);

      if (!configs?.length) return;

      let query = supabase
        .from('api_consumoasset')
        .select('configuracao_id, meter_id, asset_name, asset_type, project_name, folder_name')
        .in('configuracao_id', configs.map(c => c.id));

      if (selectedOrg) {
        query = query.eq('org_id', selectedOrg);
      }

      // Paginate to fetch all records, bypassing Supabase's 1000-row limit
      const BATCH_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while(hasMore) {
        const { data: batch, error } = await query.range(from, from + BATCH_SIZE - 1);

        if (error) {
          console.error("Supabase fetch error in TagManager:", error);
          throw error;
        }

        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          from += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }
      const data = allData;

      // Remove duplicates based on combination of fields
      const uniqueAssets = data?.reduce((acc, asset) => {
        const key = `${asset.configuracao_id}-${asset.meter_id}-${asset.asset_name}-${asset.asset_type}-${asset.project_name}-${asset.folder_name}`;
        if (!acc.some(a => `${a.configuracao_id}-${a.meter_id}-${a.asset_name}-${a.asset_type}-${a.project_name}-${a.folder_name}` === key)) {
          acc.push(asset);
        }
        return acc;
      }, [] as AssetCombination[]) || [];

      setAssets(uniqueAssets);
    } catch (error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.asset_combination || !formData.tag_name.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      const tagData = {
        ...formData.asset_combination,
        tag_name: formData.tag_name.trim(),
        tag_color: formData.tag_color
      };

      if (editingTag) {
        const { error } = await supabase
          .from('api_tags_customizadas')
          .update(tagData)
          .eq('id', editingTag.id);

        if (error) throw error;
        toast.success('Tag atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('api_tags_customizadas')
          .insert([tagData]);

        if (error) throw error;
        toast.success('Tag criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchTags();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma tag para esta combinação de asset');
      } else {
        toast.error('Erro ao salvar tag');
      }
    }
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) return;

    try {
      const { error } = await supabase
        .from('api_tags_customizadas')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
      
      toast.success('Tag excluída com sucesso!');
      fetchTags();
    } catch (error) {
      toast.error('Erro ao excluir tag');
    }
  };

  const handleEdit = (tag: CustomTag) => {
    setEditingTag(tag);
    setFormData({
      tag_name: tag.tag_name,
      tag_color: tag.tag_color,
      asset_combination: {
        configuracao_id: tag.configuracao_id,
        meter_id: tag.meter_id,
        asset_name: tag.asset_name,
        asset_type: tag.asset_type,
        project_name: tag.project_name,
        folder_name: tag.folder_name
      }
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      tag_name: '',
      tag_color: TAG_COLORS[0],
      asset_combination: null
    });
    setEditingTag(null);
  };

  const getAssetDisplayName = (asset: AssetCombination) => {
    const parts = [
      asset.asset_name,
      asset.asset_type,
      asset.project_name,
      asset.folder_name
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Asset sem nome';
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando tags...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags Customizadas
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tag
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTag ? 'Editar Tag' : 'Nova Tag Customizada'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="asset_combination">Asset *</Label>
                  <Select
                    value={formData.asset_combination ? getAssetDisplayName(formData.asset_combination) : ''}
                    onValueChange={(value) => {
                      const asset = assets.find(a => getAssetDisplayName(a) === value);
                      setFormData(prev => ({ ...prev, asset_combination: asset || null }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((asset, index) => (
                        <SelectItem key={index} value={getAssetDisplayName(asset)}>
                          {getAssetDisplayName(asset)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tag_name">Nome da Tag *</Label>
                  <Input
                    id="tag_name"
                    value={formData.tag_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, tag_name: e.target.value }))}
                    placeholder="Digite o nome da tag"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tag_color">Cor da Tag</Label>
                  <div className="flex gap-2 mt-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.tag_color === color ? 'border-foreground' : 'border-border'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, tag_color: color }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTag ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma tag customizada encontrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Pasta</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Badge style={{ backgroundColor: tag.tag_color, color: 'white' }}>
                      {tag.tag_name}
                    </Badge>
                  </TableCell>
                  <TableCell>{tag.asset_name || '-'}</TableCell>
                  <TableCell>{tag.asset_type || '-'}</TableCell>
                  <TableCell>{tag.project_name || '-'}</TableCell>
                  <TableCell>{tag.folder_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(tag)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(tag.id)}
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
  );
}
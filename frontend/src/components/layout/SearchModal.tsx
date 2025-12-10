import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FileText, Database, Building, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const searchResults = [
    {
      title: 'Dashboard',
      description: 'Visão geral dos custos e métricas',
      icon: Database,
      url: '/dashboard'
    },
    {
      title: 'Análise de Custos',
      description: 'Análises detalhadas e forecasting',
      icon: FileText,
      url: '/analysis'
    },
    {
      title: 'Detalhamento por Asset',
      description: 'Consumo individual por asset',
      icon: FileText,
      url: '/consumption/assets'
    },
    {
      title: 'Detalhamento por Organização',
      description: 'Visão organizacional do consumo',
      icon: Building,
      url: '/consumption/organizations'
    },
    {
      title: 'Execução de Jobs',
      description: 'Detalhes de execução de jobs',
      icon: Play,
      url: '/consumption/jobs'
    }
  ].filter(item => 
    query === '' || 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleResultClick = (url: string) => {
    navigate(url);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input
            placeholder="Digite para buscar páginas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
            autoFocus
          />
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => handleResultClick(result.url)}
              >
                <result.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                <div>
                  <div className="font-medium">{result.title}</div>
                  <div className="text-sm text-muted-foreground">{result.description}</div>
                </div>
              </Button>
            ))}
            
            {searchResults.length === 0 && query !== '' && (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
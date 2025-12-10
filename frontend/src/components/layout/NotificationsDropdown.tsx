import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Info, TrendingUp } from 'lucide-react';

const notifications = [
  {
    id: 1,
    type: 'warning',
    title: 'Alto Consumo Detectado',
    message: 'Organização "DataTeam" ultrapassou 80% do orçamento mensal',
    time: '5 min atrás',
    icon: AlertTriangle
  },
  {
    id: 2,
    type: 'info',
    title: 'Relatório Mensal Disponível',
    message: 'Relatório de custos de dezembro está pronto para download',
    time: '2 horas atrás',
    icon: Info
  },
  {
    id: 3,
    type: 'trend',
    title: 'Tendência de Crescimento',
    message: 'Consumo IPU aumentou 15% em relação ao mês anterior',
    time: '1 dia atrás',
    icon: TrendingUp
  }
];

export function NotificationsDropdown() {
  const unreadCount = notifications.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <Bell className="h-4 w-4" />
          </Button>
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-cost-high flex items-center justify-center">
              {unreadCount}
            </Badge>
          )}
        </div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          <Badge variant="secondary" className="text-xs">
            {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.map((notification) => {
          const IconComponent = notification.icon;
          
          return (
            <DropdownMenuItem key={notification.id} className="p-3 cursor-pointer">
              <div className="flex gap-3 w-full">
                <div className={`p-1 rounded-full ${
                  notification.type === 'warning' ? 'bg-cost-high/10 text-cost-high' :
                  notification.type === 'info' ? 'bg-blue-100 text-blue-600' :
                  'bg-cost-medium/10 text-cost-medium'
                }`}>
                  <IconComponent className="h-3 w-3" />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm">{notification.title}</div>
                  <div className="text-xs text-muted-foreground">{notification.message}</div>
                  <div className="text-xs text-muted-foreground">{notification.time}</div>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center text-sm text-primary cursor-pointer">
          Ver todas as notificações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
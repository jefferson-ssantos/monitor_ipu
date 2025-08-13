# backend/api/admin.py
from django.contrib import admin
from .models import Clientes, ConfiguracaoIDMC, ExtracaoLog

@admin.register(Clientes)
class ClientesAdmin(admin.ModelAdmin):
    list_display = ('nome_cliente', 'email_contato', 'preco_por_ipu', 'ativo')
    list_filter = ('ativo',)
    search_fields = ('nome_cliente', 'email_contato')

@admin.register(ConfiguracaoIDMC)
class ConfiguracaoIDMCAdmin(admin.ModelAdmin):
    list_display = ('apelido_configuracao', 'cliente', 'iics_pod_url', 'ativo', 'ultima_extracao_enddate')
    list_filter = ('ativo', 'cliente')
    search_fields = ('apelido_configuracao', 'cliente__nome_cliente')
    list_select_related = ('cliente',)

@admin.register(ExtracaoLog)
class ExtracaoLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'configuracao', 'etapa', 'status', 'detalhes')
    list_filter = ('status', 'etapa', 'configuracao')
    search_fields = ('detalhes', 'mensagem_erro', 'resposta_api')
    list_select_related = ('configuracao',)
    readonly_fields = ('configuracao', 'timestamp', 'etapa', 'status', 'detalhes', 'mensagem_erro', 'resposta_api')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

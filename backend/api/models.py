# backend/api/models.py

from django.db import models
from django.utils import timezone

class Clientes(models.Model):
    nome_cliente = models.CharField(max_length=255)
    email_contato = models.EmailField(unique=True)
    qnt_ipus_contratadas  = models.DecimalField(max_digits=10, decimal_places=4)
    preco_por_ipu = models.DecimalField(max_digits=10, decimal_places=4)
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome_cliente

    class Meta:
        db_table = 'api_clientes'
        verbose_name_plural = "Clientes"

class ConfiguracaoIDMC(models.Model):
    cliente = models.ForeignKey(Clientes, on_delete=models.CASCADE, related_name="configuracoes")
    apelido_configuracao = models.CharField(max_length=255)
    iics_pod_url = models.TextField()
    iics_username = models.TextField()
    iics_password = models.TextField()
    ultima_extracao_enddate = models.DateTimeField(null=True, blank=True, help_text="Marcador da última data final usada na extração")
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cliente.nome_cliente} - {self.apelido_configuracao}"

    class Meta:
        db_table = 'api_configuracaoidmc'
        verbose_name_plural = "Configurações IDMC"
        ordering = ['cliente', 'apelido_configuracao']

class ConsumoSummary(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE)
    data_extracao = models.DateTimeField()
    data_atualizacao = models.DateTimeField(auto_now=True)
    org_id = models.TextField(null=True, blank=True)
    meter_id = models.CharField(max_length=255, null=True, blank=True)
    meter_name = models.CharField(max_length=255, null=True, blank=True)
    consumption_date = models.DateTimeField(null=True, blank=True)
    billing_period_start_date = models.DateTimeField(null=True, blank=True)
    billing_period_end_date = models.DateTimeField(null=True, blank=True)
    meter_usage = models.DecimalField(max_digits=24, decimal_places=10, null=True, blank=True)
    consumption_ipu = models.DecimalField(max_digits=24, decimal_places=12, null=True, blank=True)
    scalar = models.CharField(max_length=100, null=True, blank=True)
    metric_category = models.CharField(max_length=255, null=True, blank=True)
    org_name = models.CharField(max_length=255, null=True, blank=True)
    org_type = models.CharField(max_length=100, null=True, blank=True)
    ipu_rate = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)

    class Meta:
        db_table = 'api_consumosummary'
        verbose_name_plural = "Consumos (Summary)"
        unique_together = ('configuracao', 'org_id', 'meter_id', 'consumption_date')

class ConsumoProjectFolder(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE)
    data_extracao = models.DateTimeField()
    data_atualizacao = models.DateTimeField(auto_now=True)
    consumption_date = models.DateTimeField(null=True, blank=True)
    project_name = models.TextField(null=True, blank=True)
    folder_path = models.TextField(null=True, blank=True)
    org_id = models.TextField(null=True, blank=True)
    org_type = models.CharField(max_length=100, null=True, blank=True)
    total_consumption_ipu = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)

    class Meta:
        db_table = 'api_consumoprojectfolder'
        verbose_name_plural = "Consumos (Project/Folder)"
        unique_together = ('configuracao', 'consumption_date', 'project_name', 'folder_path', 'org_id')

class ConsumoAsset(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE)
    data_extracao = models.DateTimeField()
    data_atualizacao = models.DateTimeField(auto_now=True)
    meter_id = models.CharField(max_length=255, null=True, blank=True)
    meter_name = models.CharField(max_length=255, null=True, blank=True)
    consumption_date = models.DateTimeField(null=True, blank=True)
    asset_name = models.TextField(null=True, blank=True)
    asset_type = models.CharField(max_length=255, null=True, blank=True)
    project_name = models.TextField(null=True, blank=True)
    folder_name = models.TextField(null=True, blank=True)
    org_id = models.TextField(null=True, blank=True)
    org_type = models.CharField(max_length=100, null=True, blank=True)
    runtime_environment = models.CharField(max_length=255, null=True, blank=True)
    environment_type = models.CharField(max_length=100, null=True, blank=True)
    tier = models.CharField(max_length=100, null=True, blank=True)
    ipu_per_unit = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    usage = models.DecimalField(max_digits=24, decimal_places=10, null=True, blank=True)
    consumption_ipu = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)

    class Meta:
        db_table = 'api_consumoasset'
        verbose_name_plural = "Consumos (Asset)"
        unique_together = ('configuracao', 'meter_id', 'consumption_date', 'asset_name', 'asset_type', 'project_name', 'folder_name', 'org_id', 'runtime_environment', 'tier', 'ipu_per_unit')

class ConsumoCdiJobExecucao(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE)
    data_extracao = models.DateTimeField()
    data_atualizacao = models.DateTimeField(auto_now=True)
    meter_id_ref = models.CharField(max_length=255, null=True, blank=True)
    task_id = models.TextField(null=True, blank=True)
    task_name = models.TextField(null=True, blank=True)
    task_object_name = models.TextField(null=True, blank=True)
    task_type = models.CharField(max_length=255, null=True, blank=True)
    task_run_id = models.TextField()
    project_name = models.TextField(null=True, blank=True)
    folder_name = models.TextField(null=True, blank=True)
    org_id = models.TextField(null=True, blank=True)
    environment_id = models.TextField(null=True, blank=True)
    environment_name = models.TextField(null=True, blank=True)
    cores_used = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=100, null=True, blank=True)
    metered_value_ipu = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    audit_time = models.DateTimeField(null=True, blank=True)
    obm_task_time_seconds = models.IntegerField(null=True, blank=True)
    meter_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'api_consumocdijobexecucao'
        verbose_name_plural = "Consumos (CDI Job)"
        unique_together = ('configuracao', 'task_id', 'task_run_id', 'org_id', 'environment_id', 'start_time', 'end_time')

class ConsumoCaiAssetSumario(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE)
    data_extracao = models.DateTimeField()
    data_atualizacao = models.DateTimeField(auto_now=True)
    org_id = models.TextField(null=True, blank=True)
    execution_type = models.CharField(max_length=255, null=True, blank=True)
    executed_asset = models.TextField(null=True, blank=True)
    execution_date = models.DateTimeField(null=True, blank=True)
    invoked_by = models.TextField(max_length=255, null=True, blank=True)
    execution_env = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=100, null=True, blank=True)
    execution_count = models.BigIntegerField(null=True, blank=True)
    total_execution_time_hours = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    avg_execution_time_seconds = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    meter_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'api_consumocaiassetsumario'
        verbose_name_plural = "Consumos (CAI Summary)"
        unique_together = ('configuracao', 'org_id', 'executed_asset', 'execution_date', 'execution_env', 'status', 'invoked_by')

class ExtracaoLog(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE, related_name="logs")
    timestamp = models.DateTimeField(auto_now_add=True)
    etapa = models.CharField(max_length=50, help_text="Ex: LOGIN, EXPORT_JOB, DOWNLOAD, LOAD_CSV")
    status = models.CharField(max_length=10, choices=[('SUCCESS', 'Success'), ('FAILED', 'Failed')])
    detalhes = models.TextField(null=True, blank=True, help_text="Detalhes como job_type, meter_id, etc.")
    mensagem_erro = models.TextField(null=True, blank=True)
    resposta_api = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.timestamp.strftime('%Y-%m-%d %H:%M')} - {self.configuracao.apelido_configuracao} - {self.etapa} - {self.status}"

    class Meta:
        db_table = 'api_extracaolog'
        verbose_name_plural = "Logs de Extração"
        ordering = ['-timestamp']

class CicloFaturamento(models.Model):
    configuracao = models.ForeignKey(ConfiguracaoIDMC, on_delete=models.CASCADE, related_name='ciclos_faturamento')
    ciclo_id = models.IntegerField()
    billing_period_start_date = models.DateField()
    billing_period_end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ciclo de Faturamento"
        verbose_name_plural = "Ciclos de Faturamento"
        unique_together = (('configuracao', 'ciclo_id'), ('configuracao', 'billing_period_start_date', 'billing_period_end_date'))
        ordering = ['configuracao', 'billing_period_start_date']

    def __str__(self):
        return f"{self.configuracao.apelido_configuracao} - Ciclo {self.ciclo_id} ({self.billing_period_start_date} a {self.billing_period_end_date})"



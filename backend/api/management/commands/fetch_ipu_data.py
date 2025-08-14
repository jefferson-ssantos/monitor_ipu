# -*- coding: utf-8 -*-
import requests
import time
import os
import zipfile
import csv
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from concurrent.futures import ThreadPoolExecutor

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction, connection, models
from django.utils import timezone
from django.utils.text import slugify

# Importando os modelos Django que criamos, incluindo o de Log
from api.models import (
    ConfiguracaoIDMC,
    ConsumoSummary,
    ConsumoProjectFolder,
    ConsumoAsset,
    ConsumoCdiJobExecucao,
    ConsumoCaiAssetSumario,
    ExtracaoLog
)

class InformaticaAPIClient:
    def __init__(self, iics_pod, username, password, command_instance, log_prefix=""):
        self.iics_pod = iics_pod
        self.username = username
        self.password = password
        self.session_id = None
        self.base_url = None
        self.session = requests.Session()
        self.command = command_instance
        self.log_prefix = log_prefix

    def login(self):
        login_url = f"{self.iics_pod}/saas/public/core/v3/login"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        payload = {"username": self.username, "password": self.password}
        self.command.stdout.write(f"{self.log_prefix} 1. Realizando login na API da Informatica...")
        try:
            response = self.session.post(login_url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            self.session_id = data.get("userInfo", {}).get("sessionId")
            products = data.get("products", [])
            if products:
                self.base_url = products[0].get("baseApiUrl")
            if not self.session_id or not self.base_url:
                raise ValueError("SessionId ou BaseURL não encontrados na resposta do login.")
            self.session.headers.update({
                "INFA-SESSION-ID": self.session_id,
                "Content-Type": "application/json",
                "Accept": "application/json"
            })
            self.command.stdout.write(self.command.style.SUCCESS(f"{self.log_prefix} Login realizado com sucesso!"))
            return True
        except requests.exceptions.RequestException as e:
            raise e

    def export_metering_data(self, start_date, end_date, job_type=None, meter_id=None):
        if not self.base_url:
            raise ValueError("BaseURL não está definida.")
        payload = {"startDate": start_date, "endDate": end_date, "callbackUrl": "https://MyExportJobStatus.com"}
        if meter_id:
            export_url = f"{self.base_url}/public/core/v3/license/metering/ExportServiceJobLevelMeteringData"
            payload["meterId"] = meter_id
            export_name = f"meterId_{meter_id}"
        elif job_type:
            export_url = f"{self.base_url}/public/core/v3/license/metering/ExportMeteringData"
            payload["jobType"] = job_type
            export_name = f"tipo '{job_type}'"
        else:
            raise ValueError("É necessário fornecer um job_type ou um meter_id.")
        
        self.command.stdout.write(f"{self.log_prefix} 2. Criando job de exportação para {export_name}...")
        response = self.session.post(export_url, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        job_id = data.get("jobId")
        if not job_id:
            raise ValueError(f"JobId não encontrado na resposta da API de exportação. Resposta: {data}")
        self.command.stdout.write(self.command.style.SUCCESS(f"{self.log_prefix} Job de exportação criado. JobId: {job_id}"))
        return job_id

    def check_job_status(self, job_id):
        if not self.base_url or not job_id: return "FAILED"
        status_url = f"{self.base_url}/public/core/v3/license/metering/ExportMeteringData/{job_id}"
        self.command.stdout.write(f"{self.log_prefix} 3. Verificando status do JobId {job_id}...")
        timeout_seconds, start_time = 600, time.time()
        final_status = "TIMEOUT"
        while time.time() - start_time < timeout_seconds:
            try:
                response = self.session.get(status_url, timeout=30)
                response.raise_for_status()
                data = response.json()
                status = data.get("status")
                self.command.stdout.write(f"{self.log_prefix}    - Status atual: {status}")
                if status == "SUCCESS":
                    self.command.stdout.write(self.command.style.SUCCESS(f"{self.log_prefix} Job concluído com sucesso!"))
                    final_status = "SUCCESS"
                    break
                if status in ["FAILED", "CANCELLED"]:
                    self.command.stderr.write(f"{self.log_prefix} Job falhou ou foi cancelado. Status: {status}")
                    final_status = status
                    break
                time.sleep(15)
            except requests.exceptions.RequestException as e:
                self.command.stderr.write(f"{self.log_prefix} Falha ao verificar status do job: {e}")
                final_status = "FAILED"
                break
        if final_status == "TIMEOUT":
            self.command.stderr.write(f"{self.log_prefix} Timeout: O job não foi concluído no tempo esperado.")
        return final_status

    def download_export_file(self, job_id, download_path):
        if not self.base_url or not job_id: return None
        download_url = f"{self.base_url}/public/core/v3/license/metering/ExportMeteringData/{job_id}/download"
        self.command.stdout.write(f"{self.log_prefix} 4. Realizando download do arquivo para o JobId {job_id}...")
        response = self.session.get(download_url, stream=True, timeout=300)
        response.raise_for_status()
        os.makedirs(os.path.dirname(download_path), exist_ok=True)
        with open(download_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        self.command.stdout.write(self.command.style.SUCCESS(f"{self.log_prefix} Download concluído: {download_path}"))
        return download_path

# --- Comando Django ---

class Command(BaseCommand):
    help = 'Executa a rotina para buscar e popular dados de consumo de IPU da Informatica.'

    def _clean_value(self, value):
        if value is None or value.strip().lower() in ['', 'null']:
            return None
        return value

    def _safe_cast(self, value, cast_type, default=None):
        cleaned_value = self._clean_value(value)
        if cleaned_value is None:
            return default
        try:
            if cast_type == Decimal: return Decimal(cleaned_value)
            if cast_type == int: return int(float(cleaned_value))
            if cast_type == datetime:
                dt_naive = None
                for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d'):
                    try:
                        dt_naive = datetime.strptime(cleaned_value, fmt)
                        break
                    except ValueError:
                        pass
                if dt_naive:
                    return timezone.make_aware(dt_naive, timezone.get_default_timezone())
                return default
            return cast_type(cleaned_value)
        except (ValueError, TypeError, InvalidOperation):
            return default

    def unzip_file(self, zip_path, extract_to_dir, export_suffix, file_prefix="", log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Descompactando {zip_path}...")
        try:
            os.makedirs(extract_to_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                try:
                    csv_filename_in_zip = next(name for name in zip_ref.namelist() if name.lower().endswith('.csv'))
                except StopIteration:
                    self.stderr.write(f"{log_prefix}    - Nenhum arquivo CSV encontrado no zip.")
                    return None
                original_csv_path = zip_ref.extract(csv_filename_in_zip, path=extract_to_dir)
            base_name = os.path.splitext(os.path.basename(original_csv_path))[0]
            clean_suffix = export_suffix.replace(' ', '_').replace("'", "")
            new_filename = f"{file_prefix}{base_name}_{clean_suffix}.csv"
            final_csv_path = os.path.join(extract_to_dir, new_filename)
            if os.path.exists(final_csv_path):
                os.remove(final_csv_path)
            os.rename(original_csv_path, final_csv_path)
            self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - Arquivo descompactado e salvo como: {final_csv_path}"))
            return final_csv_path
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Ocorreu um erro ao descompactar: {e}")
            return None
    
    # --- MÉTODOS PARA POPULAR CADA TABELA ---

    @transaction.atomic
    def load_summary_csv(self, csv_path, config, execution_timestamp, date_range, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoSummary' com: {csv_path}")
        try:
            deleted_count, _ = ConsumoSummary.objects.filter(configuracao=config, consumption_date__date__range=date_range).delete()
            self.stdout.write(f"{log_prefix}    - {deleted_count} registros antigos de SUMMARY deletados entre {date_range[0]} e {date_range[1]}.")

            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                rows_to_insert = [
                    ConsumoSummary(
                        configuracao=config, data_extracao=execution_timestamp,
                        org_id=self._clean_value(row.get('OrgId')), meter_id=self._clean_value(row.get('MeterId')),
                        consumption_date=self._safe_cast(row.get('Date'), datetime),
                        meter_name=self._clean_value(row.get('MeterName')),
                        billing_period_start_date=self._safe_cast(row.get('BillingPeriodStartDate'), datetime),
                        billing_period_end_date=self._safe_cast(row.get('BillingPeriodEndDate'), datetime),
                        meter_usage=self._safe_cast(row.get('MeterUsage'), Decimal),
                        consumption_ipu=self._safe_cast(row.get('IPU'), Decimal),
                        scalar=self._clean_value(row.get('Scalar')), metric_category=self._clean_value(row.get('MetricCategory')),
                        org_name=self._clean_value(row.get('OrgName')), org_type=self._clean_value(row.get('OrgType')),
                        ipu_rate=self._safe_cast(row.get('IPURate'), Decimal)
                    ) for row in reader
                ]
                ConsumoSummary.objects.bulk_create(rows_to_insert)
                self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - {len(rows_to_insert)} registros de SUMMARY inseridos."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"{log_prefix}    - Erro CRÍTICO ao processar o arquivo {csv_path}: {e}"))

    @transaction.atomic
    def load_project_folder_csv(self, csv_path, config, execution_timestamp, date_range, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoProjectFolder' com: {csv_path}")
        try:
            deleted_count, _ = ConsumoProjectFolder.objects.filter(configuracao=config, consumption_date__date__range=date_range).delete()
            self.stdout.write(f"{log_prefix}    - {deleted_count} registros antigos de PROJECT_FOLDER deletados entre {date_range[0]} e {date_range[1]}.")

            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                rows_to_insert = [
                    ConsumoProjectFolder(
                        configuracao=config, data_extracao=execution_timestamp,
                        consumption_date=self._safe_cast(row.get('Date'), datetime),
                        project_name=self._clean_value(row.get('Project')),
                        folder_path=self._clean_value(row.get('Folder')),
                        org_id=self._clean_value(row.get('Org ID')),
                        org_type=self._clean_value(row.get('Org Type')),
                        total_consumption_ipu=self._safe_cast(row.get('Consumption (IPUs)'), Decimal)
                    ) for row in reader
                ]
                ConsumoProjectFolder.objects.bulk_create(rows_to_insert)
                self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - {len(rows_to_insert)} registros de PROJECT_FOLDER inseridos."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"{log_prefix}    - Erro CRÍTICO ao processar o arquivo {csv_path}: {e}"))

    @transaction.atomic
    def load_asset_csv(self, csv_path, config, execution_timestamp, date_range, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoAsset' com: {csv_path}")
        try:
            deleted_count, _ = ConsumoAsset.objects.filter(configuracao=config, consumption_date__date__range=date_range).delete()
            self.stdout.write(f"{log_prefix}    - {deleted_count} registros antigos de ASSET deletados entre {date_range[0]} e {date_range[1]}.")

            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                rows_to_insert = [
                    ConsumoAsset(
                        configuracao=config, data_extracao=execution_timestamp,
                        meter_id=self._clean_value(row.get('Meter ID')),
                        meter_name=self._clean_value(row.get('Meter Name')),
                        consumption_date=self._safe_cast(row.get('Date'), datetime),
                        asset_name=self._clean_value(row.get('Asset Name')),
                        asset_type=self._clean_value(row.get('Asset Type')),
                        project_name=self._clean_value(row.get('Project')),
                        folder_name=self._clean_value(row.get('Folder')),
                        org_id=self._clean_value(row.get('Org ID')),
                        org_type=self._clean_value(row.get('Org Type')),
                        runtime_environment=self._clean_value(row.get('Environment Name')),
                        environment_type=self._clean_value(row.get('Environment Type')),
                        tier=self._clean_value(row.get('Tier')),
                        ipu_per_unit=self._safe_cast(row.get('IPU Per Unit'), Decimal),
                        usage=self._safe_cast(row.get('Usage'), Decimal),
                        consumption_ipu=self._safe_cast(row.get('Consumption (IPUs)'), Decimal)
                    ) for row in reader
                ]
                ConsumoAsset.objects.bulk_create(rows_to_insert)
                self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - {len(rows_to_insert)} registros de ASSET inseridos."))
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro ao processar CSV de Asset: {e}")
    
    @transaction.atomic
    def load_cdi_job_csv(self, csv_path, config, meter_id, execution_timestamp, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoCdiJobExecucao' com: {csv_path}")
        try:
            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                rows_to_insert = []
                keys_to_delete = {self._clean_value(row.get('Task Run ID')) for row in reader if self._clean_value(row.get('Task Run ID'))}
                infile.seek(0); next(reader) # Reset reader
                
                for row in reader:
                    rows_to_insert.append(ConsumoCdiJobExecucao(
                        configuracao=config, data_extracao=execution_timestamp,
                        task_run_id=self._clean_value(row.get('Task Run ID')),
                        meter_id_ref=meter_id, task_id=self._clean_value(row.get('Task ID')),
                        task_name=self._clean_value(row.get('Task Name')), task_object_name=self._clean_value(row.get('Task Object Name')),
                        task_type=self._clean_value(row.get('Task Type')), project_name=self._clean_value(row.get('Project Name')),
                        folder_name=self._clean_value(row.get('Folder Name')), org_id=self._clean_value(row.get('Org ID')),
                        environment_id=self._clean_value(row.get('Environment ID')), environment_name=self._clean_value(row.get('Environment')),
                        cores_used=self._safe_cast(row.get('Cores Used'), Decimal),
                        start_time=self._safe_cast(row.get('Start Time'), datetime),
                        end_time=self._safe_cast(row.get('End Time'), datetime),
                        status=self._clean_value(row.get('Status')),
                        metered_value_ipu=self._safe_cast(row.get('Metered Value'), Decimal),
                        audit_time=self._safe_cast(row.get('Audit Time'), datetime),
                        obm_task_time_seconds=self._safe_cast(row.get('OBM Task Time(s)'), int)
                    ))

                if keys_to_delete:
                    deleted_count, _ = ConsumoCdiJobExecucao.objects.filter(configuracao=config, task_run_id__in=keys_to_delete).delete()
                    self.stdout.write(f"{log_prefix}    - {deleted_count} registros antigos de CDI_JOB deletados.")
                
                ConsumoCdiJobExecucao.objects.bulk_create(rows_to_insert)
                self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - {len(rows_to_insert)} registros de CDI_JOB inseridos."))
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro ao processar CSV de Job (CDI): {e}")

    @transaction.atomic
    def load_cai_asset_summary_csv(self, csv_path, config, meter_id, execution_timestamp, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoCaiAssetSumario' com: {csv_path}")
        try:
            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                rows_to_insert = []
                dates_in_csv = set()

                for row in reader:
                    execution_date = self._safe_cast(row.get('Date (in UTC)'), datetime)
                    if execution_date:
                        dates_in_csv.add(execution_date.date())

                    rows_to_insert.append(ConsumoCaiAssetSumario(
                        configuracao=config, data_extracao=execution_timestamp,
                        org_id=self._clean_value(row.get('Org ID')),
                        executed_asset=self._clean_value(row.get('Executed asset')),
                        execution_date=execution_date,
                        execution_env=self._clean_value(row.get('Execution env')),
                        execution_type=self._clean_value(row.get('Execution type')),
                        invoked_by=self._clean_value(row.get('Invoked by')),
                        status=self._clean_value(row.get('status')),
                        execution_count=self._safe_cast(row.get('Execution count'), int),
                        total_execution_time_hours=self._safe_cast(row.get('Total Execution time (in hours)'), Decimal),
                        avg_execution_time_seconds=self._safe_cast(row.get('Average Execution time (in seconds)'), Decimal)
                    ))

                if dates_in_csv:
                    min_date, max_date = min(dates_in_csv), max(dates_in_csv)
                    deleted_count, _ = ConsumoCaiAssetSumario.objects.filter(
                        configuracao=config,
                        execution_date__date__range=(min_date, max_date)
                    ).delete()
                    self.stdout.write(f"{log_prefix}    - {deleted_count} registros antigos de CAI_SUMMARY deletados entre {min_date} e {max_date}.")

                ConsumoCaiAssetSumario.objects.bulk_create(rows_to_insert)
                self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - {len(rows_to_insert)} registros de CAI_SUMMARY inseridos."))
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro ao processar CSV de Job (CAI): {e}")

    def get_filtered_meters_from_csv(self, csv_path, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Lendo meters do arquivo: {csv_path}")
        allowed_meter_names = {
            "Application Integration", "Application Integration with Advanced Serverless",
            "Data Integration", "Data Integration with Advanced Serverless"
        }
        meters = {}
        try:
            with open(csv_path, mode='r', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                for row in reader:
                    meter_name = self._clean_value(row.get('Meter Name'))
                    meter_id = self._clean_value(row.get('Meter ID'))
                    if meter_name in allowed_meter_names and meter_id:
                        meters[meter_id] = meter_name
            self.stdout.write(f"{log_prefix}    - Encontrados {len(meters)} meters únicos após o filtro.")
            return meters
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro ao ler meters do CSV: {e}")
            return {}

    def run_export_flow(self, api_client, start_date, end_date, config, dirs, job_type=None, meter_id=None, file_prefix="", job_loader=None, log_prefix=""):
        export_name = job_type or f"meterId_{meter_id}"
        export_suffix = job_type or f"meterId_{meter_id}"
        self.stdout.write(f"\n{log_prefix} --- Iniciando fluxo de exportação para: {export_name} ---")
        
        job_id = None
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                job_id = api_client.export_metering_data(start_date=start_date, end_date=end_date, job_type=job_type, meter_id=meter_id)
                if job_id:
                    ExtracaoLog.objects.create(configuracao=config, etapa="EXPORT_JOB", status="SUCCESS", detalhes=f"Job para '{export_name}' criado com sucesso. ID: {job_id}")
                    break
            except requests.exceptions.RequestException as e:
                self.stderr.write(self.style.ERROR(f"{log_prefix} Tentativa {attempt} de {max_attempts} falhou ao criar job para '{export_name}': {e}"))
                if attempt == max_attempts:
                    ExtracaoLog.objects.create(configuracao=config, etapa="EXPORT_JOB", status="FAILED", detalhes=f"Falha ao criar job para '{export_name}' após {max_attempts} tentativas.", mensagem_erro=str(e), resposta_api=e.response.text if e.response else None)
                    return None
                time.sleep(10)
        
        if job_id:
            final_status = api_client.check_job_status(job_id)
            ExtracaoLog.objects.create(configuracao=config, etapa="CHECK_STATUS", status=final_status, detalhes=f"Status final do job '{export_name}' (ID: {job_id}) foi {final_status}.")
            
            if final_status == "SUCCESS":
                try:
                    download_filename = f"export_{export_name.lower().replace(' ', '_')}_{job_id}.zip"
                    download_path = os.path.join(dirs['downloads'], download_filename)
                    zip_path = api_client.download_export_file(job_id, download_path)
                    if zip_path:
                        extract_dir = dirs['arquivos']
                        csv_path = self.unzip_file(zip_path, extract_dir, export_suffix, file_prefix, log_prefix)
                        if csv_path:
                            execution_timestamp = timezone.now()
                            date_range_for_delete = (start_date.split('T')[0], end_date.split('T')[0])
                            
                            if job_type == "SUMMARY": self.load_summary_csv(csv_path, config, execution_timestamp, date_range_for_delete, log_prefix)
                            elif job_type == "PROJECT_FOLDER": self.load_project_folder_csv(csv_path, config, execution_timestamp, date_range_for_delete, log_prefix)
                            elif job_type == "ASSET":
                                self.load_asset_csv(csv_path, config, execution_timestamp, date_range_for_delete, log_prefix)
                                return csv_path
                            elif meter_id and job_loader:
                                job_loader(csv_path, config, meter_id, execution_timestamp, log_prefix)
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"{log_prefix}    - Erro CRÍTICO ao popular dados: {e}"))
                    ExtracaoLog.objects.create(configuracao=config, etapa="LOAD_CSV", status="FAILED", detalhes=f"Falha ao carregar dados para '{export_name}'", mensagem_erro=str(e))
        return None

    def run_summary_asset_jobs_flow(self, api_client, start_date_str, end_date_str, config, dirs, log_prefix):
        self.run_export_flow(api_client, start_date_str, end_date_str, config, dirs, job_type="SUMMARY", log_prefix=log_prefix)
        asset_csv_path = self.run_export_flow(api_client, start_date_str, end_date_str, config, dirs, job_type="ASSET", log_prefix=log_prefix)

        if asset_csv_path:
            asset_basename = os.path.splitext(os.path.basename(asset_csv_path))[0]
            asset_prefix = asset_basename.removesuffix('_ASSET') + '_'
            cdi_meter_id = "a2nB20h1o0lc7k3P9xtWS8"
            cai_meter_ids = {"bN6mes5n4GGciiMkuoDlCz", "3uIRkIV5Rt9lBbAPzeR5Kj"}
            
            meters = self.get_filtered_meters_from_csv(asset_csv_path, log_prefix)
            
            if not meters:
                self.stdout.write(f"{log_prefix} Nenhum meter encontrado no arquivo de Asset para processar.")
            else:
                self.stdout.write(f"\n{log_prefix} Iniciando extração para {len(meters)} meters encontrados...")
                for meter_id, meter_name in meters.items():
                    job_loader_func = None
                    if meter_id == cdi_meter_id:
                        job_loader_func = self.load_cdi_job_csv
                    elif meter_id in cai_meter_ids:
                        job_loader_func = self.load_cai_asset_summary_csv
                    
                    if job_loader_func:
                        self.run_export_flow(
                            api_client, start_date_str, end_date_str, config, dirs,
                            meter_id=meter_id, file_prefix=asset_prefix, job_loader=job_loader_func, log_prefix=log_prefix
                        )
                    else:
                        self.stdout.write(self.style.WARNING(f"{log_prefix}    - Meter ID {meter_id} ({meter_name}) não possui um loader definido. Pulando."))
        else:
            self.stderr.write(self.style.ERROR(f"{log_prefix} Arquivo de ASSET não foi gerado pela API. Fluxo de jobs (CDI/CAI) não pode continuar."))
            ExtracaoLog.objects.create(configuracao=config, etapa="EXPORT_JOB", status="FAILED", detalhes="Falha ao gerar arquivo de ASSET.")

    def processar_configuracao(self, config):
        log_prefix = f"[{config.apelido_configuracao} | {config.cliente.nome_cliente}]"
        self.stdout.write(f"\n>> Processando: {log_prefix}")
        
        cliente_slug = slugify(config.cliente.nome_cliente)
        config_slug = slugify(config.apelido_configuracao)
        
        dirs = {
            "downloads": os.path.join(settings.BASE_DIR, 'downloads', cliente_slug, config_slug),
            "arquivos": os.path.join(settings.BASE_DIR, 'arquivos', cliente_slug, config_slug)
        }

        try:
            api_client = InformaticaAPIClient(config.iics_pod_url, config.iics_username, config.iics_password, self, log_prefix)
            if not api_client.login():
                return
            ExtracaoLog.objects.create(configuracao=config, etapa="LOGIN", status="SUCCESS")
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"{log_prefix} Processo abortado devido a falha no login: {e}"))
            ExtracaoLog.objects.create(configuracao=config, etapa="LOGIN", status="FAILED", mensagem_erro=str(e), resposta_api=e.response.text if hasattr(e, 'response') and e.response else None)
            return

        if config.ultima_extracao_enddate:
            start_date_obj = config.ultima_extracao_enddate
        else:
            start_date_obj = timezone.now() - timedelta(days=30)
        
        end_date_obj_for_api = timezone.now()
        end_date_to_save = timezone.localtime(end_date_obj_for_api).replace(hour=0, minute=0, second=0, microsecond=0)
        
        start_date_str = start_date_obj.strftime("%Y-%m-%dT00:00:00Z")
        end_date_str = end_date_obj_for_api.strftime("%Y-%m-%dT23:59:59Z")
        self.stdout.write(f"{log_prefix} Período de extração: {start_date_str} a {end_date_str}")
        
        try:
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix=f"{log_prefix}_sub") as sub_executor:
                future_asset_chain = sub_executor.submit(self.run_summary_asset_jobs_flow, api_client, start_date_str, end_date_str, config, dirs, log_prefix)
                future_project = sub_executor.submit(self.run_export_flow, api_client, start_date_str, end_date_str, config, dirs, job_type="PROJECT_FOLDER", log_prefix=log_prefix)
                
                future_asset_chain.result()
                future_project.result()

            config.ultima_extracao_enddate = end_date_to_save
            config.save()
            self.stdout.write(self.style.SUCCESS(f"{log_prefix} Marcador 'ultima_extracao_enddate' atualizado para {end_date_to_save}"))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"{log_prefix} Ocorreu um erro inesperado durante o fluxo: {e}"))
            ExtracaoLog.objects.create(configuracao=config, etapa="FLUXO_GERAL", status="FAILED", mensagem_erro=str(e))
        finally:
            connection.close()

    def limpar_arquivos_antigos(self):
        self.stdout.write(self.style.SUCCESS("--- Limpando arquivos de execuções anteriores ---"))
        base_dirs = [
            os.path.join(settings.BASE_DIR, 'downloads'),
            os.path.join(settings.BASE_DIR, 'arquivos')
        ]
        for base_dir in base_dirs:
            if os.path.exists(base_dir):
                for root, dirs, files in os.walk(base_dir):
                    for filename in files:
                        if filename.lower().endswith(('.zip', '.csv')):
                            file_path = os.path.join(root, filename)
                            try:
                                os.unlink(file_path)
                                self.stdout.write(f"Deletado: {file_path}")
                            except Exception as e:
                                self.stderr.write(f"Falha ao deletar {file_path}. Razão: {e}")
        self.stdout.write(self.style.SUCCESS("--- Limpeza concluída ---"))

    def handle(self, *args, **options):
        start_time = time.monotonic()
        self.stdout.write(self.style.SUCCESS("==== INICIANDO ROTINA DE EXTRAÇÃO DE CONSUMO IICS ===="))
        
        self.limpar_arquivos_antigos()

        configs_para_processar = list(ConfiguracaoIDMC.objects.filter(ativo=True))
        
        if not configs_para_processar:
            self.stdout.write(self.style.WARNING("Nenhuma configuração ativa encontrada no banco de dados. Saindo."))
            return

        MAX_WORKERS = 5
        self.stdout.write(f"Encontradas {len(configs_para_processar)} configurações para processar. Iniciando com até {MAX_WORKERS} workers paralelos.")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            executor.map(self.processar_configuracao, configs_para_processar)

        end_time = time.monotonic()
        duration = timedelta(seconds=end_time - start_time)
        self.stdout.write(self.style.SUCCESS(f"\n==== ROTINA DE EXTRAÇÃO FINALIZADA EM {duration} ===="))

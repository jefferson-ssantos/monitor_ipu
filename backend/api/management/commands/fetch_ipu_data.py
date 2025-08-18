# backend/api/management/commands/fetch_ipu_data.py

import os
import requests
import time
import zipfile
import csv
import pandas as pd
from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import ConfiguracaoIDMC, ConsumoSummary, ConsumoProjectFolder, ConsumoAsset, ConsumoCdiJobExecucao, ConsumoCaiAssetSumario, MarcadorExtracao

# Funções auxiliares movidas para o topo para melhor organização
def get_session_id(config, log_prefix=""):
    """Realiza login na API da Informatica e retorna o sessionId."""
    url = f"{config.base_url}/saas/public/core/v3/login"
    payload = {
        "username": config.username,
        "password": config.get_password()
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json().get("userInfo", {}).get("sessionId")
    except requests.exceptions.RequestException as e:
        print(f"{log_prefix}Erro no login: {e}")
        return None

class Command(BaseCommand):
    help = 'Extrai dados de consumo de IPU da API da Informatica Cloud.'

    # --- MÉTODOS DE LIMPEZA E CASTING ---
    def _safe_cast(self, value, cast_type, default=None):
        if value in (None, ''):
            return default
        try:
            if cast_type == datetime:
                return pd.to_datetime(value).replace(tzinfo=timezone.utc)
            return cast_type(value)
        except (ValueError, TypeError):
            return default

    def _clean_value(self, value):
        return value.strip() if isinstance(value, str) else value

    # --- MÉTODOS DE MANIPULAÇÃO DE ARQUIVOS ---
    def clean_old_files(self, config, log_prefix=""):
        self.stdout.write(f"{log_prefix}Limpando arquivos antigos para a configuração '{config.name}'...")
        base_dir = '/app/arquivos'
        org_path = os.path.join(base_dir, config.cliente.lower(), config.slug)
        download_path = os.path.join('/app/downloads', config.cliente.lower(), config.slug)

        for path in [org_path, download_path]:
            os.makedirs(path, exist_ok=True)
            for f in os.listdir(path):
                os.remove(os.path.join(path, f))
        self.stdout.write(f"{log_prefix}Limpeza da configuração concluída.")
    
    def unzip_file(self, zip_path, extract_to_dir, export_suffix, file_prefix="", log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Descompactando {zip_path}...")
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                try:
                    csv_filename_in_zip = next(name for name in zip_ref.namelist() if name.lower().endswith('.csv'))
                except StopIteration:
                    self.stderr.write(f"{log_prefix}    - Nenhum arquivo CSV encontrado no zip.")
                    return None

                original_csv_path = zip_ref.extract(csv_filename_in_zip, path=extract_to_dir)

            base_name = os.path.splitext(os.path.basename(original_csv_path))[0]
            clean_suffix = export_suffix.replace(' ', '_').replace("'", "")
            timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S%f")
            new_filename = f"{file_prefix}{base_name}_{clean_suffix}_{timestamp_str}.csv"
            final_csv_path = os.path.join(extract_to_dir, new_filename)

            if os.path.exists(final_csv_path):
                os.remove(final_csv_path)
            os.rename(original_csv_path, final_csv_path)

            self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - Arquivo descompactado e salvo como: {final_csv_path}"))
            return final_csv_path
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Ocorreu um erro ao descompactar: {e}")
            return None

    # --- MÉTODOS DE CARGA DE DADOS (CSV) ---
    def load_generic_csv(self, csv_path, model_class, field_mapping, config, start_date_obj, end_date_obj, date_fields, log_prefix=""):
        model_name = model_class._meta.verbose_name_plural.split('(')[-1].split(')')[0]
        self.stdout.write(f"{log_prefix}    - Populando tabela '{model_class._meta.model_name}' com: {csv_path}")

        delete_filter = {'configuracao': config}
        if date_fields:
            # Garante que os objetos de data não tenham informação de fuso horário para a deleção
            start_date_naive = start_date_obj.replace(tzinfo=None)
            end_date_naive = end_date_obj.replace(tzinfo=None)
            delete_filter[f'{date_fields[0]}__gte'] = start_date_naive
            delete_filter[f'{date_fields[1]}__lte'] = end_date_naive

        with transaction.atomic():
            try:
                deleted_count, _ = model_class.objects.filter(**delete_filter).delete()
                self.stdout.write(self.style.WARNING(f"{log_prefix}    - {deleted_count} registros antigos de {model_name} deletados."))

                with open(csv_path, mode='r', encoding='utf-8') as csvfile:
                    reader = csv.DictReader(csvfile)
                    batch = []
                    for row in reader:
                        instance_data = {'configuracao': config}
                        for model_field, csv_header in field_mapping.items():
                            raw_value = row.get(csv_header)
                            field_obj = model_class._meta.get_field(model_field)
                            
                            if field_obj.get_internal_type() in ['DateTimeField', 'DateField']:
                                instance_data[model_field] = self._safe_cast(raw_value, datetime)
                            elif field_obj.get_internal_type() in ['FloatField', 'DecimalField']:
                                instance_data[model_field] = self._safe_cast(raw_value, float)
                            elif field_obj.get_internal_type() in ['IntegerField', 'BigAutoField']:
                                instance_data[model_field] = self._safe_cast(raw_value, int)
                            else:
                                instance_data[model_field] = self._clean_value(raw_value)
                        batch.append(model_class(**instance_data))
                    
                    model_class.objects.bulk_create(batch)
            except Exception as e:
                self.stderr.write(f"{log_prefix}    - Erro CRÍTICO ao popular dados: {e}")
                raise

    def load_cai_asset_summary_csv(self, csv_path, config, meter_id, execution_timestamp, start_date_obj, end_date_obj, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoCaiAssetSumario' com: {csv_path}")
        delete_filter = {
            'configuracao': config,
            'execution_date__gte': start_date_obj,
            'execution_date__lte': end_date_obj
        }
        try:
            with transaction.atomic():
                deleted_count, _ = ConsumoCaiAssetSumario.objects.filter(**delete_filter).delete()
                self.stdout.write(self.style.WARNING(f"{log_prefix}    - {deleted_count} registros antigos de CAI ASSET SUMMARY deletados."))

                with open(csv_path, mode='r', encoding='utf-8') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for i, row in enumerate(reader):
                        lookup_params = {
                            'configuracao': config,
                            'org_id': self._clean_value(row.get('Org ID')),
                            'executed_asset': self._clean_value(row.get('Executed asset')),
                            'execution_date': self._safe_cast(row.get('Date (in UTC)'), datetime),
                            'execution_env': self._clean_value(row.get('Execution env')),
                            'status': self._clean_value(row.get('status')),
                            'invoked_by': self._clean_value(row.get('Invoked by'))
                        }
                        update_values = {
                            'meter_id': meter_id,
                            'iics_customer_id': self._clean_value(row.get('IICS Customer ID')),
                            'parent_org_id': self._clean_value(row.get('Parent Org ID')),
                            'ipu': self._safe_cast(row.get('IPU'), float),
                            'unit': self._clean_value(row.get('Unit')),
                            'invoked_by': self._clean_value(row.get('Invoked by'))
                        }
                        
                        try:
                            obj, created = ConsumoCaiAssetSumario.objects.get_or_create(
                                **lookup_params,
                                defaults=update_values
                            )
                            if not created:
                                for key, value in update_values.items():
                                    setattr(obj, key, value)
                                obj.save()
                        except Exception as e:
                            self.stderr.write(f"{log_prefix}    - Erro ao processar CSV de Job (CAI): {e}")
                            raise
            self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - Dados de JOB (CAI) para o meter {meter_id} populados com sucesso."))
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro CRÍTICO ao popular dados: {e}")

    def load_cdi_job_execucao_csv(self, csv_path, config, meter_id, execution_timestamp, start_date_obj, end_date_obj, log_prefix=""):
        self.stdout.write(f"{log_prefix}    - Populando tabela 'ConsumoCdiJobExecucao' com: {csv_path}")
        delete_filter = {
            'configuracao': config,
            'start_time__gte': start_date_obj,
            'end_time__lte': end_date_obj
        }

        try:
            with transaction.atomic():
                deleted_count, _ = ConsumoCdiJobExecucao.objects.filter(**delete_filter).delete()
                self.stdout.write(self.style.WARNING(f"{log_prefix}    - {deleted_count} registros antigos de CDI JOB deletados."))

                field_mapping = {
                    'meter_id': 'Meter ID', 'iics_customer_id': 'IICS Customer ID', 'parent_org_id': 'Parent Org ID',
                    'org_id': 'Org ID', 'job_name': 'Job Name', 'job_id': 'Job ID', 'job_type': 'Job Type',
                    'start_time': 'Start Time (in UTC)', 'end_time': 'End Time (in UTC)',
                    'source_rows': 'Source Rows', 'target_rows': 'Target Rows', 'error_rows': 'Error Rows'
                }

                with open(csv_path, mode='r', encoding='utf-8') as csvfile:
                    reader = csv.DictReader(csvfile)
                    batch = []
                    for row in reader:
                        instance_data = {'configuracao': config}
                        for model_field, csv_header in field_mapping.items():
                            raw_value = row.get(csv_header)
                            if model_field in ['start_time', 'end_time']:
                                instance_data[model_field] = self._safe_cast(raw_value, datetime)
                            elif model_field in ['source_rows', 'target_rows', 'error_rows']:
                                instance_data[model_field] = self._safe_cast(raw_value, int)
                            else:
                                instance_data[model_field] = self._clean_value(raw_value)
                        batch.append(ConsumoCdiJobExecucao(**instance_data))
                    
                    ConsumoCdiJobExecucao.objects.bulk_create(batch)
            
            self.stdout.write(self.style.SUCCESS(f"{log_prefix}    - Dados de JOB (CDI) para o meter {meter_id} populados com sucesso."))
        except Exception as e:
            self.stderr.write(f"{log_prefix}    - Erro CRÍTICO ao popular dados: {e}")

    # --- MÉTODOS DE CONTROLE DE FLUXO E API ---
    def get_extraction_dates(self, config):
        try:
            marcador = MarcadorExtracao.objects.get(configuracao=config)
            start_date = marcador.ultima_extracao_enddate.strftime('%Y-%m-%dT00:00:00Z')
        except MarcadorExtracao.DoesNotExist:
            start_date = (datetime.now() - timedelta(days=config.dias_iniciais)).strftime('%Y-%m-%dT00:00:00Z')
        
        end_date = (datetime.now() + timedelta(days=config.dias_a_frente)).strftime('%Y-%m-%dT23:59:59Z')
        return start_date, end_date
    
    def run_export_flow(self, config, export_type, start_date, end_date, log_prefix=""):
        self.stdout.write(f"\n{log_prefix}--- Iniciando fluxo de exportação para: {export_type} ---")
        session_id = get_session_id(config, log_prefix)
        if not session_id:
            return None

        job_id = self.create_export_job(session_id, config, export_type, start_date, end_date, log_prefix)
        if not job_id:
            return None

        job_status = self.wait_for_job_completion(session_id, config, job_id, log_prefix)
        if job_status != 'SUCCESS':
            return None

        downloaded_file = self.download_export_file(session_id, config, job_id, export_type, log_prefix)
        if not downloaded_file:
            return None

        file_prefix = f"{config.org_id}_"
        extract_to_dir = os.path.join('/app/arquivos', config.cliente.lower(), config.slug)
        csv_path = self.unzip_file(downloaded_file, extract_to_dir, export_type, file_prefix, log_prefix)
        
        if csv_path:
            self.process_csv_data(csv_path, config, export_type, start_date, end_date, log_prefix)
            self.stdout.write(f"{log_prefix}    - Processamento do arquivo {export_type} concluído.")
        
        return csv_path

    def run_meter_export_flow(self, config, meter_id, start_date, end_date, log_prefix=""):
        self.stdout.write(f"\n{log_prefix}--- Iniciando fluxo de exportação para: meterId_{meter_id} ---")
        session_id = get_session_id(config, log_prefix)
        if not session_id:
            return

        job_id = self.create_export_job(session_id, config, 'METER_DETAIL', start_date, end_date, log_prefix, meter_id=meter_id)
        if not job_id:
            return

        job_status = self.wait_for_job_completion(session_id, config, job_id, log_prefix)
        if job_status != 'SUCCESS':
            return

        downloaded_file = self.download_export_file(session_id, config, job_id, 'METER_DETAIL', log_prefix, meter_id=meter_id)
        if not downloaded_file:
            return
        
        file_prefix = f"{config.org_id}_"
        extract_to_dir = os.path.join('/app/arquivos', config.cliente.lower(), config.slug)
        csv_path = self.unzip_file(downloaded_file, extract_to_dir, f"DetailedReport_meterId_{meter_id}", file_prefix, log_prefix)

        if csv_path:
            start_date_obj = self._safe_cast(start_date, datetime)
            end_date_obj = self._safe_cast(end_date, datetime)
            execution_timestamp = datetime.now()
            
            if "CDIMeteringAuditData" in os.path.basename(csv_path):
                self.load_cdi_job_execucao_csv(csv_path, config, meter_id, execution_timestamp, start_date_obj, end_date_obj, log_prefix)
            else:
                self.load_cai_asset_summary_csv(csv_path, config, meter_id, execution_timestamp, start_date_obj, end_date_obj, log_prefix)

    def create_export_job(self, session_id, config, export_type, start_date, end_date, log_prefix, meter_id=None):
        self.stdout.write(f"{log_prefix}2. Criando job de exportação para tipo '{export_type if export_type != 'METER_DETAIL' else f'meterId_{meter_id}'}'...")
        url = f"{config.base_url}/saas/public/core/v3/export"
        payload = {
            "name": f"Export_{export_type}_{config.org_id}",
            "format": "CSV",
            "timePeriod": {
                "startDate": start_date,
                "endDate": end_date
            }
        }
        if export_type == 'METER_DETAIL':
            payload["filters"] = {"meterId": meter_id}
            payload["type"] = "METERING_DATA_DETAIL"
        else:
            payload["type"] = export_type

        headers = {"Content-Type": "application/json", "Accept": "application/json", "IDS-SESSION-ID": session_id}
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            job_id = response.json().get("jobId")
            self.stdout.write(f"{log_prefix}Job de exportação criado. JobId: {job_id}")
            return job_id
        except requests.exceptions.RequestException as e:
            self.stderr.write(f"{log_prefix}Erro ao criar job de exportação: {e.text}")
            return None

    def wait_for_job_completion(self, session_id, config, job_id, log_prefix):
        self.stdout.write(f"{log_prefix}3. Verificando status do JobId {job_id}...")
        url = f"{config.base_url}/saas/public/core/v3/export/{job_id}"
        headers = {"Accept": "application/json", "IDS-SESSION-ID": session_id}
        
        while True:
            try:
                response = requests.get(url, headers=headers)
                response.raise_for_status()
                status = response.json().get("status")
                self.stdout.write(f"{log_prefix}    - Status atual: {status}")
                if status in ['SUCCESS', 'FAILED', 'WARNING']:
                    if status == 'SUCCESS':
                        self.stdout.write(self.style.SUCCESS(f"{log_prefix}Job concluído com sucesso!"))
                    else:
                        self.stderr.write(f"{log_prefix}Job concluído com status: {status}")
                    return status
                time.sleep(10)
            except requests.exceptions.RequestException as e:
                self.stderr.write(f"{log_prefix}Erro ao verificar status do job: {e}")
                return 'FAILED'

    def download_export_file(self, session_id, config, job_id, export_type, log_prefix, meter_id=None):
        self.stdout.write(f"{log_prefix}4. Realizando download do arquivo para o JobId {job_id}...")
        url = f"{config.base_url}/saas/public/core/v3/export/{job_id}/download"
        headers = {"Accept": "application/zip", "IDS-SESSION-ID": session_id}
        
        download_dir = os.path.join('/app/downloads', config.cliente.lower(), config.slug)
        os.makedirs(download_dir, exist_ok=True)
        
        filename_part = f"meterid_{meter_id.lower()}" if meter_id else export_type.lower()
        file_path = os.path.join(download_dir, f"export_{filename_part}_{job_id}.zip")

        try:
            with requests.get(url, headers=headers, stream=True) as r:
                r.raise_for_status()
                with open(file_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            self.stdout.write(self.style.SUCCESS(f"{log_prefix}Download concluído: {file_path}"))
            return file_path
        except requests.exceptions.RequestException as e:
            self.stderr.write(f"{log_prefix}Erro ao baixar o arquivo: {e}")
            return None

    def process_csv_data(self, csv_path, config, export_type, start_date, end_date, log_prefix):
        start_date_obj = self._safe_cast(start_date, datetime)
        end_date_obj = self._safe_cast(end_date, datetime)
        
        model_map = {
            'SUMMARY': (ConsumoSummary, {
                'consumption_date': 'Consumption Date (in UTC)', 'org_id': 'Org ID', 'org_name': 'Org Name',
                'service': 'Service', 'sub_service': 'Sub-Service', 'ipu': 'IPU', 'unit': 'Unit'
            }, ['consumption_date', 'consumption_date']),
            'PROJECT_FOLDER': (ConsumoProjectFolder, {
                'consumption_date': 'Consumption Date (in UTC)', 'org_id': 'Org ID', 'org_name': 'Org Name',
                'project_folder_name': 'Project/Folder Name', 'service': 'Service', 'sub_service': 'Sub-Service',
                'ipu': 'IPU', 'unit': 'Unit'
            }, ['consumption_date', 'consumption_date']),
            'ASSET': (ConsumoAsset, {
                'consumption_date': 'Consumption Date (in UTC)', 'org_id': 'Org ID', 'org_name': 'Org Name',
                'asset_name': 'Asset Name', 'asset_id': 'Asset ID', 'asset_type': 'Asset Type',
                'service': 'Service', 'sub_service': 'Sub-Service', 'ipu': 'IPU', 'unit': 'Unit'
            }, ['consumption_date', 'consumption_date'])
        }

        if export_type in model_map:
            model_class, field_mapping, date_fields = model_map[export_type]
            self.load_generic_csv(csv_path, model_class, field_mapping, config, start_date_obj, end_date_obj, date_fields, log_prefix)
        else:
            self.stderr.write(f"{log_prefix}Tipo de exportação '{export_type}' não mapeado para processamento de CSV.")

    def _process_chunk(self, config, chunk_start_date, chunk_end_date, log_prefix):
        """
        Processa um único período de datas (chunk) para uma configuração.
        """
        self.stdout.write(f"\n{log_prefix}--- Processando período de {chunk_start_date.strftime('%Y-%m-%d')} a {chunk_end_date.strftime('%Y-%m-%d')} ---")

        start_date_str = chunk_start_date.strftime('%Y-%m-%dT00:00:00Z')
        end_date_str = chunk_end_date.strftime('%Y-%m-%dT23:59:59Z')

        # --- FLUXO DE EXPORTAÇÃO SEQUENCIAL ---
        self.run_export_flow(config, 'SUMMARY', start_date_str, end_date_str, log_prefix)
        self.run_export_flow(config, 'PROJECT_FOLDER', start_date_str, end_date_str, log_prefix)
        asset_csv_path = self.run_export_flow(config, 'ASSET', start_date_str, end_date_str, log_prefix)
        
        if asset_csv_path:
            self.stdout.write(f"{log_prefix}    - Lendo meters do arquivo: {asset_csv_path}")
            try:
                df = pd.read_csv(asset_csv_path)
                df_filtered = df[df['Sub-Service'].str.contains('CAI|CDI', na=False)]
                unique_meters = df_filtered['Meter ID'].unique().tolist()
                self.stdout.write(f"{log_prefix}    - Encontrados {len(unique_meters)} meters únicos após o filtro.")
                
                if unique_meters:
                    self.stdout.write(f"\n{log_prefix}Iniciando extração detalhada para {len(unique_meters)} meters encontrados...")
                    for meter_id in unique_meters:
                        self.run_meter_export_flow(config, meter_id, start_date_str, end_date_str, log_prefix)
                else:
                    self.stdout.write(f"{log_prefix}    - Nenhum meter novo encontrado para extração detalhada.")

            except Exception as e:
                self.stderr.write(f"{log_prefix}    - Erro ao ler o arquivo de assets ou extrair meters: {e}")

    def process_configuration(self, config):
        start_time = time.time()
        log_prefix = f"[{config.name} | {config.cliente}] "
        self.stdout.write(f"\n>> Processando: [{config.name} | {config.cliente}]")

        self.clean_old_files(config, log_prefix)
        
        overall_start_date_str, overall_end_date_str = self.get_extraction_dates(config)
        self.stdout.write(f"{log_prefix}Período de extração total: {overall_start_date_str} a {overall_end_date_str}")

        overall_start_date = datetime.strptime(overall_start_date_str, '%Y-%m-%dT%H:%M:%SZ')
        overall_end_date = datetime.strptime(overall_end_date_str, '%Y-%m-%dT%H:%M:%SZ')

        current_start_date = overall_start_date
        while current_start_date <= overall_end_date:
            chunk_end_date = current_start_date + timedelta(days=29)
            if chunk_end_date > overall_end_date:
                chunk_end_date = overall_end_date

            self._process_chunk(config, current_start_date, chunk_end_date, log_prefix)
            
            current_start_date += timedelta(days=30)

        # --- ATUALIZAÇÃO DO MARCADOR ---
        marcador, _ = MarcadorExtracao.objects.get_or_create(configuracao=config)
        # O próximo início será 1 dia após o fim do período total que acabamos de processar
        marcador.ultima_extracao_enddate = overall_end_date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        marcador.save()
        self.stdout.write(self.style.SUCCESS(f"{log_prefix}Marcador 'ultima_extracao_enddate' atualizado para {marcador.ultima_extracao_enddate.strftime('%Y-%m-%d')}"))
        
        end_time = time.time()
        self.stdout.write(f"{log_prefix}Processo concluído em {timedelta(seconds=end_time - start_time)}")
        
    def handle(self, *args, **options):
        self.stdout.write("==== INICIANDO ROTINA DE EXTRAÇÃO DE CONSUMO IICS ====")
        configurations = list(ConfiguracaoIDMC.objects.filter(ativo=True))
        
        if not configurations:
            self.stdout.write("Nenhuma configuração ativa encontrada para processar.")
            return
            
        self.stdout.write(f"Encontradas {len(configurations)} configurações para processar. Iniciando de forma sequencial.")

        for config in configurations:
            try:
                self.process_configuration(config)
            except Exception as e:
                import traceback
                self.stderr.write(f"Erro CRÍTICO no processamento da configuração '{config.name}': {e}\n{traceback.format_exc()}")

        self.stdout.write("\n==== ROTINA DE EXTRAÇÃO FINALIZADA ====")
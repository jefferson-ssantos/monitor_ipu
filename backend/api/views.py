import json
import threading
from django.core.management import call_command
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

def run_extraction_command(cliente_id):
    try:
        print(f"Iniciando extração em background para Cliente ID: {cliente_id}")
        call_command('fetch_ipu_data', cliente_id=cliente_id)
        print(f"Extração em background finalizada para Cliente ID: {cliente_id}")
    except Exception as e:
        print(f"Erro na extração em background: {e}")

@csrf_exempt
def trigger_extraction(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            cliente_id = data.get('cliente_id')
            
            if not cliente_id:
                return JsonResponse({'error': 'cliente_id is required'}, status=400)

            # Iniciar command em uma thread separada para não bloquear a resposta
            thread = threading.Thread(target=run_extraction_command, args=(cliente_id,))
            thread.daemon = True
            thread.start()

            return JsonResponse({'message': 'Extraction triggered successfully', 'cliente_id': cliente_id})
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Method not allowed'}, status=405)

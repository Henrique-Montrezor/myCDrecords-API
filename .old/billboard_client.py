import os
import requests
from datetime import datetime

BILLBOARD_API_URL = 'https://billboard-api2.p.rapidapi.com/catalog-albums'
BILLBOARD_API_HOST = 'billboard-api2.p.rapidapi.com'
BILLBOARD_API_KEY = os.environ.get('BILLBOARD_API_KEY')


def get_billboard_albums(date=None, range_str='1-10'):
    """
    Busca álbuns mais ouvidos da Billboard para uma data específica (YYYY-MM-DD) e range (ex: '1-10').
    """
    if not BILLBOARD_API_KEY:
        raise RuntimeError('BILLBOARD_API_KEY não configurada no ambiente')
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
    url = BILLBOARD_API_URL
    headers = {
        'x-rapidapi-host': BILLBOARD_API_HOST,
        'x-rapidapi-key': BILLBOARD_API_KEY
    }
    params = {
        'date': date,
        'range': range_str
    }
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get('content', [])

import aiohttp
import aiofiles
import asyncio
import json
import os
from aiohttp import web

app = web.Application()

async def read_json_file(file_path):
    try:
        async with aiofiles.open(file_path, mode='r') as file:
            data = await file.read()
            return json.loads(data)
    except Exception as e:
        print(f"Error reading JSON file ({file_path}): {str(e)}")
        raise

def divide_array_equally(arr, y):
    result = []
    total_elements = len(arr)
    elements_per_batch = total_elements // y
    remainder = total_elements % y
    start_index = 0

    for i in range(y):
        end_index = start_index + elements_per_batch + (1 if remainder > 0 else 0)
        result.append(arr[start_index:end_index])
        start_index = end_index
        remainder -= 1

    return result

async def send_requests(urls, bundle):
    try:
        server_ips = await read_json_file("servers.json")
        server_data = await read_json_file("sessions.json")
        partials_urls = divide_array_equally(urls, len(server_ips))

        async with aiohttp.ClientSession() as session:
            tasks = []
            for index, server_ip in enumerate(server_ips):
                server_url = f"http://{server_ip}/task"
                payload = {
                    "chat_urls_or_usernames": partials_urls[index],
                    "bundle": bundle,
                    **server_data[index]
                }
                tasks.append(process_request(session, server_url, payload))

            await asyncio.gather(*tasks)
    except Exception as e:
        print(f"Error in send_requests: {str(e)}")
        raise

async def process_request(session, url, payload):
    try:
        async with session.post(url, json=payload) as response:
            data = await response.json()
            print(f"Request to {url} successful. Response: {data}")
    except Exception as e:
        print(f"Error sending request to {url}: {str(e)}")

async def save_data(bundle, ip, json_data):
    try:
        bundle_folder_path = os.path.join(os.path.dirname(__file__), "saved", bundle)
        os.makedirs(bundle_folder_path, exist_ok=True)

        async with aiofiles.open(os.path.join(bundle_folder_path, f"{ip}.json"), mode='w') as file:
            await file.write(json.dumps(json_data, indent=2))
    except Exception as e:
        print(f"Error saving data: {str(e)}")
        raise

async def parse_handler(request):
    try:
        data = await request.json()

        urls = data.get('urls')
        bundle = data.get('bundle')

        if not isinstance(urls, list) or len(urls) == 0:
            return web.Response(status=400, text="Invalid URLs array")
        if not bundle:
            return web.Response(status=400, text="Bundle not defined")

        bundle_path = os.path.join(os.path.dirname(__file__), "saved", bundle)
        if os.path.exists(bundle_path):
            return web.Response(status=400, text="Bundle directory already exists, please rename")

        await send_requests(urls, bundle)
        return web.Response(text="Requests sent successfully")
    except Exception as e:
        print(f"Error in /parse route: {str(e)}")
        return web.Response(status=500, text="Internal Server Error")

async def save_handler(request):
    try:
        remote_address = request.remote
        ip = remote_address.split(':')[-1]

        print(f"Начинаю обрабатывать запрос на сохранение от IP: {ip}")

        bundle = request.match_info.get('bundle')
        data = await request.json()

        json_data = data.get('jsonData')

        if not bundle or not json_data:
            return web.Response(status=400, text="Bundle and jsonData are required")

        await save_data(bundle, ip, json_data)
        return web.Response(text="Data saved successfully")
    except Exception as e:
        print(f"Error in /{bundle}/save route: {str(e)}")
        return web.Response(status=500, text="Internal Server Error")

app.router.add_post('/parse', parse_handler)
app.router.add_post('/{bundle}/save', save_handler)

if __name__ == '__main__':
    web.run_app(app, port=80)

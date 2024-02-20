import os
import json
import requests
from flask import Flask, request

app = Flask(__name__)
port = 80


def read_json_file(file_path):
    try:
        with open(file_path, "r") as file:
            data = json.load(file)
        return data
    except Exception as e:
        print(f"Error reading JSON file ({file_path}): {str(e)}")
        raise e


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


def send_requests(urls, bundle):
    try:
        server_ips = read_json_file("servers.json")
        server_data = read_json_file("sessions.json")
        partials_urls = divide_array_equally(urls, len(server_ips))

        for index, server_ip in enumerate(server_ips):
            server_url = f"http://{server_ip}/task"

            try:
                response = requests.post(
                    server_url,
                    json={
                        "chat_urls_or_usernames": partials_urls[index],
                        "bundle": bundle,
                        **server_data[index],
                    },
                )
                print(f"Request to {server_ip} successful. Response: {response.text}")
            except Exception as e:
                print(f"Error sending request to {server_url}: {str(e)}")
    except Exception as e:
        print(f"Error in send_requests: {str(e)}")
        raise e


@app.route("/parse", methods=["POST"])
def parse():
    try:
        data = request.json

        urls = data.get("urls", [])
        bundle = data.get("bundle")

        if not isinstance(urls, list) or len(urls) == 0:
            return "Invalid URLs array", 400
        if not bundle:
            return "Bundle not defined", 400

        bundle_path = os.path.join(os.path.dirname(__file__), "saved", bundle)
        if os.path.exists(bundle_path):
            return "Bundle directory already exists, please rename", 400

        send_requests(urls, bundle)
        return "Requests sent successfully"
    except Exception as e:
        print(f"Error in /parse route: {str(e)}")
        return "Internal Server Error", 500


@app.route("/<bundle>/save", methods=["POST"])
def save(bundle):
    try:
        ip = request.remote_addr.replace("::ffff:", "")

        print(f"Processing save request from IP: {ip}")

        json_data = request.json

        if not bundle or not json_data:
            return "Bundle and jsonData are required", 400

        bundle_folder_path = os.path.join(os.path.dirname(__file__), "saved", bundle)
        os.makedirs(bundle_folder_path, exist_ok=True)

        with open(os.path.join(bundle_folder_path, f"{ip}.json"), "w") as file:
            json.dump(json_data, file, indent=2)

        return "Data saved successfully"
    except Exception as e:
        print(f"Error saving data: {str(e)}")
        return str(e), 500


if __name__ == "__main__":
    app.run(port=port)

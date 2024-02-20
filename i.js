const { NestFactory } = require('@nestjs/core');
const { join } = require('path');
const fs = require('fs-extra');
const axios = require('axios');

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON file (${filePath}):`, error.message);
    throw error;
  }
}

function divideArrayEqually(arr, y) {
  const result = [];
  const totalElements = arr.length;
  const elementsPerBatch = Math.floor(totalElements / y);
  let remainder = totalElements % y;
  let startIndex = 0;

  for (let i = 0; i < y; i++) {
    const endIndex = startIndex + elementsPerBatch + (remainder > 0 ? 1 : 0);
    result.push(arr.slice(startIndex, endIndex));
    startIndex = endIndex;
    remainder--;
  }

  return result;
}

class ParseService {
  async sendRequests(urls, bundle) {
    try {
      const serverIPs = await readJsonFile('servers.json');
      const serverData = await readJsonFile('sessions.json');
      const partialsUrls = divideArrayEqually(urls, serverIPs.length);

      for (const [index, serverIp] of serverIPs.entries()) {
        const serverUrl = `http://${serverIp}/task`;

        try {
          const response = await axios.post(serverUrl, {
            chat_urls_or_usernames: partialsUrls[index],
            bundle,
            ...serverData[index],
          });
          console.log(`Request to ${serverIp} successful. Response:`, response.data);
        } catch (error) {
          console.error(`Error sending request to ${serverUrl}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error in sendRequests:', error.message);
      throw error;
    }
  }

  async saveData(bundle, jsonData) {
    try {
      console.log(`Saving data for bundle: ${bundle}`);
      const bundleFolderPath = join(__dirname, 'saved', bundle);
      if (!fs.existsSync(bundleFolderPath)) {
        fs.mkdirSync(bundleFolderPath, { recursive: true });
      }

      const { remoteAddress } = req.connection;
      const ip = remoteAddress.replace(/^.*:/, '');
      await fs.writeFile(
        join(bundleFolderPath, `${ip}.json`),
        JSON.stringify(jsonData, null, 2)
      );
    } catch (error) {
      console.error('Error saving data:', error.message);
      throw error;
    }
  }
}

class ParseController {
  constructor() {
    this.parseService = new ParseService();
  }

  async parse(body, res) {
    try {
      const { urls, bundle } = body;
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).send('Invalid URLs array');
      }
      if (!bundle) {
        return res.status(400).send('Bundle not defined');
      }

      const bundlePath = join(__dirname, 'saved', bundle);
      try {
        await fs.stat(bundlePath);
        return res.status(400).send('Bundle directory already exists, please rename');
      } catch {}

      await this.parseService.sendRequests(urls, bundle);
      res.send('Requests sent successfully');
    } catch (error) {
      console.error('Error in /parse route:', error.message);
      res.status(500).send('Internal Server Error');
    }
  }

  async save(body, res, bundle) {
    try {
      const { jsonData } = body;
      if (!bundle || !jsonData) {
        return res.status(400).send('Bundle and jsonData are required');
      }

      await this.parseService.saveData(bundle, jsonData);
      res.send('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error.message);
      res.status(500).send(error.message);
    }
  }
}

const parseController = new ParseController();

const app = {
  async listen(port) {
    try {
      await parseController.parseService.sendRequests(["url1", "url2"], "bundle1");
    } catch (error) {
      console.error("Error in sendRequests:", error.message);
    }
  }
};

app.listen(80).then(() => console.log("Server working now"));

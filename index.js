const fs = require("fs").promises;
const axios = require("axios");
const express = require("express");

const app = express();
const port = 80;

app.use(express.json());

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
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

async function sendRequests(urls) {
  try {
    const serverIPs = await readJsonFile("servers.json");
    const serverData = await readJsonFile("sessions.json");
    const partialsUrls = divideArrayEqually(urls, serverIPs.length);

    for (const [index, serverIp] of serverIPs.entries()) {
      const serverUrl = `http://${serverIp}/task`;

      try {
        const response = await axios.post(serverUrl, {
          chat_urls_or_usernames: partialsUrls[index],
          ...serverData[index],
        });
        console.log(
          `Request to ${serverIp} successful. Response:`,
          response.data
        );
      } catch (error) {
        console.error(`Error sending request to ${serverIp}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error in sendRequests:", error.message);
    throw error;
  }
}

app.post("/parse", async (req, res) => {
  try {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "Invalid URLs array" });
    }

    await sendRequests(urls);
    res.json({ success: true, message: "Requests sent successfully" });
  } catch (error) {
    console.error("Error in /parse route:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.post("/:time/save", async (req, res) => {
  try {
    const { time } = req.params;
    const { jsonData } = req.body;

    if (!time || !jsonData) {
      return res.status(400).json({
        success: false,
        error: "time или jsonData - обязательны",
      });
    }

    await fs.writeFile(`saved/${time}.json`, JSON.stringify(jsonData, null, 2));
    res.json({ success: true, message: "Данные успешно сохранены" });
  } catch (error) {
    console.error("Error saving data:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port);

const fs = require("fs").promises;
const fss = require("fs");

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 80;

app.use(bodyParser.json({ limit: "10gb" }));
app.use(bodyParser.urlencoded({ limit: "10gb", extended: true }));

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

async function sendRequests(urls, bundle) {
  try {
    const serverIPs = await readJsonFile("servers.json");
    const serverData = await readJsonFile("sessions.json");
    const partialsUrls = divideArrayEqually(urls, serverIPs.length);

    for (const [index, serverIp] of serverIPs.entries()) {
      const serverUrl = `http://${serverIp}/task`;

      try {
        const response = await axios.post(serverUrl, {
          chat_urls_or_usernames: partialsUrls[index],
          bundle,
          ...serverData[index],
        });
        console.log(
          `Request to ${serverIp} successful. Response:`,
          response.data
        );
      } catch (error) {
        console.error(`Error sending request to ${serverUrl}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error in sendRequests:", error.message);
    throw error;
  }
}

app.post("/parse", async (req, res) => {
  try {
    const { urls, bundle } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).send("Invalid URLs array");
    }
    if (!bundle) {
      return res.status(400).send("Bundle not defined");
    }

    const bundlePath = path.join(__dirname, "saved", bundle);
    try {
      await fs.stat(bundlePath);
      return res
        .status(400)
        .send("Bundle directory already exists, please rename");
    } catch {}

    await sendRequests(urls, bundle);
    res.send("Requests sent successfully");
  } catch (error) {
    console.error("Error in /parse route:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/:bundle/save", async (req, res) => {
  try {
    const { remoteAddress } = req.connection;

    const { bundle } = req.params;
    const { jsonData } = req.body;

    if (!bundle || !jsonData) {
      return res.status(400).send("Bundle and jsonData are required");
    }

    const bundleFolderPath = path.join(__dirname, "saved", bundle);
    if (!fss.existsSync(bundleFolderPath)) {
      fss.mkdirSync(bundleFolderPath, { recursive: true });
    }

    await fs.writeFile(
      path.join(bundleFolderPath, `${remoteAddress.replace(/^.*:/, "")}.json`),
      JSON.stringify(jsonData, null, 2)
    );

    res.send("Data saved successfully");
  } catch (error) {
    console.error("Error saving data:", error.message);
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log("Server working now");
});

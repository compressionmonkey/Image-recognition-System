import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import UAParser from 'ua-parser-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Increase the payload size limit (adjust the size as needed)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Add a function to log analytics
function logAnalytics(data) {
  const logEntry = JSON.stringify(data) + '\n';
  fs.appendFile('analytics.log', logEntry, (err) => {
    if (err) console.error('Error writing to log file:', err);
  });
}

app.post('/vision-api', async (req, res) => {
    const imageBase64 = req.body.image;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    const startTime = Date.now();

    try {
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [
                    {
                        image: {
                            content: imageBase64
                        },
                        features: [
                            {
                                type: 'TEXT_DETECTION'
                            }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Log analytics
        logAnalytics({
            timestamp: new Date().toISOString(),
            processingTime: processingTime,
            deviceInfo: req.headers['user-agent'],
            imageSizeBytes: Buffer.from(imageBase64, 'base64').length,
            success: true
        });

        res.json(data);
    } catch (error) {
        console.error('Error calling Vision API:', error);

        // Log error analytics
        logAnalytics({
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            deviceInfo: req.headers['user-agent'],
            imageSizeBytes: Buffer.from(imageBase64, 'base64').length,
            success: false,
            error: error.message
        });

        res.status(500).send('Error calling Vision API');
    }
});

// Add this new route
app.get('/log', async (req, res) => {
  try {
    const logContent = await fs.readFile('analytics.log', 'utf-8');
    const logEntries = logContent.trim().split('\n').map(JSON.parse);

    res.send(`
      <html>
        <head>
          <title>Analytics Dashboard</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/UAParser.js/0.7.28/ua-parser.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            h1 { text-align: center; color: #333; }
            .chart-container { width: 48%; height: 300px; margin: 1%; float: left; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            @media (max-width: 768px) { .chart-container { width: 98%; } }
          </style>
        </head>
        <body>
          <h1>Analytics Dashboard</h1>
          <div class="chart-container"><canvas id="processingTimeChart"></canvas></div>
          <div class="chart-container"><canvas id="deviceTypeChart"></canvas></div>
          <div class="chart-container"><canvas id="imageSizeChart"></canvas></div>
          <div class="chart-container"><canvas id="successRateChart"></canvas></div>
          <script>
            const logEntries = ${JSON.stringify(logEntries)};
            
            // Processing Time Chart
            new Chart(document.getElementById('processingTimeChart'), {
              type: 'line',
              data: {
                labels: logEntries.map(entry => new Date(entry.timestamp)),
                datasets: [{
                  label: 'Processing Time (seconds)',
                  data: logEntries.map(entry => entry.processingTime / 1000), // Convert to seconds
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Processing Time' } },
                scales: { 
                  x: { type: 'time', time: { unit: 'minute' } },
                  y: { title: { display: true, text: 'Seconds' } }
                }
              }
            });

            // Device Type Chart
            const deviceCounts = logEntries.reduce((acc, entry) => {
              const parser = new UAParser(entry.deviceInfo);
              const browser = parser.getBrowser().name;
              const device = parser.getDevice().type || 'desktop';
              const key = \`\${browser} (\${device})\`;
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {});
            new Chart(document.getElementById('deviceTypeChart'), {
              type: 'bar',
              data: {
                labels: Object.keys(deviceCounts),
                datasets: [{
                  label: 'Device & Browser Occurrences',
                  data: Object.values(deviceCounts),
                  backgroundColor: 'rgb(255, 99, 132)'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Device Types & Browsers' } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' } } }
              }
            });

            // Image Size Chart
            new Chart(document.getElementById('imageSizeChart'), {
              type: 'line',
              data: {
                labels: logEntries.map(entry => new Date(entry.timestamp)),
                datasets: [{
                  label: 'Image Size (MB)',
                  data: logEntries.map(entry => entry.imageSizeBytes / (1024 * 1024)), // Convert to MB
                  borderColor: 'rgb(153, 102, 255)',
                  tension: 0.1
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Image Sizes' } },
                scales: { 
                  x: { type: 'time', time: { unit: 'minute' } },
                  y: { title: { display: true, text: 'Megabytes (MB)' } }
                }
              }
            });

            // Success Rate Chart
            const successCount = logEntries.filter(entry => entry.success).length;
            const failureCount = logEntries.length - successCount;
            new Chart(document.getElementById('successRateChart'), {
              type: 'pie',
              data: {
                labels: ['Success', 'Failure'],
                datasets: [{
                  data: [successCount, failureCount],
                  backgroundColor: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)']
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                  title: { display: true, text: 'Success Rate' },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(2) + '%';
                        return \`\${label}: \${percentage}\`;
                      }
                    }
                  }
                }
              }
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error reading log file:', error);
    res.status(500).send('Error reading log file');
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

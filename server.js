import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import { kv } from '@vercel/kv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Simplified logAnalytics function
async function logAnalytics(data) {
  const timestamp = new Date().toISOString();
  await kv.lpush('analytics_logs', JSON.stringify({ timestamp, ...data }));
  await kv.ltrim('analytics_logs', 0, 999); // Keep last 1000 entries
}

app.post('/vision-api', async (req, res) => {
    const imageBase64 = req.body.image;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    const startTime = Date.now();

    try {
        console.log('Received request for Vision API');
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
        console.log('Vision API response:', JSON.stringify(data));
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Log analytics
        await logAnalytics({
            processingTime: processingTime,
            deviceInfo: req.headers['user-agent'],
            imageSizeBytes: Buffer.from(imageBase64, 'base64').length,
            success: true
        });

        res.json(data);
    } catch (error) {
        console.error('Error:', error);

        // Log error analytics
        await logAnalytics({
            processingTime: Date.now() - startTime,
            deviceInfo: req.headers['user-agent'],
            imageSizeBytes: Buffer.from(imageBase64, 'base64').length,
            success: false,
            error: error.message
        });

        res.status(500).send('Error calling Vision API');
    }
});

// New route to get logs
app.get('/logs', async (req, res) => {
  try {
    const logs = await kv.lrange('analytics_logs', 0, -1);
    // The logs are already JSON objects, so we don't need to parse them
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Error fetching logs');
  }
});

// New route to download logs as CSV
app.get('/download-logs', async (req, res) => {
  try {
    const logs = await kv.lrange('analytics_logs', 0, -1);
    // The logs are already JSON objects, so we don't need to parse them
    const csvContent = [
      'timestamp,processingTime,deviceInfo,imageSizeBytes,success,error',
      ...logs.map(log => {
        const { timestamp, processingTime, deviceInfo, imageSizeBytes, success, error } = log;
        return `${timestamp},${processingTime},"${deviceInfo}",${imageSizeBytes},${success},${error || ''}`;
      })
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics_logs.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error downloading logs:', error);
    res.status(500).send('Error downloading logs');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import Airtable from 'airtable';
import sharp from 'sharp';

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

// Configure Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apptAcEDVua80Ab5c'; // Replace with your Airtable base ID
const tableName = 'receipt analytics'; // Replace with your table name

const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function logAnalytics(data) {
  const timestamp = formatDate(new Date());
  const logEntry = {
    timestamp,
    ...data
  };

  console.log('Analytics Log:', JSON.stringify(logEntry, null, 2));

  let record;
  try {
    // Log to Airtable
    record = {
      fields: {
        Timestamp: logEntry.timestamp,
        ProcessingTimeSeconds: parseFloat(logEntry.ProcessingTimeSeconds.toFixed(2)), // Convert to number with 2 decimal places
        DeviceInfo: logEntry.DeviceInfo,
        ImageSizeMb: logEntry.ImageSizeMb.toString(), // Keep as string
        Success: logEntry.Success.toString(), // Convert boolean to string
        ErrorMessage: logEntry.ErrorMessage || ''
      }
    };

    console.log('Sending to Airtable:', JSON.stringify(record, null, 2));

    await base(tableName).create([record]);
    console.log('Logged to Airtable successfully.');
  } catch (error) {
    console.error('Error logging to Airtable:', error);
    if (error.error === 'INVALID_VALUE_FOR_COLUMN') {
      console.error('Invalid value details:', error.message);
      console.error('Problematic record:', record ? JSON.stringify(record, null, 2) : 'Record not created');
    }
  }
}

async function preprocessImage(base64Image) {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Process the image using sharp
        const processedBuffer = await sharp(imageBuffer)
            // Convert to grayscale for better OCR
            .grayscale()
            // Increase contrast
            .contrast(1.2)
            // Sharpen the image
            .sharpen({
                sigma: 1.5,
                flat: 1.5,
                jagged: 0.5
            })
            // Ensure consistent format and quality
            .jpeg({ quality: 85 })
            .toBuffer();

        // Convert back to base64
        return processedBuffer.toString('base64');
    } catch (error) {
        console.error('Error preprocessing image:', error);
        // Return original image if preprocessing fails
        return base64Image;
    }
}

app.post('/vision-api', async (req, res) => {
    const imageBase64 = req.body.image;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    const startTime = Date.now();

    try {
        console.log('Received request for Vision API');
        
        // Preprocess the image
        const preprocessedImage = await preprocessImage(imageBase64);
        
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: preprocessedImage
                    },
                    features: [{
                        type: 'TEXT_DETECTION'
                    }]
                }]
            })
        });

        const data = await response.json();
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Log analytics
        await logAnalytics({
            ProcessingTimeSeconds: processingTime / 1000,
            DeviceInfo: req.body.deviceInfo || req.headers['user-agent'],
            ImageSizeMb: (req.body.imageSize / 1024 / 1024).toFixed(2),
            Success: 'true', // Send as string
            ErrorMessage: ''
        });

        res.json(data);
    } catch (error) {
        console.error('Error:', error);

        // Log error analytics
        await logAnalytics({
            ProcessingTimeSeconds: (Date.now() - startTime) / 1000,
            DeviceInfo: req.body.deviceInfo || req.headers['user-agent'],
            ImageSizeMb: (req.body.imageSize / 1024 / 1024).toFixed(2),
            Success: 'false', // Send as string
            ErrorMessage: error.message
        });

        res.status(500).send('Error calling Vision API');
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

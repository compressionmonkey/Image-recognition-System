import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import Airtable from 'airtable';
import nlp from 'compromise';
import plg from 'compromise-dates';

nlp.plugin(plg);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add custom words for recognizing Ngultrum variations
nlp.plugin({
    words: {
    // Define different possibilities using regex
    '/nu\\./i': 'Currency' // Case-insensitive match for "Nu."
    }
});

// Configure Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apptAcEDVua80Ab5c'; // Replace with your Airtable base ID

// Map customer IDs to their table names
const customerTables = {
    'a8358': 'Ambient',
    '0e702': 'Customer2',
    '571b6': 'Customer3',
    'be566': 'Customer4',
    '72d72': 'Customer5'
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function parseBankSpecificData(text, bankKey) {
    let result = {
        amount: null,
        reference: null,
        date: null,
        time: null
    };

    // Define all possible patterns for Ngultrum amounts
    const currencyPatterns = [
        /Nu\.\s*(\d[\d,]*\.?\d*)/gi,      // Nu. 100
        /nu\.\s*(\d[\d,]*\.?\d*)/gi,      // nu. 100
        /(\d[\d,]*\.?\d*)\s*Nu\./gi,      // 100 Nu.
        /(\d[\d,]*\.?\d*)\s*nu\./gi,      // 100 nu.
        /Amount[:\s]+Nu\.?\s*(\d[\d,]*\.?\d*)/gi,  // Amount: Nu. 100
        /Total[:\s]+Nu\.?\s*(\d[\d,]*\.?\d*)/gi,   // Total: Nu. 100
        /Nu\s*(\d[\d,]*\.?\d*)/gi,        // Nu 100
        /nu\s*(\d[\d,]*\.?\d*)/gi,        // nu 100
        /(\d[\d,]*\.?\d*)\s*Nu\b/gi,      // 100 Nu
        /(\d[\d,]*\.?\d*)\s*nu\b/gi       // 100 nu
    ];

    let allAmounts = [];

    // Find all amounts using the patterns
    currencyPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            // Clean up the amount - remove commas and non-digit characters except decimal point
            const amount = match[1]?.replace(/[^\d.]/g, '');
            if (amount) {
                const numAmount = parseFloat(amount);
                // Only consider reasonable amounts (adjust range as needed)
                if (numAmount >= 1 && numAmount <= 10000) {
                    allAmounts.push({
                        amount: numAmount,
                        index: match.index,
                        text: match[0]
                    });
                }
            }
        });
    });

    // Sort amounts by their position in the text
    allAmounts.sort((a, b) => a.index - b.index);

    console.log('Found amounts:', allAmounts);

    // Take the last amount found (usually the total amount)
    if (allAmounts.length > 0) {
        result.amount = allAmounts[allAmounts.length - 1].amount.toString();
    }

    // Use compromise to extract dates and times
    const doc = nlp(text);

    const datePossibilities = doc.dates().get();
    console.log('datePossibilities', JSON.stringify(datePossibilities));
    const timePossibilities = doc.times().get();
    console.log('timePossibilities', JSON.stringify(timePossibilities));

    // Fool-proof date selection
    if (datePossibilities && datePossibilities.length > 0) {
        // Get middle index for dates
        const middleIndex = Math.floor(datePossibilities.length / 2);
        const selectedDate = datePossibilities[middleIndex];
        console.log('Selected date from middle index:', selectedDate);
        
        if (selectedDate) {
            const date = new Date(selectedDate);
            if (date instanceof Date && !isNaN(date)) {
                result.date = date.toISOString().split('T')[0];
                console.log('Set result.date to:', result.date);
            }
        }
    }

    // Fool-proof time selection
    if (timePossibilities && timePossibilities.length > 0) {
        // Get last index for times
        const lastIndex = timePossibilities.length - 1;
        const selectedTime = timePossibilities[lastIndex];
        console.log('Selected time from last index:', selectedTime);
        
        if (selectedTime) {
            // Convert to string and ensure we're working with a string
            const timeStr = String(selectedTime.text || selectedTime);
            // Try to parse time in 24-hour format
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
                const hours = timeMatch[1].padStart(2, '0');
                const minutes = timeMatch[2];
                const seconds = timeMatch[3] || '00';
                result.time = `${hours}:${minutes}:${seconds}`;
                console.log('Set result.time to:', result.time);
            }
        }
    }

    // Handle bank-specific logic
    switch (bankKey) {
        case 'BNB_Key':
            // Reference number (RRN)
            const rrnMatch = text.match(/\b43\d{10}\b/);
            if (rrnMatch) {
                result.reference = rrnMatch[0];
            }
            break;

        case 'PNB_Key':
            // Reference number
            const pnbRefMatch = text.match(/\b43\d{10}\b/);
            if (pnbRefMatch) {
                result.reference = pnbRefMatch[0];
            }
            break;

        case 'Eteeru_Key':
            // Transaction ID (combining split numbers)
            const txnIdMatches = text.match(/\b\d+\b/g);
            if (txnIdMatches && txnIdMatches.length >= 2) {
                result.reference = txnIdMatches.join('');
            }
            break;

        case 'goBOB_Key':
            // PAN Number
            const panMatch = text.match(/\b\d{16}\b/);
            if (panMatch) {
                result.reference = panMatch[0];
            }
            // gobob will have no date. User will manually add
            result.date = '';
            result.time = '';
            break;

        case 'BOB_Key':
            // Journal Number
            const jrnlMatch = text.match(/(?:Jrnl\.?\s*No\.?:?\s*)(\d+)/i);
            if (jrnlMatch) {
                result.reference = jrnlMatch[1];
            }
            break;
    }

    return result;
}

function getMonthNumber(month) {
    const months = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
        'january': '01', 'february': '02', 'march': '03',
        'april': '04', 'june': '06', 'july': '07',
        'august': '08', 'september': '09', 'october': '10',
        'november': '11', 'december': '12'
    };
    return months[month.toLowerCase()] || '01';
}

// Update parseReceiptData to use the new function
function parseReceiptData(text, bankKey) {
    try {
        const bankData = parseBankSpecificData(text, bankKey);
        console.log('bankData', bankData);
        return {
            Date: bankData.date,
            Time: bankData.time,
            ReferenceNo: bankData.reference,
            Amount: bankData.amount,
        };
    } catch (error) {
        console.error('Error in parseReceiptData:', error);
        return {
            Timestamp: formatDate(new Date()),
            ReferenceNo: 'ERROR',
            BankType: bankKey.replace('_Key', ''),
            Amount: '0.00',
            FromAccount: null,
            ToAccount: null,
            Purpose: null,
            Remarks: null
        };
    }
}

// Define the bank keys with primary and fuzzy matches
const BANK_KEYS = {
  BNB_Key: {
    primary: ['RRN', 'TRANSACTION SUCCESSFUL', 'Amount'],
    fuzzy: {
      'reference': ['RRN', 'reference no', 'ref no', 'ref.no'],
      'amount': ['amt', 'amount', 'total amount'],
      'success': ['transaction successful', 'transaction success', 'successful transaction']
    }
  },
  PNB_Key: {
    primary: ['TRANSACTION SUCCESSFUL', 'Ref. No', 'Bank Name', 'Transaction Type', 'Druk Pay'],
    fuzzy: {
      'reference': ['ref. no', 'reference no', 'ref no'],
      'bank': ['bank name', 'bank details'],
      'transaction': ['txn type', 'transaction type']
    }
  },
  Eteeru_Key: {
    primary: ['Processed By', 'Merchant Name', 'Amount', 'Purpose', 'Transaction ID'],
    fuzzy: {
      'amount': ['amt', 'total amount'],
      'purpose': ['reason', 'description'],
      'transaction': ['txn id', 'transaction id', 'tid']
    }
  },
  BOB_Key: {
    primary: ['MOBILE BANKING', 'mBOB', 'Purpose/Bill QR', 'Amt', 'Jrnl. No'],
    fuzzy: {
      'mobile': ['mobile banking', 'm-banking', 'mbob'],
      'purpose': ['purpose', 'bill qr', 'qr payment'],
      'amount': ['amt', 'amount', 'total'],
      'journal': ['jrnl. no', 'journal no', 'jrnl no']
    }
  },
  goBOB_Key: {
    primary: ['Wallet Number', 'Amount', 'Merchant Bank', 'PAN Number', 'Purpose'],
    fuzzy: {
      'wallet': ['wallet number', 'wallet no'],
      'amount': ['amt', 'total amount'],
      'pan': ['pan number', 'pan no']
    }
  }
};

function determineBankKey(paragraph) {
  // Normalize and prepare text
  const doc = nlp(paragraph);
  doc.normalize({
    whitespace: true,
    case: true,
    punctuation: true,
    unicode: true,
    contractions: true,
    acronyms: true,
    parentheses: true,
    quotations: true,
    emoji: true
  });
  
  const normalizedText = doc.text().toLowerCase();
  let scores = {};
  
  // Initialize scores
  for (const bankKey of Object.keys(BANK_KEYS)) {
    scores[bankKey] = {
      primaryMatches: 0,
      fuzzyMatches: 0,
      totalScore: 0
    };
  }
  
  // Process each bank's patterns
  for (const [bankKey, patterns] of Object.entries(BANK_KEYS)) {
    // Check primary keywords (exact matches - 2 points)
    patterns.primary.forEach(keyword => {
      if (normalizedText.includes(keyword.toLowerCase())) {
        scores[bankKey].primaryMatches++;
        scores[bankKey].totalScore += 2;
      }
    });
    
    // Check fuzzy matches using compromise (1 point)
    Object.entries(patterns.fuzzy).forEach(([category, variations]) => {
      const terms = doc.match(variations.join('|'));
      if (terms.found) {
        scores[bankKey].fuzzyMatches++;
        scores[bankKey].totalScore += 1;
      }
    });
  }
  
  // Find best match
  const bestMatch = Object.entries(scores)
    .reduce((best, [bankKey, score]) => {
      return score.totalScore > best.score ? 
        { bankKey, score: score.totalScore } : 
        best;
    }, { bankKey: 'Unknown', score: 0 });
    
  // Log for debugging
//   console.log('Bank detection scores:', {
//     bestMatch,
//     allScores: scores
//   });
  
  // Return result if confidence threshold met (lowered from 3 to 2)
  return bestMatch.score >= 2 && normalizedText.length > 30 ? 
    bestMatch.bankKey : 
    'Unknown';
}

// Function to check and get current user's table name
function checkCurrentUser(customerID) {
    const tableName = customerTables[customerID];
    if (!tableName) {
        throw new Error('Invalid customer ID or table name not found');
    }
    return tableName;
}

// Function to update receipt data in customer's table
async function updateReceiptData(receiptData) {
    try {
        const tableName = checkCurrentUser(receiptData.customerID);
        if (!tableName) {
            throw new Error('Invalid customer ID or table name not found');
        }

        const record = {
            fields: {
                'Timestamp': receiptData.timestamp,
                'Reference Number': receiptData.referenceNo,
                'Amount': receiptData.amount,
                'Recognized Text': receiptData.recognizedText
            }
        };

        console.log(`Updating receipt data for ${tableName}:`, JSON.stringify(record, null, 2));
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
        console.log('Receipt data updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating receipt data:', error);
        return false;
    }
}

// Function to update analytics data in analytics table
async function updateAnalytics(customerID, analyticsData) {
    try {
        const tableName = `receipt analytics`; // Analytics
        if (!tableName) {
            throw new Error('Invalid customer ID or analytics table name not found');
        }

        const record = {
            fields: {
                'Timestamp': formatDate(new Date()),
                'ProcessingTimeSeconds': parseFloat(analyticsData.ProcessingTimeSeconds.toFixed(2)),
                'DeviceInfo': analyticsData.DeviceInfo,
                'ImageSizeMb': analyticsData.ImageSizeMb.toString(),
                'Success': analyticsData.Success.toString(),
                'ErrorMessage': analyticsData.ErrorMessage || ''
            }
        };

        console.log(`Updating analytics for ${tableName}:`, JSON.stringify(record, null, 2));
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
        // console.log('Analytics updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating analytics:', error);
        return false;
    }
}

app.post('/vision-api', async (req, res) => {
    const imageBase64 = req.body.image;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    const startTime = req.body.startTime;
    const customerID = req.body.customerID;

    try {
        // console.log('Received request for Vision API');
        
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: imageBase64
                    },
                    features: [{
                        type: 'DOCUMENT_TEXT_DETECTION'
                    }],
                    imageContext: {
                        languageHints: ['en'],
                        textDetectionParams: {
                            enableTextDetectionConfidenceScore: true
                        }
                    }
                }]
            })
        });

        const data = await response.json();

        // console.log('herertjhajksfdhhjk', JSON.stringify(data))
        
        // Try to get processing time from Vision API response first
        let totalProcessingTime;
        if (data.responses[0]?.latencyInfo?.totalLatencyMillis) {
            totalProcessingTime = data.responses[0].latencyInfo.totalLatencyMillis / 1000;
            // console.log('Using Vision API latency:', totalProcessingTime);
        } else {
            // Fallback to manual calculation
            const endTime = Date.now();
            totalProcessingTime = (endTime - startTime) / 1000;
            // console.log('Using manual latency calculation:', totalProcessingTime);
        }

        const textResult = data.responses[0]?.fullTextAnnotation;
        const recognizedText = textResult?.text || '';
        const confidence = textResult?.pages?.[0]?.blocks?.reduce((acc, block) => 
            acc + block.confidence, 0) / (textResult?.pages?.[0]?.blocks?.length || 1);

        if (confidence > 0.7) {
            const bankKey = determineBankKey(recognizedText);
            const receiptData = parseReceiptData(recognizedText, bankKey);
            
            // Send only the essential data
            res.json({
                amount: receiptData.Amount,
                referenceNo: receiptData.ReferenceNo,
                Date: receiptData.Date,
                Time: receiptData.Time,
                recognizedText
            });
            return;
        } else {
            res.status(400).json({
                error: 'Text confidence score is below threshold',
                details: {
                    confidence: confidence,
                    threshold: 0.7,
                    message: 'The text detection confidence is too low. Please try with a clearer image.'
                }
            });
            return;
        }
    } catch (error) {
        const errorTime = Date.now();
        const totalErrorTime = (errorTime - startTime) / 1000;
        console.error('Error:', error);

        await updateAnalytics(customerID, {
            ProcessingTimeSeconds: totalErrorTime,
            DeviceInfo: req.body.deviceInfo || req.headers['user-agent'],
            ImageSizeMb: (req.body.imageSize / 1024 / 1024).toFixed(2),
            Success: 'false',
            ErrorMessage: error.message
        });

        res.status(500).send('Error calling Vision API');
    }
});

// Add this new endpoint for logging
app.post('/api/logs', async (req, res) => {
    const { level, message, data, timestamp, customerID } = req.body;
    
    try {
        // Log to console (will appear in Vercel logs)
        console.log(JSON.stringify({
            timestamp: timestamp || new Date().toISOString(),
            level,
            customerID,
            message,
            data
        }));

        // Optionally store in Airtable
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base('Logs').create([{
            fields: {
                'Timestamp': timestamp || formatDate(new Date()),
                'Level': level,
                'CustomerID': customerID,
                'Message': message,
                'Data': JSON.stringify(data, null, 2)
            }
        }]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error logging:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add this new endpoint for recording cash transactions
app.post('/record-cash', async (req, res) => {
    const { amount } = req.body;
    const isCash = true;  // This is always true for cash transactions
    
    try {
        // Basic validation
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a positive number'
            });
        }

        // Log the request for debugging
        console.log('Cash record request:', {
            isCash,
            amount,
            timestamp: formatDate(new Date())
        });

        // For now, just send back a success response
        res.status(200).json({
            success: true,
            message: 'Cash record received',
            data: {
                isCash,
                amount,
                timestamp: formatDate(new Date())
            }
        });

    } catch (error) {
        console.error('Error recording cash:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/confirm-receipt', async (req, res) => {
    const confirmedDetails = req.body;
    
    try {
        // Log the confirmed details
        console.log('Confirmed receipt details:', confirmedDetails);
        await updateReceiptData(confirmedDetails);
        // Send back the confirmed details
        res.json({
            success: true,
            data: confirmedDetails,
            message: 'Receipt details confirmed successfully'
        });
        
    } catch (error) {
        console.error('Error confirming receipt:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to confirm receipt'
        });
    }
});

// Add this endpoint to server.js
app.get('/api/dashboard-url', (req, res) => {
    const customerID = req.query.customerID;
    const dashboardUrl = process.env[`DASHBOARD_URL_${customerID}`];
    
    if (dashboardUrl) {
        res.json({ url: dashboardUrl });
    } else {
        res.status(404).json({ error: 'Dashboard URL not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

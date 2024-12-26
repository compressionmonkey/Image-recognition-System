import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import Airtable from 'airtable';
import nlp from 'compromise';

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

export function determineBankKey(paragraph) {
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
    console.log('Bank detection scores:', {
      bestMatch,
      allScores: scores
    });
    
    // Return result if confidence threshold met (lowered from 3 to 2)
    return bestMatch.score >= 2 && normalizedText.length > 30 ? 
      bestMatch.bankKey : 
      'Unknown';
  }
// Update parseReceiptData to use the new function
export function parseReceiptData(text, bankKey) {
    try {
        const bankData = parseBankSpecificData(text, bankKey);
        return {
            Date: bankData.date,
            Time: bankData.time,
            ReferenceNo: bankData.reference,
            Amount: bankData.amount,
            bank: bankKey
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

function findCurrency(text, result) {
    // Define all possible patterns for Ngultrum amounts
    const currencyPatterns = [
        // Add these new patterns at the beginning of your currencyPatterns array
        /Nu\.\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi,     // Nu. 15,350.00
        /nu\.\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi,     // nu. 15,350.00
        /NU\.\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi,     // NU. 15,350.00
        
        // Amount with currency after
        /(\d{1,3}(?:,\d{3})*\.\d{2})\s*Nu\./gi,     // 15,350.00 Nu.
        
        // Standard Nu. format with spaces
        /Nu\.\s*(\d[\d,]*\.?\d*)/gi,      // Nu. 100
        /nu\.\s*(\d[\d,]*\.?\d*)/gi,      // nu. 100
        /NU\.\s*(\d[\d,]*\.?\d*)/gi,      // NU. 100
        
        // Amount after currency
        /(\d[\d,]*\.?\d*)\s*Nu\./gi,      // 100 Nu.
        /(\d[\d,]*\.?\d*)\s*nu\./gi,      // 100 nu.
        /(\d[\d,]*\.?\d*)\s*NU\./gi,      // 100 NU.
        
        // With Amount/Total prefix
        /Amount[:\s]+Nu\.?\s*(\d[\d,]*\.?\d*)/gi,  // Amount: Nu. 100
        /Total[:\s]+Nu\.?\s*(\d[\d,]*\.?\d*)/gi,   // Total: Nu. 100
        /Amt[:\s]+Nu\.?\s*(\d[\d,]*\.?\d*)/gi,     // Amt: Nu. 100
        
        // Without dot after Nu
        /Nu\s*(\d[\d,]*\.?\d*)/gi,        // Nu 100
        /nu\s*(\d[\d,]*\.?\d*)/gi,        // nu 100
        /NU\s*(\d[\d,]*\.?\d*)/gi,        // NU 100
        
        // Currency symbol after amount without dot
        /(\d[\d,]*\.?\d*)\s*Nu\b/gi,      // 100 Nu
        /(\d[\d,]*\.?\d*)\s*nu\b/gi,      // 100 nu
        /(\d[\d,]*\.?\d*)\s*NU\b/gi,      // 100 NU
        
        // Just amount with common prefixes
        /Amt[:\s]+(\d[\d,]*\.?\d*)/gi,    // Amt: 100
        /Amount[:\s]+(\d[\d,]*\.?\d*)/gi,  // Amount: 100
        /Total[:\s]+(\d[\d,]*\.?\d*)/gi,   // Total: 100

        // Comma decimal versions
        // Standard Nu. format with spaces
        /Nu\.\s*(\d[\d.]*,?\d*)/gi,      // Nu. 100,00
        /nu\.\s*(\d[\d.]*,?\d*)/gi,      // nu. 100,00
        /NU\.\s*(\d[\d.]*,?\d*)/gi,      // NU. 100,00
        
        // Amount after currency
        /(\d[\d.]*,?\d*)\s*Nu\./gi,      // 100,00 Nu.
        /(\d[\d.]*,?\d*)\s*nu\./gi,      // 100,00 nu.
        /(\d[\d.]*,?\d*)\s*NU\./gi,      // 100,00 NU.
        
        // With Amount/Total prefix
        /Amount[:\s]+Nu\.?\s*(\d[\d.]*,?\d*)/gi,  // Amount: Nu. 100,00
        /Total[:\s]+Nu\.?\s*(\d[\d.]*,?\d*)/gi,   // Total: Nu. 100,00
        /Amt[:\s]+Nu\.?\s*(\d[\d.]*,?\d*)/gi,     // Amt: Nu. 100,00
        
        // Without dot after Nu
        /Nu\s*(\d[\d.]*,?\d*)/gi,        // Nu 100,00
        /nu\s*(\d[\d.]*,?\d*)/gi,        // nu 100,00
        /NU\s*(\d[\d.]*,?\d*)/gi,        // NU 100,00
        
        // Currency symbol after amount without dot
        /(\d[\d.]*,?\d*)\s*Nu\b/gi,      // 100,00 Nu
        /(\d[\d.]*,?\d*)\s*nu\b/gi,      // 100,00 nu
        /(\d[\d.]*,?\d*)\s*NU\b/gi,      // 100,00 NU
        
        // Just amount with common prefixes
        /Amt[:\s]+(\d[\d.]*,?\d*)/gi,    // Amt: 100,00
        /Amount[:\s]+(\d[\d.]*,?\d*)/gi,  // Amount: 100,00
        /Total[:\s]+(\d[\d.]*,?\d*)/gi,   // Total: 100,00

        // BTN patterns
        /BTN\s*(\d[\d,]*\.?\d*)/gi,      // BTN 100
        /btn\s*(\d[\d,]*\.?\d*)/gi,      // btn 100
        /Btn\s*(\d[\d,]*\.?\d*)/gi,      // Btn 100
        
        // BTN after amount
        /(\d[\d,]*\.?\d*)\s*BTN/gi,      // 100 BTN
        /(\d[\d,]*\.?\d*)\s*btn/gi,      // 100 btn
        /(\d[\d,]*\.?\d*)\s*Btn/gi,      // 100 Btn
        
        // BTN with comma decimal
        /BTN\s*(\d[\d.]*,?\d*)/gi,      // BTN 100,00
        /btn\s*(\d[\d.]*,?\d*)/gi,      // btn 100,00
        /Btn\s*(\d[\d.]*,?\d*)/gi,      // Btn 100,00
        
        // Amount/Total with BTN and comma decimal
        /Amount[:\s]+BTN\s*(\d[\d.]*,?\d*)/gi,  // Amount: BTN 100,00
        /Total[:\s]+BTN\s*(\d[\d.]*,?\d*)/gi,   // Total: BTN 100,00
        /Amt[:\s]+BTN\s*(\d[\d.]*,?\d*)/gi,     // Amt: BTN 100,00
        
        // BTN after amount with comma decimal
        /(\d[\d.]*,?\d*)\s*BTN/gi,      // 100,00 BTN
        /(\d[\d.]*,?\d*)\s*btn/gi,      // 100,00 btn
        /(\d[\d.]*,?\d*)\s*Btn/gi,      // 100,00 Btn

        // Exclude balance amounts
        /(?<!Balance\s)Nu\.\s*(\d[\d,]*\.?\d*)/gi,  // Matches "Nu. 180" but not "Balance Nu. 4,13.99"
        
        // Amount-specific patterns
        /Amount\s*:?\s*Nu\.\s*(\d[\d,]*\.?\d*)/gi,  // Amount: Nu. 180
        /Amount\s*Nu\.\s*(\d[\d,]*\.?\d*)/gi,       // Amount Nu. 180
    ];

    let allAmounts = [];

    // Find all amounts using the patterns
    currencyPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            // Get the full matched text for debugging
            console.log('Found match: ', match[0], 'Groups:', match.groups, 'Captured:', match[1]);
            
            // Directly use the captured amount if it exists
            let amount = match[1];
            if (amount) {
                // Keep the commas for now to preserve number structure
                amount = amount.trim();
                
                // Convert to number format (remove commas only at this stage)
                const numAmount = parseFloat(amount.replace(/,/g, ''));
                
                // Only consider reasonable amounts (adjust range as needed)
                if (numAmount >= 1 && numAmount <= 100000) {  // Increased upper limit
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

    // Take the last amount found (usually the total amount)
    if (allAmounts.length > 0) {
        result.amount = allAmounts[allAmounts.length - 1].amount.toFixed(2); // Ensure 2 decimal places
    }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function convertDateFormat(dateStr) {
    // Define month mapping
    const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    // Remove any leading/trailing whitespace
    dateStr = dateStr.trim();

    // Convert to lowercase for consistent processing
    const lowerDate = dateStr.toLowerCase();

    // Try different date patterns
    let match;

    // NEW PATTERN: Handle dates with newline between month and year (e.g., "14 November\n    2024")
    match = lowerDate.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[\n\s]+(\d{4})/i);
    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${monthMap[month.toLowerCase()]}-${day.padStart(2, '0')}`;
    }

    // Pattern 1: 14 Nov 2024, 14-Nov-2024, 14/Nov/2024
    match = lowerDate.match(/(\d{1,2})[\s-/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-/](\d{4})/i);
    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${monthMap[month.toLowerCase()]}-${day.padStart(2, '0')}`;
    }

    // Pattern 2: Nov 14 2024, Nov-14-2024, Nov/14/2024
    match = lowerDate.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-/](\d{1,2})[\s-/](\d{4})/i);
    if (match) {
        const [_, month, day, year] = match;
        return `${year}-${monthMap[month.toLowerCase()]}-${day.padStart(2, '0')}`;
    }

    // Pattern 3: 14/11/2024, 14-11-2024
    match = lowerDate.match(/(\d{1,2})[\s-/](\d{1,2})[\s-/](\d{4})/);
    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Pattern 4: 2024/11/14, 2024-11-14
    match = lowerDate.match(/(\d{4})[\s-/](\d{1,2})[\s-/](\d{1,2})/);
    if (match) {
        const [_, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Return null if no pattern matches
    return null;
}

function findDate(text, result) {
    const datePatterns = [
        // Format: 14 November 2024, 14-November-2024, 14/November/2024
        /(\d{1,2})\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*[,-/]?\s*(\d{4})/gi,
        
        // Format: November 14 2024, November-14-2024, November/14/2024
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s*[,-/]?\s*(\d{1,2})\s*[,-/]?\s*(\d{4})/gi,
        
        // Format: 14 Nov 2024, 14-Nov-2024, 14/Nov/2024
        /(\d{1,2})[\s-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-/](\d{4})/gi,
        
        // Format: Nov 14 2024, Nov-14-2024, Nov/14/2024
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-/](\d{1,2})[\s-/](\d{4})/gi,
        
        // Format: 14/11/2024, 14-11-2024
        /(\d{1,2})[\s-/](\d{1,2})[\s-/](\d{4})/g,
        
        // Format: 2024/11/14, 2024-11-14
        /(\d{4})[\s-/](\d{1,2})[\s-/](\d{1,2})/g
    ];

    let lastDate = null;
    let lastIndex = -1;

    // Check each pattern
    datePatterns.forEach(pattern => {
        let matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
            // Get the last match for this pattern
            let lastMatch = matches[matches.length - 1];
            if (lastMatch.index > lastIndex) {
                lastDate = lastMatch[0];
                lastIndex = lastMatch.index;
            }
        }
    });

    result.date = lastDate ? convertDateFormat(lastDate) : null;
}

function findTime(text, result) {
    const timePatterns = [
        // 12-hour format with seconds: 04:16:48 PM, 4:16:48 PM, 04.16.48 PM
        /\b(0?[1-9]|1[0-2])[:.-]([0-5]\d)[:.-]([0-5]\d)\s*(?:AM|PM|am|pm)\b/g,
        
        // 24-hour format with seconds: 16:16:48, 16.16.48, 16-16-48
        /\b([01]\d|2[0-3])[:.-]([0-5]\d)[:.-]([0-5]\d)\b/g,
    ];

    let lastTime = null;
    let lastIndex = -1;

    timePatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch.index > lastIndex) {
                lastTime = lastMatch[0];
                lastIndex = lastMatch.index;
            }
        }
    });
    result.time = lastTime;
}

function parseBankSpecificData(text, bankKey) {
    // Initialize result object
    let result = {
        amount: null,
        reference: null,
        date: null,
        time: null
    };

    // Pass result object to helper functions
    findCurrency(text, result);
    findDate(text, result);
    findTime(text, result);
    
    // Handle bank-specific logic
    switch (bankKey) {
        case 'BNB':
            // Reference number (RRN)
            const rrnMatch = text.match(/\b43\d{10}\b/);
            if (rrnMatch) {
                result.reference = rrnMatch[0];
            }
            break;

        case 'PNB':
            // Reference number
            const pnbRefMatch = text.match(/\b43\d{10}\b/);
            if (pnbRefMatch) {
                result.reference = pnbRefMatch[0];
            }
            break;

        case 'Eteeru':
            // Transaction ID (combining split numbers)
            const txnIdMatches = text.match(/\b\d+\b/g);
            if (txnIdMatches && txnIdMatches.length >= 2) {
                result.reference = txnIdMatches.join('');
            }
            break;

        case 'goBOB':
            // PAN Number
            const panMatch = text.match(/\b\d{16}\b/);
            if (panMatch) {
                result.reference = panMatch[0];
            }
            // gobob will have no date. User will manually add
            result.date = '';
            result.time = '';
            break;

        case 'BOB':
            // Journal Number
            const jrnlMatch = text.match(/(?:Jrnl\.?\s*No\.?:?\s*)(\d+)/i);
            if (jrnlMatch) {
                result.reference = jrnlMatch[1];
            }
            break;
        case 'DK':
            // Transfer Number
            const transferMatch = text.match(/(?:Transfer\s*No\.?:?\s*)(\d+)/i);
            if (transferMatch) {
                result.reference = transferMatch[1];
            }
            break;
    }

    return result;
}

// Define the bank keys with primary and fuzzy matches
const BANK_KEYS = {
  BNB: {
    primary: ['RRN', 'TRANSACTION SUCCESSFUL', 'Amount'],
    fuzzy: {
      'reference': ['RRN', 'reference no', 'ref no', 'ref.no'],
      'amount': ['amt', 'amount', 'total amount'],
      'success': ['transaction successful', 'transaction success', 'successful transaction']
    }
  },
  PNB: {
    primary: ['TRANSACTION SUCCESSFUL', 'Ref. No', 'Bank Name', 'Transaction Type', 'Druk Pay'],
    fuzzy: {
      'reference': ['ref. no', 'reference no', 'ref no'],
      'bank': ['bank name', 'bank details'],
      'transaction': ['txn type', 'transaction type']
    }
  },
  Eteeru: {
    primary: ['Processed By', 'Merchant Name', 'Amount', 'Purpose', 'Transaction ID'],
    fuzzy: {
      'amount': ['amt', 'total amount'],
      'purpose': ['reason', 'description'],
      'transaction': ['txn id', 'transaction id', 'tid']
    }
  },
  BOB: {
    primary: ['MOBILE BANKING', 'mobile banking', 'mBOB', 'bob', 'successful', 'Successful', 'Purpose/Bill QR', 'Amt', 'Amount', 'Jrnl. No'],
    fuzzy: {
      'mobile': ['mobile banking', 'm-banking', 'mbob'],
      'purpose': ['purpose', 'bill qr', 'qr payment'],
      'amount': ['amt', 'amount', 'total'],
      'journal': ['jrnl. no', 'journal no', 'jrnl no']
    }
  },
  goBOB: {
    primary: ['Wallet Number', 'Amount', 'Merchant Bank', 'PAN Number', 'Purpose'],
    fuzzy: {
      'wallet': ['wallet number', 'wallet no'],
      'amount': ['amt', 'total amount'],
      'pan': ['pan number', 'pan no']
    }
  },
  DK: {
    primary: ['Transfer no', 'Amount', 'Beneficiary bank', 'Beneficiary name', 'Purpose', 'Remarks'],
    fuzzy: {
      'wallet': ['wallet number', 'transfer no', 'reference number'],
      'amount': ['amt', 'amount', 'total amount'],
      'purpose': ['purpose', 'remarks', 'reason', 'description'],
      'bank': ['beneficiary bank', 'merchant bank', 'bank details'],
      'name': ['beneficiary name', 'recipient name']
    }
  }
};

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
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
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
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
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
        
        // Try to get processing time from Vision API response first
        let totalProcessingTime;
        if (data.responses[0]?.latencyInfo?.totalLatencyMillis) {
            totalProcessingTime = data.responses[0].latencyInfo.totalLatencyMillis / 1000;
        } else {
            // Fallback to manual calculation
            const endTime = Date.now();
            totalProcessingTime = (endTime - startTime) / 1000;
        }

        const textResult = data.responses[0]?.fullTextAnnotation;
        const recognizedText = textResult?.text || '';
        const confidence = textResult?.pages?.[0]?.blocks?.reduce((acc, block) => 
            acc + block.confidence, 0) / (textResult?.pages?.[0]?.blocks?.length || 1);

        if (confidence > 0.7) {
            const bankKey = determineBankKey(recognizedText);
            console.log('recognizedText',recognizedText);
            const receiptData = parseReceiptData(recognizedText, bankKey);
            console.log('receiptData',receiptData);
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

// Export a serverless function handler for Vercel
export default function handler(req, res) {
    // Don't process favicon requests
    if (req.url === '/favicon.ico') {
        res.status(204).end();
        return;
    }

    // Handle all other requests through the Express app
    return app(req, res);
}

// If running locally, start the server
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
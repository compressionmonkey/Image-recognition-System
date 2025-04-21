import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import nlp from 'compromise';
import { google } from 'googleapis';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from 'multer';
import multerS3 from 'multer-s3';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

function formatCreatedTime() {
    const date = new Date();
    const dhakaTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    
    const day = String(dhakaTime.getDate()).padStart(2, '0');
    const month = String(dhakaTime.getMonth() + 1).padStart(2, '0');
    const year = dhakaTime.getFullYear();
    const hours = String(dhakaTime.getHours()).padStart(2, '0');
    const minutes = String(dhakaTime.getMinutes()).padStart(2, '0');
    const seconds = String(dhakaTime.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Modify your static file serving
app.use('/index.js', (req, res) => {
    if (process.env.NODE_ENV === 'development') {
        // In development, serve the original file
        res.sendFile(path.join(__dirname, 'public', 'index.js'));
    } else {
        // In production, serve the obfuscated file
        res.sendFile(path.join(__dirname, 'public', 'dist', 'index.min.js'));
    }
});

// Keep your other static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Map customer IDs to their sheet names in the main spreadsheet
const customerSheets = {
    'a8358': 'Ambient',      // CUSTOMER_1
    '0e702': 'Dhapa',    // CUSTOMER_2
    '571b6': 'RoofTop',    // CUSTOMER_3
    'be566': 'MeatShop',    // CUSTOMER_4
    '72d72': 'OmBakery',     // CUSTOMER_5
    'HFpuU': 'SunRiseBakery',     // CUSTOMER_6
    'eqmB4': 'JunctionMart',     // CUSTOMER_7
    't0Ctf': 'Customer8',     // CUSTOMER_8
    'ChQsf': 'Customer9',     // CUSTOMER_9
    'FVQbb': 'Customer10',     // CUSTOMER_10
};

function pickCustomerSheet(customerID) {
    switch(customerID) {
        case 'a8358':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_AMBIENT_ID;
        case '0e702':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_DHAPA_ID;
        case '571b6':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_ROOFTOP_ID;
        case 'be566':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_MEATSHOP_ID;
            case '72d72':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_OMBAKERY_ID;
        case 'HFpuU':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_SUNRISEBAKERY_ID;
        case 'eqmB4':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_JUNCTIONMART_ID;
        case 't0Ctf':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_CUSTOMER8_ID;
        case 'ChQsf':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_CUSTOMER9_ID;
        case 'FVQbb':
            return process.env.GOOGLE_SHEETS_SPREADSHEET_CUSTOMER10_ID;
    }
}

// Modify the writeToSheet function to include more error handling
async function writeToSheet(range, rowData, spreadsheetCustomerID) {
    try {
        console.log("Debug - rowData before sending:", JSON.stringify(rowData, null, 2));
        
        // Read and use service account credentials with better handling for control characters
        let credentials;
        try {
            // Clean the credentials string by removing control characters
            const credentialsString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            
            credentials = JSON.parse(credentialsString);
        } catch (parseError) {
            console.error('Error parsing credentials:', parseError);
            throw new Error('Invalid Google credentials format. Please check your environment variables.');
        }
        
        // Create JWT client using service account credentials
        const jwtClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        // Authorize the client
        await jwtClient.authorize();

        // Get the access token
        const token = await jwtClient.getAccessToken();

        const createdAt = formatCreatedTime();
        
        // Make the request to Google Sheets API
        const response = await axios({
            method: 'post',
            url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetCustomerID}/values/${range}:append?valueInputOption=USER_ENTERED`,
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json',
            },
            data: {
                majorDimension: "ROWS",
                values: [[
                    rowData['Reference Number'] || '',
                    false, //checked
                    rowData['Particulars'] || '',
                    rowData['Amount'] || '',
                    rowData['Bank'] || '',
                    createdAt,
                    rowData['Payment Method'] || '',
                    rowData['OCR Timestamp'] || '',
                    rowData['Recognized Text'] || '',
                    rowData['Receipt URL'] || ''
                ]]
            }
        });

        console.log('Write successful:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error writing to Google Sheets:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            details: error.stack
        });
        throw error;
    }
}

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
            Bank: bankData.bank,
            PaymentMethod: bankData.paymentMethod
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
    match = lowerDate.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-/](\d{1,2})\s*[,-/]?\s*(\d{4})/i);
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
        time: null,
        paymentMethod: "Bank Receipt",
        bank: bankKey
    };

    // Pass result object to helper functions
    findCurrency(text, result);
    findDate(text, result);
    findTime(text, result);
    
    // Handle bank-specific logic
    switch (bankKey) {
        case 'BNB':
            // Try to find RRN number first
            const rrnMatch = text.match(/RRN:?\s*(\d{12})/i);
            if (rrnMatch) {
                result.reference = rrnMatch[1];
            } else {
                // If no RRN, try to find Reference Number
                const refNoMatch = text.match(/Reference No:?\s*((?:\d{3}[A-Z]+\d+))/i);
                if (refNoMatch) {
                    result.reference = refNoMatch[1];
                }
            }
            break;

        case 'PNB':
            // Reference number
            const pnbRefMatch = text.match(/\b43\d{10}\b/);
            if (pnbRefMatch) {
                result.reference = pnbRefMatch[0];
            }
            break;

        case 'goBOB':
            // Reference number - try multiple patterns
            const gobobPatterns = [
                // Pattern 1: Transaction ID appearing directly after amount
                /Amount\s*(?::|Nu\.|\n|)*\s*.*?(?:\d+|\d[\d,\.]*\d)(?:\s*|\n)(\d{15,22})\b/i,
                
                // Pattern 2: Transaction ID with explicit label
                /Transaction ID\s*(?:\n|:|\s)*\s*(\d{5,6})/i,
                
                // Pattern 3: Processed By number pattern
                /Processed By\s*(?:\n|:|\s)*\s*(\d{8})/i
            ];
            
            // Variables to store components
            let processedBy = null;
            let transactionID = null;
            let prefix = null;
            
            // Extract processed by number
            const processedByMatch = text.match(gobobPatterns[2]);
            if (processedByMatch) {
                processedBy = processedByMatch[1];
            }
            
            // Extract transaction ID (short number)
            const transactionIDMatch = text.match(gobobPatterns[1]);
            if (transactionIDMatch) {
                transactionID = transactionIDMatch[1];
            }
            
            // Check for full transaction ID directly after amount
            const fullIDMatch = text.match(gobobPatterns[0]);
            if (fullIDMatch) {
                result.reference = fullIDMatch[1];
            }
            // If we have both processed by and transaction ID, construct the reference
            else if (processedBy && transactionID) {
                // Look for numeric sequence that could be the prefix
                // Try several approaches to find the prefix
                
                // Approach 1: Look for digits preceding the processed by number
                const prefixBeforeProcessedBy = text.match(new RegExp(`(\\d{6,9})(?:[^\\d]*?)${processedBy}`, 'i'));
                if (prefixBeforeProcessedBy) {
                    prefix = prefixBeforeProcessedBy[1];
                } 
                // Approach 2: Look for full ID pattern anywhere in text
                else {
                    const fullIDPatternAnywhere = text.match(new RegExp(`(\\d{6,9}${processedBy}\\d{5,6})`, 'i'));
                    if (fullIDPatternAnywhere) {
                        result.reference = fullIDPatternAnywhere[1];
                        return result;
                    }
                }
                
                // Approach 3: Look for digits near "Transaction ID" that aren't the transaction ID itself
                if (!prefix) {
                    const possiblePrefixes = [...text.matchAll(/\b(\d{6,9})\b/g)];
                    for (const possiblePrefix of possiblePrefixes) {
                        // Skip if it's part of processed by or transaction ID
                        if (possiblePrefix[1] !== processedBy && 
                            possiblePrefix[1] !== transactionID && 
                            !processedBy.includes(possiblePrefix[1]) && 
                            !transactionID.includes(possiblePrefix[1])) {
                            prefix = possiblePrefix[1];
                            break;
                        }
                    }
                }
                
                // Construct the reference if we found all components
                if (prefix) {
                    result.reference = `${prefix}${processedBy}${transactionID}`;
                }
                // Last resort: Search for any 21-23 digit number
                else {
                    const longNumberMatch = text.match(/\b(\d{21,23})\b/);
                    if (longNumberMatch) {
                        result.reference = longNumberMatch[1];
                    }
                }
            }
            
            // If all approaches failed, try one more pattern for long string of digits
            if (!result.reference) {
                // Match any string of 21-23 digits that might be the full reference
                const lastResortMatch = text.match(/\b(\d{21,23})\b/);
                if (lastResortMatch) {
                    result.reference = lastResortMatch[1];
                }
            }
            break;

        case 'BOB':
            // Journal Number - try multiple patterns
            const bobPatterns = [
                /(?:Jrnl\.?\s*No\.?:?\s*)(\d{6,7})/i,    // Matches "Jrnl. No: 447475" or "Jrnl. No: 4474755"
                /(?:Jml\.?\s*No\.?:?\s*)(\d{6,7})/i,      // Matches "Jml. No 447475" or "Jml. No 4474755"
                /(?:Jrnl\.?\s*No\n\s*:)(\d{6,7})/i,      // Matches "Jrnl. No\n:1226175"
                /Nu\.\s*\d+\.?\d*\s*\n\s*(\d{6,7})\b/i,  // Matches "Nu. 665.00\n1275106"
                /:\s*(\d{5,7})\b/i,                      // Modified to match 5-7 digits after colon
                /(?:Jrnl\.?\s*No\s*)(\d{6,7})\s*\.\.\./i, // Matches "Jrnl. No 1600516 ..."
                /\b(\d{6,7})\b(?=\s*(?:Amt|Amount))/i,    // Matches any 6-7 digits followed by Amt/Amount
                /Transaction Successful\s*\n\s*(\d{6})\b/i // Matches "Transaction Successful\n283108"
            ];

            // Try each pattern until we find a match
            for (const pattern of bobPatterns) {
                const match = text.match(pattern);
                if (match) {
                    result.reference = match[1];
                    break;
                }
            }
            break;
        case 'DK':
            // Try multiple patterns for Transfer Number
            const dkPatterns = [
                // Original pattern: Transfer No followed by digits
                /(?:Transfer\s*No\.?:?\s*)(\d{9,15})/i,
                
                // New pattern: Transfer na followed by digits 
                /(?:Transfer\s*na\s*)(\d{9,15})/i,
                
                // Pattern with escaped newlines
                /Transfer\s*(?:No|na)[\s\n]*(\d{9,15})/i,
                
                // Fallback pattern: just find a 12-digit number
                /\b(\d{12})\b/
            ];
            
            // Try each pattern until we find a match
            let transferNumber = null;
            for (const pattern of dkPatterns) {
                const match = text.match(pattern);
                if (match) {
                    transferNumber = match[1];
                    break;
                }
            }
            
            // If we found a match, use it
            if (transferNumber) {
                result.reference = transferNumber;
            }
            break;
        case 'TBank': {
            // Transaction ID - try multiple patterns
            const tbankPatterns = [
                /(?:Transaction\s*ID\.?:?\s*)(\d+)/i,    // Original pattern
                /\b(4\d{11})\b/,                         // Matches 12-digit number starting with 4
                /(?:Nu\.?\s*\d+\.?\d*\s*\n\s*)(4\d{11})\b/i,  // Matches amount followed by reference
                /(?:Account\s*\n\s*)(4\d{11})\b/i,      // Matches "Account" followed by reference
            ];

            // Try each pattern until we find a match
            for (const pattern of tbankPatterns) {
                const match = text.match(pattern);
                if (match) {
                    result.reference = match[1];
                    break;
                }
            }
            break;
        }
        case 'BDBL':
            // Try multiple patterns for RR Number
            const bdblPatterns = [
                /(?:RR\s*Number\s*\n?\s*:?\s*)(\d{12})/i,    // Matches "RR Number: 435913595114"
                /(?:RR\s*\.?:?\s*)(\d{12})/i,                // Matches "RR: 435913595114"
                /(?:Digital\s*Receipt\s*(?:No)?\.?\s*:?\s*)(\d{12})/i,  // Matches "Digital Receipt No: 435913595114"
                /(?:RR\s*Number\s*:?\s*)(\d{12})/i,          // Matches "RR Number: 435913595114" without newline
                /(?:Digital\s*Receipt\s*:?\s*)(\d{12})/i      // Matches "Digital Receipt: 435913595114"
            ];

            // Try each pattern until we find a match
            for (const pattern of bdblPatterns) {
                const match = text.match(pattern);
                if (match) {
                    result.reference = match[1];
                    break;
                }
            }
            break;
    }

    return result;
}

// Define the bank keys with primary and fuzzy matches
const BANK_KEYS = {
  BNB: {
    primary: ['RRN', 'TRANSACTION SUCCESSFUL', 'Amount', 'Reference No'],
    fuzzy: {
      'reference': ['RRN', 'reference no', 'ref no', 'ref.no'],
      'amount': ['amt', 'amount', 'total amount'],
      'success': ['transaction successful', 'transaction success', 'successful transaction'],
      'remarks': ['remarks', 'Remarks'],
      'Time': ['Time', 'time']
    }
  },
  BOB: {
    primary: ['MOBILE BANKING', 'mobile banking', 'mBOB', 'TRANSACTION SUCCESSFUL', 'Purpose/Bill QR', 'Amt', 'Amount', 'Jrnl. No'],
    fuzzy: {
      'mobile': ['mobile banking', 'm-banking', 'mbob'],
      'purpose': ['purpose', 'bill qr', 'qr payment'],
      'amount': ['amt', 'amount'],
      'journal': ['jrnl. no', 'journal no', 'jrnl no'],
      'Success': ['transaction successful']
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
  goBOB: {
    primary: ['Wallet Number', 'Amount', 'Merchant Bank', 'Processed By', 'Purpose'],
    fuzzy: {
      'Date & Time': ['Date & Time', 'date & time'],
      'amount': ['amt', 'amount'],
      'Transaction ID': ['Transaction ID']
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
  },
  TBank: {
    primary: ['Amount', 'Your fund transfer is successful', 'Transaction ID', 'Do Another Transaction'],
    fuzzy: {
      'amount': ['amt', 'Amount'],
      'transaction': ['transaction id', 'Transaction ID'],
      'question': ['Do Another Transaction']
    }
  },
  BDBL: {
    primary: ['Transfer Amount', 'RR Number', 'Transfer Purpose'],
    fuzzy: {
      'amount': ['transfer amount', 'Transfer Amount'],
      'transaction': ['digitial receipt no', 'Digitial Receipt No', 'RR Number', 'rr number'],
      'Success': ['Payment Successful']
    }
  }
};

// Function to check and get current user's table name
function checkCurrentUser(customerID) {
    const tableName = customerSheets[customerID];
    if (!tableName) {
        throw new Error('Invalid customer ID or sheet ID not found');
    }
    return tableName;
}

// Update receipt data function
async function updateReceiptData(receiptData) {
    console.log('receiptData', receiptData);
    try {
        const sheetId = customerSheets[receiptData.customerID];
        if (!sheetId) {
            throw new Error('Invalid customer ID or sheet ID not found');
        }
        const spreadsheetCustomerID = pickCustomerSheet(receiptData.customerID);
        // Format data for Google Sheets as an object
        const rowData = {
            'OCR Timestamp': receiptData['OCR Timestamp'],
            'Reference Number': receiptData.referenceNo,
            'Amount': receiptData.amount,
            'Recognized Text': receiptData['Recognized Text'],
            'Payment Method': receiptData['Payment Method'],
            'Bank': receiptData['Bank'],
            'Particulars': receiptData['Particulars'],
            'Receipt URL': receiptData['Receipt URL']
        };

        await writeToSheet(`${sheetId}!A:H`, rowData, spreadsheetCustomerID);
        return true;
    } catch (error) {
        console.error('Error updating receipt data:', error);
        return false;
    }
}

// Configure multer with S3 storage
const s3Upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const customerID = req.body.customerID;
      try {
        const tableName = checkCurrentUser(customerID);
        const timestamp = Date.now();
        const index = req.filesProcessed || 0;
        req.filesProcessed = index + 1;
        const uniqueFilename = `receipts/${tableName}/${timestamp}_${index}_${file.originalname}`;
        cb(null, uniqueFilename);
      } catch (error) {
        cb(new Error('Invalid customer ID'));
      }
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Max 10 files
  }
});

// Enhanced function for bulk receipt data updates (now independent of endpoint)
async function updateReceiptDataBulk(receiptDataArray) {
    console.log(`Processing ${receiptDataArray.length} receipts in bulk`);
    
    // Track results for each receipt
    const results = [];
    
    // Process receipts sequentially to avoid potential rate limiting with Google Sheets API
    for (let i = 0; i < receiptDataArray.length; i++) {
        const receiptData = receiptDataArray[i];
        try {
            // Get sheet ID for this customer
            const sheetId = customerSheets[receiptData.customerID];
            if (!sheetId) {
                results.push({
                    success: false,
                    error: 'Invalid customer ID or sheet ID not found',
                    receiptId: receiptData.referenceNo || 'Unknown',
                    amount: receiptData.amount || '0.00'
                });
                continue; // Skip to next receipt
            }
            
            const spreadsheetCustomerID = pickCustomerSheet(receiptData.customerID);
            
            // Format data for Google Sheets
            const rowData = {
                'OCR Timestamp': receiptData['OCR Timestamp'] || new Date().toISOString(),
                'Reference Number': receiptData.referenceNo || 'MANUAL',
                'Amount': receiptData.amount,
                'Recognized Text': receiptData['Recognized Text'] || '',
                'Payment Method': receiptData['Payment Method'] || 'Bank Receipt',
                'Bank': receiptData['Bank'] || 'Unknown',
                'Particulars': receiptData['Particulars'] || '',
                'Receipt URL': receiptData['Receipt URL']
            };

            // Write to sheet with error handling
            await writeToSheet(`${sheetId}!A:H`, rowData, spreadsheetCustomerID);
            
            // Record success
            results.push({
                success: true,
                receiptId: receiptData.referenceNo || 'MANUAL',
                amount: receiptData.amount
            });
        } catch (error) {
            console.error(`Error updating receipt data at index ${i}:`, error);
            // Record failure but continue processing others
            results.push({
                success: false,
                error: error.message || 'Unknown error occurred',
                receiptId: receiptData.referenceNo || 'Unknown',
                amount: receiptData.amount || '0.00'
            });
        }
    }
    
    // Return comprehensive results
    return {
        totalProcessed: receiptDataArray.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results: results
    };
}

// Updated endpoint to handle both file uploads and data processing
app.post('/upload-multiple-receipts-form', (req, res, next) => {
  // Initialize file counter
  req.filesProcessed = 0;
  next();
}, s3Upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const customerID = req.body.customerID;
    if (!customerID) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    // Parse the metadata JSON
    let metadata = [];
    try {
      if (req.body.metadata) {
        metadata = JSON.parse(req.body.metadata);
      }
    } catch (err) {
      console.error('Error parsing metadata:', err);
      return res.status(400).json({
        success: false,
        error: 'Invalid metadata format'
      });
    }

    // Generate signed URLs for each file
    const results = await Promise.all(req.files.map(async (file, index) => {
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: file.key
      });
      
      const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { 
        expiresIn: 3600 // 1 hour expiration
      });
      
      return {
        url: signedUrl,
        key: file.key,
        originalName: file.originalname,
        size: file.size,
        index: index
      };
    }));
    
    // Extract URLs and keys
    const urls = results.map(result => result.url);
    const keys = results.map(result => result.key);
    
    // Prepare receipt data for each file if metadata exists
    const receiptsToProcess = [];
    
    if (metadata.length > 0) {
      // Match metadata with file URLs
      for (let i = 0; i < Math.min(metadata.length, urls.length); i++) {
        const fileData = metadata[i];
        
        // Skip invalid entries
        if (!fileData || !fileData.amount) continue;
        
        receiptsToProcess.push({
          customerID: customerID,
          amount: fileData.amount,
          referenceNo: fileData.reference || 'MANUAL',
          'Particulars': fileData.particulars || '',
          'OCR Timestamp': fileData.date || new Date().toISOString().split('T')[0],
          'Payment Method': 'Bank Receipt',
          'Bank': fileData.ocrData?.Bank || 'Unknown',
          'Recognized Text': fileData.ocrData?.recognizedText || '',
          'Receipt URL': urls[i]
        });
      }
      
      // Process the receipts if we have any valid ones
      if (receiptsToProcess.length > 0) {
        const sheetResults = await updateReceiptDataBulk(receiptsToProcess);
        
        // Return both upload and sheet writing results
        res.json({
          success: true,
          urls: urls,
          keys: keys,
          files: results,
          count: req.files.length,
          sheetResults: sheetResults
        });
      } else {
        // Just return the upload results if no valid receipts to process
        res.json({
          success: true,
          urls: urls,
          keys: keys,
          files: results,
          count: req.files.length,
          message: 'Files uploaded but no valid metadata for sheet processing'
        });
      }
    } else {
      // If no metadata, just return the upload results
      res.json({
        success: true,
        urls: urls,
        keys: keys,
        files: results,
        count: req.files.length
      });
    }
  } catch (error) {
    console.error('S3 upload or sheet processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process uploads',
      details: error.message
    });
  }
});

app.post('/vision-api', async (req, res) => {
    const imageBase64 = req.body.image;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    const start = Date.now(); // Start time

    try {
        const response = await axios({
            method: 'post',
            url: `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
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
            }
        });
        const totalDuration = Date.now() - start;

        const data = response.data;

        const textResult = data.responses[0]?.fullTextAnnotation;
        const recognizedText = textResult?.text || '';
        const confidence = textResult?.pages?.[0]?.blocks?.reduce((acc, block) => 
            acc + block.confidence, 0) / (textResult?.pages?.[0]?.blocks?.length || 1);

        if (confidence > 0.7) {
            const bankKey = determineBankKey(recognizedText);
            console.log('recognizedText (raw):', recognizedText);
            console.log('recognizedText (formatted):', JSON.stringify(recognizedText, null, 2)
                .replace(/\\n/g, '\n')
                .replace(/^"|"$/g, '')
            );
            const receiptData = parseReceiptData(recognizedText, bankKey);
            console.log('receiptData',receiptData);
            // Send only the essential data
            const isReceipt = receiptData.Amount || receiptData.ReferenceNo || receiptData.Bank !== 'Unknown';
            console.log('isReceipt', isReceipt);
            if(isReceipt) {
                res.json({
                    amount: receiptData.Amount,
                    referenceNo: receiptData.ReferenceNo,
                    Date: receiptData.Date,
                    Time: receiptData.Time,
                    PaymentMethod: receiptData.PaymentMethod,
                    Bank: receiptData.Bank,
                    recognizedText,
                    processingTimeMs: totalDuration
                    });
                    return;
            } else {
                res.status(400).json({
                    error: 'No receipt detected',
                    message: 'Please try again with a clearer image.'
                });
                return;
            }
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
        console.error('Error:', error);
        res.status(500).send('Error calling Vision API');
    }
});

// Add this new endpoint for recording cash transactions
app.post('/record-cash', async (req, res) => {
    const { amount, paymentMethod, customerID, particulars } = req.body;
    const spreadsheetCustomerID = pickCustomerSheet(customerID);
    const sheetId = customerSheets[customerID];
    try {
        // Basic validation
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a positive number'
            });
        }

        // Get customer's table name
        const tableName = checkCurrentUser(customerID);
        if (!tableName) {
            throw new Error('Invalid customer ID or table name not found');
        }

        // Create record for Google Sheets
        const rowData = {
            'Particulars': particulars,
            'Amount': amount,
            'Payment Method': paymentMethod,
        };

        console.log("Debug - rowData before sending:", JSON.stringify(rowData, null, 2));
        console.log("Debug - sheetId: ", sheetId, "rowData: ", rowData, "spreadsheetCustomerID: ", spreadsheetCustomerID);
        await writeToSheet(`${sheetId}!A:I`, rowData, spreadsheetCustomerID);

        res.status(200).json({
            success: true,
            message: 'Cash record stored successfully',
            data: {
                amount,
                paymentMethod,
                particulars,
                timestamp: formatCreatedTime()
            }
        });

    } catch (error) {
        console.error('Error recording cash:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
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

app.post('/upload-receipt', async (req, res) => {
    try {
        const { imageData, filename, customerID } = req.body;
        
        // Convert base64 to buffer
        const buffer = Buffer.from(imageData, 'base64');
        
        // Generate unique filename
        const timestamp = Date.now();
        const tableName = checkCurrentUser(customerID);
        const uniqueFilename = `receipts/${tableName}/${timestamp}_${filename}`;
        
        // Set up S3 upload parameters
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uniqueFilename,
            Body: buffer,
            ContentType: 'image/jpeg'
        };

        // Upload to S3
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Generate pre-signed URL
        const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uniqueFilename
        });
        
        const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { 
            expiresIn: 3600 // URL valid for 1 hour
        });

        res.json({
            success: true,
            url: signedUrl,
            key: uniqueFilename // Store this if you need to generate new URLs later
        });

        // Generate URL
        // const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFilename}`;

        // res.json({
        //     success: true,
        //     url: imageUrl
        // });

    } catch (error) {
        console.error('S3 upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
});

app.get('/get-daily-images', async (req, res) => {
    const { customerID, date } = req.query;
    try {
        const tableName = checkCurrentUser(customerID);
        let allContents = [];
        let continuationToken = undefined;
        // Loop until we get all objects

        do {
            const command = new ListObjectsV2Command({
                Bucket: process.env.AWS_BUCKET_NAME,
                Prefix: `receipts/${tableName}/`,
                ContinuationToken: continuationToken
            });

            const data = await s3Client.send(command);
            allContents = [...allContents, ...(data.Contents || [])];
            continuationToken = data.NextContinuationToken;
        } while (continuationToken);
        // Create target date in Dhaka timezone once
        const targetDateDhaka = new Date(date ? date : new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
        targetDateDhaka.setHours(0, 0, 0, 0);
        const selectedDateImages = [];
        let index = 0;
        for (const object of allContents) {
            // First conversion to Dhaka time
            const bdFileDate = new Date(object.LastModified.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
            // Compare dates using simple date comparison after timezone conversion
            const isSameDate = bdFileDate.getFullYear() === targetDateDhaka.getFullYear() && bdFileDate.getMonth() === targetDateDhaka.getMonth() && bdFileDate.getDate() === targetDateDhaka.getDate();

            if (isSameDate) {
                const [viewUrl, downloadUrl] = await Promise.all([
                    getSignedUrl(s3Client, new GetObjectCommand({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: object.Key,
                        ResponseContentType: 'image/jpeg',
                        ResponseContentDisposition: 'inline',
                        ResponseCacheControl: 'public, max-age=3600'
                    }), { expiresIn: 3600 }),
                    getSignedUrl(s3Client, new GetObjectCommand({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: object.Key,
                        ResponseContentDisposition: `attachment; filename="${object.Key.split('/').pop()}"`,
                        ResponseCacheControl: 'private, no-cache'
                    }), { expiresIn: 3600 })
                ]);

                const metadata = await s3Client.send(new HeadObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: object.Key
                }));

                // Don't specify timezone again in timestamp formatting since bdFileDate is already in Dhaka time
                const timestamp = bdFileDate.toLocaleString('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true
                });

                selectedDateImages.push({
                    id: object.LastModified.getTime(),
                    viewUrl,
                    downloadUrl,
                    timestamp,
                    size: formatFileSize(metadata.ContentLength),
                    filename: object.Key.split('/').pop(),
                    lastModified: bdFileDate.toISOString(),
                    index: index++
                });
            }
        }

        // Sort by LastModified timestamp (newest first)
        selectedDateImages.sort((a, b) => b.id - a.id);
        res.json({
            success: true,
            images: selectedDateImages,
            count: selectedDateImages.length,
            date: targetDateDhaka.toLocaleDateString('en-US', {
                timeZone: 'Asia/Dhaka',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        });

    } catch (error) {
        console.error('Error fetching daily images:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch daily images'
        });
    }
});



// Helper function to format file sizes

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

app.post('/multiple-vision-api', async (req, res) => {
    const { images, customerID, deviceInfo, screenResolution, paymentMethod, startTime } = req.body;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No images provided or invalid image format'
        });
    }

    try {
        // First upload all images to S3 and get the URLs
        const imagesWithS3Urls = await Promise.all(images.map(async (img, index) => {
            try {
                // Convert base64 to buffer
                const buffer = Buffer.from(img.image, 'base64');
                // Generate unique filename
                const timestamp = Date.now();
                let tableName;

                try {
                    tableName = checkCurrentUser(customerID);
                } catch (e) {
                    // Fall back to 'unknown' if customer ID is invalid
                    tableName = 'unknown';
                }

                const uniqueFilename = `receipts/${tableName}/${timestamp}_${index}_${img.filename || 'receipt.jpg'}`;
                // Set up S3 upload parameters

                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: uniqueFilename,
                    Body: buffer,
                    ContentType: 'image/jpeg'
                };

                // Upload to S3
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);

                // Generate pre-signed URL
                const getObjectCommand = new GetObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: uniqueFilename
                });

                const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { 
                    expiresIn: 86400 // URL valid for 24 hours
                });

                return {
                    ...img,
                    imageUrl: signedUrl,
                    imageFileName: uniqueFilename
                };

            } catch (error) {
                console.error(`Error uploading image ${index} to S3:`, error);
                // Return the original image without S3 details
                return img;
            }
        }));
        // Prepare the API request for Google Vision API
        // This is a batch request with multiple images in one call
        const requests = imagesWithS3Urls.map(img => ({
            image: {
                content: img.image
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
        }));

        // Make the API call with all images in one request using axios
        const response = await axios({
            method: 'post',
            url: `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                requests: requests
            }
        });

        const data = response.data;

        // Process each image's results
        const resultsArray = [];
        
        if (data.responses && Array.isArray(data.responses)) {
            // Process each response
            for (let i = 0; i < data.responses.length; i++) {
                const textResult = data.responses[i]?.fullTextAnnotation;
                const recognizedText = textResult?.text || '';
                const confidence = textResult?.pages?.[0]?.blocks?.reduce((acc, block) => 
                    acc + block.confidence, 0) / (textResult?.pages?.[0]?.blocks?.length || 1);
                
                // Only process if confidence is high enough
                if (confidence > 0.7) {
                    const bankKey = determineBankKey(recognizedText);
                    const receiptData = parseReceiptData(recognizedText, bankKey);
                    
                    // Check if this is actually a receipt
                    const isReceipt = receiptData.Amount || receiptData.ReferenceNo || receiptData.Bank !== 'Unknown';
                    
                    if (isReceipt) {
                        // Add the corresponding image filename, index, and S3 URL
                        resultsArray.push({
                            index: imagesWithS3Urls[i].index,
                            filename: imagesWithS3Urls[i].filename,
                            imageUrl: imagesWithS3Urls[i].imageUrl,
                            imageFileName: imagesWithS3Urls[i].imageFileName,
                            amount: receiptData.Amount,
                            referenceNo: receiptData.ReferenceNo,
                            Date: receiptData.Date,
                            Time: receiptData.Time,
                            PaymentMethod: receiptData.PaymentMethod,
                            Bank: receiptData.Bank,
                            recognizedText
                        });
                    } else {
                        // Add a failed result
                        resultsArray.push({
                            index: imagesWithS3Urls[i].index,
                            filename: imagesWithS3Urls[i].filename,
                            imageUrl: imagesWithS3Urls[i].imageUrl,
                            imageFileName: imagesWithS3Urls[i].imageFileName,
                            error: 'No receipt data detected',
                            recognizedText
                        });
                    }
                } else {
                    // Add a failed result due to low confidence
                    resultsArray.push({
                        index: imagesWithS3Urls[i].index,
                        filename: imagesWithS3Urls[i].filename,
                        imageUrl: imagesWithS3Urls[i].imageUrl,
                        imageFileName: imagesWithS3Urls[i].imageFileName,
                        error: 'Text confidence score is below threshold',
                        confidence: confidence,
                        threshold: 0.7
                    });
                }
            }
            
            // Return the combined results
            if (resultsArray.length > 0) {
                // Return the first successful result as the primary result
                // and include all results in the array
                const primaryResult = resultsArray.find(r => !r.error) || resultsArray[0];
                
                res.json({
                    success: true,
                    primaryResult: primaryResult,
                    allResults: resultsArray,
                    count: resultsArray.length,
                    successCount: resultsArray.filter(r => !r.error).length
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No valid receipts detected in any of the images',
                    results: resultsArray
                });
            }
        } else {
            res.status(400).json({
                success: false,
                error: 'Invalid response from Vision API',
                details: data
            });
        }
    } catch (error) {
        console.error('Error processing multiple images:', error);
        res.status(500).json({
            success: false,
            error: 'Error processing multiple images',
            details: error.message
        });
    }
});

// Export the app for potential serverless environments (like Vercel)
export default app;

// Start the server for traditional hosting (like Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`));
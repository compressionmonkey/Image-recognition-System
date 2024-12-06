import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import Airtable from 'airtable';
import { log } from '@vercel/node';

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

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Add this function to determine bank type and get reference number
function categorizeBank(text) {
    const result = {
        bankType: null,
        referenceNo: null
    };

    // First check for BNB (Bhutan National Bank)
    const twelveDigitMatch = text.match(/(?<![\dA-Za-z])(\d{12})(?![\dA-Za-z])/g);
    const hasRRN = text.match(/RRN/i);
    
    if (twelveDigitMatch && hasRRN) {
        // Filter out numbers that come after letters (like MFTR243031165)
        const validNumbers = twelveDigitMatch.filter(num => {
            const beforeNumber = text.substring(text.indexOf(num) - 5, text.indexOf(num));
            return !beforeNumber.match(/[A-Za-z]+$/);
        });
        
        if (validNumbers.length > 0) {
            result.bankType = 'BNB';
            result.referenceNo = validNumbers[0];  // Take the first valid 12-digit number
            return result;
        }
    }

    // Then check for BOB (Bank of Bhutan) - first priority: 6-8 digit number
    const digitMatch = text.match(/(\d{6,8})/);
    if (digitMatch) {
        result.bankType = 'BOB';
        result.referenceNo = digitMatch[1];
        return result;
    }
    
    // BOB second priority: JXX No pattern
    const jxxMatch = text.match(/J[A-Za-z]{2}\s*No/i);
    if (jxxMatch) {
        result.bankType = 'BOB';
        result.referenceNo = jxxMatch[0];
        return result;
    }

    return result;
}

// Update the parseReceiptData function
function parseReceiptData(text) {
    try {
        const bankInfo = categorizeBank(text);
        log.info('Bank categorization:', bankInfo);

        // Initialize result object with bank type
        const result = {
            Timestamp: null,
            ReferenceNo: bankInfo.referenceNo, // Use the reference number from bank categorization
            BankType: bankInfo.bankType,       // Add bank type to the result
            Amount: null,
            FromAccount: null,
            ToAccount: null,
            Purpose: null,
            Remarks: null
        };

        // Split text into lines for easier processing
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const nextLine = lines[i + 1]?.trim() || '';

            // Amount (Look for N/n followed by any single character and period)
            const amountMatch = line.match(/[Nn][^.]\.\s*([\d,]+\.?\d*)/);
            if (amountMatch && !result.Amount) {
                result.Amount = amountMatch[1].replace(/,/g, '');
            }

            // Timestamp
            const dateMatch = line.match(/Date\s*[:.]\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i);
            const timeMatch = line.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM)?)?)/i);
            
            if (dateMatch && timeMatch && !result.Timestamp) {
                result.Timestamp = `${dateMatch[1]} ${timeMatch[1]}`;
            }

            // Account Numbers
            const fromAccMatch = line.match(/From\s*A\/c\s*[:.]\s*(\d+[X\d]*\d+)/i);
            if (fromAccMatch && !result.FromAccount) {
                result.FromAccount = fromAccMatch[1];
            }

            const toAccMatch = line.match(/To\s*A\/c\s*[:.]\s*(\d+[X\d]*\d+)/i);
            if (toAccMatch && !result.ToAccount) {
                result.ToAccount = toAccMatch[1];
            }

            // Purpose
            const purposeMatch = line.match(/Purpose\s*[:.]\s*(.*)/i);
            if (purposeMatch && !result.Purpose) {
                result.Purpose = purposeMatch[1].trim();
                if (nextLine && !nextLine.includes(':')) {
                    result.Purpose += ' ' + nextLine;
                }
            }

            // Remarks (BNB specific)
            if (result.BankType === 'BNB') {
                const remarksMatch = line.match(/Remarks\s*[:.]\s*(.*)/i);
                if (remarksMatch && !result.Remarks) {
                    result.Remarks = remarksMatch[1].trim();
                    if (nextLine && !nextLine.includes(':')) {
                        result.Remarks += ' ' + nextLine;
                    }
                }
            }
        }

        // Use current timestamp if none found
        if (!result.Timestamp) {
            result.Timestamp = formatDate(new Date());
        }

        log.info('Parsed Receipt Data:', result);
        return result;
    } catch (error) {
        console.error('Error parsing receipt:', error);
        return {
            Timestamp: formatDate(new Date()),
            ReferenceNo: 'ERROR',
            BankType: null,
            Amount: '0.00',
            FromAccount: null,
            ToAccount: null,
            Purpose: null,
            Remarks: null
        };
    }
}
const Banks = ['BOB', 'BNB', 'BDBL', 'PNBL', 'DK Bank', 'Eteeru'];

function getBank(BankSelected){
    return Banks.find((bank) => bank == BankSelected);
}

// Define the bank keys
const BANK_KEYS = {
    BNB_Key: ['Reference No', 'RRN', 'From', 'To', 'Time', 'Remark'],
    BOB_Key: ['Jrnl No', 'Jrnl. No', 'From A/C', 'Purpose', 'Date', 'Amt', 'To'],
    Eteeru_Key: ['Processed By', 'Sender Name', 'Merchant Name', 'Merchant Bank', 'Amount', 'Transaction ID', 'Date & Time'],
    unKnown_Key: ['Wallet Number', 'PAN Number', 'Merchant Name', 'Merchant Bank', 'Amount', 'Purpose'],
    PNB_Key: ['Amount', 'From', 'To', 'Bank Name', 'Remarks', 'Ref. No.', 'Ref No', 'Date and Time', 'Transaction Type']
  };
  
  /**
   * Function to determine the matching bank key
   * @param {string} paragraph - The input text to analyze
   * @returns {string} - The matching bank key or 'Unknown'
   */
  function determineBankKey(paragraph) {
    // Normalize the input text
    const inputText = paragraph.toLowerCase();
    
    // Track the highest match count and corresponding key
    let maxMatches = 0;
    let matchingBankKey = 'Unknown';
  
    // Iterate over each bank key set
    for (const [bankKey, keywords] of Object.entries(BANK_KEYS)) {
      let matchCount = 0;
  
      // Count matches for each keyword in the input text
      keywords.forEach(keyword => {
        if (inputText.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      });
  
      // Update the matching key if a higher match count is found
      if (matchCount > maxMatches && inputText.length > 30) {
        maxMatches = matchCount;
        matchingBankKey = bankKey;
      }
    }
  
    return matchingBankKey;
  }

// Function to check and get current user's table name
function checkCurrentUser(customerID) {
    const tableName = customerTables[customerID];
    if (!tableName) {
        throw new Error('Invalid customer ID or table name not found');
    }
    return tableName;
}

// Update the updateReceiptData function to use checkCurrentUser
async function updateReceiptData(customerID, receiptData) {
    try {
        const tableName = checkCurrentUser(customerID);

        const record = {
            fields: {
                'Timestamp': receiptData.Timestamp,
                'Reference Number': receiptData.ReferenceNo,
                'Amount': receiptData.Amount
            }
        };

        log.info(`Updating receipt data for ${tableName}:`, JSON.stringify(record, null, 2));
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
        log.info('Receipt data updated successfully');
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

        log.info(`Updating analytics for ${tableName}:`, JSON.stringify(record, null, 2));
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base(tableName).create([record]);
        log.info('Analytics updated successfully');
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
        log.info('Received request for Vision API');
        
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

        log.info('herertjhajksfdhhjk', JSON.stringify(data))
        
        // Try to get processing time from Vision API response first
        let totalProcessingTime;
        if (data.responses[0]?.latencyInfo?.totalLatencyMillis) {
            totalProcessingTime = data.responses[0].latencyInfo.totalLatencyMillis / 1000;
            log.info('Using Vision API latency:', totalProcessingTime);
        } else {
            // Fallback to manual calculation
            const endTime = Date.now();
            totalProcessingTime = (endTime - startTime) / 1000;
            log.info('Using manual latency calculation:', totalProcessingTime);
        }

        const textResult = data.responses[0]?.fullTextAnnotation;
        const recognizedText = textResult?.text || '';
        const confidence = textResult?.pages?.[0]?.blocks?.reduce((acc, block) => 
            acc + block.confidence, 0) / (textResult?.pages?.[0]?.blocks?.length || 1);

        if (confidence > 0.7) {
            log.info('determineBankKey ', determineBankKey(recognizedText));
            const receiptData = parseReceiptData(recognizedText);
            await updateReceiptData(customerID, receiptData);

            log.info('Processing time details:', {
                apiProvidedLatency: data.responses[0]?.latencyInfo?.totalLatencyMillis ? 'yes' : 'no',
                totalProcessingTimeSeconds: totalProcessingTime
            });

            await updateAnalytics(customerID, {
                ProcessingTimeSeconds: totalProcessingTime,
                DeviceInfo: req.body.deviceInfo || req.headers['user-agent'],
                ImageSizeMb: (req.body.imageSize / 1024 / 1024).toFixed(2),
                Success: 'true',
                ErrorMessage: ''
            });

            res.json(data);
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
        log.info(JSON.stringify({
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
        log.info('Cash record request:', {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log.info(`Server running on port ${PORT}`));

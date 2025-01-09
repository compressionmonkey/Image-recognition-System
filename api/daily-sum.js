import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apptAcEDVua80Ab5c'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        console.log('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get current date in Dhaka timezone using direct conversion
        const dhakaDate = new Date(new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka'
        }));
        
        console.log('Cron job running at Dhaka time:', dhakaDate.toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka'
        }));
        
        const formattedDate = `${dhakaDate.getDate()}/${dhakaDate.getMonth() + 1}/${dhakaDate.getFullYear()}`;
        
        const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);
        await base('Ambient Sum Logic').create([
            {
                fields: {
                    'Name': `Sum ${formattedDate}`
                }
            }
        ]);

        console.log('Successfully created record for:', formattedDate);
        return res.status(200).json({ 
            success: true, 
            message: `Created sum record for ${formattedDate}` 
        });
    } catch (error) {
        console.error('Error in daily sum job:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
} 
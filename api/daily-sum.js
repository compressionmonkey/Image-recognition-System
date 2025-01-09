import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apptAcEDVua80Ab5c'; 

export default async function handler(req, res) {
    // Log all headers for debugging
    console.log('Request headers:', req.headers);
    
    // Verify it's a cron request
    const isCronRequest = req.headers['x-vercel-cron'] === '1';
    
    if (req.method !== 'POST') {
        console.error('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Log the request source
    console.log('Request source:', isCronRequest ? 'Vercel Cron' : 'Manual Request');

    try {
        const dhakaDate = new Date(new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Dhaka'
        }));
        
        console.log('Cron execution:', {
            isCronRequest,
            executionTime: new Date().toISOString(),
            dhakaTime: dhakaDate.toISOString(),
        });

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
        console.error('Cron error:', error);
        return res.status(500).json({ error: error.message });
    }
} 
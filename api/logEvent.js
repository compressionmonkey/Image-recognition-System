export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { level, message, timestamp, customerID } = req.body;

        // Log to Vercel's console (visible in Vercel logs)
        console.log(JSON.stringify({
            timestamp: timestamp || new Date().toISOString(),
            customerID,
            message
        }));

        res.status(200).json({ success: true });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

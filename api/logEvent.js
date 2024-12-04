export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { message } = req.body;

        // Log to Vercel's console (visible in Vercel logs)
        console.log(message);

        res.status(200).json({ success: true });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

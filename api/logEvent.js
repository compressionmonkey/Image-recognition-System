export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method === 'POST') {
        try {
            const { message } = await req.json();
            
            // Log to Vercel's console
            console.log('[Event Log]:', message);

            return new Response(
                JSON.stringify({ success: true }), 
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (error) {
            console.error('[Log Event Error]:', error);
            return new Response(
                JSON.stringify({ success: false, error: error.message }), 
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    }

    return new Response(
        JSON.stringify({ error: `Method ${req.method} Not Allowed` }), 
        {
            status: 405,
            headers: {
                'Allow': ['POST'],
                'Content-Type': 'application/json',
            },
        }
    );
}

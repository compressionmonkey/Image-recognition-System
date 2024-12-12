import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

async function generateBuildId() {
    // Generate a timestamp-based build ID
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function updateHtml(buildId) {
    const htmlPath = path.join(process.cwd(), 'public', 'index.html');
    let html = await fs.readFile(htmlPath, 'utf8');
    
    // Add build ID as query parameter
    html = html.replace('style.css', `style.css?v=${buildId}`);
    html = html.replace('index.js', `index.js?v=${buildId}`);
    
    await fs.writeFile(htmlPath, html);
}

async function main() {
    try {
        const buildId = await generateBuildId();
        await updateHtml(buildId);
        console.log('Build ID generated and files updated:', buildId);
    } catch (error) {
        console.error('Build script error:', error);
        process.exit(1);
    }
}

main();

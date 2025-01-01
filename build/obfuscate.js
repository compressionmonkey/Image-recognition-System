import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs/promises';

async function obfuscateClientCode() {
    try {
        // Read the original client JS file
        const sourceCode = await fs.readFile('public/index.js', 'utf8');

        // Configure obfuscation options
        const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.7,
            numbersToExpressions: true,
            simplify: true,
            stringArrayShuffle: true,
            splitStrings: true,
            stringArrayThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: true,
            debugProtectionInterval: 2000,
            disableConsoleOutput: false, // Set to true in production
            selfDefending: true,
            stringArray: true,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
        });

        // Create dist directory if it doesn't exist
        await fs.mkdir('public/dist', { recursive: true });

        // Write the obfuscated code to a new file
        await fs.writeFile('public/dist/index.min.js', obfuscationResult.getObfuscatedCode());
        
        console.log('✅ JavaScript obfuscation completed successfully!');
    } catch (error) {
        console.error('❌ Error during obfuscation:', error);
        process.exit(1);
    }
}

obfuscateClientCode(); 
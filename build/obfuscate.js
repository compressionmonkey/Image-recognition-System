import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs/promises';
import path from 'path';

async function obfuscateClientCode() {
    try {
        console.log('Starting JavaScript obfuscation...');
        
        // Read the original client JS file
        const sourceCode = await fs.readFile('public/index.js', 'utf8');
        console.log('Source code loaded successfully');

        // Enhanced obfuscation options for API security
        const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.8,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.5,
            debugProtection: true,
            debugProtectionInterval: 3000,
            disableConsoleOutput: true,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            rotateStringArray: true,
            selfDefending: true,
            shuffleStringArray: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 5,
            stringArray: true,
            stringArrayEncoding: ['rc4'],
            stringArrayThreshold: 0.8,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
        });

        // Create dist directory if it doesn't exist
        await fs.mkdir('public/dist', { recursive: true });

        // Write the obfuscated code
        await fs.writeFile('public/dist/index.min.js', obfuscationResult.getObfuscatedCode());
        
        console.log('✅ JavaScript obfuscation completed successfully!');
        
        // Optional: Write source map for development
        if (process.env.NODE_ENV === 'development') {
            await fs.writeFile(
                'public/dist/index.min.js.map', 
                obfuscationResult.getSourceMap()
            );
        }
    } catch (error) {
        console.error('❌ Error during obfuscation:', error);
        process.exit(1);
    }
}

obfuscateClientCode(); 
import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs/promises';
import path from 'path';

async function obfuscateClientCode() {
    try {
        console.log('🚀 Starting JavaScript obfuscation...');
        
        const sourceFilePath = 'public/index.js';
        const outputFilePath = 'public/dist/index.min.js';
        
        console.log(`📖 Reading source file: ${sourceFilePath}`);
        const sourceCode = await fs.readFile(sourceFilePath, 'utf8');
        
        // Enhanced obfuscation options
        const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.8,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.5,
            debugProtection: true,
            debugProtectionInterval: 3000,
            disableConsoleOutput: false, // Set to false for debugging
            identifierNamesGenerator: 'hexadecimal',
            log: true, // Enable logging
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

        // Ensure dist directory exists
        await fs.mkdir('public/dist', { recursive: true });

        // Write the obfuscated code
        const obfuscatedCode = obfuscationResult.getObfuscatedCode();
        await fs.writeFile(outputFilePath, obfuscatedCode);
        
        // Log file sizes for verification
        const originalSize = sourceCode.length;
        const obfuscatedSize = obfuscatedCode.length;
        
        console.log('✅ Obfuscation completed successfully!');
        console.log(`📊 Original size: ${originalSize} bytes`);
        console.log(`📊 Obfuscated size: ${obfuscatedSize} bytes`);
        console.log(`📊 Compression ratio: ${((obfuscatedSize/originalSize)*100).toFixed(1)}%`);
        
        // Write source map in development
        if (process.env.NODE_ENV === 'development') {
            await fs.writeFile(
                `${outputFilePath}.map`,
                obfuscationResult.getSourceMap()
            );
            console.log('📍 Source map generated for development');
        }
    } catch (error) {
        console.error('❌ Error during obfuscation:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Execute
obfuscateClientCode().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 
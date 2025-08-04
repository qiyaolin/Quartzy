// Fix imports script - Remove .tsx/.ts extensions for compatibility
// This script will clean up import statements to match the stable version style

const fs = require('fs');
const path = require('path');

// Function to recursively find all .tsx and .ts files
function findFiles(dir, extensions = ['.tsx', '.ts']) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory()) {
            // Skip node_modules and build directories
            if (!['node_modules', 'build', 'dist', '.git'].includes(file)) {
                results = results.concat(findFiles(filePath, extensions));
            }
        } else {
            const ext = path.extname(file);
            if (extensions.includes(ext)) {
                results.push(filePath);
            }
        }
    });
    
    return results;
}

// Function to clean imports in a file
function cleanImports(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Remove .tsx extensions from imports
        const tsxPattern = /from\s+['"]([^'"]*?)\.tsx['"]/g;
        if (tsxPattern.test(content)) {
            content = content.replace(tsxPattern, "from '$1'");
            modified = true;
        }
        
        // Remove .ts extensions from imports
        const tsPattern = /from\s+['"]([^'"]*?)\.ts['"]/g;
        if (tsPattern.test(content)) {
            content = content.replace(tsPattern, "from '$1'");
            modified = true;
        }
        
        // Remove .jsx extensions from imports (just in case)
        const jsxPattern = /from\s+['"]([^'"]*?)\.jsx['"]/g;
        if (jsxPattern.test(content)) {
            content = content.replace(jsxPattern, "from '$1'");
            modified = true;
        }
        
        // Remove .js extensions from imports (just in case)
        const jsPattern = /from\s+['"]([^'"]*?)\.js['"]/g;
        if (jsPattern.test(content)) {
            content = content.replace(jsPattern, "from '$1'");
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Cleaned imports in: ${filePath}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`✗ Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Main execution
function main() {
    const srcDir = path.join(__dirname, 'src');
    
    if (!fs.existsSync(srcDir)) {
        console.error('Source directory not found:', srcDir);
        return;
    }
    
    console.log('🔍 Finding TypeScript and React files...');
    const files = findFiles(srcDir, ['.tsx', '.ts', '.jsx', '.js']);
    console.log(`📁 Found ${files.length} files to process`);
    
    let modifiedCount = 0;
    
    files.forEach(file => {
        if (cleanImports(file)) {
            modifiedCount++;
        }
    });
    
    console.log(`\n✨ Process completed!`);
    console.log(`📝 Modified ${modifiedCount} files`);
    console.log(`📦 Total files processed: ${files.length}`);
    
    if (modifiedCount > 0) {
        console.log('\n🎉 Import statements have been cleaned up for compatibility!');
        console.log('💡 Your project should now be compatible with the stable version style.');
    } else {
        console.log('\n✅ No import modifications were needed.');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { cleanImports, findFiles };
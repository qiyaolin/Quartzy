const fs = require('fs');
const path = require('path');

// 只修复导致构建错误的核心文件
const coreFiles = [
    'src/App.tsx',
    'src/MainApp.tsx',
    'src/DesktopApp.tsx',
    'src/MobileApp.tsx',
    'src/index.tsx'
];

function fixImportsInFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // 移除导入语句中的.tsx, .ts, .jsx, .js扩展名
    const fixedContent = content.replace(
        /from\s+['"](\.\.?\/[^'"]*)\.(tsx|ts|jsx|js)['"]/g,
        "from '$1'"
    );
    
    if (fixedContent !== originalContent) {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        console.log(`✓ Fixed imports in: ${filePath}`);
        return true;
    }
    
    console.log(`- No changes needed: ${filePath}`);
    return false;
}

console.log('Fixing TypeScript import issues in core files only...\n');

let modifiedCount = 0;
for (const file of coreFiles) {
    if (fixImportsInFile(file)) {
        modifiedCount++;
    }
}

console.log(`\nCompleted! Modified ${modifiedCount} core files.`);
console.log('This minimal fix should resolve the build errors while keeping Schedule module independent.');
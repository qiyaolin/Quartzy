# 自动解决Git冲突的PowerShell脚本
# 使用方法: .\auto-resolve-conflicts.ps1

Write-Host "🔧 开始自动解决Git冲突..." -ForegroundColor Green

# 检查是否有冲突文件
$conflictFiles = git diff --name-only --diff-filter=U

if ($conflictFiles.Count -eq 0) {
    Write-Host "✅ 没有发现冲突文件" -ForegroundColor Green
    exit 0
}

Write-Host "发现 $($conflictFiles.Count) 个冲突文件:" -ForegroundColor Yellow
$conflictFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }

# 自动解决策略
foreach ($file in $conflictFiles) {
    Write-Host "处理文件: $file" -ForegroundColor Yellow
    
    # 读取文件内容
    $content = Get-Content $file -Raw
    
    # 根据文件类型选择解决策略
    if ($file -match "\.(py|js|ts|tsx|jsx)$") {
        # 代码文件：保留两个版本，添加注释
        Write-Host "  - 代码文件，保留两个版本" -ForegroundColor Cyan
        $resolvedContent = $content -replace "<<<<<<< HEAD", "// ===== 当前分支版本 ====="
        $resolvedContent = $resolvedContent -replace "=======", "// ===== 合并分支版本 ====="
        $resolvedContent = $resolvedContent -replace ">>>>>>> [^`n]*", "// ===== 版本结束 ====="
    }
    elseif ($file -match "\.(json|yaml|yml|toml)$") {
        # 配置文件：保留当前分支版本
        Write-Host "  - 配置文件，保留当前分支版本" -ForegroundColor Cyan
        $resolvedContent = $content -replace "<<<<<<< HEAD", ""
        $resolvedContent = $resolvedContent -replace "=======.*?>>>>>>> [^`n]*", ""
    }
    elseif ($file -match "\.(md|txt)$") {
        # 文档文件：合并内容
        Write-Host "  - 文档文件，合并内容" -ForegroundColor Cyan
        $resolvedContent = $content -replace "<<<<<<< HEAD", ""
        $resolvedContent = $resolvedContent -replace "=======", ""
        $resolvedContent = $resolvedContent -replace ">>>>>>> [^`n]*", ""
    }
    else {
        # 其他文件：保留当前分支版本
        Write-Host "  - 其他文件，保留当前分支版本" -ForegroundColor Cyan
        $resolvedContent = $content -replace "<<<<<<< HEAD", ""
        $resolvedContent = $resolvedContent -replace "=======.*?>>>>>>> [^`n]*", ""
    }
    
    # 写入解决后的内容
    Set-Content $file $resolvedContent -Encoding UTF8
    Write-Host "  ✅ 已解决冲突" -ForegroundColor Green
}

# 添加所有解决的文件
git add .

Write-Host "🎉 自动冲突解决完成！" -ForegroundColor Green
Write-Host "请检查解决结果，然后运行: git commit" -ForegroundColor Yellow 
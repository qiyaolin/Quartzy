# 智能Git冲突解决脚本
# 使用方法: .\smart-resolve-conflicts.ps1

param(
    [string]$Strategy = "auto",  # auto, ours, theirs, merge
    [switch]$Force
)

Write-Host "🧠 智能Git冲突解决工具" -ForegroundColor Green
Write-Host "策略: $Strategy" -ForegroundColor Cyan

# 检查是否有冲突
$conflictFiles = git diff --name-only --diff-filter=U

if ($conflictFiles.Count -eq 0) {
    Write-Host "✅ 没有发现冲突文件" -ForegroundColor Green
    exit 0
}

Write-Host "发现 $($conflictFiles.Count) 个冲突文件" -ForegroundColor Yellow

# 根据策略解决冲突
switch ($Strategy.ToLower()) {
    "ours" {
        Write-Host "📋 策略: 保留当前分支版本" -ForegroundColor Yellow
        foreach ($file in $conflictFiles) {
            Write-Host "处理: $file" -ForegroundColor Cyan
            git checkout --ours $file
            git add $file
        }
    }
    "theirs" {
        Write-Host "📋 策略: 保留合并分支版本" -ForegroundColor Yellow
        foreach ($file in $conflictFiles) {
            Write-Host "处理: $file" -ForegroundColor Cyan
            git checkout --theirs $file
            git add $file
        }
    }
    "auto" {
        Write-Host "📋 策略: 智能自动解决" -ForegroundColor Yellow
        foreach ($file in $conflictFiles) {
            Write-Host "处理: $file" -ForegroundColor Cyan
            $content = Get-Content $file -Raw
            
            # 分析冲突内容
            $oursContent = ""
            $theirsContent = ""
            
            if ($content -match "<<<<<<< HEAD(.*?)=======(.*?)>>>>>>>") {
                $oursContent = $matches[1].Trim()
                $theirsContent = $matches[2].Trim()
            }
            
            # 根据文件类型和内容智能选择
            $resolvedContent = ""
            
            if ($file -match "\.(py|js|ts|tsx|jsx)$") {
                # 代码文件：智能合并
                if ($oursContent -eq $theirsContent) {
                    $resolvedContent = $oursContent
                    Write-Host "  - 内容相同，保留任一版本" -ForegroundColor Green
                } elseif ($oursContent -match "import|from" -and $theirsContent -match "import|from") {
                    # 合并导入语句
                    $resolvedContent = ($oursContent + "`n" + $theirsContent) -replace "(import|from).*?`n", "$&" | Sort-Object -Unique
                    Write-Host "  - 合并导入语句" -ForegroundColor Green
                } else {
                    # 保留两个版本，添加注释
                    $resolvedContent = "// ===== 当前分支版本 =====" + "`n" + $oursContent + "`n" + "// ===== 合并分支版本 =====" + "`n" + $theirsContent
                    Write-Host "  - 保留两个版本" -ForegroundColor Yellow
                }
            }
            elseif ($file -match "\.(json|yaml|yml)$") {
                # 配置文件：保留当前分支版本
                $resolvedContent = $oursContent
                Write-Host "  - 配置文件，保留当前版本" -ForegroundColor Green
            }
            elseif ($file -match "\.(md|txt)$") {
                # 文档文件：合并内容
                $resolvedContent = $oursContent + "`n`n" + $theirsContent
                Write-Host "  - 文档文件，合并内容" -ForegroundColor Green
            }
            elseif ($file -match "\.gitignore$") {
                # .gitignore文件：合并并去重
                $oursLines = $oursContent -split "`n" | Where-Object { $_.Trim() -ne "" }
                $theirsLines = $theirsContent -split "`n" | Where-Object { $_.Trim() -ne "" }
                $allLines = ($oursLines + $theirsLines) | Sort-Object -Unique
                $resolvedContent = $allLines -join "`n"
                Write-Host "  - .gitignore文件，合并并去重" -ForegroundColor Green
            }
            else {
                # 其他文件：保留当前分支版本
                $resolvedContent = $oursContent
                Write-Host "  - 其他文件，保留当前版本" -ForegroundColor Green
            }
            
            # 替换冲突标记
            $finalContent = $content -replace "<<<<<<< HEAD.*?=======.*?>>>>>>> [^`n]*", $resolvedContent
            Set-Content $file $finalContent -Encoding UTF8
            git add $file
        }
    }
    default {
        Write-Host "❌ 未知策略: $Strategy" -ForegroundColor Red
        Write-Host "可用策略: auto, ours, theirs, merge" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "🎉 冲突解决完成！" -ForegroundColor Green
Write-Host "请检查结果，然后运行: git commit" -ForegroundColor Yellow

# 显示解决后的状态
Write-Host "`n📊 解决后的状态:" -ForegroundColor Cyan
git status --porcelain 
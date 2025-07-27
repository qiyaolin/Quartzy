// 简单的生产环境调试脚本
const https = require('https');

console.log('🔍 开始诊断生产环境问题...');

// 测试前端页面
function testFrontend() {
  return new Promise((resolve, reject) => {
    console.log('📱 测试前端页面...');
    https.get('https://lab-inventory-467021.web.app/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ 前端页面状态码:', res.statusCode);
        console.log('📄 HTML内容长度:', data.length);
        console.log('🔍 HTML内容预览:', data.substring(0, 500));
        
        // 检查是否包含React相关内容
        const hasReactRoot = data.includes('id="root"');
        const hasReactScript = data.includes('react');
        const hasMainScript = data.includes('main.');
        
        console.log('- 包含React根元素:', hasReactRoot);
        console.log('- 包含React脚本:', hasReactScript);
        console.log('- 包含主脚本:', hasMainScript);
        
        resolve({ statusCode: res.statusCode, content: data });
      });
    }).on('error', reject);
  });
}

// 测试后端API
function testBackend() {
  return new Promise((resolve, reject) => {
    console.log('🔧 测试后端API...');
    https.get('https://lab-inventory-467021.nn.r.appspot.com/api/health/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ 后端API状态码:', res.statusCode);
        console.log('📊 API响应:', data);
        resolve({ statusCode: res.statusCode, content: data });
      });
    }).on('error', (err) => {
      console.log('❌ 后端API连接失败:', err.message);
      resolve({ error: err.message });
    });
  });
}

async function diagnose() {
  try {
    const frontendResult = await testFrontend();
    const backendResult = await testBackend();
    
    console.log('\n📊 诊断结果总结:');
    console.log('前端状态:', frontendResult.statusCode === 200 ? '✅ 正常' : '❌ 异常');
    console.log('后端状态:', backendResult.statusCode === 200 ? '✅ 正常' : '❌ 异常');
    
    if (frontendResult.statusCode === 200 && backendResult.error) {
      console.log('\n🚨 问题诊断: 前端正常但后端API无法访问');
      console.log('💡 建议: 检查后端服务器状态和CORS配置');
    } else if (frontendResult.statusCode !== 200) {
      console.log('\n🚨 问题诊断: 前端部署有问题');
      console.log('💡 建议: 检查前端构建和部署配置');
    }
    
  } catch (error) {
    console.log('❌ 诊断过程出错:', error.message);
  }
}

diagnose();
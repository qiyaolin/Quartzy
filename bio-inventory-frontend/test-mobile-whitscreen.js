const { chromium } = require('playwright');

async function testMobileWhiteScreen() {
  console.log('🔍 开始测试移动端白屏问题...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone SE size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  
  // 监听控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ 控制台错误:', msg.text());
    }
  });
  
  // 监听页面错误
  page.on('pageerror', error => {
    console.log('❌ 页面错误:', error.message);
  });
  
  // 监听网络请求失败
  page.on('requestfailed', request => {
    console.log('❌ 网络请求失败:', request.url(), request.failure().errorText);
  });
  
  try {
    console.log('📱 访问生产环境: https://lab-inventory-467021.web.app/');
    
    // 访问页面
    await page.goto('https://lab-inventory-467021.web.app/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 等待一段时间观察页面状态
    await page.waitForTimeout(3000);
    
    // 检查页面内容
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.trim().length > 0;
    
    console.log('📄 页面内容长度:', bodyText ? bodyText.length : 0);
    
    // 检查是否有React根元素
    const rootElement = await page.$('#root');
    const rootContent = rootElement ? await rootElement.textContent() : '';
    
    console.log('🔧 React根元素内容长度:', rootContent ? rootContent.length : 0);
    
    // 截图保存
    await page.screenshot({ path: 'mobile-test-screenshot.png', fullPage: true });
    console.log('📸 已保存截图: mobile-test-screenshot.png');
    
    // 检查网络请求
    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type']
      });
    });
    
    // 刷新页面再次测试
    console.log('🔄 刷新页面进行二次测试...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // 再次检查内容
    const bodyTextAfterReload = await page.textContent('body');
    console.log('📄 刷新后页面内容长度:', bodyTextAfterReload ? bodyTextAfterReload.length : 0);
    
    // 检查是否有加载指示器
    const loadingElements = await page.$$('.loading-screen, .loading-spinner');
    console.log('⏳ 找到加载元素数量:', loadingElements.length);
    
    // 检查是否有错误信息
    const errorElements = await page.$$('[class*="error"], [id*="error"]');
    console.log('❌ 找到错误元素数量:', errorElements.length);
    
    // 输出最终诊断结果
    console.log('\n📊 诊断结果:');
    console.log('- 页面是否有内容:', hasContent);
    console.log('- React根元素是否有内容:', rootContent.length > 0);
    console.log('- 是否存在白屏问题:', !hasContent || rootContent.length === 0);
    
    if (!hasContent || rootContent.length === 0) {
      console.log('\n🚨 确认存在白屏问题！');
      
      // 检查具体的错误信息
      const htmlContent = await page.content();
      console.log('📝 HTML内容预览:', htmlContent.substring(0, 500) + '...');
    }
    
  } catch (error) {
    console.log('❌ 测试过程中出现错误:', error.message);
  } finally {
    await browser.close();
  }
}

testMobileWhiteScreen().catch(console.error);
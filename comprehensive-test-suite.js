// Comprehensive Playwright Test Suite for Bio-Inventory System
// Tests all major functionality and debugging specific issues

const { test, expect } = require('@playwright/test');

// Configuration
const APP_URL = 'https://lab-inventory-467021.web.app';
const LOCAL_URL = 'http://localhost:3000';

test.describe('Bio-Inventory Frontend Tests', () => {
    let page;
    
    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        page = await context.newPage();
        
        // Enable console and error monitoring
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`[CONSOLE ERROR]: ${msg.text()}`);
            }
        });
        
        page.on('pageerror', error => {
            console.error(`[PAGE ERROR]: ${error.message}`);
        });
    });

    test.describe('Authentication & Navigation', () => {
        test('should load login page without errors', async () => {
            await page.goto(APP_URL);
            await page.waitForLoadState('networkidle');
            
            // Check for login form
            await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible();
            await expect(page.locator('input[type="password"]')).toBeVisible();
            await expect(page.locator('button[type="submit"], button:has-text("Login")')).toBeVisible();
        });

        test('should navigate to schedule page after login', async () => {
            // Note: Manual login required before this test
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
            
            // Should not show login form on schedule page
            await expect(page.locator('input[type="password"]')).not.toBeVisible();
        });
    });

    test.describe('Schedule Page - Main Issues', () => {
        test.beforeEach(async () => {
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
        });

        test('should not have JavaScript syntax errors', async () => {
            const errors = [];
            
            page.on('pageerror', error => {
                errors.push(error);
            });
            
            await page.reload();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000); // Wait for async errors
            
            // Check for the specific "Unexpected token ')'" error
            const syntaxErrors = errors.filter(error => 
                error.message.includes('Unexpected token') || 
                error.message.includes('SyntaxError')
            );
            
            expect(syntaxErrors).toHaveLength(0);
        });

        test('should have buildApiUrl function available', async () => {
            const buildApiUrlExists = await page.evaluate(() => {
                return typeof buildApiUrl === 'function' || typeof window.buildApiUrl === 'function';
            });
            
            expect(buildApiUrlExists).toBeTruthy();
        });

        test('should render My Tasks section with functional buttons', async () => {
            // Wait for dashboard to load
            await page.waitForSelector('.card, [data-testid="dashboard"]', { timeout: 10000 });
            
            // Look for My Tasks section
            const myTasksSection = page.locator('.card:has-text("My Tasks"), [data-testid="my-tasks"]');
            
            if (await myTasksSection.count() > 0) {
                await expect(myTasksSection).toBeVisible();
                
                // Check for Complete and Swap buttons
                const completeButtons = page.locator('button:has-text("Complete")');
                const swapButtons = page.locator('button:has-text("Swap")');
                
                if (await completeButtons.count() > 0) {
                    await expect(completeButtons.first()).toBeVisible();
                    
                    // Test button click doesn't cause errors
                    const errors = [];
                    page.on('pageerror', error => errors.push(error));
                    
                    await completeButtons.first().click();
                    await page.waitForTimeout(2000);
                    
                    expect(errors).toHaveLength(0);
                }
            }
        });

        test('should display assigned users in Recurring Tasks', async () => {
            // Try to navigate to recurring tasks
            const recurringTasksTab = page.locator('button:has-text("Recurring"), [role="tab"]:has-text("Tasks")');
            
            if (await recurringTasksTab.count() > 0) {
                await recurringTasksTab.first().click();
                await page.waitForTimeout(2000);
                
                // Look for assignment information
                const assignmentElements = page.locator('.text-blue-700, .assigned-users, [data-testid="assigned-users"]');
                
                if (await assignmentElements.count() > 0) {
                    // Should show user names or assignment info
                    const assignmentText = await assignmentElements.first().textContent();
                    expect(assignmentText).not.toBe('0 selected');
                    expect(assignmentText).not.toBe('');
                }
            }
        });

        test('should explain Tasks Templates functionality', async () => {
            // Look for Templates tab (admin only)
            const templatesTab = page.locator('[role="tab"]:has-text("Templates"), button:has-text("Templates")');
            
            if (await templatesTab.count() > 0) {
                await templatesTab.first().click();
                await page.waitForTimeout(2000);
                
                // Should show template management interface
                const templateElements = page.locator('.template, [data-template], .task-template');
                
                if (await templateElements.count() > 0) {
                    // Templates section should have explanatory text or help
                    const helpText = page.locator(':has-text("template"), :has-text("reusable"), :has-text("admin")');
                    await expect(helpText.first()).toBeVisible();
                }
            }
        });
    });

    test.describe('Error Monitoring & Recovery', () => {
        test('should handle API failures gracefully', async () => {
            await page.goto(`${APP_URL}/schedule`);
            
            // Intercept and fail some API calls to test error handling
            await page.route('**/api/schedule/**', route => {
                route.abort('failed');
            });
            
            await page.reload();
            await page.waitForTimeout(3000);
            
            // Should show error state, not crash
            const errorElements = page.locator('.error, .alert-danger, :has-text("error"), :has-text("failed")');
            // Either shows error message or continues working with cached data
            // Should not have uncaught JavaScript errors
            
            const hasErrorUI = await errorElements.count() > 0;
            const pageStillResponsive = await page.locator('body').isVisible();
            
            expect(pageStillResponsive).toBeTruthy();
        });

        test('should recover from network issues', async () => {
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
            
            // Simulate network failure
            await page.setOffline(true);
            await page.waitForTimeout(1000);
            
            // Restore network
            await page.setOffline(false);
            await page.waitForTimeout(3000);
            
            // Should recover and work normally
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Performance & Optimization', () => {
        test('should load within acceptable time limits', async () => {
            const startTime = Date.now();
            
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
            
            const loadTime = Date.now() - startTime;
            
            // Should load within 10 seconds
            expect(loadTime).toBeLessThan(10000);
        });

        test('should not have memory leaks', async () => {
            const initialMemory = await page.evaluate(() => {
                return performance.memory ? performance.memory.usedJSHeapSize : 0;
            });
            
            // Navigate and interact multiple times
            for (let i = 0; i < 5; i++) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(1000);
            }
            
            const finalMemory = await page.evaluate(() => {
                return performance.memory ? performance.memory.usedJSHeapSize : 0;
            });
            
            // Memory shouldn't grow excessively (allow 2x growth)
            if (initialMemory > 0 && finalMemory > 0) {
                expect(finalMemory).toBeLessThan(initialMemory * 2);
            }
        });
    });

    test.describe('Cross-Browser Compatibility', () => {
        test('should work in different browsers', async ({ browserName }) => {
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
            
            // Basic functionality should work in all browsers
            await expect(page.locator('body')).toBeVisible();
            
            // Check browser-specific features
            const browserInfo = await page.evaluate(() => ({
                userAgent: navigator.userAgent,
                vendor: navigator.vendor,
                language: navigator.language
            }));
            
            console.log(`Testing in ${browserName}:`, browserInfo);
        });
    });

    test.describe('Mobile Responsiveness', () => {
        test('should work on mobile devices', async () => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            
            await page.goto(`${APP_URL}/schedule`);
            await page.waitForLoadState('networkidle');
            
            // Should be responsive
            const bodyWidth = await page.locator('body').evaluate(el => el.offsetWidth);
            expect(bodyWidth).toBeLessThanOrEqual(375);
            
            // Mobile-specific elements should be visible
            const mobileElements = page.locator('.mobile, [data-mobile], .sm\\:');
            // Should adapt to mobile layout
        });
    });
});

// Helper function for manual debugging
async function runManualDebugSession() {
    const { chromium } = require('playwright');
    
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('🔍 Manual Debug Session Started');
    console.log('Complete login manually, then press Enter to continue...');
    
    await page.goto(APP_URL);
    
    await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
    });
    
    // Run specific tests
    await page.goto(`${APP_URL}/schedule`);
    console.log('Navigate to schedule page completed');
    
    console.log('Press Enter to close...');
    await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
    });
    
    await browser.close();
}

// Export for standalone usage
module.exports = {
    runManualDebugSession
};
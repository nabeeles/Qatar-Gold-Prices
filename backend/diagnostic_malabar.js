const puppeteer = require('puppeteer');

async function debugMalabar() {
    const url = 'https://www.malabargoldanddiamonds.com/ae/stores/qatar';
    const launchOptions = {
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 1200 });
        
        console.log('--- DIAGNOSTIC: Navigating to Malabar ---');
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await new Promise(r => setTimeout(r, 25000));

        console.log('--- DIAGNOSTIC: Page Title:', await page.title());

        const data = await page.evaluate(() => {
            const results = {};
            results.url = window.location.href;
            results.bodyTextLength = document.body.innerText.length;
            results.iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src);
            
            // Check for common Malabar elements
            results.hasTable = document.querySelectorAll('table').length;
            results.hasQatar = document.body.innerText.includes('Qatar');
            results.hasQAR = document.body.innerText.includes('QAR');
            
            // Sample some text
            results.sampleText = document.body.innerText.substring(0, 500).replace(/\s+/g, ' ');
            
            // Find all elements with "Qatar" and show their hierarchy
            const qElements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && el.innerText.includes('Qatar'))
                .map(el => ({
                    tag: el.tagName,
                    text: el.innerText,
                    parent: el.parentElement ? el.parentElement.tagName : 'NONE',
                    grandParent: el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.tagName : 'NONE'
                }));
            results.qatarElements = qElements;

            return results;
        });

        console.log('--- DIAGNOSTIC DATA ---');
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('--- DIAGNOSTIC ERROR:', e.message);
    } finally {
        await browser.close();
    }
}

debugMalabar();

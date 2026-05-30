const puppeteer = require('puppeteer');

async function debugMalabar() {
    const url = 'https://www.malabargoldanddiamonds.com/ae/stores/qatar';
    const launchOptions = {
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 1200 });
        
        console.log('--- DIAGNOSTIC: Navigating to Malabar ---');
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await new Promise(r => setTimeout(r, 30000)); // Give it plenty of time

        console.log('--- DIAGNOSTIC: Page Title:', await page.title());

        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log('--- RAW BODY TEXT START ---');
        console.log(bodyText.replace(/\s+/g, ' '));
        console.log('--- RAW BODY TEXT END ---');

    } catch (e) {
        console.error('--- DIAGNOSTIC ERROR:', e.message);
    } finally {
        await browser.close();
    }
}

debugMalabar();

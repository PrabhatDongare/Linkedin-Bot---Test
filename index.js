import puppeteer from "puppeteer";

async function test() {
    // const browser = await puppeteer.launch({
    //     headless: false, // See it in action for now - make it false
    //     slowMo: 500,      // Slow down to simulate human-like interaction
    //     args: ["--no-sandbox", "--disable-setuid-sandbox"]
    // });

    // for running on server
    const browser = await puppeteer.launch({
        headless: "new", // or true for older versions; "new" is recommended in latest versions
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",           // Avoids shared memory issues
            // "--disable-gpu",                     // Disable GPU for stability (optional)
            "--window-size=1920,1080"            // Set screen size for layout consistency
        ]
    });

    const page = await browser.newPage();

    // for mobile view
    await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1"
    );
    // for desktop view
    //     await page.setUserAgent(
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    // );

    await page.goto("https://www.linkedin.com/login", {
        waitUntil: "networkidle2"
    });

    // Replace with real credentials or pass via query/env for safety
    const email = "easyedits198@gmail.com";
    const password = "w(VR5_N)mKJ7P$Z";

    await page.type("#username", email, { delay: randomDelay() });
    await page.type("#password", password, { delay: randomDelay() });

    // Uncheck "Remember me" if checked
    const checkboxSelector = '#remember-me-checkbox';

    // Check if checkbox exists first
    const checkboxExists = await page.$(checkboxSelector);

    if (checkboxExists) {
        const isChecked = await page.$eval(checkboxSelector, el => el.checked);
        if (isChecked) {
            await page.click(checkboxSelector);
        }
    }

    // Click Sign in button
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    // Navigate to LinkedIn Feed
    await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "networkidle2"
    });

    // Scroll the page like a human
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("Logged in and scrolled feed successfully.");
    }

    await browser.close();
}


function randomDelay() {
    return Math.floor(Math.random() * 100) + 20;
}

test();
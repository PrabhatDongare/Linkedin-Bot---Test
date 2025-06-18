import puppeteer from "puppeteer";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { sub, formatISO } from "date-fns";
dotenv.config();

function randomDelay() {
    return Math.floor(Math.random() * 100) + 20;
}

async function autoScroll(page, times = 4, scrollDelay = 1000) {
    for (let i = 0; i < times; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }
}

function convertRelativeTime(text) {
    const now = new Date();
    const match = text.match(/(\d+)\s*(h|d|w|mo|y)/i);
    if (!match) return formatISO(now);

    const [, valueStr, unit] = match;
    const value = parseInt(valueStr);

    const unitMap = {
        h: "hours",
        d: "days",
        w: "weeks",
        mo: "months",
        y: "years",
    };

    const duration = { [unitMap[unit]]: value };
    return formatISO(sub(now, duration));
}

function extractPostData(html) {
    const $ = cheerio.load(html);

    // Post ID
    const urn = $("[data-urn]").first().attr("data-urn");
    const postId = urn?.match(/urn:li:activity:(\d+)/)?.[1];
    if (!postId) return null;

    // Name
    const rawName = $('.update-components-actor__title span[aria-hidden="true"]')
        .first()
        .text()
        .trim();
    const name = rawName.replace(/\s+/g, " ");

    // Profile username
    const rawProfileUrl = $(".update-components-actor__meta-link")
        .attr("href")
        ?.trim();
    const username =
        rawProfileUrl?.match(/linkedin\.com\/in\/([^/?]+)/)?.[1] || null;

    // Posted time → ISO datetime
    const rawPostedTime = $(
        '.update-components-actor__sub-description span[aria-hidden="true"]'
    ).text();
    const postedTimeText = rawPostedTime.split("•")[0].trim();
    const postedAt = convertRelativeTime(postedTimeText);

    // Post content
    const contentSpan = $(
        '[class*="update-components-text"] span.break-words'
    ).first();
    const cloned = cheerio.load(contentSpan.html() || "");
    cloned('a[href*="keywords=%23"]').remove(); // remove hashtags

    // Clean text content
    const rawContent = cloned.text().replace(/\s+/g, " ").trim();

    // Extract emails (can be multiple)
    const emailRegex = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = rawContent.match(emailRegex) || [];

    return { postId, name, username, postedAt, content: rawContent, emails };
}

export async function collectPosts() {
    // -> makes browser heedful
    // const browser = await puppeteer.launch({
    //     headless: false,
    //     slowMo: 500, // Slow down to simulate human-like interaction
    //     args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // });

    // -> makes browser headless
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

    // -> for mobile view
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1");

    // -> for desktop view
    // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    console.log('Attempting to login...');
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
    await page.type("#username", process.env.LINKEDIN_EMAIL, { delay: randomDelay() });
    await page.type("#password", process.env.LINKEDIN_PASSWORD, { delay: randomDelay() });

    // -> Uncheck "Remember me" if checked
    const checkboxSelector = "#remember-me-checkbox";
    if (await page.$(checkboxSelector)) {
        const isChecked = await page.$eval(checkboxSelector, (el) => el.checked);
        if (isChecked) await page.click(checkboxSelector);
    }

    // -> Click Sign in button
    await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2" }),]);
    console.log('Login successful');

    // -> Navigate to search page
    await page.goto("https://www.linkedin.com/search/results/content/?keywords=%22backend%22%20%2B%20%22hiring%22%20%2B%20%22mail%22&origin=FACETED_SEARCH&sid=XO~&sortBy=%22date_posted%22", { waitUntil: "networkidle2", });
    await page.waitForSelector("li.artdeco-card", { timeout: 5000 });

    // Scroll to load more posts (optional)
    await autoScroll(page, 4, 1000); // scroll 4 times with 1 sec delay
    console.log('Scrolling to load more posts...');

    // Extract all li.artdeco-card elements directly from the page
    const postHtmlArray = await page.$$eval(
        'li.artdeco-card',
        (liElements) => {
            return liElements.map(li => li.outerHTML);
        }
    );
    console.log(`Found ${postHtmlArray.length} posts`);

    // Feed to extractPostData()
    const results = [];
    for (const postHtml of postHtmlArray) {
        const postData = extractPostData(postHtml);
        if (postData) {
            results.push(postData);
        }
    }


    await browser.close();
    return results;
}

// collectPosts();

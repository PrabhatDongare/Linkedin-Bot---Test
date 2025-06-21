import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { sub, formatISO } from "date-fns";
import { writeFileSync } from "fs";
import fs from "fs/promises";

async function autoScroll(page, times = 4, scrollDelay = 10) {
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

function randomDelay(min = 100, max = 300) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function collectPosts() {
    const browser = await puppeteer.launch({
        headless: 'new',
        // ignoreHTTPSErrors: true,
        // args: [
        //     '--proxy-server=http://173.0.9.70:5653',
        //     '--disable-http2',
        //     '--ignore-certificate-errors',
        //     '--disable-gpu',
        //     '--no-sandbox',
        //     '--disable-setuid-sandbox',
        //     '--window-size=1280,720',
        // ]
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1920,1080"
        ]
    });

    const page = await browser.newPage();

    // Set proxy authentication
    // await page.authenticate({
    //     username: "lzdgkkmh",
    //     password: "s8zq6pd5hoqs"
    // });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // Load cookies
    const cookiesString = await fs.readFile('./cookies.json');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);

    // Now you're logged in
    // Navigate to posts page
    await page.goto('https://www.linkedin.com/search/results/content/?datePosted=%22past-24h%22&keywords=%22hiring%22%20%2B%20%22backend%22%20%2B%20%22email%22&origin=FACETED_SEARCH&sid=n3i&sortBy=%22relevance%22', { waitUntil: 'domcontentloaded' });
    await sleep(randomDelay(5000, 7000));
    console.log("Successful reached, Current page URL:", page.url());

    // Wait until at least one post card is visible
    try {
        await page.waitForSelector("li.artdeco-card", { timeout: 5000 });
    } catch (e) {
        console.warn("⚠️ No post cards found. Possibly blocked or no posts loaded.");
    }

    // Simulate human scrolling to load more posts
    console.log("Scrolling to load more posts...");
    await autoScroll(page, 4, 1000); // Scroll 4 times with 1s delay

    // Wait for a short random delay after scrolling
    await sleep(randomDelay(1000, 2000));

    // Extract HTML of all visible post cards
    const postHtmlArray = await page.$$eval("li.artdeco-card", (liElements) =>
        liElements.map((li) => li.outerHTML)
    );
    console.log(`✅ Found ${postHtmlArray.length} posts.`);

    // Parse each post using extractPostData
    const results = [];
    for (const postHtml of postHtmlArray) {
        try {
            const postData = extractPostData(postHtml);
            if (postData) {
                results.push(postData);
            }
        } catch (err) {
            console.error("Error parsing post:", err);
        }
    }

    // Close browser session
    await browser.close();
    // return results;
    console.log(results)

}

collectPosts()
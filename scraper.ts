import { Browser, BrowserContext, chromium } from "playwright-chromium";
//import { chromium } from "playwright-extra";
//import StealthPlugin from "puppeteer-extra-plugin-stealth";
//import HumanizePlugin from "@extra/humanize";

//chromium.use(StealthPlugin());

let browser: Browser;

let context: BrowserContext;

export async function scrape(url, callback) {
	browser ??= await chromium.launch({
		//"executablePath": process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		//"args": ["--no-sandbox"],
		"devtools": true,
		"headless": false
	});

	context ??= await browser.newContext();

	const page = await context.newPage();

	const results = await callback({
		"browser": browser,
		"context": context,
		"page": page
	});

	await page.close();

	return results;
}

//await context.close();

//await browser.close();

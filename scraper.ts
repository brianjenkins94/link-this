import { Browser, BrowserContext, chromium, Page } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import HumanizePlugin from "@extra/humanize";

chromium.use(StealthPlugin());
chromium.use(HumanizePlugin());

let browser: Browser;

let context: BrowserContext;

export async function scrape(url, callback) {
	browser ??= await chromium.launch({
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

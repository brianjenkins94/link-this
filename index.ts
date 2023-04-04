import { promises as fs } from "fs";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { scrape } from "./scraper";

const LI_AT_COOKIE = process.env["LI_AT_COOKIE"];

if (LI_AT_COOKIE === undefined) {
	throw new Error("LI_AT_COOKIE undefined.");
}

const selectors = {
	"jobs": ".job-card-container",
	"details": ".jobs-details__main-content",
	"title": ".artdeco-entity-lockup__title",
	"link": ".artdeco-entity-lockup__title a",
	"company": ".job-card-container__company-name",
	"location": ".artdeco-entity-lockup__caption",
	"date": ".job-card-container__listed-time time",
	"compensation": "[href=\"#SALARY\"]",
	"getPage": function(index) {
		return "li[data-test-pagination-page-btn=\"" + index + "\"] button";
	}
};

const searches = [
	"node.js",
	"solutions",
	"architect",
	"engineer",
	"integration",
	"implementation",
	"professional services"
];

//const outputDirectory = path.join(__dirname, "out");

//await fs.mkdir(outputDirectory, { "recursive": true })

const readme = path.join(__dirname, "README.md");

await fs.writeFile(readme, (await fs.readFile(readme, { "encoding": "utf8" })).split(/(?<=A LinkedIn job scraper.)/u)[0] + "\n\n");

await fs.appendFile(readme, [
	"## Jobs",
	"",
	"Last scraped: " + new Date().toUTCString(),
	"\n"
].join("\n"));

for (const search of searches) {
	const query = new URLSearchParams({
		"keywords": search,
		"location": "United States",
		"sortBy": "DD",
		"f_JT": "F",
		"f_SB2": "6",
		"f_WT": "2"
	});

	const url = "https://www.linkedin.com/jobs/search?" + query;

	let results = await scrape(url, async function({ browser, context, page }) {
		await context.addCookies([
			{
				"name": "li_at",
				"value": LI_AT_COOKIE,
				"domain": ".www.linkedin.com",
				"path": "/"
			}
		]);

		await page.goto(url);

		const results = [];

		for (let pageNumber = 2; pageNumber < 5; pageNumber++) {
			await page.waitForSelector(selectors.jobs);

			for (let x = 0, jobs = page.locator(selectors.jobs), job = jobs.nth(x); x < await jobs.count(); x++, jobs = page.locator(selectors.jobs), job = jobs.nth(x)) {
				job.evaluate(function(element) {
					element.scrollIntoView(true);
				});

				await job.click();

				await page.waitForSelector(".jobs-unified-top-card__job-insight");

				const details = page.locator(selectors.details);

				const result = {
					"title": (await job.locator(selectors.title).textContent()).trim(),
					"link": (await job.locator(selectors.link).evaluate(function(element: HTMLAnchorElement) { return element.href; })).trim(),
					"company": (await job.locator(selectors.company).textContent()).trim(),
					"location": (await job.locator(selectors.location).textContent()).trim().replace(/\s{2,}/gu, " - "),
					"greenText": (await job.locator(selectors.date).count()) > 0 ? (await job.locator(selectors.date).textContent()).split(/(?<=ago)/u)[0].trim() : undefined,
					"compensation": (await details.locator(selectors.compensation).count()) > 0 ? (await details.locator(selectors.compensation).textContent()).trim() : undefined
				};

				console.log(result);

				results.push(result);
			}

			await page.locator(selectors.getPage(pageNumber)).click();
		}

		await page.close();

		return results;
	});

	//const fileName = search.replace(/ /gu, "_") + ".json";

	//await fs.writeFile(path.join(outputDirectory, fileName), JSON.stringify(results.filter(function(result) {
	//	return result.greenText !== undefined;
	//}), undefined, "\t"));

	results = results.filter(function(result) {
		return result.greenText !== undefined;
	});

	const table = [
		"<table>",
		"<thead>",
		"<tr>",
		"<th colspan=\"3\">Search term: `" + search + "`</th>",
		"</tr>",
		"<tr>",
		"<th>Company</th>",
		"<th>Position</th>",
		"<th>Compensation</th>",
		"</tr>",
		"</thead>",
		"<tbody>"
	];

	for (const { title, link, company, compensation } of results) {
		table.push(
			"<tr>",
			"<td>" + company + "</td>",
			"<td>[" + title + "](" + link + ")</td>",
			"<td>" + compensation?.split(" (from job description)")[0] + "</td>",
			"</tr>"
		);
	}

	table.push(
		"</tbody>",
		"</table>",
		"\n"
	)

	await fs.appendFile(readme, table.join("\n"));
}

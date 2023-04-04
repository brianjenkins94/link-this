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
	"apply": ".jobs-apply-button",
	"jobs": ".job-card-container",
	"logo": ".artdeco-entity-lockup__image img",
	"details": ".jobs-details__main-content",
	"title": ".artdeco-entity-lockup__title",
	"link": ".artdeco-entity-lockup__title a",
	"company": ".job-card-container__company-name",
	"location": ".artdeco-entity-lockup__caption",
	"date": ".job-card-container__listed-time time",
	"compensation": "[href=\"#SALARY\"]",
	"size": ".jobs-unified-top-card__job-insight:has([type=\"company\"])",
	"industry": ".jobs-unified-top-card__job-insight:has([type=\"company\"])",
	"getPage": function(index) {
		return "li[data-test-pagination-page-btn=\"" + index + "\"] button";
	}
};

const searchTerms = [
	"api",
	"architect",
	"engineer",
	"implementation",
	"integration",
	"node.js",
	"professional services",
	"solutions",
	"typescript"
];

const searches = searchTerms.map(function(searchTerm) {
	const query = new URLSearchParams({
		"keywords": searchTerm,
		"location": "United States",
		"sortBy": "DD",
		"f_JT": "F",
		"f_SB2": "6",
		"f_WT": "2"
	});

	const url = "https://www.linkedin.com/jobs/search?" + query;

	return function() {
		return new Promise(function(resolve, reject) {
			scrape(url, async function({ browser, context, page }) {
				if ((await page.context().cookies()).length === 0) {
					await context.addCookies([
						{
							"name": "li_at",
							"value": LI_AT_COOKIE,
							"domain": ".www.linkedin.com",
							"path": "/"
						}
					]);
				}

				await page.goto(url);

				const results = [];

				for (let pageNumber = 2; pageNumber <= 6; pageNumber++) {
					await page.waitForTimeout(2500);

					// Mitigate skipping
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
							"logo": (await job.locator(selectors.logo).getAttribute("src")).trim(),
							"link": (await job.locator(selectors.link).evaluate(function(element: HTMLAnchorElement) { return element.href; })).trim(),
							"company": (await job.locator(selectors.company).textContent()).trim(),
							"location": (await job.locator(selectors.location).textContent()).trim().replace(/\s{2,}/gu, " - "),
							"greenText": (await job.locator(selectors.date).count()) > 0 ? (await job.locator(selectors.date).textContent()).split(/(?<=ago)/u)[0].trim() : undefined,
							"compensation": (await details.locator(selectors.compensation).count()) > 0 ? (await details.locator(selectors.compensation).textContent()).split(" (from job description)")[0].trim() : undefined,
							"size": (await details.locator(selectors.size).count()) > 0 ? (await details.locator(selectors.size).textContent()).split(" · ")[0].trim() : undefined,
							"industry": (await details.locator(selectors.industry).count()) > 0 ? (await details.locator(selectors.industry).textContent()).split(" · ")[1]?.trim() : undefined
						};

						console.log(result);

						if (false) {
							const applyButton = details.locator(selectors.apply).first();

							if (!(await applyButton.textContent()).includes("Easy Apply")) {
								const popupPromise = page.waitForEvent("popup");

								await applyButton.click();

								const popup = await popupPromise;

								try {
									await popup.waitForLoadState();
								} catch (error) { } finally {
									await popup.close();
								}

								console.log("Applied ¬‿¬");
							}
						}

						results.push(result);
					}

					await page.locator(selectors.getPage(pageNumber)).click();
				}

				await page.close();

				resolve(results);
			});
		});
	}
});

//const results = await Promise.all(searches);

// TODO: Not this.
const results = await (async function() {
	const results = [];

	for (const search of searches) {
		results.push(await search());
	}

	return results;
})();

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

const unique = new Set();

for (let x = 0, result = results[x]; x < results.length; x++, result = results[x]) {
	const filteredResults = result.filter(function(result) {
		if (unique.has({
			...result,
			"link": undefined
		})) {
			return false;
		}

		unique.add({
			...result,
			"link": undefined
		});

		return !/account|manage|salesforce|security|servicenow/u.test(result.title.toLowerCase())
			&& (result.greenText !== undefined
				// We are preferential to newer job postings, but if the low bound of the salary range is above my /minimum/ salary expectations, I'll look at it too.
				|| parseInt(result.compensation?.match(/\$[\d,]+/gu)[0].replace(/[$,]+/gu, "")) >= 150000)
	});

	const table = [
		"<table>",
		"<thead>",
		"<tr>",
		"<th width=\"25%\"><!-- Logo --></th>",
		"<th width=\"25%\">Company</th>",
		"<th width=\"50%\">Position</th>",
		"<th width=\"25%\">Size</th>",
		//"<th width=\"25%\">Compensation</th>",
		"</tr>",
		"</thead>",
		"<tbody>"
	];

	for (const { title, greenText, link, logo, company, compensation, size, industry } of filteredResults) {
		table.push(
			"<tr>",
			"<td><a href=\"" + link + "\"><img alt=\"" + company + "\" height=\"50px\" width=\"50px\" src=\"" + logo + "\"></a></td>",
			"<td>" + company + (industry !== undefined ? "<br />" + industry : "") + "</td>",
			"<td><ul><li>💼 <a href=\"" + link + "\">" + title + "</a></li>" + (compensation !== undefined ? "<li>💰 " + compensation + "</li>" : "") + + (greenText !== undefined ? "<li>⚠ " + greenText + "</li>" : "") + "</ul></td>",
			"<td>" + size + "</td>",
			//"<td>" + (compensation?.split(" (from job description)")[0] ?? "") + "</td>",
			"</tr>"
		);
	}

	table.push(
		"</tbody>",
		"</table>",
		"\n"
	)

	await fs.appendFile(readme, [
		"### Search term: `" + searchTerms[x] + "`",
		"",
		...table
	].join("\n"));
}

process.exit(0);

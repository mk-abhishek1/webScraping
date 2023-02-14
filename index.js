const puppeteer = require('puppeteer');

const URL = "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"
const COMPANYID = "U72900PN2011PTC139406"

async function launchTask(url) {
    const browser = await puppeteer.launch({
        headless: false,
        // defaultViewport: false,

    })
    const page = await browser.newPage();
    await page.goto(url);
    await page.type('#companyID', COMPANYID);
    await page.keyboard.press('Enter');
    await page.screenshot({ path: "screenshot.png" });

    // await browser.close()
}


launchTask(URL)
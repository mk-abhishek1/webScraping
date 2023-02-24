const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
require('dotenv').config()

const URL = process.env.URL
const COMPANYID = process.env.COMPANYID
let companyDetails;
const captchaImagePath = 'captchaImage.png';

(async () => {
    console.log("Launching");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });
    const page = await browser.newPage();

    try {
        await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    } catch (error) {
        console.log("something wrong with URL: " + URL, error);
        await browser.close();
        return;
    }
    await page.type('#companyID', COMPANYID, { delay: 50 });

    await solveCaptcha(page);
    console.log(JSON.stringify(companyDetails, null, 2));
    fs.writeFileSync('./companyDetails.json', JSON.stringify(companyDetails, null, 2));
    await browser.close();
})()

async function solveCaptcha(page) {
    await page.waitForSelector('#captcha');
    const captchaImage = await page.$('#captcha');

    await captchaImage.evaluate((img) => {
        return new Promise((resolve) => {
            if (img.complete) {
                resolve();
            } else {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve);
            }
        });
    });

    await captchaImage.screenshot({ path: captchaImagePath });
    const { data: { text } } = await Tesseract.recognize(captchaImagePath, 'eng');
    if (!text) {
        await page.click('a[href="#"][onclick="javascript: return refreshCaptcha();"][id="captchaRefresh"] img[title="Refresh"]');
        await solveCaptcha(page);
    } else {
        await page.type('#userEnteredCaptcha', text);
        console.log('Captcha', text);
        try {
            const message = await page.waitForSelector('div.msg_overlay',
                { polling: 100, timeout: 1000, visibility: true })
            if (message) {
                await page.waitForSelector('a.boxclose#msgboxclose', { timeout: 1000, visible: true });
                await page.click('a.boxclose#msgboxclose');
                await solveCaptcha(page);
            }
        } catch (error) {
            console.log("...")
        }
        try {
            await page.waitForSelector('#exportCompanyMasterData', { timeout: 1000, visible: true });
            companyDetails = await page.$$eval('#exportCompanyMasterData', nodes => {
                return nodes.map(node => {
                    const detailTable = node.querySelector('#resultTab1');
                    const detailRows = Array.from(detailTable.querySelectorAll('tr'));
                    const LLP_MasterData = detailRows.reduce((object, row) => {
                        const columns = row.querySelectorAll('td');
                        const { textContent: key } = columns[0];
                        const { textContent: value } = columns[1];
                        object[key.trim()] = value.trim();
                        return object;
                    }, {});
                    const detailDirectorsTable = node.querySelector('#resultTab6');
                    const detaiDirectorslRows = Array.from(detailDirectorsTable.querySelectorAll('tr'));
                    const Directors = detaiDirectorslRows.map(row => {
                        try {
                            const columns = row.querySelectorAll('td');
                            const dinPan = columns[0].textContent.trim();
                            const name = columns[1].textContent.trim();
                            const beginDate = columns[2].textContent.trim();
                            const endDate = columns[3].textContent.trim();
                            const surrenderedDin = columns[4].textContent.trim();
                            return { dinPan, name, beginDate, endDate, surrenderedDin };
                        } catch (error) {
                            console.error('Error parsing row:', error);
                            return null;
                        }
                    }).filter(row => row !== null);

                    return {
                        LLP_MasterData,
                        Directors
                    }
                });
            });
        } catch (error) {
            console.error('Server Error/unhandled response');
        }
    }
}


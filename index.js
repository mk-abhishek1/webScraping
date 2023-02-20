const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const fs = require('fs');

const URL = "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"
const COMPANYID = "U72900PN2011PTC139406"

async function launch(url) {
    let userEnteredCaptcha = "";
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: false,
    })
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 0 });
    } catch (error) {
        console.log("something wrong with URL: " + url, error);
        await browser.close();
    }

    await page.type('#companyID', COMPANYID);
    await page.waitForSelector('#captcha');
    const logo = await page.$('#captcha');
    await logo.screenshot({
        path: 'captchaImage.png'
    });

    const { data: { text } } = await Tesseract.recognize(
        'captchaImage.png',
        'eng',
    );

    if (!text) {
        console.log("InCorrect Captcha");
        browser.close();
        launch(URL);
    } else {
        page.waitForNavigation(),
            console.log(text, "Captcha");
        userEnteredCaptcha = text;
    }

    if (userEnteredCaptcha) {
        await page.type('#userEnteredCaptcha', userEnteredCaptcha);
        try {
            await page.waitForSelector('#msg_overlay', { timeout: 1000, visible: true });
            await launch(URL);
        } catch (error) {
            console.log("success");
        }

        try {
            await page.waitForSelector('#exportCompanyMasterData', { timeout: 0, visible: true });
            const companyDetails = await page.$$eval('#exportCompanyMasterData', nodes => {
                return nodes.map(node => {
                    const detailTable = node.querySelector('#resultTab1');
                    const detailRows = Array.from(detailTable.querySelectorAll('tr'));
                    const LLP_MasterData = detailRows.reduce((object, row) => {
                        const columns = row.querySelectorAll('td');
                        const { textContent: key } = columns[0];
                        const { textContent: value } = columns[1];
                        object[key.trim()] = value.trim();
                        return object
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
                })
            });
            console.log(companyDetails);
            fs.writeFileSync('./companyDetails.json', JSON.stringify(companyDetails));
            await browser.close();
        } catch (error) {
            console.error('Something went wrong:', error);
            launch(URL);
        }
    }
    try {
        await page.waitForSelector('.dinsteps', { timeout: 1000, visible: true });
        await launch(URL);
    } catch (error) {
        console.log("");
    }
    await browser.close();
}

launch(URL);

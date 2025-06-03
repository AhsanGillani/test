const express = require('express');
const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');
const isVercel = process.env.VERCEL === '1';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/generate-pdf', async (req, res) => {
  const { url } = req.body;

  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'A valid URL is required' });
  }

  let browser;
  try {
    // Local development uses full puppeteer
    let executablePath;
    if (isVercel) {
      executablePath = await chromium.executablePath();
    } else {
      // Use locally installed Chromium
      const puppeteerFull = require('puppeteer');
      executablePath = puppeteerFull.executablePath();
    }

    browser = await puppeteer.launch({
      args: isVercel 
        ? [...chromium.args, '--hide-scrollbars', '--disable-web-security']
        : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: 'new',
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=page.pdf',
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.get('/', (req, res) => {
  res.send("PDF Generator API is running. Send a POST request to /generate-pdf with a URL to generate a PDF.");
});

module.exports = app;

if (!process.env.IS_VERCEL) {
  app.listen(port, () => {
    console.log(`PDF Generator API listening at http://localhost:${port}`);
  });
}
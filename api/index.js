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
    // Chromium path resolution that WORKS on Vercel
    let executablePath;
    if (isVercel) {
      // Absolute path required for Vercel
      executablePath = '/var/task/node_modules/@sparticuz/chromium-min/bin/chromium';
    } else {
      // Local development path
      executablePath = require('puppeteer').executablePath();
    }

    const launchOptions = {
      args: [
        ...(isVercel ? chromium.args : []),
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
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
    if (browser) await browser.close();
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
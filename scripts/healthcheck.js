/**
 * Threadkeep Healthcheck — DOM selector verification
 * Standalone Node.js script — not part of Chrome extension bundle
 * Usage: node scripts/healthcheck.js
 */

const puppeteer = require('puppeteer');

const PLATFORMS = [
  {
    name: 'claude',
    url: 'https://claude.ai/',
    selectors: {
      response: 'div.font-claude-response',
      prompt: '[class*="font-user-message"]'
    }
  },
  {
    name: 'chatgpt',
    url: 'https://chatgpt.com/',
    selectors: {
      response: '[data-message-author-role="assistant"]',
      prompt: '[data-message-author-role="user"]'
    }
  },
  {
    name: 'gemini',
    url: 'https://gemini.google.com/',
    selectors: {
      response: 'div.response-content',
      prompt: 'div.user-query-container'
    }
  },
  {
    name: 'perplexity',
    url: 'https://perplexity.ai/',
    selectors: {
      response: 'div.prose',
      prompt: 'h1[class*="query"]'
    }
  }
];

const ALERT_EMAIL = process.env.HEALTHCHECK_ALERT_EMAIL || '';
const alertErrors = [];

async function checkPlatform(platform) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  const results = { name: platform.name, url: platform.url, checks: [] };

  for (const [type, selector] of Object.entries(platform.selectors)) {
    try {
      await page.goto(platform.url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(selector, { timeout: 15000 });
      results.checks.push({ type, selector, status: 'OK' });
    } catch {
      results.checks.push({ type, selector, status: 'BROKEN' });
      alertErrors.push(`[${platform.name}] ${type} selector BROKEN: "${selector}"`);
    }
  }

  await browser.close();
  return results;
}

async function sendAlert(errors) {
  if (!ALERT_EMAIL) {
    console.warn('HEALTHCHECK_ALERT_EMAIL not set — skipping email');
    return;
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.HEALTHCHECK_SMTP_USER,
      pass: process.env.HEALTHCHECK_SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.HEALTHCHECK_SMTP_USER,
    to: ALERT_EMAIL,
    subject: '[Threadkeep Healthcheck] DOM selectors broken',
    text: `Errors found:\n\n${errors.join('\n')}`
  });
}

async function main() {
  console.log('Threadkeep Healthcheck — starting...');

  for (const platform of PLATFORMS) {
    const result = await checkPlatform(platform);
    for (const check of result.checks) {
      const icon = check.status === 'OK' ? '✓' : '✗';
      console.log(`  ${icon} ${result.name}/${check.type}: ${check.selector} — ${check.status}`);
    }
  }

  if (alertErrors.length > 0) {
    console.error('\nALERTS:');
    alertErrors.forEach(e => console.error(`  ${e}`));
    await sendAlert(alertErrors);
    process.exit(1);
  } else {
    console.log('\nAll selectors OK.');
  }
}

main().catch(err => {
  console.error('Healthcheck failed:', err);
  process.exit(1);
});

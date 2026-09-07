const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3001';
const CSV_PATH = 'C:\Users\devel\AppData\Local\Temp\claude\c--Users-devel-Downloads-PMS-New\1daa77ee-98d6-41e0-b016-aa58a556d355\scratchpad\design.csv';
const errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });

  // 1. Login
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('#id', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/add-project', { timeout: 15000 });
  await page.screenshot({ path: path.join(__dirname, '01_add_project.png') });

  // 2. Add a project
  await page.click('button:has-text("Add Project")');
  await page.fill('input[placeholder="Enter project name"]', 'Verify Project');
  await page.fill('input[placeholder="Enter contractor name"]', 'Test Contractor');
  await page.fill('input[placeholder="Enter 10-digit phone number"]', '9876543210');
  await page.fill('input[placeholder="Enter email address"]', 'test@example.com');
  await page.fill('input[placeholder="Enter project location"]', 'Test City');
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2026-09-01');
  await dateInputs.nth(1).fill('2026-12-01');
  await page.click('button[type="submit"]:has-text("Save")');
  await page.waitForSelector('text=Project Added!', { timeout: 10000 }).catch(() => {});
  await page.click('button:has-text("Great, thanks!")').catch(() => {});
  await page.screenshot({ path: path.join(__dirname, '02_project_added.png') });

  // 3. Upload design for that project
  await page.click('[title="Upload Design"]');
  await page.setInputFiles('input[type="file"]', CSV_PATH);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, '03_upload_preview.png') });
  await page.click('button[type="submit"]:has-text("Upload")');
  await page.waitForTimeout(1000);

  // 4. Open View Design
  await page.click('[title="View Design"]');
  await page.waitForURL('**/view-design/**', { timeout: 15000 });
  await page.screenshot({ path: path.join(__dirname, '04_view_design.png') });

  // 5. Click Actual on first row, fill a value, save
  await page.getByRole('button', { name: 'Actual', exact: true }).first().click();
  await page.waitForTimeout(500);
  const editableInputs = page.locator('input:not([readonly])');
  await editableInputs.nth(0).fill('999');
  await page.screenshot({ path: path.join(__dirname, '05_actual_modal.png') });
  await page.click('button[type="submit"]:has-text("Save")');
  await page.waitForTimeout(1000);

  // 6. Navigate to Actual Details
  await page.getByRole('button', { name: 'Actual Details', exact: true }).click();
  await page.waitForURL('**/actual-details/**', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '06_actual_details.png'), fullPage: true });

  const pipeDiaVisible = await page.getByText('All Pipe Dia').first().isVisible().catch(() => false);
  const bodyText = await page.locator('body').innerText();

  console.log('PIPE_DIA_DROPDOWN_VISIBLE:', pipeDiaVisible);
  console.log('ERRORS_COUNT:', errors.length);
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  console.log('---BODY_SNIPPET---');
  console.log(bodyText.slice(0, 800));

  await browser.close();
})().catch(e => {
  console.error('SCRIPT_FAILED:', e);
  process.exit(1);
});

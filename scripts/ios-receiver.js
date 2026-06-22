#!/usr/bin/env node
// Minimal prototype receiver — NOT for production
// Run: node scripts/ios-receiver.js
// Then point your iPhone Shortcut at: http://YOUR_MAC_IP:3456/capture

const http = require('http');
const { execSync } = require('child_process');

const PORT = 3456;

// --- Minimal parser (no TS compilation needed) ---
function parse(text) {
  const lower = text.toLowerCase();

  // Amount: ₹1,500.00 or Rs.1500 or INR 1500
  const amountMatch =
    text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i);
  const amount = amountMatch
    ? Math.round(parseFloat(amountMatch[1].replace(/,/g, '')) * 100)
    : null;

  // Type
  const type =
    /debited|debit|spent|paid|sent|withdrawn|purchase/i.test(text)
      ? 'debit'
      : /credited|credit|received|refund/i.test(text)
      ? 'credit'
      : 'unknown';

  // Balance
  const balMatch = text.match(/(?:bal(?:ance)?(?:\s*(?:is|:))?\s*)(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i);
  const balance = balMatch
    ? Math.round(parseFloat(balMatch[1].replace(/,/g, '')) * 100)
    : null;

  // UPI ref
  const refMatch = text.match(/(?:upi\s*ref(?:\.?\s*no\.?)?|ref(?:erence)?\s*(?:no\.?)?)\s*[:\-]?\s*(\d{6,})/i);
  const upiRef = refMatch ? refMatch[1] : null;

  // Account last 4
  const acctMatch = text.match(/(?:a\/c|acct|account|card)[\s\w]*?(\d{4})\b/i);
  const account = acctMatch ? acctMatch[1] : null;

  return { amount_paise: amount, type, balance_paise: balance, upi_ref: upiRef, account_last4: account };
}

// --- Write to Apple Notes via osascript ---
function writeToNotes(sender, raw, parsed) {
  const now = new Date();
  const dateStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const monthYear = now.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const noteName = `Monflo — ${monthYear}`;

  const amountStr = parsed.amount_paise != null
    ? `₹${(parsed.amount_paise / 100).toFixed(2)}`
    : 'Amount unknown';

  const icon = parsed.type === 'debit' ? '🔴' : parsed.type === 'credit' ? '🟢' : '⚪';

  const entry = [
    `---`,
    `📅 ${dateStr}`,
    `🏦 ${sender}`,
    `${icon} ${amountStr.toUpperCase()} ${parsed.type.toUpperCase()}`,
    parsed.balance_paise != null ? `💰 Bal: ₹${(parsed.balance_paise / 100).toFixed(2)}` : null,
    parsed.upi_ref ? `🔖 UPI Ref: ${parsed.upi_ref}` : null,
    parsed.account_last4 ? `💳 A/c: ****${parsed.account_last4}` : null,
    `📝 ${raw}`,
    `---`,
  ].filter(Boolean).join('\\n');

  const script = `
tell application "Notes"
  set noteName to "${noteName}"
  set noteBody to "${entry}"
  if (count of (notes whose name is noteName)) > 0 then
    set theNote to first note whose name is noteName
    set body of theNote to (body of theNote) & return & return & noteBody
  else
    make new note with properties {name:noteName, body:noteBody}
  end if
end tell
`;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    console.log(`[OK] Written to Notes: "${noteName}"`);
  } catch (e) {
    console.error('[NOTES ERROR]', e.message);
  }
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/capture') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { text, sender } = JSON.parse(body);
        console.log(`\n[RECEIVED] from=${sender}`);
        console.log(`[SMS] ${text}`);

        const parsed = parse(text);
        console.log('[PARSED]', parsed);

        writeToNotes(sender || 'Unknown', text, parsed);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, parsed }));
      } catch (e) {
        console.error('[ERROR]', e.message);
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200);
    res.end('pong');
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Monflo iOS Receiver ===`);
  console.log(`Listening on port ${PORT}`);
  console.log(`Test it: curl http://localhost:${PORT}/ping`);
  console.log(`\nGet your Mac IP with: ipconfig getifaddr en0`);
  console.log(`Then use that IP in your iPhone Shortcut.\n`);
});

#!/usr/bin/env npx tsx
// iOS SMS → Apple Notes receiver (prototype)
// Run: npx tsx scripts/ios-receiver.ts
// Shortcut URL: http://Chaitus--MacBook-Air.local:3456/capture

import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';
import { UniversalParser } from '../src/domain/tracking/UniversalParser';
import type { ParsingResult } from '../src/domain/tracking/types';

const PORT = 3456;
const RAW_LOG = '/tmp/monflo-raw.jsonl';

function appendRawLog(entry: object): void {
  try {
    fs.appendFileSync(RAW_LOG, JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {}
}

function writeToNotes(sender: string, raw: string, result: ParsingResult): void {
  const now = new Date();
  const monthYear = now.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const noteName = `Monflo — ${monthYear}`;

  const primaryEvent = result.events[0];
  const amountPaise = Math.abs(primaryEvent.amountPaise);
  const amountStr = `₹${(amountPaise / 100).toFixed(2)}`;

  // Prefer the txn date extracted from the SMS over the arrival time
  const txnDate = new Date(result.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const icon =
    primaryEvent.type === 'debit'     ? '🔴' :
    primaryEvent.type === 'credit'    ? '🟢' :
    primaryEvent.type === 'cashback'  ? '💰' :
    primaryEvent.type === 'reversal'  ? '↩️' : '⚪';

  const cashbackEvent = result.events.find(e => e.type === 'cashback');

  const lines = [
    `---`,
    `📅 ${txnDate}`,
    `🏦 ${sender}`,
    `${icon} ${amountStr} ${primaryEvent.type.toUpperCase()}`,
    primaryEvent.merchantName           ? `🏪 ${primaryEvent.merchantName}`                                  : null,
    cashbackEvent                       ? `💸 Cashback: ₹${(Math.abs(cashbackEvent.amountPaise) / 100).toFixed(2)}` : null,
    result.referenceId                  ? `🔖 Ref: ${result.referenceId}`                                   : null,
    result.accountFingerprint           ? `💳 A/c: ****${result.accountFingerprint}`                        : null,
    `📊 Confidence: ${Math.round(result.confidence * 100)}%`,
    `📝 ${raw}`,
    `---`,
  ].filter((l): l is string => l !== null).join('\n');

  // Write via temp file — bypasses all AppleScript string-escaping limits
  const tmpFile = `/tmp/monflo_entry_${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, lines, 'utf8');

  const safeNoteName = noteName.replace(/"/g, '\\"');
  const script = `
tell application "Notes"
  set noteName to "${safeNoteName}"
  set entryText to read POSIX file "${tmpFile}" as «class utf8»
  if (count of (notes whose name is noteName)) > 0 then
    set theNote to first note whose name is noteName
    set body of theNote to (body of theNote) & return & return & entryText
  else
    make new note with properties {name:noteName, body:entryText}
  end if
end tell
`;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    console.log(`[OK] Written to Notes: "${noteName}"`);
  } catch (e: any) {
    console.error('[NOTES ERROR]', e.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/capture') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { text, sender } = JSON.parse(body) as { text: string; sender: string };
        console.log(`\n[RECEIVED] from=${sender ?? '(none)'}`);
        console.log(`[SMS] ${text ?? '(none)'}`);

        if (!text?.trim()) {
          console.warn('[WARN] Empty text — map the Shortcut "text" field to Content (Shortcut Input)');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'empty text' }));
          return;
        }

        // Durable raw backup — written before any parsing so nothing is lost on crashes
        appendRawLog({ ts: Date.now(), sender, text });

        // Format as sms:<sender-id> so UniversalParser can extract brand/suffix/trust
        // e.g. "AD-HDFCBK-S" → "sms:AD-HDFCBK-S" (suffix S = service = VERIFIED)
        // Phone numbers like "+919110745556" → "sms:+919110745556" (SCAM_RISK trust, still parsed)
        const sourcePackage = sender ? `sms:${sender.replace(/^sms:/, '')}` : 'app';

        const result = UniversalParser.parse(text, sourcePackage);

        if (!result) {
          console.log('[SKIP] Promotional, duplicate, or non-transactional — not written to Notes');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, skipped: true, reason: 'promotional/duplicate/non-transactional' }));
          return;
        }

        const ev = result.events[0];
        console.log('[PARSED]', JSON.stringify({
          amount:     `₹${(Math.abs(result.amountPaise) / 100).toFixed(2)}`,
          type:       ev?.type,
          merchant:   ev?.merchantName,
          ref:        result.referenceId,
          acct:       result.accountFingerprint,
          confidence: `${Math.round(result.confidence * 100)}%`,
          tier:       ev?.tier,
        }, null, 2));

        writeToNotes(sender || 'Unknown', text, result);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, parsed: result }));
      } catch (e: any) {
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
  console.log(`Shortcut URL : http://Chaitus--MacBook-Air.local:${PORT}/capture`);
  console.log(`Ping test    : /usr/bin/curl http://localhost:${PORT}/ping`);
  console.log(`Raw log      : ${RAW_LOG}\n`);
});

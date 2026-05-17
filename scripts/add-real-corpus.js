const fs = require('fs');
const path = require('path');

const CORPUS_DIR = path.resolve(__dirname, '../test-data/corpus');

const SAMPLES = [
  {
    category: 'icici',
    filename: 'sample-real-debit-1.json',
    input: "ICICI Bank Acct XX041 debited for Rs 75.00 on 15-May-26; SHAIK IMRAN AHM credited. UPI:737761560069. Call 18002662 for dispute. SMS BLOCK 041 to 9215676766",
    expected: { amount: 7500, currency: "INR" }
  },
  {
    category: 'icici',
    filename: 'sample-real-credit-2.json',
    input: "Dear Customer, Acct XX041 is credited with Rs 1760.00 on 13-May-26 from TULALA HARSHA G. UPI:123337608996-ICICI Bank.",
    expected: { amount: -176000, currency: "INR" }
  },
  {
    category: 'sbi',
    filename: 'sample-real-debit-3.json',
    input: "Dear UPI user A/C X6090 debited by 15.00 on date 03Apr26 trf to AVENUE FOOD PLAZ Refno 830400847000 If not u? call-1800111109 for other services-18001234-SBI",
    expected: { amount: 1500, currency: "INR" }
  },
  {
    category: 'hsbc',
    filename: 'sample-real-debit-4.json',
    input: "NR 1000.00 is paid from HSBC account XXXXXX1006 to BEHERA TATHAGAT on 11-May-26 with ref 613101256215. If this is not done by you, call 18002673456 to report.",
    expected: { amount: 100000, currency: "INR" }
  },
  {
    category: 'hsbc',
    filename: 'sample-real-debit-5.json',
    input: "INR 1140.00 is paid from HSBC account XXXXXX1006 to Yum Yum Tree Arabian Food Court on 08-May-26 with ref 275210596918. If this is not done by you, call 18002673456 to report.",
    expected: { amount: 114000, currency: "INR" }
  },
  {
    category: 'hsbc',
    filename: 'sample-real-debit-6.json',
    input: "INR 1570.00 is paid from HSBC account XXXXXX1006 to TULALA HARSHA GUNA on 13-May-26 with ref 471067860684. If this is not done by you, call 18002673456 to report.",
    expected: { amount: 157000, currency: "INR" }
  },
  {
    category: 'union',
    filename: 'sample-real-debit-7.json',
    input: "A/c *1114 Debited for Rs:500.00 on 13-05-2026 17:05:09 by Mob Bk ref no 709515471120 Avl Bal Rs:20.55.If not you, Call 1800222243 -Union Bank of India",
    expected: { amount: 50000, currency: "INR" }
  },
  {
    category: 'union',
    filename: 'sample-real-credit-8.json',
    input: "A/c *1114 Credited for Rs:250.00 on 27-04-2026 12:18:45 by Mob Bk ref no 882705383159 Avl Bal Rs:8852.55.Never Share OTP/PIN/CVV-Union Bank of India",
    expected: { amount: -25000, currency: "INR" }
  },
  {
    category: 'union',
    filename: 'sample-real-credit-9.json',
    input: "A/c *1114 Credited for Rs:380.00 on 09-05-2026 18:20:40 by Mob Bk ref no 840730464678 Avl Bal Rs:1628.55.Never Share OTP/PIN/CVV-Union Bank of India",
    expected: { amount: -38000, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-debit-10.json',
    input: "Sent Rs.200.00\nFrom HDFC Bank A/C *6084\nTo Zepto\nOn 16/05/26\nRef 134956946180\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
    expected: { amount: 20000, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-debit-11.json',
    input: "Sent Rs.342.00\nFrom HDFC Bank A/C *6084\nTo ORGANIC CREAMERY MADHAPUR\nOn 15/05/26\nRef 650122977911\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
    expected: { amount: 34200, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-debit-12.json',
    input: "Sent Rs.194.00\nFrom HDFC Bank A/C *6084\nTo Amazon Pay Groceries\nOn 14/05/26\nRef 613430358001\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
    expected: { amount: 19400, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-debit-13.json',
    input: "Sent Rs.60.00\nFrom HDFC Bank A/C *6084\nTo BANDLAMUDI ANUSHA\nOn 14/05/26\nRef 650012723604\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
    expected: { amount: 6000, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-credit-14.json',
    input: "Credit Alert!\nRs.702.00 credited to HDFC Bank A/c XX6084 on 13-05-26 from VPA 8639853866@axl (UPI 863660968463)",
    expected: { amount: -70200, currency: "INR" }
  },
  {
    category: 'hdfc',
    filename: 'sample-real-credit-15.json',
    input: "Credit Alert!\nRs.1750.00 credited to HDFC Bank A/c XX6084 on 13-05-26 from VPA 7893725627@ybl (UPI 264361623496)",
    expected: { amount: -175000, currency: "INR" }
  },
  {
    category: 'yesbank',
    filename: 'sample-real-statement-16.json',
    input: "YES BANK Credit Card XX7615 MAY-26 statement: Total due INR 5239.00  Min due INR 200.00 Due by 03-JUN-2026. Please pay full outstanding including decimal value to avoid any penal charges. Password: First 4 characters of your name in CAPS followed by DOB in DDMM. http://1kx.in/YESBNK/meO9Qt",
    expected: { amount: 523900, currency: "INR" }
  },
  {
    category: 'boi',
    filename: 'sample-real-credit-17.json',
    input: "BOI -  Rs.10000.00 Credited to your Ac XX1091 on 08-05-26 by UPI ref No.101908450293.Avl Bal 13451.00",
    expected: { amount: -1000000, currency: "INR" }
  },
  {
    category: 'yesbank',
    filename: 'sample-real-debit-18.json',
    input: "INR 1,166.00 spent on YES BANK Card X7615 @TATAUNISTORELTD 13-05-2026 10:40:51 pm. Avl Lmt INR 246,439.00. SMS BLKCC 7615 to 9840909000 if not you",
    expected: { amount: 116600, currency: "INR" }
  },
  {
    category: 'kvb',
    filename: 'sample-real-debit-19.json',
    input: "Your a/c XXXXXXXXXXXX4430 is debited Rs. 1450.00 on 16-May-2026 to GUDLA  AMMAJAMMA info :P2A/650247179317. Avl Bal INR 7255.11 Not You? call 18005721916-KVB",
    expected: { amount: 145000, currency: "INR" }
  },
  {
    category: 'kvb',
    filename: 'sample-real-balance-20.json',
    input: "KVB ALERT * INR 8,705.11 is the Balance in a/c **4430 as of 16-MAY-2026 00:55:03 * Download KVB-DLite mobile app from https://gi9.in/KVBANK/hI4jaV",
    expected: null
  },
  {
    category: 'icici',
    filename: 'sample-real-debit-21.json',
    input: "ICICI Bank Acct XX329 debited for Rs 4999.00 on 16-May-26; SURYA FUEL STAT credited. UPI:976422063511. Call 18002662 for dispute. SMS BLOCK 329 to 9215676766",
    expected: { amount: 499900, currency: "INR" }
  },
  {
    category: 'icici',
    filename: 'sample-real-credit-22.json',
    input: "Dear Customer, Acct XX329 is credited with Rs 10000.00 on 15-May-26 from SURYA FUEL STAT. UPI:006605302349-ICICI Bank.",
    expected: { amount: -1000000, currency: "INR" }
  },
  {
    category: 'boi',
    filename: 'sample-real-credit-23.json',
    input: "BOI -  Rs.13000.00 Credited to your Ac XX1098 on 16-05-26 by UPI ref No.864252686863.Avl Bal 13002.00",
    expected: { amount: -1300000, currency: "INR" }
  },
  {
    category: 'yesbank',
    filename: 'sample-real-info-24.json',
    input: "Dear Customer, registration for SUPERMONEY has started for YES BANK. If it was not you, report to your bank. Do not share card details/OTP/CVV with anyone.",
    expected: null
  },
  {
    category: 'yesbank',
    filename: 'sample-real-info-25.json',
    input: "Dear Customer, a cooling period limit of Rs. 5000 every 24 hours is applicable for the first 72 hours. Never share UPI PIN, CVV & OTP with anyone - YES BANK",
    expected: null
  }
];

SAMPLES.forEach(sample => {
  const providerDir = path.join(CORPUS_DIR, sample.category);
  if (!fs.existsSync(providerDir)) {
    fs.mkdirSync(providerDir, { recursive: true });
  }
  const filePath = path.join(providerDir, sample.filename);
  fs.writeFileSync(filePath, JSON.stringify({
    category: sample.category,
    input: sample.input,
    expected: sample.expected
  }, null, 2));
  console.log(`Created ${sample.category} sample: ${sample.filename}`);
});
console.log('All real-life samples added to corpus successfully!');

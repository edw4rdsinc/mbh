# Email Filtering Guide

**How the script decides which emails to process**

---

## Current Default Behavior

**Without any filters enabled, the script processes ANY email that:**

1. ✅ Is in your INBOX
2. ✅ Is unread
3. ✅ Has a `.csv` attachment
4. ✅ Is less than 7 days old (configurable)

**That's it!** No subject line matching, no sender restrictions.

---

## How to Add Filters

Edit `email-config.js` to add filtering rules.

All filters are **optional** - leave arrays empty `[]` to disable.

---

## Filter Option 1: Subject Line

**Only process emails with specific keywords in the subject**

```javascript
subjectKeywords: [
  'deduction report',
  'deduction summary',
  'allstate',
],
```

**Example:**
- ✅ "Deduction Report for October" → **Processes** (contains "deduction report")
- ✅ "Allstate Benefits Report" → **Processes** (contains "allstate")
- ❌ "Monthly Insurance Update" → **Skips** (no keywords match)

**When to use:**
- Multiple people email you CSVs for different purposes
- Want to avoid accidentally processing wrong files
- Need clear identification of deduction reports

---

## Filter Option 2: Sender Email/Domain

**Only process emails from trusted senders**

```javascript
allowedSenders: [
  '@mbhbenefits.com',           // Any email from this domain
  'angela@edw4rds.com',          // Specific email address
  '@gmail.com',                  // All Gmail addresses
],
```

**Example:**
- ✅ customer@mbhbenefits.com → **Processes** (domain matches)
- ✅ angela@edw4rds.com → **Processes** (exact match)
- ❌ spam@random.com → **Skips** (not in allowed list)

**When to use:**
- Limit to known customers only
- Prevent random people from using your automation
- Security/spam protection

---

## Filter Option 3: Recipient Address

**Only process when sent to a specific address**

```javascript
requiredRecipient: 'reports+deduction@edw4rds.com',
```

**Setup:**
Gmail supports "+" addressing:
- Main email: sam@edw4rds.com
- Deduction reports: sam+deduction@edw4rds.com
- Both go to same inbox!

**Example:**
- ✅ Sent to: sam+deduction@edw4rds.com → **Processes**
- ❌ Sent to: sam@edw4rds.com → **Skips**

**When to use:**
- Want dedicated email address for reports
- Keep personal emails separate from automation
- Better organization

---

## Filter Option 4: Email Age

**Skip emails older than X days**

```javascript
processing: {
  skipOlderThanDays: 7,  // Only process last 7 days
},
```

**Example:**
- ✅ Email from yesterday → **Processes**
- ❌ Email from 2 weeks ago → **Skips**

**When to use:**
- Prevent processing old backlog when first enabling
- Ignore outdated reports
- Default is 7 days (recommended)

---

## Recommended Configurations

### **Scenario 1: Tight Security (Recommended)**

Only process from known customers with "deduction" in subject:

```javascript
subjectKeywords: ['deduction'],
allowedSenders: [
  '@mbhbenefits.com',
  'customer1@company.com',
  'customer2@business.com',
],
requiredRecipient: '',
```

### **Scenario 2: Flexible (Good for Testing)**

Process any CSV from anyone, but require subject keyword:

```javascript
subjectKeywords: ['deduction report'],
allowedSenders: [],  // No sender restriction
requiredRecipient: '',
```

### **Scenario 3: Wide Open (Current Default)**

Process any unread email with CSV:

```javascript
subjectKeywords: [],   // No subject filter
allowedSenders: [],    // No sender filter
requiredRecipient: '', // No recipient filter
```

### **Scenario 4: Dedicated Email Address**

Only process emails sent to reports+deduction@edw4rds.com:

```javascript
subjectKeywords: [],
allowedSenders: [],
requiredRecipient: 'reports+deduction@edw4rds.com',
```

---

## How Filters Work Together

**All enabled filters must pass** (AND logic):

```javascript
subjectKeywords: ['deduction'],
allowedSenders: ['@company.com'],
```

Email must have:
- ✅ "deduction" in subject **AND**
- ✅ Sender from @company.com **AND**
- ✅ CSV attachment

If any filter fails, email is skipped.

---

## Testing Your Filters

**See what gets skipped:**

```bash
npm run check-emails
```

Output shows why each email was skipped:
```
⏭️  Skipping: "Monthly Report" (Subject doesn't contain required keywords)
⏭️  Skipping: "Deduction Report" (Sender spam@random.com not in allowed list)
⏭️  Skipping: "Newsletter" (no CSV attachment)
```

---

## Additional Settings

### **CC on Replies**

Automatically CC someone when sending Excel back:

```javascript
replyOptions: {
  ccAddresses: [
    'admin@yourcompany.com',
    'accounting@yourcompany.com',
  ],
},
```

### **Custom Signature**

Change reply email signature:

```javascript
replyOptions: {
  signature: `
Best regards,
Angela Smith
MBH Benefits
(555) 123-4567
  `.trim(),
},
```

### **Keep as Unread**

Don't mark emails as read after processing:

```javascript
processing: {
  markAsRead: false,  // Leaves emails unread
},
```

---

## Examples

### **Customer Instructions (Tight Security)**

> "To get your formatted deduction report:
>
> 1. Email your CSV to: sam@edw4rds.com
> 2. Subject line must include: **"Deduction Report"**
> 3. Your email must be: customer@yourcompany.com
> 4. You'll receive the Excel file within 5 minutes!"

### **Customer Instructions (Dedicated Address)**

> "To get your formatted deduction report:
>
> 1. Email your CSV to: **sam+deduction@edw4rds.com**
> 2. Any subject line is fine
> 3. You'll receive the Excel file within 5 minutes!"

### **Customer Instructions (Wide Open - Testing Only)**

> "To get your formatted deduction report:
>
> 1. Email your CSV to: sam@edw4rds.com
> 2. That's it! You'll receive the Excel file within 5 minutes!"

---

## Troubleshooting

### **"My email isn't getting processed!"**

Check:
1. Is it unread? (Script only processes unread emails)
2. Does it have a CSV attachment?
3. Does subject match your keywords? (if enabled)
4. Is sender allowed? (if filtering by sender)
5. Is it less than 7 days old?

Run manually to see skip reason:
```bash
npm run check-emails
```

### **"Too many emails are being processed!"**

Add stricter filters:
```javascript
subjectKeywords: ['deduction report'],  // Require specific subject
```

### **"How do I disable all filters?"**

```javascript
subjectKeywords: [],
allowedSenders: [],
requiredRecipient: '',
```

---

## What I Recommend

**Start with this (safe default):**

```javascript
subjectKeywords: ['deduction'],
allowedSenders: [],  // Allow anyone (for now)
requiredRecipient: '',
processing: {
  markAsRead: true,
  skipOlderThanDays: 7,
},
```

**Then add sender restrictions once you know your customers:**

```javascript
allowedSenders: [
  'customer1@company.com',
  'customer2@business.com',
],
```

---

**Current config:** See `email-config.js`

**Test filtering:** `npm run check-emails`

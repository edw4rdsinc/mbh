# Deduction Report Automation - Implementation Plan

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Wasabi S3 Storage                          │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   inputs/        │         │   outputs/       │          │
│  │  - Raw CSV files │         │  - Excel reports │          │
│  └────────┬─────────┘         └────────▲─────────┘          │
│           │                              │                    │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            │ Download                     │ Upload
            ▼                              │
┌──────────────────────────────────────────┼───────────────────┐
│           Node.js Processor              │                    │
│  ┌────────────────────────────────────────────────────┐      │
│  │  1. CSV Parser & Validator                         │      │
│  │     - Read CSV                                      │      │
│  │     - Validate structure                            │      │
│  │     - Extract account info                          │      │
│  └──────────────┬─────────────────────────────────────┘      │
│                 ▼                                             │
│  ┌────────────────────────────────────────────────────┐      │
│  │  2. Data Transformer                               │      │
│  │     - Filter terminated employees                   │      │
│  │     - Parse names (Last, First)                     │      │
│  │     - Map statuses                                  │      │
│  │     - Calculate Pre-Tax field                       │      │
│  │     - Calculate Semi-Monthly deductions             │      │
│  │     - Sort by last name                             │      │
│  │     - Group by payor                                │      │
│  │     - Insert subtotal rows                          │      │
│  └──────────────┬─────────────────────────────────────┘      │
│                 ▼                                             │
│  ┌────────────────────────────────────────────────────┐      │
│  │  3. Excel Generator                                │      │
│  │     - Create workbook                               │      │
│  │     - Add header section (rows 1-8)                 │      │
│  │     - Add data rows                                 │      │
│  │     - Apply formatting (colors, borders, fonts)     │      │
│  │     - Format currency columns                       │      │
│  │     - Name sheet tab                                │      │
│  └──────────────┬─────────────────────────────────────┘      │
│                 ▼                                             │
│  ┌────────────────────────────────────────────────────┐      │
│  │  4. Wasabi Uploader                                │      │
│  │     - Upload to outputs/ folder                     │      │
│  │     - Generate timestamped filename                 │      │
│  └────────────────────────────────────────────────────┘      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
/home/sam/chatbot-platform/mbh/deduction-report/
│
├── src/
│   ├── index.js                 # Main entry point
│   ├── csv-parser.js            # CSV parsing logic
│   ├── data-transformer.js      # Business logic transformations
│   ├── excel-generator.js       # Excel file creation with styling
│   ├── wasabi-client.js         # S3/Wasabi operations
│   └── config.js                # Configuration management
│
├── config/
│   └── default.json             # Configuration file
│
├── downloaded/                  # Temp folder for downloaded CSVs
├── generated/                   # Temp folder for generated Excel files
│
├── tests/
│   ├── csv-parser.test.js
│   ├── data-transformer.test.js
│   └── excel-generator.test.js
│
├── package.json
├── .env                         # Wasabi credentials (gitignored)
├── README.md
├── PROCESS_ANALYSIS.md
└── IMPLEMENTATION_PLAN.md
```

---

## Module Breakdown

### 1. `config.js` - Configuration Management

```javascript
{
  wasabi: {
    bucketName: "mbh-deduction-report",
    region: "us-west-1",
    endpoint: "https://s3.us-west-1.wasabisys.com",
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY
  },
  processing: {
    newPolicyDate: "2025-11-01", // Date to mark policies as "** NEW **"
    billingCycle: "Semi-Monthly",
    carrierName: "Allstate Benefits"
  },
  formatting: {
    disclaimerText: "Please note: this deduction summary...",
    headerFontSize: 16
  }
}
```

### 2. `csv-parser.js` - CSV Parsing

**Responsibilities:**
- Read CSV from file or buffer
- Validate required columns exist
- Extract account number and name from first data row
- Return structured data array

**Key Functions:**
- `parseCSV(filePath or buffer)` → returns `{ accountNumber, accountName, rows }`
- `validateColumns(headers)` → throws error if missing required columns

### 3. `data-transformer.js` - Data Transformations

**Responsibilities:**
- Filter out terminated employees
- Parse "LAST, FIRST" names into separate columns
- Map status values
- Calculate Pre-Tax field based on product type
- Calculate Semi-Monthly deductions
- Sort by last name
- Group by payor and insert subtotals

**Key Functions:**
- `filterTerminated(rows)` → filtered array
- `parseName(insuredName)` → `{ lastName, firstName }`
- `mapStatus(status, effectiveDate, newPolicyDate)` → mapped status
- `calculatePreTax(productType)` → "Y" or "N"
- `calculateSemiMonthly(monthlyPremium)` → number
- `sortByLastName(rows)` → sorted array
- `groupAndSubtotal(rows)` → array with subtotal rows inserted
- `transform(csvData, config)` → fully transformed data

### 4. `excel-generator.js` - Excel Generation

**Responsibilities:**
- Create Excel workbook using `exceljs`
- Add header section (rows 1-8) with merges and styling
- Add column headers (row 9)
- Add data rows with appropriate formatting
- Add subtotal rows with yellow highlighting
- Apply thick borders around entire table
- Apply bold/red formatting to ** NEW ** rows
- Format currency columns
- Set sheet name
- Save file

**Key Functions:**
- `createWorkbook(transformedData, config)` → ExcelJS Workbook
- `addHeader(worksheet, accountName, accountNumber, carrierName, date)`
- `addDataRows(worksheet, rows)`
- `applyFormatting(worksheet, rows)`
- `saveWorkbook(workbook, filename)` → buffer or file

### 5. `wasabi-client.js` - Wasabi Integration

**Responsibilities:**
- List files in inputs/ folder
- Download CSV files from inputs/
- Upload Excel files to outputs/
- Delete processed files (optional)

**Key Functions:**
- `listInputFiles()` → array of file keys
- `downloadFile(key)` → buffer
- `uploadFile(key, buffer)` → success/failure
- `deleteFile(key)` → success/failure

### 6. `index.js` - Main Orchestrator

**Responsibilities:**
- Load configuration
- Check for new input files
- Download CSV
- Parse CSV
- Transform data
- Generate Excel
- Upload to outputs/
- Handle errors and logging

**Main Flow:**
```javascript
async function processReport(inputFileKey) {
  try {
    // 1. Download CSV
    const csvBuffer = await wasabiClient.downloadFile(inputFileKey);

    // 2. Parse CSV
    const csvData = await csvParser.parseCSV(csvBuffer);

    // 3. Transform data
    const transformedData = dataTransformer.transform(csvData, config);

    // 4. Generate Excel
    const workbook = excelGenerator.createWorkbook(transformedData, config);
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // 5. Upload to outputs/
    const outputKey = `outputs/${transformedData.fileName}`;
    await wasabiClient.uploadFile(outputKey, excelBuffer);

    console.log(`✓ Successfully processed ${inputFileKey}`);

  } catch (error) {
    console.error(`✗ Error processing ${inputFileKey}:`, error);
    throw error;
  }
}
```

---

## Implementation Phases

### Phase 1: Core Functionality (MVP)
1. Set up project structure and dependencies
2. Implement CSV parser with validation
3. Implement data transformer with all business rules
4. Implement Excel generator with basic formatting
5. Test end-to-end with sample data

**Deliverable:** Working script that can process a local CSV file and generate formatted Excel

### Phase 2: Wasabi Integration
1. Implement Wasabi client (download/upload)
2. Integrate with main orchestrator
3. Test with files in Wasabi bucket
4. Add error handling and retry logic

**Deliverable:** Script that can process files from Wasabi bucket

### Phase 3: Advanced Formatting
1. Implement all Excel styling (colors, borders, fonts)
2. Add bold/red formatting for ** NEW ** rows
3. Add merged cells for header
4. Add thick borders around table

**Deliverable:** Excel output matches manual format exactly

### Phase 4: Automation & Monitoring
1. Add command-line interface (CLI)
2. Add logging (winston or similar)
3. Add email notifications on success/failure
4. Create cron job or scheduler integration
5. Add configuration validation

**Deliverable:** Production-ready automation

### Phase 5: Enhancements (Future)
1. Web UI for manual triggering
2. Multiple client support (different carriers/accounts)
3. Historical report storage
4. Diff/change detection between reports
5. Dashboard for monitoring

---

## Dependencies

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x",
    "csv-parse": "^5.x",
    "exceljs": "^4.x",
    "date-fns": "^2.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "jest": "^29.x",
    "@types/node": "^20.x"
  }
}
```

---

## Configuration Parameters

The system should be configurable for different clients/carriers:

```json
{
  "accountNumber": "ME610",
  "accountName": "STANGE LAW FIRM,PC",
  "carrierName": "Allstate Benefits",
  "billingCycle": "Semi-Monthly",
  "newPolicyDate": "2025-11-01",
  "inputFolder": "inputs/",
  "outputFolder": "outputs/",
  "productTypePreTaxMapping": {
    "Accident": "Y",
    "Critical Illness": "Y",
    "Disability": "N",
    "Group Term to 100": "N"
  }
}
```

---

## Error Handling Strategy

1. **CSV Validation Errors:**
   - Missing required columns → Stop processing, notify user
   - Empty file → Skip
   - Malformed data → Log row number, skip row

2. **Data Transformation Errors:**
   - Invalid name format → Use full name as last name
   - Missing date → Log warning, use null
   - Invalid premium amount → Log error, use 0

3. **Excel Generation Errors:**
   - Out of memory → Split into multiple files
   - Permission errors → Retry with different filename

4. **Wasabi Errors:**
   - Network timeout → Retry 3 times with exponential backoff
   - Permission denied → Stop processing, notify admin
   - File not found → Skip

---

## Testing Strategy

### Unit Tests
- Test each transformer function independently
- Test name parsing with edge cases
- Test subtotal calculations
- Test status mapping

### Integration Tests
- Test full CSV → Excel pipeline
- Compare output with expected output
- Validate Excel structure and formatting

### End-to-End Tests
- Upload test CSV to Wasabi
- Run processor
- Download and validate output Excel

---

## Monitoring & Logging

```javascript
{
  timestamp: "2025-10-20T12:00:00Z",
  inputFile: "inputs/FilteredPolicies-2025-10-15.csv",
  outputFile: "outputs/Stange Law Firm ME610 - Updated Deduction Summary.xlsx",
  stats: {
    inputRows: 85,
    filteredRows: 60,
    outputRows: 75, // including subtotals
    subtotals: 15,
    processingTimeMs: 1234
  },
  status: "success"
}
```

---

## Next Steps

1. **Set up project structure** (create directories, package.json)
2. **Install dependencies**
3. **Create config file with Wasabi credentials**
4. **Implement Phase 1** (CSV parser → transformer → Excel generator)
5. **Test with downloaded sample files**
6. **Iterate until output matches expected format**

Would you like me to start implementing the code?

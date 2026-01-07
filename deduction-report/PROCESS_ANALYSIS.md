# Deduction Report Automation - Process Analysis

## Input/Output Summary

**Input:** CSV file from carrier website
**Output:** Formatted Excel file with specific styling and calculated fields

---

## Detailed Transformation Steps

### 1. Column Operations

#### Initial Columns (CSV Input):
```
A: Number
B: Account Number (e.g., "ME610")
C: Account Name (e.g., "STANGE LAW FIRM,PC")
D: Insured Name (e.g., "JOHNSON, LARETHA")
E: Mode Premium (dollar amount)
F: Payor Name (same as Insured Name, e.g., "JOHNSON, LARETHA")
G: Product Type (e.g., "Group Term to 100", "Accident", "Critical Illness", "Disability")
H: Status (e.g., "Active - Premium Paying", "Terminated", "Initial Premium Due", "Pending")
I: Effective Date (date)
J-R: DELETE THESE COLUMNS (Source, Payor SSN, Issue Date, Owner Name, Owner Date Of Birth, Owner Phone Number, Owner Last 4 of SSN, Owner Email, Owner Address)
```

#### After Column J-R Deletion:
```
A: Number
B: Account Number
C: Account Name
D: Insured Name
E: Mode Premium
F: Payor Name
G: Product Type
H: Status
I: Effective Date
```

#### After Splitting Insured Name and Reordering:
```
A: Number → "Policy Number"
B: Last Name (from Insured Name)
C: First Name (from Insured Name)
D: Product Type
E: Pre-Tax (NEW CALCULATED COLUMN)
   - "Y" if Product Type = "Accident" OR "Critical Illness"
   - "N" if Product Type = "Disability" OR "Group Term to 100"
F: Status (with transformations)
G: Effective Date
H: Deduction Cycle (NEW - always "Semi-Monthly")
I: Monthly Premium (from Mode Premium)
J: Semi-Monthly EE Deduction (CALCULATED = Monthly Premium / 2)
```

---

## 2. Data Transformations

### A. Name Parsing
- **Insured Name** format: "LAST, FIRST" or "LAST, FIRST MIDDLE"
- Split on comma:
  - Everything before comma → Last Name
  - Everything after comma (trimmed) → First Name

### B. Status Mapping
- `"Active - Premium Paying"` → `"Active"`
- `"Pending"` with Effective Date = 11/1/2025 → `"** NEW **"`
- `"Initial Premium Due"` with Effective Date = 11/1/2025 → `"** NEW **"`
- All other statuses → keep as-is

### C. Pre-Tax Calculation
```javascript
if (productType === "Accident" || productType === "Critical Illness") {
    preTax = "Y";
} else if (productType === "Disability" || productType.includes("Group Term")) {
    preTax = "N";
}
```

### D. Premium Calculations
- Monthly Premium = Mode Premium (copied from input)
- Semi-Monthly EE Deduction = Monthly Premium / 2

---

## 3. Row Operations

### A. Filter Out Terminated Employees
- Remove any row where Status = "Terminated"

### B. Sort by Last Name
- After splitting names, alphabetize by Last Name column (B)
- Secondary sort by First Name if needed

### C. Group by Payor and Insert Subtotals
After sorting:
1. Group consecutive rows by Payor Name (which was originally in column F)
2. At each change in Payor Name, insert a subtotal row:
   - Columns A-H: empty
   - Column I: "Total:"
   - Column J: SUM of Semi-Monthly EE Deduction for that payor group
3. After inserting subtotals, DELETE the Payor Name column (no longer needed)

**Pattern observed:**
```
Row: Adams, Leslie - Policy 1 - $17.34
Row: Adams, Leslie - Policy 2 - $9.08
Row: Adams, Leslie - Policy 3 - $33.98
Row: Adams, Leslie - Policy 4 - $91.00
SUBTOTAL ROW: [empty cells] ... "Total:" $151.40
```

---

## 4. Excel Formatting

### A. Header Section (Rows 1-8)

```
Row 1: "Last Updated:" [current date]
Row 2-3: Disclaimer text (merged across all columns):
  "Please note: this deduction summary is being provided to you as a courtesy.
   It does NOT replace your invoice. To ensure accurate bookkeeping please reference,
   deduct, and pay according to the actual invoice from the carrier(s).
   If you need help accessing those, please let us know."
Row 4-7: Group name in size 16 font (merged): "Stange Law Firm PC"
Row 8: "Allstate Benefits # ME610"
```

- **Header styling:** Thick Outside Borders around rows 1-8

### B. Column Headers (Row 9)
```
Policy Number | Last Name | First Name | Product Type | Pre-Tax | Status |
Effective Date | Deduction Cycle | Monthly Premium | Semi-Monthly EE Deduction
```

### C. Data Row Styling

**Regular data rows:**
- All Borders applied to all cells
- ** NEW ** rows (Effective Date = 11/1/2025):
  - Bold
  - Red text
  - Applies to entire row

**Subtotal rows:**
- Bold
- Yellow highlight
- Right-aligned
- Outside Borders around the Semi-Monthly EE Deduction cell
- Column I shows "Total:"
- Column J shows the sum

**Entire summary:**
- Thick Outside Borders around the entire data table (rows 1 to last row)

### D. Currency Formatting
- Column I (Monthly Premium): Currency format ($X.XX)
- Column J (Semi-Monthly EE Deduction): Currency format ($X.XX)

### E. Date Formatting
- Column G (Effective Date): Date format
- Row 1 current date: Date format

---

## 5. Sheet and File Naming

### A. Sheet Tab Name
- Format: `[Account Number] - [Account Name]`
- Example: `ME610 - STANGE LAW FIRM,PC`

### B. File Name
- Format: `[Group Name] [Account Number] - Updated Deduction Summary.xlsx`
- Example: `Stange Law Firm ME610 - Updated Deduction Summary.xlsx`

---

## 6. Key Business Rules

1. **Billing Cycle:** Always "Semi-Monthly" for this group
2. **New Policy Date:** 11/1/2025 (will need to be parameterized as "current enrollment month")
3. **Carrier:** Allstate Benefits
4. **Account Number:** Extracted from CSV column B (first data row)
5. **Account Name:** Extracted from CSV column C (first data row)

---

## 7. Edge Cases to Handle

1. **Name variations:**
   - Single name (no comma): treat entire string as last name
   - Multiple middle names/initials
   - Suffixes (Jr, Sr, II, III, etc.)

2. **Payor grouping:**
   - Same person may have multiple policies (different product types)
   - Dependents are grouped under payor (e.g., children under parent)

3. **Date handling:**
   - Excel date serial numbers (e.g., 45946 = specific date)
   - Need to compare effective dates for "NEW" status determination

4. **Floating point precision:**
   - Semi-monthly deductions may have rounding issues (e.g., 11.309999999999999 vs 11.31)
   - Should round to 2 decimal places

---

## 8. Required Libraries/Tools

- **CSV parsing:** Node.js `csv-parse` or similar
- **Excel writing:** `exceljs` (supports styling, formulas, merges)
- **Date handling:** `date-fns` or native JavaScript Date
- **AWS SDK:** `@aws-sdk/client-s3` for Wasabi integration

---

## 9. Automation Architecture (Proposed)

```
┌─────────────────┐
│  Wasabi Bucket  │
│  inputs/        │
└────────┬────────┘
         │
         │ 1. Detect new CSV file
         ▼
┌─────────────────┐
│  Node.js App    │
│  - Download CSV │
│  - Parse data   │
│  - Transform    │
│  - Format Excel │
└────────┬────────┘
         │
         │ 2. Upload result
         ▼
┌─────────────────┐
│  Wasabi Bucket  │
│  outputs/       │
└─────────────────┘
```

### Execution Options:
1. **Manual:** Run script on demand
2. **Scheduled:** Cron job to check for new files
3. **Event-driven:** Wasabi webhook/notification when file uploaded
4. **Web UI:** Upload interface that triggers processing

---

## Next Steps

1. Create transformation script (Node.js)
2. Implement CSV parsing and validation
3. Implement data transformations
4. Implement Excel generation with styling
5. Add Wasabi upload/download integration
6. Add error handling and logging
7. Create configuration file for customizable values (dates, account info)
8. Test with sample data
9. Deploy automation

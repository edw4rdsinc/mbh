# Brand Assets Retrieval - Summary

## Current Status: ACTION REQUIRED

The Google Drive folder **is not currently shared** with the service account, so the brand assets cannot be accessed yet.

**Folder ID**: `1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO`
**Service Account**: `drive-master@mcp-g-drive-474704.iam.gserviceaccount.com`

---

## Quick Start (After Sharing Folder)

```bash
cd /home/sam/automations/commission_automator
./retrieve_brand_assets.sh
```

This will:
1. Check if you have access to the folder
2. Download all brand assets
3. Create a metadata file with organized information
4. Save everything to `./brand_assets/`

---

## Files Created

### Scripts

1. **`check_folder_access.py`** - Verify Google Drive access
   ```bash
   ./venv/bin/python3 check_folder_access.py
   ```

2. **`get_brand_assets.py`** - Download all brand assets
   ```bash
   ./venv/bin/python3 get_brand_assets.py
   ```

3. **`generate_brand_config.py`** - Create TypeScript config for Remotion
   ```bash
   ./venv/bin/python3 generate_brand_config.py
   ```

4. **`retrieve_brand_assets.sh`** - One-command solution (recommended)
   ```bash
   ./retrieve_brand_assets.sh
   ```

### Documentation

- **`BRAND_ASSETS_INSTRUCTIONS.md`** - Detailed setup and usage guide
- **`BRAND_ASSETS_SUMMARY.md`** - This file (quick reference)

### Virtual Environment

- **`venv/`** - Python virtual environment with Google Drive API libraries installed

---

## How to Grant Access

### Option 1: Via Web Interface

1. Open the folder: https://drive.google.com/drive/folders/1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO
2. Click "Share" (top right)
3. Add email: `drive-master@mcp-g-drive-474704.iam.gserviceaccount.com`
4. Set permission: "Viewer"
5. Click "Send" (uncheck "Notify people")

### Option 2: Via Terminal (if you have Drive CLI tools)

```bash
# Share folder with service account
gdrive share 1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO \
  --type user \
  --email drive-master@mcp-g-drive-474704.iam.gserviceaccount.com \
  --role reader
```

---

## What Gets Downloaded

The script will automatically categorize and download:

### Categories

1. **Logos** - Files containing: logo, icon, symbol
2. **Style Guides** - Files containing: guide, brand, style, guideline
3. **Color Files** - Files containing: color, palette, swatch
4. **Other** - All other files

### File Types Supported

- Images: PNG, JPG, SVG, etc.
- Documents: PDF, TXT, etc.
- Archives: ZIP, etc.

**Note**: Google-native files (Docs, Sheets, Slides) will show web view links but won't be downloaded. They need manual export or separate API calls.

---

## Output Structure

```
brand_assets/
├── logo.png                          # Downloaded files
├── brand-guide.pdf
├── colors.txt
├── brand_assets_metadata.json        # Structured metadata
└── brandConfig.ts                    # Remotion configuration (after running generate_brand_config.py)
```

### Metadata Structure

`brand_assets_metadata.json`:
```json
{
  "folder_id": "1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO",
  "assets": {
    "logos": [...],
    "style_guides": [...],
    "color_files": [...],
    "other": [...],
    "all_files": [...]
  },
  "colors": ["#FF5733", "#3498DB", ...]
}
```

---

## Using in Remotion

### Step 1: Download Assets

```bash
./retrieve_brand_assets.sh
```

### Step 2: Generate Config

```bash
./venv/bin/python3 generate_brand_config.py
```

### Step 3: Import in Remotion

```typescript
// In your Remotion component
import { staticFile } from 'remotion';
import { brandConfig, colors, logos } from './brand_assets/brandConfig';

export const MyVideo = () => {
  return (
    <div style={{ backgroundColor: colors.primary }}>
      <Img src={staticFile(logos.logo_png)} />
    </div>
  );
};
```

---

## Troubleshooting

### "File not found" or 404 Error
**Solution**: The folder isn't shared with the service account. Follow the "How to Grant Access" steps above.

### "Permission denied" or 403 Error
**Solution**: The service account needs at least "Viewer" permission on the folder.

### No files downloaded
**Possible causes**:
- Folder is empty
- Folder contains only Google-native files (Docs, Sheets, Slides)
- Service account doesn't have access to individual files (check folder-level permissions)

### Script errors
```bash
# Reinstall dependencies
rm -rf venv
python3 -m venv venv
./venv/bin/pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

---

## Command Reference

```bash
# Check access (diagnostics)
./venv/bin/python3 check_folder_access.py

# Download assets
./venv/bin/python3 get_brand_assets.py

# Generate Remotion config
./venv/bin/python3 generate_brand_config.py

# All-in-one (recommended)
./retrieve_brand_assets.sh

# View metadata
cat brand_assets/brand_assets_metadata.json | python3 -m json.tool

# List downloaded files
ls -lah brand_assets/
```

---

## Next Steps

1. ✅ **Share the Google Drive folder** with the service account (see "How to Grant Access")
2. ⏳ Run `./retrieve_brand_assets.sh` to download assets
3. ⏳ Run `generate_brand_config.py` to create Remotion config
4. ⏳ Import `brandConfig.ts` in your Remotion project
5. ⏳ Use brand colors and logos in your video

---

## Technical Details

### Service Account
- **Email**: drive-master@mcp-g-drive-474704.iam.gserviceaccount.com
- **Project**: mcp-g-drive-474704
- **Credentials**: /home/sam/mcp-servers/gdrive-service-account.json
- **Scopes**: `https://www.googleapis.com/auth/drive.readonly`

### API Usage
- Google Drive API v3
- Read-only access
- No modifications to your Drive files
- Service account authentication (no OAuth flow needed)

### Dependencies
- google-auth
- google-auth-oauthlib
- google-auth-httplib2
- google-api-python-client

---

## Questions?

See detailed instructions: `BRAND_ASSETS_INSTRUCTIONS.md`

Or run diagnostics:
```bash
./venv/bin/python3 check_folder_access.py
```

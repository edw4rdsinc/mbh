# Brand Assets Retrieval Instructions

## Current Status

The Google Drive folder is **not currently shared** with the service account, so I cannot access the brand assets at this time.

## Folder Information

- **Folder ID**: 1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO
- **Folder URL**: https://drive.google.com/drive/folders/1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO
- **Service Account**: drive-master@mcp-g-drive-474704.iam.gserviceaccount.com

## How to Grant Access

To enable the scripts to retrieve your brand assets, you need to share the Google Drive folder with the service account:

### Steps:

1. **Open the folder** in your browser:
   - Go to: https://drive.google.com/drive/folders/1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO

2. **Click the "Share" button** (top right corner)

3. **Add the service account email**:
   ```
   drive-master@mcp-g-drive-474704.iam.gserviceaccount.com
   ```

4. **Set permission** to "Viewer" (or "Editor" if you want to allow writes)

5. **Click "Send"**
   - You can uncheck "Notify people" since it's a service account

6. **Run the retrieval script again**:
   ```bash
   cd /home/sam/automations/commission_automator
   ./venv/bin/python3 get_brand_assets.py
   ```

## Available Scripts

### 1. Check Folder Access
```bash
./venv/bin/python3 check_folder_access.py
```
- Verifies if the service account has access to the folder
- Shows folder metadata and permissions
- Lists all accessible files

### 2. Get Brand Assets
```bash
./venv/bin/python3 get_brand_assets.py
```
- Downloads all brand assets from the folder
- Categorizes files (logos, style guides, color files)
- Extracts color hex codes from text files
- Saves metadata to JSON

## What the Scripts Will Do

Once access is granted, the scripts will:

1. **List all files** in the folder
2. **Categorize files** by type:
   - Logos (files with "logo", "icon", "symbol" in name)
   - Style Guides (files with "guide", "brand", "style" in name)
   - Color Files (files with "color", "palette", "swatch" in name)
   - Other files

3. **Download files** to:
   ```
   /home/sam/automations/commission_automator/brand_assets/
   ```

4. **Extract information**:
   - Hex color codes from text files
   - File metadata (name, type, size)
   - Web view links

5. **Create metadata file**:
   ```
   /home/sam/automations/commission_automator/brand_assets/brand_assets_metadata.json
   ```

## Output Format

The `brand_assets_metadata.json` file will contain:

```json
{
  "folder_id": "1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO",
  "assets": {
    "logos": [
      {
        "name": "logo.png",
        "id": "...",
        "mimeType": "image/png",
        "size": "12345",
        "webViewLink": "...",
        "extension": "png"
      }
    ],
    "style_guides": [...],
    "color_files": [...],
    "other": [...],
    "all_files": [...]
  },
  "colors": ["#FF5733", "#3498DB", ...]
}
```

## Using Brand Assets in Remotion

After downloading, you can use the assets in your Remotion video:

```javascript
import brandMetadata from './brand_assets/brand_assets_metadata.json';

// Access colors
const primaryColor = brandMetadata.colors[0];

// Access logo files
const logoFile = brandMetadata.assets.logos[0];
const logoPath = `./brand_assets/${logoFile.name}`;

// Use in Remotion component
<Img src={staticFile(logoPath)} />
```

## Troubleshooting

### Issue: "File not found" or "Permission denied"
**Solution**: Make sure you've shared the folder with the service account email

### Issue: No files downloaded
**Solution**:
- Check if the folder actually contains files
- Verify the service account has "Viewer" or "Editor" permission
- Run `check_folder_access.py` to diagnose the issue

### Issue: Google-native files not downloading
**Note**: Google Docs, Sheets, and Slides cannot be directly downloaded. They need to be exported. The script will show their web view links instead.

## Service Account Details

- **Project**: mcp-g-drive-474704
- **Service Account Email**: drive-master@mcp-g-drive-474704.iam.gserviceaccount.com
- **Credentials Location**: /home/sam/mcp-servers/gdrive-service-account.json

## Next Steps

1. Share the Google Drive folder with the service account (see steps above)
2. Run `check_folder_access.py` to verify access
3. Run `get_brand_assets.py` to download all assets
4. Check `/home/sam/automations/commission_automator/brand_assets/` for downloaded files
5. Review `brand_assets_metadata.json` for structured data about your brand assets

---

**Need help?** The scripts are located at:
- `/home/sam/automations/commission_automator/check_folder_access.py`
- `/home/sam/automations/commission_automator/get_brand_assets.py`

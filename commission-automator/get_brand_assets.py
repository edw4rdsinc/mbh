#!/usr/bin/env python3
"""
Script to retrieve brand assets from Google Drive folder
Folder ID: 1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO
"""

import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

# Configuration
SERVICE_ACCOUNT_FILE = '/home/sam/mcp-servers/gdrive-service-account.json'
FOLDER_ID = '1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO'
DOWNLOAD_DIR = '/home/sam/chatbot-platform/mbh/commission-automator/brand_assets'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def setup_drive_service():
    """Initialize Google Drive API service"""
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('drive', 'v3', credentials=credentials)
    return service

def list_folder_contents(service, folder_id):
    """List all files in a folder"""
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        pageSize=100,
        fields="files(id, name, mimeType, size, webViewLink, webContentLink, description, fileExtension)"
    ).execute()

    return results.get('files', [])

def download_file(service, file_id, file_name, download_path):
    """Download a file from Google Drive"""
    try:
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while done is False:
            status, done = downloader.next_chunk()
            print(f"  Downloading {file_name}: {int(status.progress() * 100)}%")

        # Write to file
        with open(download_path, 'wb') as f:
            f.write(fh.getvalue())

        print(f"  ✓ Downloaded: {download_path}")
        return True
    except Exception as e:
        print(f"  ✗ Failed to download {file_name}: {e}")
        return False

def extract_colors_from_text(content):
    """Extract hex color codes from text content"""
    import re
    hex_pattern = r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b'
    colors = re.findall(hex_pattern, content)
    return list(set(colors))  # Remove duplicates

def analyze_file_for_colors(service, file_id, file_name):
    """Try to extract color information from files"""
    colors = []

    # If it's a Google Doc, Sheet, or text file, try to read content
    try:
        # For Google Docs
        if 'google-apps.document' in file_name:
            request = service.files().export_media(fileId=file_id, mimeType='text/plain')
        # For text files
        else:
            request = service.files().get_media(fileId=file_id)

        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()

        content = fh.getvalue().decode('utf-8', errors='ignore')
        colors = extract_colors_from_text(content)
    except:
        pass

    return colors

def main():
    print("=" * 70)
    print("Google Drive Brand Assets Retrieval")
    print("=" * 70)

    # Setup
    print(f"\n1. Initializing Google Drive service...")
    service = setup_drive_service()
    print("   ✓ Connected to Google Drive")

    # Create download directory
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    print(f"   ✓ Download directory: {DOWNLOAD_DIR}")

    # List folder contents
    print(f"\n2. Listing folder contents...")
    files = list_folder_contents(service, FOLDER_ID)

    if not files:
        print("   ⚠ No files found in folder")
        print("   Make sure the folder is shared with the service account:")
        print("   drive-master@mcp-g-drive-474704.iam.gserviceaccount.com")
        return

    print(f"   ✓ Found {len(files)} files")

    # Analyze and categorize files
    print(f"\n3. Analyzing files...")

    brand_assets = {
        'logos': [],
        'style_guides': [],
        'color_files': [],
        'other': [],
        'all_files': []
    }

    all_colors = []

    for file in files:
        file_info = {
            'name': file['name'],
            'id': file['id'],
            'mimeType': file['mimeType'],
            'size': file.get('size', 'N/A'),
            'webViewLink': file.get('webViewLink', ''),
            'extension': file.get('fileExtension', '')
        }

        brand_assets['all_files'].append(file_info)

        # Categorize files
        name_lower = file['name'].lower()

        if any(keyword in name_lower for keyword in ['logo', 'icon', 'symbol']):
            brand_assets['logos'].append(file_info)
        elif any(keyword in name_lower for keyword in ['guide', 'brand', 'style', 'guideline']):
            brand_assets['style_guides'].append(file_info)
        elif any(keyword in name_lower for keyword in ['color', 'palette', 'swatch']):
            brand_assets['color_files'].append(file_info)
        else:
            brand_assets['other'].append(file_info)

        # Try to extract colors from text-based files
        if file['mimeType'] in ['text/plain', 'application/vnd.google-apps.document']:
            colors = analyze_file_for_colors(service, file['id'], file['mimeType'])
            all_colors.extend(colors)

    # Print summary
    print(f"\n4. Files Summary:")
    print(f"\n   LOGOS ({len(brand_assets['logos'])}):")
    for logo in brand_assets['logos']:
        print(f"     - {logo['name']} ({logo['mimeType']})")

    print(f"\n   STYLE GUIDES ({len(brand_assets['style_guides'])}):")
    for guide in brand_assets['style_guides']:
        print(f"     - {guide['name']} ({guide['mimeType']})")

    print(f"\n   COLOR FILES ({len(brand_assets['color_files'])}):")
    for color_file in brand_assets['color_files']:
        print(f"     - {color_file['name']} ({color_file['mimeType']})")

    print(f"\n   OTHER FILES ({len(brand_assets['other'])}):")
    for other in brand_assets['other']:
        print(f"     - {other['name']} ({other['mimeType']})")

    if all_colors:
        print(f"\n   EXTRACTED COLORS:")
        for color in set(all_colors):
            print(f"     {color}")

    # Download files
    print(f"\n5. Downloading files...")

    for file in files:
        file_name = file['name']
        file_id = file['id']

        # Skip Google-specific file types that need export
        if 'google-apps' in file['mimeType']:
            print(f"  ⚠ Skipping Google native file: {file_name}")
            print(f"    View online: {file.get('webViewLink', 'N/A')}")
            continue

        download_path = os.path.join(DOWNLOAD_DIR, file_name)
        download_file(service, file_id, file_name, download_path)

    # Save metadata to JSON
    metadata_path = os.path.join(DOWNLOAD_DIR, 'brand_assets_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump({
            'folder_id': FOLDER_ID,
            'assets': brand_assets,
            'colors': list(set(all_colors))
        }, f, indent=2)

    print(f"\n   ✓ Metadata saved to: {metadata_path}")

    print("\n" + "=" * 70)
    print("✓ Brand Assets Retrieval Complete!")
    print("=" * 70)
    print(f"\nAssets downloaded to: {DOWNLOAD_DIR}")
    print(f"Total files: {len(files)}")

if __name__ == '__main__':
    main()

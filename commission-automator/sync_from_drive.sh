#!/bin/bash
# Sync commission files from Google Drive to VPS
# Uses service account for authentication

MONTH=${1:-$(date +%Y-%m)}
BASE_DIR="/home/sam/commission_automator/data/mbh"
PYTHON=/home/sam/pdfplumber-env/bin/python3

echo "========================================================================"
echo "Syncing commission files for $MONTH from Google Drive"
echo "========================================================================"

# Create Python script to download files from Drive
$PYTHON << EOF
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import os
from pathlib import Path

SERVICE_ACCOUNT_FILE = '/home/sam/mcp-servers/gdrive-service-account.json'
SCOPES = ['https://www.googleapis.com/auth/drive']
SHARED_DRIVE_ID = '0AJ_IbKcKhFkyUk9PVA'
MONTH = '$MONTH'
BASE_DIR = '$BASE_DIR'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('drive', 'v3', credentials=credentials)

def find_folder(name, parent_id=None):
    query = f"name='{name}' and mimeType='application/vnd.google-apps.folder'"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(
        q=query,
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    files = results.get('files', [])
    return files[0]['id'] if files else None

def list_files(folder_id):
    query = f"'{folder_id}' in parents and mimeType!='application/vnd.google-apps.folder'"

    results = service.files().list(
        q=query,
        fields='files(id, name, mimeType)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        pageSize=100
    ).execute()

    return results.get('files', [])

def list_folders(folder_id):
    query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder'"

    results = service.files().list(
        q=query,
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    return results.get('files', [])

def download_file(file_id, file_name, dest_path):
    dest_file = Path(dest_path) / file_name
    dest_file.parent.mkdir(parents=True, exist_ok=True)

    request = service.files().get_media(fileId=file_id)

    with open(dest_file, 'wb') as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

    print(f"  ✓ Downloaded: {file_name}")

# Find month folder
month_id = find_folder(MONTH, SHARED_DRIVE_ID)
if not month_id:
    print(f"ERROR: Month folder '{MONTH}' not found in shared Drive")
    exit(1)

print(f"Found month folder: {MONTH}")

# Download commission statements
comm_id = find_folder('commission_statements', month_id)
if comm_id:
    print("\nDownloading commission statements...")
    comm_dest = f"{BASE_DIR}/{MONTH}/commission_statements"

    # Download files directly in commission_statements
    files = list_files(comm_id)
    for file in files:
        download_file(file['id'], file['name'], comm_dest)

    # Check for subfolders (like MyAccess)
    subfolders = list_folders(comm_id)
    for subfolder in subfolders:
        print(f"\n  Downloading {subfolder['name']}/ subfolder...")
        subfolder_dest = f"{comm_dest}/{subfolder['name']}"
        subfolder_files = list_files(subfolder['id'])
        for file in subfolder_files:
            download_file(file['id'], file['name'], subfolder_dest)

# Download bank statement
bank_id = find_folder('bank_statement', month_id)
if bank_id:
    print("\nDownloading bank statement...")
    bank_dest = f"{BASE_DIR}/{MONTH}/bank_statement"
    files = list_files(bank_id)
    for file in files:
        download_file(file['id'], file['name'], bank_dest)

# Download master CSV
master_id = find_folder('master_data', SHARED_DRIVE_ID)
if master_id:
    print("\nDownloading master CSV...")
    master_dest = f"{BASE_DIR}/master_data"
    files = list_files(master_id)
    for file in files:
        if file['name'].endswith('.csv'):
            download_file(file['id'], file['name'], master_dest)

print("\n" + "="*70)
print("✓ Sync Complete!")
print("="*70)

EOF

echo ""
echo "Files synced to: $BASE_DIR/$MONTH/"

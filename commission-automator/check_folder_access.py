#!/usr/bin/env python3
"""
Script to check access to Google Drive folder and get detailed information
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SERVICE_ACCOUNT_FILE = '/home/sam/mcp-servers/gdrive-service-account.json'
FOLDER_ID = '1MuoISucvfQBf21_b0TwUBZlBfmdVfFgO'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def main():
    print("=" * 70)
    print("Google Drive Folder Access Check")
    print("=" * 70)

    # Setup
    print(f"\nInitializing service...")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('drive', 'v3', credentials=credentials)

    print(f"Service Account: {credentials.service_account_email}")
    print(f"Target Folder ID: {FOLDER_ID}")

    # Try to get folder metadata
    print(f"\n1. Checking folder access...")
    try:
        folder = service.files().get(
            fileId=FOLDER_ID,
            fields='id, name, mimeType, permissions, owners, shared, capabilities'
        ).execute()

        print(f"   ✓ Folder accessible!")
        print(f"   Name: {folder.get('name')}")
        print(f"   Type: {folder.get('mimeType')}")
        print(f"   Shared: {folder.get('shared', False)}")

        if 'owners' in folder:
            print(f"   Owners:")
            for owner in folder['owners']:
                print(f"     - {owner.get('displayName', 'N/A')} ({owner.get('emailAddress', 'N/A')})")

        capabilities = folder.get('capabilities', {})
        print(f"\n   Capabilities:")
        print(f"     Can List Children: {capabilities.get('canListChildren', False)}")
        print(f"     Can Read: {capabilities.get('canRead', False)}")
        print(f"     Can Download: {capabilities.get('canDownload', False)}")

    except HttpError as error:
        print(f"   ✗ Error accessing folder: {error}")
        if error.resp.status == 404:
            print("   → Folder not found or not shared with service account")
        elif error.resp.status == 403:
            print("   → Permission denied")
        return

    # Try to list contents
    print(f"\n2. Listing folder contents...")
    try:
        query = f"'{FOLDER_ID}' in parents and trashed=false"
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, iconLink)"
        ).execute()

        files = results.get('files', [])

        if not files:
            print("   ⚠ Folder is empty or no files accessible")
        else:
            print(f"   ✓ Found {len(files)} files/folders:\n")

            for idx, file in enumerate(files, 1):
                print(f"   {idx}. {file['name']}")
                print(f"      ID: {file['id']}")
                print(f"      Type: {file['mimeType']}")
                print(f"      Size: {file.get('size', 'N/A')} bytes")
                print(f"      Modified: {file.get('modifiedTime', 'N/A')}")
                print(f"      View Link: {file.get('webViewLink', 'N/A')}")
                if 'thumbnailLink' in file:
                    print(f"      Thumbnail: {file['thumbnailLink']}")
                print()

    except HttpError as error:
        print(f"   ✗ Error listing contents: {error}")

    # Try to search for all files the service account has access to
    print(f"\n3. Checking all accessible files...")
    try:
        results = service.files().list(
            pageSize=20,
            fields="files(id, name, mimeType)"
        ).execute()

        all_files = results.get('files', [])
        print(f"   Service account has access to {len(all_files)} files/folders total")

        if all_files:
            print("\n   Recent files:")
            for file in all_files[:10]:
                print(f"     - {file['name']} ({file['mimeType']})")

    except HttpError as error:
        print(f"   ✗ Error: {error}")

    print("\n" + "=" * 70)
    print("Check Complete")
    print("=" * 70)

    print("\nTo grant access to the folder:")
    print(f"1. Open: https://drive.google.com/drive/folders/{FOLDER_ID}")
    print("2. Click 'Share' button")
    print(f"3. Add: {credentials.service_account_email}")
    print("4. Set permission to 'Viewer' or 'Editor'")
    print("5. Click 'Send' (uncheck 'Notify people')")

if __name__ == '__main__':
    main()

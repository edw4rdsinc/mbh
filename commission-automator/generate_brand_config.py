#!/usr/bin/env python3
"""
Generate a TypeScript/JavaScript configuration file for Remotion
from the downloaded brand assets metadata
"""

import json
import os

METADATA_FILE = '/home/sam/chatbot-platform/mbh/commission-automator/brand_assets/brand_assets_metadata.json'
OUTPUT_FILE = '/home/sam/chatbot-platform/mbh/commission-automator/brand_assets/brandConfig.ts'

def generate_config():
    """Generate TypeScript config from brand assets metadata"""

    if not os.path.exists(METADATA_FILE):
        print(f"Error: Metadata file not found: {METADATA_FILE}")
        print("Please run get_brand_assets.py first")
        return

    with open(METADATA_FILE, 'r') as f:
        metadata = json.load(f)

    # Build TypeScript config
    config_lines = [
        "// Auto-generated brand configuration",
        "// Source: Google Drive brand assets folder",
        "",
        "export const brandConfig = {",
    ]

    # Colors
    colors = metadata.get('colors', [])
    if colors:
        config_lines.append("  colors: {")
        for idx, color in enumerate(colors):
            key = f"color{idx + 1}" if idx > 0 else "primary"
            if idx == 1:
                key = "secondary"
            elif idx == 2:
                key = "accent"
            config_lines.append(f"    {key}: '{color}',")
        config_lines.append("  },")
    else:
        config_lines.append("  colors: {},")

    # Logos
    logos = metadata.get('assets', {}).get('logos', [])
    if logos:
        config_lines.append("  logos: {")
        for logo in logos:
            name = logo['name']
            safe_name = name.replace('.', '_').replace('-', '_').replace(' ', '_')
            config_lines.append(f"    {safe_name}: './brand_assets/{name}',")
        config_lines.append("  },")
    else:
        config_lines.append("  logos: {},")

    # Assets paths
    config_lines.append("  assetPaths: {")
    config_lines.append("    brandAssets: './brand_assets',")
    config_lines.append("  },")

    # File listings
    all_files = metadata.get('assets', {}).get('all_files', [])
    config_lines.append("  files: {")

    for category in ['logos', 'style_guides', 'color_files', 'other']:
        files = metadata.get('assets', {}).get(category, [])
        if files:
            config_lines.append(f"    {category}: [")
            for file in files:
                config_lines.append(f"      {{")
                config_lines.append(f"        name: '{file['name']}',")
                config_lines.append(f"        type: '{file['mimeType']}',")
                config_lines.append(f"        path: './brand_assets/{file['name']}',")
                config_lines.append(f"      }},")
            config_lines.append(f"    ],")

    config_lines.append("  },")

    config_lines.append("};")
    config_lines.append("")
    config_lines.append("// Export individual items for convenience")
    config_lines.append("export const colors = brandConfig.colors;")
    config_lines.append("export const logos = brandConfig.logos;")
    config_lines.append("export const assetPaths = brandConfig.assetPaths;")
    config_lines.append("")

    # Write to file
    config_content = "\n".join(config_lines)

    with open(OUTPUT_FILE, 'w') as f:
        f.write(config_content)

    print("=" * 70)
    print("Brand Configuration Generated")
    print("=" * 70)
    print(f"\nOutput file: {OUTPUT_FILE}")
    print("\nUsage in Remotion:")
    print("```typescript")
    print("import { brandConfig, colors, logos } from './brand_assets/brandConfig';")
    print("")
    print("// Use colors")
    print("const primaryColor = colors.primary;")
    print("")
    print("// Use logos")
    print("<Img src={staticFile(logos.logo_png)} />")
    print("```")
    print("\nConfiguration summary:")
    print(f"  - Colors: {len(colors)}")
    print(f"  - Logos: {len(logos)}")
    print(f"  - Total files: {len(all_files)}")

    # Also create a JSON version
    json_output = OUTPUT_FILE.replace('.ts', '.json')
    with open(json_output, 'w') as f:
        json.dump(metadata.get('assets', {}), f, indent=2)

    print(f"\nJSON version saved to: {json_output}")

if __name__ == '__main__':
    generate_config()

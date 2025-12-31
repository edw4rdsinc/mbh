import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (parent directory of src/)
dotenv.config({ path: join(__dirname, '../.env') });

// Load default config
const configPath = join(__dirname, '../config/default.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

export const config = {
  wasabi: {
    bucketName: process.env.WASABI_BUCKET,
    region: process.env.WASABI_REGION,
    endpoint: process.env.WASABI_ENDPOINT,
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY,
      secretAccessKey: process.env.WASABI_SECRET_KEY,
    },
  },
  processing: defaultConfig.processing,
  formatting: defaultConfig.formatting,
  productTypePreTaxMapping: defaultConfig.productTypePreTaxMapping,
};

export default config;

# 📊 Google Ads Campaign Tracker

Reconcile active Google Ads search campaigns against a master Google Sheet. Identifies which campaigns are running, which are missing and need to be created, and which are running but not in your sheet.

## How It Works

1. Connects to your MCC → lists all child ad accounts
2. Pulls all final URLs from **enabled search campaigns** (keyword-level + ad-level)
3. Reads your master Google Sheet (Keywords + Final URL columns)
4. Matches by **Final URL** (normalized: strips `www.`, trailing `/`, lowercased)
5. Shows 3 buckets: ✅ Active, 🚨 Missing (download CSV), ⚠️ Extra

## Railway Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial: ads campaign tracker"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Create Railway Service
- New Project → Deploy from GitHub repo
- Railway auto-detects the Dockerfile

### 3. Set Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Your Google Ads API developer token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth2 refresh token |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC account ID (with or without hyphens) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of your GCP service account key (for Sheets access) |

### 4. Expose Port
- Settings → Networking → Expose port **8501**
- Or add `PORT=8501` to env vars

## Google Sheet Setup

1. Create a sheet with at least these columns: `Keywords`, `Final URL`
2. Share the sheet with your service account email (found in the service account JSON under `client_email`)
3. Paste the full spreadsheet URL into the app sidebar

## Local Development

```bash
# Set env vars (or use a .env file with python-dotenv)
export GOOGLE_ADS_DEVELOPER_TOKEN=...
export GOOGLE_ADS_CLIENT_ID=...
export GOOGLE_ADS_CLIENT_SECRET=...
export GOOGLE_ADS_REFRESH_TOKEN=...
export GOOGLE_ADS_LOGIN_CUSTOMER_ID=...
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

pip install -r requirements.txt
streamlit run app.py
```

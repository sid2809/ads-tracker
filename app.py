import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials as SACredentials
import requests
import json
import io
import os
from urllib.parse import urlparse


# ─── Page Config ───
st.set_page_config(
    page_title="Ads Campaign Tracker",
    page_icon="📊",
    layout="wide",
)

# ─── Custom Styling ───
st.markdown("""
<style>
    .stApp { max-width: 1200px; margin: 0 auto; }
    .metric-card {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        border-left: 4px solid;
    }
    .metric-active { border-color: #28a745; }
    .metric-missing { border-color: #dc3545; }
    .metric-total { border-color: #007bff; }
</style>
""", unsafe_allow_html=True)

st.title("📊 Google Ads Campaign Tracker")
st.caption("Reconcile active campaigns against your master Google Sheet")


# ─── Google Ads REST API Helpers ───
ADS_API_VERSION = "v18"
ADS_BASE_URL = f"https://googleads.googleapis.com/{ADS_API_VERSION}"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def get_access_token() -> str:
    """Exchange refresh token for access token."""
    resp = requests.post(TOKEN_URL, data={
        "grant_type": "refresh_token",
        "client_id": os.environ.get("GOOGLE_ADS_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_ADS_CLIENT_SECRET", ""),
        "refresh_token": os.environ.get("GOOGLE_ADS_REFRESH_TOKEN", ""),
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def ads_search(customer_id: str, query: str, access_token: str, login_customer_id: str) -> list[dict]:
    """Execute a GAQL query via Google Ads REST searchStream endpoint."""
    cid = customer_id.replace("-", "")
    url = f"{ADS_BASE_URL}/customers/{cid}/googleAds:searchStream"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN", ""),
        "login-customer-id": login_customer_id.replace("-", ""),
        "Content-Type": "application/json",
    }
    body = {"query": query}
    resp = requests.post(url, headers=headers, json=body)
    resp.raise_for_status()

    # searchStream returns a JSON array of batches, each with "results"
    results = []
    data = resp.json()
    if isinstance(data, list):
        for batch in data:
            results.extend(batch.get("results", []))
    elif isinstance(data, dict):
        results.extend(data.get("results", []))
    return results


# ─── Google Sheets ───
def get_gspread_client():
    """Build gspread client from service account JSON env var."""
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        return None
    creds_dict = json.loads(sa_json)
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = SACredentials.from_service_account_info(creds_dict, scopes=scopes)
    return gspread.authorize(creds)


# ─── Google Ads Data Functions ───
@st.cache_data(ttl=300, show_spinner=False)
def fetch_child_accounts(login_customer_id: str) -> list[dict]:
    """Fetch all accessible child accounts under MCC."""
    access_token = get_access_token()
    query = """
        SELECT
            customer_client.id,
            customer_client.descriptive_name,
            customer_client.manager,
            customer_client.status
        FROM customer_client
        WHERE customer_client.manager = false
          AND customer_client.status = 'ENABLED'
    """
    results = ads_search(login_customer_id, query, access_token, login_customer_id)

    accounts = []
    for row in results:
        cc = row.get("customerClient", {})
        accounts.append({
            "id": str(cc.get("id", "")),
            "name": cc.get("descriptiveName", "") or f"Account {cc.get('id', '')}",
        })
    return sorted(accounts, key=lambda a: a["name"])


@st.cache_data(ttl=300, show_spinner=False)
def fetch_active_final_urls(customer_id: str, login_customer_id: str) -> pd.DataFrame:
    """Pull final URLs from ENABLED search campaigns via REST API."""
    access_token = get_access_token()
    cid = customer_id.replace("-", "")
    rows = []

    # ── Query 1: Keyword-level final URLs ──
    keyword_query = """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.final_urls,
            ad_group_criterion.status
        FROM keyword_view
        WHERE campaign.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
          AND ad_group_criterion.status = 'ENABLED'
          AND campaign.advertising_channel_type = 'SEARCH'
    """
    try:
        results = ads_search(cid, keyword_query, access_token, login_customer_id)
        for row in results:
            campaign = row.get("campaign", {})
            ad_group = row.get("adGroup", {})
            criterion = row.get("adGroupCriterion", {})
            keyword = criterion.get("keyword", {})
            final_urls = criterion.get("finalUrls", [])
            url = final_urls[0] if final_urls else ""
            rows.append({
                "campaign_id": str(campaign.get("id", "")),
                "campaign_name": campaign.get("name", ""),
                "ad_group_id": str(ad_group.get("id", "")),
                "ad_group_name": ad_group.get("name", ""),
                "keyword": keyword.get("text", ""),
                "match_type": keyword.get("matchType", ""),
                "final_url": url,
                "source": "keyword",
            })
    except requests.exceptions.HTTPError as e:
        st.error(f"Keyword query error for {cid}: {e.response.text[:500]}")

    # ── Query 2: Ad-level final URLs (fallback) ──
    ad_query = """
        SELECT
            campaign.id,
            campaign.name,
            ad_group.id,
            ad_group.name,
            ad_group_ad.ad.final_urls
        FROM ad_group_ad
        WHERE campaign.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
          AND ad_group_ad.status = 'ENABLED'
          AND campaign.advertising_channel_type = 'SEARCH'
    """
    try:
        results = ads_search(cid, ad_query, access_token, login_customer_id)
        for row in results:
            campaign = row.get("campaign", {})
            ad_group = row.get("adGroup", {})
            ad_group_ad = row.get("adGroupAd", {})
            ad = ad_group_ad.get("ad", {})
            final_urls = ad.get("finalUrls", [])
            url = final_urls[0] if final_urls else ""
            rows.append({
                "campaign_id": str(campaign.get("id", "")),
                "campaign_name": campaign.get("name", ""),
                "ad_group_id": str(ad_group.get("id", "")),
                "ad_group_name": ad_group.get("name", ""),
                "keyword": "",
                "match_type": "",
                "final_url": url,
                "source": "ad",
            })
    except requests.exceptions.HTTPError:
        pass  # keyword-level data is primary

    df = pd.DataFrame(rows)
    if not df.empty:
        df["final_url_normalized"] = df["final_url"].apply(normalize_url)
    return df


# ─── Google Sheets Functions ───
@st.cache_data(ttl=120, show_spinner=False)
def fetch_sheet_data(spreadsheet_url: str, worksheet_name: str) -> pd.DataFrame:
    """Read the master sheet with Keywords + Final URL columns."""
    gc = get_gspread_client()
    if gc is None:
        st.error("Google Service Account JSON not configured.")
        return pd.DataFrame()

    sh = gc.open_by_url(spreadsheet_url)
    ws = sh.worksheet(worksheet_name) if worksheet_name else sh.sheet1
    records = ws.get_all_records()
    return pd.DataFrame(records)


# ─── URL Matching ───
def normalize_url(url: str) -> str:
    """Normalize URL for comparison: lowercase, strip trailing slash, strip www."""
    if not url:
        return ""
    url = url.strip().lower()
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "")
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{host}{path}"


# ─── Sidebar: Configuration ───
with st.sidebar:
    st.header("⚙️ Configuration")

    mcc_id = os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")
    st.text_input("MCC ID", value=mcc_id, disabled=True, help="Set via GOOGLE_ADS_LOGIN_CUSTOMER_ID env var")

    st.divider()
    st.subheader("Google Sheet")
    sheet_url = st.text_input(
        "Spreadsheet URL",
        placeholder="https://docs.google.com/spreadsheets/d/...",
    )
    worksheet_name = st.text_input(
        "Worksheet name",
        placeholder="Sheet1 (leave blank for first sheet)",
    )
    url_column = st.text_input("Final URL column name", value="Final URL")
    keyword_column = st.text_input("Keyword column name", value="Keywords")

    st.divider()
    st.subheader("Matching")
    ignore_trailing_slash = st.checkbox("Normalize URLs (strip www, trailing /)", value=True)


# ─── Main Flow ───
if not mcc_id:
    st.warning("Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` environment variable to get started.")
    st.stop()

# Step 1: Load child accounts
with st.spinner("Loading ad accounts from MCC..."):
    try:
        accounts = fetch_child_accounts(mcc_id)
    except Exception as e:
        st.error(f"Failed to fetch accounts: {e}")
        st.stop()

if not accounts:
    st.warning("No child accounts found under this MCC.")
    st.stop()

# Account selector
account_options = {f"{a['name']} ({a['id']})": a["id"] for a in accounts}
selected_labels = st.multiselect(
    "Select ad accounts to check",
    options=list(account_options.keys()),
    default=list(account_options.keys()),
)
selected_ids = [account_options[label] for label in selected_labels]

if not selected_ids:
    st.info("Select at least one account above.")
    st.stop()

# Step 2: Fetch Google Ads data
if st.button("🔍 Run Reconciliation", type="primary", use_container_width=True):
    if not sheet_url:
        st.error("Enter a Google Sheet URL in the sidebar.")
        st.stop()

    # ── Pull Ads data ──
    all_ads_data = []
    progress = st.progress(0, text="Fetching campaigns...")
    for i, cid in enumerate(selected_ids):
        account_name = selected_labels[i]
        progress.progress(
            (i + 1) / (len(selected_ids) + 1),
            text=f"Fetching: {account_name}...",
        )
        df = fetch_active_final_urls(cid, mcc_id)
        if not df.empty:
            df["account_id"] = cid
            df["account_name"] = account_name
            all_ads_data.append(df)

    if all_ads_data:
        ads_df = pd.concat(all_ads_data, ignore_index=True)
    else:
        ads_df = pd.DataFrame()

    # ── Pull Sheet data ──
    progress.progress(0.9, text="Reading Google Sheet...")
    try:
        sheet_df = fetch_sheet_data(sheet_url, worksheet_name)
    except Exception as e:
        st.error(f"Failed to read sheet: {e}")
        st.stop()

    progress.progress(1.0, text="Done!")
    progress.empty()

    if sheet_df.empty:
        st.warning("Google Sheet is empty or could not be read.")
        st.stop()

    # Validate columns exist
    if url_column not in sheet_df.columns:
        st.error(f"Column '{url_column}' not found in sheet. Available: {list(sheet_df.columns)}")
        st.stop()

    # ── Normalize & Match ──
    sheet_df["final_url_normalized"] = sheet_df[url_column].astype(str).apply(
        normalize_url if ignore_trailing_slash else lambda x: x.strip()
    )
    sheet_urls = set(sheet_df["final_url_normalized"].unique())

    if not ads_df.empty:
        ads_urls = set(ads_df["final_url_normalized"].unique())
    else:
        ads_urls = set()

    active_urls = sheet_urls & ads_urls       # In both sheet and ads
    missing_urls = sheet_urls - ads_urls       # In sheet but NOT in ads
    extra_urls = ads_urls - sheet_urls         # In ads but NOT in sheet

    # ── Metrics ──
    st.divider()
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("📋 Sheet URLs", len(sheet_urls))
    with col2:
        st.metric("✅ Active (Matched)", len(active_urls))
    with col3:
        st.metric("🚨 Missing (Need Creation)", len(missing_urls))
    with col4:
        st.metric("⚠️ Extra (In Ads, not Sheet)", len(extra_urls))

    # ── Tabs for details ──
    tab_missing, tab_active, tab_extra = st.tabs([
        f"🚨 Missing ({len(missing_urls)})",
        f"✅ Active ({len(active_urls)})",
        f"⚠️ Extra ({len(extra_urls)})",
    ])

    with tab_missing:
        st.subheader("Campaigns to Create")
        st.caption("These Final URLs exist in your Sheet but have no active campaign in Google Ads.")

        missing_df = sheet_df[sheet_df["final_url_normalized"].isin(missing_urls)].copy()
        missing_df = missing_df.drop(columns=["final_url_normalized"], errors="ignore")

        if not missing_df.empty:
            st.dataframe(missing_df, use_container_width=True, hide_index=True)

            # CSV download
            csv_buf = io.BytesIO()
            missing_df.to_csv(csv_buf, index=False)
            csv_buf.seek(0)
            st.download_button(
                "⬇️ Download Missing Campaigns CSV",
                data=csv_buf,
                file_name="missing_campaigns.csv",
                mime="text/csv",
                type="primary",
                use_container_width=True,
            )
        else:
            st.success("All sheet URLs have active campaigns! Nothing to create.")

    with tab_active:
        st.subheader("Active Campaigns (Matched)")
        st.caption("These Final URLs exist in both your Sheet and Google Ads.")

        if not ads_df.empty:
            active_df = ads_df[ads_df["final_url_normalized"].isin(active_urls)].copy()
            active_df = active_df.drop(columns=["final_url_normalized"], errors="ignore")
            display_cols = ["account_name", "campaign_name", "ad_group_name", "keyword", "match_type", "final_url"]
            active_df = active_df[[c for c in display_cols if c in active_df.columns]]
            active_df = active_df.drop_duplicates()
            st.dataframe(active_df, use_container_width=True, hide_index=True)
        else:
            st.info("No active campaign data to display.")

    with tab_extra:
        st.subheader("Extra Campaigns (Not in Sheet)")
        st.caption("These Final URLs are active in Google Ads but NOT in your master Sheet.")

        if not ads_df.empty:
            extra_df = ads_df[ads_df["final_url_normalized"].isin(extra_urls)].copy()
            extra_df = extra_df.drop(columns=["final_url_normalized"], errors="ignore")
            display_cols = ["account_name", "campaign_name", "ad_group_name", "keyword", "match_type", "final_url"]
            extra_df = extra_df[[c for c in display_cols if c in extra_df.columns]]
            extra_df = extra_df.drop_duplicates()
            st.dataframe(extra_df, use_container_width=True, hide_index=True)

            csv_buf2 = io.BytesIO()
            extra_df.to_csv(csv_buf2, index=False)
            csv_buf2.seek(0)
            st.download_button(
                "⬇️ Download Extra Campaigns CSV",
                data=csv_buf2,
                file_name="extra_campaigns.csv",
                mime="text/csv",
                use_container_width=True,
            )
        else:
            st.info("No extra campaigns found.")

    # Store in session for re-renders
    st.session_state["last_run"] = True

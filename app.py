import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials as SACredentials
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
import json
import io
import os
from urllib.parse import urlparse

st.set_page_config(page_title="Ads Campaign Tracker", page_icon="📊", layout="wide")

st.markdown("""
<style>
    .stApp { max-width: 1200px; margin: 0 auto; }
</style>
""", unsafe_allow_html=True)

st.title("📊 Google Ads Campaign Tracker")
st.caption("Reconcile active campaigns against your master Google Sheet")

def get_google_ads_client():
    config = {
        "developer_token": os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN", ""),
        "client_id": os.environ.get("GOOGLE_ADS_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_ADS_CLIENT_SECRET", ""),
        "refresh_token": os.environ.get("GOOGLE_ADS_REFRESH_TOKEN", ""),
        "login_customer_id": os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", ""),
        "use_proto_plus": True,
    }
    return GoogleAdsClient.load_from_dict(config)

def get_gspread_client():
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        return None
    creds_dict = json.loads(sa_json)
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.readonly"]
    creds = SACredentials.from_service_account_info(creds_dict, scopes=scopes)
    return gspread.authorize(creds)

@st.cache_data(ttl=300, show_spinner=False)
def fetch_child_accounts(login_customer_id):
    client = get_google_ads_client()
    service = client.get_service("GoogleAdsService")
    query = """
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status
        FROM customer_client
        WHERE customer_client.manager = false AND customer_client.status = 'ENABLED'
    """
    cid = login_customer_id.replace("-", "")
    results = service.search(customer_id=cid, query=query)
    accounts = []
    for row in results:
        cc = row.customer_client
        accounts.append({"id": str(cc.id), "name": cc.descriptive_name or f"Account {cc.id}"})
    return sorted(accounts, key=lambda a: a["name"])

@st.cache_data(ttl=300, show_spinner=False)
def fetch_active_final_urls(customer_id):
    client = get_google_ads_client()
    service = client.get_service("GoogleAdsService")
    cid = customer_id.replace("-", "")
    rows = []

    keyword_query = """
        SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
               ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.final_urls, ad_group_criterion.status
        FROM keyword_view
        WHERE campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'
          AND ad_group_criterion.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'
    """
    try:
        results = service.search(customer_id=cid, query=keyword_query)
        for row in results:
            final_urls = list(row.ad_group_criterion.final_urls)
            url = final_urls[0] if final_urls else ""
            rows.append({
                "campaign_id": str(row.campaign.id), "campaign_name": row.campaign.name,
                "ad_group_id": str(row.ad_group.id), "ad_group_name": row.ad_group.name,
                "keyword": row.ad_group_criterion.keyword.text,
                "match_type": row.ad_group_criterion.keyword.match_type.name,
                "final_url": url, "source": "keyword",
            })
    except GoogleAdsException as ex:
        st.error(f"Google Ads API error: {ex.failure.errors[0].message}")
        return pd.DataFrame()

    ad_query = """
        SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.final_urls
        FROM ad_group_ad
        WHERE campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'
          AND ad_group_ad.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'
    """
    try:
        results = service.search(customer_id=cid, query=ad_query)
        for row in results:
            final_urls = list(row.ad_group_ad.ad.final_urls)
            url = final_urls[0] if final_urls else ""
            rows.append({
                "campaign_id": str(row.campaign.id), "campaign_name": row.campaign.name,
                "ad_group_id": str(row.ad_group.id), "ad_group_name": row.ad_group.name,
                "keyword": "", "match_type": "", "final_url": url, "source": "ad",
            })
    except GoogleAdsException:
        pass

    df = pd.DataFrame(rows)
    if not df.empty:
        df["final_url_normalized"] = df["final_url"].apply(normalize_url)
    return df

@st.cache_data(ttl=120, show_spinner=False)
def fetch_sheet_data(spreadsheet_url, worksheet_name):
    gc = get_gspread_client()
    if gc is None:
        st.error("Google Service Account JSON not configured.")
        return pd.DataFrame()
    sh = gc.open_by_url(spreadsheet_url)
    ws = sh.worksheet(worksheet_name) if worksheet_name else sh.sheet1
    records = ws.get_all_records()
    return pd.DataFrame(records)

def normalize_url(url):
    if not url:
        return ""
    url = url.strip().lower()
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "")
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{host}{path}"

with st.sidebar:
    st.header("⚙️ Configuration")
    mcc_id = os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")
    st.text_input("MCC ID", value=mcc_id, disabled=True)
    st.divider()
    st.subheader("Google Sheet")
    sheet_url = st.text_input("Spreadsheet URL", placeholder="https://docs.google.com/spreadsheets/d/...")
    worksheet_name = st.text_input("Worksheet name", placeholder="Sheet1 (leave blank for first sheet)")
    url_column = st.text_input("Final URL column name", value="Final URL")
    keyword_column = st.text_input("Keyword column name", value="Keywords")
    st.divider()
    st.subheader("Matching")
    ignore_trailing_slash = st.checkbox("Normalize URLs (strip www, trailing /)", value=True)

if not mcc_id:
    st.warning("Set GOOGLE_ADS_LOGIN_CUSTOMER_ID environment variable.")
    st.stop()

with st.spinner("Loading ad accounts from MCC..."):
    try:
        accounts = fetch_child_accounts(mcc_id)
    except Exception as e:
        st.error(f"Failed to fetch accounts: {e}")
        st.stop()

if not accounts:
    st.warning("No child accounts found under this MCC.")
    st.stop()

account_options = {f"{a['name']} ({a['id']})": a["id"] for a in accounts}
selected_labels = st.multiselect("Select ad accounts to check", options=list(account_options.keys()), default=list(account_options.keys()))
selected_ids = [account_options[label] for label in selected_labels]

if not selected_ids:
    st.info("Select at least one account above.")
    st.stop()

if st.button("🔍 Run Reconciliation", type="primary", use_container_width=True):
    if not sheet_url:
        st.error("Enter a Google Sheet URL in the sidebar.")
        st.stop()

    all_ads_data = []
    progress = st.progress(0, text="Fetching campaigns...")
    for i, cid in enumerate(selected_ids):
        account_name = selected_labels[i]
        progress.progress((i + 1) / (len(selected_ids) + 1), text=f"Fetching: {account_name}...")
        df = fetch_active_final_urls(cid)
        if not df.empty:
            df["account_id"] = cid
            df["account_name"] = account_name
            all_ads_data.append(df)

    ads_df = pd.concat(all_ads_data, ignore_index=True) if all_ads_data else pd.DataFrame()

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

    if url_column not in sheet_df.columns:
        st.error(f"Column '{url_column}' not found. Available: {list(sheet_df.columns)}")
        st.stop()

    sheet_df["final_url_normalized"] = sheet_df[url_column].astype(str).apply(normalize_url if ignore_trailing_slash else lambda x: x.strip())
    sheet_urls = set(sheet_df["final_url_normalized"].unique())
    ads_urls = set(ads_df["final_url_normalized"].unique()) if not ads_df.empty else set()

    active_urls = sheet_urls & ads_urls
    missing_urls = sheet_urls - ads_urls
    extra_urls = ads_urls - sheet_urls

    st.divider()
    col1, col2, col3, col4 = st.columns(4)
    with col1: st.metric("📋 Sheet URLs", len(sheet_urls))
    with col2: st.metric("✅ Active", len(active_urls))
    with col3: st.metric("🚨 Missing", len(missing_urls))
    with col4: st.metric("⚠️ Extra", len(extra_urls))

    tab_missing, tab_active, tab_extra = st.tabs([f"🚨 Missing ({len(missing_urls)})", f"✅ Active ({len(active_urls)})", f"⚠️ Extra ({len(extra_urls)})"])

    with tab_missing:
        st.subheader("Campaigns to Create")
        missing_df = sheet_df[sheet_df["final_url_normalized"].isin(missing_urls)].drop(columns=["final_url_normalized"], errors="ignore")
        if not missing_df.empty:
            st.dataframe(missing_df, use_container_width=True, hide_index=True)
            csv_buf = io.BytesIO()
            missing_df.to_csv(csv_buf, index=False)
            csv_buf.seek(0)
            st.download_button("⬇️ Download Missing Campaigns CSV", data=csv_buf, file_name="missing_campaigns.csv", mime="text/csv", type="primary", use_container_width=True)
        else:
            st.success("All sheet URLs have active campaigns!")

    with tab_active:
        st.subheader("Active Campaigns (Matched)")
        if not ads_df.empty:
            active_df = ads_df[ads_df["final_url_normalized"].isin(active_urls)].drop(columns=["final_url_normalized"], errors="ignore")
            display_cols = ["account_name", "campaign_name", "ad_group_name", "keyword", "match_type", "final_url"]
            active_df = active_df[[c for c in display_cols if c in active_df.columns]].drop_duplicates()
            st.dataframe(active_df, use_container_width=True, hide_index=True)

    with tab_extra:
        st.subheader("Extra Campaigns (Not in Sheet)")
        if not ads_df.empty:
            extra_df = ads_df[ads_df["final_url_normalized"].isin(extra_urls)].drop(columns=["final_url_normalized"], errors="ignore")
            display_cols = ["account_name", "campaign_name", "ad_group_name", "keyword", "match_type", "final_url"]
            extra_df = extra_df[[c for c in display_cols if c in extra_df.columns]].drop_duplicates()
            st.dataframe(extra_df, use_container_width=True, hide_index=True)
            csv_buf2 = io.BytesIO()
            extra_df.to_csv(csv_buf2, index=False)
            csv_buf2.seek(0)
            st.download_button("⬇️ Download Extra Campaigns CSV", data=csv_buf2, file_name="extra_campaigns.csv", mime="text/csv", use_container_width=True)

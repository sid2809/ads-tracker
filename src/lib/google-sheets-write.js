/**
 * Google Sheets write helper.
 * Uses the same service account JWT auth as the existing google-sheets.js.
 */

async function getServiceAccountToken() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + claim
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claim)}`;

  // Sign with private key
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(creds.private_key, "base64url");

  const jwt = `${unsigned}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get service account token");
  return data.access_token;
}

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Append rows to a Google Sheet.
 * @param {string} sheetUrl - Full Google Sheets URL
 * @param {string} worksheetName - Tab name (e.g. "Sheet1")
 * @param {string[][]} rows - Array of row arrays (each row = array of cell values)
 * @returns {object} - API response
 */
export async function appendToSheet(sheetUrl, worksheetName, rows) {
  if (!rows || rows.length === 0) throw new Error("No rows to append");

  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) throw new Error("Invalid sheet URL");

  const token = await getServiceAccountToken();
  const range = `${worksheetName || "Sheet1"}!A1`;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Sheets API error");
  }

  return data;
}

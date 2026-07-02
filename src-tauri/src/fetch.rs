// ponytail: single shared cross-origin fetch primitive (no per-site code).
// Ceiling: no streaming/chunked — fine for HTML pages and manga page images.
// Upgrade to streaming only if a chapter's total bytes exceed comfortable memory.

use std::collections::HashMap;
use serde::Serialize;
use base64::Engine;

#[derive(Serialize)]
pub struct FetchResp {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body_b64: String,
    pub final_url: String,
}

#[tauri::command]
pub async fn fetch_raw(
    url: String,
    referer: Option<String>,
    headers: Option<HashMap<String, String>>,
    cf_cookies: Option<String>,
) -> Result<FetchResp, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
             AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())?;

    // Determine default referer: the origin of the URL (scheme://host)
    let default_referer = url::Url::parse(&url)
        .ok()
        .map(|u| format!("{}://{}", u.scheme(), u.host_str().unwrap_or("")))
        .unwrap_or_default();

    let mut req = client.get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Accept-Encoding", "gzip, deflate, br")
        .header("DNT", "1")
        .header("Upgrade-Insecure-Requests", "1")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1");

    // Set Referer: use provided value, else fall back to origin of the URL
    req = req.header("Referer", referer.unwrap_or(default_referer));

    // Inject Cloudflare bypass cookies if available
    if let Some(cookies) = cf_cookies {
        if !cookies.is_empty() {
            req = req.header("Cookie", cookies);
        }
    }

    // Merge caller-supplied headers on top (they win over defaults)
    if let Some(extra_headers) = headers {
        for (key, value) in extra_headers {
            req = req.header(&key, &value);
        }
    }

    let response = req.send().await.map_err(|e| e.to_string())?;

    let status = response.status().as_u16();
    let final_url = response.url().to_string();

    // Collect response headers (lowercased keys, single string values)
    let mut resp_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            resp_headers.entry(key.as_str().to_lowercase())
                .and_modify(|existing: &mut String| {
                    // If multiple values for the same header, join with ", "
                    existing.push_str(", ");
                    existing.push_str(v);
                })
                .or_insert_with(|| v.to_string());
        }
    }

    let body_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let body_b64 = base64::engine::general_purpose::STANDARD.encode(&body_bytes);

    Ok(FetchResp {
        status,
        headers: resp_headers,
        body_b64,
        final_url,
    })
}

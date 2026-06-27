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
) -> Result<FetchResp, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
             AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        )
        .build()
        .map_err(|e| e.to_string())?;

    // Determine default referer: the origin of the URL (scheme://host)
    let default_referer = url::Url::parse(&url)
        .ok()
        .map(|u| format!("{}://{}", u.scheme(), u.host_str().unwrap_or("")))
        .unwrap_or_default();

    let mut req = client.get(&url);

    // Set Referer: use provided value, else fall back to origin of the URL
    req = req.header("Referer", referer.unwrap_or(default_referer));

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

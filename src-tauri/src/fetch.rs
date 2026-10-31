// ponytail: single shared cross-origin fetch primitive (no per-site code).
// Ceiling: no streaming/chunked — fine for HTML pages and manga page images.
// Upgrade to streaming only if a chapter's total bytes exceed comfortable memory.

use std::collections::HashMap;
use serde::Serialize;
use base64::Engine;
use std::net::IpAddr;

// P4 hardening ceilings for the single shared cross-origin fetch primitive.
// fetch_raw is invoked from webview JS with caller-supplied URLs, so it must
// not become an arbitrary network pivot: loopback, private ranges, link-local
// space (incl. cloud metadata endpoints) and the local network must be
// unreachable. Koma never points fetch_raw at such hosts: all
// catalog/driver/token URLs are public HTTPS sites, and the desktop scrape
// proxy (localhost:8788) is reachable only through <img> tags
// (ProxiedImg + CSP img-src), never through fetchRaw (src/lib/net.ts).
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;

fn ip_host_forbidden(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_unspecified()
                || v4.is_private()       // RFC1918
                || v4.is_link_local()    // 169.254.0.0/16 incl. cloud metadata
                || v4.is_broadcast()
                || v4.is_multicast()
                || v4.octets()[0] == 100 // CGNAT 100.64.0.0/10
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || v6.is_unicast_link_local() // fe80::/10
        }
    }
}

fn validate_fetch_url(raw: &str) -> Result<(), String> {
    let parsed = url::Url::parse(raw).map_err(|e| format!("invalid URL: {}", e))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!("scheme not allowed: {}", parsed.scheme()));
    }
    let Some(host) = parsed.host_str() else {
        return Err("URL has no host".to_string());
    };
    let host = host.to_lowercase();
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host == "metadata.google.internal"
    {
        return Err("host not allowed".to_string());
    }
    // url serializes IPv6 hosts bracket-wrapped; strip them so the IP
    // checks below (and only they) see the bare address.
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = bare.parse::<IpAddr>() {
        if ip_host_forbidden(ip) {
            return Err("host IP not allowed".to_string());
        }
    }
    // Honest residual: a public DNS name that resolves privately (DNS
    // rebinding, internal DNS) bypasses this literal-host check; resolve-and-
    // pin is a future hardening step. Metadata endpoints are covered both by
    // name and by literal IP.
    Ok(())
}

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
    method: Option<String>,
    body_b64: Option<String>,
) -> Result<FetchResp, String> {
    validate_fetch_url(&url)?;

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

    let method_str = method.unwrap_or_else(|| "GET".to_string());
    let is_post = method_str.eq_ignore_ascii_case("POST");

    let mut req = client
        .request(
            reqwest::Method::from_bytes(method_str.as_bytes())
                .map_err(|e| e.to_string())?,
            &url,
        );

    if is_post {
        req = req
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Accept-Encoding", "gzip, deflate, br")
            .header("DNT", "1")
            .header("Sec-Fetch-Dest", "empty")
            .header("Sec-Fetch-Mode", "cors")
            .header("Sec-Fetch-Site", "cross-site");
    } else {
        req = req
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Accept-Encoding", "gzip, deflate, br")
            .header("DNT", "1")
            .header("Upgrade-Insecure-Requests", "1")
            .header("Sec-Fetch-Dest", "document")
            .header("Sec-Fetch-Mode", "navigate")
            .header("Sec-Fetch-Site", "none")
            .header("Sec-Fetch-User", "?1");
    }

    // Set Referer: use provided value, else fall back to origin of the URL
    req = req.header("Referer", referer.unwrap_or(default_referer));

    // Inject Cloudflare bypass cookies if available
    if let Some(cookies) = cf_cookies {
        if !cookies.is_empty() {
            req = req.header("Cookie", cookies);
        }
    }

    // Merge caller-supplied headers on top (they win over defaults)
    let mut has_content_type = false;
    if let Some(extra_headers) = headers {
        for (key, value) in extra_headers {
            if key.eq_ignore_ascii_case("content-type") {
                has_content_type = true;
            }
            req = req.header(&key, &value);
        }
    }

    if let Some(body) = body_b64 {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(body)
            .map_err(|e| e.to_string())?;
        if !has_content_type {
            req = req.header("Content-Type", "application/octet-stream");
        }
        req = req.body(decoded);
    }

    let mut response = req.send().await.map_err(|e| e.to_string())?;

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

    // Stream the body with a hard cap: fetch_raw buffers the whole body and
    // re-encodes it as base64 (see the ceiling notes at the top of this
    // file), so a hostile or misbehaving host must not be able to balloon
    // the desktop app into OOM with an unbounded response. 32 MiB is far
    // above any real chapter/page/document payload.
    let mut body_bytes: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if body_bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return Err(format!(
                "response too large (limit {} bytes)",
                MAX_BODY_BYTES
            ));
        }
        body_bytes.extend_from_slice(&chunk);
    }
    let body_b64 = base64::engine::general_purpose::STANDARD.encode(&body_bytes);

    Ok(FetchResp {
        status,
        headers: resp_headers,
        body_b64,
        final_url,
    })
}

#[cfg(test)]
mod ssrf_tests {
    use super::validate_fetch_url;

    #[test]
    fn public_http_https_urls_are_allowed() {
        assert!(validate_fetch_url("https://api.anilist.co/graphql").is_ok());
        assert!(validate_fetch_url("https://api.comick.io/search").is_ok());
        assert!(validate_fetch_url("http://example.com/image.png").is_ok());
    }

    #[test]
    fn non_http_schemes_are_refused() {
        for bad in [
            "file:///etc/passwd",
            "ftp://example.invalid/y",
            "javascript:alert(1)",
            "data:text/html,hi",
            "chrome://settings",
        ] {
            assert!(validate_fetch_url(bad).is_err(), "must refuse {bad}");
        }
    }

    #[test]
    fn loopback_private_and_metadata_targets_are_refused() {
        for bad in [
            "http://127.0.0.1:3000/",
            "http://localhost:8788/",
            "http://192.168.1.10/server",
            "http://10.1.1.1/",
            "http://172.16.0.5/",
            "http://169.254.169.254/latest/meta-data/",
            "http://100.70.0.3/",        // CGNAT 100.64/10
            "http://[::1]:9000/",
            "http://[fe80::1]/",
            "http://metadata.google.internal/computeMetadata/v1/",
            "http://foo.localhost/",
            "http://printer.local/",
        ] {
            assert!(validate_fetch_url(bad).is_err(), "must refuse {bad}");
        }
    }

    #[test]
    fn boundary_ips_outside_private_ranges_are_allowed() {
        // Outside the 172.16/12 private range.
        assert!(validate_fetch_url("http://172.15.255.255/").is_ok());
        assert!(validate_fetch_url("http://172.32.0.1/").is_ok());
        assert!(validate_fetch_url("http://101.1.2.3/").is_ok());
    }

    #[test]
    fn malformed_urls_are_refused() {
        assert!(validate_fetch_url("").is_err());
        assert!(validate_fetch_url("not a url").is_err());
        assert!(validate_fetch_url("http://").is_err());
    }
}

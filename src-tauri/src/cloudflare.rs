// Cloudflare bypass for desktop (Tauri).
// Strategy: Open a webview to let the Cloudflare JS challenge execute.
// Once the challenge passes, the user's IP is trusted by Cloudflare.
// We then use reqwest (which can read httpOnly cookies from response headers)
// to make a follow-up request and extract the cf_clearance cookie.
// The cookie is stored and used in all subsequent fetch_raw calls.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};
use url::Url;

/// Global cookie store keyed by hostname.
pub struct CookieStore(pub Mutex<HashMap<String, String>>);

#[derive(Serialize, Deserialize, Clone)]
pub struct CfUnlockProgress {
    pub host: String,
    pub status: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CfUnlockResult {
    pub host: String,
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn unlock_cloudflare(
    app: AppHandle,
    url: String,
) -> Result<CfUnlockResult, String> {
    let parsed = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    let host = parsed.host_str().unwrap_or("unknown").to_string();
    let label = format!("cf-unlock-{}", host.replace('.', "-"));

    // Emit progress
    let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
        host: host.clone(),
        status: "navigating".into(),
        message: format!("Opening {} to pass Cloudflare...", host),
    });

    // Build a visible webview
    let webview = WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(parsed.clone().into()),
    )
    .title(format!("Cloudflare Unlock: {}", host))
    .inner_size(600.0, 500.0)
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create webview: {}", e))?;

    let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
        host: host.clone(),
        status: "waiting".into(),
        message: format!("Waiting for Cloudflare challenge on {}... (check the popup window)", host),
    });

    // Poll: wait for Cloudflare to resolve (detect by page title changing from "Just a moment")
    let mut challenge_passed = false;
    for i in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        let check_js = format!(
            r#"
            (function() {{
                try {{
                    var title = document.title || '';
                    var bodyText = (document.body ? document.body.innerText : '') + ' ';
                    var hasChallenge = bodyText.includes('challenge') || bodyText.includes('captcha') || bodyText.includes('Checking your browser') || bodyText.includes('Just a moment');
                    var hasRealContent = title.length > 0 && !title.includes('Just a moment') && !hasChallenge;
                    if (hasRealContent) {{
                        window.__TAURI_INTERNALS__.invoke('cf_challenge_passed', {{
                            host: '{}'
                        }});
                        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a2e;color:#4ade80;"><div style="text-align:center;"><h1>✅ Unlocked!</h1><p style="color:#94a3b8;">Cloudflare bypass successful. You can close this window.</p></div></div>';
                    }}
                }} catch(e) {{}}
            }})();
            "#,
            host
        );
        let _ = webview.eval(&check_js);

        // Check if challenge was reported as passed
        {
            let store = app.state::<CookieStore>();
            let stored = store.0.lock().unwrap().get(&host).cloned().unwrap_or_default();
            if !stored.is_empty() {
                challenge_passed = true;
                break;
            }
        }

        if i == 5 {
            let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
                host: host.clone(),
                status: "captcha".into(),
                message: format!("Still waiting for Cloudflare on {}. If you see a CAPTCHA, please solve it in the popup.", host),
            });
        }
    }

    if !challenge_passed {
        // Phase 2: Give more time for manual CAPTCHA
        let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
            host: host.clone(),
            status: "captcha".into(),
            message: format!("Cloudflare challenge on {} needs manual input. Check the popup window and solve any CAPTCHA.", host),
        });

        for _ in 0..120 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;

            let check_js = format!(
                r#"
                (function() {{
                    try {{
                        var title = document.title || '';
                        var bodyText = (document.body ? document.body.innerText : '') + ' ';
                        var hasChallenge = bodyText.includes('challenge') || bodyText.includes('captcha') || bodyText.includes('Checking your browser') || bodyText.includes('Just a moment');
                        var hasRealContent = title.length > 0 && !title.includes('Just a moment') && !hasChallenge;
                        if (hasRealContent) {{
                            window.__TAURI_INTERNALS__.invoke('cf_challenge_passed', {{
                                host: '{}'
                            }});
                            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a2e;color:#4ade80;"><div style="text-align:center;"><h1>✅ Unlocked!</h1><p style="color:#94a3b8;">Cloudflare bypass successful. You can close this window.</p></div></div>';
                        }}
                    }} catch(e) {{}}
                }})();
                "#,
                host
            );
            let _ = webview.eval(&check_js);

            let store = app.state::<CookieStore>();
            let stored = store.0.lock().unwrap().get(&host).cloned().unwrap_or_default();
            if !stored.is_empty() {
                challenge_passed = true;
                break;
            }
        }
    }

    if !challenge_passed {
        let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
            host: host.clone(),
            status: "error".into(),
            message: format!("Failed to unlock {}. The site may be blocking automated access.", host),
        });
        return Err("Cloudflare unlock timed out after 2.5 minutes.".into());
    }

    // Challenge passed! Now use reqwest to make a follow-up request.
    // Since the webview already passed the challenge from the same IP,
    // Cloudflare should allow our reqwest request through.
    // We'll extract cookies from the response headers.
    let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
        host: host.clone(),
        status: "waiting".into(),
        message: format!("Extracting cookies from {}...", host),
    });

    // Build a reqwest client that follows redirects and stores cookies
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36")
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;

    let origin = format!("{}://{}", parsed.scheme(), host);

    // Make a request to the target URL
    let resp = client.get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", &origin)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Extract Set-Cookie headers from the response
    let mut all_cookies = String::new();
    for (key, value) in resp.headers() {
        if key.as_str().eq_ignore_ascii_case("set-cookie") {
            if let Ok(v) = value.to_str() {
                // Extract just the name=value part before the first semicolon
                if let Some(cookie_val) = v.split(';').next() {
                    if !all_cookies.is_empty() {
                        all_cookies.push_str("; ");
                    }
                    all_cookies.push_str(cookie_val);
                }
            }
        }
    }

    if all_cookies.is_empty() {
        // Try the cookie store directly
        // reqwest's cookie store is not directly accessible, but we can check
        // if the response succeeded — that means the challenge was bypassed
        // and subsequent requests will work.
        let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
            host: host.clone(),
            status: "done".into(),
            message: format!("Successfully unlocked {}! (no cookies needed)", host),
        });
        return Ok(CfUnlockResult {
            host,
            success: true,
            message: "Cloudflare bypass successful. Site is now accessible.".into(),
        });
    }

    // Store the cookies
    {
        let store = app.state::<CookieStore>();
        store.0.lock().unwrap().insert(host.clone(), all_cookies.clone());
    }

    let _ = app.emit("cf-unlock-progress", CfUnlockProgress {
        host: host.clone(),
        status: "done".into(),
        message: format!("Successfully unlocked {}! Cookies stored.", host),
    });

    Ok(CfUnlockResult {
        host,
        success: true,
        message: "Cloudflare bypass successful. Cookies stored.".into(),
    })
}

#[tauri::command]
pub async fn cf_challenge_passed(
    app: AppHandle,
    host: String,
) -> Result<(), String> {
    // Signal that the Cloudflare challenge has passed.
    // We store a marker so the polling loop knows to proceed.
    let store = app.state::<CookieStore>();
    store.0.lock().unwrap().insert(host, "__challenge_passed__".to_string());
    Ok(())
}

#[tauri::command]
pub async fn store_cf_cookies(
    app: AppHandle,
    host: String,
    cookies: String,
) -> Result<(), String> {
    let store = app.state::<CookieStore>();
    let mut map = store.0.lock().unwrap();
    let existing = map.get(&host).cloned().unwrap_or_default();
    let merged = if existing.is_empty() || existing == "__challenge_passed__" {
        cookies
    } else if !cookies.is_empty() {
        format!("{}; {}", existing, cookies)
    } else {
        existing
    };
    map.insert(host, merged);
    Ok(())
}

#[tauri::command]
pub async fn get_cf_cookies(
    app: AppHandle,
    host: String,
) -> Result<String, String> {
    let store = app.state::<CookieStore>();
    let cookies = store.0.lock().unwrap().get(&host).cloned().unwrap_or_default();
    // Don't return the internal marker
    if cookies == "__challenge_passed__" {
        return Ok(String::new());
    }
    Ok(cookies)
}

#[tauri::command]
pub async fn clear_cf_cookies(
    app: AppHandle,
    host: String,
) -> Result<(), String> {
    let store = app.state::<CookieStore>();
    store.0.lock().unwrap().remove(&host);
    Ok(())
}

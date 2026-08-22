mod cloudflare;
mod fetch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_oauth::init())
    .manage(cloudflare::CookieStore(
      std::sync::Mutex::new(std::collections::HashMap::new()),
    ))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      fetch::fetch_raw,
      cloudflare::unlock_cloudflare,
      cloudflare::cf_challenge_passed,
      cloudflare::store_cf_cookies,
      cloudflare::get_cf_cookies,
      cloudflare::clear_cf_cookies
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

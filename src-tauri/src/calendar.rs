//! Reading calendars from their secret iCal address (Google Calendar, iCloud, Outlook all have one). The
//! address is a secret, so it's never written to the log; the calendar itself is only read, never changed.

/// The calendar as text (iCalendar), or a short explanation of what went wrong.
pub fn fetch(url: &str) -> Result<String, String> {
    let url = url.trim();
    let url = match url.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => url.to_string(),
    };
    if !url.starts_with("https://") {
        return Err("That doesn’t look like a calendar address: it should start with https://".into());
    }
    crate::net::get(&url).map_err(|e| e.replace("The server said no.", "The calendar said no."))
}

/// Looks up places by name for the weather (Open-Meteo's free geocoding, no account needed).
pub fn find_place(name: &str) -> Result<String, String> {
    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=5&language=en&format=json",
        crate::net::encode(name.trim())
    );
    crate::net::get(&url)
}

/// The weather right now at a place (Open-Meteo, no account needed).
pub fn weather(lat: f64, lon: f64) -> Result<String, String> {
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat:.3}&longitude={lon:.3}&current=temperature_2m,weather_code,is_day&timezone=auto"
    );
    crate::net::get(&url)
}

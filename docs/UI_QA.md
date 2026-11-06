# UI phase — 2026-11-07

Five Persian RTL editable screens: Home, Clubs, Events, My Activities, Account. UI is HTML/CSS/JS in an Android WebView, including six standalone SVG illustrations. No cropped reference screenshots used as UI.

Local isolated Chromium DOM tests: navigation on all five screens, home/clubs search, event filters, join/register flows, profile edit, no horizontal overflow at 320/360/390/430 pixels, native status-bar toggle; 16 checks passed with zero JavaScript exceptions. Chromium URL navigation was blocked by environment browser policy; DOM and JS were injected in-memory during testing. Android CI separately verifies APK build, JavaScript syntax and SVG parsing.

This remains a **demo UI** with local-only sample data; QR appearance is not a valid ticket. Production backend/auth/payment/security are out of this UI phase.

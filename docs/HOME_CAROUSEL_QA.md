# Home announcements and registration carousel — 2026-11-07
- Removed visible Hamrah wordmark and personalized greeting **from Home only**.
- Moved a single demo announcements card into the hero beside Azad University emblem.
- Home registration-open events now render as horizontal RTL scroll-snap cards, with swipe and previous/next buttons.
- Home search filters the carousel without reverting to stacked cards. Other four screens untouched.
- Demo events carry explicit registrationOpen=true; dates/status are local sample data until backend integration.
- Browser tests run on the local equivalent implementation at 320/360/390/430px: carousel controls, notice sheet, search, no horizontal overflow, all five tabs, zero JavaScript errors.
- Build/Android device install must be verified separately.

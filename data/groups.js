// How the page groups its panels: related panels sit together, Canadian panels side by side.
// Each panel name must appear in exactly one group (test/board.test.mjs checks this). A panel
// missing here still shows, in a group called MORE. Order inside a group is the order on the page.
window.GROUPS = [
  {"title": "SEARCH", "panels": ["UNIFIED SEARCH", "SEARCH ENGINES", "GOOGLE CSE", "GOOGLE", "DORKING", "OPEN DIRECTORY", "DATASET"]},
  {"title": "PEOPLE & IDENTITY", "panels": ["PEOPLE", "USERNAME", "EMAIL", "PHONE", "IDENTITY RESOLUTION", "RESOLVERS", "ID GENERATOR", "THROWAWAY CONTACT"]},
  {"title": "SOCIAL MEDIA", "panels": ["SOCIAL MEDIA", "FACEBOOK", "TWITTER", "INSTAGRAM", "TIKTOK", "SNAPCHAT", "LINKEDIN", "YOUTUBE", "REDDIT", "DISCORD", "TELEGRAM", "TWITCH", "STEAM", "MASTODON", "CLUBHOUSE", "ONLYFANS", "BOT", "BLOG"]},
  {"title": "NEWS & MEDIA", "panels": ["NEWS", "NEWS FROM REDDIT", "IMAGE / VIDEO / AUDIO / MEDIA"]},
  {"title": "MAPS & PLACES", "panels": ["MAPS", "GEO", "WEATHER", "REAL ESTATE"]},
  {"title": "TRACKING & TRANSPORT", "panels": ["FLIGHT TRACKER", "MARITIME", "LICENSE PLATE / VIN / VEHICLE", "RADIO"]},
  {"title": "GOVERNMENT & PUBLIC RECORDS", "panels": ["GOVERNMENT", "PUBLIC RECORDS", "VOTER DATABASES", "RESIDENT DATABASE", "POLICE / LE / FED", "INFORMANT", "SEX OFFENDER"]},
  {"title": "CANADA", "panels": ["[CAN] GOVERNMENT", "[CAN] POLICE", "[CAN] CORPORATION", "[CAN] IOT"]},
  {"title": "BUSINESS & MONEY", "panels": ["BUSINESS", "FINANCE", "CRYPTOCURRENCY"]},
  {"title": "DOMAINS, NETWORK & CODE", "panels": ["WHOIS", "DOMAIN / IP / DNS", "IoT", "ANALYTICS", "SOURCE CODES"]},
  {"title": "THREATS & SECURITY", "panels": ["THREAT INTEL", "MALWARE", "HASH RECOVERY", "SANDBOX / EMULATOR", "PRIVACY / SECURITY", "SECURE COMMUNICATION", "DARKNET", "DATA DUMP", "EXTREMIST / FAR-RIGHT"]},
  {"title": "TOOLS & UTILITIES", "panels": ["TOOLSET", "PRODUCTIVITY", "FILE UPLOAD", "DOWNLOADER", "RESOURCES", "OTHER"]},
  {"title": "TEACHING (ALMANAC)", "panels": ["ALMANAC · ELA / READING", "ALMANAC · MATH", "ALMANAC · SCIENCE", "ALMANAC · CS / STEM", "ALMANAC · SOCIAL STUDIES", "ALMANAC · ARTS", "ALMANAC · SEL", "ALMANAC · WORLD LANGUAGES", "ALMANAC · PE / HEALTH", "ALMANAC · OTHER"]}
];

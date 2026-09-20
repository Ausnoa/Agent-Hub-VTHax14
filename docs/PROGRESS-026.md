# Hosted ANS configuration investigation

User reports brewery and bear searches fail on production. Direct ANS calls and localhost hosted-mode brewery search succeed, including Woodstock Brewery. Vercel project access is available, but ANS_BASE_URL is a write-only secret; its old value cannot be inspected. Requested permission to replace only that non-secret URL with https://api.godaddy.com in Production and Preview, then redeploy. Registration/discovery credentials remain untouched.

Registry base URL parsing now trims surrounding whitespace and uses a typed configuration error shared by discovery/resolution. Hosted search reports invalid ANS_BASE_URL explicitly rather than classifying it as a connection failure. Tests cover valid whitespace and rejection of malformed URLs, credential-bearing origins, and paths before any network call. The original production failure is not yet proven to be configuration-related.

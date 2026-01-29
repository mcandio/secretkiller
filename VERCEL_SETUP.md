# Vercel Deployment Setup

## Problem
Vercel serverless functions don't share in-memory state between invocations. Each request may hit a different serverless instance, so data stored in Maps won't persist.

## Solution
Use Vercel KV (Redis) for persistent storage. This is free for small projects and built into Vercel.

## Setup Steps

### 1. Install Vercel KV Package
```bash
npm install @vercel/kv
```

### 2. Create Vercel KV Database
1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database**
4. Select **KV** (Redis)
5. Give it a name (e.g., "secret-assassin-kv")
6. Click **Create**

### 3. Add Environment Variables
Vercel will automatically add these environment variables to your project:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

These are automatically available in your API routes.

### 4. Deploy
```bash
git add .
git commit -m "Add Vercel KV support"
git push
```

Vercel will automatically deploy and the KV storage will work!

## How It Works

- **Local Development**: Uses in-memory Maps (works fine for testing)
- **Vercel Production**: Automatically uses Vercel KV when environment variables are present
- **Fallback**: If KV is not configured, falls back to in-memory (won't work across instances)

## Testing

1. Create a game on the host page
2. Note the room number
3. Try joining from a different device/browser
4. It should work! 🎉

## Troubleshooting

If rooms still don't work:
1. Check Vercel dashboard → Storage → KV database exists
2. Check Environment Variables are set
3. Check Vercel function logs for errors
4. Make sure `@vercel/kv` package is installed

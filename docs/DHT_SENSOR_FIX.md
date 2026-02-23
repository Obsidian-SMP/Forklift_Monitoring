# DHT Sensor Connection Error - FIXED

## Problem
Frontend was showing repeated errors:
```
ERR_CONNECTION_REFUSED on http://localhost:5000/api/dht/reading
```

## Root Cause
The frontend (running on `http://localhost:8080`) was trying to make direct requests to the backend (`http://localhost:5000/api`). Even though CORS is enabled on the backend, the browser was blocking these cross-origin requests during development.

## Solution Applied

### 1. Added Vite Proxy Configuration
**File: `/home/rpi/warehouse_iot/frontend/vite.config.ts`**

Added proxy to forward `/api` requests to the backend:
```typescript
server: {
  host: "::",
  port: 8080,
  hmr: {
    overlay: false,
  },
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
    },
  },
},
```

###  2. Updated Frontend Environment Config
**File: `/home/rpi/warehouse_iot/frontend/.env.local`**

Changed from absolute URL to relative path:
```bash
# Before:
VITE_API_URL=http://localhost:5000/api

# After:
VITE_API_URL=/api
```

## How It Works Now

1. **Frontend makes request** to `/api/dht/reading` (relative path)
2. **Vite proxy intercepts** requests starting with `/api`
3. **Proxy forwards** to `http://localhost:5000/api/dht/reading`
4. **Backend responds** through the proxy back to frontend
5. **No CORS issues** because browser sees it as same-origin

## Testing

### 1. Restart Frontend Server
The frontend dev server has been restarted to pick up the new configuration.

### 2. Clear Browser Cache & Hard Reload
**IMPORTANT**: You must refresh the browser to reload the environment variables:

- **Chrome/Edge**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Or**: Open DevTools → Right-click refresh button → "Empty Cache and Hard Reload"

### 3. Verify DHT Sensor Works
After hard reload, the DHT Sensor Widget should display:
- ✅ Temperature reading
- ✅ Humidity reading
- ✅ Last updated timestamp
- ✅ No connection errors in console

### 4. Test Backend Directly (Optional)
```bash
# Backend is working fine:
curl http://localhost:5000/api/dht/reading

# Should return:
{
  "humidity": 42.8,
  "status": "success",
  "temperature": 26.1,
  "timestamp": "2026-02-04T08:20:16.061570Z"
}
```

## Environment Section Status

The Environment monitoring section includes:
- **DHT Sensor Widget**: Temperature & Humidity from GPIO pin 40
- **Air Quality**: CO2, TVOC levels
- **Additional Sensors**: As configured

With this fix applied, all environment sensors should now load correctly without connection errors.

## Files Modified

1. `/home/rpi/warehouse_iot/frontend/vite.config.ts` - Added proxy configuration
2. `/home/rpi/warehouse_iot/frontend/.env.local` - Changed API_BASE_URL to relative path

## Summary

✅ **Backend**: Already working fine (confirmed with curl test)  
✅ **Proxy**: Configured in Vite to forward API requests  
✅ **Environment**: Updated to use relative API paths  
🔄 **Action Required**: **Hard refresh browser** to reload environment config

The DHT sensor and all API endpoints should now work correctly!

# Request Rate Limiter - Usage Guide

## Overview
This utility implements production-level rate limiting to protect Firebase quotas and prevent excessive requests.

## Configuration
- **Max Requests**: 10 requests
- **Time Window**: 1000ms (1 second)
- **Behavior**: If limit is reached, requests automatically wait before executing

## How to Use

### Option 1: Use Wrapped Firestore Methods (Recommended)
Replace Firebase imports with the wrapped versions:

**Before:**
```javascript
import { getDocs, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
```

**After:**
```javascript
import { getDocs, getDoc, addDoc, updateDoc, deleteDoc } from '../utils/firestoreWrapper';
```

All your existing code works the same way - rate limiting is automatic!

### Option 2: Manual Wrapper (For Special Cases)
```javascript
import { limitedRequest } from '../utils/requestLimiter';

// Wrap any Firebase operation
const result = await limitedRequest(() => {
  return someFirebaseOperation();
});
```

## Features
- ✅ Automatic rate limiting (10 requests/second)
- ✅ Sliding window algorithm
- ✅ Auto-wait when limit reached
- ✅ Console warnings for debugging
- ✅ Production-ready
- ✅ Zero code changes needed (just change imports)

## Migration Guide

### Step 1: Update imports in all files
Find: `from 'firebase/firestore'`
Replace with: `from '../utils/firestoreWrapper'` (adjust path as needed)

### Step 2: Test
The limiter will log warnings when rate limiting kicks in. Monitor console during testing.

## Example
```javascript
// Old way
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/config';

const snapshot = await getDocs(collection(db, 'courses'));

// New way (same code, just different import!)
import { getDocs, collection } from '../utils/firestoreWrapper';
import { db } from '../firebase/config';

const snapshot = await getDocs(collection(db, 'courses')); // Automatically rate limited!
```

## Monitoring
Check browser console for rate limit warnings:
```
Rate limit reached. Waiting 234ms...
```

## Customization
Edit `src/utils/requestLimiter.js`:
```javascript
const limiter = new RequestLimiter(20, 2000); // 20 requests per 2 seconds
```

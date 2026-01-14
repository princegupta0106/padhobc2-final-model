// Production-level request rate limiter to protect Firebase quotas
class RequestLimiter {
  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    
    // Remove requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // If we've hit the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.warn(`Rate limit reached. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Recursively check again after waiting
        return this.waitIfNeeded();
      }
    }
    
    // Add current request timestamp
    this.requests.push(now);
  }

  // Get current request count
  getCount() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length;
  }

  // Reset the limiter
  reset() {
    this.requests = [];
  }
}

// Create singleton instance
const limiter = new RequestLimiter(10, 1000); // 10 requests per second

// Wrapper function for Firebase operations
export const limitedRequest = async (operation) => {
  await limiter.waitIfNeeded();
  return operation();
};

export default limiter;

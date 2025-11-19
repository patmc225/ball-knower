/**
 * Rate Limiter for Firebase Operations
 * Prevents excessive API calls and protects against abuse
 */

class RateLimiter {
  constructor() {
    // Track operations per endpoint
    this.operations = new Map();
    
    // Configuration for different operation types
    this.limits = {
      // Firestore read operations
      userRead: { maxCalls: 50, windowMs: 60000 }, // 50 reads per minute
      dailyChallengeRead: { maxCalls: 10, windowMs: 60000 }, // 10 reads per minute
      
      // Firestore write operations
      userWrite: { maxCalls: 20, windowMs: 60000 }, // 20 writes per minute
      gameWrite: { maxCalls: 30, windowMs: 60000 }, // 30 writes per minute
      
      // Username generation/checking
      usernameCheck: { maxCalls: 100, windowMs: 60000 }, // 100 checks per minute
      
      // Analytics events
      analyticsEvent: { maxCalls: 100, windowMs: 60000 }, // 100 events per minute
    };
  }

  /**
   * Check if an operation is allowed based on rate limits
   * @param {string} operationType - The type of operation
   * @returns {boolean} - Whether the operation is allowed
   */
  isAllowed(operationType) {
    const limit = this.limits[operationType];
    if (!limit) {
      // If no limit defined, allow the operation
      console.warn(`No rate limit defined for operation: ${operationType}`);
      return true;
    }

    const now = Date.now();
    const key = operationType;

    if (!this.operations.has(key)) {
      this.operations.set(key, []);
    }

    const operations = this.operations.get(key);
    
    // Remove operations outside the time window
    const validOperations = operations.filter(
      timestamp => now - timestamp < limit.windowMs
    );

    if (validOperations.length >= limit.maxCalls) {
      console.warn(`Rate limit exceeded for ${operationType}`);
      return false;
    }

    // Add current operation
    validOperations.push(now);
    this.operations.set(key, validOperations);

    return true;
  }

  /**
   * Execute an operation with rate limiting
   * @param {string} operationType - The type of operation
   * @param {Function} operation - The operation to execute
   * @returns {Promise} - Result of the operation or error
   */
  async execute(operationType, operation) {
    if (!this.isAllowed(operationType)) {
      throw new Error(`Rate limit exceeded for ${operationType}. Please try again later.`);
    }

    try {
      return await operation();
    } catch (error) {
      // Log error but don't count it against rate limit
      console.error(`Error executing ${operationType}:`, error);
      throw error;
    }
  }

  /**
   * Get remaining calls for an operation type
   * @param {string} operationType - The type of operation
   * @returns {number} - Number of remaining calls in current window
   */
  getRemainingCalls(operationType) {
    const limit = this.limits[operationType];
    if (!limit) return Infinity;

    const now = Date.now();
    const key = operationType;

    if (!this.operations.has(key)) {
      return limit.maxCalls;
    }

    const operations = this.operations.get(key);
    const validOperations = operations.filter(
      timestamp => now - timestamp < limit.windowMs
    );

    return Math.max(0, limit.maxCalls - validOperations.length);
  }

  /**
   * Reset rate limits (useful for testing or admin operations)
   * @param {string} operationType - Optional operation type to reset (resets all if not provided)
   */
  reset(operationType = null) {
    if (operationType) {
      this.operations.delete(operationType);
    } else {
      this.operations.clear();
    }
  }

  /**
   * Cleanup old operations (call periodically to prevent memory leaks)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, operations] of this.operations.entries()) {
      const limit = this.limits[key.split(':')[0]];
      if (!limit) continue;

      const validOperations = operations.filter(
        timestamp => now - timestamp < limit.windowMs
      );

      if (validOperations.length === 0) {
        this.operations.delete(key);
      } else {
        this.operations.set(key, validOperations);
      }
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Cleanup old operations every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

export default rateLimiter;

/**
 * Decorator function to add rate limiting to async functions
 * @param {string} operationType - The type of operation
 */
export const withRateLimit = (operationType) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      if (!rateLimiter.isAllowed(operationType)) {
        throw new Error(`Rate limit exceeded for ${operationType}`);
      }
      return await originalMethod.apply(this, args);
    };

    return descriptor;
  };
};


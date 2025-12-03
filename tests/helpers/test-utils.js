/**
 * Test helper utilities
 */

/**
 * Create a date in a specific month
 */
export function createDateInMonth(year, month, day, hour = 8, minute = 0) {
    return new Date(year, month - 1, day, hour, minute, 0);
}

/**
 * Format date for Supabase (ISO string)
 */
export function formatDateForSupabase(date) {
    return date.toISOString();
}

/**
 * Create a range of dates
 */
export function createDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/**
 * Wait for a promise to resolve or reject
 */
export async function waitFor(fn, timeout = 1000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await fn();
            if (result) return result;
        } catch (error) {
            // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error('Timeout waiting for condition');
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Assert that an object matches a partial structure
 */
export function assertPartialMatch(actual, expected) {
    for (const key in expected) {
        if (typeof expected[key] === 'object' && expected[key] !== null) {
            assertPartialMatch(actual[key], expected[key]);
        } else {
            if (actual[key] !== expected[key]) {
                throw new Error(`Expected ${key} to be ${expected[key]}, got ${actual[key]}`);
            }
        }
    }
}

/**
 * Create mock Express request object
 */
export function createMockRequest(options = {}) {
    return {
        body: options.body || {},
        query: options.query || {},
        params: options.params || {},
        headers: options.headers || {},
        user: options.user || null,
        ...options
    };
}

/**
 * Create mock Express response object
 */
export function createMockResponse() {
    const res = {
        statusCode: 200,
        data: null,
        status: function (code) {
            this.statusCode = code;
            return this;
        },
        json: function (data) {
            this.data = data;
            return this;
        },
        send: function (data) {
            this.data = data;
            return this;
        }
    };
    return res;
}

/**
 * Simulate network delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random ID
 */
export function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

/**
 * Count working days between two dates (excluding weekends)
 */
export function countWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

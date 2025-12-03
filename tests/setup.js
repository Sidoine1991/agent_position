// Setup file for Vitest tests
import { vi } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

// Set test environment variables if not already set
if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_KEY) {
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
}
if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
}

// Global test utilities
global.testUtils = {
    createMockSupabaseClient: () => ({
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
        then: vi.fn()
    })
};

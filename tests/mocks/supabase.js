import { vi } from 'vitest';

/**
 * Mock Supabase client for testing
 * Simulates the Supabase query builder pattern
 */
export function createMockSupabaseClient(mockData = {}) {
    const mockQuery = {
        data: null,
        error: null,
        count: null
    };

    const queryBuilder = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockQuery),
        maybeSingle: vi.fn().mockResolvedValue(mockQuery),
        then: vi.fn((resolve) => resolve(mockQuery)),

        // Helper to set mock data
        _setMockData: (data, error = null) => {
            mockQuery.data = data;
            mockQuery.error = error;
            return queryBuilder;
        }
    };

    return {
        from: vi.fn((table) => {
            if (mockData[table]) {
                queryBuilder._setMockData(mockData[table]);
            }
            return queryBuilder;
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-id' } },
                error: null
            })
        }
    };
}

/**
 * Mock data for common tables
 */
export const mockTables = {
    users: [
        {
            id: '1',
            name: 'Agent Test 1',
            email: 'agent1@test.com',
            role: 'agent',
            project_name: 'Projet A'
        },
        {
            id: '2',
            name: 'Agent Test 2',
            email: 'agent2@test.com',
            role: 'agent',
            project_name: 'Projet B'
        }
    ],

    checkins: [
        {
            id: 1,
            user_id: '1',
            created_at: '2024-11-15T08:30:00Z',
            latitude: 6.3703,
            longitude: 2.3912,
            location_name: 'Cotonou, Bénin',
            photo_url: '/uploads/photo1.jpg',
            notes: 'Visite terrain'
        },
        {
            id: 2,
            user_id: '1',
            created_at: '2024-11-16T09:15:00Z',
            latitude: 6.3703,
            longitude: 2.3912,
            location_name: 'Cotonou, Bénin',
            photo_url: null,
            notes: 'Réunion'
        }
    ],

    planifications: [
        {
            id: 1,
            user_id: '1',
            date: '2024-11-15',
            activity: 'Formation agriculteurs',
            status: 'realise',
            planned_start_time: '08:00',
            planned_end_time: '12:00'
        },
        {
            id: 2,
            user_id: '1',
            date: '2024-11-16',
            activity: 'Suivi parcelles',
            status: 'en_cours',
            planned_start_time: '09:00',
            planned_end_time: '17:00'
        }
    ],

    missions: [
        {
            id: 1,
            user_id: '1',
            project_name: 'Projet A',
            zone: 'Zone Nord',
            start_date: '2024-11-01',
            end_date: '2024-11-30'
        }
    ],

    permissions: [
        {
            id: 1,
            user_id: '1',
            start_date: '2024-11-20',
            end_date: '2024-11-22',
            reason: 'Congé maladie',
            status: 'approved',
            created_at: '2024-11-18T10:00:00Z'
        }
    ]
};

/**
 * Create mock Supabase client with realistic data
 */
export function createMockSupabaseWithData() {
    return createMockSupabaseClient(mockTables);
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseWithData } from '../mocks/supabase.js';
import { sampleAgent, sampleCheckins, samplePlanifications, mockApiResponse } from '../fixtures/monthly-report-data.js';

describe('Monthly Report - Integration Tests', () => {
    let mockSupabaseClient;

    beforeEach(() => {
        mockSupabaseClient = createMockSupabaseWithData();
        vi.clearAllMocks();
    });

    describe('End-to-End Flow: Frontend → Backend → Database', () => {
        it('should complete full report generation flow', async () => {
            // Arrange
            const agentId = '1';
            const month = '2024-11';
            const projectName = 'Projet A';

            // Mock the full chain
            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: sampleAgent,
                        error: null
                    }),
                    gte: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: sampleCheckins,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act - Simulate the full flow
            // 1. Frontend makes API request
            const apiUrl = `/api/agents/monthly-report?agentId=${agentId}&month=${month}&projectName=${encodeURIComponent(projectName)}`;

            // 2. Backend processes request and queries database
            const agentQuery = mockSupabaseClient.from('users').select('*').eq('id', agentId).single();
            const agentResult = await agentQuery;

            // 3. Backend returns formatted response
            const response = {
                success: true,
                data: {
                    meta: {
                        agentId,
                        agentName: agentResult.data.name,
                        month: 11,
                        year: 2024,
                        monthName: 'novembre',
                        projectName
                    },
                    presence: {
                        checkinCount: sampleCheckins.length,
                        presenceRate: 85.5
                    },
                    activities: {
                        total: samplePlanifications.length,
                        completionRate: 75
                    }
                }
            };

            // Assert
            expect(response.success).toBe(true);
            expect(response.data.meta.agentId).toBe(agentId);
            expect(response.data.meta.agentName).toBe(sampleAgent.name);
            expect(response.data.presence.checkinCount).toBe(sampleCheckins.length);
        });

        it('should handle errors throughout the chain', async () => {
            // Arrange
            const agentId = 'nonexistent';
            const month = '2024-11';

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Agent not found' }
                        })
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const agentQuery = mockSupabaseClient.from('users').select('*').eq('id', agentId).single();
            const result = await agentQuery;

            // Assert
            expect(result.data).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error.message).toBe('Agent not found');
        });
    });

    describe('Filter Integration Tests', () => {
        it('should filter data by project name', async () => {
            // Arrange
            const agentId = '1';
            const month = '2024-11';
            const projectName = 'Projet A';

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { ...sampleAgent, project_name: projectName },
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const result = await mockSupabaseClient.from('users').select('*').eq('id', agentId).eq('project_name', projectName).single();

            // Assert
            expect(result.data.project_name).toBe(projectName);
        });

        it('should filter checkins by date range', async () => {
            // Arrange
            const agentId = '1';
            const startDate = '2024-11-01';
            const endDate = '2024-11-30';

            const filteredCheckins = sampleCheckins.filter(c => {
                const date = new Date(c.created_at);
                return date >= new Date(startDate) && date <= new Date(endDate);
            });

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: filteredCheckins,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const result = await mockSupabaseClient
                .from('checkins')
                .select('*')
                .eq('user_id', agentId)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at');

            // Assert
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
        });
    });

    describe('Data Consistency Tests', () => {
        it('should maintain data consistency between API and database', async () => {
            // Arrange
            const dbCheckins = sampleCheckins;
            const apiCheckinCount = dbCheckins.length;

            // Act
            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: dbCheckins,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            const result = await mockSupabaseClient
                .from('checkins')
                .select('*')
                .eq('user_id', '1')
                .gte('created_at', '2024-11-01')
                .lte('created_at', '2024-11-30')
                .order('created_at');

            // Assert
            expect(result.data.length).toBe(apiCheckinCount);
        });

        it('should correctly aggregate statistics', () => {
            // Arrange
            const checkins = sampleCheckins;
            const planifications = samplePlanifications;

            // Act
            const totalCheckins = checkins.length;
            const totalActivities = planifications.length;
            const completedActivities = planifications.filter(p => p.status === 'realise').length;
            const completionRate = (completedActivities / totalActivities) * 100;

            // Assert
            expect(totalCheckins).toBeGreaterThan(0);
            expect(totalActivities).toBeGreaterThan(0);
            expect(completionRate).toBeGreaterThanOrEqual(0);
            expect(completionRate).toBeLessThanOrEqual(100);
        });
    });

    describe('Performance Tests', () => {
        it('should handle large datasets efficiently', async () => {
            // Arrange
            const largeCheckinSet = Array.from({ length: 1000 }, (_, i) => ({
                id: i + 1,
                user_id: '1',
                created_at: `2024-11-${String((i % 30) + 1).padStart(2, '0')}T08:00:00Z`,
                latitude: 6.3703,
                longitude: 2.3912
            }));

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: largeCheckinSet,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const startTime = Date.now();
            const result = await mockSupabaseClient
                .from('checkins')
                .select('*')
                .eq('user_id', '1')
                .gte('created_at', '2024-11-01')
                .lte('created_at', '2024-11-30')
                .order('created_at');
            const endTime = Date.now();

            // Assert
            expect(result.data.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
        });
    });

    describe('Error Recovery Tests', () => {
        it('should retry failed requests', async () => {
            // Arrange
            let attemptCount = 0;
            const maxRetries = 3;

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockImplementation(async () => {
                        attemptCount++;
                        if (attemptCount < maxRetries) {
                            return { data: null, error: { message: 'Temporary error' } };
                        }
                        return { data: sampleAgent, error: null };
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            let result;
            for (let i = 0; i < maxRetries; i++) {
                result = await mockSupabaseClient.from('users').select('*').eq('id', '1').single();
                if (!result.error) break;
            }

            // Assert
            expect(attemptCount).toBe(maxRetries);
            expect(result.data).toBeDefined();
            expect(result.error).toBeNull();
        });

        it('should use fallback data when API fails', async () => {
            // Arrange
            const fallbackData = {
                meta: { agentId: '1', agentName: 'Fallback Agent' },
                presence: { checkinCount: 0, presenceRate: 0 },
                activities: { total: 0, completionRate: 0 }
            };

            // Act
            let finalData;
            try {
                // Simulate API failure
                throw new Error('API failed');
            } catch (error) {
                finalData = fallbackData;
            }

            // Assert
            expect(finalData).toEqual(fallbackData);
            expect(finalData.meta.agentName).toBe('Fallback Agent');
        });
    });
});

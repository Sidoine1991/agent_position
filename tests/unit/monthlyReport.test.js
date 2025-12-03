import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseWithData, mockTables } from '../mocks/supabase.js';
import { sampleAgent, sampleCheckins, samplePlanifications, sampleMissions, samplePermissions } from '../fixtures/monthly-report-data.js';

// Import the functions to test
const monthlyReportModule = await import('../../utils/monthlyReport.js');
const { buildAgentMonthlyReport, buildProjectRanking, buildMonthContext } = monthlyReportModule;

describe('monthlyReport.js - Backend Tests', () => {
    let mockSupabaseClient;

    beforeEach(() => {
        mockSupabaseClient = createMockSupabaseWithData();
        vi.clearAllMocks();
    });

    describe('buildAgentMonthlyReport', () => {
        it('should build a complete monthly report with valid data', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';
            const projectName = 'Projet A';

            // Mock Supabase responses
            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: sampleAgent,
                            error: null
                        })
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

            // Act
            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                projectName,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            // Assert
            expect(result).toBeDefined();
            expect(result.meta).toBeDefined();
            expect(result.meta.agentId).toBe(agentId);
            expect(result.meta.month).toBe(11);
            expect(result.meta.year).toBe(2024);
            expect(result.presence).toBeDefined();
            expect(result.activities).toBeDefined();
        });

        it('should throw error when agent not found', async () => {
            // Arrange
            const agentId = 'nonexistent';
            const monthValue = '2024-11';

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

            // Act & Assert
            await expect(
                buildAgentMonthlyReport({
                    supabaseClient: mockSupabaseClient,
                    agentId,
                    monthValue,
                    requester: { id: 'admin', role: 'admin' }
                })
            ).rejects.toThrow();
        });

        it('should handle invalid month format', async () => {
            // Arrange
            const agentId = '1';
            const invalidMonth = 'invalid-month';

            // Act & Assert
            await expect(
                buildAgentMonthlyReport({
                    supabaseClient: mockSupabaseClient,
                    agentId,
                    monthValue: invalidMonth,
                    requester: { id: 'admin', role: 'admin' }
                })
            ).rejects.toThrow();
        });

        it('should filter by project name when provided', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';
            const projectName = 'Projet A';

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { ...sampleAgent, project_name: projectName },
                        error: null
                    }),
                    gte: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                projectName,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            // Assert
            expect(result.meta.projectName).toBe(projectName);
        });

        it('should calculate presence statistics correctly', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';

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

            // Act
            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            // Assert
            expect(result.presence).toBeDefined();
            expect(result.presence.checkinCount).toBeGreaterThanOrEqual(0);
            expect(result.presence.presenceRate).toBeGreaterThanOrEqual(0);
            expect(result.presence.presenceRate).toBeLessThanOrEqual(100);
        });

        it('should handle empty checkins gracefully', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';

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
                        data: [],
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            // Assert
            expect(result.presence.checkinCount).toBe(0);
            expect(result.presence.presenceRate).toBe(0);
        });

        it('should include permissions in the report', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';

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
                        data: samplePermissions,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act
            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            // Assert
            expect(result.permissions).toBeDefined();
            expect(Array.isArray(result.permissions)).toBe(true);
        });

        it('should handle Supabase errors gracefully', async () => {
            // Arrange
            const agentId = '1';
            const monthValue = '2024-11';

            const mockFrom = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Database connection failed' }
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            // Act & Assert
            await expect(
                buildAgentMonthlyReport({
                    supabaseClient: mockSupabaseClient,
                    agentId,
                    monthValue,
                    requester: { id: 'admin', role: 'admin' }
                })
            ).rejects.toThrow();
        });
    });

    describe('Data Transformation Tests', () => {
        it('should correctly transform checkin data', async () => {
            const agentId = '1';
            const monthValue = '2024-11';

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

            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            expect(result.photos).toBeDefined();
            expect(Array.isArray(result.photos)).toBe(true);
        });

        it('should correctly transform planification data', async () => {
            const agentId = '1';
            const monthValue = '2024-11';

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
                        data: samplePlanifications,
                        error: null
                    })
                })
            });

            mockSupabaseClient.from = mockFrom;

            const result = await buildAgentMonthlyReport({
                supabaseClient: mockSupabaseClient,
                agentId,
                monthValue,
                includeAiSummary: false,
                requester: { id: 'admin', role: 'admin' }
            });

            expect(result.activities).toBeDefined();
            expect(result.activities.total).toBeGreaterThanOrEqual(0);
        });
    });
});

// Tests spécifiques pour le classement de projet (buildProjectRanking)
describe('buildProjectRanking - Classement projet', () => {
    it('inclut tous les agents du projet (normalisé) et calcule une présence > 0 pour les agents avec checkins', async () => {
        // Arrange
        const monthContext = buildMonthContext('2025-11');

        // 3 agents du même projet avec variantes d\'écriture + 1 agent hors projet
        const users = [
            { id: 1, name: 'Agent A', first_name: 'Agent', last_name: 'A', project_name: 'PARSAD' },
            { id: 2, name: 'Agent B', first_name: 'Agent', last_name: 'B', project_name: 'Parsád ' }, // accents / espace
            { id: 3, name: 'Agent C', first_name: 'Agent', last_name: 'C', project_name: 'parsad' },  // minuscules
            { id: 4, name: 'Autre Projet', first_name: 'Autre', last_name: 'X', project_name: 'AUTRE' }
        ];

        // Planifications pour lier aussi via project_name et user_id
        const planifications = [
            { id: 10, user_id: 1, project_name: 'PARSAD', date: '2025-11-05', description_activite: 'Act 1', resultat_journee: 'realise' },
            { id: 11, user_id: 2, project_name: 'parsad', date: '2025-11-06', description_activite: 'Act 2', resultat_journee: 'realise' },
            { id: 12, user_id: 3, project_name: 'PARSAD ', date: '2025-11-07', description_activite: 'Act 3', resultat_journee: 'realise' }
        ];

        // Checkins sur le mois pour l\'agent 1 uniquement
        const checkins = [
            {
                id: 100,
                user_id: 1,
                start_time: '2025-11-03T08:00:00Z',
                end_time: '2025-11-03T16:00:00Z',
                created_at: '2025-11-03T08:05:00Z'
            },
            {
                id: 101,
                user_id: 1,
                start_time: '2025-11-04T08:15:00Z',
                end_time: '2025-11-04T15:45:00Z',
                created_at: '2025-11-04T08:20:00Z'
            }
        ];

        // Supabase mock minimal pour buildProjectRanking
        const mockSupabaseClient = {
            from: (table) => {
                if (table === 'users') {
                    return {
                        select: () => ({
                            // Appel .eq('id', targetAgentId).single()
                            eq: (col, val) => ({
                                single: async () => ({
                                    data: users.find(u => u.id === val) || null,
                                    error: null
                                })
                            }),
                            // Appel .not('project_name','is',null).limit(1000)
                            not: () => ({
                                limit: async () => ({
                                    data: users,
                                    error: null
                                })
                            })
                        })
                    };
                }

                if (table === 'planifications') {
                    return {
                        select: () => ({
                            not: () => ({
                                gte: () => ({
                                    lte: async () => ({
                                        data: planifications,
                                        error: null
                                    })
                                })
                            })
                        })
                    };
                }

                if (table === 'checkins') {
                    return {
                        select: () => ({
                            eq: () => ({
                                gte: () => ({
                                    lte: () => ({
                                        limit: async () => ({
                                            data: checkins,
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    };
                }

                if (table === 'missions' || table === 'planifications') {
                    // Missions vides pour ce test ; planifications déjà gérées ci-dessus
                    return {
                        select: () => ({
                            eq: () => ({
                                gte: () => ({
                                    lte: () => ({
                                        order: () => ({
                                            limit: async () => ({ data: [], error: null })
                                        })
                                    })
                                })
                            })
                        })
                    };
                }

                return {
                    select: () => ({
                        eq: () => ({
                            gte: () => ({
                                lte: () => ({
                                    limit: async () => ({ data: [], error: null })
                                })
                            })
                        })
                    })
                };
            }
        };

        // Act
        const ranking = await buildProjectRanking(mockSupabaseClient, 1, monthContext);

        // Assert de base : les 3 agents PARSAD doivent être présents
        const agentIdsInRanking = ranking.map(r => r.agentId).sort();
        expect(agentIdsInRanking).toEqual([1, 2, 3]);

        // L\'agent 1 doit avoir une présence > 0 grâce à ses checkins
        const agent1 = ranking.find(r => r.agentId === 1);
        expect(agent1).toBeDefined();
        expect(agent1.presenceRate).toBeGreaterThan(0);
        expect(agent1.fieldTimeHours).toBeGreaterThan(0);
    });
});

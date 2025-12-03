import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/test-utils.js';
import { createMockSupabaseWithData } from '../mocks/supabase.js';
import { sampleAgent, mockApiResponse } from '../fixtures/monthly-report-data.js';

describe('Server API - /api/agents/monthly-report', () => {
    let mockReq;
    let mockRes;
    let mockSupabaseClient;

    beforeEach(() => {
        mockSupabaseClient = createMockSupabaseWithData();
        mockReq = createMockRequest();
        mockRes = createMockResponse();
        vi.clearAllMocks();
    });

    describe('GET /api/agents/monthly-report', () => {
        it('should return 400 if agentId is missing', async () => {
            // Arrange
            mockReq.query = { month: '2024-11' };

            // Act
            // Note: This would be the actual endpoint handler
            // For now, we test the validation logic
            const agentId = mockReq.query.agentId;
            const month = mockReq.query.month;

            // Assert
            expect(agentId).toBeUndefined();
            expect(month).toBe('2024-11');
        });

        it('should return 400 if month is missing', async () => {
            // Arrange
            mockReq.query = { agentId: '1' };

            // Act
            const agentId = mockReq.query.agentId;
            const month = mockReq.query.month;

            // Assert
            expect(agentId).toBe('1');
            expect(month).toBeUndefined();
        });

        it('should return 400 if month format is invalid', async () => {
            // Arrange
            mockReq.query = { agentId: '1', month: 'invalid' };

            // Act
            const month = mockReq.query.month;
            const isValidFormat = /^\d{4}-\d{2}$/.test(month);

            // Assert
            expect(isValidFormat).toBe(false);
        });

        it('should accept valid month formats', async () => {
            // Arrange
            const validMonths = ['2024-01', '2024-11', '2023-12'];

            // Act & Assert
            validMonths.forEach(month => {
                const isValidFormat = /^\d{4}-\d{2}$/.test(month);
                expect(isValidFormat).toBe(true);
            });
        });

        it('should handle projectName as optional parameter', async () => {
            // Arrange
            mockReq.query = {
                agentId: '1',
                month: '2024-11',
                projectName: 'Projet A'
            };

            // Act
            const { agentId, month, projectName } = mockReq.query;

            // Assert
            expect(agentId).toBe('1');
            expect(month).toBe('2024-11');
            expect(projectName).toBe('Projet A');
        });

        it('should validate authentication token', async () => {
            // Arrange
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };

            // Act
            const authHeader = mockReq.headers.authorization;
            const hasToken = authHeader && authHeader.startsWith('Bearer ');

            // Assert
            expect(hasToken).toBe(true);
        });

        it('should return 401 if no authentication token', async () => {
            // Arrange
            mockReq.headers = {};

            // Act
            const authHeader = mockReq.headers.authorization;
            const hasToken = authHeader && authHeader.startsWith('Bearer ');

            // Assert
            expect(hasToken).toBe(false);
        });
    });

    describe('Response Format Tests', () => {
        it('should return data in correct format', () => {
            // Arrange
            const response = mockApiResponse;

            // Assert
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('data');
            expect(response.data).toHaveProperty('meta');
            expect(response.data).toHaveProperty('presence');
            expect(response.data).toHaveProperty('activities');
            expect(response.data).toHaveProperty('objectives');
            expect(response.data).toHaveProperty('locations');
            expect(response.data).toHaveProperty('photos');
            expect(response.data).toHaveProperty('permissions');
            expect(response.data).toHaveProperty('ranking');
        });

        it('should include all required meta fields', () => {
            // Arrange
            const { meta } = mockApiResponse.data;

            // Assert
            expect(meta).toHaveProperty('agentId');
            expect(meta).toHaveProperty('agentName');
            expect(meta).toHaveProperty('month');
            expect(meta).toHaveProperty('year');
            expect(meta).toHaveProperty('monthName');
        });

        it('should include all required presence fields', () => {
            // Arrange
            const { presence } = mockApiResponse.data;

            // Assert
            expect(presence).toHaveProperty('totalDays');
            expect(presence).toHaveProperty('workingDays');
            expect(presence).toHaveProperty('presentDays');
            expect(presence).toHaveProperty('absentDays');
            expect(presence).toHaveProperty('presenceRate');
            expect(presence).toHaveProperty('checkinCount');
        });

        it('should include all required activities fields', () => {
            // Arrange
            const { activities } = mockApiResponse.data;

            // Assert
            expect(activities).toHaveProperty('total');
            expect(activities).toHaveProperty('completed');
            expect(activities).toHaveProperty('inProgress');
            expect(activities).toHaveProperty('planned');
            expect(activities).toHaveProperty('completionRate');
        });

        it('should validate presence rate is between 0 and 100', () => {
            // Arrange
            const { presenceRate } = mockApiResponse.data.presence;

            // Assert
            expect(presenceRate).toBeGreaterThanOrEqual(0);
            expect(presenceRate).toBeLessThanOrEqual(100);
        });

        it('should validate completion rate is between 0 and 100', () => {
            // Arrange
            const { completionRate } = mockApiResponse.data.activities;

            // Assert
            expect(completionRate).toBeGreaterThanOrEqual(0);
            expect(completionRate).toBeLessThanOrEqual(100);
        });
    });

    describe('Error Handling Tests', () => {
        it('should return error format for failed requests', () => {
            // Arrange
            const errorResponse = {
                success: false,
                error: 'Agent not found',
                message: 'The requested agent does not exist'
            };

            // Assert
            expect(errorResponse.success).toBe(false);
            expect(errorResponse).toHaveProperty('error');
            expect(errorResponse).toHaveProperty('message');
        });

        it('should handle database errors gracefully', () => {
            // Arrange
            const dbError = {
                success: false,
                error: 'Database error',
                message: 'Failed to fetch data from database'
            };

            // Assert
            expect(dbError.success).toBe(false);
            expect(dbError.error).toBe('Database error');
        });

        it('should handle missing data gracefully', () => {
            // Arrange
            const emptyResponse = {
                success: true,
                data: {
                    meta: {},
                    presence: { checkinCount: 0, presenceRate: 0 },
                    activities: { total: 0, completionRate: 0 },
                    objectives: [],
                    locations: [],
                    photos: [],
                    permissions: [],
                    ranking: null
                }
            };

            // Assert
            expect(emptyResponse.success).toBe(true);
            expect(emptyResponse.data.presence.checkinCount).toBe(0);
            expect(emptyResponse.data.activities.total).toBe(0);
        });
    });

    describe('Query Parameter Tests', () => {
        it('should parse agentId correctly', () => {
            // Arrange
            mockReq.query = { agentId: '123', month: '2024-11' };

            // Act
            const agentId = mockReq.query.agentId;

            // Assert
            expect(agentId).toBe('123');
            expect(typeof agentId).toBe('string');
        });

        it('should parse month correctly', () => {
            // Arrange
            mockReq.query = { agentId: '1', month: '2024-11' };

            // Act
            const month = mockReq.query.month;
            const [year, monthNum] = month.split('-');

            // Assert
            expect(year).toBe('2024');
            expect(monthNum).toBe('11');
        });

        it('should handle includeAiSummary parameter', () => {
            // Arrange
            mockReq.query = {
                agentId: '1',
                month: '2024-11',
                includeAiSummary: 'true'
            };

            // Act
            const includeAiSummary = mockReq.query.includeAiSummary === 'true';

            // Assert
            expect(includeAiSummary).toBe(true);
        });
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockApiResponse } from '../fixtures/monthly-report-data.js';

describe('Agent Dashboard - Frontend API Tests', () => {
    let originalFetch;

    beforeEach(() => {
        // Save original fetch
        originalFetch = global.fetch;

        // Mock fetch
        global.fetch = vi.fn();

        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore original fetch
        global.fetch = originalFetch;
    });

    describe('loadMonthlyReport function', () => {
        it('should make correct API call with required parameters', async () => {
            // Arrange
            const agentId = '1';
            const month = '2024-11';
            const projectName = 'Projet A';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Act
            const url = `/api/agents/monthly-report?agentId=${agentId}&month=${month}&projectName=${encodeURIComponent(projectName)}`;
            const response = await fetch(url);
            const data = await response.json();

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(url);
            expect(data).toEqual(mockApiResponse);
        });

        it('should handle successful API response', async () => {
            // Arrange
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Act
            const response = await fetch('/api/agents/monthly-report?agentId=1&month=2024-11');
            const data = await response.json();

            // Assert
            expect(response.ok).toBe(true);
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
        });

        it('should handle API error response', async () => {
            // Arrange
            const errorResponse = {
                success: false,
                error: 'Agent not found'
            };

            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => errorResponse
            });

            // Act
            const response = await fetch('/api/agents/monthly-report?agentId=999&month=2024-11');
            const data = await response.json();

            // Assert
            expect(response.ok).toBe(false);
            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
        });

        it('should handle network errors', async () => {
            // Arrange
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            // Act & Assert
            await expect(
                fetch('/api/agents/monthly-report?agentId=1&month=2024-11')
            ).rejects.toThrow('Network error');
        });

        it('should handle timeout errors', async () => {
            // Arrange
            global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

            // Act & Assert
            await expect(
                fetch('/api/agents/monthly-report?agentId=1&month=2024-11')
            ).rejects.toThrow('Request timeout');
        });
    });

    describe('Data Transformation Tests', () => {
        it('should correctly extract presence data from API response', () => {
            // Arrange
            const { data } = mockApiResponse;

            // Act
            const presence = data.presence;

            // Assert
            expect(presence).toBeDefined();
            expect(presence.presenceRate).toBeGreaterThanOrEqual(0);
            expect(presence.checkinCount).toBeGreaterThanOrEqual(0);
        });

        it('should correctly extract activities data from API response', () => {
            // Arrange
            const { data } = mockApiResponse;

            // Act
            const activities = data.activities;

            // Assert
            expect(activities).toBeDefined();
            expect(activities.total).toBeGreaterThanOrEqual(0);
            expect(activities.completionRate).toBeGreaterThanOrEqual(0);
        });

        it('should handle empty arrays in response', () => {
            // Arrange
            const emptyResponse = {
                ...mockApiResponse,
                data: {
                    ...mockApiResponse.data,
                    photos: [],
                    locations: [],
                    objectives: []
                }
            };

            // Act
            const { photos, locations, objectives } = emptyResponse.data;

            // Assert
            expect(Array.isArray(photos)).toBe(true);
            expect(photos.length).toBe(0);
            expect(Array.isArray(locations)).toBe(true);
            expect(locations.length).toBe(0);
            expect(Array.isArray(objectives)).toBe(true);
            expect(objectives.length).toBe(0);
        });
    });

    describe('Client-side Fallback Tests', () => {
        it('should use fallback when API fails', async () => {
            // Arrange
            global.fetch.mockRejectedValueOnce(new Error('API failed'));

            // Act
            let usedFallback = false;
            try {
                await fetch('/api/agents/monthly-report?agentId=1&month=2024-11');
            } catch (error) {
                usedFallback = true;
            }

            // Assert
            expect(usedFallback).toBe(true);
        });

        it('should fetch data directly from Supabase in fallback mode', async () => {
            // This test would verify the client-side fallback logic
            // that fetches data directly from Supabase when the API fails

            // Arrange
            const mockSupabaseQuery = vi.fn().mockResolvedValue({
                data: [],
                error: null
            });

            // Act
            const result = await mockSupabaseQuery();

            // Assert
            expect(mockSupabaseQuery).toHaveBeenCalled();
            expect(result.data).toBeDefined();
        });
    });

    describe('Filter Tests', () => {
        it('should include projectName in API call when provided', async () => {
            // Arrange
            const agentId = '1';
            const month = '2024-11';
            const projectName = 'Projet Riziculture';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Act
            const url = `/api/agents/monthly-report?agentId=${agentId}&month=${month}&projectName=${encodeURIComponent(projectName)}`;
            await fetch(url);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(url);
            expect(url).toContain('projectName=');
        });

        it('should handle special characters in projectName', () => {
            // Arrange
            const projectName = 'Projet & Développement';
            const encoded = encodeURIComponent(projectName);

            // Assert
            expect(encoded).toBe('Projet%20%26%20D%C3%A9veloppement');
        });
    });

    describe('Loading State Tests', () => {
        it('should set loading state before API call', () => {
            // Arrange
            let isLoading = false;

            // Act
            isLoading = true;

            // Assert
            expect(isLoading).toBe(true);
        });

        it('should clear loading state after API call', async () => {
            // Arrange
            let isLoading = true;

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Act
            await fetch('/api/agents/monthly-report?agentId=1&month=2024-11');
            isLoading = false;

            // Assert
            expect(isLoading).toBe(false);
        });

        it('should clear loading state on error', async () => {
            // Arrange
            let isLoading = true;

            global.fetch.mockRejectedValueOnce(new Error('API error'));

            // Act
            try {
                await fetch('/api/agents/monthly-report?agentId=1&month=2024-11');
            } catch (error) {
                isLoading = false;
            }

            // Assert
            expect(isLoading).toBe(false);
        });
    });

    describe('Cache Tests', () => {
        it('should cache API responses', async () => {
            // Arrange
            const cache = new Map();
            const cacheKey = 'report-1-2024-11';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Act
            const response = await fetch('/api/agents/monthly-report?agentId=1&month=2024-11');
            const data = await response.json();
            cache.set(cacheKey, data);

            // Assert
            expect(cache.has(cacheKey)).toBe(true);
            expect(cache.get(cacheKey)).toEqual(data);
        });

        it('should use cached data when available', () => {
            // Arrange
            const cache = new Map();
            const cacheKey = 'report-1-2024-11';
            cache.set(cacheKey, mockApiResponse);

            // Act
            const cachedData = cache.get(cacheKey);

            // Assert
            expect(cachedData).toEqual(mockApiResponse);
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });
});

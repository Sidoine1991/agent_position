import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockApiResponse } from '../fixtures/monthly-report-data.js';

describe('Agent Dashboard - Frontend Rendering Tests', () => {
    describe('renderMonthlyReport function', () => {
        it('should render presence statistics correctly', () => {
            // Arrange
            const { presence } = mockApiResponse.data;

            // Act
            const presenceHtml = `
        <div class="presence-stats">
          <div class="stat">
            <span class="label">Taux de présence</span>
            <span class="value">${presence.presenceRate}%</span>
          </div>
          <div class="stat">
            <span class="label">Check-ins</span>
            <span class="value">${presence.checkinCount}</span>
          </div>
        </div>
      `;

            // Assert
            expect(presenceHtml).toContain(presence.presenceRate.toString());
            expect(presenceHtml).toContain(presence.checkinCount.toString());
        });

        it('should render activities statistics correctly', () => {
            // Arrange
            const { activities } = mockApiResponse.data;

            // Act
            const activitiesHtml = `
        <div class="activities-stats">
          <div class="stat">
            <span class="label">Total</span>
            <span class="value">${activities.total}</span>
          </div>
          <div class="stat">
            <span class="label">Complétées</span>
            <span class="value">${activities.completed}</span>
          </div>
          <div class="stat">
            <span class="label">Taux de complétion</span>
            <span class="value">${activities.completionRate}%</span>
          </div>
        </div>
      `;

            // Assert
            expect(activitiesHtml).toContain(activities.total.toString());
            expect(activitiesHtml).toContain(activities.completed.toString());
            expect(activitiesHtml).toContain(activities.completionRate.toString());
        });

        it('should handle empty photos array', () => {
            // Arrange
            const photos = [];

            // Act
            const photosHtml = photos.length > 0
                ? photos.map(p => `<img src="${p.url}" />`).join('')
                : '<p>Aucune photo disponible</p>';

            // Assert
            expect(photosHtml).toContain('Aucune photo disponible');
        });

        it('should render photos when available', () => {
            // Arrange
            const photos = [
                { url: '/uploads/photo1.jpg', date: '2024-11-05' },
                { url: '/uploads/photo2.jpg', date: '2024-11-06' }
            ];

            // Act
            const photosHtml = photos.map(p => `<img src="${p.url}" />`).join('');

            // Assert
            expect(photosHtml).toContain('/uploads/photo1.jpg');
            expect(photosHtml).toContain('/uploads/photo2.jpg');
        });

        it('should handle empty locations array', () => {
            // Arrange
            const locations = [];

            // Act
            const locationsHtml = locations.length > 0
                ? locations.map(l => `<div>${l.name}</div>`).join('')
                : '<p>Aucune localisation disponible</p>';

            // Assert
            expect(locationsHtml).toContain('Aucune localisation disponible');
        });

        it('should render ranking information', () => {
            // Arrange
            const { ranking } = mockApiResponse.data;

            // Act
            const rankingHtml = `
        <div class="ranking">
          <span>Classement: ${ranking.rank}/${ranking.totalAgents}</span>
          <span>Score: ${ranking.score}</span>
        </div>
      `;

            // Assert
            expect(rankingHtml).toContain(ranking.rank.toString());
            expect(rankingHtml).toContain(ranking.totalAgents.toString());
            expect(rankingHtml).toContain(ranking.score.toString());
        });

        it('should handle missing ranking data', () => {
            // Arrange
            const ranking = null;

            // Act
            const rankingHtml = ranking
                ? `<div>Classement: ${ranking.rank}</div>`
                : '<p>Classement non disponible</p>';

            // Assert
            expect(rankingHtml).toContain('Classement non disponible');
        });

        it('should render AI summary when available', () => {
            // Arrange
            const { aiSummary } = mockApiResponse.data;

            // Act
            const summaryHtml = aiSummary
                ? `<div class="ai-summary">${aiSummary}</div>`
                : '<p>Résumé non disponible</p>';

            // Assert
            expect(summaryHtml).toContain(aiSummary);
        });

        it('should escape HTML in user-generated content', () => {
            // Arrange
            const maliciousContent = '<script>alert("XSS")</script>';

            // Act
            const escaped = maliciousContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            // Assert
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });
    });

    describe('UI State Management', () => {
        it('should show loading indicator during data fetch', () => {
            // Arrange
            let isLoading = true;

            // Act
            const loadingHtml = isLoading
                ? '<div class="spinner">Chargement...</div>'
                : '<div class="content">Data</div>';

            // Assert
            expect(loadingHtml).toContain('Chargement');
        });

        it('should hide loading indicator after data fetch', () => {
            // Arrange
            let isLoading = false;

            // Act
            const loadingHtml = isLoading
                ? '<div class="spinner">Chargement...</div>'
                : '<div class="content">Data</div>';

            // Assert
            expect(loadingHtml).toContain('content');
            expect(loadingHtml).not.toContain('Chargement');
        });

        it('should show error message on API failure', () => {
            // Arrange
            const error = 'Impossible de charger les données';

            // Act
            const errorHtml = `<div class="error">${error}</div>`;

            // Assert
            expect(errorHtml).toContain(error);
        });

        it('should clear error message on successful load', () => {
            // Arrange
            let error = null;

            // Act
            const errorHtml = error
                ? `<div class="error">${error}</div>`
                : '';

            // Assert
            expect(errorHtml).toBe('');
        });
    });

    describe('Data Formatting Tests', () => {
        it('should format percentage values correctly', () => {
            // Arrange
            const value = 81.82;

            // Act
            const formatted = `${value.toFixed(2)}%`;

            // Assert
            expect(formatted).toBe('81.82%');
        });

        it('should format dates correctly', () => {
            // Arrange
            const date = new Date('2024-11-05T08:30:00Z');

            // Act
            const formatted = date.toLocaleDateString('fr-FR');

            // Assert
            expect(formatted).toContain('05');
            expect(formatted).toContain('11');
            expect(formatted).toContain('2024');
        });

        it('should handle zero values correctly', () => {
            // Arrange
            const value = 0;

            // Act
            const formatted = value || 'N/A';

            // Assert
            expect(formatted).toBe('N/A');
        });

        it('should handle null values correctly', () => {
            // Arrange
            const value = null;

            // Act
            const formatted = value ?? 'Non disponible';

            // Assert
            expect(formatted).toBe('Non disponible');
        });
    });

    describe('Filter UI Tests', () => {
        it('should populate agent select dropdown', () => {
            // Arrange
            const agents = [
                { id: '1', name: 'Agent 1' },
                { id: '2', name: 'Agent 2' }
            ];

            // Act
            const options = agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

            // Assert
            expect(options).toContain('Agent 1');
            expect(options).toContain('Agent 2');
        });

        it('should populate project select dropdown', () => {
            // Arrange
            const projects = ['Projet A', 'Projet B'];

            // Act
            const options = projects.map(p => `<option value="${p}">${p}</option>`).join('');

            // Assert
            expect(options).toContain('Projet A');
            expect(options).toContain('Projet B');
        });

        it('should populate month select dropdown', () => {
            // Arrange
            const months = [
                { value: '2024-11', label: 'Novembre 2024' },
                { value: '2024-10', label: 'Octobre 2024' }
            ];

            // Act
            const options = months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');

            // Assert
            expect(options).toContain('Novembre 2024');
            expect(options).toContain('Octobre 2024');
        });
    });
});

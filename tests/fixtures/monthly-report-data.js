/**
 * Test fixtures for monthly report data
 * Contains realistic data structures for testing
 */

export const sampleAgent = {
    id: '1',
    name: 'Jean Dupont',
    email: 'jean.dupont@ccrb.bj',
    role: 'agent',
    project_name: 'Projet Riziculture',
    phone: '+229 12345678'
};

export const sampleCheckins = [
    {
        id: 1,
        user_id: '1',
        created_at: '2024-11-05T08:30:00Z',
        latitude: 6.3703,
        longitude: 2.3912,
        location_name: 'Cotonou, Bénin',
        photo_url: '/uploads/checkin1.jpg',
        notes: 'Visite exploitation agricole'
    },
    {
        id: 2,
        user_id: '1',
        created_at: '2024-11-06T09:15:00Z',
        latitude: 6.4969,
        longitude: 2.6289,
        location_name: 'Porto-Novo, Bénin',
        photo_url: '/uploads/checkin2.jpg',
        notes: 'Formation des producteurs'
    },
    {
        id: 3,
        user_id: '1',
        created_at: '2024-11-07T10:00:00Z',
        latitude: 6.3703,
        longitude: 2.3912,
        location_name: 'Cotonou, Bénin',
        photo_url: null,
        notes: 'Réunion de coordination'
    }
];

export const samplePlanifications = [
    {
        id: 1,
        user_id: '1',
        date: '2024-11-05',
        activity: 'Visite exploitation',
        status: 'realise',
        planned_start_time: '08:00',
        planned_end_time: '12:00',
        location: 'Cotonou'
    },
    {
        id: 2,
        user_id: '1',
        date: '2024-11-06',
        activity: 'Formation producteurs',
        status: 'realise',
        planned_start_time: '09:00',
        planned_end_time: '17:00',
        location: 'Porto-Novo'
    },
    {
        id: 3,
        user_id: '1',
        date: '2024-11-07',
        activity: 'Réunion coordination',
        status: 'en_cours',
        planned_start_time: '10:00',
        planned_end_time: '12:00',
        location: 'Cotonou'
    },
    {
        id: 4,
        user_id: '1',
        date: '2024-11-08',
        activity: 'Suivi parcelles',
        status: 'planifie',
        planned_start_time: '08:00',
        planned_end_time: '16:00',
        location: 'Abomey-Calavi'
    }
];

export const sampleMissions = [
    {
        id: 1,
        user_id: '1',
        project_name: 'Projet Riziculture',
        zone: 'Zone Atlantique',
        start_date: '2024-11-01',
        end_date: '2024-11-30',
        objectives: 'Appui aux producteurs de riz'
    }
];

export const samplePermissions = [
    {
        id: 1,
        user_id: '1',
        start_date: '2024-11-10',
        end_date: '2024-11-12',
        reason: 'Congé annuel',
        status: 'approved',
        created_at: '2024-11-01T10:00:00Z'
    }
];

export const sampleGoals = [
    {
        id: 1,
        user_id: '1',
        title: 'Former 50 producteurs',
        description: 'Formation sur les techniques culturales',
        target: 50,
        current: 35,
        status: 'active',
        deadline: '2024-11-30'
    },
    {
        id: 2,
        user_id: '1',
        title: 'Visiter 20 exploitations',
        description: 'Suivi des parcelles rizicoles',
        target: 20,
        current: 20,
        status: 'completed',
        deadline: '2024-11-15'
    }
];

/**
 * Expected monthly report structure
 */
export const expectedMonthlyReport = {
    meta: {
        agentId: '1',
        agentName: 'Jean Dupont',
        month: 11,
        year: 2024,
        monthName: 'novembre',
        projectName: 'Projet Riziculture'
    },
    presence: {
        totalDays: 30,
        workingDays: 22,
        presentDays: 18,
        absentDays: 4,
        presenceRate: 0,
        checkinCount: 0
    },
    activities: {
        total: 0,
        completed: 0,
        inProgress: 0,
        planned: 0,
        completionRate: 0
    },
    objectives: [],
    locations: [],
    photos: [],
    permissions: [],
    ranking: {},
    aiSummary: ''
};

/**
 * Mock API response for monthly report
 */
export const mockApiResponse = {
    success: true,
    data: {
        meta: {
            agentId: '1',
            agentName: 'Jean Dupont',
            month: 11,
            year: 2024,
            monthName: 'novembre',
            projectName: 'Projet Riziculture'
        },
        presence: {
            totalDays: 30,
            workingDays: 22,
            presentDays: 18,
            absentDays: 4,
            presenceRate: 81.82,
            checkinCount: 15
        },
        activities: {
            total: 20,
            completed: 15,
            inProgress: 3,
            planned: 2,
            completionRate: 75
        },
        objectives: [],
        locations: [],
        photos: [],
        permissions: [],
        ranking: {
            rank: 3,
            totalAgents: 10,
            score: 85.5
        },
        aiSummary: 'Performance satisfaisante pour le mois de novembre.'
    }
};

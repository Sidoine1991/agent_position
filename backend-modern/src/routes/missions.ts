import express from 'express';
import { MissionController } from '../controllers/missionController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../utils/validation';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Create mission
router.post('/', 
  validateRequest((req) => {
    const { title, description } = req.body;
    const errors: string[] = [];
    
    if (!title || !description) {
      errors.push('Title and description are required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }),
  MissionController.createMission
);

// Get all missions (with filters)
router.get('/', MissionController.getAllMissions);

// Get my missions
router.get('/my', MissionController.getMyMissions);

// Get mission by ID
router.get('/:id', MissionController.getMissionById);

// Update mission
router.put('/:id', 
  validateRequest((req) => {
    const { status } = req.body;
    const errors: string[] = [];
    
    if (status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      errors.push('Status must be pending, in_progress, completed, or cancelled');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }),
  MissionController.updateMission
);

// Delete mission
router.delete('/:id', MissionController.deleteMission);

export default router;

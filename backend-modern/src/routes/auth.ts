import express from 'express';
import { AuthController } from '../controllers/authController';
import { validateLoginRequest, validateRegisterRequest } from '../utils/validation';

const router = express.Router();

// Login
router.post('/login', validateLoginRequest, AuthController.login);

// Register
router.post('/register', validateRegisterRequest, AuthController.register);

// Logout
router.post('/logout', AuthController.logout);

// Refresh token
router.post('/refresh', AuthController.refreshToken);

export default router;

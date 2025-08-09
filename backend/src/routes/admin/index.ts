import { Router } from 'express';
import oneSignalRoutes from './onesignal';

const router = Router();

// Mount admin routes
router.use('/onesignal', oneSignalRoutes);

export default router;
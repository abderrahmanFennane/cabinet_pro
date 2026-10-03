import { Router } from 'express';
import { authenticate, requireCabinetAccess } from '../../middleware/auth';
import patientsRoutes from './patients.routes';
import medicalRoutes from './medical.routes';
import dentalRoutes from './dental.routes';
import attachmentsRoutes from './attachments.routes';
import recordsRoutes from './records.routes';
import appointmentsRoutes from './appointments.routes';
import actsRoutes, { billingRouter } from './billing.routes';
import workspaceRoutes from './workspace.routes';

// Every cabinet data route: /api/cabinets/:cabinetId/...
const router = Router({ mergeParams: true });
router.use(authenticate, requireCabinetAccess);

router.use('/patients/:patientId/dental', dentalRoutes);
router.use('/patients/:patientId/attachments', attachmentsRoutes);
router.use('/patients/:patientId/records', recordsRoutes);
router.use('/patients/:patientId', medicalRoutes);
router.use('/patients', patientsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/billing', billingRouter);
router.use('/', actsRoutes);
router.use('/', workspaceRoutes);

export default router;

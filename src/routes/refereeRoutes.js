const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAssignedRaces,
  getHorsesForRace,
  createViolation,
  getViolations,
  resolveViolation,
  confirmResult,
  createReport,
  getReport,
  getConfirmedResult,
} = require('../controllers/refereeController');

const router = express.Router();

// All referee routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Referee
 *   description: Referee management endpoints (REFEREE / ADMIN)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /referee/races
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races:
 *   get:
 *     summary: Danh sách cuộc đua được phân công
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned races
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *                   scheduledAt:
 *                     type: string
 *                     format: date-time
 *                   tournamentId:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/races', authorize('REFEREE'), getAssignedRaces);

// ─────────────────────────────────────────────────────────────────────────────
// GET /referee/races/:raceId/horses
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/horses:
 *   get:
 *     summary: Kiểm tra thông tin ngựa trước đua
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID
 *     responses:
 *       200:
 *         description: List of approved horses for the race
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 raceName:
 *                   type: string
 *                 horses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       registrationId:
 *                         type: string
 *                       registrationStatus:
 *                         type: string
 *                       horse:
 *                         type: object
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race not found
 */
router.get('/races/:raceId/horses', authorize('REFEREE'), getHorsesForRace);

// ─────────────────────────────────────────────────────────────────────────────
// POST /referee/races/:raceId/violations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/violations:
 *   post:
 *     summary: Ghi nhận vi phạm trong đua
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - horseId
 *               - jockeyId
 *               - type
 *               - description
 *               - penalty
 *             properties:
 *               horseId:
 *                 type: string
 *                 example: "665f1a2b3c4d5e6f7a8b9c0d"
 *               jockeyId:
 *                 type: string
 *                 example: "665f1a2b3c4d5e6f7a8b9c0e"
 *               type:
 *                 type: string
 *                 enum: [FALSE_START, INTERFERENCE, OVERWEIGHT, DOPING, OTHER]
 *                 example: FALSE_START
 *               description:
 *                 type: string
 *                 example: "Ngựa xuất phát sớm 0.3 giây"
 *               penalty:
 *                 type: string
 *                 enum: [WARNING, DISQUALIFY, FINE]
 *                 example: WARNING
 *               fineAmount:
 *                 type: number
 *                 example: 5000000
 *     responses:
 *       201:
 *         description: Violation recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 violationId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: OPEN
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race or horse not found
 */
router.post('/races/:raceId/violations', authorize('REFEREE'), createViolation);

// ─────────────────────────────────────────────────────────────────────────────
// GET /referee/races/:raceId/violations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/violations:
 *   get:
 *     summary: Xem danh sách vi phạm
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of violations for the race
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 raceName:
 *                   type: string
 *                 violations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       description:
 *                         type: string
 *                       penalty:
 *                         type: string
 *                       fineAmount:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [OPEN, RESOLVED]
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race not found
 */
router.get('/races/:raceId/violations', authorize('REFEREE', 'ADMIN'), getViolations);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /referee/violations/:vId/resolve
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/violations/{vId}/resolve:
 *   patch:
 *     summary: Xử lý / đóng vi phạm
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vId
 *         required: true
 *         schema:
 *           type: string
 *         description: Violation ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolutionNote:
 *                 type: string
 *                 example: "Vi phạm đã được xem xét và xử lý"
 *     responses:
 *       200:
 *         description: Violation resolved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 violationId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: RESOLVED
 *                 resolvedAt:
 *                   type: string
 *                   format: date-time
 *                 resolutionNote:
 *                   type: string
 *       400:
 *         description: Already resolved
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Violation not found
 */
router.patch('/violations/:vId/resolve', authorize('REFEREE'), resolveViolation);

// ─────────────────────────────────────────────────────────────────────────────
// POST /referee/races/:raceId/confirm-result
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/confirm-result:
 *   post:
 *     summary: Xác nhận kết quả cuộc đua
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rankings
 *             properties:
 *               rankings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - position
 *                     - horseId
 *                     - jockeyId
 *                     - finishTime
 *                   properties:
 *                     position:
 *                       type: integer
 *                       example: 1
 *                     horseId:
 *                       type: string
 *                       example: "665f1a2b3c4d5e6f7a8b9c0d"
 *                     jockeyId:
 *                       type: string
 *                       example: "665f1a2b3c4d5e6f7a8b9c0e"
 *                     finishTime:
 *                       type: string
 *                       example: "1:12.345"
 *               notes:
 *                 type: string
 *                 example: "Cuộc đua diễn ra bình thường"
 *     responses:
 *       200:
 *         description: Race result confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: RESULT_CONFIRMED
 *                 confirmedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: RACE_NOT_FINISHED or missing rankings
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race not found
 *       409:
 *         description: OPEN_VIOLATIONS_EXIST
 */
router.post('/races/:raceId/confirm-result', authorize('REFEREE'), confirmResult);
router.get('/races/:raceId/confirmed-result', authorize('REFEREE'), getConfirmedResult);

// ─────────────────────────────────────────────────────────────────────────────
// POST /referee/races/:raceId/report
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/report:
 *   post:
 *     summary: Lập biên bản thi đấu
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               summary:
 *                 type: string
 *                 example: "Cuộc đua diễn ra suôn sẻ"
 *               weatherCondition:
 *                 type: string
 *                 example: "Nắng nhẹ, gió nhẹ"
 *               trackCondition:
 *                 type: string
 *                 example: "Khô ráo, tốt"
 *               incidentDetails:
 *                 type: string
 *                 example: "Ngựa số 3 bị cảnh cáo xuất phát sớm"
 *               additionalNotes:
 *                 type: string
 *                 example: "Không có sự cố nghiêm trọng"
 *     responses:
 *       201:
 *         description: Report created or updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reportId:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race not found
 */
router.post('/races/:raceId/report', authorize('REFEREE'), createReport);

// ─────────────────────────────────────────────────────────────────────────────
// GET /referee/races/:raceId/report
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /referee/races/{raceId}/report:
 *   get:
 *     summary: Xem biên bản thi đấu
 *     tags: [Referee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Race report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 refereeId:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                 summary:
 *                   type: string
 *                 weatherCondition:
 *                   type: string
 *                 trackCondition:
 *                   type: string
 *                 totalParticipants:
 *                   type: integer
 *                 totalViolations:
 *                   type: integer
 *                 incidentDetails:
 *                   type: string
 *                 additionalNotes:
 *                   type: string
 *       403:
 *         description: Not assigned to this race
 *       404:
 *         description: Race or report not found
 */
router.get('/races/:raceId/report', authorize('REFEREE', 'ADMIN'), getReport);

module.exports = router;

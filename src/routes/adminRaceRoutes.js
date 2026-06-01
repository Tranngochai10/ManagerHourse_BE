const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createRace,
  updateRace,
  assignReferee,
  getRaceRegistrations,
  approveRaceRegistration,
  rejectRaceRegistration,
} = require("../controllers/adminRaceController");

const router = express.Router();

// All admin race routes require authentication + ADMIN role
router.use(protect, authorize("ADMIN"));

/**
 * @swagger
 * tags:
 *   name: Admin - Races
 *   description: Race management (ADMIN only)
 */

/**
 * @swagger
 * /admin/races:
 *   post:
 *     summary: Create a new race within a tournament
 *     tags: [Admin - Races]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tournamentId
 *               - name
 *               - distance
 *               - scheduledAt
 *               - maxHorses
 *             properties:
 *               tournamentId:
 *                 type: string
 *                 example: "665f1a2b3c4d5e6f7a8b9c0d"
 *               name:
 *                 type: string
 *                 example: "Vòng 1 — Nội dung 1200m"
 *               distance:
 *                 type: integer
 *                 description: Distance in meters
 *                 example: 1200
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-03-01T08:00:00Z"
 *               maxHorses:
 *                 type: integer
 *                 example: 12
 *               prizeFirst:
 *                 type: number
 *                 example: 100000000
 *               prizeSecond:
 *                 type: number
 *                 example: 50000000
 *               prizeThird:
 *                 type: number
 *                 example: 25000000
 *     responses:
 *       201:
 *         description: Race created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: SCHEDULED
 *       400:
 *         description: Validation error or invalid date
 *       404:
 *         description: Tournament not found
 */
router.post("/", createRace);

/**
 * @swagger
 * /admin/races/{raceId}:
 *   put:
 *     summary: Update a race
 *     tags: [Admin - Races]
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
 *               name:
 *                 type: string
 *               distance:
 *                 type: integer
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               maxHorses:
 *                 type: integer
 *               prizeFirst:
 *                 type: number
 *               prizeSecond:
 *                 type: number
 *               prizeThird:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Updated race
 *       400:
 *         description: Validation error
 *       404:
 *         description: Race not found
 */
router.put("/:raceId", updateRace);

/**
 * @swagger
 * /admin/races/{raceId}/assign-referee:
 *   post:
 *     summary: Assign a referee to a race
 *     tags: [Admin - Races]
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
 *               - refereeId
 *             properties:
 *               refereeId:
 *                 type: string
 *                 description: User ID of the referee (must have REFEREE role)
 *                 example: "665f1a2b3c4d5e6f7a8b9c0d"
 *     responses:
 *       200:
 *         description: Referee assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 raceId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 refereeId:
 *                   type: string
 *                 refereeName:
 *                   type: string
 *       400:
 *         description: User is not a REFEREE or refereeId missing
 *       404:
 *         description: Race or User not found
 */
router.post("/:raceId/assign-referee", assignReferee);

/**
 * @swagger
 * /admin/races/registrations:
 *   get:
 *     summary: Get all race registrations with optional filtering
 *     tags: [Admin - Races]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: raceId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by race ID
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, CONFIRMED]
 *         description: Filter by registration status
 *     responses:
 *       200:
 *         description: List of race registrations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 registrations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       regId:
 *                         type: string
 *                       horseId:
 *                         type: string
 *                       horseName:
 *                         type: string
 *                       raceId:
 *                         type: string
 *                       raceName:
 *                         type: string
 *                       status:
 *                         type: string
 *                         example: PENDING_APPROVAL
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Query error
 */
router.get("/registrations", getRaceRegistrations);

/**
 * @swagger
 * /admin/races/registrations/{regId}/approve:
 *   patch:
 *     summary: Approve a pending race registration
 *     tags: [Admin - Races]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: regId
 *         required: true
 *         schema:
 *           type: string
 *         description: Registration ID
 *     responses:
 *       200:
 *         description: Registration approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 regId:
 *                   type: string
 *                 horseId:
 *                   type: string
 *                 horseName:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 raceName:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: APPROVED
 *                 message:
 *                   type: string
 *       400:
 *         description: Registration not in PENDING_APPROVAL status
 *       404:
 *         description: Registration not found
 */
router.patch("/registrations/:regId/approve", approveRaceRegistration);

/**
 * @swagger
 * /admin/races/registrations/{regId}/reject:
 *   patch:
 *     summary: Reject a pending race registration
 *     tags: [Admin - Races]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: regId
 *         required: true
 *         schema:
 *           type: string
 *         description: Registration ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *                 example: "Horse does not meet weight requirements"
 *     responses:
 *       200:
 *         description: Registration rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 regId:
 *                   type: string
 *                 horseId:
 *                   type: string
 *                 horseName:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 raceName:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: REJECTED
 *                 rejectionReason:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Registration not in PENDING_APPROVAL status
 *       404:
 *         description: Registration not found
 */
router.patch("/registrations/:regId/reject", rejectRaceRegistration);

module.exports = router;

const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getMySchedule,
  getRaceSchedule,
  getTournamentSchedule,
  confirmRaceParticipation,
  withdrawFromRace,
  getJockeyRaces,
  getJockeyRaceDetail,
  getScheduleDetail,
  createSchedule,
} = require("../controllers/scheduleController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Schedule
 *   description: Race schedule management
 */

/**
 * @swagger
 * /me/schedule:
 *   get:
 *     summary: Get my schedule
 *     tags: [Schedule]
 *     description: Get the race schedule for the current user (OWNER or JOCKEY)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/me/schedule", protect, getMySchedule);

/**
 * @swagger
 * /races/{raceId}/schedule:
 *   get:
 *     summary: Get race schedule
 *     tags: [Schedule]
 *     description: Get detailed schedule information for a specific race (Public)
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Server error
 */
router.get("/races/:raceId/schedule", getRaceSchedule);

/**
 * @swagger
 * /tournaments/{tournamentId}/schedule:
 *   get:
 *     summary: Get tournament schedule
 *     tags: [Schedule]
 *     description: Get full schedule for a tournament (Public)
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
 *     responses:
 *       200:
 *         description: Tournament schedule retrieved successfully
 *       404:
 *         description: No schedules found for this tournament
 *       500:
 *         description: Server error
 */
router.get("/tournaments/:tournamentId/schedule", getTournamentSchedule);

/**
 * @swagger
 * /me/horses/{horseId}/races/{raceId}/confirm:
 *   patch:
 *     summary: Confirm race participation
 *     tags: [Schedule]
 *     description: Owner confirms horse participation in a race
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Race participation confirmed
 *       403:
 *         description: Horse does not belong to you
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/me/horses/:horseId/races/:raceId/confirm",
  protect,
  authorize("OWNER"),
  confirmRaceParticipation,
);

/**
 * @swagger
 * /me/horses/{horseId}/races/{raceId}/withdraw:
 *   patch:
 *     summary: Withdraw from race
 *     tags: [Schedule]
 *     description: Owner withdraws horse from a race
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Horse withdrawn from race
 *       400:
 *         description: Cannot withdraw from ongoing/completed race
 *       403:
 *         description: Horse does not belong to you
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/me/horses/:horseId/races/:raceId/withdraw",
  protect,
  authorize("OWNER"),
  withdrawFromRace,
);

/**
 * @swagger
 * /jockeys/me/races:
 *   get:
 *     summary: Get my races
 *     tags: [Schedule]
 *     description: Get list of races assigned to the jockey
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jockey races retrieved successfully
 *       404:
 *         description: Jockey not found
 *       500:
 *         description: Server error
 */
router.get("/jockeys/me/races", protect, authorize("JOCKEY"), getJockeyRaces);

/**
 * @swagger
 * /jockeys/me/races/{raceId}:
 *   get:
 *     summary: Get race detail for jockey
 *     tags: [Schedule]
 *     description: Get detailed information about a race assigned to the jockey
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
 *         description: Race detail retrieved successfully
 *       404:
 *         description: Race or jockey not found
 *       500:
 *         description: Server error
 */
router.get(
  "/jockeys/me/races/:raceId",
  protect,
  authorize("JOCKEY"),
  getJockeyRaceDetail,
);

/**
 * @swagger
 * /schedules/{scheduleId}:
 *   get:
 *     summary: Get schedule detail
 *     tags: [Schedule]
 *     description: Get detailed information about a schedule
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Server error
 */
router.get("/schedules/:scheduleId", getScheduleDetail);

/**
 * @swagger
 * /schedules:
 *   post:
 *     summary: Create schedule
 *     tags: [Schedule]
 *     description: Create a new race schedule (Admin/Referee only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - raceId
 *               - tournamentId
 *               - raceName
 *               - scheduledTime
 *               - location
 *               - distance
 *               - raceType
 *               - maxParticipants
 *             properties:
 *               raceId:
 *                 type: string
 *               tournamentId:
 *                 type: string
 *               raceName:
 *                 type: string
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               distance:
 *                 type: number
 *               raceType:
 *                 type: string
 *                 enum: [SPRINT, LONG_DISTANCE, HANDICAP, STEEPLECHASE]
 *               maxParticipants:
 *                 type: number
 *               prizePool:
 *                 type: number
 *               trackCondition:
 *                 type: string
 *                 enum: [GOOD, YIELDING, SOFT, HEAVY]
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/schedules",
  protect,
  authorize("ADMIN", "REFEREE"),
  createSchedule,
);

module.exports = router;

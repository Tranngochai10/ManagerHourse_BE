const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getResultsByRace,
  publishRaceResult,
  getHorseResults,
  getJockeyResults,
  getHorsePrize,
  getTournamentLeaderboard,
  getJockeyLeaderboard,
} = require("../controllers/resultController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Results & Ranking
 *   description: Race results and leaderboard endpoints
 */

/**
 * @swagger
 * /races/{raceId}/results:
 *   get:
 *     summary: Get all results for a race
 *     tags: [Results & Ranking]
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID
 *     responses:
 *       200:
 *         description: List of race results
 *       404:
 *         description: Race not found
 */
router.get("/races/:raceId", getResultsByRace);

/**
 * @swagger
 * /admin/races/{raceId}/publish-result:
 *   post:
 *     summary: Admin publishes race results
 *     tags: [Results & Ranking]
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
 *             properties:
 *               results:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     horseId:
 *                       type: string
 *                     jockeyId:
 *                       type: string
 *                     position:
 *                       type: number
 *                     finishTime:
 *                       type: number
 *                       description: Finish time in seconds (optional)
 *                     status:
 *                       type: string
 *                       enum: [FINISHED, DISQUALIFIED, DNF]
 *                     prizeAmount:
 *                       type: number
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Race results published successfully
 *       400:
 *         description: Invalid input or horse not registered
 *       403:
 *         description: Not authorized (ADMIN required)
 *       404:
 *         description: Race not found
 */
router.post(
  "/admin/races/:raceId/publish",
  protect,
  authorize("ADMIN"),
  publishRaceResult,
);

/**
 * @swagger
 * /horses/me/{horseId}/results:
 *   get:
 *     summary: Get all results for a specific horse
 *     tags: [Results & Ranking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Horse results with statistics
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Horse not found
 */
router.get("/horses/me/:horseId", protect, authorize("OWNER"), getHorseResults);

/**
 * @swagger
 * /jockeys/me/results:
 *   get:
 *     summary: Get all results for a jockey
 *     tags: [Results & Ranking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jockey results with statistics
 */
router.get("/jockeys/me", protect, authorize("JOCKEY"), getJockeyResults);

/**
 * @swagger
 * /horses/me/{horseId}/prize:
 *   get:
 *     summary: Get total prize earnings for a horse
 *     tags: [Results & Ranking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prize information with history
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Horse not found
 */
router.get(
  "/horses/me/:horseId/prize",
  protect,
  authorize("OWNER"),
  getHorsePrize,
);

/**
 * @swagger
 * /tournaments/{tournId}/leaderboard:
 *   get:
 *     summary: Get tournament leaderboard
 *     tags: [Results & Ranking]
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated tournament leaderboard
 */
router.get("/tournaments/:tournId/leaderboard", getTournamentLeaderboard);

/**
 * @swagger
 * /jockeys/leaderboard:
 *   get:
 *     summary: Get overall jockey leaderboard
 *     tags: [Results & Ranking]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated jockey leaderboard
 */
router.get("/jockeys/leaderboard", getJockeyLeaderboard);

module.exports = router;

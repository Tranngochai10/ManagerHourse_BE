const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  checkRaceOpen,
  placePrediction,
  getMyPredictions,
  getPredictionDetails,
  getNotifications,
  markNotificationRead,
  closePredictions,
  settlePredictions,
  getAllPredictions,
  getPredictionStats,
} = require("../controllers/predictionController");


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Prediction (Dự đoán kết quả)
 *   description: Betting and prediction endpoints
 */

/**
 * @swagger
 * /races/{raceId}/predictions/open:
 *   get:
 *     summary: Check if race is still open for predictions
 *     tags: [Prediction (Dự đoán kết quả)]
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Race ID
 *     responses:
 *       200:
 *         description: Race open status
 *       404:
 *         description: Race not found
 */
router.get("/races/:raceId/predictions/open", checkRaceOpen);

/**
 * @swagger
 * /races/{raceId}/predictions:
 *   post:
 *     summary: Spectator places a prediction (bet)
 *     tags: [Prediction (Dự đoán kết quả)]
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
 *               horseId:
 *                 type: string
 *                 description: Horse ID to predict
 *               betAmount:
 *                 type: number
 *                 description: Bet amount (100,000 - 10,000,000 VND)
 *             required:
 *               - horseId
 *               - betAmount
 *     responses:
 *       201:
 *         description: Prediction placed successfully
 *       400:
 *         description: Invalid bet amount or horse not registered
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Race or horse not found
 *       409:
 *         description: Already have a prediction for this race
 */
router.post(
  "/races/:raceId/predictions",
  protect,
  authorize("SPECTATOR"),
  placePrediction,
);

/**
 * @swagger
 * /me/predictions:
 *   get:
 *     summary: Get all my predictions
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, CLOSED, WON, LOST]
 *     responses:
 *       200:
 *         description: List of my predictions
 */
router.get(
  "/me/predictions",
  protect,
  authorize("SPECTATOR"),
  getMyPredictions,
);

/**
 * @swagger
 * /me/predictions/{predId}:
 *   get:
 *     summary: Get prediction details and result
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: predId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prediction details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Prediction not found
 */
router.get(
  "/me/predictions/:predId",
  protect,
  authorize("SPECTATOR"),
  getPredictionDetails,
);

/**
 * @swagger
 * /me/notifications:
 *   get:
 *     summary: Get notifications about predictions
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
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
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get(
  "/me/notifications",
  protect,
  authorize("SPECTATOR"),
  getNotifications,
);

/**
 * @swagger
 * /me/notifications/{notifId}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notifId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.patch(
  "/me/notifications/:notifId/read",
  protect,
  authorize("SPECTATOR"),
  markNotificationRead,
);

/**
 * @swagger
 * /admin/races/{raceId}/predictions/close:
 *   post:
 *     summary: Admin closes predictions for a race (before race starts)
 *     tags: [Prediction (Dự đoán kết quả)]
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
 *         description: Predictions closed successfully
 *       403:
 *         description: Not authorized (ADMIN required)
 *       404:
 *         description: Race not found
 */
router.post(
  "/admin/races/:raceId/predictions/close",
  protect,
  authorize("ADMIN"),
  closePredictions,
);

/**
 * @swagger
 * /admin/races/{raceId}/predictions/settle:
 *   post:
 *     summary: Admin settles predictions (after race result published)
 *     tags: [Prediction (Dự đoán kết quả)]
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
 *         description: Predictions settled and notifications sent
 *       400:
 *         description: No results found for this race
 *       403:
 *         description: Not authorized (ADMIN required)
 */
router.post(
  "/admin/races/:raceId/predictions/settle",
  protect,
  authorize("ADMIN"),
  settlePredictions,
);

/**
 * @swagger
 * /admin/predictions:
 *   get:
 *     summary: Admin manages all predictions
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: raceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, CLOSED, WON, LOST]
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
 *         description: List of all predictions
 *       403:
 *         description: Not authorized (ADMIN required)
 */
router.get(
  "/admin/predictions",
  protect,
  authorize("ADMIN"),
  getAllPredictions,
);

/**
 * @swagger
 * /admin/predictions/stats:
 *   get:
 *     summary: Admin gets prediction statistics by race
 *     tags: [Prediction (Dự đoán kết quả)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: raceId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prediction statistics
 *       403:
 *         description: Not authorized (ADMIN required)
 */
router.get(
  "/admin/predictions/stats",
  protect,
  authorize("ADMIN"),
  getPredictionStats,
);

module.exports = router;

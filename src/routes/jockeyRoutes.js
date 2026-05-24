const express = require("express");
const router = express.Router();
const jockeyController = require("../controllers/jockeyController");
const { protect, authorize } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Jockeys
 *   description: Jockey management
 */

/**
 * @swagger
 * /jockeys/me:
 *   get:
 *     summary: Get my jockey profile
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jockey profile
 *       404:
 *         description: Jockey profile not found
 */
router.get("/me", protect, authorize("JOCKEY"), jockeyController.getMyProfile);

/**
 * @swagger
 * /jockeys/me:
 *   put:
 *     summary: Update my jockey profile
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *               experience:
 *                 type: number
 *               bio:
 *                 type: string
 *               image:
 *                 type: string
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated profile
 *       404:
 *         description: Jockey profile not found
 */
router.put(
  "/me",
  protect,
  authorize("JOCKEY"),
  jockeyController.updateMyProfile,
);

/**
 * @swagger
 * /jockeys/me/invitations:
 *   get:
 *     summary: Get my invitations
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (PENDING, ACCEPTED, REJECTED)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of invitations
 *       404:
 *         description: Jockey profile not found
 */
router.get(
  "/me/invitations",
  protect,
  authorize("JOCKEY"),
  jockeyController.getMyInvitations,
);

/**
 * @swagger
 * /jockeys/me/invitations/{invId}/accept:
 *   patch:
 *     summary: Accept an invitation
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       400:
 *         description: Invitation expired or not pending
 *       404:
 *         description: Invitation not found
 */
router.patch(
  "/me/invitations/:invId/accept",
  protect,
  authorize("JOCKEY"),
  jockeyController.acceptInvitation,
);

/**
 * @swagger
 * /jockeys/me/invitations/{invId}/reject:
 *   patch:
 *     summary: Reject an invitation
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation rejected
 *       400:
 *         description: Invitation is not pending
 *       404:
 *         description: Invitation not found
 */
router.patch(
  "/me/invitations/:invId/reject",
  protect,
  authorize("JOCKEY"),
  jockeyController.rejectInvitation,
);

/**
 * @swagger
 * /jockeys/{jockeyId}:
 *   get:
 *     summary: Get jockey public profile
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jockeyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Jockey public profile
 *       404:
 *         description: Jockey not found
 */
router.get("/:jockeyId", protect, jockeyController.getJockeyById);

/**
 * @swagger
 * /jockeys:
 *   get:
 *     summary: List all available jockeys (for OWNER to hire)
 *     tags: [Jockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of jockeys with pagination
 */
router.get("/", protect, authorize("OWNER"), jockeyController.listJockeys);

module.exports = router;

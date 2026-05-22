const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllHorses,
  approveHorse,
  rejectHorse,
} = require("../controllers/adminHorseController");
const { adminGetJockeys } = require("../controllers/jockeyController");

const router = express.Router();

router.use(protect);
router.use(authorize("ADMIN"));

/**
 * @swagger
 * tags:
 *   name: AdminHorses
 *   description: Horse management for admins
 */

/**
 * @swagger
 * /admin/horses:
 *   get:
 *     summary: Get all horses (Admin)
 *     tags: [AdminHorses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by horse name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: breed
 *         schema:
 *           type: string
 *         description: Filter by breed
 *     responses:
 *       200:
 *         description: List of horses
 */
router.get("/", getAllHorses);

/**
 * @swagger
 * /admin/horses/{horseId}/approve:
 *   patch:
 *     summary: Approve a horse
 *     tags: [AdminHorses]
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
 *         description: Horse approved
 */
router.patch("/:horseId/approve", approveHorse);

/**
 * @swagger
 * /admin/horses/{horseId}/reject:
 *   patch:
 *     summary: Reject a horse
 *     tags: [AdminHorses]
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
 *         description: Horse rejected
 */
router.patch("/:horseId/reject", rejectHorse);

/**
 * @swagger
 * /admin/jockeys:
 *   get:
 *     summary: Get all jockeys (Admin)
 *     tags: [AdminJockeys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of jockeys
 */
router.get("/jockeys", adminGetJockeys);

module.exports = router;

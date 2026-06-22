const Invitation = require("../models/Invitation");
const RaceRegistration = require("../models/RaceRegistration");
const Race = require("../models/Race");
const Schedule = require("../models/Schedule");

let lastCheckTime = 0;
const CHECK_INTERVAL = 60 * 1000; // 1 phút chạy tối đa 1 lần để bảo vệ hiệu năng

const checkExpiredInvitationsAndFallback = async () => {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL) {
    return;
  }
  lastCheckTime = now;

  try {
    const currentDate = new Date();
    const nearThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ tới

    // 1. Tìm các lời mời (Invitation) PENDING đã quá hạn (expiresAt < now)
    const expiredInvitations = await Invitation.find({
      status: "PENDING",
      expiresAt: { $lt: currentDate },
    });

    if (expiredInvitations.length === 0) return;

    for (const invitation of expiredInvitations) {
      // Lấy thông tin trận đua để kiểm tra thời gian diễn ra
      const race = await Race.findById(invitation.raceId);
      if (!race) continue;

      // Kiểm tra xem trận đua đã gần tới giờ đua chưa (trong vòng 24 giờ tới hoặc đã quá giờ đua)
      if (race.scheduledAt <= nearThreshold) {
        // Cập nhật trạng thái Invitation thành CANCELLED do hết hạn và cận kề giờ đua
        invitation.status = "CANCELLED";
        invitation.updatedAt = new Date();
        await invitation.save();

        // 2. Tìm và hủy RaceRegistration tương ứng (Chuyển thành REJECTED)
        const registration = await RaceRegistration.findOne({
          horseId: invitation.horseId,
          raceId: invitation.raceId,
          status: { $in: ["PENDING_APPROVAL", "APPROVED"] },
        });

        if (registration) {
          registration.status = "REJECTED";
          registration.rejectionReason = "Invitation expired and race scheduled time is near";
          await registration.save();
        }

        // 3. Cập nhật Schedule tương ứng của trận đua
        const schedule = await Schedule.findOne({ raceId: invitation.raceId });
        if (schedule) {
          const horseIndex = schedule.registeredHorses.findIndex(
            (h) => h.horseId.toString() === invitation.horseId.toString()
          );
          if (horseIndex !== -1) {
            schedule.registeredHorses[horseIndex].status = "WITHDRAWN";
            await schedule.save();
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking expired invitations and fallback:", error);
  }
};

module.exports = checkExpiredInvitationsAndFallback;

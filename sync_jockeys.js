require('dotenv').config();
const connectDB = require('./src/config/db');
const Invitation = require('./src/models/Invitation');
const Schedule = require('./src/models/Schedule');

const sync = async () => {
  await connectDB();
  console.log('Fetching all ACCEPTED invitations...');
  const invitations = await Invitation.find({ status: 'ACCEPTED' });
  console.log(`Found ${invitations.length} accepted invitations.`);

  let syncCount = 0;
  for (const invitation of invitations) {
    const schedule = await Schedule.findOne({ raceId: invitation.raceId });
    if (schedule) {
      const horseIndex = schedule.registeredHorses.findIndex(
        (h) => h.horseId.toString() === invitation.horseId.toString()
      );
      if (horseIndex !== -1) {
        // Only update if jockeyId is not already set
        if (!schedule.registeredHorses[horseIndex].jockeyId || schedule.registeredHorses[horseIndex].jockeyId.toString() !== invitation.jockeyId.toString()) {
          schedule.registeredHorses[horseIndex].jockeyId = invitation.jockeyId;
          await schedule.save();
          console.log(`Synced jockeyId ${invitation.jockeyId} for horse ${invitation.horseId} in race ${invitation.raceId}`);
          syncCount++;
        }
      }
    }
  }
  console.log(`Sync completed. Updated ${syncCount} schedules.`);
  process.exit(0);
};

sync().catch(err => {
  console.error(err);
  process.exit(1);
});

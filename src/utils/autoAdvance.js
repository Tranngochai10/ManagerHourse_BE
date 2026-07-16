const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const Result = require('../models/Result');
const RaceResult = require('../models/RaceResult');
const RaceRegistration = require('../models/RaceRegistration');
const Schedule = require('../models/Schedule');
const { balanceHeats, fastestLoser } = require('./tournamentAlgo');
const ProgressionRule = require('../models/ProgressionRule');

/**
 * Check if the current round is fully completed, and if so, 
 * automatically generate the next round (Semifinals / Finals).
 */
async function checkAndAdvanceRound(tournamentId, currentRaceId) {
  try {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament || !tournament.bracket || !tournament.bracket.rounds) {
      return; // No valid bracket
    }

    const rounds = tournament.bracket.rounds;
    if (rounds.length === 0) return;

    // Find the round that contains this race
    let currentRoundIndex = -1;
    for (let i = 0; i < rounds.length; i++) {
      const raceInRound = rounds[i].races && rounds[i].races.find(r => r.raceId && r.raceId.toString() === currentRaceId.toString());
      if (raceInRound) {
        currentRoundIndex = i;
        break;
      }
    }

    if (currentRoundIndex === -1) {
      return; // Race not found in bracket
    }

    const currentRound = rounds[currentRoundIndex];
    const raceIdsInRound = currentRound.races.map(r => r.raceId).filter(Boolean);

    // Check statuses of all races in this round
    const races = await Race.find({ _id: { $in: raceIdsInRound } });
    const allCompleted = races.every(r => r.status === 'COMPLETED' || r.status === 'RESULT_CONFIRMED');

    if (!allCompleted) {
      return; // Not all races are finished yet, do nothing.
    }

    // If it's already a single race round (Final), mark tournament as COMPLETED
    if (races.length <= 1) {
      if (tournament.status !== 'COMPLETED') {
        tournament.status = 'COMPLETED';
        await tournament.save();
      }
      return;
    }

    // --- Proceed to Auto Advance ---
    const nextRoundNumber = currentRound.roundNumber + 1;
    
    // Check if next round already populated (not placeholder)
    const nextRound = rounds.find(r => r.roundNumber === nextRoundNumber);
    if (nextRound && nextRound.races && nextRound.races.some(r => r.raceId !== null)) {
      return;  // Vòng tiếp theo đã được khởi tạo race rồi
    }

    const currentRacesCount = races.length;
    const nextRacesCount = Math.ceil(currentRacesCount / 2); // E.g., 4 -> 2, 3 -> 2, 2 -> 1
    const isFinal = nextRacesCount === 1;
    const roundName = isFinal ? 'Final' : (nextRacesCount === 2 ? 'Semifinal' : `Round ${nextRoundNumber}`);
    
    // Determine max per heat from the first race of current round
    const maxPerHeat = races[0].maxHorses || 10;
    
    // Look up progression rule for the current round
    const rule = await ProgressionRule.findOne({
      tournamentId: tournament._id,
      fromRound: currentRound.roundNumber
    });

    let guaranteed;
    let missingSlots;
    if (rule) {
      guaranteed = rule.directQualifiersPerHeat;
      missingSlots = rule.wildcardsCount;
    } else {
      // Fallback to original calculation
      const totalSlots = nextRacesCount * maxPerHeat;
      guaranteed = Math.floor(totalSlots / currentRacesCount);
      if (guaranteed > maxPerHeat) guaranteed = maxPerHeat;
      missingSlots = totalSlots - (guaranteed * currentRacesCount);
      if (missingSlots < 0) missingSlots = 0;
    }

    // Fetch all results for current round races with horse ownerId and name populated
    const allResultsData = [];
    
    for (const raceId of raceIdsInRound) {
      // First check for RaceResult (referee confirmed)
      let raceResult = await RaceResult.findOne({ raceId })
        .populate('rankings.horseId', 'name ownerId');
      
      if (raceResult && raceResult.rankings) {
        raceResult.rankings.forEach(r => {
          allResultsData.push({
            raceId: raceId,
            horseId: r.horseId,
            jockeyId: r.jockeyId,
            position: r.position,
            finishTime: r.finishTime,
            status: 'FINISHED'
          });
        });
      } else {
        // Fallback to Result model
        const results = await Result.find({ raceId, status: 'FINISHED' })
          .populate('horseId', 'name ownerId');
        allResultsData.push(...results);
      }
    }
    
    // Now, group by raceId to process per race
    const resultsByRaceId = {};
    allResultsData.forEach(res => {
      const rid = res.raceId.toString();
      if (!resultsByRaceId[rid]) resultsByRaceId[rid] = [];
      resultsByRaceId[rid].push(res);
    });
    
    const directQualifiers = [];
    const losersList = [];
    
    // Process per race
    for (const rid in resultsByRaceId) {
      const raceResults = resultsByRaceId[rid].sort((a, b) => a.position - b.position);
      
      // Take guaranteed number from each race
      for (let i = 0; i < raceResults.length; i++) {
        if (i < guaranteed) {
          directQualifiers.push(raceResults[i]);
        } else {
          losersList.push(raceResults[i]);
        }
      }
    }
    
    // Process wildcards
    const wildcards = fastestLoser(losersList, missingSlots);
    const advancingResults = [...directQualifiers, ...wildcards];
    
    if (advancingResults.length === 0) {
      console.warn(`[AutoAdvance] No advancing horses found for tournament ${tournamentId}`);
      return;
    }

    // Map to format suitable for balanceHeats
    const mappedHorses = advancingResults.map(res => ({
      horseId: res.horseId._id || res.horseId,
      ownerId: res.horseId.ownerId,
      name: res.horseId.name,
      seed: null
    }));

    const heats = balanceHeats(mappedHorses, maxPerHeat, 'RANDOM');

    const roundNameVietnamese = nextRacesCount === 1 ? 'Chung kết' : (nextRacesCount === 2 ? 'Bán kết' : 'Vòng loại');

    // Create next round races
    let baseTime = new Date();
    // Default to +2 hours from now if no specific schedule, or just use next day
    baseTime.setHours(baseTime.getHours() + 2); 

    let racesCreatedCount = 0;
    const nextRoundMatches = [];

    for (let i = 0; i < heats.length; i++) {
      const heatHorses = heats[i];
      const scheduledTime = new Date(baseTime.getTime() + (i * 30 * 60 * 1000));
      
      // Attempt to reuse pre-generated pending race
      let newRace = await Race.findOne({
        tournamentId: tournament._id,
        name: `${tournament.name} - ${roundNameVietnamese} - Heat ${i + 1}`
      });

      if (newRace) {
        newRace.scheduledAt = scheduledTime;
        newRace.status = 'PENDING';
        await newRace.save();
      } else {
        newRace = new Race({
          tournamentId: tournament._id,
          name: `${tournament.name} - ${roundNameVietnamese} - Heat ${i + 1}`,
          distance: races[0].distance, // Keep same distance
          scheduledAt: scheduledTime,
          maxHorses: maxPerHeat,
          status: 'PENDING',
          createdBy: races[0].createdBy,
        });
        await newRace.save();
      }
      racesCreatedCount++;

      // ✅ Cập nhật bracket với raceId mới
      const nextRoundInBracket = tournament.bracket.rounds[currentRoundIndex + 1];
      if (nextRoundInBracket && nextRoundInBracket.races) {
        if (nextRoundInBracket.races[i]) {
          nextRoundInBracket.races[i].raceId = newRace._id;
          nextRoundInBracket.races[i].name = newRace.name;
        }
      }

      const registeredScheduleHorses = [];

      for (const item of heatHorses) {
        const reg = new RaceRegistration({
          horseId: item.horse.horseId,
          raceId: newRace._id,
          status: 'APPROVED',
          startingGate: item.startingGate,
        });
        await reg.save();

        registeredScheduleHorses.push({
          horseId: item.horse.horseId,
          ownerId: item.horse.ownerId,
          status: 'CONFIRMED',
        });
      }

      const schedule = new Schedule({
        raceId: newRace._id,
        tournamentId: tournament._id,
        raceName: newRace.name,
        scheduledTime,
        location: tournament.venue,
        distance: newRace.distance,
        maxParticipants: maxPerHeat,
        raceType: 'SPRINT',
        registeredHorses: registeredScheduleHorses,
      });
      await schedule.save();
    }

    // ✅ Update bracket - Đã update ở phía tạo race, giờ just ensure saves
    tournament.markModified('bracket');
    tournament.currentRound = nextRoundNumber;
    
    await tournament.save();
    
    console.log(`[AutoAdvance] Successfully generated ${roundName} for tournament ${tournamentId}`);
    
  } catch (error) {
    console.error('[AutoAdvance] Error generating next round:', error);
  }
}

module.exports = {
  checkAndAdvanceRound
};

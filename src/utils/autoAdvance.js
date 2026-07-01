const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const Result = require('../models/Result');
const RaceRegistration = require('../models/RaceRegistration');
const Schedule = require('../models/Schedule');
const { balanceHeats, fastestLoser } = require('./tournamentAlgo');

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
      const match = rounds[i].matches.find(m => m.raceId && m.raceId.toString() === currentRaceId.toString());
      if (match) {
        currentRoundIndex = i;
        break;
      }
    }

    if (currentRoundIndex === -1) {
      return; // Race not found in bracket
    }

    const currentRound = rounds[currentRoundIndex];
    const raceIdsInRound = currentRound.matches.map(m => m.raceId).filter(Boolean);

    // Check statuses of all races in this round
    const races = await Race.find({ _id: { $in: raceIdsInRound } });
    const allCompleted = races.every(r => r.status === 'COMPLETED');

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
    
    // Check if next round already generated (just in case)
    if (rounds.some(r => r.roundNumber === nextRoundNumber)) {
      return; 
    }

    const currentRacesCount = races.length;
    const nextRacesCount = Math.ceil(currentRacesCount / 2); // E.g., 4 -> 2, 3 -> 2, 2 -> 1
    const isFinal = nextRacesCount === 1;
    const roundName = isFinal ? 'Final' : (nextRacesCount === 2 ? 'Semifinal' : `Round ${nextRoundNumber}`);
    
    // Determine max per heat from the first race of current round
    const maxPerHeat = races[0].maxHorses || 10;
    
    const totalSlots = nextRacesCount * maxPerHeat;
    let guaranteed = Math.floor(totalSlots / currentRacesCount);
    
    // Safety check: if guaranteed > maxPerHeat, cap it
    if (guaranteed > maxPerHeat) guaranteed = maxPerHeat;
    
    let missingSlots = totalSlots - (guaranteed * currentRacesCount);
    if (missingSlots < 0) missingSlots = 0;

    // Fetch all results for current round races
    const allResults = await Result.find({ raceId: { $in: raceIdsInRound }, status: 'FINISHED' })
      .populate('horseId', 'ownerId');

    const directQualifiers = [];
    const losersList = [];

    // Separate into qualifiers and losers
    allResults.forEach(res => {
      if (res.position <= guaranteed) {
        directQualifiers.push(res);
      } else {
        losersList.push(res);
      }
    });

    const wildcards = fastestLoser(losersList, missingSlots);
    const advancingResults = [...directQualifiers, ...wildcards];

    if (advancingResults.length === 0) {
      console.warn(`[AutoAdvance] No advancing horses found for tournament ${tournamentId}`);
      return;
    }

    // Map to format suitable for balanceHeats
    const mappedHorses = advancingResults.map(res => ({
      horseId: res.horseId._id,
      ownerId: res.horseId.ownerId,
      seed: null
    }));

    const heats = balanceHeats(mappedHorses, maxPerHeat, 'RANDOM');

    // Create next round races
    let baseTime = new Date();
    // Default to +2 hours from now if no specific schedule, or just use next day
    baseTime.setHours(baseTime.getHours() + 2); 

    let racesCreatedCount = 0;
    const nextRoundMatches = [];

    for (let i = 0; i < heats.length; i++) {
      const heatHorses = heats[i];
      const scheduledTime = new Date(baseTime.getTime() + (i * 30 * 60 * 1000));
      
      const newRace = new Race({
        tournamentId: tournament._id,
        name: `${tournament.name} - ${roundName} - Heat ${i + 1}`,
        distance: races[0].distance, // Keep same distance
        scheduledAt: scheduledTime,
        maxHorses: maxPerHeat,
        status: 'PENDING',
        createdBy: races[0].createdBy,
      });
      await newRace.save();
      racesCreatedCount++;

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

      nextRoundMatches.push({
        matchNumber: i + 1,
        raceId: newRace._id,
        isBye: false,
        scheduledAt: scheduledTime.toISOString(),
        bracketPosition: `${nextRoundNumber}-${i + 1}`,
        heatSize: heatHorses.length
      });
    }

    // Update bracket
    tournament.bracket.rounds.push({
      roundNumber: nextRoundNumber,
      roundName: roundName,
      matches: nextRoundMatches
    });
    
    // Mark mixed type array as modified for mongoose
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

const Horse = require('../models/Horse');
const RaceRegistration = require('../models/RaceRegistration');

exports.createHorse = async (req, res) => {
  try {
    const { name, breed, age, weight, color, gender, origin, healthCertUrl } = req.body;

    const horse = new Horse({
      name,
      breed,
      age,
      weight,
      color,
      gender,
      origin,
      healthCertUrl,
      ownerId: req.user._id,
      status: 'PENDING'
    });

    await horse.save();

    res.status(201).json({
      horseId: horse._id,
      name: horse.name,
      status: horse.status,
      ownerId: horse.ownerId,
      createdAt: horse.createdAt
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getMyHorses = async (req, res) => {
  try {
    const horses = await Horse.find({ ownerId: req.user._id });
    res.status(200).json(horses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHorseById = async (req, res) => {
  try {
    const horse = await Horse.findById(req.params.horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    // OWNER can only see their own horse. ADMIN and REFEREE can see any.
    if (req.user.role === 'OWNER' && horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this horse' });
    }

    res.status(200).json(horse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHorse = async (req, res) => {
  try {
    const horse = await Horse.findById(req.params.horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this horse' });
    }

    // Update fields
    const { name, breed, age, weight, color, gender, origin, healthCertUrl } = req.body;
    if (name) horse.name = name;
    if (breed) horse.breed = breed;
    if (age) horse.age = age;
    if (weight) horse.weight = weight;
    if (color) horse.color = color;
    if (gender) horse.gender = gender;
    if (origin) horse.origin = origin;
    if (healthCertUrl) horse.healthCertUrl = healthCertUrl;

    const updatedHorse = await horse.save();
    res.status(200).json(updatedHorse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteHorse = async (req, res) => {
  try {
    const horse = await Horse.findById(req.params.horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this horse' });
    }

    // Check if horse has any race registrations
    const registrations = await RaceRegistration.find({ horseId: horse._id });
    if (registrations.length > 0) {
      return res.status(400).json({ message: 'Cannot delete horse that has been registered for a race' });
    }

    await Horse.deleteOne({ _id: horse._id });
    res.status(200).json({ message: 'Horse deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerHorseForRace = async (req, res) => {
  try {
    const { raceId } = req.body;
    const { horseId } = req.params;

    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to register this horse' });
    }

    // Check if already registered for this race
    const existingRegistration = await RaceRegistration.findOne({ horseId, raceId });
    if (existingRegistration) {
      return res.status(409).json({ message: 'HORSE_ALREADY_REGISTERED' });
    }

    const registration = new RaceRegistration({
      horseId,
      raceId,
      status: 'PENDING_APPROVAL'
    });

    await registration.save();

    res.status(201).json({
      registrationId: registration._id,
      horseId: registration.horseId,
      raceId: registration.raceId,
      status: registration.status
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

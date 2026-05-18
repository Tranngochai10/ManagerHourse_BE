const Horse = require('../models/Horse');

exports.getAllHorses = async (req, res) => {
  try {
    const { search, status, breed } = req.query;
    
    let query = {};
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (status) {
      query.status = status;
    }
    if (breed) {
      query.breed = breed;
    }

    const horses = await Horse.find(query).populate('ownerId', 'fullName email');
    res.status(200).json(horses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveHorse = async (req, res) => {
  try {
    const horse = await Horse.findByIdAndUpdate(
      req.params.horseId,
      { status: 'APPROVED' },
      { new: true }
    );

    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    res.status(200).json(horse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectHorse = async (req, res) => {
  try {
    const horse = await Horse.findByIdAndUpdate(
      req.params.horseId,
      { status: 'REJECTED' },
      { new: true }
    );

    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }

    res.status(200).json(horse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Chia bảng cân bằng (Balance Heats)
 * @param {Array} horses - Mảng các ngựa (ví dụ id hoặc object ngựa)
 * @param {Number} maxPerHeat - Số ngựa tối đa mỗi bảng
 * @param {String} pairingMethod - Phương pháp chia bảng ('RANDOM' hoặc 'SEEDED')
 * @returns {Array} - Mảng các heats, mỗi heat chứa mảng các ngựa kèm theo startingGate
 */
function balanceHeats(horses, maxPerHeat, pairingMethod = 'RANDOM') {
  if (!horses || horses.length === 0) return [];
  if (maxPerHeat <= 0) throw new Error('maxPerHeat must be greater than 0');

  const totalHorses = horses.length;
  const numHeats = Math.ceil(totalHorses / maxPerHeat);
  
  // Tính toán số lượng ngựa cho từng heat để cân bằng nhất có thể
  const baseCount = Math.floor(totalHorses / numHeats);
  const remainder = totalHorses % numHeats;
  
  const heatSizes = [];
  for (let i = 0; i < numHeats; i++) {
    heatSizes.push(baseCount + (i < remainder ? 1 : 0));
  }
  
  // Clone mảng horses để không ảnh hưởng mảng gốc
  let sortedHorses = [...horses];
  
  if (pairingMethod === 'SEEDED') {
    // Giả sử các ngựa đã được sort theo seed từ trước, hoặc sort tại đây
    sortedHorses.sort((a, b) => {
      const seedA = a.seed != null ? a.seed : Infinity;
      const seedB = b.seed != null ? b.seed : Infinity;
      return seedA - seedB;
    });
  } else {
    // RANDOM
    sortedHorses.sort(() => Math.random() - 0.5);
  }

  // Tạo các heats
  const heats = Array.from({ length: numHeats }, () => []);
  
  if (pairingMethod === 'SEEDED') {
    // Rải đều các hạt giống vào các heats theo snake pattern
    for (let i = 0; i < sortedHorses.length; i++) {
      const round = Math.floor(i / numHeats);
      let heatIndex;
      if (round % 2 === 0) {
        heatIndex = i % numHeats;
      } else {
        heatIndex = numHeats - 1 - (i % numHeats);
      }
      heats[heatIndex].push(sortedHorses[i]);
    }
  } else {
    // RANDOM thì cứ lấy theo mảng đã shuffle và cắt theo heatSizes
    let currentIndex = 0;
    for (let i = 0; i < numHeats; i++) {
      const size = heatSizes[i];
      heats[i] = sortedHorses.slice(currentIndex, currentIndex + size);
      currentIndex += size;
    }
  }

  // Randomize starting_gate cho từng ngựa trong từng heat
  return heats.map(heatHorses => {
    // Tạo mảng gate [1, 2, ..., size]
    const gates = Array.from({ length: heatHorses.length }, (_, i) => i + 1);
    // Shuffle gates
    gates.sort(() => Math.random() - 0.5);
    
    return heatHorses.map((horse, index) => ({
      horse,
      startingGate: gates[index]
    }));
  });
}

/**
 * Vé Vớt (Fastest Loser)
 * Lấy các ngựa không lọt vào top chính thức, sắp xếp theo thời gian và chọn ra số lượng cần thiết
 * @param {Array} losersList - Mảng các kết quả (Result) của các ngựa không đậu chính thức
 * @param {Number} missingSlots - Số lượng slot còn thiếu cho vòng tiếp theo
 * @returns {Array} - Mảng các ngựa (kèm kết quả) được chọn vé vớt
 */
function fastestLoser(losersList, missingSlots) {
  if (!losersList || losersList.length === 0 || missingSlots <= 0) return [];

  // Lọc ra các con hoàn thành cuộc đua (có finishTime)
  const validLosers = losersList.filter(
    (loser) => loser.finishTime != null && loser.status === 'FINISHED'
  );

  // Sắp xếp theo finishTime tăng dần (thời gian nhỏ nhất là nhanh nhất)
  validLosers.sort((a, b) => a.finishTime - b.finishTime);

  // Lấy ra đúng số lượng còn thiếu
  return validLosers.slice(0, missingSlots);
}

module.exports = {
  balanceHeats,
  fastestLoser,
};

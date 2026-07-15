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
  
  // Clone mảng horses để không ảnh hưởng mảng gốc
  let sortedHorses = [...horses];
  
  if (pairingMethod === 'SEEDED') {
    // Tách nhóm có seed và không có seed
    const seeded = sortedHorses.filter(h => h.seed != null);
    const unseeded = sortedHorses.filter(h => h.seed == null);
    
    // Sắp xếp seeded tăng dần theo seed (seed 1 là mạnh nhất)
    seeded.sort((a, b) => a.seed - b.seed);
    
    // Shuffle nhóm không có seed bằng Fisher-Yates
    for (let i = unseeded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
    }
    
    sortedHorses = [...seeded, ...unseeded];
  } else {
    // RANDOM: Shuffle toàn bộ danh sách bằng Fisher-Yates
    for (let i = sortedHorses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sortedHorses[i], sortedHorses[j]] = [sortedHorses[j], sortedHorses[i]];
    }
  }

  // Rải ngựa lần lượt vào các bảng A, B, C theo chiều tiến rồi quay đầu lùi (Snake Draft)
  const heats = Array.from({ length: numHeats }, () => []);
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

  // Tạo startingGate ngẫu nhiên cho các ngựa trong từng heat
  return heats.map(heatHorses => {
    const gates = Array.from({ length: heatHorses.length }, (_, i) => i + 1);
    
    // Fisher-Yates shuffle cho starting gates
    for (let i = gates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gates[i], gates[j]] = [gates[j], gates[i]];
    }
    
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

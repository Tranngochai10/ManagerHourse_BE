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
 * Helper to convert finish time string (like "1:12.345" or number) to total seconds
 */
function finishTimeToSeconds(time) {
  if (typeof time === 'number') return time;
  if (typeof time !== 'string') return Infinity;
  
  // Parse format like "mm:ss.xxx" or "ss.xxx"
  const parts = time.split(':');
  let minutes = 0;
  let secondsPart = time;
  
  if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    secondsPart = parts[1];
  }
  
  const seconds = parseFloat(secondsPart);
  if (isNaN(minutes) || isNaN(seconds)) return Infinity;
  
  return minutes * 60 + seconds;
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
  validLosers.sort((a, b) => {
    const timeA = finishTimeToSeconds(a.finishTime);
    const timeB = finishTimeToSeconds(b.finishTime);
    return timeA - timeB;
  });

  // Lấy ra đúng số lượng còn thiếu
  return validLosers.slice(0, missingSlots);
}

/**
 * Tính toán động số ngựa đi tiếp mỗi bảng (Dynamic Advancement)
 * @param {Number} totalHorses - Tổng số ngựa tham gia vòng này
 * @param {Number} maxPerHeat  - Số ngựa tối đa mỗi bảng đua (MAX_HORSES_PER_RACE)
 * @returns {{ heats: Number, directTop: Number, wildcards: Number }}
 *   heats      - Số bảng đấu cần tạo
 *   directTop  - Số ngựa đi thẳng chính thức từ mỗi bảng
 *   wildcards  - Số "fastest losers" cần lấy bù để đủ 1 vòng đua tiếp theo
 *
 * Ví dụ: N=20, MAX=8
 *   heats = ceil(20/8) = 3
 *   directTop = floor(8/3) = 2  → 3 heats × 2 = 6 ngựa đi thẳng
 *   wildcards = 8 - 6 = 2       → lấy thêm 2 fastest losers
 *   Tổng vào Round 2 = 8 (= MAX, lấp đầy đúng 1 chung kết)
 */
function computeAdvancement(totalHorses, maxPerHeat) {
  if (totalHorses <= 0 || maxPerHeat <= 0) {
    return { heats: 0, directTop: 0, wildcards: 0 };
  }

  const heats = Math.ceil(totalHorses / maxPerHeat);

  // Nếu chỉ có 1 bảng → đã là chung kết, không cần tính advancement
  if (heats === 1) {
    return { heats: 1, directTop: totalHorses, wildcards: 0 };
  }

  const directTop = Math.floor(maxPerHeat / heats);
  const directTotal = directTop * heats;
  const wildcards = maxPerHeat - directTotal;

  return { heats, directTop, wildcards };
}

module.exports = {
  balanceHeats,
  fastestLoser,
  computeAdvancement,
};

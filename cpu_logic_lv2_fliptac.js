// サイズごとの評価テーブルをキャッシュ
let boardValuesCache = {}; 

// 位置評価テーブルを動的に生成する関数
function generateBoardValues(size) {
    if (boardValuesCache[size]) {
        return boardValuesCache[size];
    }
    const values = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = (size - 1) / 2;
    let maxValue = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const dist = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
            values[r][c] = Math.round(10 * (center - dist));
            if (values[r][c] > maxValue) maxValue = values[r][c];
        }
    }
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            values[r][c] = Math.max(0, values[r][c] + Math.abs(maxValue-20));
        }
    }
    boardValuesCache[size] = values;
    return values;
}

/**
 * CPUの最善手を探すメイン関数
 * @param {Function} isValidMove - main.jsから渡される有効手判定関数
 * @param {Function} count_valid_moves - main.jsから渡される有効手数カウント関数
 */
export function cpu_logic_lv2(board, cpuMark, opponentMark, last_move, size, isValidMove, count_valid_moves) {
    const boardValues = generateBoardValues(size);
    
    const validMoves = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === null && isValidMove(cpuMark, r, c)) {
                validMoves.push([r, c]);
            }
        }
    }

    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0];

    let bestMove = null;
    let maxScore = -Infinity;

    for (const move of validMoves) {
        const [r, c] = move;

        // --- シミュレーション開始 ---
        board[r][c] = cpuMark;
        const originalLastMoveForCpu = last_move[cpuMark];
        last_move[cpuMark] = move;

        const positionalValue = boardValues[r][c];
        const opponentMoveCount = count_valid_moves(opponentMark);
        const myNextMoveCount = count_valid_moves(cpuMark);

        const score = (positionalValue * 3) - (opponentMoveCount * 5) + (myNextMoveCount * 4);

        if (score > maxScore) {
            maxScore = score;
            bestMove = move;
        }

        // --- 盤面と状態を元に戻す ---
        board[r][c] = null;
        last_move[cpuMark] = originalLastMoveForCpu;
    }

    return bestMove || validMoves[Math.floor(Math.random() * validMoves.length)];
}
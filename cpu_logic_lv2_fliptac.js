/**
 * FlipTac CPU Logic - Advanced Version
 *
 * このファイルは、FlipTacのCPUの挙動を改善するための新しい思考ルーチンです。
 * 1. 位置の価値（中央に近いほど高評価）
 * 2. 相手の次の手の数（少ないほど高評価）
 * 3. 自分の次の手の数（多いほど高評価）
 * これら3つの要素を組み合わせて、総合的に最善手を選択します。
 */
// ... 既存のコード ...
function generateBoardValues(size) {
    if (boardValuesCache[size]) {
        return boardValuesCache[size];
    }

    const values = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = (size - 1) / 2;
    let maxValue = 0;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // 中心からの距離の逆数を価値とする（単純な例）
            const dist = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
            values[r][c] = Math.round(10 * (center - dist));
            if (values[r][c] > maxValue) maxValue = values[r][c];
        }
    }
    
    // 中央が最も価値が高くなるように正規化
     for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
             values[r][c] = Math.max(0, values[r][c] + Math.abs(maxValue-20));
        }
     }


    boardValuesCache[size] = values;
    return values;
}


/**
 * CPUの最善手を探すメイン関数（`shortest`関数の進化版）
 * @param {Array<Array<number>>} board - 現在の盤面の状態
 * @param {string} cpuMark - CPUのマーク (例: 'X')
 * @param {string} opponentMark - 相手のマーク (例: 'O')
 * @param {Object} last_move - 全プレイヤーの最後の動き
 * @param {number} size - 盤面のサイズ
 * @param {Function} isValidMove - main.jsから渡される有効手判定関数
 * @param {Function} count_valid_moves - main.jsから渡される有効手数カウント関数
 * @returns {Array<number> | null} 最善手 [row, col] または null
 */


export function cpu_move_lv2
(board, cpuMark, opponentMark, last_move, size) {
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
        const originalLastMove = { ...last_move };
        last_move[cpuMark] = move;

        // 1. 位置的な価値
        const positionalValue = boardValues[r][c];

        // 2. 相手の次の手の数（少ないほど良い）
        const opponentMoveCount = count_valid_moves(opponentMark);

        // 3. 自分の次の手の数（多いほど良い）
        const myNextMoveCount = count_valid_moves(cpuMark);

        // --- スコア計算 ---
        // 各要素の重要度に応じて重み付けを行う
        const score = (positionalValue * 3)    // 位置の価値 (重み3)
                    - (opponentMoveCount * 5)  // 相手の選択肢の数 (重み5, 少ない方が良いのでマイナス)
                    + (myNextMoveCount * 4);   // 自分の選択肢の数 (重み4)

        if (score > maxScore) {
            maxScore = score;
            bestMove = move;
        }

        // --- シミュレーション終了（盤面と状態を元に戻す）---
        board[r][c] = null;
        last_move[cpuMark] = originalLastMove[cpuMark];
        // ---
    }

    // もし最善手が見つからなければ、安全策としてランダムな手を選ぶ
    return bestMove || validMoves[Math.floor(Math.random() * validMoves.length)];
}



// --- ゲーム設定 ---
const n = 4;      // プレイ人数 (1: CPU戦)
const size = 7;   // 盤面の大きさ

// --- グローバル変数 ---
const boardElement = document.getElementById('game-board');
let board = [];
const marks = ["X", "O", "Δ", "#"];
let invalid_marks = [];
let current_player_idx = 0;
let last_move = { "X": null, "O": null, "Δ": null, "#": null };
let cpu_move_count = 0;

// --- オーディオ設定 ---
const bgm = new Audio('BGM.mp3');
bgm.loop = true;
const winSound = new Audio('win.mp3');

/**
 * ゲームの初期化処理
 */
function initializeGame() {
    document.body.addEventListener('click', () => bgm.play(), { once: true });
    
    if (n <= 3) invalid_marks.push("#");
    if (n <= 2) invalid_marks.push("Δ");
    
    board = Array(size).fill(null).map(() => Array(size).fill(null));
    
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => button_click(r, c));
            boardElement.appendChild(cell);
        }
    }
    
    updateBoard();

    if (n === 1) {
        current_player_idx = 0; // CPU('X')から開始
        setTimeout(cpu_move, 500);
    }
}

/**
 * 盤面の見た目を更新する
 */
function updateBoard() {
    const currentPlayer = marks[current_player_idx];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = boardElement.children[r * size + c];
            const piece = board[r][c];
            
            cell.className = 'cell';
            cell.textContent = piece || '';

            if (piece) {
                let className = piece === '#' ? 'hash' : piece;
                cell.classList.add(className);
            } else if (isValidMove(currentPlayer, r, c)) {
                if (n === 1 && currentPlayer === 'X') continue;
                cell.classList.add('valid-move');
            }
        }
    }
    for (const player in last_move) {
        if (last_move[player]) {
            const [lr, lc] = last_move[player];
            const cell = boardElement.children[lr * size + lc];
            if (cell.textContent === player) {
                let className = player === '#' ? 'hash' : player;
                cell.classList.add(`last-${className}`);
            }
        }
    }
}

/**
 * ボタンがクリックされた時の処理
 */
function button_click(row, col) {
    if (n === 1 && marks[current_player_idx] === 'X') return; // CPUのターンは操作不可

    const player = marks[current_player_idx];
    if (board[row][col] === null && isValidMove(player, row, col)) {
        board[row][col] = player;
        last_move[player] = [row, col];
        
        switch_player();
        updateBoard();
        settle();

        // 勝利判定でゲームが終わっていなければ、CPUのターンを呼び出す
        let activePlayers = marks.filter(m => !invalid_marks.includes(m));
        if (n === 1 && marks[current_player_idx] === 'X' && activePlayers.length > 1) {
            setTimeout(cpu_move, 500);
        }
    }
}

/**
 * CPUの移動
 */
function cpu_move() {
    let bestMove;
    const cpuMark = "X";

    if (cpu_move_count < 3) {
        const empty_tiles = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === null && isValidMove(cpuMark, r, c)) {
                    empty_tiles.push([r, c]);
                }
            }
        }
        if(empty_tiles.length > 0){
             bestMove = empty_tiles[Math.floor(Math.random() * empty_tiles.length)];
        }
    } else {
        bestMove = shortest();
    }

    if (bestMove) {
        const [row, col] = bestMove;
        board[row][col] = cpuMark;
        last_move[cpuMark] = [row, col];
        cpu_move_count++;
        
        switch_player();
        updateBoard();
        settle();
    }
}

/**
 * プレイヤーの切り替え関数
 */
function switch_player() {
    let activePlayerCount = marks.filter(m => !invalid_marks.includes(m)).length;
    if (activePlayerCount <= 1) return;

    do {
        current_player_idx = (current_player_idx + 1) % marks.length;
    } while (invalid_marks.includes(marks[current_player_idx]));
}

/**
 * 移動チェック (Python版のロジックを忠実に再現)
 */
function isValidMove(player, row, col) {
    const last_pos = last_move[player];

    if (last_pos === null) {
        // Python版には元々、設置先が空かどうかのチェックがないが、button_click側でチェックする
        return row === 0 || row === size - 1 || col === 0 || col === size - 1;
    }

    const [lr, lc] = last_pos;

    // 隣接移動
    if (Math.abs(lr - row) <= 1 && Math.abs(lc - col) <= 1) {
        return board[row][col] === null;
    }

    // 飛び越え移動
    if (lr === row) { // 同じ行
        if (Math.abs(lc - col) === 2 && !([null, player].includes(board[row][(lc + col) / 2]))) {
            return board[row][col] === null;
        }
    } else if (lc === col) { // 同じ列
        if (Math.abs(lr - row) === 2 && !([null, player].includes(board[(lr + row) / 2][col]))) {
            return board[row][col] === null;
        }
    }

    return false;
}

/**
 * 詰み判定
 */
function check_no_moves(player) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === null && isValidMove(player, r, c)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * 勝利判定
 */
function settle() {
    let activePlayers = marks.filter(m => !invalid_marks.includes(m));
    if (activePlayers.length <= 1) return;

    if (check_no_moves(marks[current_player_idx])) {
        invalid_marks.push(marks[current_player_idx]);
        
        activePlayers = marks.filter(m => !invalid_marks.includes(m));
        if (activePlayers.length === 1) {
            displayWinner(activePlayers[0]);
        } else {
            switch_player();
            updateBoard();
            settle(); // 再帰呼び出し
        }
    }
}

/**
 * 最短距離の手を計算する関数
 */
function shortest() {
    const cpuMark = 'X';
    const opponentMark = 'O';
    const validMoves = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === null && isValidMove(cpuMark, r, c)) {
                validMoves.push([r, c]);
            }
        }
    }
    if (validMoves.length === 0) return null;

    let move_counts = [];
    for (const move of validMoves) {
        const [r, c] = move;
        board[r][c] = cpuMark;
        const original_last_move = last_move[cpuMark];
        last_move[cpuMark] = move;
        const opponentMoveCount = count_valid_moves(opponentMark);
        move_counts.push({ count: opponentMoveCount, move: move });
        board[r][c] = null;
        last_move[cpuMark] = original_last_move;
    }

    const minMoves = Math.min(...move_counts.map(mc => mc.count));
    const bestMoves = move_counts.filter(mc => mc.count === minMoves).map(mc => mc.move);
    if (bestMoves.length === 1) return bestMoves[0];
    
    let bestMoveShortest = null;
    let min_dist = Infinity;
    const last_opponent_move = last_move[opponentMark];
    if (!last_opponent_move) return bestMoves[0];

    for (const move of bestMoves) {
        const [r, c] = move;
        const dist = Math.pow(last_opponent_move[0] - r, 2) + Math.pow(last_opponent_move[1] - c, 2);
        if (dist < min_dist) {
            min_dist = dist;
            bestMoveShortest = move;
        }
    }
    return bestMoveShortest;
}

/**
 * 有効手の数を数える関数
 */
function count_valid_moves(player) {
    let count = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === null && isValidMove(player, r, c)) {
                count++;
            }
        }
    }
    return count;
}

/**
 * 勝利画面
 */
function displayWinner(winner) {
    bgm.pause();
    winSound.play();
    const winnerDisplay = document.getElementById('winner-display');
    const winnerText = winnerDisplay.querySelector('.winner-text');
    winnerText.textContent = `${winner} wins!`;
    winnerDisplay.classList.remove('hidden');
}

// --- ゲーム開始 ---
initializeGame();
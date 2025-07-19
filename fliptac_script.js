// --- ゲーム設定 ---
const n = 2; // プレイ人数 (1: CPU戦, 2: 2人対戦, 3: 3人対戦)
const size = 5; // 盤面の大きさ
const darkmode = 1; // 1で有効 (CSSで実装済み)

// --- グローバル変数 ---
const boardElement = document.getElementById('game-board');
let board = []; // 盤面の状態を管理する2次元配列
const marks = ["X", "O", "Δ", "#"];
let invalid_marks = [];
let current_player_idx = 0;
let last_move = { "X": null, "O": null, "Δ": null, "#": null };

// --- オーディオ設定 ---
const bgm = new Audio('BGM.mp3');
bgm.loop = true;
const winSound = new Audio('win.mp3');



/**
 * プレイヤーを交代する関数。
 * 敗退したプレイヤーはスキップします。
 */
function switch_player() {
    current_player_idx = (current_player_idx + 1) % marks.length;
    // invalid_marksに現在のプレイヤーが含まれている限りループ
    while (invalid_marks.includes(marks[current_player_idx])) {
        current_player_idx = (current_player_idx + 1) % marks.length;
    }
}

/**
 * 指定されたプレイヤーが配置できるマスがあるかチェックする関数。
 * @param {string} player - チェック対象のプレイヤーマーク ("X", "O"など)
 * @returns {boolean} - 配置できるマスがなければtrue、あればfalseを返す。
 */
function check_no_moves(player) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // 空きマス かつ 有効な移動先か
            if (board[r][c] === null && isValidMove(player, r, c)) {
                return false; // 配置できるマスが見つかった
            }
        }
    }
    return true; // 配置できるマスが一つもなかった
}

/**
 * 決着を判定する関数。
 * 現在のプレイヤーが動けなくなったら、そのプレイヤーを敗退させます。
 * 残り一人のプレイヤーになったら、そのプレイヤーを勝者とします。
 */
function settle() {
    // 現在のプレイヤーが動けるかチェック
    if (check_no_moves(marks[current_player_idx])) {
        // 動けない場合、敗退者リストに追加
        invalid_marks.push(marks[current_player_idx]);

        // 残りプレイヤーが1人になったかチェック
        // (nは総プレイヤー数)
        if (invalid_marks.length >= n - 1) {
            switch_player(); // 最後まで残ったプレイヤーを探す
            const winner = marks[current_player_idx];
            displayWinner(winner);
        } else {
            // ゲーム続行
            switch_player();
            updateBoard();
            // 次のプレイヤーも動けない可能性があるため、再帰的にsettleを呼び出す
            settle();
        }
    }
}

/**
 * 勝利画面を表示する関数。
 * @param {string} winner - 勝者のマーク
 */
function displayWinner(winner) {
    const winnerDisplay = document.getElementById('winner-display');
    const winnerText = winnerDisplay.querySelector('.winner-text');
    
    // BGMを停止し、勝利サウンドを再生
    bgm.pause();
    winSound.play();
    
    // 勝者名を表示して、画面をフェードイン
    winnerText.textContent = `${winner} wins!`;
    winnerDisplay.classList.remove('hidden');
}



// 例: is_valid_move 関数の移植
function isValidMove(player, row, col) {
    const last_pos = last_move[player];

    if (board[row][col] !== null) return false;

    if (last_pos === null) {
        return row === 0 || row === size - 1 || col === 0 || col === size - 1;
    }

    const [lr, lc] = last_pos;

    // 隣接移動
    if (Math.abs(lr - row) <= 1 && Math.abs(lc - col) <= 1) {
        return true;
    }

    // 飛び越え移動
    if (lr === row && Math.abs(lc - col) === 2) { // 同じ行
        const middle_col = (lc + col) / 2;
        const middle_piece = board[row][middle_col];
        if (middle_piece !== null && middle_piece !== player) {
            return true;
        }
    } else if (lc === col && Math.abs(lr - row) === 2) { // 同じ列
        const middle_row = (lr + row) / 2;
        const middle_piece = board[middle_row][col];
        if (middle_piece !== null && middle_piece !== player) {
            return true;
        }
    }

    return false;
}



function initializeGame() {
    // BGM再生
    // ユーザー操作がないと再生できない場合があるため、クリックイベントで再生開始
    document.body.addEventListener('click', () => bgm.play(), { once: true });
    
    // 盤面データ(board配列)を初期化
    board = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // HTMLの盤面を生成
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
}

function updateBoard() {
    const currentPlayer = marks[current_player_idx];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = boardElement.children[r * size + c];
            const piece = board[r][c];
            
            // 既存のクラスをリセット
            cell.className = 'cell';
            cell.textContent = '';

            if (piece) {
                cell.textContent = piece;
                let className = piece === '#' ? 'hash' : piece;
                cell.classList.add(className);
            } else if (isValidMove(currentPlayer, r, c)) {
                cell.classList.add('valid-move');
            }
        }
    }
    // 最後に置かれた駒のスタイルを適用
    for (const player in last_move) {
        if (last_move[player]) {
            const [lr, lc] = last_move[player];
            const cell = boardElement.children[lr * size + lc];
            let className = player === '#' ? 'hash' : player;
            cell.classList.add(`last-${className}`);
        }
    }
}




function button_click(row, col) {
    const player = marks[current_player_idx];
    if (isValidMove(player, row, col)) {
        board[row][col] = player;
        last_move[player] = [row, col];
        switch_player(); // Pythonコードから移植が必要
        updateBoard();
        settle(); // Pythonコードから移植が必要

        // CPU戦の場合の処理
        if (n === 1 && marks[current_player_idx] === 'X') {
            // setTimeoutで見かけ上の遅延を入れる
            setTimeout(cpu_move, 500); // 0.5秒後にCPUが動く
        }
    }
}

// --- ゲーム開始 ---
initializeGame();
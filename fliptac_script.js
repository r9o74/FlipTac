// --- グローバル変数とDOM要素の取得 ---
// HTML要素
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const startButton = document.getElementById('start-button');
const playerButtons = document.querySelectorAll('.player-btn');
const sizeInput = document.getElementById('size-input');
const sizeDisplay = document.getElementById('size-display');
const boardElement = document.getElementById('game-board');
const winnerDisplay = document.getElementById('winner-display');
const winnerText = winnerDisplay.querySelector('.winner-text');
const replayButton = document.getElementById('replay-button');
const changeSettingsButton = document.getElementById('change-settings-button');
const rulesOverlay = document.getElementById('rules-overlay');
const closeRulesButton = document.getElementById('close-rules-button');
const showRulesMenuButton = document.getElementById('show-rules-menu-button');
const showRulesGameButton = document.getElementById('show-rules-game-button');
const ruleImages = document.querySelectorAll('.rule-image');
const pageSwitchButtons = document.querySelectorAll('.page-btn');



// ゲーム設定値
let n = 1;
let size;

// ゲーム状態
let board = [];
const marks = ["X", "O", "Δ", "#"];
let invalid_marks = [];
let current_player_idx = 0;
let last_move = { "X": null, "O": null, "Δ": null, "#": null };
let cpu_move_count = 0;

// オーディオ
const bgm = new Audio('BGM.mp3');
bgm.loop = true;
const winSound = new Audio('win.mp3');
const startSound = new Audio('start_game.mp3')
const buttonSound = new Audio('push_button.mp3')
const markSound = new Audio('mark.mp3')




// --- イベントリスナー ---
startButton.addEventListener('click', startGame);
sizeInput.addEventListener('input', (e) => {
    sizeDisplay.textContent = e.target.value;
});
replayButton.addEventListener('click', replayGame);
changeSettingsButton.addEventListener('click', returnToMenu);
playerButtons.forEach(button => {
    button.addEventListener('click', () => {
        buttonSound.play()
        // 1. すべてのボタンから 'active' クラスを削除
        playerButtons.forEach(btn => btn.classList.remove('active'));

        // 2. クリックされたボタンに 'active' クラスを追加
        button.classList.add('active');

        // 3. data-value属性から値を取得し、変数nを更新
        n = parseInt(button.dataset.value, 10);
    });
});
showRulesMenuButton.addEventListener('click', showRules);
showRulesGameButton.addEventListener('click', showRules);
closeRulesButton.addEventListener('click', hideRules);
// 背景をクリックしてもルールを閉じる
rulesOverlay.addEventListener('click', (event) => {
    if (event.target === rulesOverlay) {
        hideRules();
    }
});
pageSwitchButtons.forEach(button => {
    button.addEventListener('click', () => {
        // クリックされたボタンのdata-pageの値を使って表示を切り替える
        switchRulePage(button.dataset.page);
        buttonSound.play()
    });
});


// --- 関数定義 ---

/**
 * [フロー①] ゲーム開始処理
 */
function startGame() {
    // 1. メニューから設定値を取得し、グローバル変数に格納
    size = parseInt(sizeInput.value, 10);
    startSound.play()
    buttonSound.play()

    // 2. 画面をメニューからゲームへ切り替える
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    // 3. 取得した設定値でゲームを初期化
    initializeGame();
}

/**
 * [フロー②] ゲームの初期化処理
 */
function initializeGame() {
    // 初回クリック時にBGMを再生
    document.body.addEventListener('click', () => bgm.play(), { once: true });
    
    // ゲーム状態をリセット
    invalid_marks = [];
    last_move = { "X": null, "O": null, "Δ": null, "#": null };
    current_player_idx = 0;
    cpu_move_count = 0;
    winnerDisplay.style.display = 'none';
    
    // 参加しないプレイヤーを設定
    if (n <= 3) invalid_marks.push("#");
    if (n <= 2) invalid_marks.push("Δ");
    
    // 盤面データ配列を生成
    board = Array(size).fill(null).map(() => Array(size).fill(null));
    
    // CSSに盤面のサイズを伝える
    boardElement.style.setProperty('--board-size', size);
    
    // 盤面サイズに応じたフォントサイズを計算
    const fontSize = Math.floor(450 / size / 2);

    // ゲーム盤のマス目を生成
    boardElement.innerHTML = '';
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
    
    // 初回盤面更新
    updateBoard();

    // CPU戦の場合、CPUの最初のターンを開始
    if (n === 1) {
        setTimeout(cpu_move, 500);
    }
}

function showRules() {
    rulesOverlay.classList.remove('hidden');
    buttonSound.play()
    switchRulePage("1")
}

function switchRulePage(targetPage) {
    ruleImages.forEach(image => {
        image.classList.toggle('active-image', image.dataset.page === targetPage);
    });
    pageSwitchButtons.forEach(button => {
        button.classList.toggle('active-btn', button.dataset.page === targetPage);
    });
}


function hideRules() {
    rulesOverlay.classList.add('hidden');
    buttonSound.play()
}



// ===============================================
// これ以降は安定動作していたゲームロジックです
// ===============================================

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

function button_click(row, col) {
    markSound.play()
    if (n === 1 && marks[current_player_idx] === 'X') return;
    const player = marks[current_player_idx];
    if (board[row][col] === null && isValidMove(player, row, col)) {
        board[row][col] = player;
        last_move[player] = [row, col];
        switch_player();
        updateBoard();
        settle();
        let activePlayers = marks.filter(m => !invalid_marks.includes(m));
        if (n === 1 && marks[current_player_idx] === 'X' && activePlayers.length > 1) {
            setTimeout(cpu_move, 500);
        }
    }
}

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
        if (empty_tiles.length > 0) {
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

function switch_player() {
    let activePlayerCount = marks.filter(m => !invalid_marks.includes(m)).length;
    if (activePlayerCount <= 1) return;
    do {
        current_player_idx = (current_player_idx + 1) % marks.length;
    } while (invalid_marks.includes(marks[current_player_idx]));
}

function isValidMove(player, row, col) {
    const last_pos = last_move[player];
    if (last_pos === null) {
        return row === 0 || row === size - 1 || col === 0 || col === size - 1;
    }
    const [lr, lc] = last_pos;
    if (Math.abs(lr - row) <= 1 && Math.abs(lc - col) <= 1) {
        return board[row][col] === null;
    }
    if (lr === row) {
        if (Math.abs(lc - col) === 2 && !([null, player].includes(board[row][(lc + col) / 2]))) {
            return board[row][col] === null;
        }
    } else if (lc === col) {
        if (Math.abs(lr - row) === 2 && !([null, player].includes(board[(lr + row) / 2][col]))) {
            return board[row][col] === null;
        }
    }
    return false;
}

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
            settle();
        }
    }
}

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


function displayWinner(winner) {
    bgm.pause();
    winSound.play();
    if (n === 1) {
        if (winner === "O") {
            winnerText.textContent = `YOU win!`
        }
        else {
            winnerText.textContent = `YOU lose...`
        }
    }
    else {
        winnerText.textContent = `${winner} wins!`;
    }
    winnerDisplay.style.display = 'flex'; // blockではなくflexに変更すると中央揃えが効きやすい
}


function replayGame() {
    buttonSound.play();
    // 勝利画面を非表示にする
    winnerDisplay.style.display = 'none';
    // 現在の設定（n, size）のままゲームを再初期化
    initializeGame();
}

function returnToMenu() {
    buttonSound.play();
    // 勝利画面とゲーム画面全体を非表示にする
    winnerDisplay.style.display = 'none';
    gameScreen.style.display = 'none';
    // メニュー画面を表示する
    menuScreen.style.display = 'flex';
}

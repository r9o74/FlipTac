

// グローバル変数とDOM要素の取得

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
const levelSwitchButtons = document.querySelectorAll('.level-btn');
const cpuLevelContainer = document.getElementById('cpu-level-container');


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
let cpu_level = 1;
let onnxSession;

// 効果音 & BGM
const bgm = new Audio('BGM.mp3');
bgm.loop = true;
const winSound = new Audio('win.mp3');
const startSound = new Audio('start_game.mp3')
const buttonSound = new Audio('push_button.mp3')
const markSound = new Audio('mark.mp3')




// イベントリスナー
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

        if (n===1) {
            cpuLevelContainer.classList.remove('disabled');
        } else {
            cpuLevelContainer.classList.add('disabled');
        }
           });
    buttonSound.play();
});
showRulesMenuButton.addEventListener('click', showRules);
showRulesGameButton.addEventListener('click', showRules);
closeRulesButton.addEventListener('click', hideRules);
rulesOverlay.addEventListener('click', (event) => {
    if (event.target === rulesOverlay) {
        hideRules();
    }
});
pageSwitchButtons.forEach(button => {
    button.addEventListener('click', () => {
        switchRulePage(button.dataset.page);
        startSound.play()
    });
});
levelSwitchButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (cpuLevelContainer.classList.contains('disabled')) return;
        
        cpu_level = parseInt(button.dataset.level, 10);
        buttonSound.play();
        levelSwitchButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    })
})


// 各種関数定義 


async function startGame() {
    size = parseInt(sizeInput.value, 10);
    startSound.play()
    buttonSound.play()

    if (n === 1 && cpu_level === 3 && !onnxSession) {
        try {
            onnxSession = await ort.InferenceSession.create('./fliptac_model.onnx');
        } catch (error) {
            console.error("ONNX Runtime error:", error);
            alert("Failed to load AI model. Please try again.");
            return;
        }
    }

    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    initializeGame();
}


function initializeGame() {
    document.body.addEventListener('click', () => bgm.play(), { once: true });
    
    // ゲーム状態のリセット
    invalid_marks = [];
    last_move = { "X": null, "O": null, "Δ": null, "#": null };
    current_player_idx = 0;
    cpu_move_count = 0;
    winnerDisplay.style.display = 'none';
    
    // 使用しないor敗退済みのマーク
    if (n <= 3) invalid_marks.push("#");
    if (n <= 2) invalid_marks.push("Δ");
    
    // 盤面データ配列
    board = Array(size).fill(null).map(() => Array(size).fill(null));
    
    boardElement.style.setProperty('--board-size', size);
    
    const fontSize = Math.floor(450 / size / 2);

    // 盤のマス目
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

    // CPU戦の場合はCPU先攻
    if (n === 1) {
        setTimeout(cpu_move, 500);
    }
}

function showRules() {
    rulesOverlay.classList.remove('hidden');
    buttonSound.play()
    startSound.play()
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



// ゲームループ
// やっと動作安定したから変更最小限で
// 変数名分かりにくいから次回以降気をつける

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
        board[row][col] = player
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


let boardValuesCache = {};

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


function cpu_logic_lv1(board, cpuMark, opponentMark, last_move, size) {
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


function cpu_logic_lv2(board, cpuMark, opponentMark, last_move, size) {
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
        board[r][c] = cpuMark;
        const originalLastMoveForCpu = last_move[cpuMark];
        last_move[cpuMark] = move;
        const positionalValue = boardValues[r][c];
        const opponentMoveCount = count_valid_moves(opponentMark);
        const myNextMoveCount = count_valid_moves(cpuMark);
        const score = (positionalValue * 3) - (opponentMoveCount * 7) + (myNextMoveCount * 5);
        if (score > maxScore) {
            maxScore = score;
            bestMove = move;
        }
        board[r][c] = null;
        last_move[cpuMark] = originalLastMoveForCpu;
    }
    return bestMove || validMoves[Math.floor(Math.random() * validMoves.length)];
}

async function cpu_logic_lv3(board, cpuMark, opponentMark, last_move, size) {
    if (!onnxSession) {
        console.error("ONNXセッションが初期化されていません。");
        return null;
    }

    // 1. 現在の盤面をモデルの入力形式（テンソル）に変換する
    const myPlayerId = 1; // AIは常に1
    const opponentPlayerId = -1;
    const inputTensor = new Float32Array(3 * size * size);
    
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const index = r * size + c;
            const piece = board[r][c]; // 'X' or 'O' or null
            
            // Channel 0: 自分の石
            if (piece === cpuMark) inputTensor[index] = 1.0;
            // Channel 1: 相手の石
            if (piece === opponentMark) inputTensor[size * size + index] = 1.0;
        }
    }
    // Channel 2: 現在のプレイヤーID (AIのターンなので全面1)
    for (let i = 0; i < size * size; i++) {
        inputTensor[2 * size * size + i] = myPlayerId;
    }

    const tensor = new ort.Tensor('float32', inputTensor, [1, 3, size, size]);
    const feeds = { 'input': tensor };

    // 2. モデルで推論を実行
    const results = await onnxSession.run(feeds);
    const qValues = results.output.data;

    // 3. 有効な手の中から、Q値が最大の手を見つける
    const validMoves = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (isValidMove(cpuMark, r, c)) {
                validMoves.push({ move: [r, c], q: qValues[r * size + c] });
            }
        }
    }

    if (validMoves.length === 0) {
        return null;
    }

    // Q値でソートして最善手を選ぶ
    validMoves.sort((a, b) => b.q - a.q);
    return validMoves[0].move;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function cpu_move() {
    const cpuMark = "X";
    const opponentMark = "O";
    let bestMove; // 変更点: 関数スコープで変数を宣言

    if (cpu_move_count === 0) {
        const initial_place = randomInt(0, (size * 4) - 5);
        if (initial_place < size) {
            bestMove = [0, initial_place];
        } else if (initial_place < (size * 2) - 1) {
            bestMove = [initial_place - size + 1, size - 1];
        } else if (initial_place < (size * 3) - 2) {
            bestMove = [size - 1, size - (initial_place - (size*2) + 3)];
        } else {
            bestMove = [size - (initial_place - (size*3) + 4), 0];
        }
    } else {
        if (cpu_level === 1) {
            bestMove = cpu_logic_lv1(board, cpuMark, opponentMark, last_move, size);
        } else if (cpu_level === 2) {
            bestMove = cpu_logic_lv2(board, cpuMark, opponentMark, last_move, size);
        }

    }

    if (bestMove) {
        const [row, col] = bestMove;
        board[row][col] = cpuMark;
        last_move[cpuMark] = [row, col];
        switch_player();
        updateBoard();
        settle();
    } else {
        console.log("CPU has no valid moves.");
        settle(); 
    }
    cpu_move_count++;
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
    winnerDisplay.style.display = 'flex'; // ここflexにしとくと中央揃えが効きやすいらしい
}


function replayGame() {
    buttonSound.play();
    winnerDisplay.style.display = 'none';
    initializeGame();
}

function returnToMenu() {
    buttonSound.play();
    winnerDisplay.style.display = 'none';
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
}

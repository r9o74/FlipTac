

// グローバル変数とDOM要素の取得

// HTML要素
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const startButton = document.getElementById('start-button');
const playerButtons = document.querySelectorAll('.player-btn');
const sizeSlider = document.getElementById('size-slider');
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
const bgmToggleMenuButton = document.getElementById('bgm-toggle-menu');
const bgmToggleGameButton = document.getElementById('bgm-toggle-game');
const returnToMenuButton = document.getElementById('return-to-menu-btn');
const geminiThinkingIndicator = document.getElementById('gemini-thinking-indicator');



// ゲーム設定値
let n = 1;
let size;

// ゲーム状態
let board = [];
const marks = ["X", "O", "Δ", "#", "&"];
let invalid_marks = [];
let current_player_idx = 0;
let last_move = { "X": null, "O": null, "Δ": null, "#": null, "&": null };
let cpu_move_count = 0;
let cpu_level = 1;
let onnxSession;
let isBgmOn = true;

// 効果音 & BGM
const bgm = new Audio('BGM.mp3');
bgm.loop = true;
const winSound = new Audio('win.mp3');
const startSound = new Audio('start_game.mp3')
const buttonSound = new Audio('push_button.mp3')
const markSound = new Audio('mark.mp3')




// イベントリスナー
startButton.addEventListener('click', startGame);
sizeSlider.addEventListener('input', () => {
    sizeDisplay.textContent = `${sizeSlider.value} x ${sizeSlider.value}`;
});
replayButton.addEventListener('click', replayGame);
changeSettingsButton.addEventListener('click', returnToMenu);
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
bgmToggleMenuButton.addEventListener('click', toggleBgm);
bgmToggleGameButton.addEventListener('click', toggleBgm);
returnToMenuButton.addEventListener('click', backToMenu);
sizeSlider.addEventListener('input', () => {
    sizeDisplay.textContent = `${sizeSlider.value} x ${sizeSlider.value}`;
});
replayButton.addEventListener('click', replayGame);
changeSettingsButton.addEventListener('click', returnToMenu);
playerButtons.forEach(button => {
    button.addEventListener('click', () => {
        buttonSound.play();
        playerButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        n = parseInt(button.dataset.value, 10);

        if (n === 1) {
            cpuLevelContainer.classList.remove('disabled');
        } else {
            cpuLevelContainer.classList.add('disabled');
        }
        updateSliderOptions(); // スライダーの選択肢を更新
    });
});

levelSwitchButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (cpuLevelContainer.classList.contains('disabled')) return;
        
        cpu_level = parseInt(button.dataset.level, 10);
        buttonSound.play();
        levelSwitchButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        updateSliderOptions(); // スライダーの選択肢を更新
    });
});
document.addEventListener('DOMContentLoaded', () => {
    updateSliderOptions();
});



// 各種関数定義 

function updateSliderOptions() {
    // プレイヤー人数(n)とCPUレベル(cpu_level)に基づいて分岐
    if (n === 1 && cpu_level === 3) {
        // LV3 CPU戦の場合、5と7のみ選択可能にする
        sizeSlider.min = '5';
        sizeSlider.max = '7';
        sizeSlider.step = '2'; // stepを2にすることで、5の次は7になる
        
        // 現在の値が5か7でなければ、5に設定
        if (sizeSlider.value !== '5' && sizeSlider.value !== '7') {
            sizeSlider.value = '5';
        }
    } else {
        // それ以外の場合、3から20まで
        sizeSlider.min = '3';
        sizeSlider.max = '10';
        sizeSlider.step = '1';
    }
    // 表示を更新
    sizeDisplay.textContent = `${sizeSlider.value} x ${sizeSlider.value}`;
}


async function startGame() {
    size = parseInt(sizeSlider.value, 10);
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

    if (isBgmOn) {
        bgm.play();
    }
    
    // ゲーム状態のリセット
    invalid_marks = [];
    last_move = { "X": null, "O": null, "Δ": null, "#": null, "&": null };
    current_player_idx = 0;
    cpu_move_count = 0;
    winnerDisplay.style.display = 'none';
    
    // 使用しないor敗退済みのマーク
    if (n <= 4) invalid_marks.push("&");
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
    // マークを安全なCSSクラス名に変換するためのヘルパー関数
    const getClassNameForMark = (mark) => {
        if (!mark) return '';
        switch (mark) {
            case '#': return 'hash';
            case 'Δ': return 'delta';
            case '&': return 'ampersand'; // '&'を'ampersand'に変換
            default: return mark; // 'X', 'O' はそのまま
        }
    };

    const currentPlayer = marks[current_player_idx];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = boardElement.children[r * size + c];
            const piece = board[r][c];
            cell.className = 'cell';
            cell.textContent = piece || '';

            if (piece) {
                const className = getClassNameForMark(piece);
                cell.classList.add(className);
            } else if (isValidMove(currentPlayer, r, c)) {
                if (n === 1 && currentPlayer === 'X') continue;
                const currentPlayerClass = getClassNameForMark(currentPlayer);
                cell.classList.add(`valid-move-${currentPlayerClass}`);
            }
        }
    }

    for (const player in last_move) {
        if (last_move[player]) {
            const [lr, lc] = last_move[player];
            const cell = boardElement.children[lr * size + lc];
            if (cell.textContent === player) {
                const className = getClassNameForMark(player);
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
            setTimeout(() => cpu_move(), 500);
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

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

function formatBoardStateForGemini() {
    const boardString = board.map(row => 
        row.map(cell => cell === null ? '.' : cell).join(' ')
    ).join('\n');
    
    const validMoves = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (isValidMove('X', r, c)) { // Geminiは常に 'X'
                validMoves.push([r, c]);
            }
        }
    }

    return `
- 盤面サイズ: ${size}x${size}
- あなたのマーク: X
- 人間プレイヤーのマーク: O
- 現在の盤面 ('.'は空きマス):
${boardString}
- あなたが現在打てる有効な手 (Valid Moves) のリスト:
${JSON.stringify(validMoves)}
`;
}

async function cpu_logic_lv4() {
    geminiThinkingIndicator.classList.remove('hidden');

    const boardState = formatBoardStateForGemini();
    const prompt = `
あなたは世界トップクラスのボードゲーム戦略家です。これから「FlipTac」というゲームのルールと現在の盤面状況を渡します。あなたのターンです。
提供された情報のみを元に、勝利に最も繋がる最善の一手を考え、指定されたJSON形式で回答してください。



###FlipTacのルール
目的: 盤面上で相手が動けなくなるように追い込み、最後まで生き残ること。

初手 (ゲーム開始時のみ): 盤面に自分のマークが全く存在しないプレイヤーの最初の1手は、必ず盤面の外周のいずれかの空きマスに置かなければならない。

有効な移動 (2手目以降/進行中): 自分の直前の手（マーク）がある場合、そのプレイヤーは以下のいずれかの条件を満たす空きマスに移動できる。

通常移動: 自分の直前の手から隣接する8マス（縦、横、斜め含む）の空きマス。

ジャンプ移動: 自分の直前の手の上下左右に隣接する4マスのいずれかに相手のマークがある場合に限り、そのマークをちょうど1マス飛び越えた先の空きマス。

敗北条件: 自分の有効な手が一つもなくなった場合、そのプレイヤーは脱落（負け）となる。

### 現在の対局状況
${boardState}

### あなたのタスク
上記の「あなたが現在打てる有効な手 (Valid Moves) のリスト」の中から、最も戦略的に優れていると判断した手を一つだけ選び、以下のJSON形式で回答してください。
回答には、JSONオブジェクト以外の余計な説明やテキストを一切含めないでください。

出力形式:
{"move": [row, column]}
`;

    const apiKey = "AIzaSyAgxffZbrRzFrBqYYDb0lCnzdFZul6MN7E";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const result = await response.json();
        const textResponse = result.candidates[0].content.parts[0].text;
        const parsedJson = JSON.parse(textResponse);

        if (parsedJson.move && Array.isArray(parsedJson.move) && parsedJson.move.length === 2) {
             // 念のため、返ってきた手が本当に有効手か再検証する
            const validMoves = JSON.parse(boardState.split('Valid Moves) のリスト:\n')[1]);
            const isTrulyValid = validMoves.some(move => move[0] === parsedJson.move[0] && move[1] === parsedJson.move[1]);
            if(isTrulyValid) {
                return parsedJson.move;
            } else {
                console.error("Gemini returned a move that is not in the valid moves list. Fallback to random.");
                return validMoves[Math.floor(Math.random() * validMoves.length)]; // フォールバック
            }
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        alert("Gemini AIの呼び出しに失敗しました。ランダムな手に切り替えます。");
         const validMoves = JSON.parse(boardState.split('Valid Moves) のリスト:\n')[1]);
         if(validMoves.length > 0) {
            return validMoves[Math.floor(Math.random() * validMoves.length)]; // エラー時のフォールバック
         }
    } finally {
        geminiThinkingIndicator.classList.add('hidden');
    }
    return null;   
}



async function cpu_move() {
    const cpuMark = "X";
    const opponentMark = "O";
    let bestMove; // 変更点: 関数スコープで変数を宣言

    if (cpu_level === 4) {
        bestMove = await cpu_logic_lv4();
    } else {
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
            } else if (cpu_level === 3) {
                bestMove = await cpu_logic_lv3(board, cpuMark, opponentMark, last_move, size);
            } else if (cpu_level === 4) {
                bestMove = await cpu_logic_lv4();
            }
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
    backToMenu();
}

function toggleBgm() {
    isBgmOn = !isBgmOn;
    if (isBgmOn) {
        bgm.play();
        bgmToggleMenuButton.classList.remove('muted');
        bgmToggleGameButton.classList.remove('muted');
    } else {
        bgm.pause();
        bgmToggleMenuButton.classList.add('muted');
        bgmToggleGameButton.classList.add('muted');
    }
}

function backToMenu() {
    buttonSound.play();
    bgm.pause();
    bgm.currentTime = 0; // 曲を最初に戻す

    // ゲーム画面を非表示にし、メニュー画面を表示
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
    winnerDisplay.style.display = 'none'; // 念のため勝者表示も消す
}


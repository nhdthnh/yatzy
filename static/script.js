// State Management
let currentGameId = null;
let myPlayerId = null;
let gameState = null;
let pollInterval = null;
let soundEnabled = true;
let isRollingAnimation = false;

// Audio Synthesizer (Web Audio API)
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'roll') {
            for (let i = 0; i < 6; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const delay = now + (i * 0.06) + (Math.random() * 0.02);
                osc.type = 'square';
                osc.frequency.setValueAtTime(200 + Math.random() * 400, delay);
                gain.gain.setValueAtTime(0.08, delay);
                gain.gain.linearRampToValueAtTime(0.001, delay + 0.04);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(delay);
                osc.stop(delay + 0.04);
            }
        } else if (type === 'score') {
            const notes = [440, 554, 659];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + (idx * 0.08);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.25);
            });
        } else if (type === 'your_turn') {
            const notes = [587.33, 880];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + (idx * 0.1);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.18, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.2);
            });
        } else if (type === 'celebrate') {
            const fanfare = [523.25, 659.25, 783.99, 1046.50];
            fanfare.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + (idx * 0.12);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.2, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.4);
            });
        }
    } catch (e) {
        console.warn('Audio not allowed yet:', e);
    }
}

// DOM Elements
const diceContainer = document.getElementById('dice-container');
const btnRoll = document.getElementById('btn-roll');
const rollBtnText = document.getElementById('roll-btn-text');
const rollsLeftDisplay = document.getElementById('rolls-left-display');
const roundNumberDisplay = document.getElementById('round-number');
const turnHint = document.getElementById('turn-hint');
const turnBanner = document.getElementById('turn-banner');
const turnPlayerName = document.getElementById('turn-player-name');
const turnAvatar = document.getElementById('turn-avatar');
const currentModeBadge = document.getElementById('current-mode-badge');
const opponentWaitingAlert = document.getElementById('opponent-waiting-alert');
const holdGuide = document.getElementById('hold-guide');

// Room Bar Elements
const roomBar = document.getElementById('room-bar');
const displayRoomCode = document.getElementById('display-room-code');
const displayRoomStatus = document.getElementById('display-room-status');
const btnCopyCode = document.getElementById('btn-copy-code');

// Action Buttons
const btnChangeMode = document.getElementById('btn-change-mode');
const btnRestartGame = document.getElementById('btn-restart-game');
const btnRules = document.getElementById('btn-rules');
const btnSound = document.getElementById('btn-sound');

// Modals
const modeModal = document.getElementById('mode-modal');
const btnCloseMode = document.getElementById('btn-close-mode');
const passPlayForm = document.getElementById('pass-play-form');
const btnStartPassPlay = document.getElementById('btn-start-pass-play');
const passP1Name = document.getElementById('pass-p1-name');
const passP2Name = document.getElementById('pass-p2-name');

const onlineForm = document.getElementById('online-form');
const tabCreateRoom = document.getElementById('tab-create-room');
const tabJoinRoom = document.getElementById('tab-join-room');
const createRoomView = document.getElementById('create-room-view');
const joinRoomView = document.getElementById('join-room-view');
const createPlayerName = document.getElementById('create-player-name');
const joinPlayerName = document.getElementById('join-player-name');
const joinRoomCode = document.getElementById('join-room-code');
const btnConfirmCreateRoom = document.getElementById('btn-confirm-create-room');
const btnConfirmJoinRoom = document.getElementById('btn-confirm-join-room');

const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const gameOverModal = document.getElementById('game-over-modal');
const btnPlayAgain = document.getElementById('btn-play-again');
const finalScoreVsCard = document.getElementById('final-score-vs-card');
const winnerIcon = document.getElementById('winner-icon');
const winnerTitle = document.getElementById('winner-title');
const winnerSubtitle = document.getElementById('winner-subtitle');

// Dice Pip Configs
const PIP_CONFIGS = {
    1: ['pip-row-2 pip-col-2'],
    2: ['pip-row-1 pip-col-1', 'pip-row-3 pip-col-3'],
    3: ['pip-row-1 pip-col-1', 'pip-row-2 pip-col-2', 'pip-row-3 pip-col-3'],
    4: ['pip-row-1 pip-col-1', 'pip-row-1 pip-col-3', 'pip-row-3 pip-col-1', 'pip-row-3 pip-col-3'],
    5: ['pip-row-1 pip-col-1', 'pip-row-1 pip-col-3', 'pip-row-2 pip-col-2', 'pip-row-3 pip-col-1', 'pip-row-3 pip-col-3'],
    6: ['pip-row-1 pip-col-1', 'pip-row-2 pip-col-1', 'pip-row-3 pip-col-1', 'pip-row-1 pip-col-3', 'pip-row-2 pip-col-3', 'pip-row-3 pip-col-3']
};

function initApp() {
    setupEventListeners();

    // Check URL parameters (e.g. ?room=XYZ)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
        // Auto open join modal
        modeModal.classList.add('active');
        showOnlineTab('join');
        joinRoomCode.value = roomParam.toUpperCase();
    } else {
        // Default start a 2-Player Pass & Play game (or single)
        startNewGame('pass_play', 'Người chơi 1', 'Người chơi 2');
    }
}

function setupEventListeners() {
    btnRoll.addEventListener('click', handleRoll);
    btnRestartGame.addEventListener('click', handleRestart);

    btnChangeMode.addEventListener('click', () => {
        passPlayForm.classList.add('hidden');
        onlineForm.classList.add('hidden');
        modeModal.classList.add('active');
    });
    btnCloseMode.addEventListener('click', () => modeModal.classList.remove('active'));

    // Mode Selection Cards
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            if (mode === 'single') {
                modeModal.classList.remove('active');
                startNewGame('single', 'Bạn');
            } else if (mode === 'pass_play') {
                onlineForm.classList.add('hidden');
                passPlayForm.classList.remove('hidden');
            } else if (mode === 'online') {
                passPlayForm.classList.add('hidden');
                onlineForm.classList.remove('hidden');
            }
        });
    });

    btnStartPassPlay.addEventListener('click', () => {
        const p1 = passP1Name.value.trim() || 'Người chơi 1';
        const p2 = passP2Name.value.trim() || 'Người chơi 2';
        modeModal.classList.remove('active');
        startNewGame('pass_play', p1, p2);
    });

    // Online Tabs
    tabCreateRoom.addEventListener('click', () => showOnlineTab('create'));
    tabJoinRoom.addEventListener('click', () => showOnlineTab('join'));

    btnConfirmCreateRoom.addEventListener('click', () => {
        const name = createPlayerName.value.trim() || 'Người chơi 1';
        modeModal.classList.remove('active');
        startNewGame('online', name);
    });

    btnConfirmJoinRoom.addEventListener('click', handleJoinRoom);

    btnCopyCode.addEventListener('click', () => {
        if (!gameState || !gameState.game_id) return;
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${gameState.game_id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            btnCopyCode.textContent = '✅ Đã sao chép!';
            setTimeout(() => { btnCopyCode.textContent = '📋 Sao chép link'; }, 2000);
        }).catch(() => {
            prompt('Sao chép đường link tham gia này gửi cho bạn bè:', shareUrl);
        });
    });

    btnRules.addEventListener('click', () => rulesModal.classList.add('active'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.remove('active'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.remove('active'));

    btnSound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        btnSound.textContent = soundEnabled ? '🔊' : '🔇';
    });

    btnPlayAgain.addEventListener('click', () => {
        gameOverModal.classList.remove('active');
        handleRestart();
    });

    // Score Table Category Clicks
    document.querySelectorAll('.score-row').forEach(row => {
        row.addEventListener('click', () => {
            const cat = row.dataset.category;
            if (cat) handleScoreCategory(cat);
        });
    });
}

function showOnlineTab(tab) {
    if (tab === 'create') {
        tabCreateRoom.classList.add('active');
        tabJoinRoom.classList.remove('active');
        createRoomView.classList.remove('hidden');
        joinRoomView.classList.add('hidden');
    } else {
        tabJoinRoom.classList.add('active');
        tabCreateRoom.classList.remove('active');
        joinRoomView.classList.remove('hidden');
        createRoomView.classList.add('hidden');
    }
}

// Game API Interactions
async function startNewGame(mode, p1Name, p2Name = '') {
    stopPolling();
    try {
        const res = await fetch('/api/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, player_name: p1Name, p2_name: p2Name })
        });
        const data = await res.json();
        if (data.success) {
            currentGameId = data.game_id;
            myPlayerId = data.player_id;
            gameState = data.state;
            renderAll();
            if (mode === 'online') startPolling();
        }
    } catch (err) {
        console.error('Lỗi khởi tạo game:', err);
    }
}

async function handleJoinRoom() {
    const code = joinRoomCode.value.trim().toUpperCase();
    const name = joinPlayerName.value.trim() || 'Người chơi 2';

    if (!code) {
        alert('Vui lòng nhập mã phòng!');
        return;
    }

    try {
        const res = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_code: code, player_name: name })
        });
        const data = await res.json();
        if (data.error) {
            alert(data.error);
            return;
        }

        modeModal.classList.remove('active');
        currentGameId = data.game_id;
        myPlayerId = data.player_id;
        gameState = data.state;
        renderAll();
        startPolling();
    } catch (err) {
        console.error('Lỗi tham gia phòng:', err);
    }
}

function startPolling() {
    stopPolling();
    pollInterval = setInterval(async () => {
        if (!currentGameId || !myPlayerId) return;
        try {
            const res = await fetch(`/api/game/${currentGameId}/state?player_id=${myPlayerId}`);
            if (res.ok) {
                const newState = await res.json();
                
                // If turn just switched to me, notify with chime!
                if (!gameState?.can_act && newState.can_act) {
                    playSound('your_turn');
                }

                // Nếu đang là lượt của mình và chưa đổi lượt, giữ nguyên các xúc xắc đang chọn giữ
                if (newState.can_act && gameState?.can_act && newState.current_player_idx === gameState.current_player_idx && newState.rolls_left === gameState.rolls_left) {
                    newState.held = gameState.held;
                }

                gameState = newState;
                renderAll();

                if (gameState.status === 'game_over') {
                    stopPolling();
                    triggerGameOver();
                }
            }
        } catch (err) {
            console.warn('Lỗi đồng bộ phòng:', err);
        }
    }, 1200);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function handleRoll() {
    if (isRollingAnimation || !gameState?.can_act || gameState.rolls_left <= 0) return;

    isRollingAnimation = true;
    playSound('roll');

    // Trigger dice shake
    const diceEls = document.querySelectorAll('.die');
    diceEls.forEach((dieEl, i) => {
        if (!gameState.held.includes(i)) {
            dieEl.classList.add('rolling');
        }
    });

    try {
        const res = await fetch(`/api/game/${currentGameId}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ held: gameState.held, player_id: myPlayerId })
        });
        const newState = await res.json();

        setTimeout(() => {
            if (newState.error) {
                alert(newState.error);
            } else {
                gameState = newState;
                renderAll();
            }
            isRollingAnimation = false;
        }, 350);

    } catch (err) {
        console.error('Lỗi đổ xúc xắc:', err);
        isRollingAnimation = false;
    }
}

async function toggleHold(idx) {
    if (!gameState?.can_act || gameState.rolls_left === 0 || isRollingAnimation) return;

    playSound('click');
    const pos = gameState.held.indexOf(idx);
    if (pos > -1) {
        gameState.held.splice(pos, 1);
    } else {
        gameState.held.push(idx);
    }
    renderDice();

    // Đồng bộ lên server để phòng online hoặc polling không bị mất trạng thái giữ
    if (currentGameId) {
        try {
            await fetch(`/api/game/${currentGameId}/hold`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ held: gameState.held, player_id: myPlayerId })
            });
        } catch (e) {
            console.warn('Lỗi đồng bộ giữ xúc xắc:', e);
        }
    }
}

async function handleScoreCategory(category) {
    if (!gameState?.can_act) return;
    if (!gameState.has_rolled) {
        alert('Hãy đổ xúc xắc ít nhất 1 lần trước khi chốt điểm!');
        return;
    }

    const activePid = gameState.active_player.id;
    if (gameState.scores[activePid] && gameState.scores[activePid][category] !== undefined) {
        return; // Đã ghi điểm ô này rồi
    }

    try {
        const res = await fetch(`/api/game/${currentGameId}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, player_id: myPlayerId })
        });
        const newState = await res.json();

        if (newState.error) {
            alert(newState.error);
            return;
        }

        playSound('score');
        gameState = newState;
        renderAll();

        if (gameState.status === 'game_over') {
            triggerGameOver();
        }
    } catch (err) {
        console.error('Lỗi ghi điểm:', err);
    }
}

async function handleRestart() {
    if (!currentGameId) return;
    try {
        const res = await fetch(`/api/game/${currentGameId}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: myPlayerId })
        });
        const newState = await res.json();
        if (!newState.error) {
            gameState = newState;
            renderAll();
            if (gameState.mode === 'online') startPolling();
        }
    } catch (err) {
        console.error('Lỗi khởi động lại:', err);
    }
}

// Rendering Logic
function renderAll() {
    if (!gameState) return;
    renderHeaderAndRoom();
    renderTurnBanner();
    renderDice();
    renderScorecard();
}

function renderHeaderAndRoom() {
    // Mode badge
    if (gameState.mode === 'single') {
        currentModeBadge.textContent = '👤 1 Người chơi';
        roomBar.classList.add('hidden');
    } else if (gameState.mode === 'pass_play') {
        currentModeBadge.textContent = '👥 2 Người Cùng Máy (Pass & Play)';
        roomBar.classList.add('hidden');
    } else if (gameState.mode === 'online') {
        currentModeBadge.textContent = '🌐 2 Người Online';
        roomBar.classList.remove('hidden');
        displayRoomCode.textContent = gameState.game_id;

        if (gameState.players.length < 2) {
            displayRoomStatus.innerHTML = '<span class="status-dot pulsing"></span> Đang chờ đối thủ tham gia...';
        } else {
            displayRoomStatus.innerHTML = '<span class="status-dot active"></span> 🟢 Đã kết nối với đối thủ!';
        }
    }
}

function renderTurnBanner() {
    const isP2 = (gameState.current_player_idx === 1);
    const activePlayer = gameState.active_player || { name: 'Người chơi' };

    turnBanner.className = `turn-banner ${isP2 ? 'turn-p2' : 'turn-p1'}`;
    turnAvatar.textContent = isP2 ? '🟣' : '🔵';
    roundNumberDisplay.textContent = gameState.round;
    rollsLeftDisplay.textContent = gameState.rolls_left;

    if (gameState.mode === 'online') {
        if (gameState.can_act) {
            turnPlayerName.textContent = '🔥 ĐẾN LƯỢT BẠN!';
            opponentWaitingAlert.classList.add('hidden');
            holdGuide.classList.remove('hidden');
        } else {
            turnPlayerName.textContent = `⏳ Đang đợi ${activePlayer.name}...`;
            opponentWaitingAlert.classList.remove('hidden');
            holdGuide.classList.add('hidden');
        }
    } else {
        turnPlayerName.textContent = `LƯỢT CỦA: ${activePlayer.name.toUpperCase()}`;
        opponentWaitingAlert.classList.add('hidden');
        holdGuide.classList.remove('hidden');
    }

    // Roll button state
    if (!gameState.can_act) {
        btnRoll.disabled = true;
        rollBtnText.textContent = 'ĐANG ĐỢI ĐỐI THỦ...';
        turnHint.textContent = 'Chờ đối thủ hoàn thành lượt chơi.';
    } else if (!gameState.has_rolled) {
        btnRoll.disabled = false;
        rollBtnText.textContent = 'ĐỔ XÚC XẮC';
        turnHint.textContent = 'Nhấn "ĐỔ XÚC XẮC" hoặc bấm chọn xúc xắc bạn muốn giữ!';
    } else if (gameState.rolls_left > 0) {
        btnRoll.disabled = false;
        rollBtnText.textContent = `ĐỔ TIẾP (${gameState.rolls_left})`;
        turnHint.textContent = `Click giữ xúc xắc mong muốn, rồi Đổ tiếp (${gameState.rolls_left} lần) hoặc Chọn 1 ô điểm.`;
    } else {
        btnRoll.disabled = true;
        rollBtnText.textContent = 'HẾT LƯỢT ĐỔ';
        turnHint.textContent = 'Đã hết lần đổ! Bắt buộc phải bấm vào 1 ô điểm để chuyển lượt.';
    }
}

function renderDice() {
    diceContainer.innerHTML = '';
    gameState.dice.forEach((val, idx) => {
        const wrapper = document.createElement('div');
        const isHeld = gameState.held.includes(idx);
        wrapper.className = `die-wrapper ${isHeld ? 'is-held' : ''}`;
        wrapper.setAttribute('title', isHeld ? 'Click để bỏ giữ' : 'Click để giữ lại xúc xắc này');

        const die = document.createElement('div');
        die.className = 'die';
        die.dataset.value = val;

        const pips = PIP_CONFIGS[val] || [];
        pips.forEach(pipClass => {
            const pip = document.createElement('span');
            pip.className = `pip ${pipClass}`;
            die.appendChild(pip);
        });

        const tag = document.createElement('span');
        tag.className = 'hold-tag';
        tag.textContent = isHeld ? '✓ ĐÃ GIỮ' : 'GIỮ';

        wrapper.appendChild(die);
        wrapper.appendChild(tag);

        wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            toggleHold(idx);
        });
        diceContainer.appendChild(wrapper);
    });
}

function renderScorecard() {
    const isTwoPlayers = gameState.players.length > 1;
    const p1 = gameState.players[0];
    const p2 = gameState.players[1] || null;
    const activeIdx = gameState.current_player_idx;
    const activePid = gameState.active_player ? gameState.active_player.id : null;

    // Headers
    document.getElementById('th-p1').textContent = p1.name;
    document.getElementById('th-p1-lower').textContent = p1.name;
    document.getElementById('p1-name-total').textContent = p1.name;

    const p2Cols = document.querySelectorAll('.p2-col, .p2-cell, #p2-total-box');
    const grandContainer = document.getElementById('grand-total-container');

    if (isTwoPlayers && p2) {
        p2Cols.forEach(el => el.classList.remove('hidden'));
        document.getElementById('th-p2').textContent = p2.name;
        document.getElementById('th-p2-lower').textContent = p2.name;
        document.getElementById('p2-name-total').textContent = p2.name;
        grandContainer.classList.add('two-players');
    } else {
        p2Cols.forEach(el => el.classList.add('hidden'));
        grandContainer.classList.remove('two-players');
    }

    // Active Column Highlights
    document.querySelectorAll('.p1-col, .p1-cell').forEach(el => {
        el.classList.toggle('active-col', activeIdx === 0);
    });
    document.querySelectorAll('.p2-col, .p2-cell').forEach(el => {
        el.classList.toggle('active-col', activeIdx === 1);
    });

    const p1Scores = gameState.scores[p1.id] || {};
    const p2Scores = p2 ? (gameState.scores[p2.id] || {}) : {};
    const potentials = gameState.potential_scores || {};

    // Rows
    document.querySelectorAll('.score-row').forEach(row => {
        const cat = row.dataset.category;
        const p1Cell = row.querySelector('.p1-cell');
        const p2Cell = row.querySelector('.p2-cell');

        // P1 Cell
        if (p1Scores[cat] !== undefined) {
            p1Cell.innerHTML = `<strong>${p1Scores[cat]}</strong>`;
        } else if (activeIdx === 0 && gameState.can_act && gameState.has_rolled) {
            const pot = potentials[cat] !== undefined ? potentials[cat] : 0;
            p1Cell.innerHTML = `<span class="potential-badge">+${pot}</span>`;
        } else {
            p1Cell.innerHTML = '-';
        }

        // P2 Cell
        if (p2) {
            if (p2Scores[cat] !== undefined) {
                p2Cell.innerHTML = `<strong>${p2Scores[cat]}</strong>`;
            } else if (activeIdx === 1 && gameState.can_act && gameState.has_rolled) {
                const pot = potentials[cat] !== undefined ? potentials[cat] : 0;
                p2Cell.innerHTML = `<span class="potential-badge">+${pot}</span>`;
            } else {
                p2Cell.innerHTML = '-';
            }
        }

        // Row selectable indicator
        const currentScores = (activeIdx === 0) ? p1Scores : p2Scores;
        const canPickThisRow = gameState.can_act && gameState.has_rolled && (currentScores[cat] === undefined);
        row.classList.toggle('selectable-turn', canPickThisRow);
    });

    // Totals
    const t1 = gameState.totals[p1.id] || { upper_score: 0, bonus: 0, total_score: 0 };
    document.getElementById('subtotal-p1').textContent = `${t1.upper_score} / 63`;
    document.getElementById('bonus-p1').textContent = `+${t1.bonus}`;
    document.getElementById('grand-total-p1').textContent = t1.total_score;

    if (p2) {
        const t2 = gameState.totals[p2.id] || { upper_score: 0, bonus: 0, total_score: 0 };
        document.getElementById('subtotal-p2').textContent = `${t2.upper_score} / 63`;
        document.getElementById('bonus-p2').textContent = `+${t2.bonus}`;
        document.getElementById('grand-total-p2').textContent = t2.total_score;
    }
}

function triggerGameOver() {
    playSound('celebrate');
    const p1 = gameState.players[0];
    const p2 = gameState.players[1] || null;
    const t1 = gameState.totals[p1.id]?.total_score || 0;
    const t2 = p2 ? (gameState.totals[p2.id]?.total_score || 0) : 0;
    const winnerId = gameState.winner;

    if (!p2) {
        // Single player
        winnerIcon.textContent = '🏆';
        winnerTitle.textContent = 'HOÀN THÀNH VÁN ĐẤU!';
        winnerSubtitle.textContent = 'Bạn đã hoàn tất 13 vòng chơi Yatzy.';
        finalScoreVsCard.innerHTML = `
            <div class="vs-player-card is-winner">
                <span class="vs-name">${p1.name}</span>
                <span class="vs-score">${t1}</span>
            </div>
        `;
    } else {
        // 2 Players
        if (winnerId === 'tie') {
            winnerIcon.textContent = '🤝';
            winnerTitle.textContent = 'KẾT QUẢ: HÒA NHAU!';
            winnerSubtitle.textContent = `Cả hai người chơi đều xuất sắc đạt cùng số điểm!`;
        } else {
            const winnerName = (winnerId === p1.id) ? p1.name : p2.name;
            winnerIcon.textContent = '🏆';
            winnerTitle.textContent = `CHIẾN THẮNG: ${winnerName.toUpperCase()}!`;
            winnerSubtitle.textContent = 'Chúc mừng nhà vô địch của ván đấu!';
        }

        finalScoreVsCard.innerHTML = `
            <div class="vs-player-card ${winnerId === p1.id ? 'is-winner' : ''}">
                <span class="vs-name">${p1.name}</span>
                <span class="vs-score">${t1}</span>
            </div>
            <div class="vs-badge">VS</div>
            <div class="vs-player-card ${winnerId === p2.id ? 'is-winner' : ''}">
                <span class="vs-name">${p2.name}</span>
                <span class="vs-score">${t2}</span>
            </div>
        `;
    }

    gameOverModal.classList.add('active');
    runConfetti();
}

// Confetti Animation
function runConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ffffff'];

    for (let i = 0; i < 140; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 4 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 6 - 3
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });

        frame++;
        if (frame < 260) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
}

document.addEventListener('DOMContentLoaded', initApp);

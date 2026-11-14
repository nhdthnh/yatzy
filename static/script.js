// ==========================================================
// YATZY MASTER - ZERO-DELAY & LOW-RAM CONTROLLER
// Optimized for 512MB RAM environment & mobile instant touch
// Player names: strictly "An" or "Thành"
// ==========================================================

let currentGameId = null;
let myPlayerId = null;
let gameState = null;
let pollInterval = null;
let soundEnabled = true;
let isRollingAnimation = false;
let diceElements = []; // Cached DOM nodes (created once)

// Lightweight Web Audio Synthesizer (Single instance, zero leaks)
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
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'roll') {
            for (let i = 0; i < 4; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const delay = now + (i * 0.045);
                osc.type = 'square';
                osc.frequency.setValueAtTime(220 + Math.random() * 300, delay);
                gain.gain.setValueAtTime(0.06, delay);
                gain.gain.linearRampToValueAtTime(0.001, delay + 0.035);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(delay);
                osc.stop(delay + 0.035);
            }
        } else if (type === 'score') {
            const notes = [440, 554, 659];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + (idx * 0.06);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.1, startTime);
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
                const startTime = now + (idx * 0.1);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.35);
            });
        }
    } catch (e) {
        // Audio not yet unlocked by user interaction
    }
}

// DOM Elements
const diceContainer = document.getElementById('dice-container');
const btnRoll = document.getElementById('btn-roll');
const rollBtnText = document.getElementById('roll-btn-text');
const rollsLeftDisplay = document.getElementById('rolls-left-display');
const roundNumberDisplay = document.getElementById('round-number');
const turnHint = document.getElementById('turn-hint');
const turnPlayerName = document.getElementById('turn-player-name');
const currentModeBadge = document.getElementById('current-mode-badge');
const opponentWaitingAlert = document.getElementById('opponent-waiting-alert');
const holdGuide = document.getElementById('hold-guide');

// Player Banner Pills (Scoreboard)
const pillP1 = document.getElementById('pill-p1');
const pillP2 = document.getElementById('pill-p2');
const grandTotalP1 = document.getElementById('grand-total-p1');
const grandTotalP2 = document.getElementById('grand-total-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');

// Room Bar Elements
const roomBar = document.getElementById('room-bar');
const displayRoomCode = document.getElementById('display-room-code');
const displayRoomStatus = document.getElementById('display-room-status');
const btnCopyCode = document.getElementById('btn-copy-code');

// Top Nav Buttons
const btnChangeMode = document.getElementById('btn-change-mode');
const btnRestartGame = document.getElementById('btn-restart-game');
const btnRules = document.getElementById('btn-rules');
const btnSound = document.getElementById('btn-sound');

// Modals
const modeModal = document.getElementById('mode-modal');
const btnCloseMode = document.getElementById('btn-close-mode');
const singlePlayerForm = document.getElementById('single-player-form');
const btnStartSingle = document.getElementById('btn-start-single');
const passPlayForm = document.getElementById('pass-play-form');
const btnStartPassPlay = document.getElementById('btn-start-pass-play');

const onlineForm = document.getElementById('online-form');
const btnYatzyCreateRoom = document.getElementById('btn-yatzy-create-room');
const btnYatzyJoinRoom = document.getElementById('btn-yatzy-join-room');
const yatzyLobbyStatus = document.getElementById('yatzy-lobby-status');
let selectedYatzyName = 'An';

const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const gameOverModal = document.getElementById('game-over-modal');
const btnPlayAgain = document.getElementById('btn-play-again');
const finalScoreVsCard = document.getElementById('final-score-vs-card');
const winnerIcon = document.getElementById('winner-icon');
const winnerTitle = document.getElementById('winner-title');
const winnerSubtitle = document.getElementById('winner-subtitle');

// Category Rules Help Dictionary
const CATEGORY_RULES = {
    ones: {
        badge: '⚀',
        title: 'Số 1 (Ones)',
        scoreInfo: 'Điểm = Tổng các mặt 1',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 1. Ví dụ: bạn đổ được 3 con 1 thì được 3 điểm.'
    },
    twos: {
        badge: '⚁',
        title: 'Số 2 (Twos)',
        scoreInfo: 'Điểm = Tổng các mặt 2',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 2. Ví dụ: bạn đổ được 3 con 2 thì được 6 điểm.'
    },
    threes: {
        badge: '⚂',
        title: 'Số 3 (Threes)',
        scoreInfo: 'Điểm = Tổng các mặt 3',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 3. Ví dụ: bạn đổ được 3 con 3 thì được 9 điểm.'
    },
    fours: {
        badge: '⚃',
        title: 'Số 4 (Fours)',
        scoreInfo: 'Điểm = Tổng các mặt 4',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 4. Ví dụ: bạn đổ được 3 con 4 thì được 12 điểm.'
    },
    fives: {
        badge: '⚄',
        title: 'Số 5 (Fives)',
        scoreInfo: 'Điểm = Tổng các mặt 5',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 5. Ví dụ: bạn đổ được 3 con 5 thì được 15 điểm.'
    },
    sixes: {
        badge: '⚅',
        title: 'Số 6 (Sixes)',
        scoreInfo: 'Điểm = Tổng các mặt 6',
        desc: 'Tính tổng điểm của các con xúc xắc ra mặt số 6. Ví dụ: bạn đổ được 3 con 6 thì được 18 điểm.'
    },
    bonus: {
        badge: '⭐',
        title: 'Thưởng Thêm (Bonus)',
        scoreInfo: 'Thưởng cố định: +35 điểm',
        desc: 'Nếu tổng điểm của 6 ô phần trên (từ số 1 đến 6) đạt từ 63 điểm trở lên, bạn sẽ nhận ngay +35 điểm thưởng!'
    },
    three_of_a_kind: {
        badge: '3x',
        title: 'Bộ 3 Giống Nhau (3x)',
        scoreInfo: 'Điểm = Tổng cả 5 xúc xắc',
        desc: 'Cần có ít nhất 3 con xúc xắc cùng một số. Điểm số tính bằng tổng điểm cả 5 con xúc xắc đang có.'
    },
    four_of_a_kind: {
        badge: '4x',
        title: 'Bộ 4 Giống Nhau (4x)',
        scoreInfo: 'Điểm = Tổng cả 5 xúc xắc',
        desc: 'Cần có ít nhất 4 con xúc xắc cùng một số. Điểm số tính bằng tổng điểm cả 5 con xúc xắc đang có.'
    },
    full_house: {
        badge: '🏠',
        title: 'Cù Lũ (Full House)',
        scoreInfo: 'Điểm cố định: 25 điểm',
        desc: 'Gồm 1 bộ 3 con giống nhau và 1 bộ 2 con giống nhau (Ví dụ: ba con 5 và hai con 2). Ăn trọn 25 điểm.'
    },
    small_straight: {
        badge: 'SMALL',
        title: 'Sảnh Nhỏ (4 số tiếp)',
        scoreInfo: 'Điểm cố định: 30 điểm',
        desc: 'Có dãy 4 số liên tiếp: 1-2-3-4, 2-3-4-5 hoặc 3-4-5-6 (con thứ 5 tùy ý). Ăn trọn 30 điểm.'
    },
    large_straight: {
        badge: 'LARGE',
        title: 'Sảnh Lớn (5 số tiếp)',
        scoreInfo: 'Điểm cố định: 40 điểm',
        desc: 'Có dãy trọn vẹn 5 số liên tiếp: 1-2-3-4-5 hoặc 2-3-4-5-6. Ăn trọn 40 điểm.'
    },
    yatzy: {
        badge: 'YATZY',
        title: 'YATZY (5 con bằng nhau)',
        scoreInfo: 'Điểm kỷ lục: 50 điểm ⭐',
        desc: 'Cả 5 con xúc xắc đều cùng một số (Ví dụ: cả 5 con đều là số 6). Được ngay 50 điểm tối đa!'
    },
    chance: {
        badge: '?',
        title: 'Cơ Hội (Chance)',
        scoreInfo: 'Điểm = Tổng cả 5 xúc xắc',
        desc: 'Tự do hoàn toàn, không yêu cầu bộ nào. Điểm số bằng tổng điểm cả 5 xúc xắc (cứu điểm khi không ăn được ô khác).'
    }
};

let tooltipTimeout = null;
function showCategoryTooltip(catKey) {
    const data = CATEGORY_RULES[catKey];
    if (!data) return;

    playSound('click');
    document.getElementById('tooltip-icon').textContent = data.badge;
    document.getElementById('tooltip-title').textContent = data.title;
    document.getElementById('tooltip-score-info').textContent = data.scoreInfo;
    document.getElementById('tooltip-desc').textContent = data.desc;

    document.getElementById('tooltip-backdrop').classList.remove('hidden');
    document.getElementById('category-tooltip').classList.remove('hidden');

    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(hideCategoryTooltip, 5000);
}

function hideCategoryTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    const tip = document.getElementById('category-tooltip');
    const backdrop = document.getElementById('tooltip-backdrop');
    if (tip) tip.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
}

// Selections state (Only An or Thành)
let selectedSingleName = 'An';
let selectedPassP1 = 'An';
let selectedCreateName = 'An';

// ==========================================================
// PRE-CREATE 5 DICE IN DOM (ONCE - Zero Garbage Collection)
// ==========================================================
function createDiceElements() {
    diceContainer.innerHTML = '';
    diceElements = [];

    for (let i = 0; i < 5; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'die-wrapper';
        wrapper.dataset.index = i;

        // Wood indentation slot
        const slotBg = document.createElement('div');
        slotBg.className = 'die-slot-bg';
        wrapper.appendChild(slotBg);

        // Die cube
        const die = document.createElement('div');
        die.className = 'die';
        die.dataset.value = (i % 6) + 1;

        // 7 Pip dots (toggled via CSS rules based on data-value)
        const pips = ['pip-tl', 'pip-tr', 'pip-ml', 'pip-c', 'pip-mr', 'pip-bl', 'pip-br'];
        pips.forEach(pClass => {
            const pip = document.createElement('span');
            pip.className = `pip ${pClass}`;
            die.appendChild(pip);
        });
        wrapper.appendChild(die);

        // Hold status badge
        const holdPill = document.createElement('span');
        holdPill.className = 'hold-pill';
        holdPill.textContent = '✓ GIỮ';
        wrapper.appendChild(holdPill);

        // Ultra fast pointerdown touch event - Zero 300ms delay
        wrapper.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            toggleHold(i);
        });

        diceContainer.appendChild(wrapper);
        diceElements.push(wrapper);
    }
}

// ==========================================================
// APP INITIALIZATION
// ==========================================================
function initApp() {
    createDiceElements();
    setupEventListeners();
    setupHubNavigation();

    // Khởi tạo các trò chơi bổ sung (Cờ Caro, Ô Ăn Quan, Đoán Con Thú)
    if (typeof CaroGame !== 'undefined') CaroGame.init();
    if (typeof OAnQuanGame !== 'undefined') OAnQuanGame.init();
    if (typeof DoanThuGame !== 'undefined') DoanThuGame.init();

    // Pause polling when tab is hidden to save RAM/CPU
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else if (gameState?.mode === 'online' && gameState?.status === 'playing') {
            startPolling();
        }
    });

    // Check URL parameters (?game=caro&room=XYZ or ?room=XYZ)
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    const roomParam = params.get('room');

    if (roomParam) {
        if (gameParam === 'caro' || gameParam === 'oanquan' || gameParam === 'doanthu') {
            const targetBtn = document.querySelector(`.hub-tab-btn[data-game-target="${gameParam}"]`);
            if (targetBtn) targetBtn.click();
            if (typeof HubOnline !== 'undefined') {
                HubOnline.joinRoom(gameParam, 'Thành');
            }
        } else {
            handleJoinRoom(roomParam);
        }
    } else {
        if (gameParam && (gameParam === 'caro' || gameParam === 'oanquan' || gameParam === 'doanthu')) {
            const targetBtn = document.querySelector(`.hub-tab-btn[data-game-target="${gameParam}"]`);
            if (targetBtn) targetBtn.click();
        }
        // Default start: 2 Players on same device: An vs Thành
        startNewGame('pass_play', 'An', 'Thành');
    }
}

// Chuyển đổi giữa 4 trò chơi ngay tức thì (0ms, không tải lại trang)
function setupHubNavigation() {
    document.querySelectorAll('.hub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playSound('click');
            const targetGame = btn.dataset.gameTarget;

            // Đổi tab active
            document.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Ẩn tất cả trò chơi
            document.querySelectorAll('.game-view').forEach(v => v.classList.add('hidden'));

            // Hiện trò chơi được chọn
            const targetEl = document.getElementById(`game-view-${targetGame}`);
            if (targetEl) targetEl.classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    btnRoll.addEventListener('click', handleRoll);
    btnRestartGame.addEventListener('click', handleRestart);

    btnChangeMode.addEventListener('click', () => {
        modeModal.classList.add('active');
    });
    btnCloseMode.addEventListener('click', () => modeModal.classList.remove('active'));

    // Mode Selection Cards
    document.querySelectorAll('.mode-item').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-item').forEach(c => c.classList.remove('active-selected'));
            card.classList.add('active-selected');
            const mode = card.dataset.mode;

            singlePlayerForm.classList.add('hidden');
            passPlayForm.classList.add('hidden');
            onlineForm.classList.add('hidden');

            if (mode === 'single') {
                singlePlayerForm.classList.remove('hidden');
            } else if (mode === 'pass_play') {
                passPlayForm.classList.remove('hidden');
            } else if (mode === 'online') {
                onlineForm.classList.remove('hidden');
                checkYatzyLobbyStatus();
            }
        });
    });

    // Single Player Name Toggle (An or Thành)
    document.querySelectorAll('[data-single-name]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-single-name]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSingleName = btn.dataset.singleName;
        });
    });

    btnStartSingle.addEventListener('click', () => {
        modeModal.classList.remove('active');
        startNewGame('single', selectedSingleName);
    });

    // Pass & Play Order Toggle (An first or Thành first)
    document.querySelectorAll('[data-first]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-first]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPassP1 = btn.dataset.first;
        });
    });

    btnStartPassPlay.addEventListener('click', () => {
        const p1 = selectedPassP1;
        const p2 = (p1 === 'An') ? 'Thành' : 'An';
        modeModal.classList.remove('active');
        startNewGame('pass_play', p1, p2);
    });

    // Yatzy Online Name Toggle
    document.querySelectorAll('[data-yatzy-name]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-yatzy-name]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedYatzyName = btn.dataset.yatzyName || 'An';
        });
    });

    if (btnYatzyCreateRoom) {
        btnYatzyCreateRoom.addEventListener('click', () => {
            modeModal.classList.remove('active');
            startNewGame('online', selectedYatzyName);
        });
    }

    if (btnYatzyJoinRoom) {
        btnYatzyJoinRoom.addEventListener('click', () => handleJoinRoom());
    }

    btnCopyCode.addEventListener('click', () => {
        if (!gameState?.game_id) return;
        const shareUrl = `${window.location.origin}${window.location.pathname}?game=yatzy&room=${gameState.game_id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            btnCopyCode.textContent = '✅ Đã copy!';
            setTimeout(() => { btnCopyCode.textContent = '📋 Copy link'; }, 2000);
        }).catch(() => {
            prompt('Sao chép đường link này gửi cho bạn bè:', shareUrl);
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

    // Score Table Category Clicks (Chỉ chốt điểm khi không click vào nút help)
    document.querySelectorAll('.score-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('[data-help]')) return;
            const cat = row.dataset.category;
            if (cat) handleScoreCategory(cat);
        });
    });

    // Category Help Tooltip Clicks
    document.querySelectorAll('[data-help]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showCategoryTooltip(el.dataset.help);
        });
    });

    const btnCloseTip = document.getElementById('btn-close-tooltip');
    if (btnCloseTip) btnCloseTip.addEventListener('click', hideCategoryTooltip);

    const backdropTip = document.getElementById('tooltip-backdrop');
    if (backdropTip) backdropTip.addEventListener('click', hideCategoryTooltip);
}

async function checkYatzyLobbyStatus() {
    if (!yatzyLobbyStatus) return;
    yatzyLobbyStatus.innerHTML = '<span class="status-dot pulsing"></span> Đang kiểm tra phòng...';
    yatzyLobbyStatus.className = 'lobby-status-banner';

    try {
        const res = await fetch('/api/hub/lobby_status?game_type=yatzy');
        const data = await res.json();
        if (data.has_waiting) {
            const waitingName = data.waiting_name || 'Đối thủ';
            yatzyLobbyStatus.className = 'lobby-status-banner has-waiting';
            yatzyLobbyStatus.innerHTML = `🟢 <strong>${waitingName}</strong> đang mở phòng chờ bạn!`;

            // Tự động chọn tên còn lại
            const otherName = (waitingName === 'An') ? 'Thành' : 'An';
            document.querySelectorAll('[data-yatzy-name]').forEach(btn => {
                if (btn.dataset.yatzyName === otherName) {
                    btn.classList.add('active');
                    selectedYatzyName = otherName;
                } else {
                    btn.classList.remove('active');
                }
            });

            if (btnYatzyJoinRoom) {
                btnYatzyJoinRoom.classList.add('highlight');
                btnYatzyJoinRoom.textContent = `🎮 Vào Phòng Với ${waitingName}`;
            }
        } else {
            yatzyLobbyStatus.className = 'lobby-status-banner';
            yatzyLobbyStatus.innerHTML = '⚪ Chưa có phòng nào đang mở. Bấm "Tạo Phòng" để bắt đầu!';
            if (btnYatzyJoinRoom) {
                btnYatzyJoinRoom.classList.remove('highlight');
                btnYatzyJoinRoom.textContent = '🎮 Vào Phòng Ngay';
            }
        }
    } catch (err) {
        yatzyLobbyStatus.className = 'lobby-status-banner';
        yatzyLobbyStatus.innerHTML = '⚪ Sẵn sàng kết nối 2 người chơi.';
    }
}

// ==========================================================
// GAME API INTERACTIONS
// ==========================================================
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
        console.error('Lỗi tạo game:', err);
    }
}

async function handleJoinRoom(codeParam = '') {
    try {
        const payload = codeParam ? { room_code: codeParam, player_name: selectedYatzyName } : { player_name: selectedYatzyName };
        const res = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
        alert('Chưa có phòng nào đang chờ! Bạn hãy bấm "Tạo Phòng" trước nhé.');
    }
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
                if (!gameState?.can_act && newState.can_act) {
                    playSound('your_turn');
                }

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
            // Network stutter
        }
    }, 1200);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// ==========================================================
// INSTANT HOLD TOGGLE (0ms latency on mobile)
// ==========================================================
function toggleHold(idx) {
    if (!gameState?.can_act || isRollingAnimation) return;

    // Không cho giữ nếu chưa đổ lần nào
    if (!gameState.has_rolled || gameState.rolls_left === 3) {
        playSound('click');
        turnHint.innerHTML = '⚠️ <strong>Chưa thể giữ!</strong> Hãy bấm nút <strong>"ĐỔ XÚC XẮC"</strong> lần 1 trước!';
        btnRoll.classList.add('pulse-attention');
        setTimeout(() => btnRoll.classList.remove('pulse-attention'), 1000);
        return;
    }

    if (gameState.rolls_left === 0) {
        turnHint.innerHTML = '⚠️ <strong>Đã hết lượt đổ!</strong> Chọn 1 ô điểm để chốt.';
        return;
    }

    // Phản hồi âm thanh & thị giác ngay lập tức (0ms)
    playSound('click');
    const pos = gameState.held.indexOf(idx);
    let isHeldNow = false;
    if (pos > -1) {
        gameState.held.splice(pos, 1);
    } else {
        gameState.held.push(idx);
        isHeldNow = true;
    }

    // Cập nhật class trực tiếp vào node DOM sẵn có
    if (diceElements[idx]) {
        diceElements[idx].classList.toggle('is-held', isHeldNow);
    }

    // Gửi đồng bộ ngầm không chặn UI
    if (currentGameId) {
        fetch(`/api/game/${currentGameId}/hold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ held: gameState.held, player_id: myPlayerId })
        }).catch(() => {});
    }
}

// ==========================================================
// SNAPPY ROLL ANIMATION (Fast 0.18s, GPU-accelerated)
// ==========================================================
async function handleRoll() {
    if (isRollingAnimation || !gameState?.can_act || gameState.rolls_left <= 0) return;

    isRollingAnimation = true;
    playSound('roll');

    // Thêm class lắc nhanh cho xúc xắc không giữ
    diceElements.forEach((el, i) => {
        if (!gameState.held.includes(i)) {
            el.querySelector('.die').classList.add('rolling');
        }
    });

    // Nhấp nháy số nhanh (35ms/khung hình)
    const rollTimer = setInterval(() => {
        diceElements.forEach((el, i) => {
            if (!gameState.held.includes(i)) {
                el.querySelector('.die').dataset.value = Math.floor(Math.random() * 6) + 1;
            }
        });
    }, 35);

    try {
        const res = await fetch(`/api/game/${currentGameId}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ held: gameState.held, player_id: myPlayerId })
        });
        const newState = await res.json();

        // Kết thúc animation siêu nhanh sau 180ms
        setTimeout(() => {
            clearInterval(rollTimer);
            diceElements.forEach(el => el.querySelector('.die').classList.remove('rolling'));

            if (!newState.error) {
                gameState = newState;
                renderAll();
            } else {
                alert(newState.error);
            }
            isRollingAnimation = false;
        }, 180);

    } catch (err) {
        clearInterval(rollTimer);
        diceElements.forEach(el => el.querySelector('.die').classList.remove('rolling'));
        isRollingAnimation = false;
    }
}

// ==========================================================
// SCORE SELECTION
// ==========================================================
async function handleScoreCategory(category) {
    if (!gameState?.can_act || isRollingAnimation) return;
    if (!gameState.has_rolled) {
        alert('Hãy đổ xúc xắc ít nhất 1 lần trước khi chốt điểm!');
        return;
    }

    const activePid = gameState.active_player.id;
    if (gameState.scores[activePid] && gameState.scores[activePid][category] !== undefined) {
        return; // Đã chốt điểm rồi
    }

    try {
        playSound('score');
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

// ==========================================================
// RENDERING LOGIC (In-Place DOM Mutation - Zero Memory Churn)
// ==========================================================
function renderAll() {
    if (!gameState) return;
    renderHeader();
    renderDiceValues();
    renderScorecard();
}

function renderHeader() {
    const isSingle = (gameState.mode === 'single');
    const isP2 = (gameState.current_player_idx === 1);
    const p1 = gameState.players[0] || { name: 'An' };
    const p2 = gameState.players[1] || { name: 'Thành' };

    // Toggle single-player class on body
    document.body.classList.toggle('single-player-mode', isSingle);

    // Mode tag
    if (isSingle) {
        currentModeBadge.textContent = '👤 1 Người';
        roomBar.classList.add('hidden');
    } else if (gameState.mode === 'pass_play') {
        currentModeBadge.textContent = '👥 2 Người Cùng Máy';
        roomBar.classList.add('hidden');
    } else if (gameState.mode === 'online') {
        currentModeBadge.textContent = '🌐 Online';
        roomBar.classList.remove('hidden');
        displayRoomCode.textContent = gameState.game_id;
        displayRoomStatus.innerHTML = (gameState.players.length < 2)
            ? '<span class="status-dot pulsing"></span> Chờ đối thủ...'
            : '<span class="status-dot active"></span> Đã kết nối';
    }

    // Top player score banner & Avatars (An là nữ 👩, Thành là nam 👦)
    function getPlayerAvatar(name) {
        if (!name) return { icon: '👩', isFemale: true };
        const n = name.trim().toLowerCase();
        if (n.includes('thành') || n.includes('thanh')) {
            return { icon: '👦', isFemale: false };
        }
        return { icon: '👩', isFemale: true };
    }

    nameP1.textContent = p1.name;
    pillP1.classList.toggle('active', !isP2);
    const avatarP1 = document.getElementById('avatar-p1');
    if (avatarP1) {
        const av1 = getPlayerAvatar(p1.name);
        avatarP1.textContent = av1.icon;
        avatarP1.className = `player-avatar ${av1.isFemale ? 'avatar-female' : 'avatar-male'}`;
    }

    if (!isSingle) {
        nameP2.textContent = p2.name;
        pillP2.classList.toggle('active', isP2);
        const avatarP2 = document.getElementById('avatar-p2');
        if (avatarP2) {
            const av2 = getPlayerAvatar(p2.name);
            avatarP2.textContent = av2.icon;
            avatarP2.className = `player-avatar ${av2.isFemale ? 'avatar-female' : 'avatar-male'}`;
        }
    }

    // Turn status line
    const activeName = (isP2 ? p2.name : p1.name);
    roundNumberDisplay.textContent = gameState.round;
    rollsLeftDisplay.textContent = gameState.rolls_left;

    if (gameState.mode === 'online') {
        if (gameState.can_act) {
            turnPlayerName.textContent = '🔥 ĐẾN LƯỢT BẠN!';
            opponentWaitingAlert.classList.add('hidden');
        } else {
            turnPlayerName.textContent = `⏳ Đang đợi ${activeName}...`;
            opponentWaitingAlert.classList.remove('hidden');
        }
    } else {
        turnPlayerName.textContent = `Lượt: ${activeName}`;
        opponentWaitingAlert.classList.add('hidden');
    }

    // Roll button & hints
    if (!gameState.can_act) {
        btnRoll.disabled = true;
        rollBtnText.textContent = 'ĐANG ĐỢI ĐỐI THỦ...';
        turnHint.textContent = 'Chờ đối thủ thao tác.';
        holdGuide.textContent = '⏳ Đang chờ đối thủ...';
    } else if (!gameState.has_rolled) {
        btnRoll.disabled = false;
        rollBtnText.textContent = '🎲 ĐỔ XÚC XẮC (LẦN 1)';
        turnHint.textContent = 'Bấm "ĐỔ XÚC XẮC" để bắt đầu lượt!';
        holdGuide.textContent = '👉 Đổ xúc xắc lần 1 để mở khóa giữ';
    } else if (gameState.rolls_left > 0) {
        btnRoll.disabled = false;
        rollBtnText.textContent = `🎲 ĐỔ TIẾP (${gameState.rolls_left} lần)`;
        turnHint.textContent = `Chạm xúc xắc để Giữ, hoặc Đổ tiếp (${gameState.rolls_left} lần) hoặc Chọn 1 ô điểm.`;
        holdGuide.innerHTML = 'Chạm xúc xắc để <strong>Giữ lại</strong>';
    } else {
        btnRoll.disabled = true;
        rollBtnText.textContent = 'HẾT LƯỢT ĐỔ';
        turnHint.textContent = 'Đã hết lần đổ! Bắt buộc chọn 1 ô điểm để kết thúc lượt.';
        holdGuide.textContent = '🏁 Hãy chọn 1 ô điểm trên bảng!';
    }
}

// In-place update of dice faces & held state (No DOM recreation!)
function renderDiceValues() {
    gameState.dice.forEach((val, idx) => {
        const wrapper = diceElements[idx];
        if (!wrapper) return;

        const die = wrapper.querySelector('.die');
        die.dataset.value = val;

        const isHeld = gameState.held.includes(idx);
        wrapper.classList.toggle('is-held', isHeld);
    });
}

function renderScorecard() {
    const isSingle = (gameState.mode === 'single');
    const p1 = gameState.players[0] || { name: 'An' };
    const p2 = gameState.players[1] || { name: 'Thành' };
    const activeIdx = gameState.current_player_idx;

    // Headers
    document.getElementById('th-p1').textContent = p1.name.toUpperCase();
    document.getElementById('th-p1-lower').textContent = p1.name.toUpperCase();
    if (!isSingle) {
        document.getElementById('th-p2').textContent = p2.name.toUpperCase();
        document.getElementById('th-p2-lower').textContent = p2.name.toUpperCase();
    }

    const p1Scores = gameState.scores[p1.id] || {};
    const p2Scores = !isSingle ? (gameState.scores[p2.id] || {}) : {};
    const potentials = gameState.potential_scores || {};

    // Update each category row in-place
    document.querySelectorAll('.score-row').forEach(row => {
        const cat = row.dataset.category;
        const p1Cell = row.querySelector('.p1-cell');
        const p2Cell = row.querySelector('.p2-cell');

        // P1 Cell
        p1Cell.classList.remove('has-score', 'can-select');
        if (p1Scores[cat] !== undefined) {
            p1Cell.classList.add('has-score');
            p1Cell.innerHTML = `<strong>${p1Scores[cat]}</strong>`;
        } else if (activeIdx === 0 && gameState.can_act && gameState.has_rolled) {
            p1Cell.classList.add('can-select');
            const pot = potentials[cat] !== undefined ? potentials[cat] : 0;
            p1Cell.innerHTML = `<span class="potential-val">+${pot}</span>`;
        } else {
            p1Cell.innerHTML = '-';
        }

        // P2 Cell
        if (!isSingle && p2Cell) {
            p2Cell.classList.remove('has-score', 'can-select');
            if (p2Scores[cat] !== undefined) {
                p2Cell.classList.add('has-score');
                p2Cell.innerHTML = `<strong>${p2Scores[cat]}</strong>`;
            } else if (activeIdx === 1 && gameState.can_act && gameState.has_rolled) {
                p2Cell.classList.add('can-select');
                const pot = potentials[cat] !== undefined ? potentials[cat] : 0;
                p2Cell.innerHTML = `<span class="potential-val">+${pot}</span>`;
            } else {
                p2Cell.innerHTML = '-';
            }
        }
    });

    // Totals & Bonus
    const t1 = gameState.totals[p1.id] || { upper_score: 0, bonus: 0, total_score: 0 };
    grandTotalP1.textContent = t1.total_score;

    const sub1 = document.getElementById('subtotal-p1');
    sub1.textContent = `${t1.upper_score}/63`;
    sub1.classList.toggle('earned', t1.bonus > 0);

    const bonusVal1 = document.getElementById('bonus-p1');
    bonusVal1.classList.toggle('hidden', t1.bonus <= 0);

    if (!isSingle) {
        const t2 = gameState.totals[p2.id] || { upper_score: 0, bonus: 0, total_score: 0 };
        grandTotalP2.textContent = t2.total_score;

        const sub2 = document.getElementById('subtotal-p2');
        sub2.textContent = `${t2.upper_score}/63`;
        sub2.classList.toggle('earned', t2.bonus > 0);

        const bonusVal2 = document.getElementById('bonus-p2');
        bonusVal2.classList.toggle('hidden', t2.bonus <= 0);
    }
}

// ==========================================================
// GAME OVER & LIGHTWEIGHT CONFETTI (Low RAM)
// ==========================================================
function triggerGameOver() {
    playSound('celebrate');
    const p1 = gameState.players[0] || { name: 'An' };
    const p2 = gameState.players[1] || null;
    const t1 = gameState.totals[p1.id]?.total_score || 0;
    const t2 = p2 ? (gameState.totals[p2.id]?.total_score || 0) : 0;
    const winnerId = gameState.winner;

    if (!p2) {
        winnerIcon.textContent = '🏆';
        winnerTitle.textContent = 'HOÀN THÀNH VÁN ĐẤU!';
        winnerSubtitle.textContent = `${p1.name} đã hoàn tất 13 vòng chơi!`;
        finalScoreVsCard.innerHTML = `
            <div class="vs-box winner">
                <div class="vs-name">${p1.name}</div>
                <div class="vs-score">${t1}</div>
            </div>
        `;
    } else {
        if (winnerId === 'tie') {
            winnerIcon.textContent = '🤝';
            winnerTitle.textContent = 'HÒA NHAU!';
            winnerSubtitle.textContent = `Cả hai đều xuất sắc bằng điểm nhau!`;
        } else {
            const winnerName = (winnerId === p1.id) ? p1.name : p2.name;
            winnerIcon.textContent = '🏆';
            winnerTitle.textContent = `CHIẾN THẮNG: ${winnerName.toUpperCase()}!`;
            winnerSubtitle.textContent = `Chúc mừng nhà vô địch!`;
        }

        finalScoreVsCard.innerHTML = `
            <div class="vs-box ${winnerId === p1.id ? 'winner' : ''}">
                <div class="vs-name">${p1.name}</div>
                <div class="vs-score">${t1}</div>
            </div>
            <div class="vs-box ${winnerId === p2.id ? 'winner' : ''}">
                <div class="vs-name">${p2.name}</div>
                <div class="vs-score">${t2}</div>
            </div>
        `;
    }

    gameOverModal.classList.add('active');
    runLightConfetti();
}

// Low-RAM Confetti (Runs only 45 frames, then immediately frees memory)
function runLightConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let pieces = [];
    const colors = ['#f59e0b', '#10b981', '#028ce6', '#ef4444'];
    for (let i = 0; i < 40; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.4),
            size: Math.random() * 6 + 4,
            color: colors[i % colors.length],
            vy: Math.random() * 3 + 2,
            vx: Math.random() * 2 - 1
        });
    }

    let frames = 0;
    function step() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        frames++;
        if (frames < 50) {
            requestAnimationFrame(step);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pieces = null; // Free memory immediately
        }
    }
    step();
}

document.addEventListener('DOMContentLoaded', initApp);
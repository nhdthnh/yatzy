// ==========================================================
// Ô ĂN QUAN (MANDARIN SQUARE CAPTURING) - TRÒ CHƠI DÂN GIAN VIỆT NAM
// Chuẩn luật truyền thống 2 người chơi: An (Nữ) vs Thành (Nam) hoặc Đấu Máy
// ==========================================================

const OAnQuanGame = (function() {
    // 12 Ô: 
    // 0..4: Dân P1 (An)
    // 5: Quan Phải
    // 6..10: Dân P2 (Thành)
    // 11: Quan Trái
    let board = [];
    let currentPlayer = 1; // 1: An, 2: Thành
    let scores = { 1: 0, 2: 0 };
    let selectedCell = null;
    let isAnimating = false;
    let gameOver = false;
    let gameMode = 'pvp'; // 'pvp' (2 người) hoặc 'pve' (chơi với máy)

    function init() {
        resetGame();
        bindEvents();
    }

    function resetGame(forceLocal = false) {
        if (gameMode === 'online' && !forceLocal) {
            HubOnline.restartGame();
            return;
        }
        board = [];
        // 5 ô dân An: 5 viên/ô
        for (let i = 0; i <= 4; i++) board.push({ type: 'dan', count: 5 });
        // Quan Phải: 1 quan lớn (giá trị 10đ)
        board.push({ type: 'quan', count: 10, hasBigQuan: true });
        // 5 ô dân Thành: 5 viên/ô
        for (let i = 6; i <= 10; i++) board.push({ type: 'dan', count: 5 });
        // Quan Trái: 1 quan lớn (giá trị 10đ)
        board.push({ type: 'quan', count: 10, hasBigQuan: true });

        scores = { 1: 0, 2: 0 };
        currentPlayer = 1;
        selectedCell = null;
        isAnimating = false;
        gameOver = false;

        renderBoard();
        updateDisplay();
        hideWinner();
        hideDirections();
    }

    function renderBoard() {
        // Render 5 ô trên (An: 0..4)
        for (let i = 0; i <= 4; i++) {
            const el = document.getElementById(`oa-cell-${i}`);
            if (el) renderCellContent(el, board[i], i);
        }

        // Render 5 ô dưới (Thành: 6..10)
        for (let i = 6; i <= 10; i++) {
            const el = document.getElementById(`oa-cell-${i}`);
            if (el) renderCellContent(el, board[i], i);
        }

        // Render 2 ô quan
        const quanL = document.getElementById('oa-quan-left');
        const quanR = document.getElementById('oa-quan-right');
        if (quanL) renderCellContent(quanL, board[11], 11);
        if (quanR) renderCellContent(quanR, board[5], 5);
    }

    function renderCellContent(el, cellData, idx) {
        el.dataset.index = idx;
        const count = cellData.count;
        const countEl = el.querySelector('.stone-count');
        const visualEl = el.querySelector('.stones-visual');

        if (countEl) countEl.textContent = count;

        // Vẽ sỏi nhẹ nhàng (tối đa hiển thị 8 viên visual để tiết kiệm RAM)
        if (visualEl) {
            visualEl.innerHTML = '';
            if (cellData.hasBigQuan) {
                const bigStone = document.createElement('span');
                bigStone.className = 'big-quan-stone';
                bigStone.textContent = '👑';
                visualEl.appendChild(bigStone);
            }
            const visualCount = Math.min(count, 8);
            for (let k = 0; k < visualCount; k++) {
                const s = document.createElement('span');
                s.className = 'mini-stone';
                visualEl.appendChild(s);
            }
        }

        // Đánh dấu ô có thể chọn
        el.classList.remove('selectable', 'selected');
        const isP1Cell = (idx >= 0 && idx <= 4);
        const isP2Cell = (idx >= 6 && idx <= 10);

        if (!gameOver && !isAnimating) {
            if (gameMode === 'online') {
                const room = HubOnline.getRoom();
                if (room && room.status === 'playing' && room.can_act) {
                    if (room.caller_idx === 0 && isP1Cell && count > 0) el.classList.add('selectable');
                    if (room.caller_idx === 1 && isP2Cell && count > 0) el.classList.add('selectable');
                }
            } else {
                if ((currentPlayer === 1 && isP1Cell && count > 0) ||
                    (currentPlayer === 2 && isP2Cell && count > 0 && gameMode === 'pvp')) {
                    el.classList.add('selectable');
                }
            }
        }
        if (selectedCell === idx) {
            el.classList.add('selected');
        }
    }

    function selectCell(idx) {
        if (isAnimating || gameOver) return;

        if (gameMode === 'online') {
            const room = HubOnline.getRoom();
            if (!room || room.status !== 'playing' || !room.can_act) return;
            const callerIdx = room.caller_idx;
            const isValid = (callerIdx === 0 && idx >= 0 && idx <= 4 && board[idx].count > 0) ||
                            (callerIdx === 1 && idx >= 6 && idx <= 10 && board[idx].count > 0);
            if (!isValid) return;
            playSound('click');
            selectedCell = idx;
            renderBoard();
            showDirections(idx);
            return;
        }

        if (gameMode === 'pve' && currentPlayer === 2) return;

        const isP1Turn = (currentPlayer === 1);
        const isValidP1 = (isP1Turn && idx >= 0 && idx <= 4 && board[idx].count > 0);
        const isValidP2 = (!isP1Turn && idx >= 6 && idx <= 10 && board[idx].count > 0);

        if (!isValidP1 && !isValidP2) return;

        playSound('click');
        selectedCell = idx;
        renderBoard();
        showDirections(idx);
    }

    function showDirections(idx) {
        const dirBox = document.getElementById('oa-direction-picker');
        if (!dirBox) return;

        dirBox.classList.remove('hidden');
        const btnLeft = document.getElementById('oa-btn-left');
        const btnRight = document.getElementById('oa-btn-right');

        // Chiều rải: 
        // 1: Thuận chiều kim đồng hồ (index tăng: 0 -> 1 -> ... -> 5)
        // -1: Ngược chiều kim đồng hồ (index giảm: 0 -> 11 -> 10 -> ...)
        if (btnLeft) {
            btnLeft.onclick = () => chooseDirection(-1);
        }
        if (btnRight) {
            btnRight.onclick = () => chooseDirection(1);
        }
    }

    function hideDirections() {
        const dirBox = document.getElementById('oa-direction-picker');
        if (dirBox) dirBox.classList.add('hidden');
    }

    function chooseDirection(dir) {
        hideDirections();
        if (selectedCell === null || isAnimating) return;

        if (gameMode === 'online') {
            playSound('click');
            HubOnline.sendAction({ action: 'move', start_cell: selectedCell, direction: dir });
            selectedCell = null;
            renderBoard();
            return;
        }

        executeMove(selectedCell, dir);
    }

    async function executeMove(startIdx, dir) {
        isAnimating = true;
        let curr = startIdx;
        let hand = board[curr].count;
        board[curr].count = 0;
        renderBoard();

        const stepDelay = 180; // Tốc độ rải quân mượt mà và nhanh

        while (hand > 0) {
            playSound('click');
            // Rải từng viên
            while (hand > 0) {
                curr = (curr + dir + 12) % 12;
                board[curr].count++;
                hand--;
                renderBoard();
                await sleep(stepDelay);
            }

            // Kiểm tra ô kế tiếp
            const nextIdx = (curr + dir + 12) % 12;

            // Nếu ô kế tiếp là ô Dân và CÓ quân -> Bốc lên rải tiếp!
            if (board[nextIdx].type === 'dan' && board[nextIdx].count > 0) {
                playSound('click');
                curr = nextIdx;
                hand = board[curr].count;
                board[curr].count = 0;
                renderBoard();
                await sleep(stepDelay);
                continue;
            }

            // Nếu ô kế tiếp là ô TRỐNG
            if (board[nextIdx].count === 0 && board[nextIdx].type === 'dan') {
                // Kiểm tra ăn quân liên hoàn!
                let checkEmpty = nextIdx;
                let eatIdx = (checkEmpty + dir + 12) % 12;

                while (board[checkEmpty].count === 0 && board[eatIdx].count > 0) {
                    // Ăn toàn bộ quân ở eatIdx
                    playSound('score');
                    const eaten = board[eatIdx].count;
                    board[eatIdx].count = 0;
                    board[eatIdx].hasBigQuan = false;
                    scores[currentPlayer] += eaten;
                    renderBoard();
                    updateDisplay();
                    await sleep(stepDelay * 1.5);

                    // Kiểm tra tiếp xem có ăn liên hoàn không
                    checkEmpty = (eatIdx + dir + 12) % 12;
                    eatIdx = (checkEmpty + dir + 12) % 12;
                }
            }

            // Kết thúc lượt đi
            break;
        }

        selectedCell = null;
        isAnimating = false;

        // Kiểm tra điều kiện kết thúc trò chơi
        if (checkGameOver()) {
            endGame();
            return;
        }

        // Chuyển lượt
        currentPlayer = (currentPlayer === 1) ? 2 : 1;

        // Kiểm tra xem người chơi tiếp theo có quân để đi không
        checkMustRefillStones(currentPlayer);

        renderBoard();
        updateDisplay();

        // Nếu là lượt máy (P2 trong PVE)
        if (gameMode === 'pve' && currentPlayer === 2 && !gameOver) {
            setTimeout(makeAiMove, 500);
        }
    }

    function checkMustRefillStones(player) {
        const start = (player === 1) ? 0 : 6;
        const end = (player === 1) ? 4 : 10;
        let total = 0;
        for (let i = start; i <= end; i++) {
            total += board[i].count;
        }

        // Nếu 5 ô đều hết quân -> Bắt buộc rải điểm từ kho điểm
        if (total === 0) {
            if (scores[player] >= 5) {
                scores[player] -= 5;
                for (let i = start; i <= end; i++) {
                    board[i].count = 1;
                }
                const name = (player === 1) ? 'An' : 'Thành';
                showActionHint(`👉 ${name} đã rải 5 điểm từ quỹ của mình vào 5 ô dân để tiếp tục.`);
            } else {
                // Không đủ điểm để rải -> Hết quân, kết thúc ván
                endGame();
            }
        }
    }

    function checkGameOver() {
        // Kết thúc khi cả 2 ô Quan đều hết điểm (count === 0)
        return (board[5].count === 0 && board[11].count === 0);
    }

    function endGame() {
        gameOver = true;

        // Thu hồi sỏi còn lại trên các ô dân
        for (let i = 0; i <= 4; i++) {
            scores[1] += board[i].count;
            board[i].count = 0;
        }
        for (let i = 6; i <= 10; i++) {
            scores[2] += board[i].count;
            board[i].count = 0;
        }

        renderBoard();
        updateDisplay();
        playSound('celebrate');

        const s1 = scores[1];
        const s2 = scores[2];
        const p2Title = (gameMode === 'pve') ? 'Máy' : 'Thành';

        if (s1 > s2) {
            showWinner(`AN CHIẾN THẮNG! 🏆 (${s1} vs ${s2})`);
        } else if (s2 > s1) {
            showWinner(`${p2Title.toUpperCase()} CHIẾN THẮNG! 🏆 (${s2} vs ${s1})`);
        } else {
            showWinner(`HÒA NHAU! 🤝 (${s1} - ${s2})`);
        }
    }

    // AI Ô Ăn Quan: Chọn ô và hướng đi ăn được nhiều điểm nhất
    function makeAiMove() {
        if (gameOver || isAnimating) return;

        let bestCell = null;
        let bestDir = 1;
        let maxEat = -1;

        // Duyệt 5 ô của Thành (6..10)
        for (let i = 6; i <= 10; i++) {
            if (board[i].count > 0) {
                // Thử cả 2 hướng: 1 (phải) và -1 (trái)
                for (const dir of [1, -1]) {
                    const estimatedEat = simulateEat(i, dir);
                    if (estimatedEat > maxEat) {
                        maxEat = estimatedEat;
                        bestCell = i;
                        bestDir = dir;
                    }
                }
            }
        }

        if (bestCell !== null) {
            executeMove(bestCell, bestDir);
        }
    }

    function simulateEat(startIdx, dir) {
        // Ước lượng điểm ăn đơn giản
        let curr = startIdx;
        let count = board[startIdx].count;
        let target = (curr + (count * dir) + 1200) % 12;
        let nextTarget = (target + dir + 12) % 12;
        let eatTarget = (nextTarget + dir + 12) % 12;

        if (board[nextTarget] && board[nextTarget].count === 0 && board[eatTarget]) {
            return board[eatTarget].count;
        }
        return Math.random() * 2; // Nếu không ăn được ngay thì chọn có ngẫu nhiên
    }

    function updateDisplay() {
        const s1El = document.getElementById('oa-score-p1');
        const s2El = document.getElementById('oa-score-p2');
        if (s1El) s1El.textContent = scores[1];
        if (s2El) s2El.textContent = scores[2];

        const turnName = document.getElementById('oa-turn-name');
        if (!turnName) return;

        if (currentPlayer === 1) {
            turnName.innerHTML = `Lượt: 👩 <strong>An</strong>`;
        } else {
            const oppName = (gameMode === 'pve') ? '🤖 Máy' : '👦 <strong>Thành</strong>';
            turnName.innerHTML = `Lượt: ${oppName}`;
        }
    }

    function showActionHint(text) {
        const hintEl = document.getElementById('oa-hint-text');
        if (hintEl) hintEl.textContent = text;
    }

    function showWinner(msg) {
        const winBox = document.getElementById('oa-winner-banner');
        if (winBox) {
            winBox.textContent = msg;
            winBox.classList.remove('hidden');
        }
    }

    function hideWinner() {
        const winBox = document.getElementById('oa-winner-banner');
        if (winBox) winBox.classList.add('hidden');
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function onServerState(room) {
        if (room.game_type !== 'oanquan') return;
        gameMode = 'online';

        const modePvP = document.getElementById('btn-oa-mode-pvp');
        const modePvE = document.getElementById('btn-oa-mode-pve');
        const modeOnline = document.getElementById('btn-oa-mode-online');
        if (modeOnline) modeOnline.classList.add('active');
        if (modePvP) modePvP.classList.remove('active');
        if (modePvE) modePvE.classList.remove('active');

        const st = room.state;
        board = st.board || [];
        scores = { 1: st.scores[0], 2: st.scores[1] };
        currentPlayer = st.current_player_idx + 1;

        renderBoard();
        updateDisplay();

        if (room.status === 'game_over') {
            gameOver = true;
            if (st.winner === 'tie') {
                showWinner('HÒA NHAU! 🤝');
            } else if (st.winner !== null) {
                const winName = room.players[st.winner]?.name || (st.winner === 0 ? 'An' : 'Thành');
                showWinner(`${winName.toUpperCase()} CHIẾN THẮNG VỚI ${scores[st.winner + 1]} ĐIỂM! 🏆`);
                playSound('celebrate');
            }
        } else {
            gameOver = false;
            hideWinner();
        }
    }

    function bindEvents() {
        // Click vào các ô dân
        for (let i = 0; i <= 4; i++) {
            const el = document.getElementById(`oa-cell-${i}`);
            if (el) el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                selectCell(i);
            });
        }
        for (let i = 6; i <= 10; i++) {
            const el = document.getElementById(`oa-cell-${i}`);
            if (el) el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                selectCell(i);
            });
        }

        const btnReset = document.getElementById('btn-oa-reset');
        if (btnReset) btnReset.addEventListener('click', () => resetGame());

        const modePvP = document.getElementById('btn-oa-mode-pvp');
        const modePvE = document.getElementById('btn-oa-mode-pve');
        const modeOnline = document.getElementById('btn-oa-mode-online');

        if (modeOnline) {
            modeOnline.addEventListener('click', () => {
                HubOnline.openModal('oanquan');
            });
        }

        if (modePvP) {
            modePvP.addEventListener('click', () => {
                HubOnline.leaveOnlineMode();
                modePvP.classList.add('active');
                if (modePvE) modePvE.classList.remove('active');
                if (modeOnline) modeOnline.classList.remove('active');
                gameMode = 'pvp';
                resetGame(true);
            });
        }

        if (modePvE) {
            modePvE.addEventListener('click', () => {
                HubOnline.leaveOnlineMode();
                modePvE.classList.add('active');
                if (modePvP) modePvP.classList.remove('active');
                if (modeOnline) modeOnline.classList.remove('active');
                gameMode = 'pve';
                resetGame(true);
            });
        }
    }

    return {
        init,
        reset: resetGame,
        onServerState
    };
})();
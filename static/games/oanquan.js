// ==========================================================
// Ô ĂN QUAN (MANDARIN SQUARE CAPTURING) - TRÒ CHƠI DÂN GIAN VIỆT NAM
// Mô phỏng bàn tay nắm sỏi để rải & đập vào ô trống khi ăn sỏi
// 100% Chuẩn luật dân gian, tối ưu 60fps mượt mà, siêu nhẹ cho RAM 512MB
// ==========================================================

const OAnQuanGame = (function() {
    // 12 Ô: 
    // 0..4: Dân P1 (An - Hàng trên)
    // 5: Quan Phải (Bán nguyệt phải)
    // 6..10: Dân P2 (Thành - Hàng dưới)
    // 11: Quan Trái (Bán nguyệt trái)
    let board = [];
    let currentPlayer = 1; // 1: An, 2: Thành
    let scores = { 1: 0, 2: 0 };
    let selectedCell = null;
    let isAnimating = false;
    let gameOver = false;
    let gameMode = 'pvp'; // 'pvp' (2 người), 'pve' (đấu máy), hoặc 'online'
    let lastAnimatedMoveId = null;

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
        lastAnimatedMoveId = null;

        hideHand();
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

    // ==========================================================
    // CÁC HÀM ĐIỀU KHIỂN BÀN TAY & HIỆU ỨNG ĐẬP Ô TRỐNG
    // ==========================================================
    function getCellElement(idx) {
        if (idx === 5) return document.getElementById('oa-quan-right');
        if (idx === 11) return document.getElementById('oa-quan-left');
        return document.getElementById(`oa-cell-${idx}`);
    }

    function getCellCenter(idx) {
        const boardEl = document.getElementById('oa-board-container') || document.querySelector('.oa-board-container');
        const cellEl = getCellElement(idx);
        if (!boardEl || !cellEl) return { x: 0, y: 0 };
        const boardRect = boardEl.getBoundingClientRect();
        const cellRect = cellEl.getBoundingClientRect();
        return {
            x: cellRect.left - boardRect.left + cellRect.width / 2,
            y: cellRect.top - boardRect.top + cellRect.height / 2
        };
    }

    function showHandAt(idx, count, sprite = '✊') {
        const handEl = document.getElementById('oa-hand-actor');
        const spriteEl = document.getElementById('oa-hand-sprite');
        const badgeEl = document.getElementById('oa-hand-badge');
        if (!handEl) return;

        const pos = getCellCenter(idx);
        handEl.style.transition = 'none';
        handEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        if (spriteEl) spriteEl.textContent = sprite;
        if (badgeEl) badgeEl.textContent = count;
        handEl.className = 'oa-hand-actor active';

        // Bật lại hiệu ứng lướt mượt sau khi nhảy đến ô đầu
        requestAnimationFrame(() => {
            handEl.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.15s ease';
        });
    }

    function moveHandTo(idx) {
        const handEl = document.getElementById('oa-hand-actor');
        if (!handEl) return;
        const pos = getCellCenter(idx);
        handEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    }

    function setHandState(stateClass) {
        const handEl = document.getElementById('oa-hand-actor');
        if (!handEl) return;
        handEl.className = `oa-hand-actor active ${stateClass}`;
    }

    function setHandSprite(sprite) {
        const spriteEl = document.getElementById('oa-hand-sprite');
        if (spriteEl) spriteEl.textContent = sprite;
    }

    function updateHandCount(count) {
        const badgeEl = document.getElementById('oa-hand-badge');
        if (badgeEl) badgeEl.textContent = count;
    }

    function hideHand() {
        const handEl = document.getElementById('oa-hand-actor');
        if (handEl) handEl.classList.remove('active');
    }

    function triggerSlap(idx) {
        const slapEl = document.getElementById('oa-slap-burst');
        const cellEl = getCellElement(idx);
        playSound('slap');

        if (slapEl) {
            const pos = getCellCenter(idx);
            slapEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(0.3)`;
            slapEl.classList.remove('bursting');
            void slapEl.offsetWidth; // Force reflow
            slapEl.classList.add('bursting');
            setTimeout(() => {
                slapEl.classList.remove('bursting');
            }, 600);
        }

        if (cellEl) {
            cellEl.classList.add('oa-cell-slapped');
            setTimeout(() => {
                cellEl.classList.remove('oa-cell-slapped');
            }, 650);
        }
    }

    function highlightDirectionPreviews(idx) {
        clearDirectionPreviews();
        const nextClockwise = (idx + 1) % 12;
        const nextCounter = (idx - 1 + 12) % 12;
        const elCW = getCellElement(nextClockwise);
        const elCCW = getCellElement(nextCounter);
        if (elCW) elCW.classList.add('oa-cell-preview-dir');
        if (elCCW) elCCW.classList.add('oa-cell-preview-dir');
    }

    function clearDirectionPreviews() {
        document.querySelectorAll('.oa-cell-preview-dir').forEach(el => el.classList.remove('oa-cell-preview-dir'));
    }

    // ==========================================================
    // THAO TÁC CHỌN Ô & HƯỚNG ĐI
    // ==========================================================
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

        highlightDirectionPreviews(idx);
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
        clearDirectionPreviews();
    }

    function chooseDirection(dir) {
        hideDirections();
        if (selectedCell === null || isAnimating) return;

        const cell = selectedCell;
        selectedCell = null;
        renderBoard();

        if (gameMode === 'online') {
            HubOnline.sendAction({ action: 'move', start_cell: cell, direction: dir });
            executeMove(cell, dir);
            return;
        }

        executeMove(cell, dir);
    }

    // ==========================================================
    // DIỄN HOẠT BÀN TAY RẢI SỎI & ĐẬP Ô TRỐNG
    // ==========================================================
    async function executeMove(startIdx, dir) {
        isAnimating = true;
        hideDirections();

        const playerName = (currentPlayer === 1) ? 'An' : ((gameMode === 'pve') ? 'Máy' : 'Thành');
        showActionHint(`👉 ${playerName} đang bốc sỏi tại ô ${startIdx + 1}...`);

        let curr = startIdx;
        let hand = board[curr].count;
        board[curr].count = 0;
        renderBoard();

        // 1. Hiện bàn tay tại ô bắt đầu và bốc sỏi
        showHandAt(curr, hand, '🫳');
        setHandState('scoop');
        playSound('click');
        await sleep(240);
        setHandSprite('✊');
        setHandState('');
        await sleep(100);

        const stepDelay = 220; // Tốc độ rải từng viên mượt mà, dễ quan sát hướng đi

        while (hand > 0) {
            // 2. Rải từng viên sỏi theo hướng đã chọn
            while (hand > 0) {
                curr = (curr + dir + 12) % 12;

                // Di chuyển bàn tay tới ô kế tiếp
                moveHandTo(curr);
                await sleep(stepDelay * 0.7);

                // Thả 1 viên sỏi vào ô
                setHandState('drop');
                board[curr].count++;
                hand--;
                updateHandCount(hand);
                renderBoard();

                const cellEl = getCellElement(curr);
                if (cellEl) {
                    cellEl.classList.add('oa-cell-dropping');
                    setTimeout(() => cellEl.classList.remove('oa-cell-dropping'), 180);
                }

                playSound('stone_drop');
                await sleep(stepDelay * 0.3);
                setHandState('');
            }

            // Hết sỏi trên tay, kiểm tra ô kế tiếp
            const nextIdx = (curr + dir + 12) % 12;

            // TRƯỜNG HỢP 1: Ô tiếp theo là Ô DÂN và CÓ SỎI -> Bốc tiếp rải tiếp!
            if (board[nextIdx].type === 'dan' && board[nextIdx].count > 0) {
                moveHandTo(nextIdx);
                await sleep(stepDelay);

                showActionHint(`🖐️ Bốc tiếp ${board[nextIdx].count} sỏi tại ô ${nextIdx + 1}...`);
                setHandState('scoop');
                playSound('click');

                hand = board[nextIdx].count;
                board[nextIdx].count = 0;
                updateHandCount(hand);
                renderBoard();

                curr = nextIdx;
                await sleep(240);
                setHandSprite('✊');
                setHandState('');
                continue;
            }

            // TRƯỜNG HỢP 2: Ô tiếp theo là Ô TRỐNG (count === 0)
            if (board[nextIdx].count === 0) {
                let checkEmpty = nextIdx;
                let eatIdx = (checkEmpty + dir + 12) % 12;

                // Kiểm tra xem ô sau ô trống có sỏi để ĂN không
                if (board[eatIdx].count > 0) {
                    while (board[checkEmpty].count === 0 && board[eatIdx].count > 0) {
                        // Di chuyển bàn tay tới ô trống
                        moveHandTo(checkEmpty);
                        await sleep(stepDelay * 0.8);

                        // Giơ tay lên chuẩn bị đập!
                        setHandSprite('🖐️');
                        setHandState('raise');
                        showActionHint(`💥 ĐẬP VÀO Ô TRỐNG ĐỂ ĂN SỎI!`);
                        await sleep(200);

                        // ĐẬP MẠNH XUỐNG Ô TRỐNG!
                        setHandState('slap');
                        triggerSlap(checkEmpty);
                        await sleep(260);

                        // Thu hoạch sỏi ở ô eatIdx
                        const eaten = board[eatIdx].count;
                        board[eatIdx].count = 0;
                        board[eatIdx].hasBigQuan = false;
                        scores[currentPlayer] += eaten;

                        showActionHint(`🎉 ${playerName} ĂN ĐƯỢC +${eaten} SỎI!`);
                        playSound('score');

                        renderBoard();
                        updateDisplay();
                        await sleep(400);

                        setHandState('');
                        setHandSprite('✊');

                        // Kiểm tra ăn liên hoàn (ô tiếp theo trống và ô sau đó có sỏi)
                        checkEmpty = (eatIdx + dir + 12) % 12;
                        eatIdx = (checkEmpty + dir + 12) % 12;
                    }
                } else {
                    // Cách 2 ô trống -> Nhịn ăn!
                    moveHandTo(nextIdx);
                    setHandSprite('🖐️');
                    showActionHint(`🚫 Gặp 2 ô trống liên tiếp -> Hết lượt!`);
                    await sleep(350);
                }
            }

            // Kết thúc lượt đi
            break;
        }

        hideHand();
        selectedCell = null;
        isAnimating = false;

        // Kiểm tra kết thúc ván
        if (checkGameOver()) {
            endGame();
            return;
        }

        // Chuyển lượt
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        checkMustRefillStones(currentPlayer);

        renderBoard();
        updateDisplay();

        // Nếu là lượt máy (PVE)
        if (gameMode === 'pve' && currentPlayer === 2 && !gameOver) {
            setTimeout(makeAiMove, 600);
        }
    }

    // Khi 5 ô dân bên mình hết sạch quân -> Phải rải mỗi ô 1 viên từ điểm của mình
    function checkMustRefillStones(player) {
        const start = (player === 1) ? 0 : 6;
        const end = (player === 1) ? 4 : 10;
        let total = 0;
        for (let i = start; i <= end; i++) total += board[i].count;

        if (total === 0 && !gameOver) {
            const pName = (player === 1) ? 'An' : ((gameMode === 'pve') ? 'Máy' : 'Thành');
            if (scores[player] >= 5) {
                scores[player] -= 5;
                for (let i = start; i <= end; i++) board[i].count = 1;
                showActionHint(`⚠️ ${pName} hết quân ở 5 ô, phải bỏ ra 5 điểm để rải lại!`);
                playSound('score');
            } else {
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
        let curr = startIdx;
        let count = board[startIdx].count;
        let target = (curr + (count * dir) + 1200) % 12;
        let nextTarget = (target + dir + 12) % 12;
        let eatTarget = (nextTarget + dir + 12) % 12;

        if (board[nextTarget] && board[nextTarget].count === 0 && board[eatTarget] && board[eatTarget].count > 0) {
            return board[eatTarget].count;
        }
        return count; // Ưu tiên ô có nhiều sỏi nếu không ăn được ngay
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
        if (hintEl) hintEl.innerHTML = text;
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

        // Nếu đối thủ vừa đi một nước mới trên máy khác mà máy này chưa diễn hoạt hình bàn tay
        if (st.last_move && st.last_move.move_id && st.last_move.move_id !== lastAnimatedMoveId) {
            lastAnimatedMoveId = st.last_move.move_id;
            if (st.last_move.player_idx !== room.caller_idx && !isAnimating) {
                executeMove(st.last_move.start_cell, st.last_move.direction).then(() => {
                    board = st.board || [];
                    scores = { 1: st.scores[0], 2: st.scores[1] };
                    currentPlayer = st.current_player_idx + 1;
                    renderBoard();
                    updateDisplay();
                });
                return;
            }
        }

        if (!isAnimating) {
            board = st.board || [];
            scores = { 1: st.scores[0], 2: st.scores[1] };
            currentPlayer = st.current_player_idx + 1;
            renderBoard();
            updateDisplay();
        }

        if (room.status === 'game_over') {
            gameOver = true;
            if (st.winner === 'tie') {
                showWinner('HÒA NHAU! 🤝');
            } else if (st.winner !== null) {
                const winName = room.players[st.winner]?.name || (st.winner === 0 ? 'An' : 'Thành');
                showWinner(`${winName.toUpperCase()} CHIẾN THẮNG VỚI ${scores[st.winner + 1]} ĐIỂM! 🏆`);
                playSound('celebrate');
            }
        } else if (!isAnimating) {
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

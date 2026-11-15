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
    let dropSpeed = 'slow'; // 'slow' (Chậm rãi để người chơi kịp suy nghĩ - Mặc định), 'fast' (Nhanh)
    let isFlipped = false; // false: Góc nhìn An (An ở dưới); true: Góc nhìn Thành (Thành ở dưới)
    let autoFlippedForRoom = null;

    function toggleBoardFlip(forceVal) {
        if (typeof forceVal === 'boolean') {
            isFlipped = forceVal;
        } else {
            isFlipped = !isFlipped;
        }

        const boardEl = document.getElementById('oa-board-container');
        const btnFlip = document.getElementById('btn-oa-flip');

        if (boardEl) {
            if (isFlipped) {
                boardEl.classList.add('flipped');
            } else {
                boardEl.classList.remove('flipped');
            }
        }

        if (btnFlip) {
            btnFlip.textContent = isFlipped ? '🔄 Góc nhìn: Thành' : '🔄 Góc nhìn: An';
            btnFlip.title = isFlipped ? 'Đang xem góc nhìn của Thành (Hàng Thành ở dưới). Bấm để đổi sang An.' : 'Đang xem góc nhìn của An (Hàng An ở dưới). Bấm để đổi sang Thành.';
        }

        hideDirections();
        renderBoard();
        updateDisplay();
    }

    function getVisualDirections(idx) {
        // Tính toán xem chiều đi nào thực sự sang TRÁI (←) và chiều nào sang PHẢI (→) trên màn hình
        const nextCW = (idx + 1) % 12;
        const nextCCW = (idx - 1 + 12) % 12;
        const centerCW = getCellCenter(nextCW);
        const centerCCW = getCellCenter(nextCCW);

        // Chiều nào có tọa độ x nhỏ hơn (bên trái màn hình) là Rải Trái
        if (centerCW.x < centerCCW.x) {
            return { leftDir: 1, rightDir: -1, leftNextIdx: nextCW, rightNextIdx: nextCCW };
        } else {
            return { leftDir: -1, rightDir: 1, leftNextIdx: nextCCW, rightNextIdx: nextCW };
        }
    }

    function getSpeedTimings() {
        if (dropSpeed === 'slow') {
            return {
                transitionSec: 0.38,
                moveDelay: 380,       // Bàn tay lướt sang ô kế tiếp (380ms)
                dropDelay: 240,       // Thả 1 viên sỏi xuống ô và đọng lại để nhìn rõ (240ms) -> Tổng 620ms/viên
                scoopPause: 460,      // Dừng lại bốc sỏi ô tiếp theo
                slapRaisePause: 360,  // Giơ tay lên chuẩn bị đập ô trống
                slapHitPause: 400,    // Đập mạnh vào ô trống
                eatPause: 700         // Thời gian tận hưởng số điểm ăn được
            };
        } else {
            return {
                transitionSec: 0.18,
                moveDelay: 180,
                dropDelay: 110,
                scoopPause: 220,
                slapRaisePause: 160,
                slapHitPause: 220,
                eatPause: 360
            };
        }
    }

    function getCellShortName(idx) {
        if (idx === 5) return 'Quan Phải';
        if (idx === 11) return 'Quan Trái';
        if (idx >= 0 && idx <= 4) return `Dân ${idx + 1}`;
        return `Dân ${idx - 5}`;
    }

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

        // Vẽ sỏi nhẹ nhàng (tối đa hiển thị 5 viên visual để tiết kiệm RAM & không tràn khung)
        if (visualEl) {
            visualEl.innerHTML = '';
            if (cellData.hasBigQuan) {
                const bigStone = document.createElement('span');
                bigStone.className = 'big-quan-stone';
                bigStone.textContent = '👑';
                visualEl.appendChild(bigStone);
                // Với ô quan có quan lớn, nếu có thêm sỏi con (tổng > 10), chỉ hiển thị tối đa 3 chấm nhỏ phụ
                const extraPebbles = Math.min(Math.max(0, count - 10), 3);
                for (let k = 0; k < extraPebbles; k++) {
                    const s = document.createElement('span');
                    s.className = 'mini-stone';
                    visualEl.appendChild(s);
                }
            } else {
                // Ô dân hoặc ô quan đã ăn mất quan lớn: hiển thị tối đa 5 chấm sỏi
                const visualCount = Math.min(count, 5);
                for (let k = 0; k < visualCount; k++) {
                    const s = document.createElement('span');
                    s.className = 'mini-stone';
                    visualEl.appendChild(s);
                }
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

        const timings = getSpeedTimings();
        const pos = getCellCenter(idx);
        handEl.style.transition = 'none';
        handEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        if (spriteEl) spriteEl.textContent = sprite;
        if (badgeEl) badgeEl.textContent = count;
        handEl.className = 'oa-hand-actor active';

        // Bật lại hiệu ứng lướt mượt sau khi nhảy đến ô đầu
        requestAnimationFrame(() => {
            handEl.style.transition = `transform ${timings.transitionSec}s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease`;
        });
    }

    function moveHandTo(idx) {
        const handEl = document.getElementById('oa-hand-actor');
        if (!handEl) return;
        const timings = getSpeedTimings();
        handEl.style.transition = `transform ${timings.transitionSec}s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease`;
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
        highlightDirectionPreviews(idx);

        const count = board[idx].count;
        const cellCenter = getCellCenter(idx);
        const cellEl = getCellElement(idx);
        const cellH = cellEl ? cellEl.offsetHeight : 58;

        const { leftDir, rightDir, leftNextIdx, rightNextIdx } = getVisualDirections(idx);

        // 1. Cập nhật Popup nổi trực tiếp trên ô (như hình mẫu)
        const popup = document.getElementById('oa-popup-dirs');
        const pBtnLeft = document.getElementById('oa-popup-btn-left');
        const pBtnRight = document.getElementById('oa-popup-btn-right');

        if (pBtnLeft) {
            pBtnLeft.onclick = (e) => {
                e.stopPropagation();
                chooseDirection(leftDir);
            };
        }
        if (pBtnRight) {
            pBtnRight.onclick = (e) => {
                e.stopPropagation();
                chooseDirection(rightDir);
            };
        }

        if (popup) {
            popup.style.left = `${cellCenter.x}px`;
            // Nếu ô nằm sát mép trên (< 55px từ đỉnh bàn cờ), hiển thị popup bên dưới để không bị tràn
            if (cellCenter.y < 55) {
                popup.style.top = `${cellCenter.y + cellH / 2 + 8}px`;
                popup.classList.add('pos-below');
            } else {
                popup.style.top = `${cellCenter.y - cellH / 2 - 8}px`;
                popup.classList.remove('pos-below');
            }
            popup.classList.remove('hidden');
        }

        // 2. Dự phòng thanh bấm cũ bên dưới nếu có
        const dirBox = document.getElementById('oa-direction-picker');
        if (dirBox) {
            const btnLeft = document.getElementById('oa-btn-left');
            const btnRight = document.getElementById('oa-btn-right');
            if (btnLeft) {
                btnLeft.innerHTML = `⬅️ Rải trái (${getCellShortName(leftNextIdx)})`;
                btnLeft.onclick = () => chooseDirection(leftDir);
            }
            if (btnRight) {
                btnRight.innerHTML = `Rải phải ➡️ (${getCellShortName(rightNextIdx)})`;
                btnRight.onclick = () => chooseDirection(rightDir);
            }
        }

        showActionHint(`👉 Đang chọn ô có <b>${count} sỏi</b>. Bấm <b>← Rải trái</b> hoặc <b>Rải phải →</b> để đi!`);
    }

    function hideDirections() {
        const popup = document.getElementById('oa-popup-dirs');
        if (popup) popup.classList.add('hidden');
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

        const timings = getSpeedTimings();
        const playerName = (currentPlayer === 1) ? 'An' : ((gameMode === 'pve') ? 'Máy' : 'Thành');
        showActionHint(`👉 ${playerName} đang bốc sỏi tại ô ${getCellShortName(startIdx)}...`);

        let curr = startIdx;
        let hand = board[curr].count;
        board[curr].count = 0;
        renderBoard();

        // 1. Hiện bàn tay tại ô bắt đầu và bốc sỏi
        showHandAt(curr, hand, '🫳');
        setHandState('scoop');
        playSound('click');
        await sleep(timings.scoopPause);
        setHandSprite('✊');
        setHandState('');
        await sleep(150);

        while (hand > 0) {
            // 2. Rải từng viên sỏi theo hướng đã chọn (Chậm rãi, nhịp nhàng để dễ suy nghĩ)
            while (hand > 0) {
                curr = (curr + dir + 12) % 12;

                // Di chuyển bàn tay tới ô kế tiếp
                moveHandTo(curr);
                await sleep(timings.moveDelay);

                // Thả 1 viên sỏi vào ô
                setHandState('drop');
                board[curr].count++;
                hand--;
                updateHandCount(hand);
                renderBoard();

                const cellEl = getCellElement(curr);
                if (cellEl) {
                    cellEl.classList.add('oa-cell-dropping');
                    setTimeout(() => cellEl.classList.remove('oa-cell-dropping'), 260);
                }

                playSound('stone_drop');
                showActionHint(`👉 ${playerName} đang rải... ${getCellShortName(curr)} nhận 1 sỏi (còn ${hand} viên trên tay)`);
                await sleep(timings.dropDelay);
                setHandState('');
            }

            // Hết sỏi trên tay, kiểm tra ô kế tiếp
            const nextIdx = (curr + dir + 12) % 12;

            // TRƯỜNG HỢP 1: Ô tiếp theo là Ô DÂN và CÓ SỎI -> Bốc tiếp rải tiếp!
            if (board[nextIdx].type === 'dan' && board[nextIdx].count > 0) {
                moveHandTo(nextIdx);
                await sleep(timings.moveDelay);

                showActionHint(`🖐️ Ô ${getCellShortName(nextIdx)} có ${board[nextIdx].count} sỏi -> Bốc tiếp để rải!`);
                setHandState('scoop');
                playSound('click');

                hand = board[nextIdx].count;
                board[nextIdx].count = 0;
                updateHandCount(hand);
                renderBoard();

                curr = nextIdx;
                await sleep(timings.scoopPause);
                setHandSprite('✊');
                setHandState('');
                await sleep(150);
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
                        await sleep(timings.moveDelay);

                        // Giơ tay lên chuẩn bị đập!
                        setHandSprite('🖐️');
                        setHandState('raise');
                        showActionHint(`💥 Ô ${getCellShortName(checkEmpty)} TRỐNG! Chuẩn bị ĐẬP ĂN ${board[eatIdx].count} sỏi ở ${getCellShortName(eatIdx)}!`);
                        await sleep(timings.slapRaisePause);

                        // ĐẬP MẠNH XUỐNG Ô TRỐNG!
                        setHandState('slap');
                        triggerSlap(checkEmpty);
                        await sleep(timings.slapHitPause);

                        // Thu hoạch sỏi ở ô eatIdx
                        const eaten = board[eatIdx].count;
                        board[eatIdx].count = 0;
                        board[eatIdx].hasBigQuan = false;
                        scores[currentPlayer] += eaten;

                        showActionHint(`🎉 ${playerName} ĐẬP Ô TRỐNG VÀ ĂN ĐƯỢC +${eaten} SỎI!`);
                        playSound('score');

                        renderBoard();
                        updateDisplay();
                        await sleep(timings.eatPause);

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
                    await sleep(timings.eatPause);
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
            setTimeout(makeAiMove, dropSpeed === 'slow' ? 900 : 500);
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
            showWinner(`AN CHIẾN THẮNG VỚI ${s1} ĐIỂM! 🏆`);
        } else if (s2 > s1) {
            showWinner(`${p2Title.toUpperCase()} CHIẾN THẮNG VỚI ${s2} ĐIỂM! 🏆`);
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

        // Cập nhật nhãn và hiệu ứng góc nhìn bàn cờ trên thẻ điểm
        const p1Card = document.getElementById('oa-card-p1');
        const p2Card = document.getElementById('oa-card-p2');
        const p1Tag = document.getElementById('oa-tag-p1');
        const p2Tag = document.getElementById('oa-tag-p2');
        const p2Name = document.getElementById('oa-name-p2');

        if (p2Name) {
            p2Name.textContent = (gameMode === 'pve') ? '🤖 Máy' : '👦 Thành';
        }

        if (p1Tag && p2Tag) {
            if (isFlipped) {
                p1Tag.textContent = 'Đối diện 👆';
                p2Tag.textContent = 'Phía bạn 👇';
                if (p2Card) p2Card.classList.add('my-perspective');
                if (p1Card) p1Card.classList.remove('my-perspective');
            } else {
                p1Tag.textContent = 'Phía bạn 👇';
                p2Tag.textContent = 'Đối diện 👆';
                if (p1Card) p1Card.classList.add('my-perspective');
                if (p2Card) p2Card.classList.remove('my-perspective');
            }
        }

        // Đánh dấu thẻ của người chơi đang đến lượt đi (turn-active)
        if (p1Card && p2Card) {
            if (currentPlayer === 1) {
                p1Card.classList.add('turn-active');
                p2Card.classList.remove('turn-active');
            } else {
                p2Card.classList.add('turn-active');
                p1Card.classList.remove('turn-active');
            }
        }

        // Cập nhật nhãn Quan theo góc nhìn
        const qLeftLabel = document.querySelector('#oa-quan-left .quan-label');
        const qRightLabel = document.querySelector('#oa-quan-right .quan-label');
        if (qLeftLabel && qRightLabel) {
            if (isFlipped) {
                qLeftLabel.textContent = 'QUAN PHẢI';
                qRightLabel.textContent = 'QUAN TRÁI';
            } else {
                qLeftLabel.textContent = 'QUAN TRÁI';
                qRightLabel.textContent = 'QUAN PHẢI';
            }
        }

        const turnName = document.getElementById('oa-turn-name');
        if (turnName) {
            if (currentPlayer === 1) {
                turnName.innerHTML = `LƯỢT CỦA: 👩 <strong>AN</strong>`;
            } else {
                const oppName = (gameMode === 'pve') ? '🤖 <strong>MÁY</strong>' : '👦 <strong>THÀNH</strong>';
                turnName.innerHTML = `LƯỢT CỦA: ${oppName}`;
            }
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

        // Tự động đảo bàn cờ cho người chơi 2 (Thành) trong phòng Online để mỗi người đều thấy hàng của mình ở dưới
        if (typeof room.caller_idx === 'number') {
            if (autoFlippedForRoom !== room.room_code) {
                autoFlippedForRoom = room.room_code;
                toggleBoardFlip(room.caller_idx === 1);
            }
        }

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
            const s1 = (scores && scores[1] !== undefined) ? scores[1] : (st.scores ? st.scores[0] : 0);
            const s2 = (scores && scores[2] !== undefined) ? scores[2] : (st.scores ? st.scores[1] : 0);

            if (st.winner === 'tie' || s1 === s2) {
                showWinner(`HÒA NHAU! 🤝 (${s1} - ${s2})`);
            } else if (s1 > s2) {
                showWinner(`AN CHIẾN THẮNG VỚI ${s1} ĐIỂM! 🏆`);
                playSound('celebrate');
            } else {
                showWinner(`THÀNH CHIẾN THẮNG VỚI ${s2} ĐIỂM! 🏆`);
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
                autoFlippedForRoom = null;
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
                autoFlippedForRoom = null;
                resetGame(true);
            });
        }

        const btnFlip = document.getElementById('btn-oa-flip');
        if (btnFlip) {
            btnFlip.addEventListener('click', () => {
                toggleBoardFlip();
                playSound('click');
            });
        }

        // Bấm ngoài ô sỏi và ngoài popup sẽ đóng popup chọn hướng
        document.addEventListener('pointerdown', (e) => {
            if (!isAnimating && !e.target.closest('.oa-dan-cell') && !e.target.closest('.oa-popup-dirs')) {
                hideDirections();
                selectedCell = null;
                renderBoard();
            }
        });

        const btnSpeed = document.getElementById('btn-oa-speed');
        if (btnSpeed) {
            btnSpeed.addEventListener('click', () => {
                if (dropSpeed === 'slow') {
                    dropSpeed = 'fast';
                    btnSpeed.textContent = '⚡ Tốc độ: Nhanh';
                    btnSpeed.classList.remove('speed-slow');
                    btnSpeed.classList.add('speed-fast');
                    showActionHint('⚡ Đã chuyển sang tốc độ: Nhanh');
                } else {
                    dropSpeed = 'slow';
                    btnSpeed.textContent = '🐢 Tốc độ: Chậm';
                    btnSpeed.classList.remove('speed-fast');
                    btnSpeed.classList.add('speed-slow');
                    showActionHint('🐢 Đã chuyển sang tốc độ: Chậm rãi để suy nghĩ');
                }
                playSound('click');
            });
        }
    }

    return {
        init,
        reset: resetGame,
        onServerState
    };
})();

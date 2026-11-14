// ==========================================================
// CỜ CARO (GOMOKU) - 2 NGƯỜI CHƠI (AN & THÀNH) HOẶC ĐẤU VỚI MÁY
// Nhẹ, siêu nhanh, tối ưu 100% cho điện thoại và máy 512MB RAM
// ==========================================================

const CaroGame = (function() {
    const BOARD_SIZE = 12; // 12x12 vừa vặn tuyệt đối trên điện thoại
    let board = [];
    let currentPlayer = 'X'; // 'X' là An (Nữ), 'O' là Thành (Nam)
    let gameMode = 'pvp'; // 'pvp' (2 người) hoặc 'pve' (chơi với máy)
    let gameOver = false;
    let history = [];
    let p1Name = 'An';
    let p2Name = 'Thành';

    function init() {
        resetGame();
        bindEvents();
    }

    function resetGame(forceLocal = false) {
        if (gameMode === 'online' && !forceLocal) {
            HubOnline.restartGame();
            return;
        }
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        currentPlayer = 'X';
        gameOver = false;
        history = [];
        renderBoard();
        updateTurnDisplay();
        hideWinner();
    }

    function renderBoard() {
        const boardEl = document.getElementById('caro-board');
        if (!boardEl) return;
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'caro-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                const val = board[r][c];
                if (val) {
                    cell.classList.add(val.toLowerCase());
                    cell.textContent = val;
                }

                // Chạm phản hồi 0ms trên điện thoại
                cell.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    makeMove(r, c);
                });

                boardEl.appendChild(cell);
            }
        }
    }

    function makeMove(r, c) {
        if (gameOver || board[r][c]) return;

        // Nếu là Online mode
        if (gameMode === 'online') {
            const room = HubOnline.getRoom();
            if (!room || room.status !== 'playing' || !room.can_act) return;
            playSound('click');
            HubOnline.sendAction({ action: 'move', r, c });
            return;
        }

        board[r][c] = currentPlayer;
        history.push({ r, c, player: currentPlayer });

        // Cập nhật DOM ô cờ vừa đánh trực tiếp
        const cell = document.querySelector(`.caro-cell[data-row="${r}"][data-col="${c}"]`);
        if (cell) {
            cell.classList.add(currentPlayer.toLowerCase(), 'last-move');
            cell.textContent = currentPlayer;
            // Xóa last-move của ô trước
            document.querySelectorAll('.caro-cell.last-move').forEach(el => {
                if (el !== cell) el.classList.remove('last-move');
            });
        }

        playSound('click');

        // Kiểm tra thắng
        const winLine = checkWin(r, c, currentPlayer);
        if (winLine) {
            gameOver = true;
            highlightWinningCells(winLine);
            const winnerName = (currentPlayer === 'X') ? p1Name : p2Name;
            playSound('celebrate');
            showWinner(`${winnerName.toUpperCase()} CHIẾN THẮNG! 🏆`);
            return;
        }

        // Kiểm tra hòa
        if (history.length === BOARD_SIZE * BOARD_SIZE) {
            gameOver = true;
            showWinner('HÒA CỜ! 🤝');
            return;
        }

        // Đổi lượt
        currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
        updateTurnDisplay();

        // Nếu là chế độ đấu với máy và đến lượt máy ('O')
        if (gameMode === 'pve' && currentPlayer === 'O' && !gameOver) {
            setTimeout(makeAiMove, 250);
        }
    }

    function checkWin(r, c, player) {
        const directions = [
            [[0, 1], [0, -1]],   // Ngang
            [[1, 0], [-1, 0]],   // Dọc
            [[1, 1], [-1, -1]],  // Chéo chính
            [[1, -1], [-1, 1]]   // Chéo phụ
        ];

        for (const dir of directions) {
            let cells = [{ r, c }];
            for (const [dr, dc] of dir) {
                let nr = r + dr;
                let nc = c + dc;
                while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
                    cells.push({ r: nr, c: nc });
                    nr += dr;
                    nc += dc;
                }
            }
            if (cells.length >= 5) {
                return cells;
            }
        }
        return null;
    }

    function highlightWinningCells(cells) {
        cells.forEach(({ r, c }) => {
            const el = document.querySelector(`.caro-cell[data-row="${r}"][data-col="${c}"]`);
            if (el) el.classList.add('win-cell');
        });
    }

    // AI Caro thông minh, siêu nhẹ (< 30 dòng, 0ms tính toán, không tốn RAM)
    function makeAiMove() {
        if (gameOver) return;

        // Tìm nước đi tốt nhất: Ưu tiên Thắng > Chặn 4 > Tạo 4 > Chặn 3 > Tạo 3
        let bestScore = -1;
        let bestMove = null;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c]) continue;

                // Điểm tấn công của máy (O) + Điểm phòng thủ trước người (X)
                const attackScore = evaluateSpot(r, c, 'O');
                const defenseScore = evaluateSpot(r, c, 'X');
                const totalScore = attackScore + defenseScore * 1.1;

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMove = { r, c };
                }
            }
        }

        if (bestMove) {
            makeMove(bestMove.r, bestMove.c);
        } else {
            // Nước đi mặc định ở giữa
            const mid = Math.floor(BOARD_SIZE / 2);
            makeMove(mid, mid);
        }
    }

    function evaluateSpot(r, c, player) {
        let score = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;

            // Chiều dương
            let nr = r + dr, nc = c + dc;
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
                count++;
                nr += dr;
                nc += dc;
            }
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !board[nr][nc]) openEnds++;

            // Chiều âm
            nr = r - dr; nc = c - dc;
            while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
                count++;
                nr -= dr;
                nc -= dc;
            }
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !board[nr][nc]) openEnds++;

            if (count >= 5) score += 10000;
            else if (count === 4 && openEnds > 0) score += 2000;
            else if (count === 3 && openEnds === 2) score += 500;
            else if (count === 3 && openEnds === 1) score += 100;
            else if (count === 2 && openEnds === 2) score += 50;
        }

        // Ưu tiên ô gần trung tâm bàn cờ
        const centerDist = Math.abs(r - BOARD_SIZE / 2) + Math.abs(c - BOARD_SIZE / 2);
        score += (BOARD_SIZE - centerDist);

        return score;
    }

    function undoMove() {
        if (gameMode === 'online') return; // Không thể đi lại trong đấu Online
        if (history.length === 0 || gameOver) return;
        const last = history.pop();
        board[last.r][last.c] = null;

        // Nếu đang đấu với máy, rút lui cả nước của máy
        if (gameMode === 'pve' && history.length > 0) {
            const botLast = history.pop();
            board[botLast.r][botLast.c] = null;
        }

        currentPlayer = (gameMode === 'pve') ? 'X' : last.player;
        renderBoard();
        updateTurnDisplay();
        hideWinner();
        gameOver = false;
    }

    function updateTurnDisplay() {
        const turnNameEl = document.getElementById('caro-turn-name');
        const turnBadgeEl = document.getElementById('caro-turn-badge');
        if (!turnNameEl) return;

        if (currentPlayer === 'X') {
            turnNameEl.textContent = `Lượt: ${p1Name} (X)`;
            turnBadgeEl.className = 'turn-pill x-turn';
            turnBadgeEl.innerHTML = `👩 <strong>${p1Name} (X)</strong>`;
        } else {
            const oppTitle = (gameMode === 'pve') ? 'Máy (O)' : `${p2Name} (O)`;
            turnNameEl.textContent = `Lượt: ${oppTitle}`;
            turnBadgeEl.className = 'turn-pill o-turn';
            turnBadgeEl.innerHTML = (gameMode === 'pve') ? `🤖 <strong>Máy (O)</strong>` : `👦 <strong>${p2Name} (O)</strong>`;
        }
    }

    function showWinner(msg) {
        const winBox = document.getElementById('caro-winner-banner');
        if (winBox) {
            winBox.textContent = msg;
            winBox.classList.remove('hidden');
        }
    }

    function hideWinner() {
        const winBox = document.getElementById('caro-winner-banner');
        if (winBox) winBox.classList.add('hidden');
    }

    function onServerState(room) {
        if (room.game_type !== 'caro') return;
        gameMode = 'online';

        const modePvP = document.getElementById('btn-caro-mode-pvp');
        const modePvE = document.getElementById('btn-caro-mode-pve');
        const modeOnline = document.getElementById('btn-caro-mode-online');
        if (modeOnline) modeOnline.classList.add('active');
        if (modePvP) modePvP.classList.remove('active');
        if (modePvE) modePvE.classList.remove('active');

        const st = room.state;
        board = st.board || [];
        p1Name = room.players[0]?.name || 'An';
        p2Name = room.players[1]?.name || 'Thành';
        currentPlayer = (st.current_player_idx === 0) ? 'X' : 'O';

        renderBoard();

        if (st.last_move) {
            const lastCell = document.querySelector(`.caro-cell[data-row="${st.last_move.r}"][data-col="${st.last_move.c}"]`);
            if (lastCell) lastCell.classList.add('last-move');
        }

        if (room.status === 'game_over') {
            gameOver = true;
            if (st.winner === 'tie') {
                showWinner('HÒA CỜ! 🤝');
            } else if (st.winner !== null) {
                const winPlayerName = room.players[st.winner]?.name || (st.winner === 0 ? 'An' : 'Thành');
                showWinner(`${winPlayerName.toUpperCase()} CHIẾN THẮNG! 🏆`);
                if (st.win_line) highlightWinningCells(st.win_line);
                playSound('celebrate');
            }
        } else {
            gameOver = false;
            hideWinner();
        }

        updateTurnDisplay();
    }

    function bindEvents() {
        const btnReset = document.getElementById('btn-caro-reset');
        if (btnReset) btnReset.addEventListener('click', () => resetGame());

        const btnUndo = document.getElementById('btn-caro-undo');
        if (btnUndo) btnUndo.addEventListener('click', undoMove);

        const modePvP = document.getElementById('btn-caro-mode-pvp');
        const modePvE = document.getElementById('btn-caro-mode-pve');
        const modeOnline = document.getElementById('btn-caro-mode-online');

        if (modeOnline) {
            modeOnline.addEventListener('click', () => {
                HubOnline.openModal('caro');
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
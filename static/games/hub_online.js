// ==========================================================
// MULTI-GAME ONLINE HUB CONTROLLER (CARO, Ô ĂN QUAN, ĐOÁN THÚ)
// Nhẹ, siêu nhanh, tối ưu 100% cho 512MB RAM và di động
// ==========================================================

const HubOnline = (function() {
    let currentRoom = null;
    let myPlayerId = null;
    let pollInterval = null;
    let activeGameType = 'caro';
    let selectedName = 'An';
    let isRequestInProgress = false;

    function init() {
        bindModalEvents();
        bindCopyEvents();
        setupVisibilityHandler();
    }

    function bindModalEvents() {
        const modal = document.getElementById('hub-online-modal');
        const btnClose = document.getElementById('btn-close-hub-modal');
        const tabCreate = document.getElementById('tab-hub-create');
        const tabJoin = document.getElementById('tab-hub-join');
        const viewCreate = document.getElementById('hub-create-view');
        const viewJoin = document.getElementById('hub-join-view');
        const btnConfirmCreate = document.getElementById('btn-hub-confirm-create');
        const btnConfirmJoin = document.getElementById('btn-hub-confirm-join');
        const inputCode = document.getElementById('hub-join-room-code');

        if (btnClose) btnClose.addEventListener('click', closeModal);

        if (tabCreate && tabJoin) {
            tabCreate.addEventListener('click', () => {
                tabCreate.classList.add('active');
                tabJoin.classList.remove('active');
                viewCreate.classList.remove('hidden');
                viewJoin.classList.add('hidden');
            });
            tabJoin.addEventListener('click', () => {
                tabJoin.classList.add('active');
                tabCreate.classList.remove('active');
                viewJoin.classList.remove('hidden');
                viewCreate.classList.add('hidden');
                if (inputCode) inputCode.focus();
            });
        }

        // Tên An / Thành
        document.querySelectorAll('[data-hub-name]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-hub-name]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedName = btn.dataset.hubName || 'An';
            });
        });

        // Tạo phòng
        if (btnConfirmCreate) {
            btnConfirmCreate.addEventListener('click', async () => {
                await createRoom(activeGameType, selectedName);
            });
        }

        // Nhập mã phòng
        if (btnConfirmJoin) {
            btnConfirmJoin.addEventListener('click', async () => {
                const code = (inputCode.value || '').trim().toUpperCase();
                if (!code) {
                    alert('Vui lòng nhập mã phòng!');
                    return;
                }
                await joinRoom(code);
            });
        }
    }

    function bindCopyEvents() {
        const copyBtns = [
            { id: 'btn-caro-copy-code', type: 'caro' },
            { id: 'btn-oa-copy-code', type: 'oanquan' },
            { id: 'btn-dt-copy-code', type: 'doanthu' }
        ];

        copyBtns.forEach(item => {
            const btn = document.getElementById(item.id);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (!currentRoom) return;
                    copyRoomLink(currentRoom.room_code, item.type, btn);
                });
            }
        });
    }

    function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopPolling();
            } else if (currentRoom && myPlayerId) {
                startPolling();
            }
        });
    }

    function openModal(gameType, defaultTab = 'create', prefillCode = '') {
        activeGameType = gameType;
        const modal = document.getElementById('hub-online-modal');
        const titleEl = document.getElementById('hub-modal-title');
        const inputCode = document.getElementById('hub-join-room-code');

        const titles = {
            caro: '⭕ Cờ Caro Online',
            oanquan: '🌾 Ô Ăn Quan Online',
            doanthu: '🦁 Đoán Con Thú Online'
        };

        if (titleEl) titleEl.textContent = titles[gameType] || '🌐 Chơi Online 2 Người';

        if (prefillCode && inputCode) {
            inputCode.value = prefillCode.toUpperCase();
        }

        const tabCreate = document.getElementById('tab-hub-create');
        const tabJoin = document.getElementById('tab-hub-join');
        const viewCreate = document.getElementById('hub-create-view');
        const viewJoin = document.getElementById('hub-join-view');

        if (defaultTab === 'join') {
            if (tabJoin) tabJoin.classList.add('active');
            if (tabCreate) tabCreate.classList.remove('active');
            if (viewJoin) viewJoin.classList.remove('hidden');
            if (viewCreate) viewCreate.classList.add('hidden');
        } else {
            if (tabCreate) tabCreate.classList.add('active');
            if (tabJoin) tabJoin.classList.remove('active');
            if (viewCreate) viewCreate.classList.remove('hidden');
            if (viewJoin) viewJoin.classList.add('hidden');
        }

        if (modal) modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('hub-online-modal');
        if (modal) modal.classList.remove('active');
    }

    async function createRoom(gameType, playerName) {
        stopPolling();
        try {
            const res = await fetch('/api/hub/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_type: gameType, player_name: playerName })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Lỗi tạo phòng online!');
                return;
            }

            myPlayerId = data.player_id;
            currentRoom = data.room;
            activeGameType = gameType;

            closeModal();
            showRoomBar(gameType, currentRoom);
            dispatchRoomState(currentRoom);
            startPolling();

            // Cập nhật trạng thái URL không tải lại trang
            updateUrlParam(gameType, currentRoom.room_code);
        } catch (err) {
            console.error('Lỗi createRoom:', err);
            alert('Không thể kết nối máy chủ!');
        }
    }

    async function joinRoom(roomCode) {
        stopPolling();
        try {
            const res = await fetch('/api/hub/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_code: roomCode })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Không thể tham gia phòng này!');
                return;
            }

            myPlayerId = data.player_id;
            currentRoom = data.room;
            activeGameType = data.game_type;

            closeModal();
            // Đảm bảo mở đúng tab game
            switchHubTab(activeGameType);
            showRoomBar(activeGameType, currentRoom);
            dispatchRoomState(currentRoom);
            startPolling();

            updateUrlParam(activeGameType, currentRoom.room_code);
        } catch (err) {
            console.error('Lỗi joinRoom:', err);
            alert('Không thể kết nối máy chủ!');
        }
    }

    function startPolling() {
        stopPolling();
        if (!currentRoom || !myPlayerId) return;

        pollInterval = setInterval(async () => {
            if (isRequestInProgress || !currentRoom || !myPlayerId) return;
            isRequestInProgress = true;
            try {
                const res = await fetch(`/api/hub/${currentRoom.room_code}/state?player_id=${myPlayerId}`);
                if (res.ok) {
                    const roomData = await res.json();
                    currentRoom = roomData;
                    showRoomBar(roomData.game_type, roomData);
                    dispatchRoomState(roomData);
                }
            } catch (e) {
                // Ignore network hiccups
            } finally {
                isRequestInProgress = false;
            }
        }, 1200);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function sendAction(actionData) {
        if (!currentRoom || !myPlayerId) return null;
        try {
            const res = await fetch(`/api/hub/${currentRoom.room_code}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...actionData, player_id: myPlayerId })
            });
            const data = await res.json();
            if (data.success && data.room) {
                currentRoom = data.room;
                showRoomBar(data.room.game_type, data.room);
                dispatchRoomState(data.room);
                return data.room;
            } else if (data.error) {
                console.warn('Action error:', data.error);
            }
            return null;
        } catch (err) {
            console.error('Lỗi sendAction:', err);
            return null;
        }
    }

    async function restartGame() {
        if (!currentRoom || !myPlayerId) return;
        try {
            const res = await fetch(`/api/hub/${currentRoom.room_code}/restart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: myPlayerId })
            });
            const data = await res.json();
            if (data.success && data.room) {
                currentRoom = data.room;
                showRoomBar(data.room.game_type, data.room);
                dispatchRoomState(data.room);
            }
        } catch (err) {
            console.error('Lỗi restartGame:', err);
        }
    }

    function dispatchRoomState(room) {
        if (!room) return;
        const gt = room.game_type;
        if (gt === 'caro' && typeof CaroGame !== 'undefined' && CaroGame.onServerState) {
            CaroGame.onServerState(room);
        } else if (gt === 'oanquan' && typeof OAnQuanGame !== 'undefined' && OAnQuanGame.onServerState) {
            OAnQuanGame.onServerState(room);
        } else if (gt === 'doanthu' && typeof DoanThuGame !== 'undefined' && DoanThuGame.onServerState) {
            DoanThuGame.onServerState(room);
        }
    }

    function showRoomBar(gameType, room) {
        let barId, codeId, statusId, alertId;
        if (gameType === 'caro') {
            barId = 'caro-room-bar'; codeId = 'caro-display-room-code'; statusId = 'caro-display-room-status'; alertId = 'caro-opponent-alert';
        } else if (gameType === 'oanquan') {
            barId = 'oa-room-bar'; codeId = 'oa-display-room-code'; statusId = 'oa-display-room-status'; alertId = 'oa-opponent-alert';
        } else if (gameType === 'doanthu') {
            barId = 'dt-room-bar'; codeId = 'dt-display-room-code'; statusId = 'dt-display-room-status'; alertId = 'dt-opponent-alert';
        } else {
            return;
        }

        const barEl = document.getElementById(barId);
        const codeEl = document.getElementById(codeId);
        const statusEl = document.getElementById(statusId);
        const alertEl = document.getElementById(alertId);

        if (barEl) barEl.classList.remove('hidden');
        if (codeEl) codeEl.textContent = room.room_code;

        if (statusEl) {
            if (room.status === 'waiting') {
                statusEl.innerHTML = '<span class="status-dot pulsing"></span> Chờ đối thủ vào...';
            } else if (room.status === 'choosing_secret') {
                statusEl.innerHTML = '<span class="status-dot pulsing"></span> Chọn con thú bí mật';
            } else if (room.status === 'playing') {
                const oppName = room.opp_name || 'Đối thủ';
                statusEl.innerHTML = `<span class="status-dot online"></span> Đấu với <strong>${oppName}</strong>`;
            } else if (room.status === 'game_over') {
                statusEl.innerHTML = '<span class="status-dot"></span> Ván đấu kết thúc';
            }
        }

        if (alertEl) {
            if (room.status === 'playing') {
                if (room.can_act) {
                    alertEl.classList.add('hidden');
                } else {
                    const oppName = room.opp_name || 'đối thủ';
                    alertEl.innerHTML = `<span class="spinner-small"></span> Đang chờ <strong>${oppName}</strong> thao tác...`;
                    alertEl.classList.remove('hidden');
                }
            } else {
                alertEl.classList.add('hidden');
            }
        }
    }

    function hideRoomBars() {
        ['caro-room-bar', 'oa-room-bar', 'dt-room-bar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        ['caro-opponent-alert', 'oa-opponent-alert', 'dt-opponent-alert'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    }

    function switchHubTab(gameType) {
        document.querySelectorAll('.hub-tab-btn').forEach(btn => {
            if (btn.dataset.gameTarget === gameType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        document.querySelectorAll('.game-view').forEach(v => v.classList.add('hidden'));
        const targetEl = document.getElementById(`game-view-${gameType}`);
        if (targetEl) targetEl.classList.remove('hidden');
    }

    function copyRoomLink(code, gameType, btnEl) {
        const link = `${window.location.origin}/?game=${gameType}&room=${code}`;
        navigator.clipboard.writeText(link).then(() => {
            const originalText = btnEl.innerHTML;
            btnEl.innerHTML = '✅ Đã copy!';
            setTimeout(() => {
                btnEl.innerHTML = originalText;
            }, 2000);
        }).catch(() => {
            prompt('Sao chép liên kết phòng này:', link);
        });
    }

    function updateUrlParam(gameType, code) {
        if (window.history && window.history.replaceState) {
            const newUrl = `${window.location.pathname}?game=${gameType}&room=${code}`;
            window.history.replaceState({}, '', newUrl);
        }
    }

    function leaveOnlineMode() {
        stopPolling();
        currentRoom = null;
        myPlayerId = null;
        hideRoomBars();
    }

    return {
        init,
        openModal,
        closeModal,
        createRoom,
        joinRoom,
        sendAction,
        restartGame,
        startPolling,
        stopPolling,
        leaveOnlineMode,
        getRoom: () => currentRoom,
        getMyPlayerId: () => myPlayerId,
        isOnline: (gt) => !!(currentRoom && currentRoom.game_type === gt)
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    HubOnline.init();
});

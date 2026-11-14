// ==========================================================
// ĐOÁN CON THÚ (GUESS WHO - ANIMAL EDITION) - 100% TIẾNG VIỆT
// Dựa trên 30 con thú và 6 bộ câu hỏi chuẩn theo ảnh mẫu
// ==========================================================

const DoanThuGame = (function() {
    // 30 con thú chuẩn theo ảnh 1
    const ANIMALS = [
        { id: 'orca', name: 'Cá voi sát thủ', en: 'Orca', icon: '🐋', color: 'black_white', home: 'water', legs: 'legs_0', cover: 'scales_smooth', features: ['fins', 'tail'], pattern: 'spots' },
        { id: 'camel', name: 'Lạc đà', en: 'Camel', icon: '🐪', color: 'brown', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'plain' },
        { id: 'lobster', name: 'Tôm hùm', en: 'Lobster', icon: '🦞', color: 'red', home: 'water', legs: 'legs_6plus', cover: 'shell', features: ['tail'], pattern: 'plain' },
        { id: 'deer', name: 'Hươu sao', en: 'Deer', icon: '🦌', color: 'brown', home: 'land', legs: 'legs_4', cover: 'fur', features: ['horns', 'ears', 'tail'], pattern: 'spots' },
        { id: 'clownfish', name: 'Cá hề (Nemo)', en: 'Clownfish', icon: '🐠', color: 'orange', home: 'water', legs: 'legs_0', cover: 'scales_smooth', features: ['fins', 'tail'], pattern: 'stripes' },
        { id: 'scarlet_ibis', name: 'Cò đỏ', en: 'Scarlet Ibis', icon: '🦩', color: 'red', home: 'land_water', legs: 'legs_2', cover: 'feathers', features: ['tail'], pattern: 'plain' },
        { id: 'rhino', name: 'Tê giác', en: 'Rhino', icon: '🦏', color: 'gray', home: 'land', legs: 'legs_4', cover: 'scales_smooth', features: ['horns', 'ears', 'tail'], pattern: 'plain' },
        { id: 'snake', name: 'Rắn', en: 'Snake', icon: '🐍', color: 'green', home: 'land_water', legs: 'legs_0', cover: 'scales_smooth', features: ['tail'], pattern: 'stripes' },
        { id: 'pigeon', name: 'Chim bồ câu', en: 'Pigeon', icon: '🕊️', color: 'gray', home: 'air', legs: 'legs_2', cover: 'feathers', features: ['tail'], pattern: 'plain' },
        { id: 'snail', name: 'Ốc sên', en: 'Snail', icon: '🐌', color: 'brown', home: 'land', legs: 'legs_0', cover: 'shell', features: [], pattern: 'plain' },
        { id: 'goldfish', name: 'Cá vàng', en: 'Goldfish', icon: '🐟', color: 'orange', home: 'water', legs: 'legs_0', cover: 'scales_smooth', features: ['fins', 'tail'], pattern: 'plain' },
        { id: 'walrus', name: 'Hải mã', en: 'Walrus', icon: '🦭', color: 'brown', home: 'land_water', legs: 'legs_0', cover: 'scales_smooth', features: ['tusks', 'fins'], pattern: 'plain' },
        { id: 'giraffe', name: 'Hươu cao cổ', en: 'Giraffe', icon: '🦒', color: 'yellowish', home: 'land', legs: 'legs_4', cover: 'fur', features: ['horns', 'ears', 'tail'], pattern: 'spots' },
        { id: 'panda', name: 'Gấu trúc', en: 'Panda', icon: '🐼', color: 'black_white', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'spots' },
        { id: 'tortoise', name: 'Rùa cạn', en: 'Tortoise', icon: '🐢', color: 'green', home: 'land_water', legs: 'legs_4', cover: 'shell', features: ['tail'], pattern: 'plain' },
        { id: 'frog', name: 'Ếch xanh', en: 'Frog', icon: '🐸', color: 'green', home: 'land_water', legs: 'legs_4', cover: 'scales_smooth', features: [], pattern: 'plain' },
        { id: 'cow', name: 'Bò sữa', en: 'Cow', icon: '🐄', color: 'black_white', home: 'land', legs: 'legs_4', cover: 'fur', features: ['horns', 'ears', 'tail'], pattern: 'spots' },
        { id: 'shark', name: 'Cá mập', en: 'Shark', icon: '🦈', color: 'gray', home: 'water', legs: 'legs_0', cover: 'scales_smooth', features: ['fins', 'tail'], pattern: 'plain' },
        { id: 'parrot', name: 'Chim vẹt', en: 'Parrot', icon: '🦜', color: 'yellowish', home: 'air', legs: 'legs_2', cover: 'feathers', features: ['tail'], pattern: 'plain' },
        { id: 'crab', name: 'Cua biển', en: 'Crab', icon: '🦀', color: 'red', home: 'land_water', legs: 'legs_6plus', cover: 'shell', features: [], pattern: 'plain' },
        { id: 'tiger', name: 'Hổ vằn', en: 'Tiger', icon: '🐅', color: 'orange', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'stripes' },
        { id: 'hippo', name: 'Hà mã', en: 'Hippo', icon: '🦛', color: 'gray', home: 'land_water', legs: 'legs_4', cover: 'scales_smooth', features: ['ears', 'tail'], pattern: 'plain' },
        { id: 'bongo', name: 'Linh dương Bongo', en: 'Bongo', icon: '🦌', color: 'brown', home: 'land', legs: 'legs_4', cover: 'fur', features: ['horns', 'ears', 'tail'], pattern: 'stripes' },
        { id: 'octopus', name: 'Bạch tuộc', en: 'Octopus', icon: '🐙', color: 'red', home: 'water', legs: 'legs_6plus', cover: 'scales_smooth', features: [], pattern: 'plain' },
        { id: 'fox', name: 'Cáo đỏ', en: 'Fox', icon: '🦊', color: 'orange', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'plain' },
        { id: 'crocodile', name: 'Cá sấu', en: 'Crocodile', icon: '🐊', color: 'green', home: 'land_water', legs: 'legs_4', cover: 'scales_smooth', features: ['tail'], pattern: 'plain' },
        { id: 'zebra', name: 'Ngựa vằn', en: 'Zebra', icon: '🦓', color: 'black_white', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'stripes' },
        { id: 'golden_eagle', name: 'Đại bàng vàng', en: 'Golden Eagle', icon: '🦅', color: 'brown', home: 'air', legs: 'legs_2', cover: 'feathers', features: ['tail'], pattern: 'plain' },
        { id: 'elephant', name: 'Voi', en: 'Elephant', icon: '🐘', color: 'gray', home: 'land', legs: 'legs_4', cover: 'scales_smooth', features: ['tusks', 'ears', 'tail'], pattern: 'plain' },
        { id: 'cheetah', name: 'Báo hoa mai', en: 'Cheetah', icon: '🐆', color: 'yellowish', home: 'land', legs: 'legs_4', cover: 'fur', features: ['ears', 'tail'], pattern: 'spots' }
    ];

    // 6 Danh mục câu hỏi theo ảnh 2 - 7
    const CATEGORIES = {
        color: {
            title: 'MÀU SẮC CHÍNH (COLOR)',
            icon: '🎨',
            questions: [
                { id: 'red', label: 'Màu Đỏ (Red)', dot: '#ef4444' },
                { id: 'orange', label: 'Màu Cam (Orange)', dot: '#f97316' },
                { id: 'yellowish', label: 'Màu Vàng (Yellowish)', dot: '#eab308' },
                { id: 'gray', label: 'Màu Xám (Gray)', dot: '#64748b' },
                { id: 'brown', label: 'Màu Nâu (Brown)', dot: '#854d0e' },
                { id: 'green', label: 'Màu Xanh lá (Green)', dot: '#22c55e' },
                { id: 'black_white', label: 'Đen Trắng (Black & White)', dot: '#000000' }
            ]
        },
        home: {
            title: 'NƠI SỐNG (HOME)',
            icon: '🏞️',
            questions: [
                { id: 'water', label: 'Dưới Nước (Water)', emoji: '🌊' },
                { id: 'land', label: 'Trên Cạn (Land)', emoji: '🏜️' },
                { id: 'air', label: 'Trên Không / Biết bay (Air)', emoji: '☁️' },
                { id: 'land_water', label: 'Cả Cạn & Nước (Land & Water)', emoji: '🏝️' }
            ]
        },
        legs: {
            title: 'SỐ LƯỢNG CHÂN (LEGS)',
            icon: '🐾',
            questions: [
                { id: 'legs_0', label: 'Không có chân (0 chân)', emoji: '🐍' },
                { id: 'legs_2', label: 'Có 2 chân', emoji: '🦩' },
                { id: 'legs_4', label: 'Có 4 chân', emoji: '🐾' },
                { id: 'legs_6plus', label: 'Có từ 6 chân trở lên', emoji: '🦀' }
            ]
        },
        cover: {
            title: 'LỚP PHỦ CƠ THỂ (BODY COVERING)',
            icon: '🪶',
            questions: [
                { id: 'fur', label: 'Lông thú / Lông mao (Fur)', emoji: '🦊' },
                { id: 'shell', label: 'Mai / Vỏ cứng (Hard shell)', emoji: '🐚' },
                { id: 'feathers', label: 'Lông vũ (Feathers)', emoji: '🪶' },
                { id: 'scales_smooth', label: 'Da trơn / Có vảy (Smooth / Scales)', emoji: '🦎' }
            ]
        },
        features: {
            title: 'ĐẶC ĐIỂM NỔI BẬT (FEATURES)',
            icon: '🦏',
            questions: [
                { id: 'horns', label: 'Có sừng hoặc gạc', emoji: '🦌' },
                { id: 'ears', label: 'Có tai thấy rõ', emoji: '👂' },
                { id: 'tusks', label: 'Có ngà', emoji: '🐘' },
                { id: 'fins', label: 'Có vây / chân chèo', emoji: '🦈' },
                { id: 'tail', label: 'Có đuôi thấy rõ', emoji: '🐒' }
            ]
        },
        pattern: {
            title: 'HỌA TIẾT CƠ THỂ (PATTERN)',
            icon: '🦓',
            questions: [
                { id: 'stripes', label: 'Có sọc vằn (Stripes)', emoji: '🦓' },
                { id: 'spots', label: 'Có đốm / khoang (Spots/Patches)', emoji: '🐆' },
                { id: 'plain', label: 'Màu trơn (Plain)', emoji: '🦛' }
            ]
        }
    };

    let p1SecretAnimal = null; // Con thú An chọn
    let p2SecretAnimal = null; // Con thú Thành (hoặc Máy) chọn
    let flippedAnimals = new Set(); // Các con thú đã bị lật úp
    let currentPlayer = 1; // 1: An, 2: Thành
    let gameMode = 'pve'; // 'pve' (Đấu Máy) hoặc 'pvp' (2 Người)
    let isGuessingMode = false;
    let questionsAsked = 0;

    function init() {
        resetGame();
        bindEvents();
    }

    function resetGame() {
        flippedAnimals.clear();
        questionsAsked = 0;
        currentPlayer = 1;
        isGuessingMode = false;

        // Máy hoặc Người 2 chọn bí mật 1 con ngẫu nhiên
        p2SecretAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

        // Mặc định con thú của người chơi An
        p1SecretAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

        renderSecretAnimal();
        renderAnimalGrid();
        updateDisplay();
        hideWinner();
        hideQuestionModal();
    }

    function renderAnimalGrid() {
        const gridEl = document.getElementById('dt-animal-grid');
        if (!gridEl) return;
        gridEl.innerHTML = '';

        ANIMALS.forEach(animal => {
            const card = document.createElement('div');
            const isFlipped = flippedAnimals.has(animal.id);
            card.className = `dt-card ${isFlipped ? 'flipped' : ''}`;
            card.dataset.id = animal.id;

            card.innerHTML = `
                <div class="dt-card-inner">
                    <div class="dt-card-front">
                        <span class="dt-animal-icon">${animal.icon}</span>
                        <span class="dt-animal-name">${animal.name}</span>
                        <span class="dt-animal-en">${animal.en}</span>
                    </div>
                    <div class="dt-card-back">
                        <span class="dt-flipped-mark">✕</span>
                    </div>
                </div>
            `;

            // Chạm vào thẻ để lật úp hoặc đoán
            card.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (isGuessingMode) {
                    confirmFinalGuess(animal);
                } else {
                    toggleFlipAnimal(animal.id);
                }
            });

            gridEl.appendChild(card);
        });
    }

    function toggleFlipAnimal(id) {
        playSound('click');
        if (flippedAnimals.has(id)) {
            flippedAnimals.delete(id);
        } else {
            flippedAnimals.add(id);
        }
        renderAnimalGrid();
        updateRemainingCount();
    }

    function renderSecretAnimal() {
        const secretEl = document.getElementById('dt-my-secret-animal');
        if (!secretEl || !p1SecretAnimal) return;
        secretEl.innerHTML = `
            <div class="secret-box">
                <span class="secret-icon">${p1SecretAnimal.icon}</span>
                <div class="secret-info">
                    <strong>${p1SecretAnimal.name}</strong>
                    <small>(${p1SecretAnimal.en})</small>
                </div>
            </div>
        `;
    }

    function updateRemainingCount() {
        const countEl = document.getElementById('dt-remaining-count');
        if (countEl) {
            const rem = ANIMALS.length - flippedAnimals.size;
            countEl.textContent = `${rem}/30 con`;
        }
    }

    // Mở popup danh mục câu hỏi (như các ảnh 2 - 7)
    function openCategoryModal(catKey) {
        const cat = CATEGORIES[catKey];
        if (!cat) return;

        playSound('click');
        const modal = document.getElementById('dt-question-modal');
        const titleEl = document.getElementById('dt-modal-title');
        const bodyEl = document.getElementById('dt-modal-questions');
        if (!modal || !titleEl || !bodyEl) return;

        titleEl.textContent = cat.title;
        bodyEl.innerHTML = '';

        cat.questions.forEach(q => {
            const btn = document.createElement('button');
            btn.className = 'dt-q-btn';

            let prefix = '';
            if (q.dot) {
                prefix = `<span class="q-color-dot" style="background:${q.dot}"></span>`;
            } else if (q.emoji) {
                prefix = `<span class="q-emoji">${q.emoji}</span>`;
            }

            btn.innerHTML = `${prefix} <span>${q.label}</span>`;
            btn.addEventListener('click', () => {
                askQuestion(catKey, q.id, q.label);
            });
            bodyEl.appendChild(btn);
        });

        modal.classList.remove('hidden');
    }

    function hideQuestionModal() {
        const modal = document.getElementById('dt-question-modal');
        if (modal) modal.classList.add('hidden');
    }

    // Người chơi hỏi 1 câu -> Hệ thống trả lời dựa trên con thú bí mật đối thủ
    function askQuestion(categoryKey, questionId, questionLabel) {
        hideQuestionModal();
        questionsAsked++;
        playSound('click');

        const targetAnimal = p2SecretAnimal;
        let isMatch = false;

        if (categoryKey === 'color') {
            isMatch = (targetAnimal.color === questionId);
        } else if (categoryKey === 'home') {
            isMatch = (targetAnimal.home === questionId);
        } else if (categoryKey === 'legs') {
            isMatch = (targetAnimal.legs === questionId);
        } else if (categoryKey === 'cover') {
            isMatch = (targetAnimal.cover === questionId);
        } else if (categoryKey === 'features') {
            isMatch = targetAnimal.features.includes(questionId);
        } else if (categoryKey === 'pattern') {
            isMatch = (targetAnimal.pattern === questionId);
        }

        // Tự động lật úp các con thú không thỏa mãn
        let eliminatedCount = 0;
        ANIMALS.forEach(animal => {
            if (flippedAnimals.has(animal.id)) return;

            let animalHasTrait = false;
            if (categoryKey === 'color') animalHasTrait = (animal.color === questionId);
            else if (categoryKey === 'home') animalHasTrait = (animal.home === questionId);
            else if (categoryKey === 'legs') animalHasTrait = (animal.legs === questionId);
            else if (categoryKey === 'cover') animalHasTrait = (animal.cover === questionId);
            else if (categoryKey === 'features') animalHasTrait = animal.features.includes(questionId);
            else if (categoryKey === 'pattern') animalHasTrait = (animal.pattern === questionId);

            // Nếu câu trả lời là ĐÚNG -> Lật úp những con KHÔNG có đặc điểm này
            // Nếu câu trả lời là SAI -> Lật úp những con CÓ đặc điểm này
            if (isMatch && !animalHasTrait) {
                flippedAnimals.add(animal.id);
                eliminatedCount++;
            } else if (!isMatch && animalHasTrait) {
                flippedAnimals.add(animal.id);
                eliminatedCount++;
            }
        });

        renderAnimalGrid();
        updateRemainingCount();

        // Hiển thị câu trả lời to rõ
        showAnswerBanner(isMatch, questionLabel, eliminatedCount);
    }

    function showAnswerBanner(isMatch, qText, eliminatedCount) {
        const banner = document.getElementById('dt-answer-banner');
        if (!banner) return;

        if (isMatch) {
            playSound('score');
            banner.className = 'dt-answer-banner match-yes';
            banner.innerHTML = `
                <div class="ans-head">✅ <strong>ĐÚNG RỒI!</strong></div>
                <div class="ans-desc">Con thú bí mật <strong>CÓ</strong> đặc điểm: "${qText}".</div>
                <small>Đã tự động loại bỏ ${eliminatedCount} con thú không phù hợp!</small>
            `;
        } else {
            playSound('click');
            banner.className = 'dt-answer-banner match-no';
            banner.innerHTML = `
                <div class="ans-head">❌ <strong>KHÔNG PHẢI!</strong></div>
                <div class="ans-desc">Con thú bí mật <strong>KHÔNG CÓ</strong> đặc điểm: "${qText}".</div>
                <small>Đã tự động loại bỏ ${eliminatedCount} con thú có đặc điểm này!</small>
            `;
        }
        banner.classList.remove('hidden');

        // Tự động ẩn sau 4 giây
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 4000);
    }

    // Chế độ đoán thẳng con thú bí mật
    function toggleGuessMode() {
        isGuessingMode = !isGuessingMode;
        playSound('click');
        const btnGuess = document.getElementById('btn-dt-guess');
        const hintEl = document.getElementById('dt-hint-text');

        if (isGuessingMode) {
            btnGuess.classList.add('active-guessing');
            btnGuess.textContent = '❌ HỦY ĐOÁN';
            if (hintEl) hintEl.innerHTML = '🎯 <strong>CHẠM VÀO CON THÚ BẠN NGHĨ LÀ CON BÍ MẬT!</strong>';
        } else {
            btnGuess.classList.remove('active-guessing');
            btnGuess.textContent = '🎯 ĐOÁN CON THÚ';
            if (hintEl) hintEl.innerHTML = '💡 Chọn 1 danh mục câu hỏi ở dưới để loại trừ dần.';
        }
    }

    function confirmFinalGuess(animal) {
        isGuessingMode = false;
        const btnGuess = document.getElementById('btn-dt-guess');
        if (btnGuess) {
            btnGuess.classList.remove('active-guessing');
            btnGuess.textContent = '🎯 ĐOÁN CON THÚ';
        }

        const isCorrect = (animal.id === p2SecretAnimal.id);
        if (isCorrect) {
            playSound('celebrate');
            showWinner(`CHÚC MỪNG! BẠN ĐÃ ĐOÁN ĐÚNG! 🏆 Con thú bí mật chính là ${animal.name.toUpperCase()} (${animal.en})!`);
        } else {
            playSound('click');
            alert(`Rất tiếc! Không phải con ${animal.name}. Hãy tiếp tục hỏi để thu hẹp phạm vi!`);
        }
    }

    function showWinner(msg) {
        const winBox = document.getElementById('dt-winner-banner');
        if (winBox) {
            winBox.textContent = msg;
            winBox.classList.remove('hidden');
        }
    }

    function hideWinner() {
        const winBox = document.getElementById('dt-winner-banner');
        if (winBox) winBox.classList.add('hidden');
    }

    function updateDisplay() {
        updateRemainingCount();
    }

    function bindEvents() {
        // Nút các danh mục câu hỏi
        document.querySelectorAll('[data-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                openCategoryModal(btn.dataset.cat);
            });
        });

        const btnClose = document.getElementById('dt-btn-close-modal');
        if (btnClose) btnClose.addEventListener('click', hideQuestionModal);

        const btnGuess = document.getElementById('btn-dt-guess');
        if (btnGuess) btnGuess.addEventListener('click', toggleGuessMode);

        const btnReset = document.getElementById('btn-dt-reset');
        if (btnReset) btnReset.addEventListener('click', resetGame);
    }

    return {
        init,
        reset: resetGame
    };
})();
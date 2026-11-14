from flask import Flask, render_template, request, jsonify, session
import random
import string
import time
import os
import uuid

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "yatzy-multiplayer-secret-2026")

UPPER_CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes"]
LOWER_CATEGORIES = [
    "three_of_a_kind", "four_of_a_kind", "full_house",
    "small_straight", "large_straight", "yatzy", "chance"
]
ALL_CATEGORIES = UPPER_CATEGORIES + LOWER_CATEGORIES

# Bộ lưu trữ phòng chơi trong bộ nhớ (Giới hạn nhẹ nhàng cho máy 512MB RAM)
GAMES = {}
MAX_GAMES = 60
GAME_TIMEOUT = 1800  # Tối đa 30 phút không hoạt động để giải phóng RAM

def clean_old_games():
    """Dọn dẹp phòng chơi cũ để giải phóng RAM tối đa."""
    now = time.time()
    expired = [gid for gid, g in GAMES.items() if now - g.get("last_activity", now) > GAME_TIMEOUT]
    for gid in expired:
        GAMES.pop(gid, None)
    if len(GAMES) > MAX_GAMES:
        sorted_games = sorted(GAMES.items(), key=lambda item: item[1].get("last_activity", 0))
        for gid, _ in sorted_games[:len(GAMES) - MAX_GAMES]:
            GAMES.pop(gid, None)

def normalize_player_name(name, default="An"):
    """Chỉ chấp nhận 1 trong 2 tên: An hoặc Thành"""
    if not name:
        return default
    n = str(name).strip().lower()
    if "thành" in n or "thanh" in n:
        return "Thành"
    return "An"

def generate_room_code():
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(random.choice(chars) for _ in range(5))
        if code not in GAMES:
            return code
    return uuid.uuid4().hex[:6].upper()

def calculate_score(category, dice):
    """Tính điểm tương ứng của bộ xúc xắc cho danh mục được chọn."""
    if not dice or len(dice) != 5:
        return 0

    counts = {i: dice.count(i) for i in range(1, 7)}
    dice_sum = sum(dice)

    # Upper Section
    if category == "ones": return counts[1] * 1
    if category == "twos": return counts[2] * 2
    if category == "threes": return counts[3] * 3
    if category == "fours": return counts[4] * 4
    if category == "fives": return counts[5] * 5
    if category == "sixes": return counts[6] * 6

    # Lower Section
    if category == "three_of_a_kind":
        return dice_sum if any(c >= 3 for c in counts.values()) else 0
    if category == "four_of_a_kind":
        return dice_sum if any(c >= 4 for c in counts.values()) else 0
    if category == "full_house":
        has_3 = any(c == 3 for c in counts.values())
        has_2 = any(c == 2 for c in counts.values())
        has_5 = any(c == 5 for c in counts.values())
        return 25 if (has_3 and has_2) or has_5 else 0
    if category == "small_straight":
        unique = set(dice)
        straights = [{1, 2, 3, 4}, {2, 3, 4, 5}, {3, 4, 5, 6}]
        return 30 if any(s.issubset(unique) for s in straights) else 0
    if category == "large_straight":
        unique = set(dice)
        straights = [{1, 2, 3, 4, 5}, {2, 3, 4, 5, 6}]
        return 40 if any(s == unique for s in straights) else 0
    if category == "yatzy":
        return 50 if any(c == 5 for c in counts.values()) else 0
    if category == "chance":
        return dice_sum

    return 0

def compute_totals(scores):
    """Tính tổng điểm nửa trên, thưởng bonus và tổng chung."""
    upper_score = sum(scores.get(cat, 0) for cat in UPPER_CATEGORIES if cat in scores)
    bonus = 35 if upper_score >= 63 else 0
    lower_score = sum(scores.get(cat, 0) for cat in LOWER_CATEGORIES if cat in scores)
    total_score = upper_score + bonus + lower_score
    return {
        "upper_score": upper_score,
        "bonus": bonus,
        "lower_score": lower_score,
        "total_score": total_score
    }

def format_game_state(game, caller_player_id):
    """Định dạng dữ liệu trả về cho client phù hợp với người chơi đang quan sát."""
    current_idx = game["current_player_idx"]
    active_player = game["players"][current_idx] if game["players"] else None
    
    # Xác định xem người gọi API có quyền thực hiện thao tác lượt này không
    can_act = False
    if game["status"] == "playing":
        if game["mode"] in ("single", "pass_play"):
            can_act = True
        elif game["mode"] == "online":
            can_act = (active_player and active_player["id"] == caller_player_id)

    # Tính điểm gợi ý cho người đang đến lượt
    potential_scores = {}
    if game["has_rolled"] and active_player:
        p_scores = game["scores"].get(active_player["id"], {})
        for cat in ALL_CATEGORIES:
            if cat not in p_scores:
                potential_scores[cat] = calculate_score(cat, game["dice"])

    return {
        "game_id": game["id"],
        "mode": game["mode"],
        "status": game["status"],
        "players": game["players"],
        "current_player_idx": current_idx,
        "active_player": active_player,
        "round": game["round"],
        "dice": game["dice"],
        "rolls_left": game["rolls_left"],
        "has_rolled": game["has_rolled"],
        "held": game["held"],
        "scores": game["scores"],
        "totals": game["totals"],
        "potential_scores": potential_scores,
        "can_act": can_act,
        "winner": game.get("winner"),
        "my_player_id": caller_player_id
    }

@app.after_request
def add_cache_headers(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/game/create", methods=["POST"])
def create_game():
    clean_old_games()
    data = request.json or {}
    mode = data.get("mode", "single") # 'single', 'pass_play', 'online'
    p1_name = normalize_player_name(data.get("player_name"), default="An")

    p1_id = uuid.uuid4().hex
    game_id = generate_room_code() if mode == "online" else uuid.uuid4().hex[:8]

    players = [{"id": p1_id, "name": p1_name}]
    status = "playing"

    if mode == "pass_play":
        # Người còn lại tự động là An hoặc Thành
        p2_name = "Thành" if p1_name == "An" else "An"
        p2_id = uuid.uuid4().hex
        players.append({"id": p2_id, "name": p2_name})
    elif mode == "online":
        status = "waiting" # Đang chờ đối thủ tham gia

    game = {
        "id": game_id,
        "mode": mode,
        "status": status,
        "players": players,
        "current_player_idx": 0,
        "round": 1,
        "dice": [1, 2, 3, 4, 5],
        "rolls_left": 3,
        "has_rolled": False,
        "held": [],
        "scores": {p["id"]: {} for p in players},
        "totals": {p["id"]: compute_totals({}) for p in players},
        "winner": None,
        "last_activity": time.time()
    }

    GAMES[game_id] = game
    return jsonify({
        "success": True,
        "game_id": game_id,
        "player_id": p1_id,
        "state": format_game_state(game, p1_id)
    })

@app.route("/api/game/join", methods=["POST"])
def join_game():
    clean_old_games()
    data = request.json or {}
    room_code = (data.get("room_code") or data.get("game_id") or "").strip().upper()
    req_player_name = normalize_player_name(data.get("player_name"), default="Thành")

    if not room_code:
        # Tự động tìm phòng Yatzy đang chờ (chỉ 2 người An & Thành, không cần nhập mã)
        waiting_games = [
            g for g in GAMES.values()
            if g.get("mode") == "online" and g.get("status") == "waiting" and len(g.get("players", [])) == 1
        ]
        if not waiting_games:
            return jsonify({"error": "Chưa có phòng Yatzy nào đang mở! Hãy bấm Tạo Phòng nhé."}), 404
        waiting_games.sort(key=lambda item: item.get("last_activity", 0), reverse=True)
        game = waiting_games[0]
        room_code = game["id"]
    else:
        if room_code not in GAMES:
            return jsonify({"error": "Không tìm thấy phòng chơi với mã này!"}), 404
        game = GAMES[room_code]

    if game["mode"] != "online":
        return jsonify({"error": "Phòng này không phải chế độ chơi Online!"}), 400

    if len(game["players"]) >= 2:
        return jsonify({"error": "Phòng chơi đã đủ 2 người!"}), 400

    p1_name = game["players"][0]["name"]
    # Người tham gia nhận tên đã chọn nếu khác p1, hoặc tự động là người còn lại
    if req_player_name and req_player_name != p1_name:
        p2_name = req_player_name
    else:
        p2_name = "Thành" if p1_name == "An" else "An"

    p2_id = uuid.uuid4().hex
    game["players"].append({"id": p2_id, "name": p2_name})
    game["scores"][p2_id] = {}
    game["totals"][p2_id] = compute_totals({})
    game["status"] = "playing"
    game["last_activity"] = time.time()

    return jsonify({
        "success": True,
        "game_id": room_code,
        "player_id": p2_id,
        "state": format_game_state(game, p2_id)
    })

@app.route("/api/game/<game_id>/state", methods=["GET"])
def get_state(game_id):
    if game_id not in GAMES:
        return jsonify({"error": "Phòng chơi không tồn tại!"}), 404

    game = GAMES[game_id]
    game["last_activity"] = time.time()
    caller_player_id = request.args.get("player_id", "")

    return jsonify(format_game_state(game, caller_player_id))

@app.route("/api/game/<game_id>/roll", methods=["POST"])
def roll(game_id):
    if game_id not in GAMES:
        return jsonify({"error": "Phòng chơi không tồn tại!"}), 404

    game = GAMES[game_id]
    if game["status"] != "playing":
        return jsonify({"error": "Ván đấu chưa sẵn sàng hoặc đã kết thúc!"}), 400

    data = request.json or {}
    caller_player_id = data.get("player_id", "")
    current_idx = game["current_player_idx"]
    active_player = game["players"][current_idx]

    # Kiểm tra quyền đổ xúc xắc
    if game["mode"] == "online" and active_player["id"] != caller_player_id:
        return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

    if game["rolls_left"] <= 0:
        return jsonify({"error": "Đã hết lượt đổ xúc xắc! Hãy chọn 1 ô điểm."}), 400

    held = data.get("held", [])
    held = [i for i in held if isinstance(i, int) and 0 <= i < 5]

    current_dice = game["dice"]
    has_rolled = game["has_rolled"]

    # Nếu là lần đổ đầu tiên của lượt (chưa đổ lần nào), bắt buộc phải đổ cả 5 con, không cho giữ xúc xắc
    if not has_rolled or game["rolls_left"] == 3:
        held = []
        new_dice = [random.randint(1, 6) for _ in range(5)]
    else:
        new_dice = []
        for i in range(5):
            if i in held:
                new_dice.append(current_dice[i])
            else:
                new_dice.append(random.randint(1, 6))

    game["dice"] = new_dice
    game["rolls_left"] -= 1
    game["has_rolled"] = True
    game["held"] = held
    game["last_activity"] = time.time()

    return jsonify(format_game_state(game, caller_player_id))

@app.route("/api/game/<game_id>/hold", methods=["POST"])
def toggle_hold_api(game_id):
    if game_id not in GAMES:
        return jsonify({"error": "Phòng chơi không tồn tại!"}), 404

    game = GAMES[game_id]
    if game["status"] != "playing":
        return jsonify({"error": "Ván đấu chưa sẵn sàng!"}), 400

    data = request.json or {}
    caller_player_id = data.get("player_id", "")
    current_idx = game["current_player_idx"]
    active_player = game["players"][current_idx]

    if game["mode"] == "online" and active_player["id"] != caller_player_id:
        return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

    if not game["has_rolled"] or game["rolls_left"] == 3:
        return jsonify({"error": "Bạn phải đổ xúc xắc lần đầu tiên trước khi được chọn giữ!"}), 400

    held = data.get("held", [])
    held = [i for i in held if isinstance(i, int) and 0 <= i < 5]
    game["held"] = held
    game["last_activity"] = time.time()

    return jsonify({"success": True, "held": held})

@app.route("/api/game/<game_id>/score", methods=["POST"])
def score(game_id):
    clean_old_games()
    if game_id not in GAMES:
        return jsonify({"error": "Phòng chơi không tồn tại!"}), 404

    game = GAMES[game_id]
    if game["status"] != "playing":
        return jsonify({"error": "Ván đấu chưa sẵn sàng hoặc đã kết thúc!"}), 400

    data = request.json or {}
    caller_player_id = data.get("player_id", "")
    category = data.get("category")

    current_idx = game["current_player_idx"]
    active_player = game["players"][current_idx]
    active_pid = active_player["id"]

    # Kiểm tra quyền ghi điểm
    if game["mode"] == "online" and active_pid != caller_player_id:
        return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

    if not game["has_rolled"]:
        return jsonify({"error": "Bạn phải đổ xúc xắc ít nhất 1 lần trước khi chốt điểm!"}), 400

    if not category or category not in ALL_CATEGORIES:
        return jsonify({"error": "Danh mục không hợp lệ!"}), 400

    p_scores = game["scores"][active_pid]
    if category in p_scores:
        return jsonify({"error": "Ô này đã được bạn ghi điểm trước đó!"}), 400

    # Tính điểm và lưu
    score_val = calculate_score(category, game["dice"])
    p_scores[category] = score_val
    game["totals"][active_pid] = compute_totals(p_scores)

    # Đổi lượt
    if game["mode"] == "single":
        if len(p_scores) >= len(ALL_CATEGORIES):
            game["status"] = "game_over"
            game["winner"] = active_pid
        else:
            game["round"] += 1
            game["dice"] = [1, 2, 3, 4, 5]
            game["rolls_left"] = 3
            game["has_rolled"] = False
            game["held"] = []

    else: # 2 người chơi ('pass_play' hoặc 'online')
        if current_idx == 0:
            # Chuyển lượt sang Người chơi 2
            game["current_player_idx"] = 1
            game["dice"] = [1, 2, 3, 4, 5]
            game["rolls_left"] = 3
            game["has_rolled"] = False
            game["held"] = []
        else:
            # Người chơi 2 vừa xong lượt
            p1_id = game["players"][0]["id"]
            p2_id = game["players"][1]["id"]
            if len(game["scores"][p2_id]) >= len(ALL_CATEGORIES):
                # Hoàn thành trọn vẹn 13 vòng
                game["status"] = "game_over"
                s1 = game["totals"][p1_id]["total_score"]
                s2 = game["totals"][p2_id]["total_score"]
                if s1 > s2:
                    game["winner"] = p1_id
                elif s2 > s1:
                    game["winner"] = p2_id
                else:
                    game["winner"] = "tie"
            else:
                game["round"] += 1
                game["current_player_idx"] = 0
                game["dice"] = [1, 2, 3, 4, 5]
                game["rolls_left"] = 3
                game["has_rolled"] = False
                game["held"] = []

    game["last_activity"] = time.time()
    return jsonify(format_game_state(game, caller_player_id))

@app.route("/api/game/<game_id>/restart", methods=["POST"])
def restart_game(game_id):
    if game_id not in GAMES:
        return jsonify({"error": "Phòng chơi không tồn tại!"}), 404

    game = GAMES[game_id]
    game["current_player_idx"] = 0
    game["round"] = 1
    game["dice"] = [1, 2, 3, 4, 5]
    game["rolls_left"] = 3
    game["has_rolled"] = False
    game["held"] = []
    game["scores"] = {p["id"]: {} for p in game["players"]}
    game["totals"] = {p["id"]: compute_totals({}) for p in game["players"]}
    game["winner"] = None
    game["status"] = "playing" if len(game["players"]) >= (2 if game["mode"] != "single" else 1) else "waiting"
    game["last_activity"] = time.time()

    caller_player_id = (request.json or {}).get("player_id", "")
    return jsonify(format_game_state(game, caller_player_id))

# ==========================================================
# MULTI-GAME ONLINE HUB (CARO, Ô ĂN QUAN, ĐOÁN CON THÚ)
# Hỗ trợ 2 người chơi online từ 2 máy khác nhau qua mã phòng
# ==========================================================

HUB_ROOMS = {}

ANIMALS_DATA = {
    'orca': {'color': 'black_white', 'home': 'water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['fins', 'tail'], 'pattern': 'spots'},
    'camel': {'color': 'brown', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'plain'},
    'lobster': {'color': 'red', 'home': 'water', 'legs': 'legs_6plus', 'cover': 'shell', 'features': ['tail'], 'pattern': 'plain'},
    'deer': {'color': 'brown', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['horns', 'ears', 'tail'], 'pattern': 'spots'},
    'clownfish': {'color': 'orange', 'home': 'water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['fins', 'tail'], 'pattern': 'stripes'},
    'scarlet_ibis': {'color': 'red', 'home': 'land_water', 'legs': 'legs_2', 'cover': 'feathers', 'features': ['tail'], 'pattern': 'plain'},
    'rhino': {'color': 'gray', 'home': 'land', 'legs': 'legs_4', 'cover': 'scales_smooth', 'features': ['horns', 'ears', 'tail'], 'pattern': 'plain'},
    'snake': {'color': 'green', 'home': 'land_water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['tail'], 'pattern': 'stripes'},
    'pigeon': {'color': 'gray', 'home': 'air', 'legs': 'legs_2', 'cover': 'feathers', 'features': ['tail'], 'pattern': 'plain'},
    'snail': {'color': 'brown', 'home': 'land', 'legs': 'legs_0', 'cover': 'shell', 'features': [], 'pattern': 'plain'},
    'goldfish': {'color': 'orange', 'home': 'water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['fins', 'tail'], 'pattern': 'plain'},
    'walrus': {'color': 'brown', 'home': 'land_water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['tusks', 'fins'], 'pattern': 'plain'},
    'giraffe': {'color': 'yellowish', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['horns', 'ears', 'tail'], 'pattern': 'spots'},
    'panda': {'color': 'black_white', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'spots'},
    'tortoise': {'color': 'green', 'home': 'land_water', 'legs': 'legs_4', 'cover': 'shell', 'features': ['tail'], 'pattern': 'plain'},
    'frog': {'color': 'green', 'home': 'land_water', 'legs': 'legs_4', 'cover': 'scales_smooth', 'features': [], 'pattern': 'plain'},
    'cow': {'color': 'black_white', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['horns', 'ears', 'tail'], 'pattern': 'spots'},
    'shark': {'color': 'gray', 'home': 'water', 'legs': 'legs_0', 'cover': 'scales_smooth', 'features': ['fins', 'tail'], 'pattern': 'plain'},
    'parrot': {'color': 'yellowish', 'home': 'air', 'legs': 'legs_2', 'cover': 'feathers', 'features': ['tail'], 'pattern': 'plain'},
    'crab': {'color': 'red', 'home': 'land_water', 'legs': 'legs_6plus', 'cover': 'shell', 'features': [], 'pattern': 'plain'},
    'tiger': {'color': 'orange', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'stripes'},
    'hippo': {'color': 'gray', 'home': 'land_water', 'legs': 'legs_4', 'cover': 'scales_smooth', 'features': ['ears', 'tail'], 'pattern': 'plain'},
    'bongo': {'color': 'brown', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['horns', 'ears', 'tail'], 'pattern': 'stripes'},
    'octopus': {'color': 'red', 'home': 'water', 'legs': 'legs_6plus', 'cover': 'scales_smooth', 'features': [], 'pattern': 'plain'},
    'fox': {'color': 'orange', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'plain'},
    'crocodile': {'color': 'green', 'home': 'land_water', 'legs': 'legs_4', 'cover': 'scales_smooth', 'features': ['tail'], 'pattern': 'plain'},
    'zebra': {'color': 'black_white', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'stripes'},
    'golden_eagle': {'color': 'brown', 'home': 'air', 'legs': 'legs_2', 'cover': 'feathers', 'features': ['tail'], 'pattern': 'plain'},
    'elephant': {'color': 'gray', 'home': 'land', 'legs': 'legs_4', 'cover': 'scales_smooth', 'features': ['tusks', 'ears', 'tail'], 'pattern': 'plain'},
    'cheetah': {'color': 'yellowish', 'home': 'land', 'legs': 'legs_4', 'cover': 'fur', 'features': ['ears', 'tail'], 'pattern': 'spots'}
}

def clean_old_hub_rooms():
    now = time.time()
    expired = [rc for rc, r in HUB_ROOMS.items() if now - r.get("last_activity", now) > GAME_TIMEOUT]
    for rc in expired:
        HUB_ROOMS.pop(rc, None)
    if len(HUB_ROOMS) > MAX_GAMES:
        sorted_rooms = sorted(HUB_ROOMS.items(), key=lambda item: item[1].get("last_activity", 0))
        for rc, _ in sorted_rooms[:len(HUB_ROOMS) - MAX_GAMES]:
            HUB_ROOMS.pop(rc, None)

def init_caro_state():
    return {
        "board": [[None for _ in range(12)] for _ in range(12)],
        "current_player_idx": 0,
        "winner": None,
        "win_line": [],
        "last_move": None,
        "history_count": 0
    }

def check_caro_win(board, r, c, player):
    directions = [
        [(0, 1), (0, -1)],
        [(1, 0), (-1, 0)],
        [(1, 1), (-1, -1)],
        [(1, -1), (-1, 1)]
    ]
    for d in directions:
        cells = [{"r": r, "c": c}]
        for dr, dc in d:
            nr, nc = r + dr, c + dc
            while 0 <= nr < 12 and 0 <= nc < 12 and board[nr][nc] == player:
                cells.append({"r": nr, "c": nc})
                nr += dr
                nc += dc
        if len(cells) >= 5:
            return cells
    return None

def init_oanquan_state():
    board = []
    for _ in range(5): board.append({"type": "dan", "count": 5})
    board.append({"type": "quan", "count": 10, "hasBigQuan": True})
    for _ in range(5): board.append({"type": "dan", "count": 5})
    board.append({"type": "quan", "count": 10, "hasBigQuan": True})
    return {
        "board": board,
        "scores": [0, 0],
        "current_player_idx": 0,
        "winner": None,
        "last_action": None
    }

def execute_oanquan_move_server(state, current_idx, start_idx, direction):
    board = state["board"]
    scores = state["scores"]
    hand = board[start_idx]["count"]
    board[start_idx]["count"] = 0
    curr = start_idx

    while hand > 0:
        while hand > 0:
            curr = (curr + direction + 12) % 12
            board[curr]["count"] += 1
            hand -= 1

        next_idx = (curr + direction + 12) % 12
        if board[next_idx]["type"] == "dan" and board[next_idx]["count"] > 0:
            curr = next_idx
            hand = board[curr]["count"]
            board[curr]["count"] = 0
            continue

        if board[next_idx]["count"] == 0:
            check_empty = next_idx
            eat_idx = (check_empty + direction + 12) % 12
            while board[check_empty]["count"] == 0 and board[eat_idx]["count"] > 0:
                eaten = board[eat_idx]["count"]
                board[eat_idx]["count"] = 0
                board[eat_idx]["hasBigQuan"] = False
                scores[current_idx] += eaten
                check_empty = (eat_idx + direction + 12) % 12
                eat_idx = (check_empty + direction + 12) % 12
        break

    # Kiểm tra hết quan (hết ván)
    if board[5]["count"] == 0 and board[11]["count"] == 0:
        for i in range(0, 5):
            scores[0] += board[i]["count"]
            board[i]["count"] = 0
        for i in range(6, 11):
            scores[1] += board[i]["count"]
            board[i]["count"] = 0
        state["winner"] = 0 if scores[0] > scores[1] else (1 if scores[1] > scores[0] else "tie")
        return

    # Chuyển lượt
    next_player = 1 - current_idx
    state["current_player_idx"] = next_player

    # Kiểm tra rải sỏi nếu 5 ô hết quân
    start = 0 if next_player == 0 else 6
    end = 4 if next_player == 0 else 10
    total = sum(board[i]["count"] for i in range(start, end + 1))
    if total == 0:
        if scores[next_player] >= 5:
            scores[next_player] -= 5
            for i in range(start, end + 1):
                board[i]["count"] = 1
        else:
            state["winner"] = current_idx # Xử thua do hết quân

def init_doanthu_state():
    return {
        "secrets": [None, None], # p0, p1
        "flipped": [[], []],
        "current_player_idx": 0,
        "last_answer": None,
        "winner": None
    }

def format_hub_room_state(room, caller_player_id):
    players = room["players"]
    caller_idx = 0 if (players and players[0]["id"] == caller_player_id) else (1 if len(players) > 1 and players[1]["id"] == caller_player_id else -1)
    caller_name = players[caller_idx]["name"] if caller_idx in (0, 1) else ""
    opp_idx = 1 - caller_idx if caller_idx in (0, 1) else -1
    opp_name = players[opp_idx]["name"] if opp_idx in (0, 1) and opp_idx < len(players) else ""
    current_idx = room["state"].get("current_player_idx", 0)

    can_act = False
    if room["status"] == "playing":
        can_act = (caller_idx == current_idx)
    elif room["status"] == "choosing_secret" and room["game_type"] == "doanthu":
        can_act = (caller_idx != -1 and room["state"]["secrets"][caller_idx] is None)

    # Dữ liệu an toàn không để lộ bí mật con thú của đối thủ
    state_copy = dict(room["state"])
    if room["game_type"] == "doanthu":
        my_secret = room["state"]["secrets"][caller_idx] if caller_idx in (0, 1) else None
        state_copy["my_secret"] = my_secret
        state_copy["has_chosen_secret"] = (my_secret is not None)
        state_copy["my_flipped"] = room["state"]["flipped"][caller_idx] if caller_idx in (0, 1) else []
        state_copy["opp_flipped_count"] = len(room["state"]["flipped"][opp_idx]) if opp_idx in (0, 1) else 0
        # Giấu bí mật đối thủ cho đến khi game over
        if room["status"] != "game_over":
            state_copy["secrets"] = ["***" if s else None for s in room["state"]["secrets"]]

    return {
        "room_code": room["room_code"],
        "game_type": room["game_type"],
        "status": room["status"],
        "players": players,
        "caller_idx": caller_idx,
        "caller_name": caller_name,
        "opp_name": opp_name,
        "current_player_idx": current_idx,
        "can_act": can_act,
        "state": state_copy
    }

@app.route("/api/hub/create", methods=["POST"])
def hub_create():
    clean_old_hub_rooms()
    data = request.json or {}
    game_type = data.get("game_type", "caro")
    p1_name = normalize_player_name(data.get("player_name"), default="An")
    p1_id = uuid.uuid4().hex

    room_code = generate_room_code()
    while room_code in HUB_ROOMS or room_code in GAMES:
        room_code = generate_room_code()

    if game_type == "caro":
        init_state = init_caro_state()
        init_status = "waiting"
    elif game_type == "oanquan":
        init_state = init_oanquan_state()
        init_status = "waiting"
    elif game_type == "doanthu":
        init_state = init_doanthu_state()
        init_status = "waiting"
    else:
        init_state = {}
        init_status = "waiting"

    room = {
        "room_code": room_code,
        "game_type": game_type,
        "status": init_status,
        "players": [{"id": p1_id, "name": p1_name}],
        "state": init_state,
        "last_activity": time.time()
    }

    HUB_ROOMS[room_code] = room
    return jsonify({
        "success": True,
        "room_code": room_code,
        "player_id": p1_id,
        "player_name": p1_name,
        "game_type": game_type,
        "room": format_hub_room_state(room, p1_id)
    })

@app.route("/api/hub/join", methods=["POST"])
def hub_join():
    clean_old_hub_rooms()
    data = request.json or {}
    game_type = data.get("game_type", "")
    room_code = (data.get("room_code") or "").strip().upper()
    req_player_name = normalize_player_name(data.get("player_name"), default="Thành")

    if not room_code:
        # Tự động tìm phòng đang chờ cho trò chơi này (Không cần nhập mã)
        waiting_rooms = [
            r for r in HUB_ROOMS.values()
            if r.get("status") in ("waiting", "choosing_secret") and len(r.get("players", [])) == 1
        ]
        if game_type:
            waiting_rooms = [r for r in waiting_rooms if r.get("game_type") == game_type]

        if not waiting_rooms:
            return jsonify({"error": "Chưa có phòng nào đang mở! Hãy bấm Tạo Phòng nhé."}), 404

        waiting_rooms.sort(key=lambda item: item.get("last_activity", 0), reverse=True)
        room = waiting_rooms[0]
        room_code = room["room_code"]
    else:
        if room_code not in HUB_ROOMS:
            return jsonify({"error": "Không tìm thấy phòng chơi với mã này!"}), 404
        room = HUB_ROOMS[room_code]

    if len(room["players"]) >= 2:
        return jsonify({"error": "Phòng chơi đã đủ 2 người!"}), 400

    p1_name = room["players"][0]["name"]
    if req_player_name and req_player_name != p1_name:
        p2_name = req_player_name
    else:
        p2_name = "Thành" if p1_name == "An" else "An"

    p2_id = uuid.uuid4().hex

    room["players"].append({"id": p2_id, "name": p2_name})
    room["status"] = "choosing_secret" if room["game_type"] == "doanthu" else "playing"
    room["last_activity"] = time.time()

    return jsonify({
        "success": True,
        "room_code": room_code,
        "player_id": p2_id,
        "player_name": p2_name,
        "game_type": room["game_type"],
        "room": format_hub_room_state(room, p2_id)
    })

@app.route("/api/hub/lobby_status", methods=["GET"])
def hub_lobby_status():
    clean_old_hub_rooms()
    clean_old_games()
    game_type = request.args.get("game_type", "caro")

    if game_type == "yatzy":
        waiting = [
            g for g in GAMES.values()
            if g.get("mode") == "online" and g.get("status") == "waiting" and len(g.get("players", [])) == 1
        ]
        if waiting:
            waiting.sort(key=lambda item: item.get("last_activity", 0), reverse=True)
            w = waiting[0]
            return jsonify({
                "has_waiting": True,
                "waiting_name": w["players"][0]["name"],
                "room_code": w["id"]
            })
        return jsonify({"has_waiting": False})
    else:
        waiting = [
            r for r in HUB_ROOMS.values()
            if r.get("game_type") == game_type and r.get("status") in ("waiting", "choosing_secret") and len(r.get("players", [])) == 1
        ]
        if waiting:
            waiting.sort(key=lambda item: item.get("last_activity", 0), reverse=True)
            w = waiting[0]
            return jsonify({
                "has_waiting": True,
                "waiting_name": w["players"][0]["name"],
                "room_code": w["room_code"]
            })
        return jsonify({"has_waiting": False})

@app.route("/api/hub/<room_code>/state", methods=["GET"])
def hub_get_state(room_code):
    if room_code not in HUB_ROOMS:
        return jsonify({"error": "Phòng không tồn tại"}), 404

    room = HUB_ROOMS[room_code]
    room["last_activity"] = time.time()
    caller_player_id = request.args.get("player_id", "")
    return jsonify(format_hub_room_state(room, caller_player_id))

@app.route("/api/hub/<room_code>/action", methods=["POST"])
def hub_action(room_code):
    if room_code not in HUB_ROOMS:
        return jsonify({"error": "Phòng không tồn tại"}), 404

    room = HUB_ROOMS[room_code]
    room["last_activity"] = time.time()
    data = request.json or {}
    caller_player_id = data.get("player_id", "")
    action = data.get("action", "")

    players = room["players"]
    caller_idx = 0 if (players and players[0]["id"] == caller_player_id) else (1 if len(players) > 1 and players[1]["id"] == caller_player_id else -1)
    if caller_idx == -1:
        return jsonify({"error": "Người chơi không hợp lệ!"}), 403

    gt = room["game_type"]
    state = room["state"]

    # 1. CARO ACTION
    if gt == "caro":
        if room["status"] != "playing":
            return jsonify({"error": "Ván đấu chưa sẵn sàng!"}), 400
        if caller_idx != state["current_player_idx"]:
            return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

        r = int(data.get("r", data.get("row", -1)))
        c = int(data.get("c", data.get("col", -1)))
        if r < 0 or r >= 12 or c < 0 or c >= 12 or state["board"][r][c] is not None:
            return jsonify({"error": "Ô không hợp lệ!"}), 400

        sym = "X" if caller_idx == 0 else "O"
        state["board"][r][c] = sym
        state["last_move"] = {"r": r, "c": c, "player": sym}
        state["history_count"] += 1

        win_cells = check_caro_win(state["board"], r, c, sym)
        if win_cells:
            state["winner"] = caller_idx
            state["win_line"] = win_cells
            room["status"] = "game_over"
        elif state["history_count"] >= 144:
            state["winner"] = "tie"
            room["status"] = "game_over"
        else:
            state["current_player_idx"] = 1 - caller_idx

    # 2. Ô ĂN QUAN ACTION
    elif gt == "oanquan":
        if room["status"] != "playing":
            return jsonify({"error": "Ván đấu chưa sẵn sàng!"}), 400
        if caller_idx != state["current_player_idx"]:
            return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

        start_cell = int(data.get("start_cell", -1))
        direction = int(data.get("direction", 1))

        # Kiểm tra hợp lệ ô của người chơi
        if caller_idx == 0 and not (0 <= start_cell <= 4 and state["board"][start_cell]["count"] > 0):
            return jsonify({"error": "Ô không hợp lệ!"}), 400
        if caller_idx == 1 and not (6 <= start_cell <= 10 and state["board"][start_cell]["count"] > 0):
            return jsonify({"error": "Ô không hợp lệ!"}), 400

        execute_oanquan_move_server(state, caller_idx, start_cell, direction)
        if state["winner"] is not None:
            room["status"] = "game_over"

    # 3. ĐOÁN CON THÚ ACTION
    elif gt == "doanthu":
        if action == "set_secret":
            animal_id = data.get("animal_id")
            if animal_id not in ANIMALS_DATA:
                return jsonify({"error": "Con thú không hợp lệ!"}), 400
            state["secrets"][caller_idx] = animal_id
            # Nếu cả 2 đều đã chọn con thú bí mật -> chuyển sang playing!
            if state["secrets"][0] and state["secrets"][1]:
                room["status"] = "playing"

        elif action == "ask":
            if room["status"] != "playing":
                return jsonify({"error": "Chưa bắt đầu lượt hỏi!"}), 400
            if caller_idx != state["current_player_idx"]:
                return jsonify({"error": "Chưa đến lượt hỏi của bạn!"}), 403

            cat = data.get("category")
            qid = data.get("question_id")
            qlabel = data.get("question_label", "")

            opp_idx = 1 - caller_idx
            opp_animal_id = state["secrets"][opp_idx]
            opp_animal = ANIMALS_DATA.get(opp_animal_id, {})

            is_match = False
            if cat == "color": is_match = (opp_animal.get("color") == qid)
            elif cat == "home": is_match = (opp_animal.get("home") == qid)
            elif cat == "legs": is_match = (opp_animal.get("legs") == qid)
            elif cat == "cover": is_match = (opp_animal.get("cover") == qid)
            elif cat == "features": is_match = (qid in opp_animal.get("features", []))
            elif cat == "pattern": is_match = (opp_animal.get("pattern") == qid)

            state["last_answer"] = {
                "asker_idx": caller_idx,
                "category": cat,
                "question_id": qid,
                "question_label": qlabel,
                "is_match": is_match
            }
            # Đổi lượt hỏi sang đối thủ
            state["current_player_idx"] = opp_idx

        elif action == "guess":
            if room["status"] != "playing":
                return jsonify({"error": "Chưa trong trận đấu!"}), 400
            if caller_idx != state["current_player_idx"]:
                return jsonify({"error": "Chưa đến lượt của bạn!"}), 403

            animal_id = data.get("animal_id")
            opp_idx = 1 - caller_idx
            opp_animal_id = state["secrets"][opp_idx]

            if animal_id == opp_animal_id:
                state["winner"] = caller_idx
                room["status"] = "game_over"
            else:
                # Đoán sai -> Đổi lượt
                state["current_player_idx"] = opp_idx
                state["last_answer"] = {
                    "asker_idx": caller_idx,
                    "is_guess_fail": True,
                    "guessed_animal": animal_id
                }

        elif action == "toggle_flip":
            animal_id = data.get("animal_id")
            my_flipped = state["flipped"][caller_idx]
            if animal_id in my_flipped:
                my_flipped.remove(animal_id)
            else:
                my_flipped.append(animal_id)

    return jsonify({
        "success": True,
        "room": format_hub_room_state(room, caller_player_id)
    })

@app.route("/api/hub/<room_code>/restart", methods=["POST"])
def hub_restart(room_code):
    if room_code not in HUB_ROOMS:
        return jsonify({"error": "Phòng không tồn tại"}), 404

    room = HUB_ROOMS[room_code]
    data = request.json or {}
    caller_player_id = data.get("player_id", "")
    gt = room["game_type"]

    if gt == "caro":
        room["state"] = init_caro_state()
        room["status"] = "playing"
    elif gt == "oanquan":
        room["state"] = init_oanquan_state()
        room["status"] = "playing"
    elif gt == "doanthu":
        room["state"] = init_doanthu_state()
        room["status"] = "choosing_secret"

    room["last_activity"] = time.time()
    return jsonify({
        "success": True,
        "room": format_hub_room_state(room, caller_player_id)
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

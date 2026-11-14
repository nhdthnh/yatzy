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
    data = request.json or {}
    room_code = (data.get("room_code") or "").strip().upper()
    player_name = (data.get("player_name") or "").strip() or "Người chơi 2"

    if room_code not in GAMES:
        return jsonify({"error": "Không tìm thấy phòng chơi với mã này!"}), 404

    game = GAMES[room_code]
    if game["mode"] != "online":
        return jsonify({"error": "Phòng này không phải chế độ chơi Online!"}), 400

    if len(game["players"]) >= 2:
        return jsonify({"error": "Phòng chơi đã đủ 2 người!"}), 400

    p1_name = game["players"][0]["name"]
    # Người tham gia nhận tên còn lại: An hoặc Thành
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

extends Node
## ComboManager
## Tracks consecutive successful hits. combo count doubles as the score
## multiplier (1 hit = x1, 2 = x2, ...), capped at MAX_MULTIPLIER so score
## does not explode on long runs. A hit resets the break timer; missing a
## target, hitting a fake target, or colliding with an obstacle breaks it.

signal combo_changed(combo: int, multiplier: int)
signal combo_broken(previous_combo: int)

const MAX_MULTIPLIER := 10
const COMBO_TIMEOUT_SEC := 2.2

var combo: int = 0
var max_combo: int = 0

var _timeout_timer: Timer

func _ready() -> void:
	_timeout_timer = Timer.new()
	_timeout_timer.one_shot = true
	_timeout_timer.wait_time = COMBO_TIMEOUT_SEC
	_timeout_timer.timeout.connect(_on_timeout)
	add_child(_timeout_timer)

func reset() -> void:
	combo = 0
	max_combo = 0
	_timeout_timer.stop()
	combo_changed.emit(combo, get_multiplier())

func register_hit() -> void:
	combo += 1
	max_combo = max(max_combo, combo)
	_timeout_timer.start(COMBO_TIMEOUT_SEC)
	combo_changed.emit(combo, get_multiplier())

	if combo >= 2:
		AudioManager.play_sfx("combo_up")
	if combo > 0 and combo % 5 == 0:
		AudioManager.play_sfx("perfect_hit")

func break_combo() -> void:
	if combo == 0:
		return
	var previous := combo
	combo = 0
	_timeout_timer.stop()
	combo_broken.emit(previous)
	combo_changed.emit(combo, get_multiplier())

func get_multiplier() -> int:
	return clampi(max(combo, 1), 1, MAX_MULTIPLIER)

func _on_timeout() -> void:
	break_combo()

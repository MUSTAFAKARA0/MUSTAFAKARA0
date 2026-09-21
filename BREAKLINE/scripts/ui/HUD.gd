extends Control
## HUD
## Minimalist in-game overlay: score (top-center), combo (pulses under the
## score when active), coins earned this run (top-right), and a static
## crosshair. Reads GameManager.coins_earned directly since coin gains
## don't need their own signal for a value this small.

@onready var score_label: Label = $ScoreLabel
@onready var combo_label: Label = $ComboLabel
@onready var coins_label: Label = $CoinsLabel
@onready var crosshair_h: ColorRect = $CrosshairH
@onready var crosshair_v: ColorRect = $CrosshairV

var _displayed_score: int = 0

func _ready() -> void:
	ScoreManager.score_changed.connect(_on_score_changed)
	ComboManager.combo_changed.connect(_on_combo_changed)
	InputManager.shoot_requested.connect(_on_shoot_requested)
	_displayed_score = ScoreManager.score
	score_label.text = str(_displayed_score)
	_on_combo_changed(ComboManager.combo, ComboManager.get_multiplier())

func _process(_delta: float) -> void:
	coins_label.text = "◆ %d" % GameManager.coins_earned

func _on_score_changed(new_score: int, _delta: int) -> void:
	# Counts up over 0.35s instead of snapping -- makes big-multiplier hits
	# read as a bigger deal than a small one without any extra UI.
	var tween := create_tween()
	tween.tween_method(_set_displayed_score, _displayed_score, new_score, 0.35)

func _set_displayed_score(value: float) -> void:
	_displayed_score = int(round(value))
	score_label.text = str(_displayed_score)

func _on_combo_changed(combo: int, multiplier: int) -> void:
	if combo <= 1:
		combo_label.visible = false
		return

	combo_label.visible = true
	combo_label.text = "x%d COMBO" % multiplier
	combo_label.pivot_offset = combo_label.size / 2.0
	combo_label.scale = Vector2(1.35, 1.35)
	var tween := create_tween()
	tween.tween_property(combo_label, "scale", Vector2(1, 1), 0.22).set_trans(Tween.TRANS_BACK)

func _on_shoot_requested(_screen_pos: Vector2) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	for rect in [crosshair_h, crosshair_v]:
		rect.pivot_offset = rect.size / 2.0
		rect.scale = Vector2(1.6, 1.6)
		var tween := create_tween()
		tween.tween_property(rect, "scale", Vector2(1, 1), 0.15).set_trans(Tween.TRANS_QUINT)

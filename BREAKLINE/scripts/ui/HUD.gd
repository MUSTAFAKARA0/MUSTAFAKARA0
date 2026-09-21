extends Control
## HUD
## Minimalist in-game overlay: score (top-center), combo (pulses under the
## score when active), coins earned this run (top-right), and a static
## crosshair. Reads GameManager.coins_earned directly since coin gains
## don't need their own signal for a value this small.

@onready var score_label: Label = $ScoreLabel
@onready var combo_label: Label = $ComboLabel
@onready var coins_label: Label = $CoinsLabel

func _ready() -> void:
	ScoreManager.score_changed.connect(_on_score_changed)
	ComboManager.combo_changed.connect(_on_combo_changed)
	_on_score_changed(ScoreManager.score, 0)
	_on_combo_changed(ComboManager.combo, ComboManager.get_multiplier())

func _process(_delta: float) -> void:
	coins_label.text = "◆ %d" % GameManager.coins_earned

func _on_score_changed(new_score: int, _delta: int) -> void:
	score_label.text = str(new_score)

func _on_combo_changed(combo: int, multiplier: int) -> void:
	if combo <= 1:
		combo_label.visible = false
		return

	combo_label.visible = true
	combo_label.text = "x%d COMBO" % multiplier
	combo_label.scale = Vector2(1.35, 1.35)
	var tween := create_tween()
	tween.tween_property(combo_label, "scale", Vector2(1, 1), 0.22).set_trans(Tween.TRANS_BACK)

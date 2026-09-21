extends Control
class_name GameOverScreen
## GameOverScreen
## Displays the result of a run and lets the player retry or return home.
## LevelManager calls display_stats() with the dictionary GameManager built
## in trigger_game_over(); this script never reaches into game state itself.

signal retry_requested
signal home_requested

@onready var score_value: Label = $Panel/VBox/ScoreRow/ScoreValue
@onready var best_value: Label = $Panel/VBox/BestRow/BestValue
@onready var distance_value: Label = $Panel/VBox/DistanceRow/DistanceValue
@onready var accuracy_value: Label = $Panel/VBox/AccuracyRow/AccuracyValue
@onready var combo_value: Label = $Panel/VBox/ComboRow/ComboValue
@onready var coins_value: Label = $Panel/VBox/CoinsRow/CoinsValue
@onready var retry_button: Button = $Panel/VBox/Buttons/RetryButton
@onready var home_button: Button = $Panel/VBox/Buttons/HomeButton
@onready var panel: PanelContainer = $Panel

func _ready() -> void:
	retry_button.pressed.connect(_on_retry_pressed)
	home_button.pressed.connect(_on_home_pressed)

func display_stats(stats: Dictionary) -> void:
	score_value.text = str(int(stats.get("score", 0)))
	best_value.text = str(int(stats.get("best_score", 0)))
	distance_value.text = "%dm" % int(stats.get("distance", 0.0))
	accuracy_value.text = "%d%%" % int(stats.get("accuracy", 0.0))
	combo_value.text = "x%d" % int(stats.get("max_combo", 0))
	coins_value.text = "+%d" % int(stats.get("coins", 0))

## Shows the panel and fills it with `stats` in one call, with a short
## fade + scale-in reveal instead of an instant appear.
func reveal(stats: Dictionary) -> void:
	display_stats(stats)
	visible = true
	modulate.a = 0.0
	panel.pivot_offset = panel.size / 2.0
	panel.scale = Vector2(0.85, 0.85)

	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "modulate:a", 1.0, 0.25)
	tween.tween_property(panel, "scale", Vector2(1.0, 1.0), 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _punch_button(button: Button) -> void:
	button.pivot_offset = button.size / 2.0
	button.scale = Vector2(0.9, 0.9)
	var tween := create_tween()
	tween.tween_property(button, "scale", Vector2(1.0, 1.0), 0.15).set_trans(Tween.TRANS_BACK)

func _on_retry_pressed() -> void:
	AudioManager.play_sfx("button_click")
	_punch_button(retry_button)
	retry_requested.emit()

func _on_home_pressed() -> void:
	AudioManager.play_sfx("button_click")
	_punch_button(home_button)
	home_requested.emit()

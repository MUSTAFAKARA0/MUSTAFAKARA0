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

func _on_retry_pressed() -> void:
	AudioManager.play_sfx("button_click")
	retry_requested.emit()

func _on_home_pressed() -> void:
	AudioManager.play_sfx("button_click")
	home_requested.emit()

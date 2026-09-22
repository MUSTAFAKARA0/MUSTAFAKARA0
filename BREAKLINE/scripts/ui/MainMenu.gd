extends Control
## MainMenu
## Deliberately minimal for the vertical slice: title, best score, and a
## single PLAY button. Shop/Levels/Profile/Settings screens are not built
## yet -- see docs/ROADMAP.md; we don't ship placeholder menus for systems
## that don't exist.

@onready var play_button: Button = $CenterContainer/VBox/PlayButton
@onready var best_score_label: Label = $CenterContainer/VBox/BestScoreLabel
@onready var title_label: Label = $CenterContainer/VBox/Title

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	best_score_label.text = "BEST SCORE: %d" % SaveManager.get_best_score()
	AudioManager.play_music("main_menu_theme")

	title_label.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(title_label, "modulate:a", 1.0, 0.6)

func _on_play_pressed() -> void:
	AudioManager.play_sfx("button_click")
	play_button.pivot_offset = play_button.size / 2.0
	play_button.scale = Vector2(0.9, 0.9)
	var tween := create_tween()
	tween.tween_property(play_button, "scale", Vector2(1.0, 1.0), 0.15).set_trans(Tween.TRANS_BACK)
	GameManager.go_to_level()

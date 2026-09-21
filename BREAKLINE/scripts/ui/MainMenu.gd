extends Control
## MainMenu
## Deliberately minimal for the vertical slice: title, best score, and a
## single PLAY button. Shop/Levels/Profile/Settings screens are not built
## yet -- see docs/ROADMAP.md; we don't ship placeholder menus for systems
## that don't exist.

@onready var play_button: Button = $CenterContainer/VBox/PlayButton
@onready var best_score_label: Label = $CenterContainer/VBox/BestScoreLabel

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	best_score_label.text = "BEST SCORE: %d" % SaveManager.get_best_score()
	AudioManager.play_music("main_menu_theme")

func _on_play_pressed() -> void:
	AudioManager.play_sfx("button_click")
	GameManager.go_to_level()

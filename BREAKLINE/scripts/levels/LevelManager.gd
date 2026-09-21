extends Node3D
class_name LevelManager
## LevelManager
## Root script for a playable level scene (Level01.tscn, and subclassed by
## ShowcaseDirector for ShowcaseSection.tscn). Loads LevelData,
## pushes its values into the player and spawners, drives the difficulty
## curve every frame, and reacts to GameManager's run lifecycle. Reloading
## the scene (GameManager.retry()) re-runs all of this from scratch.

@export var level_data_path: String = "res://data/levels/level_01.tres"

@onready var player: PlayerController = $Player
@onready var target_manager: TargetManager = $TargetManager
@onready var obstacle_manager: ObstacleManager = $ObstacleManager
@onready var hud: Control = $UILayer/HUD
@onready var game_over_screen: GameOverScreen = $UILayer/GameOverScreen

var level_data: LevelData

func _ready() -> void:
	level_data = load(level_data_path)
	if level_data == null:
		push_error("LevelManager: failed to load LevelData at '%s', falling back to defaults." % level_data_path)
		level_data = LevelData.new()

	player.base_forward_speed = level_data.base_forward_speed
	player.max_forward_speed = level_data.max_forward_speed
	player.speed_ramp_per_second = level_data.speed_ramp_per_second

	target_manager.setup(player)
	obstacle_manager.setup(player)

	AudioManager.play_music(level_data.music_track)

	hud.visible = true
	game_over_screen.visible = false
	game_over_screen.retry_requested.connect(GameManager.retry)
	game_over_screen.home_requested.connect(GameManager.go_to_main_menu)

	if not GameManager.run_ended.is_connected(_on_run_ended):
		GameManager.run_ended.connect(_on_run_ended)

	GameManager.start_run()

func _process(_delta: float) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	var difficulty := clamp(
		GameManager.distance_traveled / max(level_data.difficulty_ramp_distance, 1.0),
		0.0, 1.0
	)
	target_manager.update(difficulty)
	obstacle_manager.update(difficulty)

func _on_run_ended(stats: Dictionary) -> void:
	hud.visible = false
	game_over_screen.reveal(stats)
	AudioManager.stop_music()

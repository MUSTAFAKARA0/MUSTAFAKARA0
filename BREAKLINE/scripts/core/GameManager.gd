extends Node
## GameManager
## Central state machine for BREAKLINE. Autoload singleton.
## Owns the current run's stats and drives scene transitions between
## Main Menu <-> Level. Individual gameplay systems (score, combo, save)
## stay in their own managers; this node only orchestrates state.

enum State { MENU, PLAYING, PAUSED, GAME_OVER }

signal state_changed(new_state: State)
signal run_started
signal run_ended(stats: Dictionary)

const MAIN_MENU_SCENE := "res://scenes/ui/MainMenu.tscn"
const LEVEL_01_SCENE := "res://scenes/levels/Level01.tscn"

var current_state: State = State.MENU

var shots_fired: int = 0
var shots_hit: int = 0
var distance_traveled: float = 0.0
var coins_earned: int = 0
var current_level_path: String = LEVEL_01_SCENE

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

func start_run() -> void:
	shots_fired = 0
	shots_hit = 0
	distance_traveled = 0.0
	coins_earned = 0
	ScoreManager.reset()
	ComboManager.reset()
	_set_state(State.PLAYING)
	run_started.emit()

func register_shot_fired() -> void:
	shots_fired += 1

func register_shot_hit() -> void:
	shots_hit += 1

func add_coins(amount: int) -> void:
	coins_earned += amount

func get_accuracy() -> float:
	if shots_fired <= 0:
		return 0.0
	return float(shots_hit) / float(shots_fired) * 100.0

func trigger_game_over() -> void:
	if current_state != State.PLAYING:
		return
	_set_state(State.GAME_OVER)

	var stats := {
		"score": ScoreManager.score,
		"best_score": max(ScoreManager.score, SaveManager.data.get("best_score", 0)),
		"distance": distance_traveled,
		"accuracy": get_accuracy(),
		"max_combo": ComboManager.max_combo,
		"coins": coins_earned,
	}

	SaveManager.register_run_result(stats)
	run_ended.emit(stats)

## Reloading/loading the level scene triggers that scene's own _ready(),
## which is responsible for calling start_run() once it has set itself up
## (see LevelManager.gd). GameManager only handles the transition itself.
func retry() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()

func go_to_main_menu() -> void:
	get_tree().paused = false
	_set_state(State.MENU)
	get_tree().change_scene_to_file(MAIN_MENU_SCENE)

func go_to_level(level_path: String = "") -> void:
	if level_path != "":
		current_level_path = level_path
	get_tree().change_scene_to_file(current_level_path)

func set_paused(paused: bool) -> void:
	if current_state != State.PLAYING and paused:
		return
	get_tree().paused = paused
	_set_state(State.PAUSED if paused else State.PLAYING)

func _set_state(new_state: State) -> void:
	current_state = new_state
	state_changed.emit(new_state)
